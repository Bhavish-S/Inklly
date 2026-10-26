import { Request, Response } from 'express';
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

    res.json({
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
      shopId,
      customerName,
      customerPhone,
      customerEmail,
      paymentMethod,
      quote,
      files,
    } = req.body;

    if (!shopId || !files || files.length === 0 || !quote) {
      return res.status(400).json({ error: 'Incomplete order submission payload' });
    }

    const shop = this.shopRepo.getShopById(shopId);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

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
      storageKey: `uploads/${shopId}/${orderId}/${f.fileName}`,
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
      totalAmountPaise: quote.totalPaise,
      currency: shop.currency,
      quoteVersion: quote.quoteVersion,
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
