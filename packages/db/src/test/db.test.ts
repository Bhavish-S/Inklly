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
import { UserRepository } from '../repositories/user-repository';
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

  it('persists validated customer portal requirements and option allowlists per shop', () => {
    const defaultSettings = shopRepo.getPortalSettings('shop-campus-1');
    assert.equal(defaultSettings.requiredFields.name, true);
    assert.deepEqual(defaultSettings.allowedOptions.colorModes, ['bw', 'color', 'mixed']);
    assert.deepEqual(defaultSettings.services, { idCardPrinting: false, photoPrinting: false });
    const saved = shopRepo.updatePortalSettings('shop-campus-1', {
      requiredFields: { name: false, phone: true },
      allowedOptions: { colorModes: ['bw'], duplexModes: ['simplex'], paperSizes: ['A4'], pageSelection: false },
      services: { idCardPrinting: true, photoPrinting: true },
    });
    assert.equal(saved.requiredFields.name, false);
    assert.deepEqual(saved.services, { idCardPrinting: true, photoPrinting: true });
    assert.deepEqual(shopRepo.getPortalSettings('shop-campus-1'), saved);
    assert.throws(() => shopRepo.updatePortalSettings('shop-campus-1', {
      requiredFields: { name: true, phone: true },
      allowedOptions: { colorModes: [], duplexModes: ['simplex'], paperSizes: ['A4'], pageSelection: true },
    }), /at least one color modes/i);
    assert.equal(shopRepo.getPortalSettings('shop-campus-1').requiredFields.name, false, 'invalid updates do not overwrite persisted settings');
    assert.equal(shopRepo.getPortalSettings('shop-campus-1').services.photoPrinting, true, 'legacy payloads preserve service availability');
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

    const printReadinessMigration = db.queryOne<any>(`SELECT version FROM inklly_schema_migrations WHERE version = 24`);
    assert.equal(printReadinessMigration?.version, 24);
    assert.ok(db.query<any>(`PRAGMA table_info(agent_registrations)`).some((column) => column.name === 'physical_printing_enabled'));
    db.getRawDb().exec(`ALTER TABLE agent_registrations DROP COLUMN physical_printing_enabled`);
    db.execute(`DELETE FROM inklly_schema_migrations WHERE version = 24`);
    (db as any).ensureSqliteAgentPrintReadinessMigration();
    assert.ok(db.query<any>(`PRAGMA table_info(agent_registrations)`).some((column) => column.name === 'physical_printing_enabled'),
      'an existing database can install the additive physical-printing readiness migration');
    const now = new Date().toISOString();
    db.execute(`INSERT INTO agent_registrations (id, shop_id, secret_key_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      ['agent-legacy-readiness', 'shop-campus-1', 'test-hash', now, now]);
    assert.equal(Number(db.queryOne<any>(`SELECT physical_printing_enabled FROM agent_registrations WHERE id = ?`, ['agent-legacy-readiness']).physical_printing_enabled), 0,
      'legacy agents default to disabled until a new heartbeat reports readiness');
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

  it('hydrates shop printer inventory and trays with one bounded database query', () => {
    const prefix = `inventory-query-${Date.now()}`;
    for (let index = 0; index < 5; index++) {
      const printerId = `${prefix}-${index}`;
      printerRepo.registerPrinter({
        id: printerId,
        shopId: 'shop-campus-1',
        name: `Inventory Printer ${index}`,
        systemDriverName: `Inventory Driver ${index}`,
        isOnline: index % 2 === 0,
        isDefault: index === 0,
        supportsColor: index % 2 === 0,
        supportsDuplex: true,
        lastHeartbeat: new Date().toISOString(),
        trays: [
          { id: `${printerId}-tray-a4`, name: 'A4 tray', supportedSizes: ['A4'] as any, isDefault: true },
          { id: `${printerId}-tray-a3`, name: 'A3 tray', supportedSizes: ['A3'] as any, isDefault: false },
        ],
      });
    }

    const originalQuery = db.query;
    let inventoryQueryCount = 0;
    (db as any).query = function (sql: string, params?: any[]) {
      if (/FROM printers p LEFT JOIN paper_trays t/i.test(sql)) inventoryQueryCount += 1;
      return originalQuery.call(this, sql, params);
    };
    try {
      const printers = printerRepo.getPrintersByShop('shop-campus-1').filter((printer) => printer.id.startsWith(prefix));
      assert.equal(inventoryQueryCount, 1, 'printer list and all associated trays must be loaded together');
      assert.equal(printers.length, 5);
      for (const printer of printers) {
        assert.deepEqual(printer.trays.map((tray) => tray.supportedSizes), [['A3'], ['A4']]);
      }
    } finally {
      (db as any).query = originalQuery;
    }
  });

  it('checks printer ownership and dashboard health without loading tray inventory', () => {
    const printer = printerRepo.getPrintersByShop('shop-campus-1')[0];
    assert.ok(printer);
    assert.equal(printerRepo.hasPrinterForShop('shop-campus-1', printer.id), true);
    assert.equal(printerRepo.hasPrinterForShop('shop-campus-2', printer.id), false);
    assert.equal(printerRepo.hasPrintersByShop('shop-campus-1'), true);
    assert.equal(printerRepo.hasPrintersByShop('shop-does-not-exist'), false);

    const originalQuery = db.query;
    let healthQueryCount = 0;
    (db as any).query = function (sql: string, params?: any[]) {
      if (/SELECT is_online, last_heartbeat FROM printers WHERE shop_id = \?/i.test(sql)) healthQueryCount += 1;
      return originalQuery.call(this, sql, params);
    };
    try {
      const rows = printerRepo.getPrinterHealthRowsByShop('shop-campus-1');
      assert.equal(healthQueryCount, 1);
      assert.equal(rows.length, printerRepo.getPrintersByShop('shop-campus-1').length);
      assert.ok(rows.every((row) => typeof row.isOnline === 'boolean'));
    } finally {
      (db as any).query = originalQuery;
    }
  });

  it('rejects staff access updates based on stale membership state', () => {
    const userRepo = new UserRepository(db);
    const target = userRepo.getStaffByShop('shop-campus-1').find((entry) => entry.user.id === 'user-staff-1');
    assert.ok(target);
    const winningPermissions = ['settings:view'];
    const winningUpdatedAt = new Date(Date.parse(target.membership.updatedAt) + 2000).toISOString();
    db.execute(`UPDATE memberships SET permissions = ?, updated_at = ? WHERE id = ?`,
      [JSON.stringify(winningPermissions), winningUpdatedAt, target.membership.id]);

    const staleUpdate = userRepo.updateStaffMembership({
      userId: target.user.id,
      organizationId: target.membership.organizationId,
      shopId: 'shop-campus-1',
      permissions: ['orders:view'],
      isActive: false,
      updatedAt: new Date().toISOString(),
      expectedPermissions: target.membership.permissions,
      expectedIsActive: target.membership.isActive !== false,
      expectedUpdatedAt: target.membership.updatedAt,
    });
    assert.equal(staleUpdate, false, 'a compare-and-set update must not overwrite a newer owner action');
    const persisted = db.queryOne<any>(`SELECT permissions, is_active, updated_at FROM memberships WHERE id = ?`, [target.membership.id]);
    assert.deepEqual(JSON.parse(persisted.permissions), winningPermissions);
    assert.equal(Boolean(persisted.is_active), target.membership.isActive);
    assert.equal(persisted.updated_at, winningUpdatedAt);
  });

  it('attaches an agent queue to its exact saved capability profile and keeps that identity on later heartbeats', () => {
    const profile = {
      id: 'printer-profile-queue-link-test', shopId: 'shop-campus-1', name: 'Configured Queue Test',
      systemDriverName: 'Configured Test Driver', isOnline: false, isDefault: false,
      supportsColor: true, supportsDuplex: true, lastHeartbeat: '',
      trays: [{ id: 'tray-profile-queue-link-test', name: 'A4 and A3', supportedSizes: ['A4', 'A3'] as any, isDefault: true }],
    };
    printerRepo.registerPrinter(profile);
    const reported = [{ name: profile.name, driverName: profile.systemDriverName, isOnline: true, isDefault: true }];

    printerRepo.syncAgentInventory('shop-campus-1', 'agent-profile-link', reported);
    printerRepo.syncAgentInventory('shop-campus-1', 'agent-profile-link', reported);

    const rows = printerRepo.getPrintersByShop('shop-campus-1').filter((printer) => printer.name === profile.name);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, profile.id);
    assert.equal(rows[0].agentId, 'agent-profile-link');
    assert.equal(rows[0].isOnline, true);
    assert.equal(rows[0].supportsColor, true);
    assert.equal(rows[0].supportsDuplex, true);
    assert.deepEqual(rows[0].trays[0].supportedSizes, ['A4', 'A3']);
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

  it('enforces unique copy discount configurations and fails closed on legacy duplicates', () => {
    const migration = db.queryOne<any>(`SELECT version FROM inklly_schema_migrations WHERE version = 23`);
    assert.equal(migration?.version, 23);
    const index = db.queryOne<any>(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_copy_discount_rules_unique'`);
    assert.equal(index?.name, 'idx_copy_discount_rules_unique');

    db.execute(`DROP INDEX idx_copy_discount_rules_unique`);
    db.execute(`DELETE FROM inklly_schema_migrations WHERE version = 23`);
    for (const id of ['copy-legacy-a', 'copy-legacy-b']) {
      db.execute(
        `INSERT INTO copy_discount_rules (id, shop_id, paper_size, color_mode, duplex_mode, copy_one_price_paise, additional_copy_price_paise, is_enabled)
         VALUES (?, 'shop-campus-1', 'A4', 'bw', 'simplex', 200, 100, 1)`, [id]
      );
    }
    assert.throws(() => (db as any).ensureSqliteCopyDiscountUniquenessMigration(), /duplicate copy-discount keys/i);
    assert.equal(Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM copy_discount_rules WHERE shop_id = 'shop-campus-1'`).count), 2,
      'failed migration preserves ambiguous legacy rows for operator review');
    assert.equal(db.queryOne<any>(`SELECT version FROM inklly_schema_migrations WHERE version = 23`)?.version, undefined);
    db.execute(`DELETE FROM copy_discount_rules WHERE id IN ('copy-legacy-a', 'copy-legacy-b')`);
    (db as any).ensureSqliteCopyDiscountUniquenessMigration();
    assert.equal(db.queryOne<any>(`SELECT version FROM inklly_schema_migrations WHERE version = 23`)?.version, 23);
  });

  it('upserts additional-copy discounts by shop, paper and print mode', () => {
    const rule = { paperSize: 'A4' as const, colorMode: 'bw' as const, duplexMode: 'simplex' as const,
      copyOnePricePaise: 200, additionalCopyPricePaise: 125, isEnabled: true };
    pricingRepo.setCopyDiscountRules('shop-campus-1', [rule]);
    pricingRepo.setCopyDiscountRules('shop-campus-1', [{ ...rule, additionalCopyPricePaise: 100 }]);
    const rules = pricingRepo.getCopyDiscountRules('shop-campus-1');
    assert.equal(rules.length, 1);
    assert.equal(rules[0].additionalCopyPricePaise, 100);
    assert.equal(rules[0].copyOnePricePaise, 200);
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

describe('print-file lifecycle schema migration', () => {
  it('adds lifecycle coordination when opening a database created before migration 17', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'inklly-print-file-migration-'));
    const databasePath = path.join(directory, 'existing.sqlite');
    try {
      const initial = new DatabaseService(databasePath);
      initial.execute(`DROP TABLE print_file_lifecycle`);
      initial.execute(`DELETE FROM inklly_schema_migrations WHERE version = 17`);
      initial.close();

      const upgraded = new DatabaseService(databasePath);
      assert.ok(upgraded.queryOne(`SELECT version FROM inklly_schema_migrations WHERE version = 17`));
      assert.ok(upgraded.queryOne(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'print_file_lifecycle'`));
      upgraded.close();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('staff membership lifecycle schema migration', () => {
  it('adds active state to pre-v19 memberships and preserves them as active', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'inklly-membership-migration-'));
    const databasePath = path.join(directory, 'existing.sqlite');
    try {
      const initial = new DatabaseService(databasePath);
      seedDatabase(initial);
      initial.execute(`ALTER TABLE memberships DROP COLUMN is_active`);
      initial.execute(`DELETE FROM inklly_schema_migrations WHERE version = 19`);
      initial.close();

      const upgraded = new DatabaseService(databasePath);
      const column = (upgraded.getRawDb().prepare(`PRAGMA table_info(memberships)`).all() as Array<{ name: string }>).find((item) => item.name === 'is_active');
      assert.ok(column);
      assert.equal(upgraded.queryOne<any>(`SELECT is_active FROM memberships WHERE shop_id = 'shop-campus-1' LIMIT 1`)?.is_active, 1);
      assert.ok(upgraded.queryOne(`SELECT version FROM inklly_schema_migrations WHERE version = 19`));
      upgraded.close();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('shared public upload rate-limit migration', () => {
  it('creates the persistent bucket table on an existing database', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'inklly-upload-rate-migration-'));
    const databasePath = path.join(directory, 'existing.sqlite');
    try {
      const initial = new DatabaseService(databasePath);
      initial.execute(`DROP TABLE public_upload_rate_limits`);
      initial.execute(`DELETE FROM inklly_schema_migrations WHERE version = 20`);
      initial.close();

      const upgraded = new DatabaseService(databasePath);
      assert.ok(upgraded.queryOne(`SELECT version FROM inklly_schema_migrations WHERE version = 20`));
      assert.ok(upgraded.queryOne(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'public_upload_rate_limits'`));
      upgraded.close();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('merchant vault deletion lifecycle migration', () => {
  it('adds retryable deletion state to an existing vault without changing stored rows', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'inklly-vault-delete-migration-'));
    const databasePath = path.join(directory, 'existing.sqlite');
    try {
      const initial = new DatabaseService(databasePath);
      seedDatabase(initial);
      initial.execute(
        `INSERT INTO storage_documents (id, shop_id, file_name, mime_type, file_size_bytes, page_count, storage_key, created_at)
         VALUES ('vault-existing', 'shop-campus-1', 'existing.pdf', 'application/pdf', 100, 1, 'uploads/shop-campus-1/existing.pdf', '2026-10-29T00:00:00.000Z')`
      );
      initial.execute(`ALTER TABLE storage_documents DROP COLUMN deletion_requested_at`);
      initial.execute(`DELETE FROM inklly_schema_migrations WHERE version = 25`);
      initial.close();

      const upgraded = new DatabaseService(databasePath);
      const column = (upgraded.getRawDb().prepare(`PRAGMA table_info(storage_documents)`).all() as Array<{ name: string }>).find((item) => item.name === 'deletion_requested_at');
      assert.ok(column);
      assert.equal(upgraded.queryOne<any>(`SELECT deletion_requested_at FROM storage_documents WHERE id = 'vault-existing'`)?.deletion_requested_at, null);
      assert.ok(upgraded.queryOne(`SELECT version FROM inklly_schema_migrations WHERE version = 25`));
      upgraded.close();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('platform agent fleet index migration', () => {
  it('restores agent fleet count indexes when opening a database that predates them', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'inklly-agent-fleet-index-migration-'));
    const databasePath = path.join(directory, 'existing.sqlite');
    try {
      const initial = new DatabaseService(databasePath);
      seedDatabase(initial);
      initial.execute(`DROP INDEX idx_printers_agent_online`);
      initial.execute(`DROP INDEX idx_print_attempts_agent_status`);
      initial.execute(`DELETE FROM inklly_schema_migrations WHERE version = 26`);
      initial.close();

      const upgraded = new DatabaseService(databasePath);
      const indexes = upgraded.query<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'index'`);
      assert.ok(indexes.some((index) => index.name === 'idx_printers_agent_online'));
      assert.ok(indexes.some((index) => index.name === 'idx_print_attempts_agent_status'));
      assert.ok(upgraded.queryOne(`SELECT version FROM inklly_schema_migrations WHERE version = 26`));
      upgraded.close();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('platform organization directory index migration', () => {
  it('restores the stable organization cursor index for an existing database', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'inklly-organization-directory-migration-'));
    const databasePath = path.join(directory, 'existing.sqlite');
    try {
      const initial = new DatabaseService(databasePath);
      seedDatabase(initial);
      initial.execute(`DROP INDEX idx_organizations_created`);
      initial.execute(`DELETE FROM inklly_schema_migrations WHERE version = 27`);
      initial.close();

      const upgraded = new DatabaseService(databasePath);
      const indexes = upgraded.query<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'index'`);
      assert.ok(indexes.some((index) => index.name === 'idx_organizations_created'));
      assert.ok(upgraded.queryOne(`SELECT version FROM inklly_schema_migrations WHERE version = 27`));
      upgraded.close();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('order token migration', () => {
  it('ensures token_number column and index exist for an existing orders table', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'inklly-order-token-migration-'));
    const databasePath = path.join(directory, 'existing.sqlite');
    try {
      const initial = new DatabaseService(databasePath);
      seedDatabase(initial);
      initial.execute(`DROP INDEX idx_orders_token`);
      initial.execute(`DELETE FROM inklly_schema_migrations WHERE version = 28`);
      initial.close();

      const upgraded = new DatabaseService(databasePath);
      const columns = upgraded.query<{ name: string }>(`PRAGMA table_info(orders)`);
      assert.ok(columns.some((c) => c.name === 'token_number'));
      const indexes = upgraded.query<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'index'`);
      assert.ok(indexes.some((index) => index.name === 'idx_orders_token'));
      assert.ok(upgraded.queryOne(`SELECT version FROM inklly_schema_migrations WHERE version = 28`));
      upgraded.close();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
