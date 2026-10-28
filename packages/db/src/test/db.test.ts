import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../database';
import { ShopRepository } from '../repositories/shop-repository';
import { OrderRepository } from '../repositories/order-repository';
import { PricingRepository } from '../repositories/pricing-repository';
import { PrinterRepository } from '../repositories/printer-repository';
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
