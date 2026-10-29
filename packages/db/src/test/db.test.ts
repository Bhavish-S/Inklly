import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseService } from '../database';
import { ShopRepository } from '../repositories/shop-repository';
import { OrderRepository } from '../repositories/order-repository';
import { PricingRepository } from '../repositories/pricing-repository';
import { PrinterRepository } from '../repositories/printer-repository';
import { AgentRepository } from '../repositories/agent-repository';
import { seedDatabase } from '../seed';

describe('Relational Database & Multi-Tenancy Tests', () => {
  let db: DatabaseService;
  let shopRepo: ShopRepository;
  let orderRepo: OrderRepository;
  let pricingRepo: PricingRepository;
  let printerRepo: PrinterRepository;

  beforeEach(() => {
    db = new DatabaseService(':memory:');
    seedDatabase(db);
    shopRepo = new ShopRepository(db);
    orderRepo = new OrderRepository(db);
    pricingRepo = new PricingRepository(db);
    printerRepo = new PrinterRepository(db);
  });

  it('correctly loads seeded shop by shopCode', () => {
    const shop = shopRepo.getShopByCode('campus1');
    assert.ok(shop);
    assert.equal(shop.name, 'Campus Print Express');
    assert.equal(shop.currency, 'INR');
    assert.equal(shop.acceptCashOnCollection, true);
  });

  it('applies the merchant vault schema migration', () => {
    const migration = db.queryOne<{ version: number }>(`SELECT version FROM inklly_schema_migrations WHERE version = 3`);
    assert.equal(migration?.version, 3);
    const printerMigration = db.queryOne<{ version: number }>(`SELECT version FROM inklly_schema_migrations WHERE version = 4`);
    assert.equal(printerMigration?.version, 4);
    const printerColumns = db.query<{ name: string }>(`PRAGMA table_info(printers)`);
    assert.ok(printerColumns.some((column) => column.name === 'agent_id'));
    const tables = db.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('storage_categories', 'storage_documents')`
    );
    assert.deepEqual(tables.map((table) => table.name).sort(), ['storage_categories', 'storage_documents']);
    const platformPermissionMigration = db.queryOne<any>(`SELECT version FROM inklly_schema_migrations WHERE version = 16`);
    assert.equal(platformPermissionMigration?.version, 16);
    const platformPermissionTable = db.queryOne<any>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'platform_admin_permissions'`);
    assert.equal(platformPermissionTable?.name, 'platform_admin_permissions');
    db.execute(`DROP TABLE platform_admin_permissions`);
    db.execute(`DELETE FROM inklly_schema_migrations WHERE version = 16`);
    (db as any).ensureSqlitePlatformAdminPermissionsMigration();
    assert.equal(db.queryOne<any>(`SELECT version FROM inklly_schema_migrations WHERE version = 16`)?.version, 16,
      'an existing database can install the additive platform permission migration');
  });

  it('enforces append-only ledger entries and permits compensating entries', () => {
    const migration = db.queryOne<any>(`SELECT version FROM inklly_schema_migrations WHERE version = 9`);
    assert.equal(migration?.version, 9);
    const id = `ledger-append-only-${Date.now()}`;
    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO ledger_entries (id, domain, shop_id, amount_paise, currency, provider, description, created_at)
       VALUES (?, 'CUSTOMER_PRINT_PAYMENT', 'shop-campus-1', 1250, 'INR', 'MANUAL_CASH', 'Test receipt', ?)`,
      [id, now]
    );

    assert.throws(
      () => db.execute(`UPDATE ledger_entries SET amount_paise = 1 WHERE id = ?`, [id]),
      /append-only/i
    );
    assert.throws(
      () => db.execute(`DELETE FROM ledger_entries WHERE id = ?`, [id]),
      /append-only/i
    );
    assert.equal(db.queryOne<any>(`SELECT amount_paise FROM ledger_entries WHERE id = ?`, [id])?.amount_paise, 1250);

    db.execute(
      `INSERT INTO ledger_entries (id, domain, shop_id, amount_paise, currency, provider, description, metadata, created_at)
       VALUES (?, 'CUSTOMER_PRINT_PAYMENT', 'shop-campus-1', -1250, 'INR', 'MANUAL_ADJUSTMENT', 'Compensating entry', ?, ?)`,
      [`${id}-reversal`, JSON.stringify({ reversesEntryId: id, reason: 'test correction' }), now]
    );
    const balance = db.queryOne<any>(
      `SELECT SUM(amount_paise) AS total FROM ledger_entries WHERE id IN (?, ?)`,
      [id, `${id}-reversal`]
    );
    assert.equal(Number(balance?.total), 0);
  });

  it('keeps confirmed subscription usage append-only and prevents cascading history deletion', () => {
    const migration = db.queryOne<any>(`SELECT version FROM inklly_schema_migrations WHERE version = 11`);
    assert.equal(migration?.version, 11);
    const order = orderRepo.getOrderByNumber('INK-DEMO-001');
    assert.ok(order);
    const organization = db.queryOne<any>(`SELECT organization_id FROM shops WHERE id = ?`, [order.shopId]);
    assert.ok(organization?.organization_id);
    const eventId = `usage-append-only-${Date.now()}`;
    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO subscription_usage_events (id, organization_id, shop_id, order_id, confirmed_sides, created_at)
       VALUES (?, ?, ?, ?, 12, ?)`,
      [eventId, organization.organization_id, order.shopId, order.id, now]
    );

    assert.throws(() => db.execute(`UPDATE subscription_usage_events SET confirmed_sides = 1 WHERE id = ?`, [eventId]), /append-only/i);
    assert.throws(() => db.execute(`DELETE FROM subscription_usage_events WHERE id = ?`, [eventId]), /append-only/i);
    assert.throws(() => db.execute(`DELETE FROM orders WHERE id = ?`, [order.id]), /append-only/i);
    assert.equal(Number(db.queryOne<any>(`SELECT confirmed_sides FROM subscription_usage_events WHERE id = ?`, [eventId])?.confirmed_sides), 12);
  });

  it('prevents posting a provider transaction to the ledger more than once', () => {
    const migration = db.queryOne<any>(`SELECT version FROM inklly_schema_migrations WHERE version = 10`);
    assert.equal(migration?.version, 10);
    const now = new Date().toISOString();
    const values = ['ledger-provider-once', 'provider-payment-once', now];
    const insert = (id: string) => db.execute(
      `INSERT INTO ledger_entries (id, domain, shop_id, amount_paise, currency, provider, provider_transaction_id, description, created_at)
       VALUES (?, 'CUSTOMER_PRINT_PAYMENT', 'shop-campus-1', 500, 'INR', 'RAZORPAY', ?, 'Payment record', ?)`,
      [id, values[1], values[2]]
    );
    insert(values[0]);
    assert.throws(() => insert('ledger-provider-duplicate'), /UNIQUE constraint failed/i);
    assert.equal(Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM ledger_entries WHERE provider = 'RAZORPAY' AND provider_transaction_id = ?`, [values[1]]).count), 1);
  });

  it('applies the portal order idempotency migration without changing existing orders', () => {
    const before = Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM orders`)?.count);
    assert.ok(before > 0, 'seed data includes existing orders for migration preservation');
    db.execute(`DROP TABLE portal_order_idempotency`);
    db.execute(`DELETE FROM inklly_schema_migrations WHERE version = 7`);

    (db as any).ensureSqlitePortalOrderIdempotencyMigration();

    const after = Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM orders`)?.count);
    const table = db.queryOne<any>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'portal_order_idempotency'`);
    const migration = db.queryOne<any>(`SELECT version FROM inklly_schema_migrations WHERE version = 7`);
    assert.equal(after, before);
    assert.equal(table?.name, 'portal_order_idempotency');
    assert.equal(migration?.version, 7);
  });

  it('upgrades a pre-v8 developer-key table before creating its shop index', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'inklly-pre-v8-'));
    const filename = path.join(directory, 'legacy.db');
    const legacy = new DatabaseSync(filename);
    legacy.exec(`
      CREATE TABLE inklly_schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE developer_keys (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        key_name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        secret_hash TEXT NOT NULL,
        scopes TEXT NOT NULL,
        environment TEXT NOT NULL DEFAULT 'TEST',
        is_active INTEGER NOT NULL DEFAULT 1,
        expires_at TEXT,
        created_at TEXT NOT NULL,
        revoked_at TEXT
      );
      INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (7, '2026-10-27T00:00:00.000Z');
    `);
    legacy.close();

    let upgraded: DatabaseService | undefined;
    try {
      upgraded = new DatabaseService(filename);
      const columns = upgraded.query<{ name: string }>(`PRAGMA table_info(developer_keys)`);
      assert.ok(columns.some((column) => column.name === 'shop_id'));
      assert.ok(columns.some((column) => column.name === 'created_by_user_id'));
      const index = upgraded.queryOne<any>(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_developer_keys_shop'`);
      assert.equal(index?.name, 'idx_developer_keys_shop');
      const migration = upgraded.queryOne<any>(`SELECT version FROM inklly_schema_migrations WHERE version = 8`);
      assert.equal(migration?.version, 8);
    } finally {
      upgraded?.getRawDb().close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('synchronizes only agent-reported printer queues and marks disappeared queues offline', () => {
    printerRepo.syncAgentInventory('shop-campus-1', 'agent-a', [
      { name: 'Test OS Queue', driverName: 'Test Driver', isOnline: true, isDefault: true },
    ]);
    printerRepo.syncAgentInventory('shop-campus-1', 'agent-b', [
      { name: 'Other Agent Queue', driverName: 'Other Driver', isOnline: true, isDefault: false },
    ]);
    const first = printerRepo.getPrintersByShop('shop-campus-1');
    const liveQueue = first.find((printer) => printer.name === 'Test OS Queue');
    assert.ok(liveQueue);
    assert.equal(liveQueue.isOnline, true);
    assert.equal(liveQueue.isDefault, true);
    assert.equal(first.find((printer) => printer.name === 'Other Agent Queue')?.isOnline, true);

    printerRepo.syncAgentInventory('shop-campus-1', 'agent-a', []);
    assert.equal(printerRepo.getPrintersByShop('shop-campus-1').find((printer) => printer.id === liveQueue.id)?.isOnline, false);
    assert.equal(printerRepo.getPrintersByShop('shop-campus-1').find((printer) => printer.name === 'Other Agent Queue')?.isOnline, true);
  });

  it('stores and retrieves rate rules scoped to shop', () => {
    const rates = pricingRepo.getRateRules('shop-campus-1');
    assert.ok(rates.length >= 6);
    const a4BwSimplex = rates.find(
      (r) => r.paperSize === 'A4' && r.colorMode === 'bw' && r.duplexMode === 'simplex'
    );
    assert.ok(a4BwSimplex);
    assert.equal(a4BwSimplex.pricePerPrintedSidePaise, 200);
    assert.equal(db.queryOne<any>(`SELECT version FROM inklly_schema_migrations WHERE version = 12`)?.version, 12);
    const matchingCount = () => Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM rate_rules WHERE shop_id = ? AND printer_id IS NULL AND paper_size = 'A4' AND color_mode = 'bw' AND duplex_mode = 'simplex'`, ['shop-campus-1'])?.count);
    const before = matchingCount();
    pricingRepo.setRateRule({ ...a4BwSimplex, id: 'replayed-rate-rule', pricePerPrintedSidePaise: 225 });
    assert.equal(matchingCount(), before, 'upsert keeps a single rule for a nullable-printer key');
    assert.equal(pricingRepo.getRateRules('shop-campus-1').find((rule) => rule.paperSize === 'A4' && rule.colorMode === 'bw' && rule.duplexMode === 'simplex')?.pricePerPrintedSidePaise, 225);
    assert.equal(db.queryOne<any>(`SELECT version FROM inklly_schema_migrations WHERE version = 13`)?.version, 13);
    assert.ok(db.query<{ name: string }>(`PRAGMA table_info(orders)`).some((column) => column.name === 'pricing_snapshot'));
  });

  it('persists idempotent webhook events, leases retries, and scopes history by organization', () => {
    const migration = db.queryOne<any>(`SELECT version FROM inklly_schema_migrations WHERE version = 14`);
    assert.equal(migration?.version, 14);
    const orgId = db.queryOne<any>(`SELECT organization_id FROM shops WHERE id = ?`, ['shop-campus-1']).organization_id as string;
    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO webhook_subscriptions (id, organization_id, target_url, secret, event_types, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      ['webhook-outbox-test', orgId, 'https://example.com/hook', 'encrypted-test-secret', JSON.stringify(['order.created']), now, now]
    );
    const repo = new AgentRepository(db);
    const payload = { orderId: 'order-outbox-test', status: 'AWAITING_REVIEW' };
    const eventId = repo.enqueueWebhookEvent(orgId, 'order.created', 'order.created:order-outbox-test', payload);
    assert.equal(repo.enqueueWebhookEvent(orgId, 'order.created', 'order.created:order-outbox-test', payload), eventId,
      'replaying an idempotency key returns the original event');
    assert.equal(repo.listWebhookDeliveries(orgId, 'webhook-outbox-test').length, 1,
      'an event creates one delivery per matching subscription');
    assert.equal(repo.listWebhookDeliveries('unrelated-org', 'webhook-outbox-test').length, 0,
      'delivery history remains organization-scoped');

    const [first] = repo.claimDueWebhookDeliveries(10, 30_000);
    assert.equal(first.deliveryId, repo.listWebhookDeliveries(orgId, 'webhook-outbox-test')[0].deliveryId);
    assert.equal(first.attemptCount, 1);
    assert.equal(repo.claimDueWebhookDeliveries(10, 30_000).length, 0, 'an active lease prevents concurrent duplicate claims');
    repo.recordWebhookDeliveryResult(first.deliveryId, false, 503, 'destination_http_503', new Date(Date.now() + 60_000).toISOString());
    assert.equal(repo.listWebhookDeliveries(orgId, 'webhook-outbox-test')[0].attempts[0].statusCode, 503);

    db.execute(`UPDATE webhook_deliveries SET next_attempt_at = ? WHERE id = ?`, [new Date(Date.now() - 1_000).toISOString(), first.deliveryId]);
    const [retry] = repo.claimDueWebhookDeliveries(10, 30_000);
    assert.equal(retry.attemptCount, 2);
    repo.recordWebhookDeliveryResult(retry.deliveryId, true, 204, null, null);
    const history = repo.listWebhookDeliveries(orgId, 'webhook-outbox-test');
    assert.equal(history[0].status, 'DELIVERED');
    assert.equal(history[0].attempts.length, 2);
    assert.equal(history[0].attempts[1].statusCode, 204);
  });

  it('persists and updates orders with state machine validation', () => {
    const order = orderRepo.getOrderByNumber('INK-DEMO-001');
    assert.ok(order);
    assert.equal(order.status, 'AWAITING_REVIEW');
    assert.equal(order.paymentStatus, 'VERIFIED');
    assert.equal(order.files.length, 1);
    assert.equal(order.files[0].fileName, 'Final_Project_Report.pdf');

    // Valid progression
    orderRepo.updateOrderStatus(order.id, 'READY_FOR_PRINT');
    const updated = orderRepo.getOrderById(order.id);
    assert.equal(updated?.status, 'READY_FOR_PRINT');

    // Illegal progression throws
    assert.throws(() => {
      orderRepo.updateOrderStatus(order.id, 'DRAFT');
    }, /Illegal order transition/);
  });
});
