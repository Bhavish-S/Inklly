import { Request, Response } from 'express';
import * as crypto from 'node:crypto';
import { DatabaseService, OrderRepository, PricingRepository, ShopRepository } from '@inklly/db';
import { calculateQuote, PriceQuoteRequest, OrderStatus, PaymentStatus } from '@inklly/shared';
import { ShopPaymentCredentialsService } from '../services/shop-payment-credentials';
import { PrivateFileStorage } from '../services/private-file-storage';
import { inspectDocument } from '../services/document-page-count';

function stableJson(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

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
    const bwSimplex = rates.find((r) => r.paperSize === 'A4' && r.colorMode === 'bw' && r.duplexMode === 'simplex')?.pricePerPrintedSidePaise;
    const bwDuplex = rates.find((r) => r.paperSize === 'A4' && r.colorMode === 'bw' && r.duplexMode === 'duplex_auto')?.pricePerPrintedSidePaise;
    const colorSimplex = rates.find((r) => r.paperSize === 'A4' && r.colorMode === 'color' && r.duplexMode === 'simplex')?.pricePerPrintedSidePaise;
    const configuredPaperSizes = [...new Set(rates.map((rule) => rule.paperSize))];
    const configuredColorModes = [...new Set(rates.map((rule) => rule.colorMode))];
    const configuredSides = [...new Set(rates.map((rule) => rule.duplexMode))];

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
      portalSettings: this.shopRepo.getPortalSettings(shop.id),
      onlinePaymentAvailable: shop.currency === 'INR' && paymentStatus.configured && paymentStatus.webhookConfigured,
      enabledPaperFormats: configuredPaperSizes,
      enabledColorModes: configuredColorModes,
      enabledSides: configuredSides,
      rates: {
        bw_simplex: bwSimplex === undefined ? null : bwSimplex / 100,
        bw_duplex: bwDuplex === undefined ? null : bwDuplex / 100,
        color_simplex: colorSimplex === undefined ? null : colorSimplex / 100,
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

    const optionError = this.validatePortalOptions(this.shopRepo.getPortalSettings(shop.id), body.files);
    if (optionError) return res.status(422).json({ error: optionError });

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
      quote: submittedQuote,
      files,
    } = req.body;

    const shop =
      (rawShopId ? this.shopRepo.getShopById(rawShopId) || this.shopRepo.getShopByCode(rawShopId) : null) ||
      (shopCode ? this.shopRepo.getShopByCode(shopCode) : null);

    if (!shop || !Array.isArray(files) || files.length === 0 || files.length > 20) {
      return res.status(400).json({ error: 'Incomplete order submission payload' });
    }
    const portalSettings = this.shopRepo.getPortalSettings(shop.id);
    // Shop policy is enforced by the server for every caller. A client-provided
    // version marker cannot be used to bypass required customer details.
    if (portalSettings.requiredFields.name && (typeof customerName !== 'string' || !customerName.trim())) {
      return res.status(422).json({ error: 'Enter your name to place this order.' });
    }
    const normalizedPhone = typeof customerPhone === 'string' ? customerPhone.trim().replace(/[\s()-]/g, '') : '';
    if (portalSettings.requiredFields.phone && !/^(?:\+?91)?[6-9]\d{9}$/.test(normalizedPhone)) {
      return res.status(422).json({ error: 'Enter a valid Indian mobile number, with or without the +91 country code.' });
    }
    const suppliedIdempotencyKey = req.get('Idempotency-Key');
    if (suppliedIdempotencyKey !== undefined && !/^[A-Za-z0-9_-]{16,128}$/.test(suppliedIdempotencyKey)) {
      return res.status(400).json({ error: 'Idempotency-Key must contain 16 to 128 letters, numbers, underscores, or hyphens.' });
    }
    // Preserve compatibility for older API clients while ensuring all first-party
    // customer submissions send a stable key that the server can safely replay.
    const idempotencyKey = suppliedIdempotencyKey || crypto.randomUUID();
    const normalizedPaymentMethod = paymentMethod || 'CASH_ON_COLLECTION';
    const requestHash = crypto.createHash('sha256').update(stableJson({
      shopId: shop.id,
      customerName: typeof customerName === 'string' && customerName.trim() ? customerName.trim() : 'Counter Customer',
      customerPhone: customerPhone || null,
      customerEmail: customerEmail || null,
      paymentMethod: normalizedPaymentMethod,
      quote: submittedQuote || null,
      files: files.map((file: any) => ({ fileName: file?.fileName, storageKey: file?.storageKey, options: file?.options })),
    })).digest('hex');
    const existingOrder = this.orderRepo.findIdempotentOrder(shop.id, idempotencyKey, requestHash);
    if (existingOrder?.conflict) {
      return res.status(409).json({ error: 'This Idempotency-Key was already used for a different order. Start a new order to submit changed details.' });
    }
    if (existingOrder) {
      const prior = this.orderRepo.getOrderById(existingOrder.orderId);
      if (!prior) return res.status(503).json({ error: 'The original order record is temporarily unavailable.' });
      return res.status(200).json({
        success: true, orderId: prior.id, orderNumber: prior.orderNumber, tokenNumber: prior.tokenNumber,
        status: prior.status, paymentStatus: prior.paymentStatus,
        totalAmountPaise: prior.totalAmountPaise, currency: prior.currency, idempotentReplay: true,
      });
    }
    if (!shop.isActive || !this.hasShopAccess(shop.organizationId)) {
      return res.status(402).json({ error: 'This shop is not currently accepting orders.' });
    }
    const shopId = shop.id;

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

    const copyDiscountRules = this.pricingRepo.getCopyDiscountRules(shopId);
    const bulkDiscountRule = this.pricingRepo.getBulkDiscountRule(shopId) || undefined;
    const optionError = this.validatePortalOptions(portalSettings, safeFiles);
    if (optionError) return res.status(422).json({ error: optionError });
    let serverQuote;
    try {
      serverQuote = calculateQuote(
        { shopId, files: safeFiles.map((file: any) => ({ fileName: String(file.fileName || ''), pageCount: Number(file.pageCount), options: file.options })) },
        rateRules,
        copyDiscountRules,
        bulkDiscountRule,
        0,
        shop.currency || 'INR'
      );
    } catch (error: any) {
      return res.status(422).json({ error: error.message || 'Unable to price this order.' });
    }
    if (!Number.isSafeInteger(serverQuote.totalPaise) || serverQuote.totalPaise < 1 || serverQuote.totalPaise > 5_000_000_000) {
      return res.status(422).json({ error: 'The calculated order total is outside the supported range.' });
    }
    if (normalizedPaymentMethod === 'ONLINE_RAZORPAY' && serverQuote.totalPaise < 100) {
      return res.status(422).json({
        code: 'RAZORPAY_MINIMUM_AMOUNT',
        error: 'Razorpay checkout requires an order total of at least ₹1.00. Choose cash at collection if available, or adjust the order.',
        minimumAmountPaise: 100,
        cashOnCollectionAvailable: shop.acceptCashOnCollection,
      });
    }
    // New customer clients submit a complete quote and must confirm changes or expiry.
    // Legacy/API clients without a quote ID remain safe because the order always uses
    // this server-calculated quote and amount, never client-supplied totals.
    if (submittedQuote?.quoteId && submittedQuote?.expiresAt) {
      const quoteExpiry = typeof submittedQuote.expiresAt === 'string' ? Date.parse(submittedQuote.expiresAt) : Number.NaN;
      if (!Number.isSafeInteger(submittedQuote.totalPaise) || !submittedQuote.quoteVersion || !Number.isFinite(quoteExpiry)) {
        return res.status(422).json({ error: 'Get an exact shop quote before submitting this order.' });
      }
      if (quoteExpiry <= Date.now()) {
        return res.status(409).json({ error: 'This quote has expired. Review the updated total before submitting again.', currentQuote: serverQuote });
      }
      if (submittedQuote.shopId !== shopId || submittedQuote.currency !== serverQuote.currency ||
          submittedQuote.totalPaise !== serverQuote.totalPaise || submittedQuote.quoteVersion !== serverQuote.quoteVersion) {
        return res.status(409).json({ error: 'The shop price changed. Review the updated total before submitting again.', currentQuote: serverQuote });
      }
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
      pricingSnapshot: { acceptedAt: now, quote: serverQuote, rateRules, copyDiscountRules, bulkDiscountRule },
      files: orderFiles,
      createdAt: now,
      updatedAt: now,
    };

    let idempotentResult: ReturnType<OrderRepository['createOrderIdempotently']>;
    try {
      idempotentResult = this.orderRepo.createOrderIdempotently(order, idempotencyKey, requestHash);
    } catch (error: any) {
      if (error?.code === 'PRINT_FILE_UNAVAILABLE') {
        return res.status(409).json({ error: 'A print file has expired or is being cleaned up. Upload the file again and submit the order.' });
      }
      throw error;
    }
    if (idempotentResult.conflict) {
      return res.status(409).json({ error: 'This Idempotency-Key was already used for a different order. Start a new order to submit changed details.' });
    }
    if (idempotentResult.replayed) {
      const prior = this.orderRepo.getOrderById(idempotentResult.orderId);
      if (!prior) return res.status(503).json({ error: 'The original order record is temporarily unavailable.' });
      return res.status(200).json({
        success: true, orderId: prior.id, orderNumber: prior.orderNumber, tokenNumber: prior.tokenNumber,
        status: prior.status, paymentStatus: prior.paymentStatus,
        totalAmountPaise: prior.totalAmountPaise, currency: prior.currency, idempotentReplay: true,
      });
    }

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

  private validatePortalOptions(settings: ReturnType<ShopRepository['getPortalSettings']>, files: any[]): string | null {
    const { allowedOptions } = settings;
    for (const file of files) {
      const options = file?.options || {};
      if (!allowedOptions.colorModes.includes(options.colorMode) || (options.colorMode === 'mixed' && (!allowedOptions.colorModes.includes('bw') || !allowedOptions.colorModes.includes('color')))) return 'This color mode is no longer offered by the shop. Update your print settings.';
      if (!allowedOptions.duplexModes.includes(options.duplexMode)) return 'This print style is no longer offered by the shop. Update your print settings.';
      if (!allowedOptions.paperSizes.includes(options.paperSize)) return 'This paper size is no longer offered by the shop. Update your print settings.';
      if (!allowedOptions.pageSelection && options.pageRange && !['all', ''].includes(String(options.pageRange).trim().toLowerCase())) return 'Custom page selection is not available at this shop.';
    }
    return null;
  }

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
