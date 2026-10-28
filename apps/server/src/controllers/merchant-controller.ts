import { Request, Response } from 'express';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { DatabaseService } from '@inklly/db';
import {
  ShopRepository,
  OrderRepository,
  PricingRepository,
  PrinterRepository,
  UserRepository,
  LedgerRepository,
  AgentRepository,
} from '@inklly/db';
import { OrderStatus, ROLE_PRESETS } from '@inklly/shared';
import { ShopPaymentCredentialsService } from '../services/shop-payment-credentials';
import { PrivateFileStorage } from '../services/private-file-storage';

export class MerchantController {
  constructor(
    private shopRepo: ShopRepository,
    private orderRepo: OrderRepository,
    private pricingRepo: PricingRepository,
    private printerRepo: PrinterRepository,
    private userRepo: UserRepository,
    private ledgerRepo: LedgerRepository,
    private paymentCredentials: ShopPaymentCredentialsService,
    private agentRepo: AgentRepository,
    private db: DatabaseService,
    private fileStorage: PrivateFileStorage
  ) {}

  private presentOrder(order: any) {
    return { ...order, files: (order.files || []).map((file: any) => {
      const { storageKey: _storageKey, ...safeFile } = file;
      return { ...safeFile, fileUrl: `/api/v1/merchant/orders/${encodeURIComponent(order.id)}/files/${encodeURIComponent(file.id)}` };
    }) };
  }

