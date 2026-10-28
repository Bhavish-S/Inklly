import { after, before, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { DatabaseService } from '@inklly/db';
import { createApp } from '../index';
import { getPrinterHealthStatus, PRINTER_HEARTBEAT_STALE_AFTER_MS } from '../services/printer-health';

describe('merchant printer health evidence', { concurrency: false }, () => {
  let db: DatabaseService;
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    db = new DatabaseService(':memory:');
    const app = createApp(db);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    db?.close();
  });

  it('distinguishes online, offline, stale, and unknown heartbeat evidence', () => {
    const now = Date.now();
    const fresh = new Date(now - 5_000).toISOString();
    const stale = new Date(now - PRINTER_HEARTBEAT_STALE_AFTER_MS - 1).toISOString();

    assert.equal(getPrinterHealthStatus(true, fresh, now), 'ONLINE');
    assert.equal(getPrinterHealthStatus(false, fresh, now), 'OFFLINE');
    assert.equal(getPrinterHealthStatus(true, stale, now), 'STALE');
    assert.equal(getPrinterHealthStatus(true, '', now), 'UNKNOWN');
    assert.equal(getPrinterHealthStatus(true, 'not-a-date', now), 'UNKNOWN');
    assert.equal(getPrinterHealthStatus(true, new Date(now + 1_000).toISOString(), now), 'UNKNOWN');
  });

  it('reports stale inventory and refuses dispatch despite the stored isOnline flag', async () => {
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@campusprint.in', password: 'DemoOwnerPassword123!' }),
    });
    assert.equal(login.status, 200);
    const { token } = await login.json() as { token: string };
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const printer = db.queryOne<any>(`SELECT id, is_online, last_heartbeat FROM printers WHERE id = 'printer-hp-laserjet'`);
    const order = db.queryOne<any>(`SELECT id, status FROM orders WHERE id = 'order-demo-001'`);
    assert.ok(printer?.is_online);
    assert.equal(order?.status, 'AWAITING_REVIEW');

    const staleHeartbeat = new Date(Date.now() - PRINTER_HEARTBEAT_STALE_AFTER_MS - 1).toISOString();
    db.execute(`UPDATE printers SET is_online = 1, last_heartbeat = ? WHERE id = ?`, [staleHeartbeat, printer.id]);
    try {
      const inventoryResponse = await fetch(`${baseUrl}/api/v1/merchant/printers`, { headers });
      assert.equal(inventoryResponse.status, 200);
      const inventory = await inventoryResponse.json() as Array<{ id: string; isOnline: boolean; healthStatus: string }>;
      const reported = inventory.find((candidate) => candidate.id === printer.id);
      assert.equal(reported?.isOnline, true, 'preserve the existing persisted API field');
      assert.equal(reported?.healthStatus, 'STALE');

      const dispatchResponse = await fetch(`${baseUrl}/api/v1/merchant/orders/${order.id}/print`, {
        method: 'POST', headers, body: JSON.stringify({ printerId: printer.id }),
      });
      assert.equal(dispatchResponse.status, 409);
      assert.match((await dispatchResponse.json() as any).error, /online printer/i);
      assert.equal(db.queryOne<any>(`SELECT status FROM orders WHERE id = ?`, [order.id]).status, 'AWAITING_REVIEW');
      assert.equal(db.queryOne<any>(`SELECT printer_id FROM print_jobs WHERE order_id = ?`, [order.id]).printer_id, null);
    } finally {
      db.execute(`UPDATE printers SET is_online = ?, last_heartbeat = ? WHERE id = ?`, [printer.is_online, printer.last_heartbeat, printer.id]);
    }
  });

  it('persists a single default printer for the authenticated shop and rejects foreign printer IDs', async () => {
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@campusprint.in', password: 'DemoOwnerPassword123!' }),
    });
    assert.equal(login.status, 200);
    const { token } = await login.json() as { token: string };
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO shops (id, organization_id, shop_code, name, phone, email, address, city, state, pin_code, created_at, updated_at)
       VALUES ('shop-foreign-printer', 'org-campus-network', 'foreign-printer-shop', 'Foreign Shop', '+91 90000 00000', 'foreign@example.invalid', 'Market Road', 'Pune', 'Maharashtra', '411001', ?, ?)`,
      [now, now]
    );
    db.execute(
      `INSERT INTO printers (id, shop_id, name, system_driver_name, is_online, is_default, supports_color, supports_duplex, last_heartbeat, created_at, updated_at)
       VALUES ('printer-foreign-shop', 'shop-foreign-printer', 'Foreign Queue', 'Foreign Driver', 0, 0, 0, 0, NULL, ?, ?)`,
      [now, now]
    );

    const before = db.query<any>(`SELECT id, is_default FROM printers WHERE shop_id = 'shop-campus-1'`);
    const desired = before.find((printer) => printer.id !== 'printer-hp-laserjet');
    assert.ok(desired, 'seed data should contain another current-shop printer');

    const foreignResponse = await fetch(`${baseUrl}/api/v1/merchant/printers/printer-foreign-shop/default`, {
      method: 'PUT', headers, body: JSON.stringify({}),
    });
    assert.equal(foreignResponse.status, 404);
    assert.deepEqual(db.query<any>(`SELECT id, is_default FROM printers WHERE shop_id = 'shop-campus-1'`), before);

    const setResponse = await fetch(`${baseUrl}/api/v1/merchant/printers/${desired.id}/default`, {
      method: 'PUT', headers, body: JSON.stringify({}),
    });
    assert.equal(setResponse.status, 200);
    const body = await setResponse.json() as any;
    assert.equal(body.success, true);
    assert.equal(body.printers.filter((printer: any) => printer.isDefault).length, 1);
    assert.equal(body.printers.find((printer: any) => printer.id === desired.id)?.isDefault, true);
    assert.equal(db.queryOne<any>(`SELECT COUNT(*) AS count FROM printers WHERE shop_id = 'shop-campus-1' AND is_default = 1`).count, 1);
    assert.equal(db.queryOne<any>(`SELECT is_default FROM printers WHERE id = 'printer-foreign-shop'`).is_default, 0);
  });
});
