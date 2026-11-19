import { after, before, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { DatabaseService } from '@inklly/db';
import { createApp } from '../index';
import { makeTestPdf } from './test-pdf';

describe('counter features: walk-in billing, auto-print, now-serving board', { concurrency: false }, () => {
  let db: DatabaseService;
  let server: http.Server;
  let baseUrl: string;
  let headers: Record<string, string>;
  let app: ReturnType<typeof createApp>;

  before(async () => {
    db = new DatabaseService(':memory:');
    app = createApp(db);
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

  const api = (path: string, init: RequestInit = {}) => fetch(`${baseUrl}/api/v1/merchant${path}`, { ...init, headers: { ...headers, ...(init.headers as any) } });

  it('creates a default price list from the shop rates', async () => {
    const res = await api('/counter/services');
    assert.equal(res.status, 200);
    const services = await res.json() as any[];
    const bw = services.find((service) => service.kind === 'bw_page');
    assert.ok(bw);
    assert.equal(bw.unitPricePaise, 200);
    assert.ok(services.some((service) => /lamination/i.test(service.name)));
  });

  it('bills a walk-in sale at server prices and records it in the ledger and report', async () => {
    const services = await (await api('/counter/services')).json() as any[];
    const bw = services.find((service) => service.kind === 'bw_page');
    const lamination = services.find((service) => /lamination/i.test(service.name));
    const res = await api('/counter/sales', {
      method: 'POST',
      body: JSON.stringify({
        paymentMethod: 'CASH',
        customerName: 'Walk-in',
        items: [
          { serviceId: bw.id, quantity: 25, unitPricePaise: 1 }, // client price is ignored
          { serviceId: lamination.id, quantity: 2 },
          { name: 'Stapling', unitPricePaise: 500, quantity: 1 },
        ],
      }),
    });
    assert.equal(res.status, 201);
    const { sale } = await res.json() as any;
    assert.equal(sale.totalPaise, 25 * 200 + 2 * lamination.unitPricePaise + 500);
    assert.match(sale.saleNumber, /^W-\d{6}-\d{3}$/);
    const ledger = db.queryOne<any>(`SELECT amount_paise, provider FROM ledger_entries WHERE provider_transaction_id = ?`, [`counter-${sale.id}`]);
    assert.equal(Number(ledger.amount_paise), sale.totalPaise);
    assert.equal(ledger.provider, 'MANUAL_CASH');

    const today = new Date().toISOString().slice(0, 10);
    const report = await (await api(`/reports/daily?date=${today}&tzOffsetMinutes=0`)).json() as any;
    assert.equal(report.counterSales.count, 1);
    assert.ok(report.pages.bw >= 25);
    assert.ok(report.revenue.cashPaise >= sale.totalPaise);
  });

  it('rejects bad sales and cancels a sale with a reversing ledger entry', async () => {
    assert.equal((await api('/counter/sales', { method: 'POST', body: JSON.stringify({ paymentMethod: 'CARD', items: [{ name: 'x', unitPricePaise: 100, quantity: 1 }] }) })).status, 400);
    assert.equal((await api('/counter/sales', { method: 'POST', body: JSON.stringify({ paymentMethod: 'CASH', items: [{ serviceId: 'svc-not-mine', quantity: 1 }] }) })).status, 400);
    assert.equal((await api('/counter/sales', { method: 'POST', body: JSON.stringify({ paymentMethod: 'CASH', items: [{ name: 'Free', unitPricePaise: 0, quantity: 1 }] }) })).status, 400);

    const created = await (await api('/counter/sales', { method: 'POST', body: JSON.stringify({ paymentMethod: 'UPI', items: [{ name: 'Binding', unitPricePaise: 4000, quantity: 1 }] }) })).json() as any;
    assert.equal(created.sale.paymentMethod, 'UPI');
    assert.equal((await api(`/counter/sales/${created.sale.id}/void`, { method: 'POST', body: JSON.stringify({ reason: '' }) })).status, 400);
    const voided = await api(`/counter/sales/${created.sale.id}/void`, { method: 'POST', body: JSON.stringify({ reason: 'Customer changed mind' }) });
    assert.equal(voided.status, 200);
    assert.ok((await voided.json() as any).voidedAt);
    const reversal = db.queryOne<any>(`SELECT amount_paise FROM ledger_entries WHERE provider_transaction_id = ?`, [`counter-void-${created.sale.id}`]);
    assert.equal(Number(reversal.amount_paise), -4000);
    assert.equal((await api(`/counter/sales/${created.sale.id}/void`, { method: 'POST', body: JSON.stringify({ reason: 'again please' }) })).status, 409);

    const list = await (await api(`/counter/sales?tzOffsetMinutes=0`)).json() as any;
    assert.ok(list.sales.length >= 2);
  });

  it('saves the UPI ID and gives a UPI payment link for the total', async () => {
    assert.equal((await api('/counter/settings', { method: 'PUT', body: JSON.stringify({ upiId: 'not a upi' }) })).status, 400);
    const saved = await api('/counter/settings', { method: 'PUT', body: JSON.stringify({ upiId: 'campusprint@okaxis', upiPayeeName: 'Campus Print' }) });
    assert.equal(saved.status, 200);
    const quote = await (await api('/counter/sales/quote', { method: 'POST', body: JSON.stringify({ items: [{ name: 'Xerox', unitPricePaise: 250, quantity: 4 }] }) })).json() as any;
    assert.equal(quote.totalPaise, 1000);
    assert.match(quote.upiLink, /^upi:\/\/pay\?pa=campusprint%40okaxis&pn=Campus\+Print&am=10\.00&cu=INR/);
  });

  it('auto-prints a new order to a ready printer when the shop turns it on', async () => {
    // Pair an agent that reports a ready A4 mono printer.
    const pairing = await (await api('/agents/pairing-code', { method: 'POST' })).json() as any;
    const enrolled = await (await fetch(`${baseUrl}/api/v1/agent/enroll`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: pairing.shopId, pairingCode: pairing.pairingCode }),
    })).json() as any;
    const agentHeaders = { 'Content-Type': 'application/json', 'X-Agent-Id': enrolled.agentId, Authorization: `Bearer ${enrolled.agentSecret}` };
    const beat = await fetch(`${baseUrl}/api/v1/agent/heartbeat`, {
      method: 'POST', headers: agentHeaders,
      body: JSON.stringify({ status: 'ONLINE', activePrintersCount: 1, localQueueDepth: 0, sqliteCacheHealthy: true, physicalPrintingEnabled: true,
        printers: [{ name: 'Auto_Laser', driverName: 'Generic Laser', isOnline: true, isDefault: false, capabilities: { color: false, duplex: true, paperSizes: ['A4'] } }] }),
    });
    assert.equal(beat.status, 200);
    // Keep only this printer online so routing is deterministic.
    db.execute(`UPDATE printers SET is_online = 0 WHERE shop_id = 'shop-campus-1' AND name <> 'Auto_Laser'`);

    const upload = await (await fetch(`${baseUrl}/api/v1/portal/upload`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: 'shop-campus-1', fileName: 'auto.pdf', fileData: makeTestPdf(2).toString('base64'), pageCount: 2 }),
    })).json() as any;
    const options = { colorMode: 'bw', duplexMode: 'simplex', paperSize: 'A4', orientation: 'portrait', copies: 1, fitMode: 'fit', pagesPerSheet: 1, collation: true };
    const order = await (await fetch(`${baseUrl}/api/v1/portal/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: 'shop-campus-1', customerName: 'Auto Print', customerPhone: '9000000011', paymentMethod: 'CASH_ON_COLLECTION', quote: { totalPaise: 400 },
        files: [{ fileName: 'auto.pdf', storageKey: upload.storageKey, pageCount: 2, options, subtotalPaise: 400 }] }),
    })).json() as any;
    assert.ok(order.orderId);

    // Off by default: nothing is sent.
    app.locals.runAutoPrintPass();
    assert.notEqual(db.queryOne<any>(`SELECT status FROM orders WHERE id = ?`, [order.orderId]).status, 'IN_PROGRESS');

    // "paid" waits for payment, so a cash order is still not sent.
    await api('/counter/settings', { method: 'PUT', body: JSON.stringify({ autoPrint: 'paid' }) });
    app.locals.runAutoPrintPass();
    assert.notEqual(db.queryOne<any>(`SELECT status FROM orders WHERE id = ?`, [order.orderId]).status, 'IN_PROGRESS');

    await api('/counter/settings', { method: 'PUT', body: JSON.stringify({ autoPrint: 'all' }) });
    assert.ok(app.locals.runAutoPrintPass() >= 1);
    assert.equal(db.queryOne<any>(`SELECT status FROM orders WHERE id = ?`, [order.orderId]).status, 'IN_PROGRESS');
    const job = db.queryOne<any>(`SELECT p.name FROM print_jobs j JOIN printers p ON p.id = j.printer_id WHERE j.order_id = ?`, [order.orderId]);
    assert.equal(job.name, 'Auto_Laser');
    assert.ok(db.queryOne<any>(`SELECT id FROM audit_events WHERE action = 'ORDER_AUTO_PRINTED' AND target_id = ?`, [order.orderId]));
    await api('/counter/settings', { method: 'PUT', body: JSON.stringify({ autoPrint: 'off' }) });
  });

  it('shows tokens, not names, on the public now-serving board', async () => {
    const res = await fetch(`${baseUrl}/api/v1/portal/shop/campus1/display`);
    assert.equal(res.status, 200);
    const board = await res.json() as any;
    assert.equal(board.shopName, 'Campus Print Express');
    assert.ok(Array.isArray(board.ready) && Array.isArray(board.preparing));
    assert.ok(board.preparing.length + board.ready.length > 0);
    assert.equal(JSON.stringify(board).includes('Auto Print'), false);
    assert.equal((await fetch(`${baseUrl}/api/v1/portal/shop/no-such-shop/display`)).status, 404);
  });
});