  public downloadOrderFile = async (req: Request, res: Response) => {
    const shopId = req.user?.shopId;
    if (!shopId) return res.status(403).json({ error: 'Shop account required' });
    const row = this.db.queryOne<any>(
      `SELECT f.storage_key, f.file_name, f.mime_type FROM order_files f JOIN orders o ON o.id = f.order_id WHERE f.id = ? AND o.id = ? AND o.shop_id = ?`,
      [String(req.params.fileId), String(req.params.id), shopId]
    );
    if (!row || String(row.storage_key).startsWith('expired:')) return res.status(404).json({ error: 'Print file is unavailable.' });
    let content: Buffer | null;
    try { content = await this.fileStorage.read(String(row.storage_key), shopId); }
    catch { return res.status(503).json({ error: 'Private file storage is temporarily unavailable.' }); }
    if (!content) return res.status(404).json({ error: 'Print file is unavailable.' });
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(String(row.file_name)).replace(/[\r\n"\\]/g, '_')}"`);
    res.setHeader('Content-Length', content.length);
    return res.send(content);
  };

  private getShopId(req: Request): string {
    return req.user?.shopId || (req.query.shopId as string) || (req.headers['x-shop-id'] as string) || '';
  }

  public createAgentPairingCode = (req: Request, res: Response) => {
    const shopId = req.user?.shopId;
    if (!shopId) return res.status(403).json({ error: 'Shop owner account required' });
    const pairingCode = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    this.agentRepo.issuePairingCode(shopId, req.user!.userId, pairingCode, expiresAt);
    return res.status(201).json({ pairingCode, expiresAt, shopId });
  };

  public revokeAgent = (req: Request, res: Response) => {
    const shopId = req.user?.shopId;
    if (!shopId || !this.agentRepo.revokeAgent(String(req.params.id), shopId)) {
      return res.status(404).json({ error: 'Active agent not found for this shop' });
    }
    return res.status(204).send();
  };

  public getDashboard = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const orders = this.orderRepo.getOrdersByShop(shopId);
    const printers = this.printerRepo.getPrintersByShop(shopId);

    const pendingReview = orders.filter((o) => o.status === 'AWAITING_REVIEW').length;
    const readyForPrint = orders.filter((o) => o.status === 'READY_FOR_PRINT').length;
    const inProgress = orders.filter((o) => o.status === 'IN_PROGRESS').length;
    const readyForPickup = orders.filter((o) => o.status === 'READY_FOR_COLLECTION').length;
    const completed = orders.filter((o) => o.status === 'COLLECTED').length;

    const totalRevenuePaise = orders
      .filter((o) => o.paymentStatus === 'VERIFIED' || o.status === 'COLLECTED')
      .reduce((sum, o) => sum + o.totalAmountPaise, 0);

    const onlinePrinters = printers.filter((p) => p.isOnline).length;

    res.json({
      shopId,
      metrics: {
        totalOrders: orders.length,
        pendingReview,
        readyForPrint,
        inProgress,
        readyForPickup,
        completed,
        totalRevenuePaise,
        activePrinters: onlinePrinters,
        totalPrinters: printers.length,
      },
      recentOrders: orders.slice(0, 5).map((order) => this.presentOrder(order)),
    });
  };

  public getOrders = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const status = req.query.status as OrderStatus | 'ALL' | undefined;
    const orders = this.orderRepo.getOrdersByShop(shopId, status || 'ALL');
    res.json(orders.map((order) => this.presentOrder(order)));
  };

  public getOrderById = (req: Request, res: Response) => {
    const id = String(req.params.id);
    const order = this.orderRepo.getOrderById(id) || this.orderRepo.getOrderByNumber(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const effectiveShopId = this.getShopId(req);
    if (
      req.user?.role !== 'PLATFORM_OWNER' &&
      req.user?.role !== 'PLATFORM_ADMIN' &&
      effectiveShopId &&
      order.shopId !== effectiveShopId
    ) {
      return res.status(403).json({
        error: 'Tenant isolation violation: Cross-tenant access denied',
        requestedShopId: order.shopId,
        userShopId: effectiveShopId,
      });
    }

    res.json(this.presentOrder(order));
  };

  public updateOrderStatus = (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const order = this.orderRepo.getOrderById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const effectiveShopId = this.getShopId(req);
    if (
      req.user?.role !== 'PLATFORM_OWNER' &&
      req.user?.role !== 'PLATFORM_ADMIN' &&
      effectiveShopId &&
      order.shopId !== effectiveShopId
    ) {
      return res.status(403).json({
        error: 'Tenant isolation violation: Cannot modify order belonging to another shop',
        requestedShopId: order.shopId,
        userShopId: effectiveShopId,
      });
    }

    const targetStatus = (status === 'COMPLETED' ? 'COLLECTED' : status) as OrderStatus;
    try {
      this.orderRepo.updateOrderStatus(id, targetStatus);
      const updated = this.orderRepo.getOrderById(id);
      res.json({ success: true, order: updated });
    } catch (err: any) {
      res.status(422).json({ error: err.message });
    }
  };

  public printOrder = (req: Request, res: Response) => {
    const id = String(req.params.id);
    const order = this.orderRepo.getOrderById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const effectiveShopId = this.getShopId(req);
    if (
      req.user?.role !== 'PLATFORM_OWNER' &&
      req.user?.role !== 'PLATFORM_ADMIN' &&
      effectiveShopId &&
      order.shopId !== effectiveShopId
    ) {
      return res.status(403).json({
        error: 'Tenant isolation violation: Cannot print order belonging to another shop',
        requestedShopId: order.shopId,
        userShopId: effectiveShopId,
      });
    }

    try {
      // Transition from AWAITING_REVIEW -> READY_FOR_PRINT -> IN_PROGRESS
      if (order.status === 'AWAITING_REVIEW' || order.status === 'SUBMITTED') {
        this.orderRepo.updateOrderStatus(id, 'READY_FOR_PRINT');
      }
      this.orderRepo.updateOrderStatus(id, 'IN_PROGRESS');

      const updated = this.orderRepo.getOrderById(id);
      res.json({ success: true, message: 'Print dispatch initiated', order: updated });
    } catch (err: any) {
      res.status(422).json({ error: err.message });
    }
  };

  public getRates = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const rateRules = this.pricingRepo.getRateRules(shopId);
    const copyDiscounts = this.pricingRepo.getCopyDiscountRules(shopId);
    const bulkDiscount = this.pricingRepo.getBulkDiscountRule(shopId);

    res.json({
      rateRules,
      copyDiscounts,
      bulkDiscount,
    });
  };

  public updateRateRule = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const { id, paperSize, colorMode, duplexMode, pricePerPrintedSidePaise, printerId } = req.body;

    const validPaperSizes = ['A4', 'A3', 'PHOTO_4X6', 'PHOTO_5X7', 'GLOSSY', 'PLAIN'];
    if (typeof paperSize !== 'string' || !validPaperSizes.includes(paperSize.toUpperCase()) ||
        !['bw', 'color'].includes(colorMode) || !['simplex', 'duplex_auto', 'duplex_manual'].includes(duplexMode) ||
        !Number.isSafeInteger(pricePerPrintedSidePaise) || pricePerPrintedSidePaise < 0 || pricePerPrintedSidePaise > 100_000_000) {
      return res.status(400).json({ error: 'Missing required rate rule parameters' });
    }

    const ruleId = id || `rate-${shopId}-${paperSize}-${colorMode}-${duplexMode}`;
    this.pricingRepo.setRateRule({
      id: ruleId,
      shopId,
      printerId: printerId || undefined,
      paperSize: paperSize.toUpperCase() as any,
      colorMode,
      duplexMode,
      pricePerPrintedSidePaise,
    });

    res.json({ success: true, rateRules: this.pricingRepo.getRateRules(shopId) });
  };

  public updateBulkDiscount = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const { minOrderValuePaise, discountPercentage, isEnabled } = req.body;

    if (!Number.isSafeInteger(minOrderValuePaise) || minOrderValuePaise < 0 || minOrderValuePaise > 5_000_000_000 ||
        typeof discountPercentage !== 'number' || !Number.isFinite(discountPercentage) || discountPercentage < 0 || discountPercentage > 100 ||
        (isEnabled !== undefined && typeof isEnabled !== 'boolean')) {
      return res.status(400).json({ error: 'Bulk discount values must be valid Paise amounts, a percentage from 0 to 100, and a boolean enabled flag.' });
    }

    this.pricingRepo.setBulkDiscountRule({
      id: `bulk-${shopId}`,
      shopId,
      minOrderValuePaise,
      discountPercentage,
      isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true,
    });

    res.json({ success: true, bulkDiscount: this.pricingRepo.getBulkDiscountRule(shopId) });
  };

  public getPrinters = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const printers = this.printerRepo.getPrintersByShop(shopId);
    res.json(printers);
  };

  public addPrinter = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const { name, systemDriverName, supportsColor, supportsDuplex, trays } = req.body;

    if (!name || !systemDriverName) {
      return res.status(400).json({ error: 'Printer name and driver name are required' });
    }

    const printerId = `prn-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newPrinter = {
      id: printerId,
      shopId,
      name,
      systemDriverName,
      // Registration stores a capability profile; only an authenticated agent
      // heartbeat may later establish that this device is online.
      isOnline: false,
      isDefault: false,
      supportsColor: Boolean(supportsColor),
      supportsDuplex: Boolean(supportsDuplex),
      lastHeartbeat: '',
      trays: Array.isArray(trays)
        ? trays.map((t: any, i: number) => ({
            id: t.id || `tray-${printerId}-${i + 1}`,
            printerId,
            name: t.name || `Tray ${i + 1}`,
            supportedSizes: t.supportedSizes || ['A4', 'PLAIN'],
            isDefault: t.isDefault ?? (i === 0),
          }))
        : [
            { id: `tray-${printerId}-1`, printerId, name: 'Tray 1 (A4 Plain)', supportedSizes: ['A4', 'PLAIN'], isDefault: true },
          ],
    };

    this.printerRepo.registerPrinter(newPrinter);
    res.status(201).json(newPrinter);
  };

  public getSettings = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const shop = this.shopRepo.getShopById(shopId);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    res.json(shop);
  };

  public updateSettings = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const updates = req.body;

    try {
      this.shopRepo.updateShopSettings(shopId, updates);
      res.json({ success: true, shop: this.shopRepo.getShopById(shopId) });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  };

  public getRazorpayCredentials = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    res.json({ shopId, ...this.paymentCredentials.getRazorpayStatus(shopId) });
  };

