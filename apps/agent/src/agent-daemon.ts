import * as http from 'node:http';
import { ConfigManager, AgentConfig } from './config';
import { LocalOfflineQueue } from './local-queue';
import { PrinterDiscoveryService, DiscoveredPrinter } from './printer-discovery';
import { SpoolerExecutor } from './spooler-executor';
import { PrintCommandTicket, SpoolerResult } from '@inklly/shared';

export class AgentDaemon {
  private configManager: ConfigManager;
  private queue: LocalOfflineQueue;
  private server: http.Server | null = null;
  private isRunning: boolean = false;
  private printers: DiscoveredPrinter[] = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private workerInterval: NodeJS.Timeout | null = null;

  constructor(configManager?: ConfigManager, queue?: LocalOfflineQueue) {
    this.configManager = configManager || new ConfigManager();
    const config = this.configManager.get();
    this.queue = queue || new LocalOfflineQueue(config.offlineQueuePath);
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    this.printers = await PrinterDiscoveryService.discoverPrinters();

    // Start Local HTTP Diagnostics Server
    const config = this.configManager.get();
    this.server = http.createServer((req, res) => this.handleLocalRequest(req, res));

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(config.localPort, '127.0.0.1', () => {
        console.log(`[Inklly Agent] Local HTTP server listening on http://127.0.0.1:${config.localPort}`);
        resolve();
      });
      this.server!.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[Inklly Agent] Port ${config.localPort} in use. Continuing without local diagnostic server.`);
          resolve();
        } else {
          reject(err);
        }
      });
    });

    // Auto-enroll if not yet paired
    if (!config.isPaired) {
      await this.enrollWithServer();
    }

    // Start background tasks
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), config.heartbeatIntervalMs);
    this.pollInterval = setInterval(() => this.pollServerCommands(), config.pollIntervalMs);
    this.workerInterval = setInterval(() => this.processNextQueueItem(), 2000);

    // Initial immediate run
    this.sendHeartbeat();
    this.pollServerCommands();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.workerInterval) clearInterval(this.workerInterval);
    if (this.server) this.server.close();
    this.queue.close();
    console.log('[Inklly Agent] Daemon stopped cleanly.');
  }

  public async enrollWithServer(shopId?: string, secretKey?: string): Promise<boolean> {
    const config = this.configManager.get();
    const targetShopId = shopId || config.shopId;
    const targetSecretKey = secretKey || config.secretKey || 'agent-secret-pos';

    try {
      const res = await fetch(`${config.serverUrl}/agent/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: targetShopId,
          secretKey: targetSecretKey,
          hostname: process.env.COMPUTERNAME || 'LOCAL-POS-TERMINAL',
          osPlatform: process.platform,
          osVersion: 'Windows 11 / macOS',
          agentVersion: '1.0.0',
        }),
      });

      if (res.ok) {
        const body = (await res.json()) as any;
        this.configManager.update({
          shopId: body.shopId,
          shopCode: body.shopCode,
          agentId: body.agentId,
          isPaired: true,
        });
        console.log(`[Inklly Agent] Successfully paired with shop ${body.shopCode} (${body.agentId})`);
        return true;
      }
    } catch (err: any) {
      console.warn('[Inklly Agent] Enrollment pending server availability:', err.message);
    }
    return false;
  }

  public async sendHeartbeat(): Promise<void> {
    const config = this.configManager.get();
    if (!config.agentId || !config.shopId) return;

    try {
      await fetch(`${config.serverUrl}/agent/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: config.agentId,
          shopId: config.shopId,
          status: 'ONLINE',
          activePrintersCount: this.printers.filter((p) => p.isOnline).length,
          localQueueDepth: this.queue.getQueueDepth(),
          sqliteCacheHealthy: true,
        }),
      });
    } catch {
      // Offline heartbeat failure logged silently
    }
  }

  public async pollServerCommands(): Promise<number> {
    const config = this.configManager.get();
    if (!config.shopId) return 0;

    try {
      const res = await fetch(`${config.serverUrl}/agent/poll-commands?shopId=${config.shopId}`);
      if (!res.ok) return 0;

      const tickets = (await res.json()) as PrintCommandTicket[];
      let enqueued = 0;
      for (const ticket of tickets) {
        if (this.queue.enqueue(ticket)) {
          enqueued++;
        }
      }
      return enqueued;
    } catch {
      return 0;
    }
  }

  public async processNextQueueItem(): Promise<SpoolerResult | null> {
    const item = this.queue.getNextPending();
    if (!item) return null;

    this.queue.updateStatus(item.commandId, 'DISPATCHED_TO_SPOOLER');

    const ticket: PrintCommandTicket = {
      commandId: item.commandId,
      jobId: item.jobId,
      attemptId: item.attemptId,
      shopId: this.configManager.get().shopId,
      printerId: item.printerId,
      documentUrl: item.documentUrl,
      fileName: item.fileName,
      options: item.options,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      correlationId: `corr-${item.jobId}`,
    };

    const result = await SpoolerExecutor.executeTicket(ticket);

    // Update local queue status
    if (result.status === 'PRINT_CONFIRMED') {
      this.queue.updateStatus(item.commandId, 'COMPLETED');
    } else if (result.status === 'OUTPUT_UNCERTAIN') {
      this.queue.updateStatus(item.commandId, 'OUTPUT_UNCERTAIN', result.errorMessage);
    } else {
      this.queue.updateStatus(item.commandId, 'FAILED', result.errorMessage);
    }

    // Report back to server
    await this.reportResultToServer(result);
    return result;
  }

  private async reportResultToServer(result: SpoolerResult): Promise<void> {
    const config = this.configManager.get();
    try {
      await fetch(`${config.serverUrl}/agent/command-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
    } catch (err: any) {
      console.warn('[Inklly Agent] Failed to report spooler result back to server:', err.message);
    }
  }

  private handleLocalRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const config = this.configManager.get();

    if ((req.url === '/status' || req.url === '/health') && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: req.url === '/health' ? 'OK' : 'RUNNING',
          agentStatus: 'RUNNING',
          version: '1.0.0',
          agentId: config.agentId || 'NOT_ENROLLED',
          shopId: config.shopId,
          shopCode: config.shopCode,
          isPaired: config.isPaired,
          localQueueDepth: this.queue.getQueueDepth(),
          discoveredPrinters: this.printers,
          printers: this.printers.map((p) => p.name),
          serverUrl: config.serverUrl,
          uptimeSec: Math.floor(process.uptime()),
        })
      );
      return;
    }

    if ((req.url === '/printers' || req.url === '/printers/detect') && req.method === 'GET') {
      PrinterDiscoveryService.discoverPrinters().then((prns) => {
        this.printers = prns;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, printers: prns }));
      });
      return;
    }

    if ((req.url === '/jobs/spool' || req.url === '/jobs' || req.url === '/print') && req.method === 'POST') {
      let bodyStr = '';
      req.on('data', (chunk) => {
        bodyStr += chunk;
      });
      req.on('end', async () => {
        try {
          const raw = JSON.parse(bodyStr || '{}');
          const ticket: PrintCommandTicket = {
            commandId: raw.commandId || `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            jobId: raw.jobId || `job-${Date.now()}`,
            attemptId: raw.attemptId || `att-${Date.now()}`,
            shopId: raw.shopId || this.configManager.get().shopId,
            printerId: raw.printerId || 'Canon LBP2900',
            documentUrl: raw.documentUrl || '',
            fileName: raw.fileName || 'Customer_Print_Job.pdf',
            options: raw.options || { copies: 1, color: false, duplex: false },
            expiresAt: new Date(Date.now() + 60000).toISOString(),
            correlationId: raw.correlationId || `corr-${Date.now()}`,
          };
          this.queue.enqueue(ticket);
          const result = await this.processNextQueueItem();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, result }));
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (req.url === '/setup' && req.method === 'POST') {
      let bodyStr = '';
      req.on('data', (chunk) => {
        bodyStr += chunk;
      });
      req.on('end', () => {
        try {
          const setupData = JSON.parse(bodyStr);
          this.configManager.update(setupData);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Agent configuration updated' }));
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (req.url === '/queue' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.queue.getRecent(20)));
      return;
    }

    if (req.url === '/sync' && req.method === 'POST') {
      this.pollServerCommands().then((cnt) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, newCommandsPolled: cnt }));
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }
}
