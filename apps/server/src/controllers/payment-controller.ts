import { Request, Response } from 'express';
import { OrderRepository, LedgerRepository, DatabaseService } from '@inklly/db';
import * as crypto from 'node:crypto';
import { ShopPaymentCredentialsService } from '../services/shop-payment-credentials';
import { OrderStatus } from '@inklly/shared';

export class PaymentController {
  constructor(
    private orderRepo: OrderRepository,
    private ledgerRepo: LedgerRepository,
    private db: DatabaseService,
    private paymentCredentials: ShopPaymentCredentialsService
  ) {}

  private markCapturedPayment(row: any, paymentId: string): boolean {
    return this.db.transaction(() => this.markCapturedPaymentWithinTransaction(row, paymentId));
  }

  private markCapturedPaymentWithinTransaction(row: any, paymentId: string): boolean {
      const current = this.db.queryOne<any>(
        `SELECT p.status, p.provider_event_id, o.status AS order_status
         FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id = ?`,
        [row.id]
      );
      if (!current) return false;
      if (current.status === 'VERIFIED') return current.provider_event_id === paymentId;
      if (current.status !== 'PENDING' || current.order_status !== 'AWAITING_PAYMENT') return false;

      const updated = this.db.queryOne<any>(
        `UPDATE payments SET provider_event_id = ?, status = 'VERIFIED', updated_at = ? WHERE id = ? AND status = 'PENDING' RETURNING id`,
        [paymentId, new Date().toISOString(), row.id]
      );
      if (!updated) return false;

      this.orderRepo.updatePaymentStatus(row.order_id, 'VERIFIED');
      this.orderRepo.updateOrderStatus(row.order_id, 'AWAITING_REVIEW');
      const existingLedger = this.db.queryOne<any>(
        `SELECT id FROM ledger_entries WHERE provider = 'RAZORPAY' AND provider_transaction_id = ?`,
        [paymentId]
      );
      if (!existingLedger) {
        this.ledgerRepo.appendEntry({
          id: `led-rzp-${crypto.randomUUID()}`,
          domain: 'CUSTOMER_PRINT_PAYMENT',
          organizationId: row.organization_id,
          shopId: row.shop_id,
          orderId: row.order_id,
          amountPaise: row.amount_paise,
          currency: row.currency,
          provider: 'RAZORPAY',
          providerTransactionId: paymentId,
          providerEventId: paymentId,
          description: `Razorpay payment received for Order ${row.order_number}`,
          createdAt: new Date().toISOString(),
        });
      }

      return true;
  }