  public saveRazorpayCredentials = (req: Request, res: Response) => {
    const keyId = typeof req.body?.keyId === 'string' ? req.body.keyId.trim() : '';
    const secret = typeof req.body?.secret === 'string' ? req.body.secret.trim() : '';
    const webhookSecret = typeof req.body?.webhookSecret === 'string' ? req.body.webhookSecret.trim() : '';
    if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId) || secret.length < 16 || secret.length > 256 || webhookSecret.length < 16 || webhookSecret.length > 256) {
      return res.status(400).json({ error: 'Enter a valid Razorpay Key ID, API Secret, and Webhook Secret.' });
    }
    try {
      this.paymentCredentials.saveRazorpay(this.getShopId(req), keyId, secret, webhookSecret);
      const shopId = this.getShopId(req);
      res.json({ success: true, shopId, ...this.paymentCredentials.getRazorpayStatus(shopId) });
    } catch (error) {
      console.error('[Razorpay credentials]', error);
      if (error instanceof Error && error.message.startsWith('Resolve pending')) {
        return res.status(409).json({ error: error.message });
      }
      res.status(503).json({ error: 'Payment credential encryption is not configured on this server.' });
    }
  };

  public testRazorpayCredentials = async (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const credentials = this.paymentCredentials.getRazorpayCredentials(shopId);
    if (!credentials || !credentials.webhookSecret) {
      return res.status(409).json({ error: 'Razorpay credentials are not configured for this shop.' });
    }

    try {
      // Verify the API credentials with a read-only request; never create an
      // orphan provider order from a settings screen.
      const response = await fetch('https://api.razorpay.com/v1/payments?count=1', {
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.secret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as any;
        return res.status(400).json({
          error: `Razorpay rejected these credentials: ${errorBody.error?.description || errorBody.error?.code || response.status}`,
          configured: false,
        });
      }

      res.json({
        success: true,
        configured: true,
        message: 'Razorpay API credentials were accepted. Complete a test payment to verify the full checkout and webhook flow.',
        keyIdPreview: `${credentials.keyId.slice(0, 8)}…`,
        webhookConfigured: true,
      });
    } catch (error) {
      console.error('[Razorpay credential test]', error);
      res.status(503).json({
        error: 'Unable to reach Razorpay API. Check your internet connection and try again.',
        configured: false,
      });
    }
  };

  public removeRazorpayCredentials = (req: Request, res: Response) => {
    try {
      this.paymentCredentials.removeRazorpay(this.getShopId(req));
      const shopId = this.getShopId(req);
      res.json({ success: true, shopId, ...this.paymentCredentials.getRazorpayStatus(shopId) });
    } catch (error) {
      return res.status(409).json({ error: error instanceof Error ? error.message : 'Unable to disconnect Razorpay.' });
    }
  };

  public getStaff = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const staff = this.userRepo.getStaffByShop(shopId);
    res.json(staff);
  };

  public addStaff = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const { email, fullName, rolePreset, phone } = req.body;

    if (!email || !fullName) {
      return res.status(400).json({ error: 'Email and full name are required' });
    }

    const permissions = ROLE_PRESETS[rolePreset] || ROLE_PRESETS['Print Operator'];
    const now = new Date().toISOString();
    const userId = `usr-staff-${Date.now().toString(36)}`;

    this.userRepo.createUser(
      {
        id: userId,
        email: email.toLowerCase().trim(),
        phone,
        fullName,
        role: 'SHOP_STAFF',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      'hash_staff_default'
    );

    this.userRepo.createMembership({
      id: `mem-${userId}`,
      userId,
      organizationId: req.user?.organizationId || 'org-campus-network',
      shopId,
      role: 'SHOP_STAFF',
      permissions,
      createdAt: now,
      updatedAt: now,
    });

    res.status(201).json({
      success: true,
      staff: {
        userId,
        email,
        fullName,
        rolePreset: rolePreset || 'Print Operator',
        permissions,
      },
    });
  };

  public getBotTemplates = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const templates = this.userRepo.getBotTemplates(shopId);
    res.json(templates);
  };

  public updateBotTemplate = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const { templateKey, templateText, isEnabled } = req.body;

    if (!templateKey || !templateText) {
      return res.status(400).json({ error: 'templateKey and templateText are required' });
    }

    this.userRepo.upsertBotTemplate(shopId, templateKey, templateText, isEnabled ?? true);
    res.json({ success: true, templates: this.userRepo.getBotTemplates(shopId) });
  };

  // Credits
  public getCreditBalance = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const balance = this.ledgerRepo.calculateBalancePaise(shopId, 'CONVERSION_CREDIT');
    const entries = this.ledgerRepo.getEntriesByShop(shopId, 'CONVERSION_CREDIT');

    res.json({
      shopId,
      domain: 'CONVERSION_CREDIT',
      balancePaise: balance,
      currency: 'INR',
      entries: entries.map((e) => ({
        id: e.id,
        type: e.metadata?.type || 'UNKNOWN',
        amountPaise: e.amountPaise,
        balanceAfterPaise: e.metadata?.balanceAfterPaise,
        referenceType: e.metadata?.referenceType,
        referenceId: e.metadata?.referenceId,
        description: e.description,
        expiresAt: e.metadata?.expiresAt,
        createdAt: e.createdAt,
      })),
    });
  };

  public purchaseCredits = (req: Request, res: Response) => {
    return res.status(503).json({ error: 'Credit top-ups are not configured. No payment was accepted and no credits were added.' });
  };

  // Payouts / Withdrawals
  public getPayouts = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const rows = this.db.query<any>(
      `SELECT * FROM payout_requests WHERE shop_id = ? ORDER BY requested_at DESC`,
      [shopId]
    );
    res.json(rows.map((r) => ({
      id: r.id,
      amountPaise: r.amount_paise,
      currency: r.currency,
      status: r.status,
      providerPayoutId: r.provider_payout_id,
      destinationAccountMasked: r.destination_account_masked,
      requestedAt: r.requested_at,
      processedAt: r.processed_at,
      failureReason: r.failure_reason,
    })));
  };

  public requestPayout = (req: Request, res: Response) => {
    return res.status(503).json({ error: 'Payouts are unavailable because customer payments settle directly to each shop.' });
  };

  // Storage / Document tools
  public getStorageCategories = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const rows = this.db.query<any>(
      `SELECT * FROM storage_categories WHERE shop_id = ? ORDER BY created_at DESC`,
      [shopId]
    );
    res.json(rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      documentCount: r.document_count,
      createdAt: r.created_at,
    })));
  };

  public createStorageCategory = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || name.length < 2 || name.length > 100) {
      return res.status(400).json({ error: 'Category name is required (2-100 characters).' });
    }

    const id = `storage-cat-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    this.db.execute(
      `INSERT INTO storage_categories (id, shop_id, name, description, document_count, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [id, shopId, name, description || null, now]
    );

    res.status(201).json({
      success: true,
      category: { id, name, description: description || null, documentCount: 0, createdAt: now },
    });
  };

  public deleteStorageCategory = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const categoryId = String(req.params.id);

    const category = this.db.queryOne<any>(
      `SELECT id FROM storage_categories WHERE id = ? AND shop_id = ?`,
      [categoryId, shopId]
    );
    if (!category) return res.status(404).json({ error: 'Storage category not found.' });

    const docCount = this.db.queryOne<any>(
      `SELECT COUNT(*) as cnt FROM storage_documents WHERE category_id = ?`,
      [categoryId]
    );
    if (docCount.cnt > 0) {
      return res.status(409).json({ error: 'Cannot delete a category that contains documents.' });
    }

    this.db.execute(`DELETE FROM storage_categories WHERE id = ?`, [categoryId]);
    res.json({ success: true });
  };

  public getStorageDocuments = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const categoryId = String(req.query.categoryId || '');

    let sql = `SELECT sd.*, sc.name as category_name FROM storage_documents sd LEFT JOIN storage_categories sc ON sc.id = sd.category_id WHERE sd.shop_id = ?`;
    const params: any[] = [shopId];

    if (categoryId) {
      sql += ` AND sd.category_id = ?`;
      params.push(categoryId);
    }

    sql += ` ORDER BY sd.created_at DESC`;

    const rows = this.db.query<any>(sql, params);
    res.json(rows.map((r) => ({
      id: r.id,
      name: r.name,
      fileName: r.file_name,
      mimeType: r.mime_type,
      fileSizeBytes: r.file_size_bytes,
      pageCount: r.page_count,
      categoryId: r.category_id,
      categoryName: r.category_name,
      downloadUrl: `/api/v1/merchant/storage/documents/${r.id}/download`,
      createdAt: r.created_at,
    })));
  };

  public downloadStorageDocument = async (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const docId = String(req.params.id);

    const row = this.db.queryOne<any>(
      `SELECT sd.storage_key, sd.file_name, sd.mime_type FROM storage_documents sd WHERE sd.id = ? AND sd.shop_id = ?`,
      [docId, shopId]
    );
    if (!row || String(row.storage_key).startsWith('expired:')) return res.status(404).json({ error: 'Document is unavailable.' });

    let content: Buffer | null;
    try { content = await this.fileStorage.read(String(row.storage_key), shopId); }
    catch { return res.status(503).json({ error: 'Private file storage is temporarily unavailable.' }); }
    if (!content) return res.status(404).json({ error: 'Document is unavailable.' });

    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.file_name)}"`);
    res.setHeader('Content-Length', String(content.length));
    res.send(content);
  };

  public deleteStorageDocument = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const docId = String(req.params.id);

    const row = this.db.queryOne<any>(
      `SELECT sd.storage_key FROM storage_documents sd WHERE sd.id = ? AND sd.shop_id = ?`,
      [docId, shopId]
    );
    if (!row) return res.status(404).json({ error: 'Document not found.' });

    if (!String(row.storage_key).startsWith('expired:')) {
      try { this.fileStorage.remove(String(row.storage_key)); } catch { /* best effort */ }
    }

    this.db.execute(`DELETE FROM storage_documents WHERE id = ?`, [docId]);
    res.json({ success: true });
  };

  // WhatsApp Setup
  public getWhatsAppSetup = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);

    const accounts = this.db.query<any>(
      `SELECT * FROM whatsapp_accounts WHERE shop_id = ? ORDER BY created_at DESC`,
      [shopId]
    );

    const events = this.db.query<any>(
      `SELECT * FROM whatsapp_events WHERE shop_id = ? ORDER BY created_at DESC LIMIT 50`,
      [shopId]
    );

    const hasConnection = accounts.some((a) => a.status === 'CONNECTED');

    res.json({
      shopId,
      provider: 'meta_whatsapp_cloud',
      recommendedConnection: 'existing_business_number',
      connectionOptions: [
        { id: 'existing_business_number', label: 'Existing business number', requires: ['Meta business verification', 'WhatsApp business phone number ID'] },
        { id: 'display_name', label: 'Display name', requires: ['Meta app registration', 'Phone number verification'] },
        { id: 'qr_pairing', label: 'Link by QR', requires: ['WhatsApp mobile app', 'Linked devices screen'] },
      ],
      accounts: accounts.map((a) => ({
        id: a.id,
        wabaId: a.waba_id,
        phoneNumberId: a.phone_number_id,
        displayName: a.display_name,
        status: a.status, // OFFLINE, ONLINE, PAIRING, EXPIRED, ERROR
        accountsUsed: a.accounts_used,
        maxAccounts: a.max_accounts,
        qrExpiresAt: a.qr_expires_at,
        createdAt: a.created_at,
      })),
      events: events.map((e) => ({
        id: e.id,
        eventType: e.event_type,
        message: e.message,
        createdAt: e.created_at,
      })),
      hasConnection,
      canPair: !hasConnection,
    });
  };

  public saveWhatsAppSetup = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const { connectionType, businessPhoneNumber, displayName, metaAppId, metaAppSecret } = req.body;

    if (!connectionType || !['existing_business_number', 'display_name', 'qr_pairing'].includes(connectionType)) {
      return res.status(400).json({ error: 'Invalid connection type.' });
    }

    const now = new Date().toISOString();
    const id = `wa-${crypto.randomUUID()}`;

    this.db.execute(
      `INSERT INTO whatsapp_accounts (id, shop_id, connection_type, business_phone_number, display_name, meta_app_id, status, accounts_used, max_accounts, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'OFFLINE', 0, 1, ?, ?)`,
      [id, shopId, connectionType, businessPhoneNumber || null, displayName || null, metaAppId || null, now, now]
    );

    this.db.execute(
      `INSERT INTO whatsapp_events (id, shop_id, event_type, message, created_at)
       VALUES (?, ?, 'SETUP_SAVED', 'WhatsApp setup saved. Connection is OFFLINE until paired.', ?)`,
      [`wa-evt-${crypto.randomUUID()}`, shopId, now]
    );

    res.status(201).json({
      success: true,
      accountId: id,
      connectionType,
      status: 'OFFLINE',
      message: 'WhatsApp setup saved. Use QR pairing to connect your Meta WhatsApp Business account.',
    });
  };

  public generateWhatsAppQrPairing = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);

    const existingPairing = this.db.queryOne<any>(
      `SELECT * FROM whatsapp_accounts WHERE shop_id = ? AND status = 'PAIRING' ORDER BY created_at DESC LIMIT 1`,
      [shopId]
    );
    if (existingPairing) {
      return res.status(409).json({ error: 'A QR pairing session is already active. Wait for it to expire or refresh.' });
    }

    const accounts = this.db.query<any>(
      `SELECT * FROM whatsapp_accounts WHERE shop_id = ? AND status = 'CONNECTED'`,
      [shopId]
    );
    if (accounts.length > 0) {
      return res.status(409).json({ error: 'A WhatsApp account is already connected. Remove it before pairing a new one.' });
    }

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString(); // 60-second countdown
    const id = `wa-${crypto.randomUUID()}`;
    const pairingCode = `WA-${Math.floor(100000 + Math.random() * 900000)}`;

    this.db.execute(
      `INSERT INTO whatsapp_accounts (id, shop_id, connection_type, status, accounts_used, max_accounts, qr_expires_at, pairing_code, created_at, updated_at)
       VALUES (?, ?, 'qr_pairing', 'PAIRING', 0, 1, ?, ?, ?, ?)`,
      [id, shopId, expiresAt, pairingCode, now, now]
    );

    this.db.execute(
      `INSERT INTO whatsapp_events (id, shop_id, event_type, message, created_at)
       VALUES (?, ?, 'QR_PAIRING_STARTED', 'QR pairing session started. Scan with WhatsApp mobile app. Expires in 60 seconds.', ?)`,
      [`wa-evt-${crypto.randomUUID()}`, shopId, now]
    );

    res.json({
      success: true,
      pairingId: id,
      pairingCode,
      status: 'PAIRING',
      qrExpiresAt: expiresAt,
      countdownSeconds: 60,
      instructions: 'Open WhatsApp → Linked devices → Link a device, then scan this QR code.',
    });
  };

  public refreshWhatsAppQrPairing = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);

    const activePairing = this.db.queryOne<any>(
      `SELECT id FROM whatsapp_accounts WHERE shop_id = ? AND status = 'PAIRING' ORDER BY created_at DESC LIMIT 1`,
      [shopId]
    );
    if (!activePairing) {
      return res.status(404).json({ error: 'No active QR pairing session to refresh.' });
    }

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();
    const pairingCode = `WA-${Math.floor(100000 + Math.random() * 900000)}`;

    this.db.execute(
      `UPDATE whatsapp_accounts SET qr_expires_at = ?, pairing_code = ?, updated_at = ? WHERE id = ?`,
      [expiresAt, pairingCode, now, activePairing.id]
    );

    this.db.execute(
      `INSERT INTO whatsapp_events (id, shop_id, event_type, message, created_at)
       VALUES (?, ?, 'QR_PAIRING_REFRESHED', 'QR pairing session refreshed. New 60-second countdown started.', ?)`,
      [`wa-evt-${crypto.randomUUID()}`, shopId, now]
    );

    res.json({
      success: true,
      pairingId: activePairing.id,
      pairingCode,
      status: 'PAIRING',
      qrExpiresAt: expiresAt,
      countdownSeconds: 60,
    });
  };

  public removeWhatsAppAccount = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const accountId = String(req.params.id);

    const account = this.db.queryOne<any>(
      `SELECT id, status FROM whatsapp_accounts WHERE id = ? AND shop_id = ?`,
      [accountId, shopId]
    );
    if (!account) return res.status(404).json({ error: 'WhatsApp account not found.' });

    this.db.execute(`DELETE FROM whatsapp_accounts WHERE id = ?`, [accountId]);

    this.db.execute(
      `INSERT INTO whatsapp_events (id, shop_id, event_type, message, created_at)
       VALUES (?, ?, 'ACCOUNT_REMOVED', 'WhatsApp account removed. Connection terminated.', ?)`,
      [`wa-evt-${crypto.randomUUID()}`, shopId, new Date().toISOString()]
    );

    res.json({ success: true, message: 'WhatsApp account removed.' });
  };

  public getWhatsAppEvents = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.min(10000, Math.max(0, Number(req.query.offset) || 0));

    const rows = this.db.query<any>(
      `SELECT * FROM whatsapp_events WHERE shop_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [shopId, limit, offset]
    );

    res.json(rows.map((e) => ({
      id: e.id,
      eventType: e.event_type,
      message: e.message,
      createdAt: e.created_at,
    })));
  };
}
