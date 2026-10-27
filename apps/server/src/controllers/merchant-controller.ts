import { Request, Response } from 'express';
import {
  ShopRepository,
  OrderRepository,
  PricingRepository,
  PrinterRepository,
  UserRepository,
  LedgerRepository,
} from '@inklly/db';
import { OrderStatus, ROLE_PRESETS } from '@inklly/shared';

export class MerchantController {
  constructor(
    private shopRepo: ShopRepository,
    private orderRepo: OrderRepository,
    private pricingRepo: PricingRepository,
    private printerRepo: PrinterRepository,
    private userRepo: UserRepository,
    private ledgerRepo: LedgerRepository
  ) {}

  private getShopId(req: Request): string {
    return req.user?.shopId || (req.query.shopId as string) || (req.headers['x-shop-id'] as string) || '';
  }

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
      recentOrders: orders.slice(0, 5),
    });
  };

  public getOrders = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const status = req.query.status as OrderStatus | 'ALL' | undefined;
    const orders = this.orderRepo.getOrdersByShop(shopId, status || 'ALL');
    res.json(orders);
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

    res.json(order);
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
      if (targetStatus === 'COLLECTED') {
        if (order.status === 'AWAITING_REVIEW' || order.status === 'SUBMITTED') {
          this.orderRepo.updateOrderStatus(id, 'READY_FOR_PRINT');
        }
        if (order.status === 'AWAITING_REVIEW' || order.status === 'SUBMITTED' || order.status === 'READY_FOR_PRINT') {
          this.orderRepo.updateOrderStatus(id, 'IN_PROGRESS');
        }
        if (order.status !== 'COLLECTED') {
          this.orderRepo.updateOrderStatus(id, 'READY_FOR_COLLECTION');
        }
      }
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

    if (!paperSize || !colorMode || !duplexMode || pricePerPrintedSidePaise === undefined) {
      return res.status(400).json({ error: 'Missing required rate rule parameters' });
    }

    const ruleId = id || `rate-${shopId}-${paperSize}-${colorMode}-${duplexMode}`;
    this.pricingRepo.setRateRule({
      id: ruleId,
      shopId,
      printerId: printerId || undefined,
      paperSize,
      colorMode,
      duplexMode,
      pricePerPrintedSidePaise: Number(pricePerPrintedSidePaise),
    });

    res.json({ success: true, rateRules: this.pricingRepo.getRateRules(shopId) });
  };

  public updateBulkDiscount = (req: Request, res: Response) => {
    const shopId = this.getShopId(req);
    const { minOrderValuePaise, discountPercentage, isEnabled } = req.body;

    this.pricingRepo.setBulkDiscountRule({
      id: `bulk-${shopId}`,
      shopId,
      minOrderValuePaise: Number(minOrderValuePaise || 10000),
      discountPercentage: Number(discountPercentage || 10),
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
      isOnline: true,
      isDefault: false,
      supportsColor: Boolean(supportsColor),
      supportsDuplex: Boolean(supportsDuplex),
      lastHeartbeat: new Date().toISOString(),
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
}
