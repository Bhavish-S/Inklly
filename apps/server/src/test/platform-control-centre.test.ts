import { after, before, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { DatabaseService } from '@inklly/db';
import { createApp } from '../index';
import { createSessionToken, hashSessionToken } from '../middleware/session-token';

describe('platform control centre: settings, shops, orders, customers', { concurrency: false }, () => {
  let db: DatabaseService;
  let server: http.Server;
  let baseUrl: string;
  let ownerHeaders: Record<string, string>;
  let merchantHeaders: Record<string, string>;

  const login = async (email: string, password: string) => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    });
    assert.equal(res.status, 200);
    const { token } = await res.json() as { token: string };
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  /** A platform admin holding only the given permissions, signed in through a stored session. */
  const scopedAdmin = (permissions: string[]) => {
    const userId = `platform-admin-${crypto.randomUUID()}`;
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at, updated_at)
       VALUES (?, ?, 'unused-test-hash', 'Scoped Admin', 'PLATFORM_ADMIN', 1, ?, ?)`,
      [userId, `${userId}@inklly.test`, now, now]
    );
    for (const permission of permissions) {
      db.execute(`INSERT INTO platform_admin_permissions (user_id, permission, granted_by_user_id, granted_at) VALUES (?, ?, 'user-admin-1', ?)`, [userId, permission, now]);
    }
    const token = createSessionToken({ sessionId, userId, email: `${userId}@inklly.test`, role: 'PLATFORM_ADMIN', permissions: [] });
    db.execute(
      `INSERT INTO user_sessions (id, user_id, token_hash, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionId, userId, hashSessionToken(token), now, now, new Date(Date.now() + 60 * 60 * 1000).toISOString()]
    );
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const platform = (path: string, headers: Record<string, string>, init: RequestInit = {}) =>
    fetch(`${baseUrl}/api/v1/platform${path}`, { ...init, headers: { ...headers, ...(init.headers as any) } });

  const insertOrder = (overrides: Partial<{ status: string; paymentMethod: string; paymentStatus: string; total: number; phone: string; name: string; token: string }> = {}) => {
    const id = `order-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO orders (id, shop_id, order_number, token_number, customer_name, customer_phone, channel, status, payment_status, payment_method, total_amount_paise, currency, quote_version, created_at, updated_at)
       VALUES (?, 'shop-campus-1', ?, ?, ?, ?, 'QR_PORTAL', ?, ?, ?, ?, 'INR', 'v1', ?, ?)`,
      [id, `ORD-CC-${crypto.randomUUID().slice(0, 8)}`, overrides.token ?? '7391', overrides.name ?? 'Asha Kulkarni', overrides.phone ?? '+91 90000 12345',
        overrides.status ?? 'AWAITING_REVIEW', overrides.paymentStatus ?? 'NOT_STARTED', overrides.paymentMethod ?? 'CASH_ON_COLLECTION', overrides.total ?? 1200, now, now]
    );
    return id;
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
    ownerHeaders = await login('admin@inklly.com', 'DemoPlatformPassword123!');
    merchantHeaders = await login('owner@campusprint.in', 'DemoOwnerPassword123!');
  });

  after(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    db?.close();
  });

  it('serves safe public defaults before any settings are saved', async () => {
    const res = await fetch(`${baseUrl}/api/v1/portal/platform-config`);
    assert.equal(res.status, 200);
    const config = await res.json() as any;
    assert.equal(config.announcement, null);
    assert.deepEqual(config.featureFlags, { map_discovery: true, upi_direct: true, razorpay_online: true });
    assert.equal(typeof config.mapDefaults.latitude, 'number');
    assert.deepEqual(Object.keys(config).sort(), ['announcement', 'featureFlags', 'maintenance', 'mapDefaults', 'supportContacts']);
    assert.equal(config.maxUploadMb, undefined, 'internal limits are not public');
    assert.equal(config.signupsOpen, undefined);
  });

  it('protects the settings endpoints by role and permission', async () => {
    assert.equal((await fetch(`${baseUrl}/api/v1/platform/settings`)).status, 401);
    assert.equal((await platform('/settings', merchantHeaders)).status, 403, 'merchants cannot read platform settings');
    const viewer = scopedAdmin(['platform:view']);
    assert.equal((await platform('/settings', viewer)).status, 200);
    const denied = await platform('/settings', viewer, { method: 'PUT', body: JSON.stringify({ signupsOpen: false }) });
    assert.equal(denied.status, 403, 'platform:view cannot change settings');
    const manager = scopedAdmin(['platform:manage']);
    const allowed = await platform('/settings', manager, { method: 'PUT', body: JSON.stringify({ signupsOpen: false }) });
    assert.equal(allowed.status, 200);
    assert.equal((await allowed.json() as any).settings.signupsOpen, false);
  });

  it('validates setting updates and rejects unknown or unsafe values', async () => {
    const put = (body: unknown) => platform('/settings', ownerHeaders, { method: 'PUT', body: JSON.stringify(body) });
    assert.equal((await put({})).status, 400);
    assert.equal((await put({ unknownSetting: true })).status, 400);
    assert.equal((await put({ announcement: { tone: 'loud' } })).status, 400);
    assert.equal((await put({ announcement: { active: true, text: '' } })).status, 400, 'an empty banner cannot be switched on');
    assert.equal((await put({ maintenance: { active: true } })).status, 400, 'maintenance needs a message');
    assert.equal((await put({ mapDefaults: { latitude: 200 } })).status, 400);
    assert.equal((await put({ maxUploadMb: 0 })).status, 400);
    assert.equal((await put({ maxUploadMb: 12.5 })).status, 400);
    assert.equal((await put({ supportContacts: { phone: 'call us' } })).status, 400);
    assert.equal((await put({ featureFlags: { upi_direct: 'no' } })).status, 400);
    assert.equal((await put({ featureFlags: { teleport: true } })).status, 400);
  });

  it('saves settings, audits the change, and exposes only the public subset', async () => {
    const res = await platform('/settings', ownerHeaders, {
      method: 'PUT',
      body: JSON.stringify({
        announcement: { text: 'Diwali hours: shops close at 6 pm', tone: 'warning', active: true },
        mapDefaults: { city: 'Pune', latitude: 18.5204, longitude: 73.8567 },
        supportContacts: { phone: '+91 98765 43210', whatsapp: '+91 98765 43210' },
        maxUploadMb: 40,
        featureFlags: { upi_direct: false },
        note: 'Festival notice',
      }),
    });
    assert.equal(res.status, 200);
    const saved = await res.json() as any;
    assert.equal(saved.settings.announcement.active, true);
    assert.equal(saved.settings.maxUploadMb, 40);
    assert.deepEqual(saved.settings.featureFlags, { map_discovery: true, upi_direct: false, razorpay_online: true });
    assert.equal(saved.updatedBy.id, 'user-admin-1');
    assert.ok(saved.updatedAt);

    // Other services read the snake_case storage row directly.
    const stored = db.queryOne<any>(`SELECT setting_value, updated_by FROM platform_settings WHERE setting_key = 'feature_flags'`);
    assert.equal(JSON.parse(stored.setting_value).upi_direct, false);

    const audit = db.queryOne<any>(`SELECT details FROM audit_events WHERE action = 'PLATFORM_SETTINGS_UPDATED' ORDER BY created_at DESC LIMIT 1`);
    const details = JSON.parse(audit.details);
    assert.ok(details.changed.includes('featureFlags'));
    assert.equal(details.previous.featureFlags.upi_direct, true);
    assert.equal(details.next.featureFlags.upi_direct, false);
    assert.equal(details.note, 'Festival notice');

    const unchanged = await platform('/settings', ownerHeaders, { method: 'PUT', body: JSON.stringify({ maxUploadMb: 40 }) });
    assert.equal((await unchanged.json() as any).unchanged, true);

    const publicConfig = await (await fetch(`${baseUrl}/api/v1/portal/platform-config`)).json() as any;
    assert.deepEqual(publicConfig.announcement, { text: 'Diwali hours: shops close at 6 pm', tone: 'warning' });
    assert.equal(publicConfig.featureFlags.upi_direct, false);
    assert.equal(publicConfig.mapDefaults.city, 'Pune');
    assert.equal(publicConfig.supportContacts.phone, '+91 98765 43210');
    assert.equal(publicConfig.maxUploadMb, undefined);
  });

  it('reports live overview metrics, recent orders and alerts', async () => {
    insertOrder({ status: 'FAILED_REQUIRES_SUPPORT', token: '5501' });
    const res = await platform('/overview', ownerHeaders);
    assert.equal(res.status, 200);
    const overview = await res.json() as any;
    for (const key of ['shops', 'activeShops', 'ordersToday', 'orders7d', 'gmv7dPaise', 'printersOnline', 'agentsOnline']) {
      assert.equal(typeof overview.metrics[key], 'number', key);
    }
    assert.ok(overview.metrics.ordersToday >= 1);
    assert.ok(Array.isArray(overview.recentOrders) && overview.recentOrders.length >= 1);
    assert.ok(overview.alerts.some((alert: any) => alert.id === 'orders-need-support'));
  });

  it('searches orders across shops and records admin mark-paid and cancel with notes', async () => {
    const orderId = insertOrder({ token: '8642', phone: '+91 91111 22222', name: 'Rohan Deshmukh', total: 2450 });

    const byToken = await (await platform('/orders?search=8642', ownerHeaders)).json() as any;
    assert.ok(byToken.orders.some((order: any) => order.id === orderId));
    const byPhone = await (await platform('/orders?search=9111122222', ownerHeaders)).json() as any;
    assert.ok(byPhone.orders.some((order: any) => order.id === orderId), 'phone search ignores spaces and +91');
    const byName = await (await platform(`/orders?search=rohan&paymentMethod=CASH_ON_COLLECTION`, ownerHeaders)).json() as any;
    assert.ok(byName.orders.some((order: any) => order.id === orderId));
    const wrongMethod = await (await platform(`/orders?search=rohan&paymentMethod=UPI_DIRECT`, ownerHeaders)).json() as any;
    assert.equal(wrongMethod.orders.length, 0);
    assert.equal((await platform('/orders?paymentMethod=BITCOIN', ownerHeaders)).status, 400);
    assert.equal((await platform('/orders?status=NOPE', ownerHeaders)).status, 400);

    const detail = await (await platform(`/orders/${orderId}`, ownerHeaders)).json() as any;
    assert.equal(detail.order.tokenNumber, '8642');
    assert.equal(detail.shop.id, 'shop-campus-1');

    const viewer = scopedAdmin(['platform:view']);
    assert.equal((await platform(`/orders/${orderId}/mark-paid`, viewer, { method: 'POST', body: JSON.stringify({ note: 'Paid in cash' }) })).status, 403);
    assert.equal((await platform(`/orders/${orderId}/mark-paid`, ownerHeaders, { method: 'POST', body: JSON.stringify({}) })).status, 400, 'a note is required');
    const paid = await platform(`/orders/${orderId}/mark-paid`, ownerHeaders, { method: 'POST', body: JSON.stringify({ note: 'Shop confirmed cash by phone' }) });
    assert.equal(paid.status, 200);
    assert.equal((await paid.json() as any).order.paymentStatus, 'VERIFIED');
    const ledger = db.queryOne<any>(`SELECT amount_paise, provider FROM ledger_entries WHERE order_id = ?`, [orderId]);
    assert.equal(Number(ledger.amount_paise), 2450);
    assert.equal(ledger.provider, 'MANUAL_CASH');
    assert.equal((await platform(`/orders/${orderId}/mark-paid`, ownerHeaders, { method: 'POST', body: JSON.stringify({ note: 'Paid again?' }) })).status, 409);

    const cancelled = await platform(`/orders/${orderId}/cancel`, ownerHeaders, { method: 'POST', body: JSON.stringify({ note: 'Customer asked to cancel' }) });
    assert.equal(cancelled.status, 200);
    const cancelBody = await cancelled.json() as any;
    assert.equal(cancelBody.order.status, 'CANCELLED');
    assert.equal(cancelBody.refundRequired, true);
    assert.equal((await platform(`/orders/${orderId}/cancel`, ownerHeaders, { method: 'POST', body: JSON.stringify({ note: 'Again please' }) })).status, 409);

    const afterDetail = await (await platform(`/orders/${orderId}`, ownerHeaders)).json() as any;
    assert.deepEqual(afterDetail.adminActions.map((action: any) => action.action).sort(), ['PLATFORM_ORDER_CANCELLED', 'PLATFORM_ORDER_MARKED_PAID']);
    assert.ok(afterDetail.adminActions.some((action: any) => action.note === 'Customer asked to cancel'));

    const uncollected = insertOrder({ status: 'READY_FOR_COLLECTION', token: '2468' });
    const cancelUncollected = await platform(`/orders/${uncollected}/cancel`, ownerHeaders, { method: 'POST', body: JSON.stringify({ note: 'Customer never came back' }) });
    assert.equal(cancelUncollected.status, 200, 'printed but uncollected orders cancel through ON_HOLD');
    assert.equal((await cancelUncollected.json() as any).order.status, 'CANCELLED');
    const printing = insertOrder({ status: 'IN_PROGRESS', token: '2469' });
    assert.equal((await platform(`/orders/${printing}/cancel`, ownerHeaders, { method: 'POST', body: JSON.stringify({ note: 'Stop this print' }) })).status, 409);

    const online = insertOrder({ paymentMethod: 'ONLINE_RAZORPAY', paymentStatus: 'PENDING' });
    assert.equal((await platform(`/orders/${online}/mark-paid`, ownerHeaders, { method: 'POST', body: JSON.stringify({ note: 'Trying online' }) })).status, 409);
  });

  it('lists customers derived from orders, grouping phone formats together', async () => {
    insertOrder({ phone: '9876500001', name: 'Meera Joshi', token: '1111' });
    insertOrder({ phone: '+91 98765 00001', name: 'Meera Joshi', token: '1112' });
    const res = await platform('/customers?search=98765%2000001', ownerHeaders);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    const meera = body.customers.find((customer: any) => customer.phoneKey === '9876500001');
    assert.ok(meera);
    assert.equal(meera.orderCount, 2);
    assert.equal(meera.name, 'Meera Joshi');
  });

  it('edits, unlists, deactivates and resets the agent pairing of a shop with audit notes', async () => {
    const list = await (await platform('/shops?search=campus1', ownerHeaders)).json() as any;
    assert.ok(list.shops.some((shop: any) => shop.id === 'shop-campus-1'));
    assert.equal((await platform('/shops?status=SOMETIMES', ownerHeaders)).status, 400);

    const detail = await (await platform('/shops/shop-campus-1', ownerHeaders)).json() as any;
    assert.equal(detail.shop.shopCode, 'campus1');
    assert.ok(detail.organization.planTier);
    assert.ok(detail.revenue && typeof detail.revenue.allTimePaise === 'number');

    assert.equal((await platform('/shops/shop-campus-1', ownerHeaders, { method: 'PATCH', body: JSON.stringify({ phone: 'not a phone' }) })).status, 400);
    assert.equal((await platform('/shops/shop-campus-1', ownerHeaders, { method: 'PATCH', body: JSON.stringify({ shopCode: 'hijack' }) })).status, 400);
    const edited = await platform('/shops/shop-campus-1', ownerHeaders, {
      method: 'PATCH', body: JSON.stringify({ city: 'Pune', listedOnMap: false, note: 'Owner asked to hide from map' }),
    });
    assert.equal(edited.status, 200);
    const editedBody = await edited.json() as any;
    assert.equal(editedBody.shop.shop.city, 'Pune');
    assert.equal(editedBody.shop.profile.listedOnMap, false);
    assert.equal(Number(db.queryOne<any>(`SELECT listed_on_map FROM shop_profiles WHERE shop_id = 'shop-campus-1'`).listed_on_map), 0);

    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO agent_registrations (id, shop_id, secret_key_hash, hostname, is_active, last_heartbeat, created_at, updated_at)
       VALUES ('agent-cc-test', 'shop-campus-1', 'x', 'COUNTER-PC', 1, ?, ?, ?)`,
      [now, now, now]
    );
    assert.equal((await platform('/shops/shop-campus-1/agent-pairing/reset', ownerHeaders, { method: 'POST', body: JSON.stringify({}) })).status, 400);
    const reset = await platform('/shops/shop-campus-1/agent-pairing/reset', ownerHeaders, { method: 'POST', body: JSON.stringify({ note: 'New counter PC' }) });
    assert.equal(reset.status, 200);
    assert.ok((await reset.json() as any).revokedAgents >= 1);
    assert.equal(Number(db.queryOne<any>(`SELECT is_active FROM agent_registrations WHERE id = 'agent-cc-test'`).is_active), 0);

    assert.equal((await platform('/shops/shop-campus-1/status', ownerHeaders, { method: 'POST', body: JSON.stringify({ active: false }) })).status, 400, 'deactivation needs a note');
    const off = await platform('/shops/shop-campus-1/status', ownerHeaders, { method: 'POST', body: JSON.stringify({ active: false, note: 'Shop closed for renovation' }) });
    assert.equal(off.status, 200);
    assert.equal(Number(db.queryOne<any>(`SELECT is_active FROM shops WHERE id = 'shop-campus-1'`).is_active), 0);
    assert.ok(db.queryOne<any>(`SELECT id FROM shops WHERE id = 'shop-campus-1'`), 'deactivation never deletes the shop');
    const on = await platform('/shops/shop-campus-1/status', ownerHeaders, { method: 'POST', body: JSON.stringify({ active: true, note: 'Reopened after renovation' }) });
    assert.equal(on.status, 200);

    const actions = db.query<any>(`SELECT action FROM audit_events WHERE target_type = 'SHOP' AND target_id = 'shop-campus-1'`).map((row) => row.action);
    for (const action of ['PLATFORM_SHOP_UPDATED', 'PLATFORM_SHOP_AGENT_PAIRING_RESET', 'PLATFORM_SHOP_DEACTIVATED', 'PLATFORM_SHOP_ACTIVATED']) {
      assert.ok(actions.includes(action), action);
    }
  });
});
