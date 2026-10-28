import { after, before, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { DatabaseService } from '@inklly/db';
import { createApp } from '../index';

describe('merchant rate rule printer ownership', { concurrency: false }, () => {
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

    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO shops (id, organization_id, shop_code, name, phone, email, address, city, state, pin_code, created_at, updated_at)
       VALUES ('shop-second-counter', 'org-campus-network', 'second-counter', 'Second Counter', '+91 90000 00000', 'second@example.invalid', 'Market Road', 'Pune', 'Maharashtra', '411001', ?, ?)`,
      [now, now]
    );
    db.execute(
      `INSERT INTO printers (id, shop_id, name, system_driver_name, is_online, is_default, supports_color, supports_duplex, last_heartbeat, created_at, updated_at)
       VALUES ('printer-second-counter', 'shop-second-counter', 'Second Counter Printer', 'Second Counter Driver', 0, 0, 0, 0, NULL, ?, ?)`,
      [now, now]
    );
  });

  after(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    db?.close();
  });

  it('rejects a rate rule targeting a printer outside the authenticated shop', async () => {
    const response = await fetch(`${baseUrl}/api/v1/merchant/rates`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'cross-shop-rate', paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex',
        pricePerPrintedSidePaise: 250, printerId: 'printer-second-counter',
      }),
    });
    assert.equal(response.status, 400);
    assert.match((await response.json() as any).error, /registered to this shop/i);
    assert.equal(db.queryOne<any>(`SELECT id FROM rate_rules WHERE id = 'cross-shop-rate'`), null);
  });
});
