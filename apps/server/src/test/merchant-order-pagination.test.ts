import { after, before, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { DatabaseService } from '@inklly/db';
import { createApp } from '../index';

describe('merchant order listing pagination', { concurrency: false }, () => {
  let db: DatabaseService;
  let server: http.Server;
  let baseUrl: string;
  let ownerToken: string;

  before(async () => {
    db = new DatabaseService(':memory:');
    server = createApp(db).listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@campusprint.in', password: 'DemoOwnerPassword123!' }),
    });
    assert.equal(login.status, 200);
    ownerToken = (await login.json() as any).token;
    const shopId = db.queryOne<any>(`SELECT shop_id FROM memberships WHERE user_id = (SELECT id FROM users WHERE email = 'owner@campusprint.in')`)?.shop_id;
    assert.equal(typeof shopId, 'string');
    for (const [suffix, createdAt, amount, status] of [
      ['C', '2026-10-01T00:00:03.000Z', 300, 'AWAITING_REVIEW'],
      ['A', '2026-10-01T00:00:01.000Z', 100, 'AWAITING_REVIEW'],
      ['B', '2026-10-01T00:00:02.000Z', 200, 'AWAITING_REVIEW'],
      ['D', '2026-10-01T00:00:04.000Z', 400, 'COLLECTED'],
    ] as const) {
      db.execute(
        `INSERT INTO orders (id, shop_id, order_number, token_number, customer_name, customer_phone, customer_email, channel, status, payment_status, payment_method, total_amount_paise, currency, quote_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, 'QR_PORTAL', ?, 'PENDING', 'CASH_ON_COLLECTION', ?, 'INR', 'test-v1', ?, ?)`,
        [`page-order-${suffix}`, shopId, `PAGEFIX-${suffix}`, `T-PAGE-${suffix}`, `Pagination Customer`, '+919000000000', status, amount, createdAt, createdAt]
      );
    }
  });

  after(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    db?.close();
  });

  it('returns deterministic tenant-scoped pages with search, filtering and sort metadata', async () => {
    const headers = { Authorization: `Bearer ${ownerToken}` };
    const pageOne = await fetch(`${baseUrl}/api/v1/merchant/orders?status=AWAITING_REVIEW&page=1&pageSize=2&search=PAGEFIX-&sortBy=orderNumber&sortOrder=asc`, { headers });
    assert.equal(pageOne.status, 200);
    const first = await pageOne.json() as any;
    assert.deepEqual(first.orders.map((order: any) => order.orderNumber), ['PAGEFIX-A', 'PAGEFIX-B']);
    assert.equal(first.total, 3);
    assert.equal(first.page, 1);
    assert.equal(first.pageSize, 2);
    assert.equal(first.totalPages, 2);

    const pageTwo = await fetch(`${baseUrl}/api/v1/merchant/orders?status=AWAITING_REVIEW&page=2&pageSize=2&search=PAGEFIX-&sortBy=orderNumber&sortOrder=asc`, { headers });
    assert.equal(pageTwo.status, 200);
    const second = await pageTwo.json() as any;
    assert.deepEqual(second.orders.map((order: any) => order.orderNumber), ['PAGEFIX-C']);
    assert.equal(second.total, 3);
  });

  it('validates filters and paging limits while preserving the legacy array response', async () => {
    const headers = { Authorization: `Bearer ${ownerToken}` };
    const invalid = await fetch(`${baseUrl}/api/v1/merchant/orders?page=0&pageSize=101`, { headers });
    assert.equal(invalid.status, 400);
    const invalidStatus = await fetch(`${baseUrl}/api/v1/merchant/orders?status=NOT_A_STATUS`, { headers });
    assert.equal(invalidStatus.status, 400);
    const legacy = await fetch(`${baseUrl}/api/v1/merchant/orders?status=AWAITING_REVIEW`, { headers });
    assert.equal(legacy.status, 200);
    assert.ok(Array.isArray(await legacy.json()));
    const crossTenant = await fetch(`${baseUrl}/api/v1/merchant/orders?shopId=another-shop&page=1`, { headers });
    assert.equal(crossTenant.status, 403);
  });

  it('supports queue tabs that map to multiple persisted statuses', async () => {
    const response = await fetch(`${baseUrl}/api/v1/merchant/orders?status=AWAITING_REVIEW,COLLECTED&page=1&pageSize=10&search=PAGEFIX-&sortBy=orderNumber&sortOrder=asc`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(response.status, 200);
    const result = await response.json() as any;
    assert.deepEqual(result.orders.map((order: any) => order.orderNumber), ['PAGEFIX-A', 'PAGEFIX-B', 'PAGEFIX-C', 'PAGEFIX-D']);
    assert.equal(result.total, 4);
  });
});
