import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { DatabaseService } from '@inklly/db';

type EncryptedValue = { iv: string; tag: string; ciphertext: string };

function encryptionKey(): Buffer {
  const encoded = (process.env.RAZORPAY_CREDENTIALS_ENCRYPTION_KEY || '').trim();
  let key: Buffer;
  try {
    key = Buffer.from(encoded, 'base64');
  } catch {
    throw new Error('RAZORPAY_CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
  if (key.length !== 32 || key.toString('base64') !== encoded) {
    throw new Error('RAZORPAY_CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
  return key;
}

function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const value: EncryptedValue = {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
  return JSON.stringify(value);
}

export function decryptShopRazorpaySecret(encrypted: string): string {
  const value = JSON.parse(encrypted) as EncryptedValue;
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(value.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export class ShopPaymentCredentialsService {
  constructor(private readonly db: DatabaseService) {
    // Keep these additive DDL statements safe for the existing Render/Supabase database.
    this.db.execute(`CREATE TABLE IF NOT EXISTS shop_payment_credentials (
      shop_id TEXT PRIMARY KEY, provider TEXT NOT NULL, key_id TEXT NOT NULL,
      encrypted_secret TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
    this.db.execute(`CREATE TABLE IF NOT EXISTS shop_payment_webhook_secrets (
      shop_id TEXT PRIMARY KEY, encrypted_secret TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
    this.db.execute(`CREATE TABLE IF NOT EXISTS razorpay_webhook_events (
      id TEXT PRIMARY KEY, shop_id TEXT NOT NULL, event_type TEXT NOT NULL, created_at TEXT NOT NULL
    )`);
    this.db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_razorpay_event_shop_id ON razorpay_webhook_events(shop_id, id)`);
    this.db.execute(`CREATE TABLE IF NOT EXISTS razorpay_checkout_claims (
      order_id TEXT PRIMARY KEY, payment_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
    )`);
  }

  private hasInFlightPaymentsOrRefunds(shopId: string): boolean {
    const row = this.db.queryOne<any>(
      `SELECT p.id FROM payments p JOIN orders o ON o.id = p.order_id
       WHERE o.shop_id = ? AND p.provider = 'RAZORPAY' AND p.status = 'PENDING'
       UNION ALL
       SELECT r.id FROM refunds r JOIN orders o ON o.id = r.order_id JOIN payments p ON p.id = r.payment_id
       WHERE o.shop_id = ? AND p.provider = 'RAZORPAY' AND r.status IN ('REQUESTED', 'PROCESSING')
       LIMIT 1`,
      [shopId, shopId]
    );
    return Boolean(row);
  }

  getRazorpayStatus(shopId: string) {
    const row = this.db.queryOne<any>(
      `SELECT key_id, updated_at FROM shop_payment_credentials WHERE shop_id = ? AND provider = 'RAZORPAY'`,
      [shopId]
    );
    const webhook = this.db.queryOne<any>(`SELECT updated_at FROM shop_payment_webhook_secrets WHERE shop_id = ?`, [shopId]);
    return row
      ? { configured: true, webhookConfigured: Boolean(webhook), keyIdPreview: `${row.key_id.slice(0, 8)}…`, updatedAt: row.updated_at }
      : { configured: false, webhookConfigured: Boolean(webhook), keyIdPreview: null, updatedAt: null };
  }

  getRazorpayCredentials(shopId: string): { keyId: string; secret: string; webhookSecret: string | null } | null {
    const row = this.db.queryOne<any>(
      `SELECT key_id, encrypted_secret FROM shop_payment_credentials WHERE shop_id = ? AND provider = 'RAZORPAY'`,
      [shopId]
    );
    if (!row) return null;
    const webhook = this.db.queryOne<any>(`SELECT encrypted_secret FROM shop_payment_webhook_secrets WHERE shop_id = ?`, [shopId]);
    return {
      keyId: row.key_id,
      secret: decryptShopRazorpaySecret(row.encrypted_secret),
      webhookSecret: webhook ? decryptShopRazorpaySecret(webhook.encrypted_secret) : null,
    };
  }

  saveRazorpay(shopId: string, keyId: string, secret: string, webhookSecret: string): void {
    if (this.hasInFlightPaymentsOrRefunds(shopId)) {
      throw new Error('Resolve pending Razorpay payments and refunds before changing this shop’s credentials.');
    }
    const encryptedSecret = encryptSecret(secret);
    const encryptedWebhookSecret = encryptSecret(webhookSecret);
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db.execute(
        `INSERT INTO shop_payment_credentials (shop_id, provider, key_id, encrypted_secret, updated_at)
         VALUES (?, 'RAZORPAY', ?, ?, ?)
         ON CONFLICT(shop_id) DO UPDATE SET provider = 'RAZORPAY', key_id = excluded.key_id,
           encrypted_secret = excluded.encrypted_secret, updated_at = excluded.updated_at`,
        [shopId, keyId, encryptedSecret, now]
      );
      this.db.execute(
        `INSERT INTO shop_payment_webhook_secrets (shop_id, encrypted_secret, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(shop_id) DO UPDATE SET encrypted_secret = excluded.encrypted_secret, updated_at = excluded.updated_at`,
        [shopId, encryptedWebhookSecret, now]
      );
    });
  }

  removeRazorpay(shopId: string): void {
    if (this.hasInFlightPaymentsOrRefunds(shopId)) {
      throw new Error('Resolve pending Razorpay payments and refunds before disconnecting this shop’s credentials.');
    }
    this.db.transaction(() => {
      this.db.execute(`DELETE FROM shop_payment_webhook_secrets WHERE shop_id = ?`, [shopId]);
      this.db.execute(`DELETE FROM shop_payment_credentials WHERE shop_id = ? AND provider = 'RAZORPAY'`, [shopId]);
    });
  }
}
