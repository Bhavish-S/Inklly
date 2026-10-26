import { Request, Response } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DatabaseService, OrderRepository, PricingRepository, ShopRepository } from '@inklly/db';
import { calculateQuote, PriceQuoteRequest, OrderStatus, PaymentStatus } from '@inklly/shared';

export class PortalController {
  constructor(
    private shopRepo: ShopRepository,
    private pricingRepo: PricingRepository,
    private orderRepo: OrderRepository
  ) {}

  public getShopByCode = (req: Request, res: Response) => {
    const shop_code = String(req.params.shop_code);
    const shop = this.shopRepo.getShopByCode(shop_code);

    if (!shop || !shop.isActive) {
      return res.status(404).json({ error: 'Shop not found or currently offline' });
    }

    const rates = this.pricingRepo.getRateRules(shop.id);
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

  public submitOrder = (req: Request, res: Response) => {
    const {
      shopId: rawShopId,
      shopCode,
      customerName,
      customerPhone,
      customerEmail,
      paymentMethod,
      quote,
      files,
    } = req.body;

    const shop =
      (rawShopId ? this.shopRepo.getShopById(rawShopId) || this.shopRepo.getShopByCode(rawShopId) : null) ||
      (shopCode ? this.shopRepo.getShopByCode(shopCode) : null);

    if (!shop || !files || files.length === 0 || !quote) {
      return res.status(400).json({ error: 'Incomplete order submission payload' });
    }
    const shopId = shop.id;

    const orderId = `ord-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const orderNumber = `INK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;
    const now = new Date().toISOString();

    const orderFiles = files.map((f: any, idx: number) => ({
      id: `file-${orderId}-${idx + 1}`,
      orderId,
      fileName: f.fileName,
      fileSizeBytes: f.fileSizeBytes || 1024 * 1024,
      mimeType: f.mimeType || 'application/pdf',
      storageKey: f.storageKey || f.fileUrl || `uploads/${shopId}/${orderId}/${f.fileName}`,
      pageCount: f.pageCount,
      printOptions: f.options,
      lineSubtotalPaise: f.subtotalPaise || 200,
    }));

    const initialStatus: OrderStatus = paymentMethod === 'CASH_ON_COLLECTION' ? 'AWAITING_REVIEW' : 'AWAITING_PAYMENT';
    const initialPaymentStatus: PaymentStatus = paymentMethod === 'CASH_ON_COLLECTION' ? 'PENDING' : 'NOT_STARTED';

    const order = {
      id: orderId,
      shopId,
      orderNumber,
      customerName: customerName || 'Counter Customer',
      customerPhone,
      customerEmail,
      channel: 'QR_PORTAL' as const,
      status: initialStatus,
      paymentStatus: initialPaymentStatus,
      paymentMethod: paymentMethod || 'CASH_ON_COLLECTION',
      totalAmountPaise: quote.totalPaise || 200,
      currency: shop.currency || 'INR',
      quoteVersion: quote.quoteVersion || quote.version || 'v1.0',
      files: orderFiles,
      createdAt: now,
      updatedAt: now,
    };

    this.orderRepo.createOrder(order);

    res.status(201).json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmountPaise: order.totalAmountPaise,
      currency: order.currency,
    });
  };

  public uploadDocument = (req: Request, res: Response) => {
    try {
      const { fileName, fileData, mimeType, shopId, pageCount } = req.body;
      if (!fileName || !fileData) {
        return res.status(400).json({ error: 'fileName and fileData (Base64) are required' });
      }

      const safeShopId = (shopId || 'common').replace(/[^a-zA-Z0-9_-]/g, '_');
      const sanitizedName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const uploadDir = path.join(process.cwd(), 'uploads', safeShopId);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const uniquePrefix = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const savedFileName = `${uniquePrefix}-${sanitizedName}`;
      const filePath = path.join(uploadDir, savedFileName);

      // Strip Base64 header if present (e.g. "data:application/pdf;base64,")
      const base64Content = fileData.includes('base64,') ? fileData.split('base64,')[1] : fileData;
      const buffer = Buffer.from(base64Content, 'base64');
      fs.writeFileSync(filePath, buffer);

      const fileUrl = `/uploads/${safeShopId}/${savedFileName}`;
      const detectedPages = pageCount || 1;

      res.status(201).json({
        success: true,
        fileName,
        savedFileName,
        fileUrl,
        storageKey: `uploads/${safeShopId}/${savedFileName}`,
        fileSizeBytes: buffer.length,
        mimeType: mimeType || 'application/pdf',
        pageCount: detectedPages,
      });
    } catch (err: any) {
      console.error('[Upload Error]', err);
      res.status(500).json({ error: 'Failed to process document upload', message: err.message });
    }
  };

  public getOrderStatus = (req: Request, res: Response) => {
    const id = String(req.params.id);
    const order = this.orderRepo.getOrderById(id) || this.orderRepo.getOrderByNumber(id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
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
