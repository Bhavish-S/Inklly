import { DatabaseService } from '@inklly/db';
import { getCounterSettings } from './counter-sales';

/**
 * Direct UPI: the customer pays the shop's own UPI ID from any UPI app
 * (PhonePe, Google Pay, Paytm, BHIM, CRED, bank apps). The amount is fixed in
 * the payment link, so the customer never types it. Inklly never holds the
 * money. Because a plain UPI link gives no callback, the shop confirms the
 * credit in its UPI app at the counter before handover (Counter → UPI).
 */
export interface UpiDirectDetails {
  upiId: string;
  payeeName: string;
  amount: string;
  note: string;
  uri: string;
}

export function upiDirectAvailable(db: DatabaseService, shopId: string): boolean {
  if (!isUpiDirectEnabledOnPlatform(db)) return false;
  return Boolean(getCounterSettings(db, shopId).upiId);
}

/** Admin can switch the feature off platform-wide (platform_settings.feature_flags.upi_direct = false). */
export function isUpiDirectEnabledOnPlatform(db: DatabaseService): boolean {
  try {
    const row = db.queryOne<any>(`SELECT setting_value FROM platform_settings WHERE setting_key = ?`, ['feature_flags']);
    if (!row) return true;
    const flags = JSON.parse(String(row.setting_value));
    return flags?.upi_direct !== false;
  } catch {
    return true;
  }
}

export function buildUpiDetails(
  db: DatabaseService,
  shop: { id: string; name: string },
  order: { totalAmountPaise: number; tokenNumber?: string | null; orderNumber: string }
): UpiDirectDetails | null {
  const settings = getCounterSettings(db, shop.id);
  if (!settings.upiId) return null;
  const payeeName = (settings.upiPayeeName || shop.name).replace(/[^\p{L}\p{N} .&'-]/gu, '').slice(0, 50) || 'Print shop';
  const amount = (order.totalAmountPaise / 100).toFixed(2);
  const token = String(order.tokenNumber || '').replace(/^T-/, '');
  const note = `Inklly print ${token ? `token ${token}` : order.orderNumber}`.slice(0, 50);
  // Keep to the parameters every UPI app accepts for person and business IDs.
  const params = new URLSearchParams({ pa: settings.upiId, pn: payeeName, am: amount, cu: 'INR', tn: note });
  return { upiId: settings.upiId, payeeName, amount, note, uri: `upi://pay?${params.toString().replace(/\+/g, '%20')}` };
}

const UTR = /^[A-Za-z0-9]{6,35}$/;
const PAYER_APPS = new Set(['phonepe', 'gpay', 'paytm', 'bhim', 'cred', 'amazonpay', 'navi', 'supermoney', 'kotak', 'other']);

/** The customer tells the shop they have paid; the shop still checks its UPI app. */
export function recordUpiClaim(db: DatabaseService, orderId: string, shopId: string, reference: unknown, app: unknown): { upiReference: string | null; payerApp: string | null } {
  const upiReference = typeof reference === 'string' && reference.trim() ? reference.trim().replace(/\s+/g, '') : null;
  if (upiReference && !UTR.test(upiReference)) throw new Error('The UPI reference (UTR) should be 6–35 letters or numbers.');
  const payerApp = typeof app === 'string' && PAYER_APPS.has(app.toLowerCase()) ? app.toLowerCase() : null;
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO order_upi_claims (order_id, shop_id, upi_reference, payer_app, claimed_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(order_id) DO UPDATE SET upi_reference = COALESCE(excluded.upi_reference, order_upi_claims.upi_reference), payer_app = COALESCE(excluded.payer_app, order_upi_claims.payer_app), claimed_at = excluded.claimed_at`,
    [orderId, shopId, upiReference, payerApp, now]
  );
  return { upiReference, payerApp };
}

export function getUpiClaim(db: DatabaseService, orderId: string): { upiReference: string | null; payerApp: string | null; claimedAt: string } | null {
  const row = db.queryOne<any>(`SELECT upi_reference, payer_app, claimed_at FROM order_upi_claims WHERE order_id = ?`, [orderId]);
  return row ? { upiReference: row.upi_reference || null, payerApp: row.payer_app || null, claimedAt: row.claimed_at } : null;
}
