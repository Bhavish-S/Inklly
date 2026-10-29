import { after, before, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { DatabaseService, seedDatabase } from '@inklly/db';
import { PilotBillingError, PilotBillingService } from '../services/pilot-billing';

describe('invoice-only pilot billing', () => {
  let db: DatabaseService;
  let billing: PilotBillingService;
  let orderId: string;
  let period: string;
  let periodStart: string;
  let periodEnd: string;

  before(() => {
    db = new DatabaseService(':memory:');
    seedDatabase(db, true);
    billing = new PilotBillingService(db);
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    period = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
    periodStart = start.toISOString();
    periodEnd = end.toISOString();
    orderId = String(db.queryOne<any>(`SELECT id FROM orders WHERE shop_id = 'shop-campus-1' LIMIT 1`)?.id);
    assert.ok(orderId);
    db.execute(`INSERT INTO subscription_usage_events
      (id, organization_id, shop_id, order_id, confirmed_sides, confirmation_source, created_at)
      VALUES (?, 'org-campus-network', 'shop-campus-1', ?, 10, 'OPERATOR_PHYSICAL_INSPECTION', ?)` ,
    [`usage-${crypto.randomUUID()}`, orderId, `${periodStart.slice(0, 10)}T12:00:00.000Z`]);
  });

  after(() => db.close());

  it('issues one immutable Paise invoice from confirmed usage and preserves the tariff snapshot', () => {
    const tariff = billing.addTariff({
      organizationId: 'org-campus-network', monthlyBasePaise: 1000, perSidePaise: 5,
      includedSides: 2, effectiveFrom: `${period}-01`, createdBy: 'platform-owner',
    });
    const ledgerBefore = Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM ledger_entries`)?.count || 0);
    const first = billing.issueMonthlyInvoice('org-campus-network', period, 'platform-owner');
    const replay = billing.issueMonthlyInvoice('org-campus-network', period, 'platform-owner');

    assert.equal(first.created, true);
    assert.equal(replay.created, false);
    assert.equal(first.invoice.id, replay.invoice.id);
    assert.deepEqual([first.invoice.confirmedSides, first.invoice.includedSides, first.invoice.billableSides], [10, 2, 8]);
    assert.deepEqual([first.invoice.monthlyBasePaise, first.invoice.perSidePaise, first.invoice.usageFeePaise, first.invoice.totalPaise], [1000, 5, 40, 1040]);
    assert.equal(first.invoice.status, 'ISSUED');
    assert.equal(first.invoice.collectionStatus, 'MANUAL_PENDING');
    assert.equal(first.invoice.paymentRecorded, false);
    assert.equal(first.invoice.tariffId, tariff.id);
    assert.equal(billing.listInvoices('org-campus-network').length, 1);
    assert.equal(Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM ledger_entries`)?.count || 0), ledgerBefore);
    assert.throws(() => db.execute(`UPDATE subscription_invoices SET total_paise = 1 WHERE id = ?`, [first.invoice.id]), /append-only/i);
    assert.throws(() => db.execute(`UPDATE subscription_billing_tariffs SET per_side_paise = 1 WHERE id = ?`, [tariff.id]), /append-only/i);
  });

  it('rejects invalid tariff periods, invalid amounts, and uncompleted invoice periods', () => {
    assert.throws(() => billing.addTariff({
      organizationId: 'org-campus-network', monthlyBasePaise: 1.5, perSidePaise: 5,
      includedSides: 0, effectiveFrom: `${period}-01`, createdBy: 'platform-owner',
    }), (error: unknown) => error instanceof PilotBillingError && error.statusCode === 400);
    assert.throws(() => billing.issueMonthlyInvoice('org-campus-network', '2999-12', 'platform-owner'),
      (error: unknown) => error instanceof PilotBillingError && error.statusCode === 409);
  });
});
