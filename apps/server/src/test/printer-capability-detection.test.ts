import { after, before, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { DatabaseService } from '@inklly/db';
import { createApp } from '../index';
import { expireAbandonedOnlineOrders } from '../services/abandoned-order-expiry';

describe('driver-detected printer capabilities', { concurrency: false }, () => {
  let db: DatabaseService;
  let server: http.Server;
  let baseUrl: string;
  let agentHeaders: Record<string, string>;
  let shopId: string;

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
    const pairing = await fetch(`${baseUrl}/api/v1/merchant/agents/pairing-code`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const { pairingCode, shopId: pairedShopId } = await pairing.json() as any;
    shopId = pairedShopId;
    const enroll = await fetch(`${baseUrl}/api/v1/agent/enroll`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId, pairingCode, hostname: 'counter-pc', osPlatform: 'darwin' }),
    });
    assert.equal(enroll.status, 201);
    const { agentId, agentSecret } = await enroll.json() as any;
    agentHeaders = { 'Content-Type': 'application/json', 'X-Agent-Id': agentId, Authorization: `Bearer ${agentSecret}` };
  });

  after(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    db?.close();
  });

  const heartbeat = (printers: unknown[]) => fetch(`${baseUrl}/api/v1/agent/heartbeat`, {
    method: 'POST', headers: agentHeaders,
    body: JSON.stringify({ status: 'ONLINE', activePrintersCount: printers.length, localQueueDepth: 0, sqliteCacheHealthy: true, physicalPrintingEnabled: true, printers }),
  });

  it('makes a newly discovered queue ready using its driver capabilities', async () => {
    const res = await heartbeat([{ name: 'Brother_HL_L2350DW', driverName: 'Brother HL-L2350DW', isOnline: true, isDefault: false,
      capabilities: { color: false, duplex: true, paperSizes: ['A4'] } }]);
    assert.equal(res.status, 200);
    const printer = db.queryOne<any>(`SELECT id, supports_color, supports_duplex FROM printers WHERE shop_id = ? AND name = 'Brother_HL_L2350DW'`, [shopId]);
    assert.ok(printer);
    assert.equal(Number(printer.supports_color), 0);
    assert.equal(Number(printer.supports_duplex), 1);
    const trays = db.query<any>(`SELECT supported_sizes FROM paper_trays WHERE printer_id = ?`, [printer.id]);
    assert.deepEqual(trays.map((tray) => JSON.parse(tray.supported_sizes)), [['A4']]);
  });

  it('never overwrites a merchant-saved profile', async () => {
    const printer = db.queryOne<any>(`SELECT id FROM printers WHERE shop_id = ? AND name = 'Brother_HL_L2350DW'`, [shopId]);
    db.execute(`DELETE FROM paper_trays WHERE printer_id = ?`, [printer.id]);
    db.execute(`INSERT INTO paper_trays (id, printer_id, name, supported_sizes, is_default) VALUES ('tray-manual', ?, 'Tray 1', '["A4","A3"]', 1)`, [printer.id]);
    db.execute(`UPDATE printers SET supports_color = 1 WHERE id = ?`, [printer.id]);
    await heartbeat([{ name: 'Brother_HL_L2350DW', driverName: 'Brother HL-L2350DW', isOnline: true, isDefault: false,
      capabilities: { color: false, duplex: false, paperSizes: ['A4'] } }]);
    const after = db.queryOne<any>(`SELECT supports_color, supports_duplex FROM printers WHERE id = ?`, [printer.id]);
    assert.equal(Number(after.supports_color), 1);
    assert.equal(Number(after.supports_duplex), 1);
    const trays = db.query<any>(`SELECT id FROM paper_trays WHERE printer_id = ?`, [printer.id]);
    assert.deepEqual(trays.map((tray) => tray.id), ['tray-manual']);
  });

  it('rejects malformed capability reports without changing inventory', async () => {
    const res = await heartbeat([{ name: 'Bad', driverName: 'Bad', isOnline: true, isDefault: false, capabilities: { color: 'yes', duplex: null, paperSizes: ['A4'] } }]);
    assert.equal(res.status, 400);
    assert.equal(db.queryOne<any>(`SELECT id FROM printers WHERE shop_id = ? AND name = 'Bad'`, [shopId]), null);
  });
});

describe('abandoned online checkout expiry', { concurrency: false }, () => {
  it('cancels only online orders that never reached Razorpay', () => {
    const db = new DatabaseService(':memory:');
    createApp(db); // seeds the demo shop the orders belong to
    try {
      const old = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const fresh = new Date().toISOString();
      const insert = (id: string, createdAt: string, method = 'ONLINE_RAZORPAY') => db.execute(
        `INSERT INTO orders (id, shop_id, order_number, token_number, status, payment_status, payment_method, total_amount_paise, currency, quote_version, created_at, updated_at)
         VALUES (?, 'shop-campus-1', ?, ?, 'AWAITING_PAYMENT', 'NOT_STARTED', ?, 500, 'INR', 'v1', ?, ?)`,
        [id, `ORD-${id}`, id.slice(-4), method, createdAt, createdAt]
      );
      insert('abandoned-1', old);
      insert('pending-pay', old);
      insert('recent-1', fresh);
      insert('cash-1', old, 'CASH_ON_COLLECTION');
      db.execute(`INSERT INTO payments (id, order_id, provider, amount_paise, currency, status, created_at, updated_at) VALUES ('pay-1', 'pending-pay', 'RAZORPAY', 500, 'INR', 'PENDING', ?, ?)`, [old, old]);

      assert.equal(expireAbandonedOnlineOrders(db), 1);
      const status = (id: string) => db.queryOne<any>(`SELECT status, payment_status FROM orders WHERE id = ?`, [id]);
      assert.deepEqual({ ...status('abandoned-1') }, { status: 'CANCELLED', payment_status: 'EXPIRED' });
      assert.equal(status('pending-pay').status, 'AWAITING_PAYMENT');
      assert.equal(status('recent-1').status, 'AWAITING_PAYMENT');
      assert.equal(status('cash-1').status, 'AWAITING_PAYMENT');
      assert.equal(expireAbandonedOnlineOrders(db), 0);
    } finally {
      db.close();
    }
  });
});
