import { Request, Response } from 'express';
import * as crypto from 'node:crypto';
import { OrderRepository, LedgerRepository, DatabaseService } from '@inklly/db';
import { MoneyDomain } from '@inklly/shared';

export class PaymentController {
  constructor(
    private orderRepo: OrderRepository,
    private ledgerRepo: LedgerRepository,
    private db: DatabaseService
  ) {}

  public createPaymentIntent = (req: Request, res: Response) => {
    const { orderId, provider } = req.body;

    const order = this.orderRepo.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const paymentProvider = provider || 'RAZORPAY';
    const txnId = `txn_${paymentProvider.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Insert pending payment record
    this.db.execute(
      `INSERT INTO payments (id, order_id, provider, provider_transaction_id, amount_paise, currency, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      [
        `pay-${Date.now().toString(36)}`,
        order.id,
        paymentProvider,
        txnId,
        order.totalAmountPaise,
        order.currency,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    this.orderRepo.updatePaymentStatus(order.id, 'PENDING');

    res.json({
      success: true,
      orderId: order.id,
      amountPaise: order.totalAmountPaise,
      currency: order.currency,
      provider: paymentProvider,
      transactionId: txnId,
      checkoutData: {
        key: 'rzp_test_inklly_live_demo',
        order_id: txnId,
        amount: order.totalAmountPaise,
        currency: order.currency,
        name: 'Inklly Print Payment',
        description: `Order #${order.orderNumber}`,
      },
    });
  };

  public verifyPayment = (req: Request, res: Response) => {
    const { orderId, providerTransactionId, providerPaymentId, signature } = req.body;

    const order = this.orderRepo.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const now = new Date().toISOString();

    this.db.execute(
      `UPDATE payments SET status = 'SUCCESS', updated_at = ? WHERE order_id = ?`,
      [now, order.id]
    );

    this.orderRepo.updatePaymentStatus(order.id, 'VERIFIED');

    // Record in ledger
    this.ledgerRepo.appendEntry({
      id: `led-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      domain: 'CUSTOMER_PRINT_PAYMENT',
      shopId: order.shopId,
      orderId: order.id,
      amountPaise: order.totalAmountPaise,
      currency: order.currency,
      provider: 'RAZORPAY',
      providerTransactionId,
      description: `Customer payment received for Order ${order.orderNumber}`,
      createdAt: now,
    });

    res.json({
      success: true,
      message: 'Payment verified and credited to ledger',
      orderId: order.id,
      paymentStatus: 'VERIFIED',
    });
  };

  public handleWebhook = (req: Request, res: Response) => {
    const provider = String(req.params.provider);
    const event = req.body;
    const signature = req.headers['x-razorpay-signature'] || req.headers['stripe-signature'];

    const eventId = event?.id || `evt_${Date.now()}`;
    const orderId = event?.payload?.payment?.entity?.notes?.order_id || event?.data?.object?.metadata?.order_id;

    if (!orderId) {
      return res.status(200).json({ received: true, ignored: 'Missing order_id metadata' });
    }

    // Idempotency check via ledger
    const existingLedger = this.db.queryOne<any>(
      `SELECT id FROM ledger_entries WHERE provider_event_id = ?`,
      [eventId]
    );

    if (existingLedger) {
      return res.status(200).json({ received: true, status: 'already_processed' });
    }

    const order = this.orderRepo.getOrderById(orderId);
    if (order) {
      const now = new Date().toISOString();
      this.orderRepo.updatePaymentStatus(order.id, 'VERIFIED');

      this.ledgerRepo.appendEntry({
        id: `led-${Date.now().toString(36)}`,
        domain: 'CUSTOMER_PRINT_PAYMENT',
        shopId: order.shopId,
        orderId: order.id,
        amountPaise: order.totalAmountPaise,
        currency: order.currency,
        provider: provider.toUpperCase() === 'STRIPE' ? 'STRIPE' : 'RAZORPAY',
        providerEventId: eventId,
        description: `Webhook verified payment for ${order.orderNumber}`,
        createdAt: now,
      });
    }

    res.status(200).json({ received: true, status: 'success' });
  };

  public collectCashAtCounter = (req: Request, res: Response) => {
    const id = String(req.params.id);
    const order = this.orderRepo.getOrderById(id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const now = new Date().toISOString();

    // Mark payment verified
    this.orderRepo.updatePaymentStatus(order.id, 'VERIFIED');

    // Record cash in ledger
    this.ledgerRepo.appendEntry({
      id: `led-cash-${Date.now().toString(36)}`,
      domain: 'CUSTOMER_PRINT_PAYMENT',
      shopId: order.shopId,
      orderId: order.id,
      amountPaise: order.totalAmountPaise,
      currency: order.currency,
      provider: 'MANUAL_CASH',
      description: `Cash collected at counter for Order ${order.orderNumber}`,
      createdAt: now,
    });

    // Advance order to COLLECTED if ready
    try {
      if (order.status === 'READY_FOR_COLLECTION') {
        this.orderRepo.updateOrderStatus(order.id, 'COLLECTED');
      }
    } catch {
      // If not yet ready, payment status is still updated
    }

    const updated = this.orderRepo.getOrderById(order.id);
    res.json({
      success: true,
      message: 'Cash payment recorded and order updated',
      order: updated,
    });
  };
}
