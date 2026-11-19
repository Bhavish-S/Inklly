import { after, before, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { DatabaseService } from '@inklly/db';
import { createApp } from '../index';
import { makeTestPdf } from './test-pdf';

describe('counter features: walk-in billing, now-serving board', { concurrency: false }, () => {
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

  it('prints each file on the printer staff choose, then takes UPI at handover', async () => {
    const pairing = await (await api('/agents/pairing-code', { method: 'POST' })).json() as any;
    const enrolled = await (await fetch(`${baseUrl}/api/v1/agent/enroll`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: pairing.shopId, pairingCode: pairing.pairingCode }),
    })).json() as any;
    const agentHeaders = { 'Content-Type': 'application/json', 'X-Agent-Id': enrolled.agentId, Authorization: `Bearer ${enrolled.agentSecret}` };
    const beat = await fetch(`${baseUrl}/api/v1/agent/heartbeat`, {
      method: 'POST', headers: agentHeaders,
      body: JSON.stringify({ status: 'ONLINE', activePrintersCount: 2, localQueueDepth: 0, sqliteCacheHealthy: true, physicalPrintingEnabled: true, printers: [
        { name: 'Counter_Laser', driverName: 'Mono Laser', isOnline: true, isDefault: false, capabilities: { color: false, duplex: true, paperSizes: ['A4'] } },
        { name: 'Colour_Inkjet', driverName: 'Colour Inkjet', isOnline: true, isDefault: false, capabilities: { color: true, duplex: false, paperSizes: ['A4'] } },
      ] }),
    });
    assert.equal(beat.status, 200);
    const printers = db.query<any>(`SELECT id, name FROM printers WHERE shop_id = 'shop-campus-1' AND name IN ('Counter_Laser', 'Colour_Inkjet')`);
    const laser = printers.find((p) => p.name === 'Counter_Laser');
    const inkjet = printers.find((p) => p.name === 'Colour_Inkjet');

    const upload = async (name: string) => (await (await fetch(`${baseUrl}/api/v1/portal/upload`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: 'shop-campus-1', fileName: name, fileData: makeTestPdf(2).toString('base64'), pageCount: 2 }),
    })).json() as any).storageKey;
    const base = { duplexMode: 'simplex', paperSize: 'A4', orientation: 'portrait', copies: 1, fitMode: 'fit', pagesPerSheet: 1, collation: true };
    const notesKey = await upload('notes.pdf');
    const coverKey = await upload('cover.pdf');
    const quote = await (await fetch(`${baseUrl}/api/v1/portal/quote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: 'shop-campus-1', files: [
        { fileName: 'notes.pdf', pageCount: 2, options: { ...base, colorMode: 'bw' } },
        { fileName: 'cover.pdf', pageCount: 2, options: { ...base, colorMode: 'color' } },
      ] }),
    })).json() as any;
    const order = await (await fetch(`${baseUrl}/api/v1/portal/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: 'shop-campus-1', customerName: 'Two Files', customerPhone: '9000000012', paymentMethod: 'CASH_ON_COLLECTION', quote: { totalPaise: quote.totalPaise },
        files: [
          { fileName: 'notes.pdf', storageKey: notesKey, pageCount: 2, options: { ...base, colorMode: 'bw' } },
          { fileName: 'cover.pdf', storageKey: coverKey, pageCount: 2, options: { ...base, colorMode: 'color' } },
        ] }),
    })).json() as any;
    assert.ok(order.orderId, JSON.stringify(order));
    const files = db.query<any>(`SELECT id, file_name FROM order_files WHERE order_id = ?`, [order.orderId]);
    const notes = files.find((f) => f.file_name === 'notes.pdf');
    const cover = files.find((f) => f.file_name === 'cover.pdf');

    // A colour file on the mono laser is refused before anything is released.
    const wrong = await api(`/orders/${order.orderId}/print`, { method: 'POST', body: JSON.stringify({ assignments: { [notes.id]: laser.id, [cover.id]: laser.id } }) });
    assert.equal(wrong.status, 409);
    assert.equal(db.queryOne<any>(`SELECT COUNT(*) AS c FROM print_jobs WHERE order_id = ? AND printer_id IS NOT NULL`, [order.orderId]).c, 0);

    const printed = await api(`/orders/${order.orderId}/print`, { method: 'POST', body: JSON.stringify({ assignments: { [notes.id]: laser.id, [cover.id]: inkjet.id } }) });
    assert.equal(printed.status, 200, await printed.clone().text());
    assert.deepEqual(((await printed.json()) as any).printers.sort(), ['Colour_Inkjet', 'Counter_Laser']);
    const jobs = db.query<any>(`SELECT order_file_id, printer_id, id FROM print_jobs WHERE order_id = ?`, [order.orderId]);
    assert.equal(jobs.find((j) => j.order_file_id === notes.id).printer_id, laser.id);
    assert.equal(jobs.find((j) => j.order_file_id === cover.id).printer_id, inkjet.id);

    // Staff check the pages, then take UPI at the counter.
    db.execute(`UPDATE print_jobs SET status = 'SUBMITTED_TO_SPOOLER' WHERE order_id = ?`, [order.orderId]);
    const reconciled = await api(`/orders/${order.orderId}/reconcile-output`, { method: 'POST', body: JSON.stringify({ reason: 'Checked both files at the counter.', physicalOutputConfirmed: true, confirmedJobIds: jobs.map((j) => j.id) }) });
    assert.equal(reconciled.status, 200, await reconciled.clone().text());
    const paid = await fetch(`${baseUrl}/api/v1/payments/orders/${order.orderId}/collect-cash`, { method: 'POST', headers, body: JSON.stringify({ method: 'UPI' }) });
    assert.equal(paid.status, 200, await paid.clone().text());
    const final = db.queryOne<any>(`SELECT status, payment_status FROM orders WHERE id = ?`, [order.orderId]);
    assert.deepEqual({ ...final }, { status: 'COLLECTED', payment_status: 'VERIFIED' });
    assert.equal(db.queryOne<any>(`SELECT provider FROM ledger_entries WHERE order_id = ?`, [order.orderId]).provider, 'COUNTER_UPI');
    assert.equal((await fetch(`${baseUrl}/api/v1/payments/orders/${order.orderId}/collect-cash`, { method: 'POST', headers, body: JSON.stringify({ method: 'CARD' }) })).status, 400);
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
