import * as http from 'node:http';
import * as os from 'node:os';
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
  private discoveryInterval: NodeJS.Timeout | null = null;
  private discovering = false;
  private workerPromise: Promise<void> | null = null;

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

    // Pair with the shop: from INKLLY_PAIRING_CODE, or by asking in this window.
    if (!config.isPaired && config.pairingCode) {
      await this.enrollWithServer();
    }
    if (!this.configManager.get().isPaired && process.stdin.isTTY && process.env.INKLLY_NO_PROMPT !== 'true') {
      await this.promptForPairing();
    }
    this.printStatus();

    // Start background tasks
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), config.heartbeatIntervalMs);
    this.pollInterval = setInterval(() => this.pollServerCommands(), config.pollIntervalMs);
    this.workerInterval = setInterval(() => {
      this.runWorkerCycle();
    }, 2000);
    // Printers get plugged in, renamed and switched off while the shop is
    // open; rediscover so the merchant sees the current list without a restart.
    this.discoveryInterval = setInterval(() => void this.refreshPrinters(), Number(process.env.INKLLY_PRINTER_DISCOVERY_MS) || 60_000);

    // Initial immediate run
    this.sendHeartbeat();
    this.pollServerCommands();
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.workerInterval) clearInterval(this.workerInterval);
    if (this.discoveryInterval) clearInterval(this.discoveryInterval);
    if (this.workerPromise) await this.workerPromise;
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
      this.server = null;
    }
    this.queue.close();
    console.log('[Inklly Agent] Daemon stopped cleanly.');
  }

  public async refreshPrinters(): Promise<void> {
    if (this.discovering || !this.isRunning) return;
    this.discovering = true;
    try {
      const before = JSON.stringify(this.printers.map((p) => [p.name, p.isOnline, p.isDefault]));
      this.printers = await PrinterDiscoveryService.discoverPrinters();
      if (JSON.stringify(this.printers.map((p) => [p.name, p.isOnline, p.isDefault])) !== before) {
        console.log(`[Inklly Agent] Printer list changed: ${this.printers.map((p) => `${p.name}${p.isOnline ? '' : ' (offline)'}`).join(', ') || 'none'}`);
        await this.sendHeartbeat();
      }
    } finally {
      this.discovering = false;
    }
  }

  private runWorkerCycle(): void {
    if (!this.isRunning || this.workerPromise) return;
    this.workerPromise = (async () => {
      await this.processPendingReports();
      await this.processPendingAcknowledgements();
      if (this.isRunning) await this.processNextQueueItem();
    })().catch((err: unknown) => {
      console.error('[Inklly Agent] Queue worker cycle failed; the command will not be blindly retried:', err);
    }).finally(() => {
      this.workerPromise = null;
    });
  }

  /** Asks for the pairing code shown in Inklly → Printers until pairing succeeds. */
  private async promptForPairing(): Promise<void> {
    const readline = await import('node:readline/promises');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      console.log('');
      console.log('  To connect this computer to your shop:');
      console.log('  1. On your Inklly dashboard open  Business Setup → Printers');
      console.log('  2. Click  “Create pairing code”');
      console.log('  3. Type or paste the code here (it looks like INK-ABCD-EFGH-JKLM-NPQR)');
      console.log('');
      for (let attempt = 0; attempt < 10 && this.isRunning; attempt++) {
        const code = (await rl.question('  Pairing code: ')).trim();
        if (!code) continue;
        this.configManager.update({ pairingCode: code });
        if (await this.enrollWithServer()) return;
        console.log('  ✗ ' + (this.lastEnrollError || 'That code did not work. Create a new code and try again.'));
      }
    } finally {
      rl.close();
    }
  }

  private lastEnrollError = '';

  /** A plain-language summary shopkeepers can read in the app window. */
  private printStatus(): void {
    const config = this.configManager.get();
    const printing = process.env.INKLLY_ENABLE_PHYSICAL_PRINTING === 'true';
    console.log('');
    console.log('  ────────────────────────────────────────────────');
    console.log(config.isPaired ? `  ✓ Connected to shop: ${config.shopCode || config.shopId}` : '  ✗ Not connected to a shop yet (restart and enter a pairing code)');
    console.log(printing ? '  ✓ Printing is ON' : '  ! Printing is OFF (set INKLLY_ENABLE_PHYSICAL_PRINTING=true)');
    if (this.printers.length) {
      console.log('  Printers found on this computer:');
      for (const printer of this.printers) {
        const caps = printer.capabilities;
        const traits = [caps.color ? 'colour' : caps.color === false ? 'B&W' : null, caps.duplex ? 'both sides' : null, caps.paperSizes.join('/') || null].filter(Boolean).join(', ');
        console.log(`   • ${printer.name}${printer.isOnline ? '' : ' (offline)'}${traits ? ` — ${traits}` : ''}`);
      }
    } else {
      console.log('  ! No printers found. Install your printer on this computer first, then restart Inklly.');
    }
    console.log('  Keep this window open while the shop is open. Orders print when staff press Print.');
    console.log('  ────────────────────────────────────────────────');
    console.log('');
  }

  public async enrollWithServer(shopId?: string, _secretKey?: string): Promise<boolean> {
    const config = this.configManager.get();
    const targetShopId = shopId || config.shopId;
    if (!config.pairingCode) return false;

    try {
      const res = await fetch(`${config.serverUrl}/agent/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(targetShopId ? { shopId: targetShopId } : {}),
          pairingCode: config.pairingCode,
          hostname: (process.env.COMPUTERNAME || os.hostname() || 'print-computer').slice(0, 100),
          osPlatform: process.platform,
          osVersion: `${os.type()} ${os.release()}`.slice(0, 100),
          agentVersion: '1.0.0',
        }),
      });

      if (res.ok) {
        const body = (await res.json()) as any;
        this.configManager.update({
          shopId: body.shopId,
          shopCode: body.shopCode,
          agentId: body.agentId,
          secretKey: body.agentSecret,
          pairingCode: undefined,
          isPaired: true,
        });
        delete process.env.INKLLY_PAIRING_CODE;
        console.log(`  ✓ Paired with ${body.shopName || body.shopCode}.`);
        await this.sendHeartbeat();
        return true;
      }
      const failure = (await res.json().catch(() => ({}))) as any;
      this.lastEnrollError = failure.error || `The server refused the code (HTTP ${res.status}).`;
      this.configManager.update({ pairingCode: undefined });
    } catch (err: any) {
      this.lastEnrollError = `Could not reach Inklly (${err.message}). Check the internet connection.`;
      console.warn('[Inklly Agent] Enrollment pending server availability:', err.message);
    }
    return false;
  }

  public async sendHeartbeat(): Promise<void> {
    const config = this.configManager.get();
    if (!config.agentId || !config.shopId || !config.secretKey) return;

    try {
      await fetch(`${config.serverUrl}/agent/heartbeat`, {
        method: 'POST',
        headers: this.agentHeaders(config),
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          agentId: config.agentId,
          shopId: config.shopId,
          status: 'ONLINE',
          activePrintersCount: this.printers.filter((p) => p.isOnline).length,
          printers: this.printers.map((printer) => ({
            name: printer.name,
            driverName: printer.driverName,
            isOnline: printer.isOnline,
            isDefault: printer.isDefault,
            capabilities: printer.capabilities,
          })),
          localQueueDepth: this.queue.getQueueDepth(),
          sqliteCacheHealthy: true,
          physicalPrintingEnabled: process.env.INKLLY_ENABLE_PHYSICAL_PRINTING === 'true',
        }),
      });
    } catch {
      // Offline heartbeat failure logged silently
    }
  }

  public async pollServerCommands(): Promise<number> {
    const config = this.configManager.get();
    if (!config.agentId || !config.secretKey) return 0;

    try {
      const res = await fetch(`${config.serverUrl}/agent/poll-commands`, {
        headers: this.agentHeaders(config), signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok || !this.isRunning) return 0;

      const tickets = (await res.json()) as PrintCommandTicket[];
      let enqueued = 0;
      for (const ticket of tickets) {
        if (!this.isRunning) break;
        // Persist into local SQLite before acknowledging. If the response or
        // acknowledgement is lost, the next poll replays the same stable ID.
        if (this.queue.enqueue(ticket)) enqueued++;
        await this.acknowledgeTicket(ticket.commandId, ticket.attemptId, config);
      }
      return enqueued;
    } catch {
      return 0;
    }
  }

  private agentHeaders(config: AgentConfig): Record<string, string> {
    return { 'Content-Type': 'application/json', 'X-Agent-Id': config.agentId || '', Authorization: `Bearer ${config.secretKey || ''}` };
  }

  private async acknowledgeTicket(commandId: string, attemptId: string, config: AgentConfig): Promise<boolean> {
    try {
      const response = await fetch(`${config.serverUrl}/agent/acknowledge-command`, {
        method: 'POST',
        headers: this.agentHeaders(config),
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({ commandId, attemptId }),
      });
      if (!response.ok) return false;
      return this.queue.markServerAcknowledged(commandId, attemptId);
    } catch {
      // The server may have committed an acknowledgement before the response
      // was lost. Keep the row ineligible for printing and retry idempotently.
      return false;
    }
  }

  public async processPendingAcknowledgements(): Promise<void> {
    const config = this.configManager.get();
    if (!config.agentId || !config.secretKey) return;
    for (const pending of this.queue.getPendingAcknowledgements()) {
      await this.acknowledgeTicket(pending.commandId, pending.attemptId, config);
    }
  }

  public async processNextQueueItem(): Promise<SpoolerResult | null> {
    const item = this.queue.claimNextPending();
    if (!item) return null;

    const ticket: PrintCommandTicket = {
      commandId: item.commandId,
      jobId: item.jobId,
      attemptId: item.attemptId,
      shopId: this.configManager.get().shopId,
      printerId: item.printerId,
      documentUrl: item.documentUrl,
      fileName: item.fileName,
      options: item.options,
      expiresAt: item.expiresAt,
      correlationId: `corr-${item.jobId}`,
    };

    const config = this.configManager.get();
    const expiry = Date.parse(item.expiresAt);
    const result = !Number.isFinite(expiry) || expiry <= Date.now()
      ? {
          attemptId: item.attemptId,
          jobId: item.jobId,
          status: 'FAILED' as const,
          errorMessage: 'The server print ticket expired before local execution; no print was submitted.',
          timestamp: new Date().toISOString(),
        }
      : await SpoolerExecutor.executeTicket(ticket, {
          downloadServerUrl: config.serverUrl,
          downloadHeaders: this.agentHeaders(config),
        }).catch((err: unknown) => ({
          attemptId: item.attemptId,
          jobId: item.jobId,
          status: 'OUTPUT_UNCERTAIN' as const,
          errorMessage: `The print worker failed unexpectedly after dispatch began. Inspect the printer before retrying. ${err instanceof Error ? err.message : 'Unknown execution error'}`,
          timestamp: new Date().toISOString(),
        }));

    // Persist the outcome before network I/O so a restart can retry server reporting.
    this.queue.saveResult(item.commandId, result);
    await this.processPendingReports();
    return result;
  }

  private async processPendingReports(): Promise<void> {
    for (const item of this.queue.getPendingReports()) {
      if (item.result && await this.reportResultToServer(item.result)) {
        this.queue.completeReport(item.commandId, item.result);
      }
    }
  }

  private async reportResultToServer(result: SpoolerResult): Promise<boolean> {
    const config = this.configManager.get();
    try {
      const response = await fetch(`${config.serverUrl}/agent/command-result`, {
        method: 'POST',
        headers: this.agentHeaders(config),
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify(result),
      });
      return response.ok;
    } catch (err: any) {
      console.warn('[Inklly Agent] Failed to report spooler result back to server:', err.message);
      return false;
    }
  }

  private handleLocalRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const config = this.configManager.get();
    const host = (req.headers.host || '').toLowerCase();
    const allowedHosts = new Set([
      `127.0.0.1:${config.localPort}`,
      `localhost:${config.localPort}`,
      `[::1]:${config.localPort}`,
    ]);
    // This listener is loopback-only. Checking Host as well as binding to the
    // loopback address prevents DNS-rebinding pages from using an attacker
    // hostname that resolves to 127.0.0.1 to read local diagnostics.
    if (!allowedHosts.has(host)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Local agent requests must use a loopback host.' }));
      return;
    }

    const allowedOrigins = new Set((process.env.INKLLY_PORTAL_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,https://inklly.vercel.app')
      .split(',').map((origin) => origin.trim()).filter(Boolean));
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      res.writeHead(403, { 'Content-Type': 'application/json', Vary: 'Origin' });
      res.end(JSON.stringify({ error: 'Origin is not allowed to access local agent diagnostics.' }));
      return;
    }
    if (origin && allowedOrigins.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
      if (!origin) {
        res.writeHead(403);
        res.end();
        return;
      }
      res.writeHead(204);
      res.end();
      return;
    }

    // Browser-originated requests can inspect agent status, but can never submit print work
    // or overwrite the paired shop credentials. Cloud-authenticated polling is the only
    // supported path for commands.
    if (req.method !== 'GET') {
      res.writeHead(origin && !allowedOrigins.has(origin) ? 403 : 410, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Local agent endpoints are read-only. Use authenticated server pairing and dispatch.' }));
      return;
    }

    if ((req.url === '/status' || req.url === '/health') && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: req.url === '/health' ? 'OK' : 'RUNNING',
          agentStatus: 'RUNNING',
          version: '1.0.0',
          isPaired: config.isPaired,
          uptimeSec: Math.floor(process.uptime()),
          physicalPrintingEnabled: process.env.INKLLY_ENABLE_PHYSICAL_PRINTING === 'true',
        })
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }
}
