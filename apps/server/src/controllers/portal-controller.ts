import { Request, Response } from 'express';
import * as crypto from 'node:crypto';
import { DatabaseService, OrderRepository, PricingRepository, ShopRepository } from '@inklly/db';
import { calculateQuote, PriceQuoteRequest, OrderStatus, PaymentStatus } from '@inklly/shared';
import { ShopPaymentCredentialsService } from '../services/shop-payment-credentials';
import { PrivateFileStorage } from '../services/private-file-storage';
import { inspectDocument } from '../services/document-page-count';

export class PortalController {
  constructor(
    private db: DatabaseService,
    private shopRepo: ShopRepository,
    private pricingRepo: PricingRepository,
    private orderRepo: OrderRepository,
    private paymentCredentials: ShopPaymentCredentialsService,
    private fileStorage: PrivateFileStorage
  ) {}

  private hasShopAccess(organizationId: string): boolean {
    const organization = this.shopRepo.getOrganizationById(organizationId);
    if (!organization) return false;
    if (organization.planStatus === 'ACTIVE') return true;
    if (organization.planStatus !== 'TRIAL') return false;
    const trial = this.db.queryOne<any>(
      `SELECT status, current_period_end FROM subscriptions WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1`,
      [organizationId]
    );
    if (trial?.status === 'TRIALING' && Date.parse(trial.current_period_end) > Date.now()) return true;
    this.db.execute(`UPDATE organizations SET plan_status = 'PAST_DUE', updated_at = ? WHERE id = ? AND plan_status = 'TRIAL'`, [new Date().toISOString(), organizationId]);
    return false;
  }

  public getShopByCode = (req: Request, res: Response) => {
    const shop_code = String(req.params.shop_code);
    const shop = this.shopRepo.getShopByCode(shop_code);

    if (!shop || !shop.isActive) {
      return res.status(404).json({ error: 'Shop not found or currently offline' });
    }
    if (!this.hasShopAccess(shop.organizationId)) {
      return res.status(402).json({ error: 'This shop is not currently accepting orders. Please contact the shop owner.' });
    }

    const rates = this.pricingRepo.getRateRules(shop.id);
    const paymentStatus = this.paymentCredentials.getRazorpayStatus(shop.id);
    const bwSimplex = rates.find((r) => r.paperSize === 'A4' && r.colorMode === 'bw' && r.duplexMode === 'simplex')?.pricePerPrintedSidePaise || 200;
    const bwDuplex = rates.find((r) => r.paperSize === 'A4' && r.colorMode === 'bw' && r.duplexMode === 'duplex_auto')?.pricePerPrintedSidePaise || 150;
    const colorSimplex = rates.find((r) => r.paperSize === 'A4' && r.colorMode === 'color' && r.duplexMode === 'simplex')?.pricePerPrintedSidePaise || 1000;

    res.json({
      id: shop.id,
      shopCode: shop.shopCode,
      name: shop.name,
      tagline: shop.tagline,
      address: `${shop.address}, ${shop.city}, ${shop.state}`,
      phone: shop.phone,
      currency: shop.currency,
      paymentGateway: shop.paymentGateway,
      acceptCashOnCollection: shop.acceptCashOnCollection,
      onlinePaymentAvailable: shop.currency === 'INR' && paymentStatus.configured && paymentStatus.webhookConfigured,
      enabledPaperFormats: ['A4', 'A3', 'PHOTO_4X6', 'PHOTO_5X7'],
      enabledColorModes: ['bw', 'color'],
      enabledSides: ['simplex', 'duplex_auto'],
      rates: {
        bw_simplex: bwSimplex / 100,
        bw_duplex: bwDuplex / 100,
        color_simplex: colorSimplex / 100,
        ratesList: rates,
      },
    });
  };

  public getQuote = (req: Request, res: Response) => {
    const body: PriceQuoteRequest = req.body;
    if (!body.shopId || !body.files || body.files.length === 0) {
      return res.status(400).json({ error: 'Missing shopId or files array in quote request' });
    }

    const shop = this.shopRepo.getShopById(body.shopId) || this.shopRepo.getShopByCode(body.shopId);
    if (!shop || !shop.isActive || !this.hasShopAccess(shop.organizationId)) {
      return res.status(402).json({ error: 'This shop is not currently accepting orders.' });
    }

    const rates = this.pricingRepo.getRateRules(body.shopId);
    if (rates.length === 0) {
      return res.status(404).json({ error: 'No active rates configured for this shop' });
    }

    const copyDiscounts = this.pricingRepo.getCopyDiscountRules(body.shopId);
    const bulkDiscount = this.pricingRepo.getBulkDiscountRule(body.shopId);

    try {
      const quote = calculateQuote(
        body,
        rates,
        copyDiscounts,
        bulkDiscount || undefined,
        0,
        'INR'
      );
      res.json(quote);
    } catch (err: any) {
      res.status(422).json({ error: err.message });
    }
  };