  public createPaymentIntent = async (req: Request, res: Response) => {
    let reservation: { orderId: string; paymentId: string } | null = null;
    const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId : '';
    const order = this.orderRepo.getOrderById(orderId);
    if (!order || order.paymentMethod !== 'ONLINE_RAZORPAY' || order.status !== 'AWAITING_PAYMENT') {
      return res.status(404).json({ error: 'Payable Razorpay order not found.' });
    }
    if (order.currency !== 'INR' || !Number.isSafeInteger(order.totalAmountPaise) || order.totalAmountPaise < 100) {
      return res.status(422).json({ error: 'This order has an invalid Razorpay amount or currency.' });
    }

    try {
      const credentials = this.paymentCredentials.getRazorpayCredentials(order.shopId);
      if (!credentials || !credentials.webhookSecret) return res.status(503).json({ error: 'This shop has not completed Razorpay and webhook setup.' });

      const pending = this.db.queryOne<any>(
        `SELECT id, provider_transaction_id, status, created_at FROM payments WHERE order_id = ? AND provider = 'RAZORPAY' AND status IN ('CREATING', 'PENDING') ORDER BY created_at DESC LIMIT 1`,
        [order.id]
      );
      if (pending?.provider_transaction_id) {
        return res.json({
          success: true,
          razorpayOrderId: pending.provider_transaction_id,
          keyId: credentials.keyId,
          amount: order.totalAmountPaise,
          currency: order.currency,
        });
      }

      if (pending?.status === 'CREATING') {
        if (Date.now() - Date.parse(pending.created_at) < 2 * 60 * 1000) {
          return res.status(409).json({ error: 'Payment setup is already in progress. Please retry in a moment.' });
        }
        this.db.transaction(() => {
          this.db.execute(`UPDATE payments SET status = 'FAILED', updated_at = ? WHERE id = ? AND status = 'CREATING'`, [new Date().toISOString(), pending.id]);
          this.db.execute(`DELETE FROM razorpay_checkout_claims WHERE order_id = ? AND payment_id = ?`, [order.id, pending.id]);
        });
      }

      const paymentId = crypto.randomUUID();
      let claim: any = null;
      this.db.transaction(() => {
        claim = this.db.queryOne<any>(
          `INSERT INTO razorpay_checkout_claims (order_id, payment_id, created_at) VALUES (?, ?, ?)
           ON CONFLICT(order_id) DO NOTHING RETURNING payment_id`,
          [order.id, paymentId, new Date().toISOString()]
        );
        if (claim) {
          this.db.execute(
            `INSERT INTO payments (id, order_id, provider, provider_transaction_id, amount_paise, currency, status, created_at, updated_at)
             VALUES (?, ?, 'RAZORPAY', NULL, ?, ?, 'CREATING', ?, ?)`,
            [paymentId, order.id, order.totalAmountPaise, order.currency, new Date().toISOString(), new Date().toISOString()]
          );
        }
      });
      if (!claim) return res.status(409).json({ error: 'Payment setup is already in progress. Please retry in a moment.' });
      reservation = { orderId: order.id, paymentId };

      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.secret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: order.totalAmountPaise,
          currency: order.currency,
          receipt: order.id,
          notes: { inklly_order_id: order.id, shop_id: order.shopId },
        }),
        signal: AbortSignal.timeout(10000),
      });
      const result = await response.json() as any;
      if (!response.ok || typeof result.id !== 'string' || result.amount !== order.totalAmountPaise || result.currency !== order.currency) {
        this.db.transaction(() => {
          this.db.execute(`UPDATE payments SET status = 'FAILED', updated_at = ? WHERE id = ? AND status = 'CREATING'`, [new Date().toISOString(), paymentId]);
          this.db.execute(`DELETE FROM razorpay_checkout_claims WHERE order_id = ? AND payment_id = ?`, [order.id, paymentId]);
        });
        reservation = null;
        console.error('[Razorpay order creation failed]', response.status, result?.error?.code || 'invalid response');
        return res.status(502).json({ error: 'Razorpay could not create a payment order. Check this shop’s account settings.' });
      }

      this.db.transaction(() => {
        this.db.execute(`UPDATE payments SET provider_transaction_id = ?, status = 'PENDING', updated_at = ? WHERE id = ? AND status = 'CREATING'`,
          [result.id, new Date().toISOString(), paymentId]);
      });
      reservation = null;
      res.json({
        success: true,
        razorpayOrderId: result.id,
        keyId: credentials.keyId,
        amount: order.totalAmountPaise,
        currency: order.currency,
      });
    } catch (error) {
      if (reservation) {
        try {
          this.db.transaction(() => {
            this.db.execute(`UPDATE payments SET status = 'FAILED', updated_at = ? WHERE id = ? AND status = 'CREATING'`, [new Date().toISOString(), reservation!.paymentId]);
            this.db.execute(`DELETE FROM razorpay_checkout_claims WHERE order_id = ? AND payment_id = ?`, [reservation!.orderId, reservation!.paymentId]);
          });
        } catch (cleanupError) {
          console.error('[Razorpay reservation cleanup]', cleanupError);
        }
      }
      console.error('[Razorpay order creation]', error);
      res.status(503).json({ error: 'Razorpay is temporarily unavailable for this shop.' });
    }
  };

  public verifyPayment = async (req: Request, res: Response) => {
    const razorpayOrderId = typeof req.body?.razorpay_order_id === 'string' ? req.body.razorpay_order_id : '';
    const razorpayPaymentId = typeof req.body?.razorpay_payment_id === 'string' ? req.body.razorpay_payment_id : '';
    const signature = typeof req.body?.razorpay_signature === 'string' ? req.body.razorpay_signature : '';
    const row = this.db.queryOne<any>(
      `SELECT p.*, o.shop_id, o.status AS order_status, o.total_amount_paise AS order_amount,
              o.currency AS order_currency, o.order_number, s.organization_id
       FROM payments p JOIN orders o ON o.id = p.order_id JOIN shops s ON s.id = o.shop_id
       WHERE p.provider = 'RAZORPAY' AND p.provider_transaction_id = ?`,
      [razorpayOrderId]
    );
    if (!row) {
      return res.status(404).json({ error: 'Pending payment order not found.' });
    }

    try {
      const credentials = this.paymentCredentials.getRazorpayCredentials(row.shop_id);
      if (!credentials) return res.status(503).json({ error: 'This shop has not configured Razorpay.' });
      const expected = crypto.createHmac('sha256', credentials.secret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest();
      let supplied: Buffer;
      try { supplied = Buffer.from(signature, 'hex'); } catch { supplied = Buffer.alloc(0); }
      if (!razorpayPaymentId || supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
        return res.status(400).json({ error: 'Razorpay payment signature is invalid.' });
      }
      if (row.status === 'VERIFIED' && row.provider_event_id === razorpayPaymentId) {
        return res.json({
          success: true,
          order: { orderId: row.order_id, status: row.order_status, paymentStatus: 'VERIFIED' },
        });
      }
      if (row.order_status !== 'AWAITING_PAYMENT') {
        return res.status(409).json({ error: 'This order is no longer awaiting payment.' });
      }

      const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.secret}`).toString('base64')}` },
        signal: AbortSignal.timeout(10000),
      });
      const payment = await paymentResponse.json() as any;
      if (!paymentResponse.ok || payment.order_id !== razorpayOrderId || payment.status !== 'captured' ||
          payment.amount !== row.order_amount || payment.currency !== row.order_currency) {
        return res.status(409).json({ error: 'Razorpay has not confirmed a captured payment for this order.' });
      }

      if (!this.markCapturedPayment(row, razorpayPaymentId)) {
        return res.status(409).json({ error: 'This captured payment was already applied to another state.' });
      }
      const updated = this.orderRepo.getOrderById(row.order_id);
      res.json({ success: true, order: { orderId: row.order_id, status: updated?.status, paymentStatus: updated?.paymentStatus } });
    } catch (error) {
      console.error('[Razorpay payment verification]', error);
      res.status(503).json({ error: 'Payment verification is temporarily unavailable. The order remains pending.' });
    }
  };

  public handleWebhook = (req: Request, res: Response) => {
    const shopId = String(req.params.shopId || '');
    const rawBody = (req as any).rawBody as Buffer | undefined;
    const signature = req.header('x-razorpay-signature') || '';
    if (!shopId || !rawBody?.length || !/^[a-f0-9]{64}$/i.test(signature)) {
      return res.status(400).json({ error: 'Invalid Razorpay webhook request.' });
    }

    const credentials = this.paymentCredentials.getRazorpayCredentials(shopId);
    if (!credentials?.webhookSecret) return res.status(404).json({ error: 'Razorpay webhook is not configured for this shop.' });
    const expected = crypto.createHmac('sha256', credentials.webhookSecret).update(rawBody).digest();
    const supplied = Buffer.from(signature, 'hex');
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
      return res.status(401).json({ error: 'Razorpay webhook signature is invalid.' });
    }

    let event: any;
    try { event = JSON.parse(rawBody.toString('utf8')); } catch { return res.status(400).json({ error: 'Malformed webhook payload.' }); }
    const eventType = typeof event?.event === 'string' ? event.event : '';
    if (!['payment.captured', 'order.paid'].includes(eventType)) return res.status(200).json({ received: true, ignored: true });
    const payment = event?.payload?.payment?.entity;
    if (!payment || payment.status !== 'captured' || typeof payment.id !== 'string' ||
        typeof payment.order_id !== 'string' || !Number.isSafeInteger(payment.amount) || typeof payment.currency !== 'string') {
      return res.status(400).json({ error: 'Webhook did not contain a captured payment.' });
    }

    const row = this.db.queryOne<any>(
      `SELECT p.*, o.shop_id, o.status AS order_status, o.total_amount_paise AS order_amount,
              o.currency AS order_currency, o.order_number, s.organization_id
       FROM payments p JOIN orders o ON o.id = p.order_id JOIN shops s ON s.id = o.shop_id
       WHERE p.provider = 'RAZORPAY' AND p.provider_transaction_id = ? AND o.shop_id = ?`,
      [payment.order_id, shopId]
    );
    if (!row || payment.amount !== row.order_amount || payment.currency !== row.order_currency) {
      return res.status(409).json({ error: 'Payment does not match a pending order for this shop.' });
    }
    const eventKey = `${shopId}:${String(req.header('x-razorpay-event-id') || `${eventType}:${payment.id}`)}`;
    try {
      const existing = this.db.queryOne<any>(`SELECT id FROM razorpay_webhook_events WHERE id = ?`, [eventKey]);
      if (existing) return res.status(200).json({ received: true, duplicate: true });
      const applied = this.db.transaction(() => {
        const inserted = this.db.queryOne<any>(
          `INSERT INTO razorpay_webhook_events (id, shop_id, event_type, created_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO NOTHING RETURNING id`,
          [eventKey, shopId, eventType, new Date().toISOString()]
        );
        if (!inserted) return true;
        const captured = this.markCapturedPaymentWithinTransaction(row, payment.id);
        if (!captured) throw new Error('Payment state no longer accepts this event');
        return true;
      });
      return res.status(applied ? 200 : 409).json({ received: applied });
    } catch (error) {
      console.error('[Razorpay webhook processing]', error);
      return res.status(500).json({ error: 'Webhook could not be applied. Razorpay may retry delivery.' });
    }
  };

  public collectCashAtCounter = (req: Request, res: Response) => {
    const id = String(req.params.id);
    let outcome: 'NOT_FOUND' | 'FORBIDDEN' | 'WRONG_METHOD' | 'ALREADY_RECORDED' | 'RECORDED';
    try {
      outcome = this.db.transaction(() => {
        // Serialize cash collection on the order row, then re-read all state
        // inside the lock before creating payment and ledger records.
        const locked = this.db.queryOne<any>(
          `UPDATE orders SET updated_at = updated_at WHERE id = ? RETURNING id`,
          [id]
        );
        if (!locked) return 'NOT_FOUND';

        const order = this.orderRepo.getOrderById(id);
        if (!order) return 'NOT_FOUND';
        const effectiveShopId = req.user?.shopId;
        if (
          req.user?.role !== 'PLATFORM_OWNER' && req.user?.role !== 'PLATFORM_ADMIN' &&
          (!effectiveShopId || order.shopId !== effectiveShopId)
        ) return 'FORBIDDEN';
        if (order.paymentMethod !== 'CASH_ON_COLLECTION') return 'WRONG_METHOD';
        if (order.paymentStatus === 'VERIFIED') return 'ALREADY_RECORDED';

        const now = new Date().toISOString();
        const paymentId = `pay-cash-${order.id}`;
        this.db.execute(
          `INSERT INTO payments (id, order_id, provider, provider_transaction_id, provider_event_id, amount_paise, currency, status, created_at, updated_at)
           VALUES (?, ?, 'MANUAL_CASH', ?, ?, ?, ?, 'VERIFIED', ?, ?)`,
          [paymentId, order.id, paymentId, paymentId, order.totalAmountPaise, order.currency, now, now]
        );
        this.orderRepo.updatePaymentStatus(order.id, 'VERIFIED');
        this.ledgerRepo.appendEntry({
          id: `led-cash-${crypto.randomUUID()}`,
          domain: 'CUSTOMER_PRINT_PAYMENT',
          shopId: order.shopId,
          orderId: order.id,
          amountPaise: order.totalAmountPaise,
          currency: order.currency,
          provider: 'MANUAL_CASH',
          providerTransactionId: paymentId,
          description: `Cash collected at counter for Order ${order.orderNumber}`,
          createdAt: now,
        });
        if (order.status === 'READY_FOR_COLLECTION') {
          this.orderRepo.updateOrderStatus(order.id, 'COLLECTED');
        }
        return 'RECORDED';
      });
    } catch (error) {
      console.error('[Cash collection]', error);
      return res.status(503).json({ error: 'Cash collection was not recorded. Refresh the order before retrying.' });
    }

    if (outcome === 'NOT_FOUND') return res.status(404).json({ error: 'Order not found' });
    if (outcome === 'FORBIDDEN') return res.status(403).json({ error: 'Order is not available to this shop.' });
    if (outcome === 'WRONG_METHOD') return res.status(409).json({ error: 'Cash collection is only available for cash-on-collection orders.' });
    if (outcome === 'ALREADY_RECORDED') return res.status(409).json({ error: 'Payment for this order has already been recorded.' });

    const updated = this.orderRepo.getOrderById(id);
    return res.json({
      success: true,
      message: 'Cash payment recorded and order updated',
      order: updated,
    });
  };

  public createRefund = async (req: Request, res: Response) => {
    const orderId = String(req.params.id);
    const order = this.orderRepo.getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const effectiveShopId = req.user?.shopId;
    if (
      req.user?.role !== 'PLATFORM_OWNER' && req.user?.role !== 'PLATFORM_ADMIN' &&
      (!effectiveShopId || order.shopId !== effectiveShopId)
    ) {
      return res.status(403).json({ error: 'Order is not available to this shop.' });
    }

    if (order.paymentStatus !== 'VERIFIED') {
      return res.status(409).json({ error: 'Only verified payments can be refunded.' });
    }

    const { amountPaise, reason } = req.body;
    if (!Number.isInteger(amountPaise) || amountPaise < 1 || amountPaise > order.totalAmountPaise) {
      return res.status(400).json({ error: 'Refund amount must be between 1 and the order total.' });
    }
    if (!reason || typeof reason !== 'string' || reason.length < 3 || reason.length > 500) {
      return res.status(400).json({ error: 'Refund reason is required (3-500 characters).' });
    }

    const refundId = `ref-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    let refundRequest: 'CREATED' | 'EXCEEDS_REMAINING' | 'NO_VERIFIED_PAYMENT';
    try {
      refundRequest = this.db.transaction(() => {
        const payment = this.db.queryOne<any>(
          `SELECT id FROM payments WHERE order_id = ? AND status = 'VERIFIED' ORDER BY created_at DESC LIMIT 1`,
          [orderId]
        );
        if (!payment) return 'NO_VERIFIED_PAYMENT';

        // Serialize refund reservations on the verified payment row. PostgreSQL
        // holds this row lock until commit; SQLite serializes the write transaction.
        // The remaining-balance read and reservation insert must share that lock.
        const lockedPayment = this.db.queryOne<any>(
          `UPDATE payments SET updated_at = updated_at WHERE id = ? AND status = 'VERIFIED' RETURNING id`,
          [payment.id]
        );
        if (!lockedPayment) return 'NO_VERIFIED_PAYMENT';

        const existingRefunds = this.db.queryOne<any>(
          `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM refunds WHERE order_id = ? AND status IN ('REQUESTED', 'PROCESSING', 'COMPLETED')`,
          [orderId]
        );
        const alreadyRefunded = Number(existingRefunds?.total || 0);
        if (amountPaise + alreadyRefunded > order.totalAmountPaise) return 'EXCEEDS_REMAINING';

        this.db.execute(
          `INSERT INTO refunds (id, order_id, payment_id, amount_paise, currency, status, reason, requested_by, requested_at)
           VALUES (?, ?, ?, ?, ?, 'REQUESTED', ?, ?, ?)`,
          [refundId, orderId, payment.id, amountPaise, order.currency, reason, req.user?.userId || 'system', now]
        );
        return 'CREATED';
      });
    } catch (error) {
      console.error('[Refund reservation]', error);
      return res.status(503).json({ error: 'Refund request could not be reserved. No refund was created; retry after refreshing the order.' });
    }

    if (refundRequest === 'NO_VERIFIED_PAYMENT') {
      return res.status(409).json({ error: 'No verified payment record found for this order.' });
    }
    if (refundRequest === 'EXCEEDS_REMAINING') {
      return res.status(409).json({ error: 'Refund amount exceeds the remaining refundable balance.' });
    }

    res.status(201).json({
      success: true,
      refundId,
      status: 'REQUESTED',
      amountPaise,
      currency: order.currency,
      message: 'Refund request recorded. Processing is unavailable until a verified refund workflow is configured.',
    });
  };

  public listRefunds = (req: Request, res: Response) => {
    const effectiveShopId = req.user?.shopId;
    const isPlatform = req.user?.role === 'PLATFORM_OWNER' || req.user?.role === 'PLATFORM_ADMIN';

    let sql = `SELECT r.*, o.order_number, o.customer_name, o.total_amount_paise as order_total
               FROM refunds r JOIN orders o ON o.id = r.order_id`;
    const params: any[] = [];

    if (!isPlatform && !effectiveShopId) {
      return res.status(403).json({ error: 'A shop context is required to view refunds.' });
    }
    if (!isPlatform) {
      sql += ` WHERE o.shop_id = ?`;
      params.push(effectiveShopId);
    }

    sql += ` ORDER BY r.requested_at DESC`;

    const rows = this.db.query<any>(sql, params);
    res.json(rows.map((r) => ({
      id: r.id,
      orderId: r.order_id,
      orderNumber: r.order_number,
      customerName: r.customer_name,
      amountPaise: r.amount_paise,
      currency: r.currency,
      status: r.status,
      reason: r.reason,
      providerRefundId: r.provider_refund_id,
      requestedAt: r.requested_at,
      processedAt: r.processed_at,
      failureReason: r.failure_reason,
    })));
  };

  public processRefund = async (req: Request, res: Response) => {
    const refundId = String(req.params.id);
    const { action, reason } = req.body; // action: 'APPROVE' | 'REJECT'

    const refund = this.db.queryOne<any>(
      `SELECT r.*, o.shop_id, o.order_number, o.total_amount_paise as order_total, o.currency, o.payment_method
       FROM refunds r JOIN orders o ON o.id = r.order_id WHERE r.id = ?`,
      [refundId]
    );
    if (!refund) {
      return res.status(404).json({ error: 'Refund not found' });
    }

    const effectiveShopId = req.user?.shopId;
    const isPlatform = req.user?.role === 'PLATFORM_OWNER' || req.user?.role === 'PLATFORM_ADMIN';
    if (!isPlatform && (!effectiveShopId || refund.shop_id !== effectiveShopId)) {
      return res.status(403).json({ error: 'Refund is not available to this shop.' });
    }
    if (refund.status !== 'REQUESTED') {
      return res.status(409).json({ error: `Refund is already ${refund.status.toLowerCase()}.` });
    }

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return res.status(400).json({ error: "Action must be 'APPROVE' or 'REJECT'." });
    }
    return res.status(503).json({ error: 'Refund processing is not configured. The request remains pending and no ledger entry was created.' });
  };
}
