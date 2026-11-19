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
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Heartbeat body must be a JSON object.' });
    }
    const { status = 'ONLINE', activePrintersCount = 0, localQueueDepth = 0, sqliteCacheHealthy = true } = body;
    if (body.physicalPrintingEnabled !== undefined && typeof body.physicalPrintingEnabled !== 'boolean') {
      return res.status(400).json({ error: 'physicalPrintingEnabled must be a boolean when provided.' });
    }
    if (!['ONLINE', 'OFFLINE', 'DEGRADED'].includes(status)) {
      return res.status(400).json({ error: 'Heartbeat status must be ONLINE, OFFLINE, or DEGRADED.' });
    }
    if (!Number.isInteger(activePrintersCount) || activePrintersCount < 0 || activePrintersCount > 100) {
      return res.status(400).json({ error: 'activePrintersCount must be an integer from 0 to 100.' });
    }
    if (!Number.isInteger(localQueueDepth) || localQueueDepth < 0 || localQueueDepth > 100000) {
      return res.status(400).json({ error: 'localQueueDepth must be an integer from 0 to 100000.' });
    }
    if (typeof sqliteCacheHealthy !== 'boolean') {
      return res.status(400).json({ error: 'sqliteCacheHealthy must be a boolean.' });
    }

    type DetectedCapabilities = { color: boolean | null; duplex: boolean | null; paperSizes: Array<'A4' | 'A3'> };
    let inventory: Array<{ name: string; driverName: string; isOnline: boolean; isDefault: boolean; capabilities?: DetectedCapabilities }> | undefined;
    if (body.printers !== undefined) {
      if (!Array.isArray(body.printers) || body.printers.length > 100) {
        return res.status(400).json({ error: 'printers must be an array containing at most 100 printer queues.' });
      }
      inventory = [];
      for (const printer of body.printers) {
        if (!printer || typeof printer !== 'object' || Array.isArray(printer)
          || typeof printer.name !== 'string' || !printer.name.trim() || printer.name.trim().length > 256
          || typeof printer.driverName !== 'string' || !printer.driverName.trim() || printer.driverName.trim().length > 256
          || typeof printer.isOnline !== 'boolean' || typeof printer.isDefault !== 'boolean') {
          return res.status(400).json({ error: 'Each printer queue requires bounded name and driverName strings and boolean isOnline/isDefault values.' });
        }
        let capabilities: DetectedCapabilities | undefined;
        if (printer.capabilities !== undefined) {
          const caps = printer.capabilities;
          const triState = (value: unknown) => value === null || typeof value === 'boolean';
          if (!caps || typeof caps !== 'object' || Array.isArray(caps) || !triState(caps.color) || !triState(caps.duplex) ||
              !Array.isArray(caps.paperSizes) || caps.paperSizes.length > 10 || caps.paperSizes.some((size: unknown) => size !== 'A4' && size !== 'A3')) {
            return res.status(400).json({ error: 'Printer capabilities must report color/duplex as boolean or null and paperSizes from A4/A3.' });
          }
          capabilities = { color: caps.color, duplex: caps.duplex, paperSizes: [...new Set(caps.paperSizes as Array<'A4' | 'A3'>)] };
        }
        inventory.push({ name: printer.name.trim(), driverName: printer.driverName.trim(), isOnline: printer.isOnline, isDefault: printer.isDefault, capabilities });
      }
    }

    this.agentRepo.recordHeartbeat({
      agentId: identity.agentId,
      shopId: identity.shopId,
      timestamp: new Date().toISOString(),
      status,
      activePrintersCount,
      localQueueDepth,
      sqliteCacheHealthy,
      physicalPrintingEnabled: body.physicalPrintingEnabled === true,
    });

    // Older agents may not report inventory. Only replace it when the field is
    // present; an explicit empty list means this agent currently sees no queues.
    if (inventory) {
      this.printerRepo.syncAgentInventory(identity.shopId, identity.agentId, inventory);
    }

    res.json({ acknowledged: true, serverTime: new Date().toISOString() });
  };

  public pollCommands = (req: Request, res: Response) => {
    const identity = (req as any).agent as { agentId: string; shopId: string };
    // The agent only downloads from the origin it is paired with, so hand back
    // document URLs on the origin this request arrived at ('trust proxy' makes
    // req.protocol honour the hosting platform's X-Forwarded-Proto).
    const host = req.get('host');
    const requestOrigin = host && /^[A-Za-z0-9.\-:\[\]]{1,255}$/.test(host) ? `${req.protocol}://${host}` : undefined;
    const tickets = this.agentRepo.getPendingPrintTickets(identity.shopId, identity.agentId, requestOrigin);
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
      capabilityStatus: 'DRIVER_REPORTED',
      queueDiscovery: 'The agent lists every printer queue the operating system knows: Windows print queues, and CUPS queues on macOS and Linux (USB, network, shared, AirPrint/IPP Everywhere). Any printer with a working OS driver is usable.',
      reportedQueueFields: ['name', 'driverName', 'onlineStatus', 'defaultQueue', 'capabilities.color', 'capabilities.duplex', 'capabilities.paperSizes'],
      capabilitySources: {
        windows: 'Win32_Printer CapabilityDescriptions and PrinterPaperNames',
        cups: 'printer-type flags and driver PageSize/ColorModel/Duplex options',
      },
      spoolers: { windows: 'SumatraPDF -print-to (bundled)', macos: 'CUPS lp', linux: 'CUPS lp' },
      traySupport: 'PAPER_SIZES_FROM_DRIVER',
      merchantOverride: 'A merchant-saved printer profile always takes precedence over detected capabilities.',
      physicalPrintingEnabledByDefault: false,
      agentSettingsCurrentlySupported: ['copies', 'pageRange', 'fit', 'orientation', 'simplexOrAutoDuplex', 'collation', 'A4OrA3', 'blackAndWhite', 'color', 'mixedColorAsColorJob'],
      agentSettingsRejected: ['manualDuplex', 'multiplePagesPerSheet', 'unverifiedPaperSize'],
      outputEvidence: 'SUBMITTED_TO_SPOOLER indicates OS spooler acceptance only; it does not confirm physical pages were produced.',
      hardwareVerification: 'Capabilities come from each printer driver. No specific printer model has been certified by Inklly; staff confirm physical output.',
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
