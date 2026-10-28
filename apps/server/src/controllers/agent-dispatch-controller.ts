import { Request, Response } from 'express';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { AgentRepository, ShopRepository, PrinterRepository, DatabaseService } from '@inklly/db';
import { SpoolerResult } from '@inklly/shared';
import { PrivateFileStorage } from '../services/private-file-storage';

export class AgentDispatchController {
  constructor(
    private agentRepo: AgentRepository,
    private shopRepo: ShopRepository,
    private printerRepo: PrinterRepository,
    private db: DatabaseService,
    private fileStorage: PrivateFileStorage
  ) {}

  public enroll = (req: Request, res: Response) => {
    const { shopId, pairingCode, hostname, osPlatform, osVersion, agentVersion } = req.body;

    if (typeof shopId !== 'string' || typeof pairingCode !== 'string' || pairingCode.length < 32 || pairingCode.length > 128) {
      return res.status(400).json({ error: 'A valid shopId and one-time pairingCode are required' });
    }

    const shop = this.shopRepo.getShopById(shopId) || this.shopRepo.getShopByCode(shopId);
    if (!shop) {
      return res.status(401).json({ error: 'Invalid pairing credentials' });
    }
    if (!this.agentRepo.consumePairingCode(shop.id, pairingCode)) return res.status(401).json({ error: 'Invalid or expired pairing credentials' });

    const agentId = `agt-${crypto.randomUUID()}`;
    const agentSecret = crypto.randomBytes(32).toString('base64url');

    this.agentRepo.registerAgent({
      agentId,
      shopId: shop.id,
      secretKey: agentSecret,
      hostname: hostname || 'DESKTOP-POS-1',
      osPlatform: osPlatform || process.platform,
      osVersion: osVersion || 'Windows 11 / macOS Sonoma',
      agentVersion: agentVersion || '1.0.0',
    });

    res.status(201).json({
      success: true,
      agentId,
      agentSecret,
      shopId: shop.id,
      shopCode: shop.shopCode,
      shopName: shop.name,
      pollIntervalMs: 5000,
      heartbeatIntervalMs: 15000,
    });
  };

  public heartbeat = (req: Request, res: Response) => {
    const identity = (req as any).agent as { agentId: string; shopId: string };
    const { status, activePrintersCount, localQueueDepth, sqliteCacheHealthy } = req.body;

    this.agentRepo.recordHeartbeat({
      agentId: identity.agentId,
      shopId: identity.shopId,
      timestamp: new Date().toISOString(),
      status: status || 'ONLINE',
      activePrintersCount: Number(activePrintersCount || 1),
      localQueueDepth: Number(localQueueDepth || 0),
      sqliteCacheHealthy: Boolean(sqliteCacheHealthy ?? true),
    });

    // Older agents may not report inventory. Only replace it when the field is
    // present; an explicit empty list means this agent currently sees no queues.
    if (Array.isArray(req.body?.printers)) {
      const reportedPrinters = req.body.printers;
      if (reportedPrinters.length > 100) return res.status(400).json({ error: 'Agent may report at most 100 printer queues.' });
      const inventory = reportedPrinters.filter((printer: any) =>
        printer && typeof printer.name === 'string' && typeof printer.driverName === 'string'
        && typeof printer.isOnline === 'boolean' && typeof printer.isDefault === 'boolean'
      ).map((printer: any) => ({
        name: printer.name,
        driverName: printer.driverName,
        isOnline: printer.isOnline,
        isDefault: printer.isDefault,
      }));
      this.printerRepo.syncAgentInventory(identity.shopId, identity.agentId, inventory);
    }

    res.json({ acknowledged: true, serverTime: new Date().toISOString() });
  };

  public pollCommands = (req: Request, res: Response) => {
    const identity = (req as any).agent as { agentId: string; shopId: string };
    const tickets = this.agentRepo.getPendingPrintTickets(identity.shopId, identity.agentId);
    res.json(tickets);
  };

  public acknowledgeCommand = (req: Request, res: Response) => {
    const identity = (req as any).agent as { agentId: string; shopId: string };
    const { commandId, attemptId } = req.body || {};
    if (typeof commandId !== 'string' || typeof attemptId !== 'string') {
      return res.status(400).json({ error: 'commandId and attemptId are required' });
    }
    if (!this.agentRepo.acknowledgeDispatch(commandId, attemptId, identity.agentId, identity.shopId)) {
      return res.status(409).json({ error: 'Command is not pending acknowledgement for this agent' });
    }
    return res.json({ acknowledged: true, commandId, attemptId });
  };

