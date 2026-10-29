import { Request, Response } from 'express';
import { AgentRepository, OrderRepository, LedgerRepository, DatabaseService } from '@inklly/db';
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

      new AgentRepository(this.db).enqueueWebhookEvent(row.organization_id, 'payment.succeeded', `payment.succeeded:${paymentId}`, {
        paymentId,
        orderId: row.order_id,
        amountPaise: Number(row.amount_paise),
        currency: row.currency || 'INR',
        provider: 'RAZORPAY',
        capturedAt: new Date().toISOString(),
      });

      return true;
  }

  private refreshOrderRefundStatusWithinTransaction(orderId: string): string {
    const order = this.db.queryOne<any>(`SELECT total_amount_paise FROM orders WHERE id = ?`, [orderId]);
    if (!order) throw new Error('Order for refund reconciliation is missing.');
    const totals = this.db.queryOne<any>(
      `SELECT COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN amount_paise ELSE 0 END), 0) AS completed,
              COALESCE(SUM(CASE WHEN status IN ('REQUESTED', 'PROCESSING') THEN amount_paise ELSE 0 END), 0) AS pending
       FROM refunds WHERE order_id = ?`, [orderId]
    );
    const completed = Number(totals?.completed || 0);
    const pending = Number(totals?.pending || 0);
    const status = pending > 0 ? 'REFUND_PENDING'
      : completed >= Number(order.total_amount_paise) ? 'REFUNDED'
        : completed > 0 ? 'PARTIALLY_REFUNDED' : 'VERIFIED';
    this.db.execute(`UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?`, [status, new Date().toISOString(), orderId]);
    return status;
  }

  private completeRazorpayRefundWithinTransaction(refundId: string, providerRefund: any, eventId: string, actor?: { userId?: string; role?: string; ip?: string }): 'COMPLETED' | 'DUPLICATE' | 'CONFLICT' {
    const row = this.db.queryOne<any>(
      `SELECT r.*, o.shop_id, s.organization_id, o.order_number, o.total_amount_paise AS order_total,
              p.provider AS payment_provider, p.provider_event_id AS razorpay_payment_id, p.amount_paise AS payment_amount
       FROM refunds r JOIN orders o ON o.id = r.order_id JOIN shops s ON s.id = o.shop_id
       JOIN payments p ON p.id = r.payment_id WHERE r.id = ?`, [refundId]
    );
    if (!row || row.payment_provider !== 'RAZORPAY' || providerRefund.payment_id !== row.razorpay_payment_id ||
        providerRefund.amount !== Number(row.amount_paise) || typeof providerRefund.id !== 'string') return 'CONFLICT';
    if (row.status === 'COMPLETED') return row.provider_refund_id === providerRefund.id ? 'DUPLICATE' : 'CONFLICT';
    if (!['REQUESTED', 'PROCESSING', 'FAILED'].includes(row.status)) return 'CONFLICT';

    const priorLedger = this.db.queryOne<any>(
      `SELECT id, order_id, amount_paise FROM ledger_entries WHERE provider = 'RAZORPAY' AND provider_transaction_id = ?`,
      [providerRefund.id]
    );
    if (priorLedger && (priorLedger.order_id !== row.order_id || Number(priorLedger.amount_paise) !== -Number(row.amount_paise))) {
      throw new Error('Provider refund ID is already attached to a different ledger entry.');
    }
    if (!priorLedger) {
      this.ledgerRepo.appendEntry({
        id: `led-refund-${crypto.randomUUID()}`, domain: 'CUSTOMER_PRINT_PAYMENT',
        organizationId: row.organization_id, shopId: row.shop_id, orderId: row.order_id,
        amountPaise: -Number(row.amount_paise), currency: row.currency, provider: 'RAZORPAY',
        providerTransactionId: providerRefund.id, providerEventId: eventId || providerRefund.id,
        description: `Razorpay refund for Order ${row.order_number}`, createdAt: new Date().toISOString(),
        metadata: { paymentId: row.razorpay_payment_id, refundId: row.id },
      });
    }
    this.db.execute(
      `UPDATE refunds SET status = 'COMPLETED', provider_refund_id = ?, provider_event_id = ?, processed_at = ?, failure_reason = NULL
       WHERE id = ? AND status IN ('REQUESTED', 'PROCESSING', 'FAILED')`,
      [providerRefund.id, eventId || providerRefund.id, new Date().toISOString(), refundId]
    );
    this.refreshOrderRefundStatusWithinTransaction(row.order_id);
    this.db.execute(
      `INSERT INTO audit_events (id, actor_user_id, actor_role, shop_id, organization_id, action, target_type, target_id, outcome, ip_address, details, created_at)
       VALUES (?, ?, ?, ?, ?, 'REFUND_PROVIDER_CONFIRMED', 'REFUND', ?, 'SUCCESS', ?, ?, ?)`,
      [crypto.randomUUID(), actor?.userId || null, actor?.role || 'RAZORPAY_WEBHOOK', row.shop_id, row.organization_id, refundId, actor?.ip || null,
        JSON.stringify({ provider: 'RAZORPAY', providerRefundId: providerRefund.id, amountPaise: Number(row.amount_paise), moneyMoved: true }), new Date().toISOString()]
    );
    return 'COMPLETED';
  }

  private failRefundWithinTransaction(refundId: string, failureReason: string, eventId: string, actor?: { userId?: string; role?: string; ip?: string }): boolean {
    const row = this.db.queryOne<any>(
      `SELECT r.status, r.order_id, r.amount_paise, o.shop_id, s.organization_id
       FROM refunds r JOIN orders o ON o.id = r.order_id JOIN shops s ON s.id = o.shop_id WHERE r.id = ?`, [refundId]
    );
    if (!row || !['REQUESTED', 'PROCESSING'].includes(row.status)) return false;
    this.db.execute(
      `UPDATE refunds SET status = 'FAILED', failure_reason = ?, provider_event_id = ?, processed_at = ? WHERE id = ? AND status IN ('REQUESTED', 'PROCESSING')`,
      [failureReason.slice(0, 500), eventId || null, new Date().toISOString(), refundId]
    );
    this.refreshOrderRefundStatusWithinTransaction(row.order_id);
    this.db.execute(
      `INSERT INTO audit_events (id, actor_user_id, actor_role, shop_id, organization_id, action, target_type, target_id, outcome, ip_address, details, created_at)
       VALUES (?, ?, ?, ?, ?, 'REFUND_PROVIDER_FAILED', 'REFUND', ?, 'SUCCESS', ?, ?, ?)`,
      [crypto.randomUUID(), actor?.userId || null, actor?.role || 'RAZORPAY_WEBHOOK', row.shop_id, row.organization_id, refundId, actor?.ip || null,
        JSON.stringify({ providerEventId: eventId || null, amountPaise: Number(row.amount_paise), moneyMoved: false, reason: failureReason.slice(0, 500) }), new Date().toISOString()]
    );
    return true;
  }

  private applyRazorpayRefundWebhook(shopId: string, eventType: string, refundEntity: any, eventKey: string, ip?: string): { status: number; body: Record<string, unknown> } {
    if (!['refund.created', 'refund.processed', 'refund.failed'].includes(eventType)) {
      return { status: 200, body: { received: true, ignored: true } };
    }
    if (!refundEntity || typeof refundEntity.id !== 'string' || typeof refundEntity.payment_id !== 'string' ||
        !Number.isSafeInteger(refundEntity.amount) || refundEntity.amount < 1 ||
        !['pending', 'processed', 'failed'].includes(refundEntity.status)) {
      return { status: 400, body: { error: 'Webhook did not contain a valid Razorpay refund.' } };
    }
    const requestedId = typeof refundEntity.notes?.inklly_refund_id === 'string'
      ? refundEntity.notes.inklly_refund_id
      : typeof refundEntity.receipt === 'string' ? refundEntity.receipt : '';
    const row = this.db.queryOne<any>(
      `SELECT r.id, r.order_id, r.payment_id, r.amount_paise, r.status, r.provider_refund_id,
              p.provider, p.provider_event_id AS razorpay_payment_id
       FROM refunds r JOIN orders o ON o.id = r.order_id JOIN payments p ON p.id = r.payment_id
       WHERE o.shop_id = ? AND p.provider = 'RAZORPAY' AND p.provider_event_id = ?
         AND ((? <> '' AND r.id = ?) OR r.provider_refund_id = ?)
       ORDER BY r.requested_at DESC LIMIT 1`,
      [shopId, refundEntity.payment_id, requestedId, requestedId, refundEntity.id]
    );
    if (!row || Number(row.amount_paise) !== refundEntity.amount ||
        (row.provider_refund_id && row.provider_refund_id !== refundEntity.id)) {
      return { status: 409, body: { error: 'Refund does not match a pending refund request for this shop.' } };
    }
    try {
      const result = this.db.transaction(() => {
        const inserted = this.db.queryOne<any>(
          `INSERT INTO razorpay_webhook_events (id, shop_id, event_type, created_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO NOTHING RETURNING id`,
          [eventKey, shopId, eventType, new Date().toISOString()]
        );
        if (!inserted) return 'DUPLICATE';
        if (eventType === 'refund.processed') {
          const outcome = this.completeRazorpayRefundWithinTransaction(row.id, refundEntity, eventKey, { role: 'RAZORPAY_WEBHOOK', ip });
          if (outcome === 'CONFLICT') throw new Error('Refund provider confirmation conflicts with the reserved request.');
          return outcome;
        }
        if (eventType === 'refund.failed' || refundEntity.status === 'failed') {
          this.db.execute(`UPDATE refunds SET provider_refund_id = ? WHERE id = ? AND status IN ('REQUESTED', 'PROCESSING')`, [refundEntity.id, row.id]);
          if (!this.failRefundWithinTransaction(row.id, 'Razorpay reported that this refund could not be processed.', eventKey, { role: 'RAZORPAY_WEBHOOK', ip })) {
            const current = this.db.queryOne<any>(`SELECT status FROM refunds WHERE id = ?`, [row.id]);
            // Provider events can arrive out of order. Do not undo a refund
            // already confirmed as processed when a delayed failure arrives.
            if (current?.status === 'COMPLETED') return 'DUPLICATE';
            if (current?.status !== 'FAILED') throw new Error('Refund state no longer accepts the provider failure event.');
          }
          return 'FAILED';
        }
        this.db.execute(
          `UPDATE refunds SET status = 'PROCESSING', provider_refund_id = ? WHERE id = ? AND status IN ('REQUESTED', 'PROCESSING')`,
          [refundEntity.id, row.id]
        );
        this.refreshOrderRefundStatusWithinTransaction(row.order_id);
        return 'PROCESSING';
      });
      return { status: 200, body: { received: true, duplicate: result === 'DUPLICATE', refundStatus: result === 'DUPLICATE' ? row.status : result } };
    } catch (error) {
      console.error('[Razorpay refund webhook processing]', error instanceof Error ? error.message : 'unknown error');
      return { status: 500, body: { error: 'Refund webhook could not be applied. Razorpay may retry delivery.' } };
    }
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
    if (eventType.startsWith('refund.')) {
      const refundEntity = event?.payload?.refund?.entity;
      const providerEventId = req.header('x-razorpay-event-id') || (typeof event?.id === 'string' ? event.id : `${eventType}:${refundEntity?.id || ''}`);
      if (!providerEventId || providerEventId.endsWith(':')) return res.status(400).json({ error: 'Refund webhook event identifier is missing.' });
      const eventKey = `${shopId}:${providerEventId}`;
      const result = this.applyRazorpayRefundWebhook(shopId, eventType, refundEntity, eventKey, req.ip);
      return res.status(result.status).json(result.body);
    }
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
    let outcome: 'NOT_FOUND' | 'FORBIDDEN' | 'WRONG_METHOD' | 'ALREADY_RECORDED' | 'NOT_READY' | 'RECORDED' | 'IDEMPOTENT_RETRY';
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
          req.user?.role !== 'PLATFORM_OWNER' &&
          (!effectiveShopId || order.shopId !== effectiveShopId)
        ) return 'FORBIDDEN';
        if (order.paymentMethod !== 'CASH_ON_COLLECTION') return 'WRONG_METHOD';
        if (order.paymentStatus === 'VERIFIED') {
          const existingCashPayment = this.db.queryOne<any>(
            `SELECT id FROM payments WHERE order_id = ? AND provider = 'MANUAL_CASH' AND status = 'VERIFIED'`,
            [order.id]
          );
          if (!existingCashPayment) return 'ALREADY_RECORDED';
          if (order.status === 'READY_FOR_COLLECTION') {
            // Repair a legacy/incomplete state safely; this transition is still
            // inside the same transaction and is idempotent on subsequent calls.
            this.orderRepo.updateOrderStatus(order.id, 'COLLECTED');
          } else if (order.status !== 'COLLECTED') {
            return 'NOT_READY';
          }
          return 'IDEMPOTENT_RETRY';
        }
        if (order.status !== 'READY_FOR_COLLECTION') return 'NOT_READY';

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
        const organization = this.db.queryOne<any>(`SELECT organization_id FROM shops WHERE id = ?`, [order.shopId]);
        if (organization) {
          new AgentRepository(this.db).enqueueWebhookEvent(organization.organization_id, 'payment.succeeded', `payment.succeeded:${paymentId}`, {
            paymentId,
            orderId: order.id,
            amountPaise: order.totalAmountPaise,
            currency: order.currency,
            provider: 'MANUAL_CASH',
            capturedAt: now,
          });
        }
        this.orderRepo.updateOrderStatus(order.id, 'COLLECTED');
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
    if (outcome === 'NOT_READY') return res.status(409).json({ error: 'Cash can be recorded only when the order is ready for collection.' });

    const updated = this.orderRepo.getOrderById(id);
    return res.json({
      success: true,
      message: outcome === 'IDEMPOTENT_RETRY' ? 'Cash payment was already recorded for this order.' : 'Cash payment recorded and order updated',
      idempotent: outcome === 'IDEMPOTENT_RETRY',
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
      req.user?.role !== 'PLATFORM_OWNER' &&
      (!effectiveShopId || order.shopId !== effectiveShopId)
    ) {
      return res.status(403).json({ error: 'Order is not available to this shop.' });
    }

    const { amountPaise, reason } = req.body;
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 1 || amountPaise > order.totalAmountPaise) {
      return res.status(400).json({ error: 'Refund amount must be between 1 and the order total in paise.' });
    }
    if (!reason || typeof reason !== 'string' || reason.length < 3 || reason.length > 500) {
      return res.status(400).json({ error: 'Refund reason is required (3-500 characters).' });
    }

    const refundId = `ref-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    let refundRequest: 'CREATED' | 'EXCEEDS_REMAINING' | 'NO_VERIFIED_PAYMENT' | 'BELOW_PROVIDER_MINIMUM';
    try {
      refundRequest = this.db.transaction(() => {
        const payment = this.db.queryOne<any>(
          `SELECT id, provider, amount_paise FROM payments WHERE order_id = ? AND status = 'VERIFIED' ORDER BY created_at DESC LIMIT 1`,
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

        if (payment.provider === 'RAZORPAY' && amountPaise < 100) return 'BELOW_PROVIDER_MINIMUM';
        if (!['RAZORPAY', 'MANUAL_CASH'].includes(payment.provider)) return 'NO_VERIFIED_PAYMENT';
        const existingRefunds = this.db.queryOne<any>(
          `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM refunds WHERE payment_id = ? AND status IN ('REQUESTED', 'PROCESSING', 'COMPLETED')`,
          [payment.id]
        );
        const alreadyRefunded = Number(existingRefunds?.total || 0);
        if (amountPaise + alreadyRefunded > Number(payment.amount_paise)) return 'EXCEEDS_REMAINING';

        this.db.execute(
          `INSERT INTO refunds (id, order_id, payment_id, amount_paise, currency, status, reason, requested_by, requested_at)
           VALUES (?, ?, ?, ?, ?, 'REQUESTED', ?, ?, ?)`,
          [refundId, orderId, payment.id, amountPaise, order.currency, reason, req.user?.userId || 'system', now]
        );
        this.refreshOrderRefundStatusWithinTransaction(orderId);
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
    if (refundRequest === 'BELOW_PROVIDER_MINIMUM') {
      return res.status(400).json({ error: 'Razorpay requires refunds of at least ₹1.00. Adjust the amount or resolve the customer request offline.' });
    }

    res.status(201).json({
      success: true,
      refundId,
      status: 'REQUESTED',
      amountPaise,
      currency: order.currency,
      message: 'Refund request recorded. An authorized shop owner must review and process it.',
    });
  };

  public listRefunds = (req: Request, res: Response) => {
    const effectiveShopId = req.user?.shopId;
    const isPlatform = req.user?.role === 'PLATFORM_OWNER';

    let sql = `SELECT r.*, o.order_number, o.customer_name, o.total_amount_paise as order_total, p.provider AS payment_provider
               FROM refunds r JOIN orders o ON o.id = r.order_id JOIN payments p ON p.id = r.payment_id`;
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
      paymentProvider: r.payment_provider,
      reason: r.reason,
      providerRefundId: r.provider_refund_id,
      requestedAt: r.requested_at,
      processedAt: r.processed_at,
      failureReason: r.failure_reason,
    })));
  };

  public processRefund = async (req: Request, res: Response) => {
    const refundId = String(req.params.id);
    const { action, reason } = req.body; // action: APPROVE | REJECT | RECORD_OFFLINE

    const refund = this.db.queryOne<any>(
      `SELECT r.*, o.shop_id, o.order_number, o.total_amount_paise as order_total, o.currency, o.payment_method, s.organization_id,
              p.provider AS payment_provider, p.provider_event_id AS razorpay_payment_id
       FROM refunds r JOIN orders o ON o.id = r.order_id JOIN shops s ON s.id = o.shop_id JOIN payments p ON p.id = r.payment_id WHERE r.id = ?`,
      [refundId]
    );
    if (!refund) {
      return res.status(404).json({ error: 'Refund not found' });
    }

    const effectiveShopId = req.user?.shopId;
    const isPlatform = req.user?.role === 'PLATFORM_OWNER';
    if (!isPlatform && (!effectiveShopId || refund.shop_id !== effectiveShopId)) {
      return res.status(403).json({ error: 'Refund is not available to this shop.' });
    }
    if (!['APPROVE', 'REJECT', 'RECORD_OFFLINE'].includes(action)) {
      return res.status(400).json({ error: "Action must be 'APPROVE', 'REJECT', or 'RECORD_OFFLINE'." });
    }
    if (action === 'REJECT' && refund.status !== 'REQUESTED') {
      return res.status(409).json({ error: `Only a new request can be rejected; this refund is ${refund.status.toLowerCase()}.` });
    }
    if (action === 'APPROVE' && !['REQUESTED', 'PROCESSING'].includes(refund.status)) {
      return res.status(409).json({ error: `Refund is already ${refund.status.toLowerCase()}.` });
    }
    if (action === 'RECORD_OFFLINE' && refund.status !== 'REQUESTED') {
      return res.status(409).json({ error: `Only a new request can be recorded as returned cash; this refund is ${refund.status.toLowerCase()}.` });
    }
    if (action === 'REJECT') {
      if (typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 500) {
        return res.status(400).json({ error: 'A rejection reason between 3 and 500 characters is required.' });
      }
      const now = new Date().toISOString();
      try {
        const rejected = this.db.transaction(() => {
          const current = this.db.queryOne<any>(`SELECT status FROM refunds WHERE id = ? AND order_id = ?`, [refundId, refund.order_id]);
          if (!current || current.status !== 'REQUESTED') return false;
          const locked = this.db.queryOne<any>(`UPDATE refunds SET status = status WHERE id = ? AND status = 'REQUESTED' RETURNING id`, [refundId]);
          if (!locked) return false;
          this.db.execute(`UPDATE refunds SET status = 'FAILED', failure_reason = ?, processed_at = ? WHERE id = ? AND status = 'REQUESTED'`, [reason.trim(), now, refundId]);
          this.refreshOrderRefundStatusWithinTransaction(refund.order_id);
          this.db.execute(
            `INSERT INTO audit_events (id, actor_user_id, actor_role, shop_id, organization_id, action, target_type, target_id, outcome, ip_address, details, created_at)
             VALUES (?, ?, ?, ?, ?, 'REFUND_REQUEST_REJECTED', 'REFUND', ?, 'SUCCESS', ?, ?, ?)`,
            [crypto.randomUUID(), req.user?.userId || null, req.user?.role || null, refund.shop_id, req.user?.organizationId || null, refundId, req.ip, JSON.stringify({ amountPaise: refund.amount_paise, reason: reason.trim(), moneyMoved: false }), now]
          );
          return true;
        });
        if (!rejected) return res.status(409).json({ error: 'Refund is no longer pending.' });
        return res.json({ success: true, refundId, status: 'FAILED', moneyMoved: false, message: 'Refund request rejected. No payment or ledger entry was changed.' });
      } catch (error) {
        console.error('[Refund rejection]', error);
        return res.status(503).json({ error: 'Refund request could not be rejected. Refresh its status and retry.' });
      }
    }
    if (action === 'RECORD_OFFLINE') {
      const note = typeof reason === 'string' ? reason.trim() : '';
      if (refund.payment_provider !== 'MANUAL_CASH') return res.status(409).json({ error: 'Only cash-on-collection refunds can be recorded as returned cash.' });
      if (req.body?.cashReturned !== true || note.length < 10 || note.length > 500) {
        return res.status(400).json({ error: 'Confirm the cash was physically returned and provide a 10–500 character note.' });
      }
      try {
        const result = this.db.transaction(() => {
          const locked = this.db.queryOne<any>(`UPDATE refunds SET status = status WHERE id = ? AND status = 'REQUESTED' RETURNING id`, [refundId]);
          if (!locked) return false;
          const ledgerId = `manual-cash-refund:${refundId}`;
          const existing = this.db.queryOne<any>(`SELECT id, order_id, amount_paise FROM ledger_entries WHERE provider = 'MANUAL_CASH' AND provider_transaction_id = ?`, [ledgerId]);
          if (existing && (existing.order_id !== refund.order_id || Number(existing.amount_paise) !== -Number(refund.amount_paise))) {
            throw new Error('Manual refund identity already exists with different financial data.');
          }
          if (!existing) {
            this.ledgerRepo.appendEntry({
              id: `led-${crypto.randomUUID()}`, domain: 'CUSTOMER_PRINT_PAYMENT',
              organizationId: refund.organization_id, shopId: refund.shop_id, orderId: refund.order_id,
              amountPaise: -Number(refund.amount_paise), currency: refund.currency, provider: 'MANUAL_CASH',
              providerTransactionId: ledgerId, providerEventId: ledgerId,
              description: `Cash refund for Order ${refund.order_number}`, createdAt: new Date().toISOString(),
              metadata: { refundId, cashReturned: true },
            });
          }
          const now = new Date().toISOString();
          this.db.execute(`UPDATE refunds SET status = 'COMPLETED', provider_event_id = ?, processed_at = ?, failure_reason = NULL WHERE id = ? AND status = 'REQUESTED'`, [ledgerId, now, refundId]);
          this.refreshOrderRefundStatusWithinTransaction(refund.order_id);
          this.db.execute(
            `INSERT INTO audit_events (id, actor_user_id, actor_role, shop_id, organization_id, action, target_type, target_id, outcome, ip_address, details, created_at)
             VALUES (?, ?, ?, ?, ?, 'REFUND_CASH_RETURN_RECORDED', 'REFUND', ?, 'SUCCESS', ?, ?, ?)`,
            [crypto.randomUUID(), req.user?.userId || null, req.user?.role || null, refund.shop_id, refund.organization_id, refundId, req.ip,
              JSON.stringify({ amountPaise: Number(refund.amount_paise), cashReturned: true, reason: note }), now]
          );
          return true;
        });
        if (!result) return res.status(409).json({ error: 'Refund is no longer pending.' });
        return res.json({ success: true, refundId, status: 'COMPLETED', moneyMoved: true, provider: 'MANUAL_CASH' });
      } catch (error) {
        console.error('[Manual cash refund]', error instanceof Error ? error.message : 'unknown error');
        return res.status(503).json({ error: 'Cash refund could not be recorded safely. Refresh its status and reconcile the cash drawer.' });
      }
    }

    if (refund.payment_provider !== 'RAZORPAY') {
      return res.status(409).json({ error: 'This payment was collected in cash. Use the explicit returned-cash confirmation action; no Razorpay request was sent.' });
    }
    const credentials = this.paymentCredentials.getRazorpayCredentials(refund.shop_id);
    if (!credentials || !credentials.webhookSecret || !refund.razorpay_payment_id) {
      return res.status(503).json({ error: 'Razorpay API credentials and the refund webhook secret are required. The refund request remains pending.' });
    }

    let processingRefund: any;
    try {
      processingRefund = this.db.transaction(() => {
        const locked = this.db.queryOne<any>(`UPDATE refunds SET status = status WHERE id = ? AND status IN ('REQUESTED', 'PROCESSING') RETURNING status`, [refundId]);
        if (!locked) return null;
        this.db.execute(`UPDATE refunds SET status = 'PROCESSING' WHERE id = ? AND status = 'REQUESTED'`, [refundId]);
        return this.db.queryOne<any>(`SELECT status, provider_refund_id FROM refunds WHERE id = ?`, [refundId]);
      });
      if (!processingRefund) return res.status(409).json({ error: 'Refund is no longer available for processing.' });
    } catch {
      return res.status(503).json({ error: 'Refund could not be reserved for provider processing. No request was sent.' });
    }

    const auth = `Basic ${Buffer.from(`${credentials.keyId}:${credentials.secret}`).toString('base64')}`;
    let providerRefund: any;
    try {
      const isRetryWithId = typeof processingRefund.provider_refund_id === 'string' && processingRefund.provider_refund_id.length > 0;
      const response = isRetryWithId
        ? await fetch(`https://api.razorpay.com/v1/refunds/${encodeURIComponent(processingRefund.provider_refund_id)}`, {
            headers: { Authorization: auth }, signal: AbortSignal.timeout(12000),
          })
        : await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(refund.razorpay_payment_id)}/refund`, {
            method: 'POST',
            headers: {
              Authorization: auth, 'Content-Type': 'application/json', 'X-Refund-Idempotency': refundId,
            },
            body: JSON.stringify({ amount: Number(refund.amount_paise), speed: 'normal', receipt: refundId, notes: { inklly_refund_id: refundId } }),
            signal: AbortSignal.timeout(12000),
          });
      providerRefund = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409 || response.status >= 500) {
          return res.status(503).json({ code: 'REFUND_RECONCILIATION_REQUIRED', error: 'Razorpay has not confirmed the refund outcome. The same refund key is retained; retry or check the Razorpay dashboard before taking another action.' });
        }
        this.db.transaction(() => this.failRefundWithinTransaction(refundId, `Razorpay rejected the refund request (HTTP ${response.status}).`, '', { userId: req.user?.userId, role: req.user?.role, ip: req.ip }));
        return res.status(502).json({ error: 'Razorpay rejected this refund request. No refund ledger entry was recorded.' });
      }
    } catch {
      return res.status(503).json({ code: 'REFUND_RECONCILIATION_REQUIRED', error: 'Razorpay response was unavailable. The stable refund key is retained; retrying uses the same request and cannot create a second refund.' });
    }

    if (!providerRefund || typeof providerRefund.id !== 'string' || providerRefund.payment_id !== refund.razorpay_payment_id ||
        Number(providerRefund.amount) !== Number(refund.amount_paise) || !['pending', 'processed', 'failed'].includes(providerRefund.status)) {
      return res.status(503).json({ code: 'REFUND_RECONCILIATION_REQUIRED', error: 'Razorpay returned an incomplete or mismatched refund record. No ledger entry was written; reconcile this request with the provider.' });
    }
    try {
      if (providerRefund.status === 'processed') {
        const outcome = this.db.transaction(() => this.completeRazorpayRefundWithinTransaction(refundId, providerRefund, providerRefund.id, { userId: req.user?.userId, role: req.user?.role, ip: req.ip }));
        if (outcome === 'CONFLICT') return res.status(409).json({ error: 'Razorpay refund does not match this reserved request.' });
        return res.json({ success: true, refundId, providerRefundId: providerRefund.id, status: 'COMPLETED', amountPaise: Number(refund.amount_paise) });
      }
      if (providerRefund.status === 'failed') {
        this.db.transaction(() => this.failRefundWithinTransaction(refundId, 'Razorpay reported that this refund could not be processed.', providerRefund.id, { userId: req.user?.userId, role: req.user?.role, ip: req.ip }));
        return res.status(502).json({ error: 'Razorpay could not process the refund. No refund ledger entry was recorded.' });
      }
      this.db.transaction(() => {
        this.db.execute(`UPDATE refunds SET status = 'PROCESSING', provider_refund_id = ? WHERE id = ? AND status = 'PROCESSING'`, [providerRefund.id, refundId]);
        this.refreshOrderRefundStatusWithinTransaction(refund.order_id);
      });
      return res.status(202).json({ success: true, refundId, providerRefundId: providerRefund.id, status: 'PROCESSING', amountPaise: Number(refund.amount_paise) });
    } catch (error) {
      console.error('[Razorpay refund persistence]', error instanceof Error ? error.message : 'unknown error');
      return res.status(503).json({ code: 'REFUND_RECONCILIATION_REQUIRED', error: 'Razorpay accepted the request but Inklly could not confirm the final status. The request remains reserved; retry to reconcile it.' });
    }
  };
}
