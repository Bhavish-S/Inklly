import { after, before, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { DatabaseService } from '@inklly/db';
import { createApp } from '../index';
import { haversineKm, isOpenAt } from '../services/shop-profiles';

describe('shop map: nearby search and merchant shop profile', { concurrency: false }, () => {
  let db: DatabaseService;
  let server: http.Server;
  let baseUrl: string;
  let headers: Record<string, string>;

  const now = new Date().toISOString();
  const addShop = (id: string, code: string, name: string, city: string, opts: { active?: boolean; listed?: boolean; lat?: number | null; lng?: number | null; cash?: boolean } = {}) => {
    db.execute(
      `INSERT INTO shops (id, organization_id, shop_code, name, tagline, phone, email, address, city, state, pin_code, accept_cash_on_collection, is_active, created_at, updated_at)
       VALUES (?, 'org-campus-network', ?, ?, NULL, '+91 90000 00000', ?, ?, ?, 'Karnataka', '560001', ?, ?, ?, ?)`,
      [id, code, name, `${code}@example.test`, `${name} Road`, city, opts.cash === false ? 0 : 1, opts.active === false ? 0 : 1, now, now]
    );
    db.execute(
      `INSERT INTO shop_profiles (shop_id, latitude, longitude, landmark, opening_hours, listed_on_map, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, opts.lat === undefined ? null : opts.lat, opts.lng === undefined ? null : opts.lng, 'Near the bus stop', '{"open":"00:00","close":"00:00","closedDays":[]}', opts.listed === false ? 0 : 1, now]
    );
  };

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

    // Around MG Road, Bengaluru (12.9756, 77.6050).
    addShop('shop-map-near', 'mapnear', 'Near Xerox', 'Bengaluru', { lat: 12.9760, lng: 77.6055 });
    addShop('shop-map-mid', 'mapmid', 'Mid Prints', 'Bengaluru', { lat: 12.9352, lng: 77.6245, cash: false });
    addShop('shop-map-far', 'mapfar', 'Far Copies', 'Mysuru', { lat: 12.2958, lng: 76.6394 });
    addShop('shop-map-unlisted', 'mapunlisted', 'Hidden Prints', 'Bengaluru', { lat: 12.9757, lng: 77.6051, listed: false });
    addShop('shop-map-inactive', 'mapinactive', 'Closed Down Xerox', 'Bengaluru', { lat: 12.9758, lng: 77.6052, active: false });
    addShop('shop-map-nocoords', 'mapnocoords', 'No Pin Xerox', 'Bengaluru');
    db.execute(`INSERT INTO shop_counter_settings (shop_id, auto_print, upi_id, upi_payee_name, updated_at) VALUES ('shop-map-near', 'off', 'near@okaxis', NULL, ?)`, [now]);
    db.execute(`INSERT INTO shop_operating_status (shop_id, accepting_orders, pause_message, updated_at) VALUES ('shop-map-mid', 0, 'Back soon', ?)`, [now]);
  });

  after(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    db?.close();
  });

  const nearby = async (query: string) => {
    const res = await fetch(`${baseUrl}/api/v1/portal/shops/nearby${query}`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('cache-control') || '', /max-age=30/);
    return (await res.json() as any).shops as any[];
  };

  it('computes Haversine distance', () => {
    const km = haversineKm(12.9716, 77.5946, 13.0827, 80.2707); // Bengaluru -> Chennai
    assert.ok(km > 285 && km < 295, `got ${km}`);
    assert.equal(haversineKm(12.97, 77.59, 12.97, 77.59), 0);
  });

  it('sorts nearby shops by distance within the radius with the full contract', async () => {
    const shops = await nearby('?lat=12.9756&lng=77.6050&radiusKm=25');
    assert.deepEqual(shops.map((s) => s.shopCode), ['mapnear', 'mapmid']);
    const [near, mid] = shops;
    assert.deepEqual(Object.keys(near).sort(), [
      'acceptingOrders', 'acceptsCash', 'acceptsUpi', 'address', 'city', 'distanceKm', 'isOpenNow', 'landmark',
      'latitude', 'longitude', 'name', 'openingHours', 'portalPath', 'shopCode', 'tagline',
    ]);
    assert.ok(near.distanceKm < 0.2);
    assert.ok(mid.distanceKm > 4 && mid.distanceKm < 6, `got ${mid.distanceKm}`);
    assert.equal(near.portalPath, '/p/mapnear');
    assert.equal(near.acceptsUpi, true);
    assert.equal(near.acceptsCash, true);
    assert.equal(near.acceptingOrders, true);
    assert.equal(near.isOpenNow, true);
    assert.deepEqual(near.openingHours, { open: '00:00', close: '00:00', closedDays: [] });
    assert.equal(mid.acceptsUpi, false);
    assert.equal(mid.acceptsCash, false);
    assert.equal(mid.acceptingOrders, false);

    const wide = await nearby('?lat=12.9756&lng=77.6050&radiusKm=200&limit=2');
    assert.deepEqual(wide.map((s) => s.shopCode), ['mapnear', 'mapmid']);
    const all = await nearby('?lat=12.9756&lng=77.6050&radiusKm=200');
    assert.equal(all[all.length - 1].shopCode, 'mapfar');
  });

  it('hides unlisted, inactive and unpinned shops and lists by name without a location', async () => {
    const shops = await nearby('');
    const codes = shops.map((s) => s.shopCode);
    for (const hidden of ['mapunlisted', 'mapinactive', 'mapnocoords']) assert.ok(!codes.includes(hidden), hidden);
    assert.deepEqual(codes, ['mapfar', 'mapmid', 'mapnear']);
    assert.ok(shops.every((s) => s.distanceKm === null));

    const search = await nearby('?q=mysuru');
    assert.deepEqual(search.map((s) => s.shopCode), ['mapfar']);
    const byName = await nearby('?q=XEROX&lat=12.9756&lng=77.6050');
    assert.deepEqual(byName.map((s) => s.shopCode), ['mapnear']);
  });

  it('works out open/closed in shop time, including overnight hours', () => {
    const hours = { open: '09:00', close: '21:00', closedDays: [0] };
    assert.equal(isOpenAt(hours, new Date('2026-11-18T06:30:00Z')), true);  // Wed 12:00 IST
    assert.equal(isOpenAt(hours, new Date('2026-11-18T16:30:00Z')), false); // Wed 22:00 IST
    assert.equal(isOpenAt(hours, new Date('2026-11-22T06:30:00Z')), false); // Sun 12:00 IST
    const overnight = { open: '20:00', close: '02:00', closedDays: [] };
    assert.equal(isOpenAt(overnight, new Date('2026-11-18T19:30:00Z')), true); // Thu 01:00 IST
    assert.equal(isOpenAt(null), null);
  });

  it('validates and saves the merchant shop profile', async () => {
    const api = (init: RequestInit = {}) => fetch(`${baseUrl}/api/v1/merchant/shop-profile`, { ...init, headers });
    const put = (body: unknown) => api({ method: 'PUT', body: JSON.stringify(body) });

    assert.equal((await fetch(`${baseUrl}/api/v1/merchant/shop-profile`)).status, 401);
    const initial = await api();
    assert.equal(initial.status, 200);
    assert.equal((await initial.json() as any).listedOnMap, true);

    assert.equal((await put({ latitude: 95, longitude: 77 })).status, 400);
    assert.equal((await put({ latitude: 12.9, longitude: 181 })).status, 400);
    assert.equal((await put({ latitude: 'abc', longitude: 77 })).status, 400);
    assert.equal((await put({ latitude: 12.9 })).status, 400); // only one coordinate
    assert.equal((await put({ latitude: 18.52, longitude: 73.85, openingHours: { open: '9am', close: '21:00' } })).status, 400);
    assert.equal((await put({ latitude: 18.52, longitude: 73.85, openingHours: { open: '09:00', close: '21:00', closedDays: [7] } })).status, 400);
    assert.equal((await put({ latitude: 18.52, longitude: 73.85, listedOnMap: 'yes' })).status, 400);
    assert.equal((await put({ latitude: 18.52, longitude: 73.85, landmark: 'x'.repeat(121) })).status, 400);

    const saved = await put({ latitude: 18.5204, longitude: 73.8567, landmark: ' Opp. FC College ', openingHours: { open: '09:00', close: '21:00', closedDays: [0] }, listedOnMap: true });
    assert.equal(saved.status, 200);
    const profile = await saved.json() as any;
    assert.equal(profile.landmark, 'Opp. FC College');
    assert.deepEqual(profile.openingHours, { open: '09:00', close: '21:00', closedDays: [0] });
    const stored = db.queryOne<any>(`SELECT opening_hours, listed_on_map FROM shop_profiles WHERE shop_id = 'shop-campus-1'`);
    assert.deepEqual(JSON.parse(stored.opening_hours), { open: '09:00', close: '21:00', closedDays: [0] });

    const pune = await nearby('?lat=18.52&lng=73.85&radiusKm=5');
    assert.deepEqual(pune.map((s) => s.shopCode), ['campus1']);
    assert.equal(pune[0].landmark, 'Opp. FC College');

    // Partial update keeps the other fields; unlisting hides the shop at once.
    const hidden = await put({ listedOnMap: false });
    assert.equal(hidden.status, 200);
    assert.equal((await hidden.json() as any).latitude, 18.5204);
    assert.deepEqual(await nearby('?lat=18.52&lng=73.85&radiusKm=5'), []);
  });
});