  public reportCommandResult = (req: Request, res: Response) => {
    const result: SpoolerResult = req.body;

    if (!result.jobId || !result.attemptId || !result.status) {
      return res.status(400).json({ error: 'Incomplete spooler result report' });
    }

    const identity = (req as any).agent as { agentId: string; shopId: string };
    if (!this.agentRepo.recordCommandResult(result, identity.agentId, identity.shopId)) {
      return res.status(409).json({ error: 'Result does not match an active print attempt for this agent' });
    }

    res.json({
      success: true,
      jobId: result.jobId,
      attemptId: result.attemptId,
      recordedStatus: result.status,
    });
  };

  public downloadPrintFile = async (req: Request, res: Response) => {
    const identity = (req as any).agent as { agentId: string; shopId: string };
    const file = this.db.queryOne<any>(
      `SELECT of.storage_key, of.file_name, of.mime_type, o.status
       FROM order_files of JOIN orders o ON o.id = of.order_id
       WHERE of.id = ? AND o.shop_id = ?`,
      [String(req.params.fileId), identity.shopId]
    );
    if (!file || file.status === 'CANCELLED' || String(file.storage_key).startsWith('expired:')) {
      return res.status(404).json({ error: 'Print file is unavailable.' });
    }
    let content: Buffer | null;
    try { content = await this.fileStorage.read(String(file.storage_key), identity.shopId); }
    catch { return res.status(503).json({ error: 'Private file storage is temporarily unavailable.' }); }
    if (!content) return res.status(404).json({ error: 'Print file is unavailable.' });
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', content.length);
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(String(file.file_name)).replace(/[\r\n"\\]/g, '_')}"`);
    return res.send(content);
  };

  public downloadAgent = (req: Request, res: Response) => {
    const platform = (req.query.platform as string) || 'win-x64';
    const shopCode = (req.query.shopCode as string) || '';
    const format = (req.query.format as string) || 'json';

    const shop = this.shopRepo.getShopByCode(shopCode) || this.shopRepo.getShopById(shopCode);
    if (!shop || !shop.isActive) return res.status(404).json({ error: 'Shop not found or currently offline.' });

    if (format === 'script') {
      return res.status(410).json({ error: 'Setup scripts are unavailable while a verified production installer is not configured.' });

    }
    return res.status(503).json({
      error: 'A verified Inklly Agent installer is not configured on this deployment.',
      installerAvailable: false,
      platform,
      shopCode,
    });
  };

  public getDriverMatrix = (_req: Request, res: Response) => {
    res.json({
      success: true,
      capabilityStatus: 'NOT_VERIFIED',
      queueDiscovery: 'Windows queues are enumerated from operating-system printer metadata when the agent runs on Windows.',
      reportedQueueFields: ['name', 'driverName', 'onlineStatus', 'defaultQueue'],
      colorSupport: 'UNKNOWN',
      duplexSupport: 'UNKNOWN',
      traySupport: 'NOT_REPORTED',
      physicalPrintingEnabledByDefault: false,
      agentSettingsCurrentlySupported: ['copies', 'pageRange', 'fit', 'orientation', 'simplexOrAutoDuplex', 'collation', 'A4OrA3'],
      agentSettingsRejected: ['mixedColorPages', 'manualDuplex', 'multiplePagesPerSheet', 'unverifiedPaperSize'],
      outputEvidence: 'SUBMITTED_TO_SPOOLER indicates OS spooler acceptance only; it does not confirm physical pages were produced.',
      hardwareVerification: 'No printer model or driver combination has been verified for this release.',
    });
  };

  public getDiagnostics = (_req: Request, res: Response) => {
    res.json({
      success: true,
      agentService: 'Inklly Edge Spooler Daemon',
      loopbackPort: 8765,
      corsPolicy: 'Restricted to localhost / 127.0.0.1 and Inklly verified portal origin',
      offlineStorage: 'SQLite 3 (node:sqlite DatabaseSync)',
      hardwareSafety: 'OUTPUT_UNCERTAIN on hardware jam or spooler halt',
      version: '1.0.0',
    });
  };
}
