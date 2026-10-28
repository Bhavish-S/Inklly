import { Request, Response } from 'express';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { DatabaseService, hashPassword } from '@inklly/db';
import {
  ShopRepository,
  OrderRepository,
  PricingRepository,
  PrinterRepository,
  UserRepository,
  LedgerRepository,
  AgentRepository,
} from '@inklly/db';
import { OrderStatus, PrintJobStatus, ROLE_PRESETS, validatePrintJobTransition } from '@inklly/shared';
import { ShopPaymentCredentialsService } from '../services/shop-payment-credentials';
import { PrivateFileStorage } from '../services/private-file-storage';
import { getPrinterHealthStatus, hasFreshOnlinePrinterEvidence } from '../services/printer-health';
import { inspectDocument } from '../services/document-page-count';

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
    const { statusCounts, recentOrders } = this.orderRepo.getDashboardSummaryByShop(shopId);
    const printers = this.printerRepo.getPrintersByShop(shopId);
    const countStatuses = (...statuses: string[]) => statuses.reduce((sum, status) => sum + (statusCounts[status] || 0), 0);

    // Revenue reflects captured/collected financial entries only. Order status
    // alone is not evidence that a cash or online payment was received.
    const totalRevenuePaise = this.ledgerRepo.calculateBalancePaise(shopId, 'CUSTOMER_PRINT_PAYMENT', 'INR');

    const onlinePrinters = printers.filter((p) => getPrinterHealthStatus(p.isOnline, p.lastHeartbeat) === 'ONLINE').length;

    res.json({
      shopId,
      metrics: {
        totalOrders: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
        pendingReview: countStatuses('AWAITING_REVIEW'),
        readyForPrint: countStatuses('READY_FOR_PRINT', 'PENDING_AGENT_SPOOL'),
        inProgress: countStatuses('IN_PROGRESS'),
        readyForPickup: countStatuses('READY_FOR_COLLECTION'),
        completed: countStatuses('COLLECTED'),
        awaitingPayment: countStatuses('AWAITING_PAYMENT'),
        failed: countStatuses('PRINT_FAILED', 'PRINT_UNCONFIRMED', 'FAILED_REQUIRES_SUPPORT'),
        cancelled: countStatuses('CANCELLED'),
        totalRevenuePaise,
        activePrinters: onlinePrinters,
        totalPrinters: printers.length,
        statusCounts,
      },
      recentOrders: recentOrders.map((order) => this.presentOrder(order)),
    });
  };

  public getOrders = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const supportedStatuses: OrderStatus[] = ['DRAFT', 'SUBMITTED', 'AWAITING_PAYMENT', 'AWAITING_REVIEW', 'READY_FOR_PRINT', 'IN_PROGRESS', 'READY_FOR_COLLECTION', 'COLLECTED', 'PRINT_FAILED', 'PRINT_UNCONFIRMED', 'PENDING_RELEASE', 'PENDING_AGENT_SPOOL', 'CANCEL_REQUESTED', 'CANCELLED', 'ON_HOLD', 'FAILED_REQUIRES_SUPPORT'];
    const status = req.query.status === undefined ? 'ALL' : req.query.status;
    if (typeof status !== 'string') return res.status(400).json({ error: 'Provide order status filters as a comma-separated list.' });
    const statusFilters = status === 'ALL' || !status ? [] : status.split(',').map((value) => value.trim()).filter(Boolean);
    if (statusFilters.some((filter) => !supportedStatuses.includes(filter as OrderStatus)) || new Set(statusFilters).size !== statusFilters.length) {
      return res.status(400).json({ error: 'Unsupported order status filter.' });
    }
    const paginationRequested = statusFilters.length > 1 || ['page', 'pageSize', 'search', 'sortBy', 'sortOrder'].some((key) => req.query[key] !== undefined);
    if (!paginationRequested) {
      const orders = this.orderRepo.getOrdersByShop(shopId, (statusFilters[0] as OrderStatus) || 'ALL');
      return res.json(orders.map((order) => this.presentOrder(order)));
    }
    const parsePositiveInteger = (value: unknown, fallback: number): number | null => {
      if (value === undefined) return fallback;
      if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
    };
    const page = parsePositiveInteger(req.query.page, 1);
    const requestedPageSize = parsePositiveInteger(req.query.pageSize, 25);
    const search = req.query.search === undefined ? '' : req.query.search;
    const sortBy = req.query.sortBy === undefined ? 'createdAt' : req.query.sortBy;
    const sortOrder = req.query.sortOrder === undefined ? 'desc' : req.query.sortOrder;
    const validSorts = ['createdAt', 'totalAmountPaise', 'status', 'orderNumber'];
    if (page === null || page > 1_000_000 || requestedPageSize === null || requestedPageSize > 100 ||
        typeof search !== 'string' || search.length > 100 ||
        typeof sortBy !== 'string' || !validSorts.includes(sortBy) ||
        typeof sortOrder !== 'string' || !['asc', 'desc'].includes(sortOrder)) {
      return res.status(400).json({ error: 'Invalid order page, page size, search, or sort parameters.' });
    }
    const result = this.orderRepo.getOrdersPageByShop(shopId, {
      statuses: statusFilters as OrderStatus[], search, page, pageSize: requestedPageSize,
      sortBy: sortBy as 'createdAt' | 'totalAmountPaise' | 'status' | 'orderNumber',
      sortOrder: sortOrder as 'asc' | 'desc',
    });
    return res.json({ ...result, orders: result.orders.map((order) => this.presentOrder(order)) });
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
    if (targetStatus === 'READY_FOR_COLLECTION') {
      return res.status(409).json({ error: 'Print completion requires the audited physical-output reconciliation workflow.' });
    }
    const printReleaseStatuses: OrderStatus[] = ['READY_FOR_PRINT', 'IN_PROGRESS', 'PENDING_AGENT_SPOOL', 'READY_FOR_COLLECTION', 'COLLECTED'];
    if (order.paymentMethod === 'ONLINE_RAZORPAY' && order.paymentStatus !== 'VERIFIED' && printReleaseStatuses.includes(targetStatus)) {
      return res.status(409).json({ error: 'Online payment must be verified before this order can be released or completed.' });
    }
    try {
      this.orderRepo.updateOrderStatus(id, targetStatus);
      const updated = this.orderRepo.getOrderById(id);
      res.json({ success: true, order: updated });
    } catch (err: any) {
      res.status(422).json({ error: err.message });
    }
  };

  public reconcilePrintOutput = (req: Request, res: Response) => {
    const orderId = String(req.params.id);
    const shopId = this.getShopId(req);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!shopId) return res.status(403).json({ error: 'An authenticated shop is required.' });
    if (req.body?.physicalOutputConfirmed !== true || reason.length < 10 || reason.length > 500) {
      return res.status(400).json({ error: 'Confirm that you physically inspected the complete output and provide a 10–500 character note.' });
    }

    const order = this.orderRepo.getOrderById(orderId);
    if (!order || order.shopId !== shopId) return res.status(404).json({ error: 'Order not found.' });
    if (order.paymentMethod === 'ONLINE_RAZORPAY' && order.paymentStatus !== 'VERIFIED') {
      return res.status(409).json({ error: 'Online payment must be verified before print output can be reconciled.' });
    }
    if (!['IN_PROGRESS', 'PRINT_UNCONFIRMED', 'READY_FOR_COLLECTION'].includes(order.status)) {
      return res.status(409).json({ error: 'Only an order with a dispatched print attempt can be reconciled.' });
    }

    const allowedStatuses: PrintJobStatus[] = [
      'DISPATCHED', 'SUBMITTED_TO_SPOOLER', 'OUTPUT_PENDING_CONFIRMATION',
      'OUTPUT_UNCERTAIN', 'NEEDS_PHYSICAL_VERIFICATION', 'PRINT_CONFIRMED',
    ];
    const actorId = req.user?.userId;
    if (!actorId) return res.status(401).json({ error: 'Authentication required.' });
    const now = new Date().toISOString();

    try {
      const result = this.db.transaction(() => {
        const current = this.db.queryOne<any>(
          `SELECT id, status FROM orders WHERE id = ? AND shop_id = ?`, [orderId, shopId]
        );
        if (!current || !['IN_PROGRESS', 'PRINT_UNCONFIRMED', 'READY_FOR_COLLECTION'].includes(current.status)) {
          throw new Error('RECONCILIATION_CONFLICT: order state changed; refresh and review it.');
        }
        const jobs = this.db.query<any>(
          `SELECT id, status FROM print_jobs WHERE order_id = ? ORDER BY id`, [orderId]
        );
        if (!jobs.length || jobs.some((job) => !allowedStatuses.includes(job.status as PrintJobStatus))) {
          throw new Error('RECONCILIATION_CONFLICT: one or more print jobs are not eligible for physical-output confirmation. Do not retry them blindly.');
        }

        const changedJobs: Array<{ id: string; previousStatus: string }> = [];
        for (const job of jobs) {
          if (job.status === 'PRINT_CONFIRMED') continue;
          let from = job.status as PrintJobStatus;
          if (from === 'OUTPUT_UNCERTAIN') {
            validatePrintJobTransition(from, 'NEEDS_PHYSICAL_VERIFICATION');
            this.db.execute(`UPDATE print_jobs SET status = 'NEEDS_PHYSICAL_VERIFICATION', updated_at = ? WHERE id = ? AND status = ?`, [now, job.id, from]);
            from = 'NEEDS_PHYSICAL_VERIFICATION';
          }
          validatePrintJobTransition(from, 'PRINT_CONFIRMED');
          this.db.execute(`UPDATE print_jobs SET status = 'PRINT_CONFIRMED', updated_at = ? WHERE id = ? AND status = ?`, [now, job.id, from]);
          changedJobs.push({ id: job.id, previousStatus: job.status });
        }

        if (current.status !== 'READY_FOR_COLLECTION') this.orderRepo.updateOrderStatus(orderId, 'READY_FOR_COLLECTION');
        this.userRepo.logAuditEvent({
          id: crypto.randomUUID(), actorUserId: actorId, actorRole: req.user?.role,
          shopId, organizationId: req.user?.organizationId,
          action: 'MERCHANT_PRINT_OUTPUT_RECONCILED', targetType: 'ORDER', targetId: orderId,
          outcome: 'SUCCESS', ipAddress: req.ip,
          details: { confirmationSource: 'OPERATOR_PHYSICAL_INSPECTION', physicalOutputConfirmed: true, reason, changedJobs },
          createdAt: now,
        });
        return { order: this.orderRepo.getOrderById(orderId), reconciledJobs: changedJobs.length };
      });
      return res.json({ success: true, ...result });
    } catch (error: any) {
      if (typeof error?.message === 'string' && error.message.startsWith('RECONCILIATION_CONFLICT:')) {
        return res.status(409).json({ error: error.message.slice('RECONCILIATION_CONFLICT:'.length).trim() });
      }
      return res.status(422).json({ error: error instanceof Error ? error.message : 'Print output could not be reconciled.' });
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

    if (order.paymentMethod === 'ONLINE_RAZORPAY' && order.paymentStatus !== 'VERIFIED') {
      return res.status(409).json({ error: 'Online payment must be verified before print dispatch.' });
    }

    const requestedPrinter = req.body?.printerId || req.body?.printerName;
    const onlinePrinters = this.printerRepo.getPrintersByShop(order.shopId)
      .filter((candidate) => hasFreshOnlinePrinterEvidence(candidate.isOnline, candidate.lastHeartbeat));
    const defaults = onlinePrinters.filter((candidate) => candidate.isDefault);
    const printer = typeof requestedPrinter === 'string' && requestedPrinter.trim()
      ? onlinePrinters.find((candidate) => candidate.id === requestedPrinter || candidate.name === requestedPrinter || candidate.systemDriverName === requestedPrinter)
      : defaults.length === 1 ? defaults[0] : undefined;
    if (!printer || !printer.isOnline) {
      return res.status(409).json({ error: 'Choose an online printer, or set exactly one online default printer before releasing this order. No print job was released.' });
    }

    try {
      // Assignment and order-state changes must commit together so an agent
      // cannot see an in-progress order without a real, shop-owned target.
      this.db.transaction(() => {
        const jobs = this.db.query<any>(`SELECT id, printer_id, status FROM print_jobs WHERE order_id = ?`, [id]);
        if (!jobs.length || jobs.some((job) => job.status !== 'RECEIVED' || job.printer_id)) {
          throw new Error('PRINT_DISPATCH_CONFLICT: no unassigned jobs are available; inspect the existing print state.');
        }
        for (const job of jobs) {
          this.db.execute(`UPDATE print_jobs SET printer_id = ?, updated_at = ? WHERE id = ? AND status = 'RECEIVED' AND printer_id IS NULL`, [printer.id, new Date().toISOString(), job.id]);
        }
        const assignedJobs = this.db.query<any>(`SELECT id FROM print_jobs WHERE order_id = ? AND printer_id = ? AND status = 'RECEIVED'`, [id, printer.id]);
        if (assignedJobs.length !== jobs.length) throw new Error('PRINT_DISPATCH_CONFLICT: another release changed the printer assignment.');
        if (order.status === 'AWAITING_REVIEW' || order.status === 'SUBMITTED') {
          this.orderRepo.updateOrderStatus(id, 'READY_FOR_PRINT');
        }
        this.orderRepo.updateOrderStatus(id, 'IN_PROGRESS');
      });

      const updated = this.orderRepo.getOrderById(id);
      res.json({ success: true, message: `Print jobs queued for ${printer.name}.`, printerId: printer.id, order: updated });
    } catch (err: any) {
      if (typeof err?.message === 'string' && err.message.startsWith('PRINT_DISPATCH_CONFLICT:')) {
        return res.status(409).json({ error: err.message.slice('PRINT_DISPATCH_CONFLICT:'.length).trim() });
      }
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

    if (printerId !== undefined && printerId !== null && printerId !== '') {
      const printerIsOwned = typeof printerId === 'string' &&
        this.printerRepo.getPrintersByShop(shopId).some((printer) => printer.id === printerId);
      if (!printerIsOwned) return res.status(400).json({ error: 'Rate rules can only target a printer registered to this shop.' });
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
    res.json(printers.map((printer) => ({
      ...printer,
      healthStatus: getPrinterHealthStatus(printer.isOnline, printer.lastHeartbeat),
    })));
  };

  public setDefaultPrinter = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const printerId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!printerId || printerId.length > 128) return res.status(400).json({ error: 'A valid printer ID is required.' });
    if (!this.printerRepo.setDefaultPrinter(shopId, printerId)) return res.status(404).json({ error: 'Printer not found for this shop.' });
    const printers = this.printerRepo.getPrintersByShop(shopId).map((printer) => ({
      ...printer,
      healthStatus: getPrinterHealthStatus(printer.isOnline, printer.lastHeartbeat),
    }));
    return res.json({ success: true, printers });
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
    res.json(staff.map((entry) => ({
      ...entry,
      rolePreset: entry.membership.role === 'SHOP_STAFF'
        ? Object.entries(ROLE_PRESETS).find(([, permissions]) =>
          permissions.length === entry.membership.permissions.length &&
          permissions.every((permission) => entry.membership.permissions.includes(permission))
        )?.[0] || null
        : null,
    })));
  };

  public addStaff = (req: Request, res: Response) => {
    const shopId = req.user?.shopId;
    const organizationId = req.user?.organizationId;
    if (!shopId || !organizationId || req.user?.role !== 'MERCHANT_OWNER') {
      return res.status(403).json({ error: 'Only the organization owner can invite staff for this shop.' });
    }
    const { email, fullName, rolePreset, phone } = req.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedName = typeof fullName === 'string' ? fullName.trim() : '';
    const preset = typeof rolePreset === 'string' ? rolePreset.trim() : '';
    const normalizedPhone = typeof phone === 'string' ? phone.trim().replace(/[\s()-]/g, '') : '';
    if (!normalizedEmail || normalizedEmail.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
        normalizedName.length < 2 || normalizedName.length > 120 || /[\u0000-\u001f\u007f]/.test(normalizedName) ||
        !Object.prototype.hasOwnProperty.call(ROLE_PRESETS, preset) || preset === 'Custom' ||
        (phone !== undefined && (typeof phone !== 'string' || !/^\+?[1-9]\d{7,14}$/.test(normalizedPhone)))) {
      return res.status(400).json({ error: 'Provide a valid email, full name, phone number, and supported staff role preset.' });
    }
    if (this.userRepo.getUserByEmail(normalizedEmail)) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    const scope = this.db.queryOne<any>(
      `SELECT s.id, o.id AS organization_id, o.owner_user_id
       FROM shops s JOIN organizations o ON o.id = s.organization_id
       WHERE s.id = ? AND s.organization_id = ?`,
      [shopId, organizationId]
    );
    if (!scope || scope.owner_user_id !== req.user.userId) {
      return res.status(403).json({ error: 'The authenticated owner does not own this shop and organization.' });
    }

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const userId = crypto.randomUUID();
    const invitationToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(invitationToken).digest('hex');
    const permissions = ROLE_PRESETS[preset];
    try {
      this.db.transaction(() => {
        this.userRepo.createUser({
          id: userId, email: normalizedEmail, phone: normalizedPhone || undefined, fullName: normalizedName,
          role: 'SHOP_STAFF', isActive: false, createdAt: now, updatedAt: now,
        }, hashPassword(crypto.randomBytes(48).toString('base64url')));
        this.userRepo.createMembership({
          id: crypto.randomUUID(), userId, organizationId, shopId, role: 'SHOP_STAFF', permissions,
          createdAt: now, updatedAt: now,
        });
        this.db.execute(
          `INSERT INTO account_invitations (id, token_hash, user_id, organization_id, shop_id, expires_at, accepted_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
          [crypto.randomUUID(), tokenHash, userId, organizationId, shopId, expiresAt, now]
        );
        this.userRepo.logAuditEvent({
          id: crypto.randomUUID(), actorUserId: req.user!.userId, actorRole: req.user!.role,
          organizationId, shopId, action: 'MERCHANT_STAFF_INVITED', targetType: 'USER', targetId: userId,
          outcome: 'SUCCESS', ipAddress: req.ip, details: { email: normalizedEmail, rolePreset: preset, permissions }, createdAt: now,
        });
      });
    } catch (error) {
      if (/unique|duplicate/i.test(error instanceof Error ? error.message : '')) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
      throw error;
    }
    return res.status(201).json({
      success: true,
      staff: { userId, email: normalizedEmail, fullName: normalizedName, rolePreset: preset, permissions },
      invitationToken,
      invitationExpiresAt: expiresAt,
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
      `SELECT sc.*, (SELECT COUNT(*) FROM storage_documents sd WHERE sd.shop_id = sc.shop_id AND sd.category_id = sc.id) AS document_count
       FROM storage_categories sc WHERE sc.shop_id = ? ORDER BY sc.created_at DESC`,
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
      name: r.file_name,
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

  public uploadStorageDocument = async (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const { fileName: rawFileName, fileData, categoryId } = req.body || {};
    if (typeof rawFileName !== 'string' || !rawFileName.trim() || rawFileName.length > 255 || typeof fileData !== 'string') {
      return res.status(400).json({ error: 'fileName and fileData (Base64) are required.' });
    }

    const maxFileBytes = Math.max(1, Math.min(35, Number(process.env.MAX_FILE_SIZE_MB) || 25)) * 1024 * 1024;
    const base64 = fileData.includes('base64,') ? fileData.slice(fileData.indexOf('base64,') + 7) : fileData;
    if (!base64 || base64.length > Math.ceil(maxFileBytes * 4 / 3) + 8 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
      return res.status(413).json({ error: 'File is too large or has invalid encoding.' });
    }
    const body = Buffer.from(base64, 'base64');
    const normalizedBase64 = base64.replace(/=+$/, '');
    if (!body.length || body.length > maxFileBytes || body.toString('base64').replace(/=+$/, '') !== normalizedBase64) {
      return res.status(413).json({ error: 'File is empty, too large, or has invalid encoding.' });
    }

    let inspected: { mimeType: string; pageCount: number };
    try {
      inspected = await inspectDocument(body);
    } catch (error: any) {
      return res.status(415).json({ error: error?.message || 'Upload a valid PDF, JPEG, or PNG file.' });
    }

    const selectedCategoryId = typeof categoryId === 'string' && categoryId.trim() ? categoryId.trim() : null;
    if (selectedCategoryId) {
      const category = this.db.queryOne<any>(
        `SELECT id FROM storage_categories WHERE id = ? AND shop_id = ?`,
        [selectedCategoryId, shopId]
      );
      if (!category) return res.status(404).json({ error: 'Storage category not found.' });
    }

    const id = `storage-doc-${crypto.randomUUID()}`;
    const extension = inspected.mimeType === 'application/pdf' ? '.pdf' : inspected.mimeType === 'image/png' ? '.png' : '.jpg';
    const providedName = path.basename(rawFileName.replace(/\\/g, '/'));
    const safeBaseName = path.parse(providedName).name
      .replace(/[^A-Za-z0-9._ -]/g, '_').replace(/^[. ]+|[. ]+$/g, '').slice(0, 170) || 'document';
    const safeFileName = `${safeBaseName}${extension}`;
    const storageObjectName = `${crypto.randomUUID()}${extension}`;
    const createdAt = new Date().toISOString();
    let storageKey: string;
    try {
      storageKey = await this.fileStorage.store(shopId, storageObjectName, inspected.mimeType, body);
    } catch (error) {
      console.error('[Merchant vault upload]', error);
      return res.status(503).json({ error: 'Private document storage is unavailable. No document was saved.' });
    }

    try {
      this.db.transaction(() => {
        this.db.execute(
          `INSERT INTO storage_documents (id, shop_id, category_id, file_name, mime_type, file_size_bytes, page_count, storage_key, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, shopId, selectedCategoryId, safeFileName, inspected.mimeType, body.length, inspected.pageCount, storageKey, createdAt]
        );
      });
    } catch (error) {
      try { await this.fileStorage.remove(storageKey); }
      catch (cleanupError) { console.error('[Merchant vault upload cleanup]', cleanupError); }
      console.error('[Merchant vault metadata]', error);
      return res.status(503).json({ error: 'Document metadata could not be saved. The uploaded file is being cleaned up.' });
    }

    return res.status(201).json({
      success: true,
      document: {
        id, fileName: safeFileName, mimeType: inspected.mimeType, fileSizeBytes: body.length,
        pageCount: inspected.pageCount, categoryId: selectedCategoryId, createdAt,
        downloadUrl: `/api/v1/merchant/storage/documents/${encodeURIComponent(id)}/download`,
      },
    });
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

    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(String(row.file_name)).replace(/[\r\n"\\]/g, '_')}"`);
    res.setHeader('Content-Length', String(content.length));
    res.send(content);
  };

  public deleteStorageDocument = async (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const docId = String(req.params.id);

    const row = this.db.queryOne<any>(
      `SELECT sd.storage_key FROM storage_documents sd WHERE sd.id = ? AND sd.shop_id = ?`,
      [docId, shopId]
    );
    if (!row) return res.status(404).json({ error: 'Document not found.' });

    if (!String(row.storage_key).startsWith('expired:')) {
      try {
        const removed = await this.fileStorage.remove(String(row.storage_key));
        if (!removed) return res.status(503).json({ error: 'Document could not be deleted from private storage. Please retry.' });
      } catch {
        return res.status(503).json({ error: 'Document could not be deleted from private storage. Please retry.' });
      }
    }

    this.db.execute(`DELETE FROM storage_documents WHERE id = ?`, [docId]);
    res.json({ success: true });
  };

  // WhatsApp Setup
  public getWhatsAppSetup = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    res.json({
      shopId,
      provider: 'meta_whatsapp_cloud',
      status: 'UNAVAILABLE',
      available: false,
      accounts: [],
      events: [],
      hasConnection: false,
      canPair: false,
      message: 'WhatsApp Cloud API onboarding and message delivery are not configured for this deployment.',
    });
  };

  public saveWhatsAppSetup = (req: Request, res: Response) => {
    res.status(503).json({ error: 'WhatsApp setup is unavailable until secure Meta onboarding and credential storage are configured.' });
  };

  public generateWhatsAppQrPairing = (req: Request, res: Response) => {
    res.status(503).json({ error: 'WhatsApp device pairing is unavailable. No pairing session was created.' });
  };

  public refreshWhatsAppQrPairing = (req: Request, res: Response) => {
    res.status(503).json({ error: 'WhatsApp device pairing is unavailable. No pairing session was refreshed.' });
  };

  public removeWhatsAppAccount = (req: Request, res: Response) => {
    res.status(503).json({ error: 'WhatsApp account management is unavailable because Meta onboarding and account persistence are not configured. No account was removed.' });
  };

  public getWhatsAppEvents = (req: Request, res: Response) => {
    res.status(503).json({ error: 'WhatsApp event history is unavailable because Meta onboarding and event persistence are not configured.' });
  };
}
