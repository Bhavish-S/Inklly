import { after, before, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { DatabaseService } from '@inklly/db';
import { createApp } from '../index';
import { countPrintedSides, localDayRange } from '../services/shop-operations';

describe('shop operations: pause orders, queue estimate, daily report', { concurrency: false }, () => {
  let db: DatabaseService;
  let server: http.Server;
  let baseUrl: string;
  let headers: Record<string, string>;

  before(async () => {
    db = new DatabaseService(':memory:');
    const app = createApp(db);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
        resolve();
      });
    });
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@campusprint.in', password: 'DemoOwnerPassword123!' }),
    });
    const { token } = await login.json() as { token: string };
    headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  });

  after(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    db?.close();
  });

  it('counts printed sides for B&W, colour and mixed files with copies and ranges', () => {
    assert.deepEqual(countPrintedSides(10, { colorMode: 'bw', copies: 2 }), { bw: 20, color: 0 });
    assert.deepEqual(countPrintedSides(10, { colorMode: 'color', pageRange: '1-3', copies: 1 }), { bw: 0, color: 3 });
    assert.deepEqual(countPrintedSides(10, { colorMode: 'mixed', colorPages: '2,4,9', pageRange: '1-5', copies: 3 }), { bw: 9, color: 6 });
    assert.deepEqual(countPrintedSides(5, { colorMode: 'bw', pageRange: 'nonsense' }), { bw: 0, color: 0 });
  });

  it('maps a local date to its UTC range (India is UTC+5:30)', () => {
    assert.deepEqual(localDayRange('2026-11-19', 330), { from: '2026-11-18T18:30:00.000Z', to: '2026-11-19T18:30:00.000Z' });
  });

  it('shows the queue on the shop page and refuses orders while paused', async () => {
    const shopBefore = await (await fetch(`${baseUrl}/api/v1/portal/shop/campus1`)).json() as any;
    assert.equal(shopBefore.acceptingOrders, true);
    assert.ok(Number.isInteger(shopBefore.queue.ordersAhead));
    assert.ok(shopBefore.queue.estimatedMinutes >= 2);

    const pause = await fetch(`${baseUrl}/api/v1/merchant/operations`, {
      method: 'PUT', headers, body: JSON.stringify({ acceptingOrders: false, pauseMessage: 'Back at 4 pm' }),
    });
    assert.equal(pause.status, 200);
    const shopPaused = await (await fetch(`${baseUrl}/api/v1/portal/shop/campus1`)).json() as any;
    assert.equal(shopPaused.acceptingOrders, false);
    assert.equal(shopPaused.pauseMessage, 'Back at 4 pm');

    const order = await fetch(`${baseUrl}/api/v1/portal/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopCode: 'campus1', customerName: 'Paused', customerPhone: '9000000000', paymentMethod: 'CASH_ON_COLLECTION', files: [{ fileName: 'x.pdf' }] }),
    });
    assert.equal(order.status, 409);
    assert.match((await order.json() as any).error, /Back at 4 pm/);

    const resume = await fetch(`${baseUrl}/api/v1/merchant/operations`, { method: 'PUT', headers, body: JSON.stringify({ acceptingOrders: true }) });
    assert.equal(resume.status, 200);
    assert.equal(((await resume.json()) as any).pauseMessage, null);
    const audit = db.query<any>(`SELECT action FROM audit_events WHERE action IN ('SHOP_ORDERS_PAUSED', 'SHOP_ORDERS_RESUMED') ORDER BY created_at`);
    assert.deepEqual(audit.map((row) => row.action), ['SHOP_ORDERS_PAUSED', 'SHOP_ORDERS_RESUMED']);
  });

  it('rejects malformed operation updates and needs a merchant session', async () => {
    assert.equal((await fetch(`${baseUrl}/api/v1/merchant/operations`, { method: 'PUT', headers, body: JSON.stringify({ acceptingOrders: 'no' }) })).status, 400);
    assert.equal((await fetch(`${baseUrl}/api/v1/merchant/operations`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acceptingOrders: false }) })).status, 401);
  });

  it('builds a daily report from orders, files and ledger entries', async () => {
    const now = new Date();
    const createdAt = now.toISOString();
    db.execute(
      `INSERT INTO orders (id, shop_id, order_number, token_number, customer_name, customer_phone, status, payment_status, payment_method, total_amount_paise, currency, quote_version, created_at, updated_at, collected_at)
       VALUES ('rpt-1', 'shop-campus-1', 'RPT-1', '7001', 'Report Customer', '9111111111', 'COLLECTED', 'VERIFIED', 'CASH_ON_COLLECTION', 1200, 'INR', 'v1', ?, ?, ?)`,
      [createdAt, createdAt, new Date(now.getTime() + 10 * 60_000).toISOString()]
    );
    db.execute(
      `INSERT INTO order_files (id, order_id, file_name, file_size_bytes, mime_type, storage_key, page_count, print_options, line_subtotal_paise, created_at)
       VALUES ('rpt-f1', 'rpt-1', 'a.pdf', 100, 'application/pdf', 'uploads/x/a.pdf', 4, ?, 1200, ?)`,
      [JSON.stringify({ colorMode: 'mixed', colorPages: '1', copies: 2 }), createdAt]
    );
    db.execute(
      `INSERT INTO ledger_entries (id, domain, organization_id, shop_id, order_id, amount_paise, currency, provider, description, created_at)
       VALUES ('rpt-l1', 'CUSTOMER_PRINT_PAYMENT', 'org-campus-network', 'shop-campus-1', 'rpt-1', 1200, 'INR', 'MANUAL_CASH', 'cash', ?)`,
      [createdAt]
    );
    const offset = 0;
    const today = createdAt.slice(0, 10);
    const res = await fetch(`${baseUrl}/api/v1/merchant/reports/daily?date=${today}&tzOffsetMinutes=${offset}`, { headers });
    assert.equal(res.status, 200);
    const report = await res.json() as any;
    assert.ok(report.orders.completed >= 1);
    assert.ok(report.revenue.cashPaise >= 1200);
    assert.ok(report.pages.color >= 2 && report.pages.bw >= 6);
    assert.equal(report.hourly.length, 24);
    assert.equal(report.lastSevenDays.length, 7);
    assert.equal(report.lastSevenDays[6].date, today);
    assert.ok(report.topCustomers.some((customer: any) => customer.name === 'Report Customer'));
    assert.equal((await fetch(`${baseUrl}/api/v1/merchant/reports/daily?date=19-11-2026`, { headers })).status, 400);
  });

  it('tells a customer how many orders are ahead of theirs', async () => {
    const order = db.queryOne<any>(`SELECT id FROM orders WHERE shop_id = 'shop-campus-1' AND status = 'AWAITING_REVIEW' LIMIT 1`);
    const tracked = await (await fetch(`${baseUrl}/api/v1/portal/orders/${order.id}`)).json() as any;
    assert.ok(tracked.queue && Number.isInteger(tracked.queue.ordersAhead));
    assert.ok('shopPhone' in tracked);
  });
});
