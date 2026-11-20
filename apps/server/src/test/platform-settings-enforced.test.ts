import { after, before, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { DatabaseService } from '@inklly/db';
import { createApp } from '../index';
import { makeTestPdf } from './test-pdf';

describe('platform settings take effect', { concurrency: false }, () => {
  let db: DatabaseService;
  let server: http.Server;
  let base: string;
  const json = { 'Content-Type': 'application/json' };
  const set = (key: string, value: unknown) => db.execute(
    `INSERT INTO platform_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value`, [key, JSON.stringify(value), new Date().toISOString()]);
  const upload = () => fetch(`${base}/api/v1/portal/upload`, { method: 'POST', headers: json,
    body: JSON.stringify({ shopId: 'shop-campus-1', fileName: 'a.pdf', fileData: makeTestPdf(1).toString('base64') }) });

  before(async () => {
    db = new DatabaseService(':memory:');
    const app = createApp(db);
    await new Promise<void>((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${(server.address() as any).port}`; r(); }); });
  });
  after(async () => { await new Promise<void>((r) => server.close(() => r())); db.close(); });

  it('maintenance blocks uploads and orders with the admin message', async () => {
    set('maintenance', { active: true, message: 'Back at 10 am' });
    const res = await upload();
    assert.equal(res.status, 503);
    assert.equal(((await res.json()) as any).error, 'Back at 10 am');
    set('maintenance', { active: false, message: '' });
    assert.equal((await upload()).status, 201);
  });

  it('closing sign-ups refuses registration', async () => {
    set('signups_open', false);
    const res = await fetch(`${base}/api/v1/auth/register`, { method: 'POST', headers: json, body: JSON.stringify({}) });
    assert.equal(res.status, 403);
    set('signups_open', true);
  });

  it('map switch hides nearby shops; Razorpay switch hides online checkout; upload limit is reported', async () => {
    set('feature_flags', { map_discovery: false, upi_direct: true, razorpay_online: false });
    const nearby = await (await fetch(`${base}/api/v1/portal/shops/nearby`)).json() as any;
    assert.deepEqual(nearby, { shops: [], disabled: true });
    set('max_upload_mb', 5);
    const shop = await (await fetch(`${base}/api/v1/portal/shop/campus1`)).json() as any;
    assert.equal(shop.onlinePaymentAvailable, false);
    assert.equal(shop.maxUploadMb, 5);
  });
});
