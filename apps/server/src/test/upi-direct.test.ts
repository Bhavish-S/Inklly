import { after, before, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { DatabaseService } from '@inklly/db';
import { createApp } from '../index';
import { makeTestPdf } from './test-pdf';

describe('direct UPI payments to the shop', { concurrency: false }, () => {
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

  const json = { 'Content-Type': 'application/json' };
  const base = { colorMode: 'bw', duplexMode: 'simplex', paperSize: 'A4', orientation: 'portrait', copies: 1, fitMode: 'fit', pagesPerSheet: 1, collation: true };

  const placeOrder = async (paymentMethod: string) => {
    const upload = await (await fetch(`${baseUrl}/api/v1/portal/upload`, {
      method: 'POST', headers: json,
      body: JSON.stringify({ shopId: 'shop-campus-1', fileName: 'notes.pdf', fileData: makeTestPdf(3).toString('base64') }),
    })).json() as any;
    const res = await fetch(`${baseUrl}/api/v1/portal/orders`, {
      method: 'POST', headers: json,
      body: JSON.stringify({ shopId: 'shop-campus-1', customerName: 'UPI Buyer', customerPhone: '9000000099', paymentMethod,
        files: [{ fileName: 'notes.pdf', storageKey: upload.storageKey, pageCount: 3, options: base }] }),
    });
    return { status: res.status, body: await res.json() as any };
  };

  it('is unavailable until the shop adds its UPI ID', async () => {
    const shop = await (await fetch(`${baseUrl}/api/v1/portal/shop/campus1`)).json() as any;
    assert.equal(shop.upiDirectAvailable, false);
    const refused = await placeOrder('UPI_DIRECT');
    assert.equal(refused.status, 422);
  });

  it('gives a fixed-amount UPI link to the shop, records the claim, and the counter confirms it', async () => {
    const saved = await fetch(`${baseUrl}/api/v1/merchant/counter/settings`, { method: 'PUT', headers, body: JSON.stringify({ upiId: 'campusprint@ybl', upiPayeeName: 'Campus Print' }) });
    assert.equal(saved.status, 200);
    const shop = await (await fetch(`${baseUrl}/api/v1/portal/shop/campus1`)).json() as any;
    assert.equal(shop.upiDirectAvailable, true);

    const { status, body: order } = await placeOrder('UPI_DIRECT');
    assert.equal(status, 201, JSON.stringify(order));
    assert.equal(order.status, 'AWAITING_REVIEW');
    assert.equal(order.paymentStatus, 'PENDING');
    const amount = (order.totalAmountPaise / 100).toFixed(2);
    assert.equal(order.upiPayment.amount, amount);
    assert.equal(order.upiPayment.upiId, 'campusprint@ybl');
    assert.match(order.upiPayment.uri, new RegExp(`^upi://pay\\?pa=campusprint%40ybl&pn=Campus%20Print&am=${amount.replace('.', '\\.')}&cu=INR&tn=`));

    const tracked = await (await fetch(`${baseUrl}/api/v1/portal/orders/${order.orderId}`)).json() as any;
    assert.equal(tracked.upiPayment.uri, order.upiPayment.uri);

    assert.equal((await fetch(`${baseUrl}/api/v1/portal/orders/${order.orderId}/upi-claim`, { method: 'POST', headers: json, body: JSON.stringify({ upiReference: 'x' }) })).status, 422);
    const claim = await fetch(`${baseUrl}/api/v1/portal/orders/${order.orderId}/upi-claim`, { method: 'POST', headers: json, body: JSON.stringify({ upiReference: '412345678901', payerApp: 'phonepe' }) });
    assert.equal(claim.status, 200);

    const merchantOrder = await (await fetch(`${baseUrl}/api/v1/merchant/orders/${order.orderId}`, { headers })).json() as any;
    const presented = merchantOrder.order || merchantOrder;
    assert.equal(presented.upiClaim?.upiReference, '412345678901');

    // Counter: mark printed, then confirm the UPI credit and hand over.
    db.execute(`UPDATE orders SET status = 'READY_FOR_COLLECTION' WHERE id = ?`, [order.orderId]);
    const paid = await fetch(`${baseUrl}/api/v1/payments/orders/${order.orderId}/collect-cash`, { method: 'POST', headers, body: JSON.stringify({ method: 'UPI' }) });
    assert.equal(paid.status, 200, await paid.clone().text());
    const final = db.queryOne<any>(`SELECT status, payment_status FROM orders WHERE id = ?`, [order.orderId]);
    assert.deepEqual({ ...final }, { status: 'COLLECTED', payment_status: 'VERIFIED' });
    const after = await (await fetch(`${baseUrl}/api/v1/portal/orders/${order.orderId}`)).json() as any;
    assert.equal(after.upiPayment, null);
  });

  it('refuses a UPI claim on a cash order', async () => {
    const { body: order } = await placeOrder('CASH_ON_COLLECTION');
    const res = await fetch(`${baseUrl}/api/v1/portal/orders/${order.orderId}/upi-claim`, { method: 'POST', headers: json, body: JSON.stringify({}) });
    assert.equal(res.status, 409);
  });
});