  public submitOrder = async (req: Request, res: Response) => {
    const {
      shopId: rawShopId,
      shopCode,
      customerName,
      customerPhone,
      customerEmail,
      paymentMethod,
      files,
    } = req.body;

    const shop =
      (rawShopId ? this.shopRepo.getShopById(rawShopId) || this.shopRepo.getShopByCode(rawShopId) : null) ||
      (shopCode ? this.shopRepo.getShopByCode(shopCode) : null);

    if (!shop || !Array.isArray(files) || files.length === 0 || files.length > 20) {
      return res.status(400).json({ error: 'Incomplete order submission payload' });
    }
    if (!shop.isActive || !this.hasShopAccess(shop.organizationId)) {
      return res.status(402).json({ error: 'This shop is not currently accepting orders.' });
    }
    const shopId = shop.id;

    const normalizedPaymentMethod = paymentMethod || 'CASH_ON_COLLECTION';
    if (!['CASH_ON_COLLECTION', 'ONLINE_RAZORPAY'].includes(normalizedPaymentMethod)) {
      return res.status(400).json({ error: 'Unsupported payment method.' });
    }
    if (normalizedPaymentMethod === 'CASH_ON_COLLECTION' && !shop.acceptCashOnCollection) {
      return res.status(422).json({ error: 'This shop is not accepting cash-on-collection orders.' });
    }
    if (normalizedPaymentMethod === 'ONLINE_RAZORPAY') {
      const credentials = this.paymentCredentials.getRazorpayCredentials(shopId);
      if (shop.currency !== 'INR' || !credentials?.webhookSecret) {
        return res.status(422).json({ error: 'Online payment is not configured for this shop.' });
      }
    }
    const rateRules = this.pricingRepo.getRateRules(shopId);
    if (rateRules.length === 0) return res.status(422).json({ error: 'This shop has no print rates configured.' });

    const safeFiles: any[] = [];
    try {
      for (const file of files) {
        const storageKey = typeof file.storageKey === 'string' ? file.storageKey : '';
        if (!this.fileStorage.isValidShopKey(storageKey, shopId)) {
          throw new Error('A file upload is missing or does not belong to this shop. Please upload it again.');
        }
        let content: Buffer | null;
        try { content = await this.fileStorage.read(storageKey, shopId); }
        catch { return res.status(503).json({ error: 'Private file storage is temporarily unavailable.' }); }
        if (!content) {
          throw new Error('A file upload could not be found. Please upload it again.');
        }
        let inspected;
        try { inspected = await inspectDocument(content); }
        catch (error: any) { return res.status(422).json({ error: error.message || 'The uploaded document could not be inspected.' }); }
        if (typeof file.fileName !== 'string' || !file.fileName.trim() || file.fileName.length > 180 ||
            !Number.isInteger(Number(file.pageCount)) || Number(file.pageCount) < 1 || Number(file.pageCount) > 50000 ||
            !file.options || typeof file.options !== 'object' || !Number.isInteger(Number(file.options.copies)) ||
            Number(file.options.copies) < 1 || Number(file.options.copies) > 500) {
          throw new Error('A file has invalid print settings. Please review the order and try again.');
        }
        // The client may display a page count, but server-derived metadata is the
        // sole input used for quotes, persisted order files, and payment amounts.
        safeFiles.push({ ...file, pageCount: inspected.pageCount, mimeType: inspected.mimeType, fileSizeBytes: content.length });
      }
    } catch (error: any) {
      const message = error.message || 'A file upload could not be used.';
      const storageUnavailable = message.startsWith('Private storage');
      return res.status(storageUnavailable ? 503 : 422).json({ error: storageUnavailable ? 'Private file storage is temporarily unavailable.' : message });
    }

    let serverQuote;
    try {
      serverQuote = calculateQuote(
        { shopId, files: safeFiles.map((file: any) => ({ fileName: String(file.fileName || ''), pageCount: Number(file.pageCount), options: file.options })) },
        rateRules,
        this.pricingRepo.getCopyDiscountRules(shopId),
        this.pricingRepo.getBulkDiscountRule(shopId) || undefined,
        0,
        shop.currency || 'INR'
      );
    } catch (error: any) {
      return res.status(422).json({ error: error.message || 'Unable to price this order.' });
    }
    if (!Number.isSafeInteger(serverQuote.totalPaise) || serverQuote.totalPaise < 1 || serverQuote.totalPaise > 5_000_000_000) {
      return res.status(422).json({ error: 'The calculated order total is outside the supported range.' });
    }

    const orderId = `ord-${crypto.randomUUID()}`;
    const orderNumber = `INK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const now = new Date().toISOString();

    const orderFiles = safeFiles.map((f: any, idx: number) => ({
      id: `file-${orderId}-${idx + 1}`,
      orderId,
      fileName: f.fileName,
      fileSizeBytes: f.fileSizeBytes || 1024 * 1024,
      mimeType: f.mimeType || 'application/pdf',
      storageKey: f.storageKey,
      pageCount: f.pageCount,
      printOptions: f.options,
      lineSubtotalPaise: serverQuote.lineItems[idx].subtotalPaise,
    }));

    const initialStatus: OrderStatus = normalizedPaymentMethod === 'CASH_ON_COLLECTION' ? 'AWAITING_REVIEW' : 'AWAITING_PAYMENT';
    const initialPaymentStatus: PaymentStatus = normalizedPaymentMethod === 'CASH_ON_COLLECTION' ? 'PENDING' : 'NOT_STARTED';

    const order = {
      id: orderId,
      shopId,
      orderNumber,
      // Reuse the random, unique order suffix so two concurrent orders cannot
      // accidentally receive the same short collection token.
      tokenNumber: `T-${orderNumber.slice(-8)}`,
      customerName: customerName || 'Counter Customer',
      customerPhone,
      customerEmail,
      channel: 'QR_PORTAL' as const,
      status: initialStatus,
      paymentStatus: initialPaymentStatus,
      paymentMethod: normalizedPaymentMethod,
      totalAmountPaise: serverQuote.totalPaise,
      currency: shop.currency || 'INR',
      quoteVersion: serverQuote.quoteVersion,
      files: orderFiles,
      createdAt: now,
      updatedAt: now,
    };

    this.orderRepo.createOrder(order);

    res.status(201).json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      tokenNumber: order.tokenNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmountPaise: order.totalAmountPaise,
      currency: order.currency,
    });
  };

  public uploadDocument = async (req: Request, res: Response) => {
    try {
      const { fileName, fileData, shopId } = req.body;
      if (typeof fileName !== 'string' || !fileName.trim() || fileName.length > 180 || typeof fileData !== 'string') {
        return res.status(400).json({ error: 'fileName and fileData (Base64) are required' });
      }

      const shop = typeof shopId === 'string' ? this.shopRepo.getShopById(shopId) : null;
      if (!shop || !shop.isActive) return res.status(404).json({ error: 'Shop not found or currently offline.' });
      if (!this.hasShopAccess(shop.organizationId)) return res.status(402).json({ error: 'This shop is not currently accepting uploads.' });
      const safeShopId = shop.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const sanitizedName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const uniquePrefix = crypto.randomUUID();
      const savedFileName = `${uniquePrefix}-${sanitizedName}`;

      // Strip Base64 header if present (e.g. "data:application/pdf;base64,")
      const base64Content = fileData.includes('base64,') ? fileData.split('base64,')[1] : fileData;
      const maxFileBytes = Math.max(1, Math.min(35, Number(process.env.MAX_FILE_SIZE_MB) || 25)) * 1024 * 1024;
      if (base64Content.length > Math.ceil(maxFileBytes * 4 / 3) + 8 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64Content)) {
        return res.status(413).json({ error: 'File is too large or has invalid encoding.' });
      }
      const buffer = Buffer.from(base64Content, 'base64');
      if (buffer.length === 0 || buffer.length > maxFileBytes) return res.status(413).json({ error: 'File exceeds the upload size limit.' });
      let inspected;
      try { inspected = await inspectDocument(buffer); }
      catch (error: any) { return res.status(415).json({ error: error.message || 'Upload a valid PDF, JPEG, or PNG file.' }); }
      const detectedMimeType = inspected.mimeType;
      const storageKey = await this.fileStorage.store(safeShopId, savedFileName, detectedMimeType, buffer);

      res.status(201).json({
        success: true,
        fileName,
        savedFileName,
        storageKey,
        fileSizeBytes: buffer.length,
        mimeType: detectedMimeType,
        pageCount: inspected.pageCount,
      });
    } catch (err: any) {
      console.error('[Upload Error]', err.message || err);
      res.status(err.message?.startsWith('Private storage') ? 503 : 500).json({ error: 'Failed to securely store document.' });
    }
  };

  public getOrderStatus = (req: Request, res: Response) => {
    const id = String(req.params.id);
    // Public tracking accepts only the high-entropy order id returned at submission.
    // The short, human-readable order number is not an access credential.
    const order = this.orderRepo.getOrderById(id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      tokenNumber: order.tokenNumber,
      shopCode: this.shopRepo.getShopById(order.shopId)?.shopCode,
      customerName: order.customerName,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmountPaise: order.totalAmountPaise,
      currency: order.currency,
      filesCount: order.files.length,
      createdAt: order.createdAt,
      collectedAt: order.collectedAt,
    });
  };
}
