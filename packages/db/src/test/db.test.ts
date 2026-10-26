import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../database';
import { ShopRepository } from '../repositories/shop-repository';
import { OrderRepository } from '../repositories/order-repository';
import { PricingRepository } from '../repositories/pricing-repository';
import { seedDatabase } from '../seed';

describe('Relational Database & Multi-Tenancy Tests', () => {
  let db: DatabaseService;
  let shopRepo: ShopRepository;
  let orderRepo: OrderRepository;
  let pricingRepo: PricingRepository;

  beforeEach(() => {
    db = new DatabaseService(':memory:');
    seedDatabase(db);
    shopRepo = new ShopRepository(db);
    orderRepo = new OrderRepository(db);
    pricingRepo = new PricingRepository(db);
  });

  it('correctly loads seeded shop by shopCode', () => {
    const shop = shopRepo.getShopByCode('campus1');
    assert.ok(shop);
    assert.equal(shop.name, 'Campus Print Express');
    assert.equal(shop.currency, 'INR');
    assert.equal(shop.acceptCashOnCollection, true);
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
