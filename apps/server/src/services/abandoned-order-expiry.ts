import * as crypto from 'node:crypto';
import { DatabaseService } from '@inklly/db';

/** Online orders whose checkout was never opened are cancelled after this long. */
export const ABANDONED_CHECKOUT_MINUTES = 120;

/**
 * Cancels online-payment orders that never reached Razorpay.
 *
 * Only orders with no payment record at all are expired: creating a Razorpay
 * checkout always writes a payment row first, so these orders cannot have
 * moved money. Orders with a pending Razorpay payment are left for the normal
 * verify/webhook reconciliation, because a captured payment may still arrive.
 */
export function expireAbandonedOnlineOrders(db: DatabaseService, now = new Date()): number {
  const cutoff = new Date(now.getTime() - ABANDONED_CHECKOUT_MINUTES * 60 * 1000).toISOString();
  const candidates = db.query<{ id: string; shop_id: string }>(
    `SELECT o.id, o.shop_id FROM orders o
     WHERE o.status = 'AWAITING_PAYMENT' AND o.payment_method = 'ONLINE_RAZORPAY' AND o.created_at < ?
       AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id)
     ORDER BY o.created_at ASC LIMIT 200`,
    [cutoff]
  );
  let expired = 0;
  for (const candidate of candidates) {
    const changed = db.transaction(() => {
      const updated = db.queryOne<{ id: string }>(
        `UPDATE orders SET status = 'CANCELLED', payment_status = 'EXPIRED', updated_at = ?
         WHERE id = ? AND status = 'AWAITING_PAYMENT' AND payment_method = 'ONLINE_RAZORPAY'
           AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = orders.id)
         RETURNING id`,
        [now.toISOString(), candidate.id]
      );
      if (!updated) return false;
      db.execute(
        `INSERT INTO audit_events (id, actor_user_id, actor_role, shop_id, organization_id, action, target_type, target_id, outcome, ip_address, details, created_at)
         VALUES (?, NULL, 'SYSTEM', ?, NULL, 'ORDER_CHECKOUT_ABANDONED', 'ORDER', ?, 'SUCCESS', NULL, ?, ?)`,
        [crypto.randomUUID(), candidate.shop_id, candidate.id, JSON.stringify({ minutes: ABANDONED_CHECKOUT_MINUTES, moneyMoved: false }), now.toISOString()]
      );
      return true;
    });
    if (changed) expired++;
  }
  return expired;
}
