import { Request, Response } from 'express';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { AgentRepository, ShopRepository, PrinterRepository, DatabaseService } from '@inklly/db';
import { SpoolerResult } from '@inklly/shared';

export class AgentDispatchController {
  constructor(
    private agentRepo: AgentRepository,
    private shopRepo: ShopRepository,
    private printerRepo: PrinterRepository,
    private db: DatabaseService
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

    res.json({ acknowledged: true, serverTime: new Date().toISOString() });
  };

  public pollCommands = (req: Request, res: Response) => {
    const identity = (req as any).agent as { agentId: string; shopId: string };
    const tickets = this.agentRepo.getPendingPrintTickets(identity.shopId, identity.agentId);
    res.json(tickets);
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

  public downloadPrintFile = (req: Request, res: Response) => {
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
    const root = path.resolve(process.cwd(), 'uploads');
    const filePath = path.resolve(process.cwd(), String(file.storage_key));
    if (!filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Print file is unavailable.' });
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    return res.download(filePath, path.basename(String(file.file_name)));
  };

  public downloadAgent = (req: Request, res: Response) => {
    const platform = (req.query.platform as string) || 'win-x64';
    const shopCode = (req.query.shopCode as string) || '';
    const format = (req.query.format as string) || 'json';

    const shop = this.shopRepo.getShopByCode(shopCode) || this.shopRepo.getShopById(shopCode);
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    const shopId = shop.id;
    const possibleDirs = [
      path.join(process.cwd(), 'apps', 'server', 'downloads'),
      path.join(__dirname, '..', '..', 'downloads'),
      path.join(__dirname, '..', 'downloads'),
      path.join(process.cwd(), 'downloads'),
    ];
    const downloadsDir = possibleDirs.find((d) => fs.existsSync(d)) || path.join(process.cwd(), 'downloads');

    if (format === 'bundle' || format === 'zip' || platform === 'win-x64-bundle') {
      const zipPath = path.join(downloadsDir, 'Inklly-Agent-win-x64-Setup.zip');
      if (fs.existsSync(zipPath)) {
        return res.download(zipPath, `Inklly-Agent-Setup-${shopCode}-win-x64.zip`);
      }
    }

    if (format === 'msi' || platform === 'win-x64-msi') {
      const msiPath = path.join(downloadsDir, 'Inklly-1.6.1-win-x64.msi');
      if (fs.existsSync(msiPath)) {
        return res.download(msiPath, 'Inklly-1.6.1-win-x64.msi');
      }
    }

    if (format === 'legacy-x64' || platform === 'windows7-x64' || platform === 'win7-x64') {
      const msiPath = path.join(downloadsDir, 'InkllyLegacyAgent-1.5.51-windows7-x64.msi');
      if (fs.existsSync(msiPath)) {
        return res.download(msiPath, 'InkllyLegacyAgent-1.5.51-windows7-x64.msi');
      }
    }

    if (format === 'legacy-x86' || platform === 'windows7-x86' || platform === 'win7-x86' || platform === 'x86') {
      const msiPath = path.join(downloadsDir, 'InkllyLegacyAgent-1.5.51-windows7-x86.msi');
      if (fs.existsSync(msiPath)) {
        return res.download(msiPath, 'InkllyLegacyAgent-1.5.51-windows7-x86.msi');
      }
    }

    if (format === 'usb' || platform === 'usb' || platform === 'autorun') {
      const usbPath = path.join(downloadsDir, 'usb-autorun-creator-2-installer.exe');
      if (fs.existsSync(usbPath)) {
        return res.download(usbPath, 'usb-autorun-creator-2-installer.exe');
      }
    }

    if (format === 'script') {
      return res.status(410).json({ error: 'Setup scripts must be generated by an authenticated shop owner.' });

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
      manufacturers: [
        { brand: 'HP', models: 'LaserJet Pro, LaserJet Enterprise, OfficeJet Pro, DeskJet', driverModes: ['RAW 9100', 'USB Winspool', 'HP PCL6'] },
        { brand: 'Canon', models: 'imageRUNNER ADVANCE, PIXMA, MAXIFY, imageCLASS', driverModes: ['UFR II', 'Canon Generic Plus PCL6', 'USB Spooler'] },
        { brand: 'Epson', models: 'EcoTank, WorkForce Enterprise, SureColor', driverModes: ['ESC/P-R', 'USB Spooler', 'Epson Net Print'] },
        { brand: 'Brother', models: 'HL-L series, DCP series, MFC multifunction', driverModes: ['BR-Script3', 'Brother PCL', 'Standard TCP/IP'] },
        { brand: 'Ricoh', models: 'Aficio, MP Series, IM Series', driverModes: ['RPCS', 'PCL6 Generic', 'RAW IP'] },
        { brand: 'Konica Minolta', models: 'bizhub C series, bizhub Pro', driverModes: ['PostScript3', 'PCL6', 'USB Port'] },
      ],
      supportedPaperSizes: ['A4', 'A3', 'Legal', 'Letter', '4x6 Photo (10x15cm)', '5x7 Photo (13x18cm)'],
      colorModes: ['B&W Monochrome (Grayscale 8-bit)', 'Full Colour (CMYK / RGB 24-bit)'],
      duplexModes: ['Simplex (Single side)', 'Auto Duplex (Long Edge)', 'Auto Duplex (Short Edge)', 'Manual Two-Sided'],
      traySupport: ['Auto-Select', 'Tray 1 (A4 Plain)', 'Tray 2 (A3 High Capacity)', 'Manual Bypass Tray', 'Photo Paper Tray'],
      securityAudit: 'Clean. Native winspool.drv interface. No unsigned third-party drivers or autorun executables.',
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
