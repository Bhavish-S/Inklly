import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { createApp } from '../index';
import { AgentRepository, DatabaseService } from '@inklly/db';
import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { makeTestPdf } from './test-pdf';
import { createSessionToken, hashSessionToken, verifySessionToken } from '../middleware/session-token';
import { decryptWebhookSecret, encryptWebhookSecret } from '../services/webhook-secrets';
import { ShopPaymentCredentialsService } from '../services/shop-payment-credentials';

describe('Inklly Backend API Integration Test Suite', { concurrency: false }, () => {
  let server: http.Server;
  let baseUrl: string;
  let db: DatabaseService;
  let merchantToken: string;
  let adminToken: string;
  let cashOrderId: string;
  const originalExternalApiSetting = process.env.ENABLE_EXTERNAL_API_ACCESS;
  const originalPublicUploadMinuteLimit = process.env.PUBLIC_UPLOADS_PER_MINUTE;
  const originalPublicUploadDayLimit = process.env.PUBLIC_UPLOADS_PER_DAY;

  before(async () => {
    process.env.ENABLE_EXTERNAL_API_ACCESS = 'true';
    process.env.PUBLIC_UPLOADS_PER_MINUTE = '120';
    process.env.PUBLIC_UPLOADS_PER_DAY = '10000';
    db = new DatabaseService(':memory:');
    const app = createApp(db);
    // Keep these legacy API-contract fixtures representative of a shop that
    // has opted to make contact details optional. Required-field enforcement
    // is covered explicitly in the customer-portal E2E suite.
    db.execute(
      `INSERT INTO shop_portal_settings (shop_id, settings_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(shop_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`,
      ['shop-campus-1', JSON.stringify({
        requiredFields: { name: false, phone: false },
        allowedOptions: { colorModes: ['bw', 'color', 'mixed'], duplexModes: ['simplex', 'duplex_auto'], paperSizes: ['A4', 'A3', 'PHOTO_4X6', 'PHOTO_5X7'], pageSelection: true },
      }), new Date().toISOString()]
    );
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  after(() => {
    server.close();
    db.close();
    if (originalExternalApiSetting === undefined) delete process.env.ENABLE_EXTERNAL_API_ACCESS;
    else process.env.ENABLE_EXTERNAL_API_ACCESS = originalExternalApiSetting;
    if (originalPublicUploadMinuteLimit === undefined) delete process.env.PUBLIC_UPLOADS_PER_MINUTE;
    else process.env.PUBLIC_UPLOADS_PER_MINUTE = originalPublicUploadMinuteLimit;
    if (originalPublicUploadDayLimit === undefined) delete process.env.PUBLIC_UPLOADS_PER_DAY;
    else process.env.PUBLIC_UPLOADS_PER_DAY = originalPublicUploadDayLimit;
  });

  it('Health Check responds with HEALTHY status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'HEALTHY');
    assert.ok(Object.hasOwn(body, 'revision'));
  });

  it('does not claim password recovery email was sent while delivery is unconfigured', async () => {
    const responses = await Promise.all(['owner@campusprint.in', 'unknown@example.invalid'].map((email) =>
      fetch(`${baseUrl}/api/v1/auth/password-reset/request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      })
    ));
    assert.deepEqual(responses.map((response) => response.status), [503, 503]);
    const bodies = await Promise.all(responses.map((response) => response.json() as Promise<any>));
    assert.deepEqual(bodies.map((body) => body.code), ['PASSWORD_RESET_UNAVAILABLE', 'PASSWORD_RESET_UNAVAILABLE']);
    assert.deepEqual(bodies.map((body) => body.error), [bodies[0].error, bodies[0].error]);
  });

  it('stores valid website enquiries once and rejects malformed submissions', async () => {
    const idempotencyKey = `enquiry-${crypto.randomUUID()}`;
    const payload = {
      source: 'CONTACT',
      name: 'Amit Sharma',
      phone: '+91 98765 43210',
      email: 'amit@example.com',
      message: 'I run a print shop and would like to learn about Inklly.',
    };
    const headers = { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey };
    const first = await fetch(`${baseUrl}/api/v1/enquiry`, { method: 'POST', headers, body: JSON.stringify(payload) });
    const firstBody = await first.json() as any;
    assert.equal(first.status, 201);
    assert.equal(firstBody.status, 'OPEN');
    assert.ok(firstBody.id);

    const retry = await fetch(`${baseUrl}/api/v1/enquiry`, { method: 'POST', headers, body: JSON.stringify(payload) });
    const retryBody = await retry.json() as any;
    assert.equal(retry.status, 201);
    assert.equal(retryBody.id, firstBody.id);

    const malformed = await fetch(`${baseUrl}/api/v1/enquiry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, phone: 'not-a-phone' }),
    });
    assert.equal(malformed.status, 422);
  });

  it('keeps developer credentials and webhook configuration behind authentication', async () => {
    for (const path of ['/api/v1/developer/keys', '/api/v1/developer/webhooks']) {
      const res = await fetch(`${baseUrl}${path}`);
      assert.equal(res.status, 401, `${path} must reject anonymous requests`);
    }
    const history = await fetch(`${baseUrl}/api/v1/developer/webhooks/whk-private/deliveries`);
    assert.equal(history.status, 401, 'webhook delivery history must reject anonymous requests');
  });

  it('keeps personal website enquiries behind platform authentication', async () => {
    const res = await fetch(`${baseUrl}/api/v1/platform/enquiries`);
    assert.equal(res.status, 401);
  });

  it('checks vault authorization before parsing large uploads and caps ordinary JSON bodies', async () => {
    const largeBody = JSON.stringify({ padding: 'x'.repeat(1024 * 1024 + 32) });
    const unauthorizedVaultUpload = await fetch(`${baseUrl}/api/v1/merchant/storage/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: largeBody,
    });
    assert.equal(unauthorizedVaultUpload.status, 401);

    const oversizedLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: largeBody,
    });
    assert.equal(oversizedLogin.status, 413);
  });

  it('keeps merchant self-service API credentials disabled until governance approval', async () => {
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@campusprint.in', password: 'DemoOwnerPassword123!' }),
    });
    assert.equal(loginRes.status, 200);
    merchantToken = (await loginRes.json()).token;
    process.env.ENABLE_EXTERNAL_API_ACCESS = 'false';
    try {
      for (const path of ['/api/v1/developer/keys', '/api/v1/developer/webhooks']) {
        const res = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${merchantToken}` } });
        assert.equal(res.status, 403, `${path} must remain unavailable to merchants by default`);
        assert.equal((await res.json()).code, 'EXTERNAL_API_ACCESS_DISABLED');
      }
    } finally {
      process.env.ENABLE_EXTERNAL_API_ACCESS = 'true';
    }
  });

  it('does not create developer webhook configuration without an organization membership', async () => {
    const userId = `developer-without-org-${crypto.randomUUID()}`;
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [userId, `${userId}@example.invalid`, 'test-hash', 'Orphan Developer', 'DEVELOPER', now, now]
    );
    const developerToken = createSessionToken({
      sessionId,
      userId,
      email: 'developer@example.invalid',
      role: 'DEVELOPER',
      permissions: [],
    });
    db.execute(
      `INSERT INTO user_sessions (id, user_id, token_hash, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionId, userId, hashSessionToken(developerToken), now, now, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()]
    );
    const res = await fetch(`${baseUrl}/api/v1/developer/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${developerToken}` },
      body: JSON.stringify({ targetUrl: 'https://example.invalid/hook' }),
    });
    assert.equal(res.status, 403);
    assert.match((await res.json()).error, /organization membership/i);
  });

  it('QR Portal retrieves shop information by shop_code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/portal/shop/campus1`);
    assert.equal(res.status, 200);
    const shop = await res.json();
    assert.equal(shop.shopCode, 'campus1');
    assert.equal(shop.name, 'Campus Print Express');
    assert.ok(shop.enabledPaperFormats.includes('A4'));
  });

  it('Calculates deterministic quote in integer Paise for customer files', async () => {
    const quoteReq = {
      shopId: 'shop-campus-1',
      files: [
        {
          fileId: 'f1',
          fileName: 'thesis.pdf',
          pageCount: 10,
          options: {
            colorMode: 'bw',
            duplexMode: 'simplex',
            paperSize: 'A4',
            orientation: 'portrait',
            copies: 1,
            fitMode: 'fit',
            pagesPerSheet: 1,
            collation: true,
          },
        },
      ],
    };

    const res = await fetch(`${baseUrl}/api/v1/portal/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoteReq),
    });

    assert.equal(res.status, 200);
    const quote = await res.json();
    // 10 pages * ₹2.00 (200 paise) = 2000 paise
    assert.equal(quote.totalPaise, 2000);
    assert.equal(quote.lineItems.length, 1);
    assert.equal(quote.lineItems[0].subtotalPaise, 2000);
  });

  it('returns validation errors for null or structurally invalid customer request bodies', async () => {
    const postJson = (path: string, body: unknown) => fetch(`${baseUrl}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal((await postJson('/api/v1/portal/quote', null)).status, 400, 'null quote body');
    assert.equal((await postJson('/api/v1/portal/quote', { shopId: 'shop-campus-1', files: {} })).status, 400, 'non-array quote files');
    assert.equal((await postJson('/api/v1/portal/upload', null)).status, 400, 'null upload body');
    assert.equal((await postJson('/api/v1/portal/orders', null)).status, 400, 'null order body');
    const malformed = await fetch(`${baseUrl}/api/v1/portal/quote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
    });
    assert.equal(malformed.status, 400, 'malformed JSON is a client error');
  });

  it('rejects pathological public quote sizes before expanding page selections', async () => {
    const res = await fetch(`${baseUrl}/api/v1/portal/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: 'shop-campus-1',
        files: [{ fileName: 'oversized.pdf', pageCount: Number.MAX_SAFE_INTEGER, options: { colorMode: 'bw', duplexMode: 'simplex', paperSize: 'A4', copies: 1 } }],
      }),
    });
    assert.equal(res.status, 422);
    assert.match((await res.json() as any).error, /page count must be between 1 and 50000/i);
  });

  it('Submits order and queries order status via public portal', async () => {
    const uploadRes = await fetch(`${baseUrl}/api/v1/portal/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: 'shop-campus-1',
        fileName: 'notes.pdf',
        fileData: makeTestPdf(10).toString('base64'),
        pageCount: 10,
      }),
    });
    assert.equal(uploadRes.status, 201);
    const upload = await uploadRes.json();
    const submitReq = {
      shopId: 'shop-campus-1',
      customerName: 'Priya Patel',
      customerPhone: '+91 98888 77777',
      paymentMethod: 'CASH_ON_COLLECTION',
      quote: {
        totalPaise: 2000,
        quoteVersion: 'q-v1',
      },
      files: [
        {
          fileName: 'notes.pdf',
          pageCount: 10,
          storageKey: upload.storageKey,
          fileSizeBytes: upload.fileSizeBytes,
          mimeType: upload.mimeType,
          options: {
            colorMode: 'bw',
            duplexMode: 'simplex',
            paperSize: 'A4',
            orientation: 'portrait',
            copies: 1,
            fitMode: 'fit',
            pagesPerSheet: 1,
            collation: true,
          },
          subtotalPaise: 2000,
        },
      ],
    };

    const res = await fetch(`${baseUrl}/api/v1/portal/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'order-test-cash-00000001' },
      body: JSON.stringify(submitReq),
    });

    assert.equal(res.status, 201);
    const orderData = await res.json();
    cashOrderId = orderData.orderId;
    assert.ok(orderData.orderId);
    assert.equal(orderData.status, 'AWAITING_REVIEW');
    const persistedSnapshot = db.queryOne<any>(`SELECT pricing_snapshot FROM orders WHERE id = ?`, [cashOrderId]);
    assert.ok(persistedSnapshot?.pricing_snapshot);
    const pricingSnapshot = JSON.parse(persistedSnapshot.pricing_snapshot);
    assert.equal(pricingSnapshot.quote.totalPaise, 2000);
    assert.equal(pricingSnapshot.quote.lineItems[0].printedSides, 10);
    assert.equal(pricingSnapshot.rateRules.find((rule: any) => rule.paperSize === 'A4' && rule.colorMode === 'bw' && rule.duplexMode === 'simplex').pricePerPrintedSidePaise, 200);
    const snapshotBeforeRateChange = persistedSnapshot.pricing_snapshot;
    assert.throws(() => db.execute(`UPDATE orders SET pricing_snapshot = '{}' WHERE id = ?`, [cashOrderId]), /pricing snapshots are immutable/i);
    const rate = db.queryOne<any>(`SELECT id, price_per_printed_side_paise FROM rate_rules WHERE shop_id = 'shop-campus-1' AND printer_id IS NULL AND paper_size = 'A4' AND color_mode = 'bw' AND duplex_mode = 'simplex'`);
    db.execute(`UPDATE rate_rules SET price_per_printed_side_paise = 999 WHERE id = ?`, [rate.id]);
    assert.equal(db.queryOne<any>(`SELECT pricing_snapshot FROM orders WHERE id = ?`, [cashOrderId]).pricing_snapshot, snapshotBeforeRateChange);
    db.execute(`UPDATE rate_rules SET price_per_printed_side_paise = ? WHERE id = ?`, [rate.price_per_printed_side_paise, rate.id]);

    // Query status
    const statusRes = await fetch(`${baseUrl}/api/v1/portal/orders/${orderData.orderId}`);
    assert.equal(statusRes.status, 200);
    const statusBody = await statusRes.json();
    assert.equal(statusBody.customerName, 'Priya Patel');
    assert.equal(statusBody.totalAmountPaise, 2000);
  });

  it('prices PDFs from stored page structure instead of client-supplied page counts', async () => {
    const uploadRes = await fetch(`${baseUrl}/api/v1/portal/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: 'shop-campus-1', fileName: 'one-page.pdf', fileData: makeTestPdf(1).toString('base64'), pageCount: 500 }),
    });
    assert.equal(uploadRes.status, 201);
    const upload = await uploadRes.json() as any;
    assert.equal(upload.pageCount, 1);

    const orderRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'order-test-pages-000001' },
      body: JSON.stringify({
        shopId: 'shop-campus-1',
        paymentMethod: 'CASH_ON_COLLECTION',
        files: [{
          fileName: 'one-page.pdf', storageKey: upload.storageKey, pageCount: 500,
          options: { colorMode: 'bw', duplexMode: 'simplex', paperSize: 'A4', copies: 1 },
        }],
      }),
    });
    assert.equal(orderRes.status, 201);
    const order = await orderRes.json() as any;
    assert.equal(order.totalAmountPaise, 200);
  });

  it('rejects sub-₹1 Razorpay orders before persistence and accepts the ₹1 boundary', async () => {
    const shopId = 'shop-campus-1';
    const rate = db.queryOne<any>(`SELECT id, price_per_printed_side_paise FROM rate_rules WHERE shop_id = ? AND printer_id IS NULL AND paper_size = 'A4' AND color_mode = 'bw' AND duplex_mode = 'simplex'`, [shopId]);
    assert.ok(rate);
    const oldEncryptionKey = process.env.RAZORPAY_CREDENTIALS_ENCRYPTION_KEY;
    process.env.RAZORPAY_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    const credentials = new ShopPaymentCredentialsService(db);
    const ordersBefore = Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM orders WHERE shop_id = ?`, [shopId])?.count);
    try {
      credentials.saveRazorpay(shopId, 'rzp_test_inklly', 'test-api-secret', 'test-webhook-secret');
      db.execute(`UPDATE rate_rules SET price_per_printed_side_paise = 99 WHERE id = ?`, [rate.id]);
      const uploadRes = await fetch(`${baseUrl}/api/v1/portal/upload`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, fileName: 'minimum-payment.pdf', fileData: makeTestPdf(1).toString('base64') }),
      });
      assert.equal(uploadRes.status, 201);
      const upload = await uploadRes.json() as any;
      const payload = {
        shopId, paymentMethod: 'ONLINE_RAZORPAY',
        files: [{ fileName: 'minimum-payment.pdf', storageKey: upload.storageKey, pageCount: upload.pageCount, options: { colorMode: 'bw', duplexMode: 'simplex', paperSize: 'A4', copies: 1 } }],
      };
      const subMinimum = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'razorpay-minimum-99-001' }, body: JSON.stringify(payload),
      });
      assert.equal(subMinimum.status, 422);
      const rejection = await subMinimum.json() as any;
      assert.equal(rejection.code, 'RAZORPAY_MINIMUM_AMOUNT');
      assert.equal(rejection.minimumAmountPaise, 100);
      assert.equal(Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM orders WHERE shop_id = ?`, [shopId])?.count), ordersBefore);

      db.execute(`UPDATE rate_rules SET price_per_printed_side_paise = 100 WHERE id = ?`, [rate.id]);
      const boundary = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'razorpay-minimum-100-01' }, body: JSON.stringify(payload),
      });
      assert.equal(boundary.status, 201, await boundary.clone().text());
      const accepted = await boundary.json() as any;
      assert.equal(accepted.totalAmountPaise, 100);
      assert.equal(accepted.status, 'AWAITING_PAYMENT');
    } finally {
      db.execute(`UPDATE rate_rules SET price_per_printed_side_paise = ? WHERE id = ?`, [rate.price_per_printed_side_paise, rate.id]);
      credentials.removeRazorpay(shopId);
      if (oldEncryptionKey === undefined) delete process.env.RAZORPAY_CREDENTIALS_ENCRYPTION_KEY;
      else process.env.RAZORPAY_CREDENTIALS_ENCRYPTION_KEY = oldEncryptionKey;
    }
  });

  it('requires customer confirmation when a complete quote no longer matches current shop pricing', async () => {
    const uploadRes = await fetch(`${baseUrl}/api/v1/portal/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: 'shop-campus-1', fileName: 'quote-check.pdf', fileData: makeTestPdf(1).toString('base64') }),
    });
    assert.equal(uploadRes.status, 201);
    const upload = await uploadRes.json() as any;
    const file = {
      fileName: 'quote-check.pdf',
      pageCount: upload.pageCount,
      options: {
        colorMode: 'bw', duplexMode: 'simplex', paperSize: 'A4', orientation: 'portrait',
        copies: 1, fitMode: 'fit', pagesPerSheet: 1, collation: true,
      },
    };
    const quoteRes = await fetch(`${baseUrl}/api/v1/portal/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: 'shop-campus-1', files: [file] }),
    });
    assert.equal(quoteRes.status, 200);
    const quote = await quoteRes.json() as any;
    const staleQuote = { ...quote, totalPaise: quote.totalPaise + 1 };
    const staleOrderRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'order-test-stale-000001' },
      body: JSON.stringify({
        shopId: 'shop-campus-1', paymentMethod: 'CASH_ON_COLLECTION', quote: staleQuote,
        files: [{ ...file, storageKey: upload.storageKey }],
      }),
    });
    assert.equal(staleOrderRes.status, 409);
    const staleBody = await staleOrderRes.json() as any;
    assert.equal(staleBody.currentQuote.totalPaise, quote.totalPaise);

    const acceptedOrderRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'order-test-quote-000001' },
      body: JSON.stringify({
        shopId: 'shop-campus-1', paymentMethod: 'CASH_ON_COLLECTION', quote,
        files: [{ ...file, storageKey: upload.storageKey }],
      }),
    });
    assert.equal(acceptedOrderRes.status, 201);
    const acceptedOrder = await acceptedOrderRes.json() as any;
    assert.equal(acceptedOrder.totalAmountPaise, quote.totalPaise);
  });

  it('deduplicates customer order retries and rejects reuse of a key for changed order data', async () => {
    const uploadRes = await fetch(`${baseUrl}/api/v1/portal/upload`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: 'shop-campus-1', fileName: 'retry.pdf', fileData: makeTestPdf(1).toString('base64') }),
    });
    assert.equal(uploadRes.status, 201);
    const upload = await uploadRes.json() as any;
    const file = {
      fileName: 'retry.pdf', pageCount: upload.pageCount, storageKey: upload.storageKey,
      options: { colorMode: 'bw', duplexMode: 'simplex', paperSize: 'A4', copies: 1 },
    };
    const quoteRes = await fetch(`${baseUrl}/api/v1/portal/quote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: 'shop-campus-1', files: [{ ...file, storageKey: undefined }] }),
    });
    assert.equal(quoteRes.status, 200);
    const quote = await quoteRes.json() as any;
    const key = 'order-idempotency-test-000001';
    const payload = {
      shopId: 'shop-campus-1', customerName: 'Retry Customer', customerPhone: '+91 98765 43210',
      paymentMethod: 'CASH_ON_COLLECTION', quote, files: [file],
    };
    const countBefore = Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM orders WHERE shop_id = ?`, ['shop-campus-1'])?.count);
    const first = await fetch(`${baseUrl}/api/v1/portal/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(payload),
    });
    assert.equal(first.status, 201, await first.clone().text());
    const firstOrder = await first.json() as any;
    const retry = await fetch(`${baseUrl}/api/v1/portal/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(payload),
    });
    assert.equal(retry.status, 200);
    const retryOrder = await retry.json() as any;
    assert.equal(retryOrder.orderId, firstOrder.orderId);
    assert.equal(retryOrder.idempotentReplay, true);

    const conflict = await fetch(`${baseUrl}/api/v1/portal/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({ ...payload, customerName: 'Different Customer' }),
    });
    assert.equal(conflict.status, 409);
    const countAfter = Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM orders WHERE shop_id = ?`, ['shop-campus-1'])?.count);
    assert.equal(countAfter, countBefore + 1);
    assert.equal(Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM webhook_events WHERE organization_id = (SELECT organization_id FROM shops WHERE id = ?) AND idempotency_key = ?`, [payload.shopId, `order.created:${firstOrder.orderId}`])?.count), 1,
      'order creation writes one transactional webhook event');
    assert.equal(Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM webhook_events WHERE idempotency_key = ?`, [`order.created:${firstOrder.orderId}`])?.count), 1,
      'idempotent order replay does not create a duplicate webhook event');

    const missingKey = await fetch(`${baseUrl}/api/v1/portal/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'bad' }, body: JSON.stringify(payload),
    });
    assert.equal(missingKey.status, 400);
  });

  it('returns a safe conflict when retention has claimed an uploaded file before order creation', async () => {
    const uploadRes = await fetch(`${baseUrl}/api/v1/portal/upload`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: 'shop-campus-1', fileName: 'claimed.pdf', fileData: makeTestPdf(1).toString('base64') }),
    });
    assert.equal(uploadRes.status, 201);
    const upload = await uploadRes.json() as any;
    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO print_file_lifecycle (storage_key, status, claim_token, purging_until, updated_at)
       VALUES (?, 'PURGING', 'active-test-claim', ?, ?)`,
      [upload.storageKey, new Date(Date.now() + 60_000).toISOString(), now]
    );
    const response = await fetch(`${baseUrl}/api/v1/portal/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'retention-api-claim-0001' },
      body: JSON.stringify({
        shopId: 'shop-campus-1', customerName: 'Retention Customer', paymentMethod: 'CASH_ON_COLLECTION',
        files: [{ fileName: 'claimed.pdf', pageCount: upload.pageCount, storageKey: upload.storageKey,
          options: { colorMode: 'bw', duplexMode: 'simplex', paperSize: 'A4', copies: 1 } }],
      }),
    });
    assert.equal(response.status, 409);
    assert.match((await response.json() as any).error, /Upload the file again/);
    assert.equal(db.queryOne<any>(`SELECT id FROM orders WHERE customer_name = 'Retention Customer'`), null);
  });

  it('Authenticates merchant owner and returns JWT session payload', async () => {
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@campusprint.in', password: 'DemoOwnerPassword123!' }),
    });

    assert.equal(loginRes.status, 200, await loginRes.clone().text());
    const loginBody = await loginRes.json();
    assert.ok(loginBody.token);
    assert.equal(loginBody.user.role, 'MERCHANT_OWNER');
    merchantToken = loginBody.token;
  });

  it('validates shop settings and persists the profile fields used by the merchant form', async () => {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` };
    const before = await (await fetch(`${baseUrl}/api/v1/merchant/settings`, { headers })).json() as any;
    const malformedBoolean = await fetch(`${baseUrl}/api/v1/merchant/settings`, {
      method: 'PUT', headers, body: JSON.stringify({ acceptCashOnCollection: 'false' }),
    });
    assert.equal(malformedBoolean.status, 400);
    assert.equal(db.queryOne<any>(`SELECT accept_cash_on_collection FROM shops WHERE id = 'shop-campus-1'`).accept_cash_on_collection, before.acceptCashOnCollection ? 1 : 0);

    const invalidEnum = await fetch(`${baseUrl}/api/v1/merchant/settings`, {
      method: 'PUT', headers, body: JSON.stringify({ autoPrintMode: 'PRINT_EVERYTHING_NOW' }),
    });
    assert.equal(invalidEnum.status, 400);
    const unsupported = await fetch(`${baseUrl}/api/v1/merchant/settings`, {
      method: 'PUT', headers, body: JSON.stringify({ email: 'silently-ignored@example.test' }),
    });
    assert.equal(unsupported.status, 400);

    const saved = await fetch(`${baseUrl}/api/v1/merchant/settings`, {
      method: 'PUT', headers,
      body: JSON.stringify({ name: 'Campus Print Updated', phone: '+91 98765 43210', address: '100 Test Road', city: 'Pune', state: 'Maharashtra', pinCode: '411001', tagline: 'Fast test printing' }),
    });
    assert.equal(saved.status, 200, await saved.clone().text());
    const savedBody = await saved.json() as any;
    assert.equal(savedBody.shop.name, 'Campus Print Updated');
    assert.equal(savedBody.shop.address, '100 Test Road');
    assert.equal(savedBody.shop.pinCode, '411001');

    const restore = await fetch(`${baseUrl}/api/v1/merchant/settings`, {
      method: 'PUT', headers,
      body: JSON.stringify({ name: before.name, phone: before.phone, address: before.address, city: before.city, state: before.state, pinCode: before.pinCode, tagline: before.tagline || '' }),
    });
    assert.equal(restore.status, 200);
  });

  it('requires settings:manage for merchant settings updates, including manager-role accounts', async () => {
    const userId = 'user-staff-1';
    const shopId = 'shop-campus-1';
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const token = createSessionToken({
      sessionId,
      userId,
      email: 'operator@campusprint.in',
      role: 'SHOP_STAFF',
      organizationId: 'org-campus-network',
      shopId,
      permissions: ['settings:manage'],
    });
    db.execute(
      `INSERT INTO user_sessions (id, user_id, token_hash, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionId, userId, hashSessionToken(token), now, now, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()]
    );
    const membership = db.queryOne<any>(`SELECT role, permissions FROM memberships WHERE user_id = ? AND shop_id = ?`, [userId, shopId]);
    const originalShop = db.queryOne<any>(`SELECT tagline FROM shops WHERE id = ?`, [shopId]);
    assert.ok(membership);
    try {
      db.execute(`UPDATE memberships SET role = 'SHOP_MANAGER', permissions = ? WHERE user_id = ? AND shop_id = ?`, [JSON.stringify([]), userId, shopId]);
      const denied = await fetch(`${baseUrl}/api/v1/merchant/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tagline: 'Should not be saved' }),
      });
      assert.equal(denied.status, 403);
      assert.equal(db.queryOne<any>(`SELECT tagline FROM shops WHERE id = ?`, [shopId]).tagline, originalShop.tagline);

      db.execute(`UPDATE memberships SET role = 'SHOP_STAFF', permissions = ? WHERE user_id = ? AND shop_id = ?`, [JSON.stringify(['settings:manage']), userId, shopId]);
      const allowed = await fetch(`${baseUrl}/api/v1/merchant/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tagline: 'Authorized settings update' }),
      });
      assert.equal(allowed.status, 200, await allowed.clone().text());
      assert.equal((await allowed.json() as any).shop.tagline, 'Authorized settings update');
    } finally {
      db.execute(`UPDATE memberships SET role = ?, permissions = ? WHERE user_id = ? AND shop_id = ?`, [membership.role, membership.permissions, userId, shopId]);
      db.execute(`UPDATE shops SET tagline = ? WHERE id = ?`, [originalShop.tagline, shopId]);
      db.execute(`UPDATE user_sessions SET revoked_at = ? WHERE id = ?`, [new Date().toISOString(), sessionId]);
    }
  });

  it('does not create a simulated WhatsApp pairing or save unencrypted Meta settings', async () => {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` };
    const setup = await fetch(`${baseUrl}/api/v1/merchant/whatsapp/setup`, { headers });
    assert.equal(setup.status, 200);
    const setupBody = await setup.json() as any;
    assert.equal(setupBody.available, false);
    assert.equal(setupBody.hasConnection, false);
    assert.deepEqual(setupBody.accounts, []);

    const pairing = await fetch(`${baseUrl}/api/v1/merchant/whatsapp/qr-pairing`, { method: 'POST', headers });
    assert.equal(pairing.status, 503);
    assert.equal((await pairing.json() as any).pairingCode, undefined);

    const save = await fetch(`${baseUrl}/api/v1/merchant/whatsapp/setup`, {
      method: 'POST', headers, body: JSON.stringify({ connectionType: 'existing_business_number', metaAppSecret: 'must-not-be-stored' }),
    });
    assert.equal(save.status, 503);

    const events = await fetch(`${baseUrl}/api/v1/merchant/whatsapp/events`, { headers });
    assert.equal(events.status, 503);
    assert.match((await events.json() as any).error, /event persistence are not configured/i);

    const remove = await fetch(`${baseUrl}/api/v1/merchant/whatsapp/account/nonexistent`, { method: 'DELETE', headers });
    assert.equal(remove.status, 503);
    assert.match((await remove.json() as any).error, /No account was removed/i);
  });

  it('persists merchant storage categories in the tenant-scoped database', async () => {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` };
    const create = await fetch(`${baseUrl}/api/v1/merchant/storage/categories`, {
      method: 'POST', headers, body: JSON.stringify({ name: 'Customer Archive', description: 'Shop-owned vault category' }),
    });
    assert.equal(create.status, 201);
    const created = await create.json() as any;
    assert.ok(created.category.id);

    const list = await fetch(`${baseUrl}/api/v1/merchant/storage/categories`, { headers });
    assert.equal(list.status, 200);
    assert.ok((await list.json() as any[]).some((category) => category.id === created.category.id));

    const pdf = makeTestPdf(3);
    const invalidCategory = await fetch(`${baseUrl}/api/v1/merchant/storage/documents`, {
      method: 'POST', headers,
      body: JSON.stringify({ fileName: 'report.pdf', fileData: pdf.toString('base64'), categoryId: 'foreign-category-id' }),
    });
    assert.equal(invalidCategory.status, 404);

    const invalidContent = await fetch(`${baseUrl}/api/v1/merchant/storage/documents`, {
      method: 'POST', headers, body: JSON.stringify({ fileName: 'report.pdf', fileData: Buffer.from('not a pdf').toString('base64') }),
    });
    assert.equal(invalidContent.status, 415);

    const upload = await fetch(`${baseUrl}/api/v1/merchant/storage/documents`, {
      method: 'POST', headers,
      body: JSON.stringify({ fileName: '../year-end?.exe', fileData: pdf.toString('base64'), categoryId: created.category.id }),
    });
    assert.equal(upload.status, 201);
    const stored = (await upload.json() as any).document;
    assert.equal(stored.pageCount, 3, 'page count must be derived from PDF bytes');
    assert.equal(stored.fileName, 'year-end_.pdf', 'display name is sanitized and extension follows inspected content');
    assert.equal('storageKey' in stored, false, 'private storage keys are not exposed');

    const documents = await fetch(`${baseUrl}/api/v1/merchant/storage/documents?categoryId=${encodeURIComponent(created.category.id)}`, { headers });
    assert.equal(documents.status, 200);
    const storedList = await documents.json() as any[];
    assert.ok(storedList.some((doc) => doc.id === stored.id && doc.name === stored.fileName && doc.categoryName === created.category.name));

    const download = await fetch(`${baseUrl}${stored.downloadUrl}`, { headers: { Authorization: `Bearer ${merchantToken}` } });
    assert.equal(download.status, 200);
    assert.equal(download.headers.get('cache-control'), 'private, no-store');
    assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdf);

    const removeDocument = await fetch(`${baseUrl}/api/v1/merchant/storage/documents/${encodeURIComponent(stored.id)}`, {
      method: 'DELETE', headers,
    });
    assert.equal(removeDocument.status, 200);

    const remove = await fetch(`${baseUrl}/api/v1/merchant/storage/categories/${encodeURIComponent(created.category.id)}`, { method: 'DELETE', headers });
    assert.equal(remove.status, 200);
  });

  it('blocks print release for an online order until payment is verified', async () => {
    assert.ok(cashOrderId);
    db.execute(
      `UPDATE orders SET status = 'AWAITING_PAYMENT', payment_status = 'NOT_STARTED', payment_method = 'ONLINE_RAZORPAY' WHERE id = ?`,
      [cashOrderId]
    );
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` };
    const transition = await fetch(`${baseUrl}/api/v1/merchant/orders/${cashOrderId}/status`, {
      method: 'PATCH', headers, body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
    assert.equal(transition.status, 409);
    const dispatch = await fetch(`${baseUrl}/api/v1/merchant/orders/${cashOrderId}/print`, { method: 'POST', headers });
    assert.equal(dispatch.status, 409);
    const unpaid = db.queryOne<any>(`SELECT status, payment_status FROM orders WHERE id = ?`, [cashOrderId]);
    assert.equal(unpaid.status, 'AWAITING_PAYMENT');
    assert.equal(unpaid.payment_status, 'NOT_STARTED');
    db.execute(
      `UPDATE orders SET status = 'AWAITING_REVIEW', payment_status = 'PENDING', payment_method = 'CASH_ON_COLLECTION' WHERE id = ?`,
      [cashOrderId]
    );
  });

  it('enforces revocable server-side sessions and price-management permission', async () => {
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const staffToken = createSessionToken({
      sessionId,
      userId: 'user-staff-1',
      email: 'operator@campusprint.in',
      role: 'SHOP_STAFF',
      organizationId: 'org-campus-network',
      shopId: 'shop-campus-1',
      permissions: ['orders:view', 'orders:process', 'live_print:manage', 'printers:view', 'printers:manage', 'storage:view'],
    });
    db.execute(
      `INSERT INTO user_sessions (id, user_id, token_hash, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionId, 'user-staff-1', hashSessionToken(staffToken), now, now, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()]
    );

    const deniedRateChange = await fetch(`${baseUrl}/api/v1/merchant/rates`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({ paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex', pricePerPrintedSidePaise: 1 }),
    });
    assert.equal(deniedRateChange.status, 403);

    const sessionsRes = await fetch(`${baseUrl}/api/v1/auth/sessions`, { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.equal(sessionsRes.status, 200);
    const sessions = await sessionsRes.json() as Array<{ id: string; isCurrent: boolean }>;
    assert.equal(sessions.find((session) => session.id === sessionId)?.isCurrent, true);

    const revokeRes = await fetch(`${baseUrl}/api/v1/auth/sessions/${sessionId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.equal(revokeRes.status, 200);
    const afterRevoke = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.equal(afterRevoke.status, 401);
  });

  it('refreshes merchant authorization from the active account and membership instead of JWT claims', async () => {
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const token = createSessionToken({
      sessionId,
      userId: 'user-staff-1',
      email: 'operator@campusprint.in',
      role: 'SHOP_STAFF',
      organizationId: 'org-campus-network',
      shopId: 'shop-campus-1',
      permissions: ['printers:view', 'orders:view'],
    });
    db.execute(
      `INSERT INTO user_sessions (id, user_id, token_hash, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionId, 'user-staff-1', hashSessionToken(token), now, now, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()]
    );
    const membership = db.queryOne<any>(`SELECT permissions FROM memberships WHERE user_id = ? AND shop_id = ?`, ['user-staff-1', 'shop-campus-1']);
    const wasActive = db.queryOne<any>(`SELECT is_active FROM users WHERE id = ?`, ['user-staff-1'])?.is_active;
    try {
      db.execute(`UPDATE memberships SET permissions = ? WHERE user_id = ? AND shop_id = ?`, [JSON.stringify(['orders:view']), 'user-staff-1', 'shop-campus-1']);
      const changedPermission = await fetch(`${baseUrl}/api/v1/merchant/printers`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(changedPermission.status, 403, 'old JWT permission must not survive a membership change');

      db.execute(`UPDATE users SET is_active = 0 WHERE id = ?`, ['user-staff-1']);
      const inactive = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(inactive.status, 401, 'inactive users must lose active sessions immediately');
    } finally {
      db.execute(`UPDATE memberships SET permissions = ? WHERE user_id = ? AND shop_id = ?`, [membership.permissions, 'user-staff-1', 'shop-campus-1']);
      db.execute(`UPDATE users SET is_active = ? WHERE id = ?`, [wasActive, 'user-staff-1']);
      db.execute(`UPDATE user_sessions SET revoked_at = ? WHERE id = ?`, [new Date().toISOString(), sessionId]);
    }
  });

  it('Retrieves merchant dashboard stats and orders queue', async () => {
    const res = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
      headers: { Authorization: `Bearer ${merchantToken}` },
    });

    assert.equal(res.status, 200);
    const dashboard = await res.json();
    assert.ok(dashboard.metrics.totalOrders >= 1);
    assert.ok(dashboard.metrics.activePrinters >= 1);
    assert.ok(dashboard.recentOrders.length <= 5, 'dashboard should hydrate only its recent-order window');
    const persistedStatusCounts = db.query<any>(`SELECT status, COUNT(*) AS count FROM orders WHERE shop_id = ? GROUP BY status`, ['shop-campus-1']);
    assert.equal(dashboard.metrics.totalOrders, persistedStatusCounts.reduce((sum, row) => sum + Number(row.count), 0));
    for (const row of persistedStatusCounts) assert.equal(dashboard.metrics.statusCounts[row.status], Number(row.count));

    // List orders
    const ordersRes = await fetch(`${baseUrl}/api/v1/merchant/orders`, {
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    assert.equal(ordersRes.status, 200);
    const orders = await ordersRes.json();
    assert.ok(Array.isArray(orders));
  });

  it('validates merchant printer capability profiles before persistence', async () => {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` };
    const countBefore = Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM printers WHERE shop_id = ?`, ['shop-campus-1']).count);
    const invalidPayloads = [
      { name: '  ', systemDriverName: 'Queue' },
      { name: 'Office', systemDriverName: 'Queue', supportsColor: 'false' },
      { name: 'Office', systemDriverName: 'Queue', trays: [{ name: 'Tray 1', supportedSizes: ['A4', 'UNKNOWN'] }] },
      { name: 'Office', systemDriverName: 'Queue', trays: [{ isDefault: true }, { isDefault: true }] },
      { name: 'Office', systemDriverName: 'Queue', trays: 'not-an-array' },
    ];
    for (const payload of invalidPayloads) {
      const response = await fetch(`${baseUrl}/api/v1/merchant/printers`, { method: 'POST', headers, body: JSON.stringify(payload) });
      assert.equal(response.status, 400, JSON.stringify(payload));
    }
    assert.equal(Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM printers WHERE shop_id = ?`, ['shop-campus-1']).count), countBefore,
      'invalid profiles must not create partial printer records');

    const createdResponse = await fetch(`${baseUrl}/api/v1/merchant/printers`, {
      method: 'POST', headers,
      body: JSON.stringify({
        name: '  Front Counter  ', systemDriverName: '  Windows Queue  ', supportsColor: true, supportsDuplex: false,
        isOnline: true, id: 'attacker-controlled',
        trays: [{ id: 'attacker-tray', name: ' Main Tray ', supportedSizes: ['A4', 'A3'], isDefault: true }],
      }),
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json() as any;
    assert.equal(created.name, 'Front Counter');
    assert.equal(created.systemDriverName, 'Windows Queue');
    assert.equal(created.isOnline, false, 'client input cannot claim live printer state');
    assert.notEqual(created.id, 'attacker-controlled');
    assert.equal(created.trays[0].id, `tray-${created.id}-1`);
    assert.deepEqual(created.trays[0].supportedSizes, ['A4', 'A3']);
    db.execute(`DELETE FROM printers WHERE id = ? AND shop_id = ?`, [created.id, 'shop-campus-1']);
  });

  it('does not count an unpaid collected order as merchant revenue', async () => {
    const original = db.queryOne<any>(`SELECT status, payment_status FROM orders WHERE id = ?`, [cashOrderId]);
    assert.ok(original);
    db.execute(`UPDATE orders SET status = 'COLLECTED', payment_status = 'PENDING' WHERE id = ?`, [cashOrderId]);
    try {
      const expected = db.queryOne<any>(
        `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM ledger_entries WHERE shop_id = ? AND domain = 'CUSTOMER_PRINT_PAYMENT'`,
        ['shop-campus-1']
      ).total;
      const response = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, { headers: { Authorization: `Bearer ${merchantToken}` } });
      assert.equal(response.status, 200);
      const dashboard = await response.json();
      assert.equal(dashboard.metrics.totalRevenuePaise, expected);
    } finally {
      db.execute(`UPDATE orders SET status = ?, payment_status = ? WHERE id = ?`, [original.status, original.payment_status, cashOrderId]);
    }
  });

  it('Enforces valid state transition on order status update', async () => {
    const ordersRes = await fetch(`${baseUrl}/api/v1/merchant/orders`, {
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    const orders = await ordersRes.json();
    const demoOrder = orders.find((o: any) => o.status === 'AWAITING_REVIEW');
    assert.ok(demoOrder, 'Should have an order awaiting review');

    // Valid transition: AWAITING_REVIEW -> READY_FOR_PRINT
    const updateRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${demoOrder.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({ status: 'READY_FOR_PRINT' }),
    });

    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.order.status, 'READY_FOR_PRINT');

    // Invalid transition: READY_FOR_PRINT directly to COLLECTED (without IN_PROGRESS / READY_FOR_COLLECTION)
    const invalidRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${demoOrder.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({ status: 'COLLECTED' }),
    });
    assert.equal(invalidRes.status, 409);

    const rejectRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${demoOrder.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    assert.equal(rejectRes.status, 200);
    assert.equal((await rejectRes.json()).order.status, 'CANCELLED');

    // Keep the shared fixture in its pre-approval state for later workflow tests.
    db.execute(`UPDATE orders SET status = 'AWAITING_REVIEW' WHERE id = ?`, [demoOrder.id]);
  });

  it('prevents order-processing staff from collecting unpaid cash without a ledger entry', async () => {
    const originalOrder = db.queryOne<any>(`SELECT status, payment_status FROM orders WHERE id = ?`, [cashOrderId]);
    const session = verifySessionToken(merchantToken);
    assert.ok(originalOrder && session && typeof session !== 'string');
    const membership = db.queryOne<any>(
      `SELECT role, permissions FROM memberships WHERE user_id = ? AND shop_id = ?`,
      [session.userId, 'shop-campus-1']
    );
    assert.ok(membership);
    const ledgerCount = Number(db.queryOne<any>(
      `SELECT COUNT(*) AS count FROM ledger_entries WHERE order_id = ? AND domain = 'CUSTOMER_PRINT_PAYMENT'`, [cashOrderId]
    ).count);
    db.execute(`UPDATE memberships SET role = 'SHOP_STAFF', permissions = ? WHERE user_id = ? AND shop_id = ?`, [JSON.stringify(['orders:process']), session.userId, 'shop-campus-1']);
    db.execute(`UPDATE orders SET status = 'READY_FOR_COLLECTION', payment_status = 'PENDING' WHERE id = ?`, [cashOrderId]);
    try {
      for (const status of ['COLLECTED', 'COMPLETED']) {
        const response = await fetch(`${baseUrl}/api/v1/merchant/orders/${cashOrderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
          body: JSON.stringify({ status }),
        });
        assert.equal(response.status, 409);
      }
      const persisted = db.queryOne<any>(`SELECT status, payment_status FROM orders WHERE id = ?`, [cashOrderId]);
      assert.equal(persisted.status, 'READY_FOR_COLLECTION');
      assert.equal(persisted.payment_status, 'PENDING');
      assert.equal(Number(db.queryOne<any>(
        `SELECT COUNT(*) AS count FROM ledger_entries WHERE order_id = ? AND domain = 'CUSTOMER_PRINT_PAYMENT'`, [cashOrderId]
      ).count), ledgerCount);
    } finally {
      db.execute(`UPDATE memberships SET role = ?, permissions = ? WHERE user_id = ? AND shop_id = ?`, [membership.role, membership.permissions, session.userId, 'shop-campus-1']);
      db.execute(`UPDATE orders SET status = ?, payment_status = ? WHERE id = ?`, [originalOrder.status, originalOrder.payment_status, cashOrderId]);
    }
  });

  it('Desktop Print Agent pairs, receives heartbeat, and polls queued tickets', async () => {
    const pairingRes = await fetch(`${baseUrl}/api/v1/merchant/agents/pairing-code`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    assert.equal(pairingRes.status, 201);
    const pairing = await pairingRes.json();
    // 1. Enroll using the short-lived, one-time pairing code.
    const enrollRes = await fetch(`${baseUrl}/api/v1/agent/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: 'shop-campus-1',
        pairingCode: pairing.pairingCode,
        hostname: 'POS-DESK-WIN11',
      }),
    });
    assert.equal(enrollRes.status, 201);
    const enrollData = await enrollRes.json();
    assert.ok(enrollData.agentId);
    const agentHeaders = {
      'Content-Type': 'application/json',
      'X-Agent-Id': enrollData.agentId,
      Authorization: `Bearer ${enrollData.agentSecret}`,
    };

    const enrolledHeartbeat = db.queryOne<any>(`SELECT last_heartbeat FROM agent_registrations WHERE id = ?`, [enrollData.agentId]).last_heartbeat;
    const malformedInventory = await fetch(`${baseUrl}/api/v1/agent/heartbeat`, {
      method: 'POST', headers: agentHeaders,
      body: JSON.stringify({
        status: 'ONLINE', activePrintersCount: 2, localQueueDepth: 0, sqliteCacheHealthy: true,
        printers: [
          { name: 'Valid Queue', driverName: 'Valid Driver', isOnline: true, isDefault: true },
          { name: 'Malformed Queue', driverName: 'Malformed Driver', isOnline: 'false', isDefault: false },
        ],
      }),
    });
    assert.equal(malformedInventory.status, 400);
    assert.equal(db.queryOne<any>(`SELECT last_heartbeat FROM agent_registrations WHERE id = ?`, [enrollData.agentId]).last_heartbeat, enrolledHeartbeat,
      'invalid inventory must be rejected before heartbeat persistence');
    assert.equal(Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM printers WHERE agent_id = ?`, [enrollData.agentId]).count), 0,
      'invalid inventory must not partially create printer records');

    const malformedCounters = await fetch(`${baseUrl}/api/v1/agent/heartbeat`, {
      method: 'POST', headers: agentHeaders,
      body: JSON.stringify({ status: 'ONLINE', activePrintersCount: '2', localQueueDepth: 0, sqliteCacheHealthy: true }),
    });
    assert.equal(malformedCounters.status, 400, 'numeric strings must not be coerced into heartbeat counters');

    const targetJob = db.queryOne<any>(`SELECT id FROM print_jobs WHERE order_id = ? ORDER BY created_at LIMIT 1`, [cashOrderId]);
    assert.ok(targetJob, 'submitted customer order should have a print job record');

    // A newly submitted order remains out of the agent queue until merchant release.
    const beforeReleaseRes = await fetch(`${baseUrl}/api/v1/agent/poll-commands`, { headers: agentHeaders });
    assert.equal(beforeReleaseRes.status, 200);
    const beforeReleaseTickets = await beforeReleaseRes.json() as Array<{ jobId: string }>;
    assert.ok(!beforeReleaseTickets.some((candidate) => candidate.jobId === targetJob.id), 'unreviewed order must not be dispatched');

    // 2. Heartbeat
    const hbRes = await fetch(`${baseUrl}/api/v1/agent/heartbeat`, {
      method: 'POST',
      headers: agentHeaders,
      body: JSON.stringify({
        status: 'ONLINE',
        activePrintersCount: 2,
        localQueueDepth: 0,
        printers: [{ name: 'API Test Queue', driverName: 'API Test Driver', isOnline: true, isDefault: true }],
      }),
    });
    assert.equal(hbRes.status, 200);

    const livePrinter = db.queryOne<any>(`SELECT id FROM printers WHERE agent_id = ? AND name = ?`, [enrollData.agentId, 'API Test Queue']);
    assert.ok(livePrinter);
    const dispatchRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${cashOrderId}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
      body: JSON.stringify({ printerId: livePrinter.id }),
    });
    assert.equal(dispatchRes.status, 200);

    // 3. Poll commands
    const pollRes = await fetch(`${baseUrl}/api/v1/agent/poll-commands`, { headers: agentHeaders });
    assert.equal(pollRes.status, 200);
    const tickets = await pollRes.json() as Array<{ jobId: string; commandId: string; attemptId: string }>;
    assert.ok(Array.isArray(tickets));

    const ticket = tickets.find((candidate) => candidate.jobId === targetJob.id);
    assert.ok(ticket, 'poll returns the dispatched order job');

    // A lost poll response can be replayed with the same command identity until SQLite enqueue is acknowledged.
    const replayRes = await fetch(`${baseUrl}/api/v1/agent/poll-commands`, { headers: agentHeaders });
    const replayTickets = await replayRes.json() as Array<{ jobId: string; commandId: string; attemptId: string }>;
    const replay = replayTickets.find((candidate) => candidate.jobId === targetJob.id);
    assert.equal(replay?.commandId, ticket.commandId);
    assert.equal(replay?.attemptId, ticket.attemptId);

    const ackRes = await fetch(`${baseUrl}/api/v1/agent/acknowledge-command`, {
      method: 'POST',
      headers: agentHeaders,
      body: JSON.stringify({ commandId: ticket.commandId, attemptId: ticket.attemptId }),
    });
    assert.equal(ackRes.status, 200);
    const ackRetry = await fetch(`${baseUrl}/api/v1/agent/acknowledge-command`, {
      method: 'POST',
      headers: agentHeaders,
      body: JSON.stringify({ commandId: ticket.commandId, attemptId: ticket.attemptId }),
    });
    assert.equal(ackRetry.status, 200, 'acknowledgement is idempotent');

    const afterAckRes = await fetch(`${baseUrl}/api/v1/agent/poll-commands`, { headers: agentHeaders });
    const afterAckTickets = await afterAckRes.json() as Array<{ jobId: string }>;
    assert.ok(!afterAckTickets.some((candidate) => candidate.jobId === targetJob.id), 'acknowledged command is not replayed');

    // A command that never receives an acknowledgement is made uncertain when its lease expires, never reprinted blindly.
    const fileRow = db.queryOne<any>(`SELECT order_file_id FROM print_jobs WHERE id = ?`, [targetJob.id]);
    const printerRow = db.queryOne<any>(`SELECT id FROM printers WHERE agent_id = ? AND name = ?`, [enrollData.agentId, 'API Test Queue']);
    assert.ok(printerRow, 'heartbeat inventory should be persisted to this paired agent');
    const expiredJobId = `job-expired-ack-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO print_jobs (id, order_id, order_file_id, printer_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'RECEIVED', ?, ?)`,
      [expiredJobId, cashOrderId, fileRow.order_file_id, printerRow.id, now, now]
    );
    const issuedRes = await fetch(`${baseUrl}/api/v1/agent/poll-commands`, { headers: agentHeaders });
    const issued = await issuedRes.json() as Array<{ jobId: string; attemptId: string }>;
    const expiredTicket = issued.find((candidate) => candidate.jobId === expiredJobId);
    assert.ok(expiredTicket);
    db.execute(`UPDATE print_attempts SET created_at = ? WHERE id = ?`, [new Date(Date.now() - 3 * 60 * 1000).toISOString(), expiredTicket.attemptId]);
    const expirePoll = await fetch(`${baseUrl}/api/v1/agent/poll-commands`, { headers: agentHeaders });
    const expireTickets = await expirePoll.json() as Array<{ jobId: string }>;
    assert.ok(!expireTickets.some((candidate) => candidate.jobId === expiredJobId));
    assert.equal(db.queryOne<any>(`SELECT status FROM print_jobs WHERE id = ?`, [expiredJobId]).status, 'OUTPUT_UNCERTAIN');
    assert.equal(db.queryOne<any>(`SELECT status FROM print_attempts WHERE id = ?`, [expiredTicket.attemptId]).status, 'OUTPUT_UNCERTAIN');

    if (ticket) {
      const agentClaimedPhysicalOutput = await fetch(`${baseUrl}/api/v1/agent/command-result`, {
        method: 'POST', headers: agentHeaders,
        body: JSON.stringify({ attemptId: ticket.attemptId, jobId: ticket.jobId, status: 'PRINT_CONFIRMED', timestamp: new Date().toISOString() }),
      });
      assert.equal(agentClaimedPhysicalOutput.status, 409, 'the agent cannot attest physical output');

      // Report Uncertain Output - safety invariant verification!
      const resultRes = await fetch(`${baseUrl}/api/v1/agent/command-result`, {
        method: 'POST',
        headers: agentHeaders,
        body: JSON.stringify({
          attemptId: ticket.attemptId,
          jobId: ticket.jobId,
          status: 'OUTPUT_UNCERTAIN',
          errorMessage: 'Paper jam occurred during page 4. Output unclear.',
          timestamp: new Date().toISOString(),
        }),
      });
      assert.equal(resultRes.status, 200);
      const resBody = await resultRes.json();
      assert.equal(resBody.recordedStatus, 'OUTPUT_UNCERTAIN');

      const unsupportedDirectReady = await fetch(`${baseUrl}/api/v1/merchant/orders/${cashOrderId}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ status: 'READY_FOR_COLLECTION' }),
      });
      assert.equal(unsupportedDirectReady.status, 409);

      const reconciliation = await fetch(`${baseUrl}/api/v1/merchant/orders/${cashOrderId}/reconcile-output`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ physicalOutputConfirmed: true, reason: 'Inspected all pages in the output tray and confirmed the full order is present.' }),
      });
      assert.equal(reconciliation.status, 200, await reconciliation.clone().text());
      assert.equal(db.queryOne<any>(`SELECT status FROM print_jobs WHERE id = ?`, [ticket.jobId]).status, 'PRINT_CONFIRMED');
      assert.equal(db.queryOne<any>(`SELECT status FROM orders WHERE id = ?`, [cashOrderId]).status, 'READY_FOR_COLLECTION');
      assert.equal(Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM audit_events WHERE action = 'MERCHANT_PRINT_OUTPUT_RECONCILED' AND target_id = ?`, [cashOrderId]).count), 1);

      const anonymousUsage = await fetch(`${baseUrl}/api/v1/subscriptions/usage`);
      assert.equal(anonymousUsage.status, 401);
      const usage = await fetch(`${baseUrl}/api/v1/subscriptions/usage`, { headers: { Authorization: `Bearer ${merchantToken}` } });
      assert.equal(usage.status, 200);
      const usageBody = await usage.json() as any;
      assert.equal(usageBody.confirmedOrders, 1);
      assert.equal(usageBody.confirmedSides, 10);
      assert.equal(usageBody.billingStatus, 'METERING_ONLY');
      assert.equal(usageBody.chargeCreated, false);

      const replayReconciliation = await fetch(`${baseUrl}/api/v1/merchant/orders/${cashOrderId}/reconcile-output`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ physicalOutputConfirmed: true, reason: 'Rechecked the full output and confirmed the order remains complete.' }),
      });
      assert.equal(replayReconciliation.status, 200);
      assert.equal(Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM subscription_usage_events WHERE order_id = ?`, [cashOrderId]).count), 1);

      const delayedAgentReport = await fetch(`${baseUrl}/api/v1/agent/command-result`, {
        method: 'POST', headers: agentHeaders,
        body: JSON.stringify({ attemptId: ticket.attemptId, jobId: ticket.jobId, status: 'OUTPUT_UNCERTAIN', errorMessage: 'Delayed retry of the earlier agent report.', timestamp: new Date().toISOString() }),
      });
      assert.equal(delayedAgentReport.status, 200, 'a delayed result must not regress operator-reconciled output');
      assert.equal(db.queryOne<any>(`SELECT status FROM print_jobs WHERE id = ?`, [ticket.jobId]).status, 'PRINT_CONFIRMED');
    }
  });

  it('issues tenant-scoped invoice-only pilot bills with configurable Paise rates', async () => {
    const platformLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@inklly.com', password: 'DemoPlatformPassword123!' }),
    });
    assert.equal(platformLogin.status, 200);
    adminToken = (await platformLogin.json() as any).token;
    const now = new Date();
    const previousMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const period = `${previousMonthStart.getUTCFullYear()}-${String(previousMonthStart.getUTCMonth() + 1).padStart(2, '0')}`;
    const usageTimestamp = `${previousMonthStart.toISOString().slice(0, 10)}T12:00:00.000Z`;
    const sourceOrder = db.queryOne<any>(`SELECT o.id FROM orders o LEFT JOIN subscription_usage_events u ON u.order_id = o.id WHERE o.shop_id = 'shop-campus-1' AND o.id <> ? AND u.id IS NULL LIMIT 1`, [cashOrderId]);
    assert.ok(sourceOrder?.id);
    db.execute(`INSERT INTO subscription_usage_events (id, organization_id, shop_id, order_id, confirmed_sides, confirmation_source, created_at)
      VALUES (?, 'org-campus-network', 'shop-campus-1', ?, 10, 'OPERATOR_PHYSICAL_INSPECTION', ?)`, [`billing-usage-${crypto.randomUUID()}`, sourceOrder.id, usageTimestamp]);

    const tariffUrl = `${baseUrl}/api/v1/platform/billing/organizations/org-campus-network/tariffs`;
    const tariffRes = await fetch(tariffUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ monthlyBasePaise: 49900, perSidePaise: 4, includedSides: 2, effectiveFrom: `${period}-01` }),
    });
    assert.equal(tariffRes.status, 201, await tariffRes.clone().text());
    const tariff = (await tariffRes.json() as any).tariff;
    assert.equal(tariff.currency, 'INR');

    const ledgerBefore = Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM ledger_entries`)?.count || 0);
    const issue = () => fetch(`${baseUrl}/api/v1/platform/billing/invoices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ organizationId: 'org-campus-network', period }),
    });
    const first = await issue();
    assert.equal(first.status, 201, await first.clone().text());
    const firstBody = await first.json() as any;
    assert.deepEqual([firstBody.invoice.confirmedSides, firstBody.invoice.includedSides, firstBody.invoice.billableSides], [10, 2, 8]);
    assert.deepEqual([firstBody.invoice.monthlyBasePaise, firstBody.invoice.perSidePaise, firstBody.invoice.usageFeePaise, firstBody.invoice.totalPaise], [49900, 4, 32, 49932]);
    assert.equal(firstBody.invoice.status, 'ISSUED');
    assert.equal(firstBody.invoice.collectionStatus, 'MANUAL_PENDING');
    assert.equal(firstBody.invoice.paymentRecorded, false);
    const replay = await issue();
    assert.equal(replay.status, 200);
    assert.equal((await replay.json() as any).invoice.id, firstBody.invoice.id);
    assert.equal(Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM ledger_entries`)?.count || 0), ledgerBefore);

    const merchantInvoices = await fetch(`${baseUrl}/api/v1/subscriptions/invoices`, { headers: { Authorization: `Bearer ${merchantToken}` } });
    assert.equal(merchantInvoices.status, 200);
    const ownInvoices = await merchantInvoices.json() as any[];
    assert.deepEqual(ownInvoices.map((invoice) => invoice.id), [firstBody.invoice.id]);
    assert.equal((await fetch(`${baseUrl}/api/v1/subscriptions/invoices`)).status, 401);
    const ownerCannotSetTariff = await fetch(tariffUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
      body: JSON.stringify({ monthlyBasePaise: 1, perSidePaise: 1, includedSides: 0, effectiveFrom: '2999-01-01' }),
    });
    assert.equal(ownerCannotSetTariff.status, 403);
  });

  it('Agent download endpoint never claims an unconfigured installer exists', async () => {
    const scriptRes = await fetch(`${baseUrl}/api/v1/agent/download?platform=win-x64&shopCode=campus1&format=script`);
    assert.equal(scriptRes.status, 410);

    // Metadata must report the missing verified installer rather than a fabricated checksum.
    const metaRes = await fetch(`${baseUrl}/api/v1/agent/download?platform=win-x64&shopCode=campus1&format=json`);
    assert.equal(metaRes.status, 503);
    const metaJson = await metaRes.json();
    assert.equal(metaJson.installerAvailable, false);
    const legacyRes = await fetch(`${baseUrl}/api/v1/agent/download?platform=win-legacy-x86&shopCode=campus1&format=msi`);
    assert.equal(legacyRes.status, 503, 'unverified legacy installers must never be served');

    // 3. Driver matrix
    const matrixRes = await fetch(`${baseUrl}/api/v1/agent/driver-matrix`);
    assert.equal(matrixRes.status, 200);
    const matrix = await matrixRes.json();
    assert.equal(matrix.capabilityStatus, 'NOT_VERIFIED');
    assert.equal(matrix.physicalPrintingEnabledByDefault, false);
    assert.equal(matrix.colorSupport, 'UNKNOWN');
    assert.equal(matrix.duplexSupport, 'UNKNOWN');
    assert.equal(matrix.traySupport, 'NOT_REPORTED');
    assert.equal('manufacturers' in matrix, false);

    // 4. Diagnostics
    const diagRes = await fetch(`${baseUrl}/api/v1/agent/diagnostics`);
    assert.equal(diagRes.status, 200);
    const diag = await diagRes.json();
    assert.equal(diag.loopbackPort, 8765);
    assert.equal(diag.hardwareSafety, 'OUTPUT_UNCERTAIN on hardware jam or spooler halt');
  });

  it('Collects cash at counter and credits ledger', async () => {
    const url = `${baseUrl}/api/v1/payments/orders/${cashOrderId}/collect-cash`;
    const responses = await Promise.all([1, 2].map(() => fetch(url, {
      method: 'POST', headers: { Authorization: `Bearer ${merchantToken}` },
    })));
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    const success = responses[0].status === 200 ? responses[0] : responses[1];
    const cashBody = await success.json();
    assert.equal(cashBody.order.paymentStatus, 'VERIFIED');
    assert.equal(Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM payments WHERE order_id = ? AND provider = 'MANUAL_CASH'`, [cashOrderId]).count), 1);
    assert.equal(Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM ledger_entries WHERE order_id = ? AND provider = 'MANUAL_CASH'`, [cashOrderId]).count), 1);
  });

  it('Platform Owner Console returns system metrics and ledger', async () => {
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@inklly.com', password: 'DemoPlatformPassword123!' }),
    });
    assert.equal(login.status, 200);
    adminToken = (await login.json()).token;
    const res = await fetch(`${baseUrl}/api/v1/platform/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 200);
    const overview = await res.json();
    assert.ok(overview.metrics.totalOrganizations >= 1);
    assert.ok(overview.metrics.totalShops >= 1);
    assert.equal(overview.health.apiStatus, 'HEALTHY');
    const ledgerTotal = db.queryOne<any>(`SELECT SUM(amount_paise) as total FROM ledger_entries WHERE domain = 'CUSTOMER_PRINT_PAYMENT'`);
    assert.equal(overview.metrics.platformGMVPaise, Number(ledgerTotal?.total ?? 0));
    assert.equal(overview.metrics.platformMRRPaise, null, 'MRR stays unavailable while subscription billing is not configured');
    assert.equal(overview.health.databaseEngine, 'SQLite');

    const freshId = `agt-admin-fresh-${crypto.randomUUID()}`;
    const staleId = `agt-admin-stale-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO agent_registrations (id, shop_id, secret_key_hash, hostname, os_platform, os_version, agent_version, is_active, last_heartbeat, created_at, updated_at)
       VALUES (?, 'shop-campus-1', ?, 'FRESH-AGENT', 'win32', 'Windows 11', 'test', 1, ?, ?, ?),
              (?, 'shop-campus-1', ?, 'STALE-AGENT', 'win32', 'Windows 10', 'test', 1, ?, ?, ?)`,
      [freshId, 'hash-fresh', now, now, now, staleId, 'hash-stale', new Date(Date.now() - 60_000).toISOString(), now, now]
    );
    try {
      const agentsRes = await fetch(`${baseUrl}/api/v1/platform/agents`, { headers: { Authorization: `Bearer ${adminToken}` } });
      assert.equal(agentsRes.status, 200);
      const agents = await agentsRes.json() as any[];
      assert.equal(agents.find((agent) => agent.agentId === freshId)?.status, 'ONLINE');
      assert.equal(agents.find((agent) => agent.agentId === staleId)?.status, 'STALE');
      assert.equal('secretKey' in agents.find((agent) => agent.agentId === freshId), false);
    } finally {
      db.execute(`DELETE FROM agent_registrations WHERE id IN (?, ?)`, [freshId, staleId]);
    }

    const enquiriesRes = await fetch(`${baseUrl}/api/v1/platform/enquiries`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(enquiriesRes.status, 200);
    const enquiries = await enquiriesRes.json() as any[];
    assert.equal(enquiries.length, 1);
    assert.equal(enquiries[0].email, 'amit@example.com');
    const auditRes = await fetch(`${baseUrl}/api/v1/platform/audit-logs?limit=100`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const audit = await auditRes.json() as any[];
    assert.ok(audit.some((entry) => entry.action === 'VIEW_PUBLIC_ENQUIRIES'));
    const viewEvent = audit.find((entry) => entry.action === 'VIEW_PUBLIC_ENQUIRIES');
    assert.equal(typeof viewEvent.actorUserId, 'string');
    assert.equal(viewEvent.actorRole, 'PLATFORM_OWNER');
    assert.equal(viewEvent.targetType, 'PUBLIC_ENQUIRY_COLLECTION');
    assert.equal(viewEvent.targetId, 'latest');
    assert.equal(viewEvent.outcome, 'SUCCESS');
    assert.equal(typeof viewEvent.createdAt, 'string');
    const unboundedAudit = await fetch(`${baseUrl}/api/v1/platform/audit-logs?limit=-1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(unboundedAudit.status, 400);
    const oversizedAudit = await fetch(`${baseUrl}/api/v1/platform/audit-logs?limit=1000000`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(oversizedAudit.status, 400);
  });

  it('paginates every platform ledger row with a stable created_at and id cursor', async () => {
    const domain = 'PAGINATION_TEST';
    const createdAt = '2001-01-01T00:00:00.000Z';
    const expectedIds = Array.from({ length: 205 }, (_, index) => `ledger-page-${String(index).padStart(3, '0')}`);
    for (const id of expectedIds) {
      db.execute(
        `INSERT INTO ledger_entries (id, domain, amount_paise, currency, provider, description, created_at)
         VALUES (?, ?, 1, 'INR', 'TEST', 'pagination regression', ?)`,
        [id, domain, createdAt]
      );
    }

    const userId = `ledger-auditor-${crypto.randomUUID()}`;
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at, updated_at)
       VALUES (?, ?, 'test-hash', 'Ledger Auditor', 'PLATFORM_OWNER', 1, ?, ?)`,
      [userId, `${userId}@example.invalid`, now, now]
    );
    const token = createSessionToken({ sessionId, userId, email: `${userId}@example.invalid`, role: 'PLATFORM_OWNER', permissions: ['*'] });
    db.execute(
      `INSERT INTO user_sessions (id, user_id, token_hash, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionId, userId, hashSessionToken(token), now, now, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()]
    );
    const headers = { Authorization: `Bearer ${token}` };
    const denied = await fetch(`${baseUrl}/api/v1/platform/ledger?domain=${domain}`);
    assert.equal(denied.status, 401, 'platform ledger must remain protected');

    const invalidLimit = await fetch(`${baseUrl}/api/v1/platform/ledger?limit=101`, { headers });
    assert.equal(invalidLimit.status, 400);
    const invalidCursor = await fetch(`${baseUrl}/api/v1/platform/ledger?cursor=not-a-cursor`, { headers });
    assert.equal(invalidCursor.status, 400);

    const received: any[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    do {
      const url = new URL(`${baseUrl}/api/v1/platform/ledger`);
      url.searchParams.set('domain', domain);
      url.searchParams.set('limit', '37');
      if (cursor) url.searchParams.set('cursor', cursor);
      const response = await fetch(url, { headers });
      assert.equal(response.status, 200);
      const page = await response.json() as any;
      assert.ok(Array.isArray(page.entries));
      assert.ok(page.entries.length <= 37);
      received.push(...page.entries);
      cursor = page.nextCursor || undefined;
      if (cursor) {
        assert.equal(page.hasMore, true);
        assert.equal(seenCursors.has(cursor), false, 'pagination cursor must advance');
        seenCursors.add(cursor);
      } else {
        assert.equal(page.hasMore, false);
      }
    } while (cursor);

    assert.equal(received.length, expectedIds.length, 'all rows must be returned exactly once');
    assert.equal(new Set(received.map((entry) => entry.id)).size, expectedIds.length, 'pages must not duplicate rows');
    assert.deepEqual(received.map((entry) => entry.id), [...expectedIds].sort().reverse(),
      'same-timestamp rows must use descending id order across cursor boundaries');
  });

  it('stores platform-admin permissions separately and applies revocation without re-login', async () => {
    const userId = `platform-admin-${crypto.randomUUID()}`;
    const email = `${userId}@inklly.test`;
    const password = 'PlatformAdminPassword123!';
    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, 'Scoped Platform Admin', 'PLATFORM_ADMIN', 1, ?, ?)`,
      [userId, email, `hash_${password}`, now, now]
    );
    try {
      const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      assert.equal(login.status, 200);
      const token = (await login.json() as any).token;
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      const initiallyDenied = await fetch(`${baseUrl}/api/v1/platform/overview`, { headers });
      assert.equal(initiallyDenied.status, 403, 'platform admin begins with no permission grants');

      const adminCannotGrant = await fetch(`${baseUrl}/api/v1/platform/admins/${userId}/permissions`, {
        method: 'PUT', headers, body: JSON.stringify({ permissions: ['platform:view'] }),
      });
      assert.equal(adminCannotGrant.status, 403, 'only a platform owner can change platform grants');

      const invalidGrant = await fetch(`${baseUrl}/api/v1/platform/admins/${userId}/permissions`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ permissions: ['shop:owner'] }),
      });
      assert.equal(invalidGrant.status, 400);

      const grant = await fetch(`${baseUrl}/api/v1/platform/admins/${userId}/permissions`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ permissions: ['platform:view'] }),
      });
      assert.equal(grant.status, 200);
      assert.deepEqual((await grant.json() as any).permissions, ['platform:view']);
      const allowed = await fetch(`${baseUrl}/api/v1/platform/overview`, { headers });
      assert.equal(allowed.status, 200, 'new persisted permission applies to an existing session');

      const secondLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
      });
      assert.equal(secondLogin.status, 200);
      const grantedToken = (await secondLogin.json() as any).token;
      const previouslyGrantedHeaders = { Authorization: `Bearer ${grantedToken}` };
      assert.equal((await fetch(`${baseUrl}/api/v1/platform/overview`, { headers: previouslyGrantedHeaders })).status, 200);

      const revoke = await fetch(`${baseUrl}/api/v1/platform/admins/${userId}/permissions`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ permissions: [] }),
      });
      assert.equal(revoke.status, 200);
      const immediatelyDenied = await fetch(`${baseUrl}/api/v1/platform/overview`, { headers: previouslyGrantedHeaders });
      assert.equal(immediatelyDenied.status, 403, 'revocation applies without re-login');
      assert.equal(Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM audit_events WHERE target_id = ? AND action = 'PLATFORM_ADMIN_PERMISSIONS_UPDATED'`, [userId]).count), 2);
    } finally {
      db.execute(`DELETE FROM users WHERE id = ?`, [userId]);
    }
  });

  it('validates tenant status changes and records the update atomically in the audit log', async () => {
    const organizationId = `org-status-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO organizations (id, name, owner_user_id, plan_tier, plan_status, billing_currency, created_at, updated_at)
       VALUES (?, 'Status Mutation Test', 'user-owner-1', 'STARTER', 'TRIAL', 'INR', ?, ?)`,
      [organizationId, now, now]
    );
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };
    const url = `${baseUrl}/api/v1/platform/merchants/${organizationId}/status`;
    try {
      const invalidStatus = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ planStatus: 'ROOT' }) });
      assert.equal(invalidStatus.status, 400);
      const invalidTier = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ planTier: 'UNLIMITED' }) });
      assert.equal(invalidTier.status, 400);
      assert.equal(db.queryOne<any>(`SELECT plan_status, plan_tier FROM organizations WHERE id = ?`, [organizationId]).plan_status, 'TRIAL');
      assert.equal(Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM audit_events WHERE target_id = ?`, [organizationId]).count), 0);

      const missing = await fetch(`${baseUrl}/api/v1/platform/merchants/missing-${crypto.randomUUID()}/status`, {
        method: 'PATCH', headers, body: JSON.stringify({ planStatus: 'ACTIVE' }),
      });
      assert.equal(missing.status, 404);

      const update = await fetch(url, {
        method: 'PATCH', headers, body: JSON.stringify({ planStatus: 'suspended', planTier: 'scale' }),
      });
      assert.equal(update.status, 200);
      const body = await update.json() as any;
      assert.deepEqual(body.organization, { id: organizationId, planStatus: 'SUSPENDED', planTier: 'SCALE' });

      const persisted = db.queryOne<any>(`SELECT plan_status, plan_tier FROM organizations WHERE id = ?`, [organizationId]);
      assert.equal(persisted.plan_status, 'SUSPENDED');
      assert.equal(persisted.plan_tier, 'SCALE');
      const audit = db.queryOne<any>(
        `SELECT actor_user_id, actor_role, organization_id, action, outcome, details FROM audit_events WHERE target_id = ?`,
        [organizationId]
      );
      assert.ok(audit);
      assert.equal(audit.actor_role, 'PLATFORM_OWNER');
      assert.equal(audit.organization_id, organizationId);
      assert.equal(audit.action, 'PLATFORM_MERCHANT_STATUS_UPDATED');
      assert.equal(audit.outcome, 'SUCCESS');
      assert.deepEqual(JSON.parse(audit.details), {
        previous: { planStatus: 'TRIAL', planTier: 'STARTER' },
        next: { planStatus: 'SUSPENDED', planTier: 'SCALE' },
      });
    } finally {
      db.execute(`DELETE FROM audit_events WHERE target_id = ?`, [organizationId]);
      db.execute(`DELETE FROM organizations WHERE id = ?`, [organizationId]);
    }
  });

  it('onboards a merchant transactionally and accepts a hashed, single-use owner invitation', async () => {
    const anonymous = await fetch(`${baseUrl}/api/v1/platform/merchants`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationName: 'Invite Test Shop', ownerName: 'Invite Owner', ownerEmail: 'invite-owner@example.test', planTier: 'STARTER' }),
    });
    assert.equal(anonymous.status, 401);

    const merchantAttempt = await fetch(`${baseUrl}/api/v1/platform/merchants`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
      body: JSON.stringify({ organizationName: 'Forbidden Shop', ownerName: 'Forbidden Owner', ownerEmail: 'forbidden@example.test', planTier: 'STARTER' }),
    });
    assert.equal(merchantAttempt.status, 403);
    const invalidPlan = await fetch(`${baseUrl}/api/v1/platform/merchants`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ organizationName: 'Invalid Tier', ownerName: 'Invalid Owner', ownerEmail: 'invalid-tier@example.test', planTier: 'UNKNOWN' }),
    });
    assert.equal(invalidPlan.status, 400);
    assert.equal(db.queryOne<any>(`SELECT id FROM users WHERE email = ?`, ['invalid-tier@example.test']), null);

    const onboard = await fetch(`${baseUrl}/api/v1/platform/merchants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ organizationName: 'Invite Test Shop', shopCode: 'invite-test-shop', ownerName: 'Invite Owner', ownerEmail: 'INVITE-OWNER@example.test', planTier: 'STARTER' }),
    });
    assert.equal(onboard.status, 201);
    const body = await onboard.json() as any;
    assert.equal(body.merchant.planStatus, 'TRIAL');
    assert.equal(body.merchant.owner.email, 'invite-owner@example.test');
    assert.ok(body.invitationToken);

    const owner = db.queryOne<any>(`SELECT id, is_active FROM users WHERE email = ?`, ['invite-owner@example.test']);
    assert.equal(owner.is_active, 0);
    const invitation = db.queryOne<any>(`SELECT token_hash, expires_at FROM account_invitations WHERE user_id = ?`, [owner.id]);
    assert.notEqual(invitation.token_hash, body.invitationToken);
    assert.equal(invitation.token_hash, crypto.createHash('sha256').update(body.invitationToken).digest('hex'));
    assert.ok(Date.parse(invitation.expires_at) > Date.now());
    assert.equal(db.queryOne<any>(`SELECT status FROM subscriptions WHERE organization_id = ?`, [body.merchant.id]).status, 'TRIALING');
    assert.equal(db.queryOne<any>(`SELECT COUNT(*) AS count FROM rate_rules WHERE shop_id = ?`, [body.merchant.shopId]).count, 4);
    const audit = db.queryOne<any>(`SELECT actor_user_id, outcome FROM audit_events WHERE action = 'PLATFORM_MERCHANT_ONBOARDED' AND target_id = ?`, [body.merchant.id]);
    assert.equal(audit.actor_user_id, adminToken ? db.queryOne<any>(`SELECT id FROM users WHERE email = 'admin@inklly.com'`).id : null);
    assert.equal(audit.outcome, 'SUCCESS');

    const weak = await fetch(`${baseUrl}/api/v1/auth/invitations/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: body.invitationToken, password: 'weak-password-123' }),
    });
    assert.equal(weak.status, 400);
    const accepted = await fetch(`${baseUrl}/api/v1/auth/invitations/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: body.invitationToken, password: 'StrongInvitePassword123!' }),
    });
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json() as any).success, true);
    assert.equal(db.queryOne<any>(`SELECT is_active FROM users WHERE id = ?`, [owner.id]).is_active, 1);

    const replay = await fetch(`${baseUrl}/api/v1/auth/invitations/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: body.invitationToken, password: 'AnotherStrongPassword123!' }),
    });
    assert.equal(replay.status, 400);
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invite-owner@example.test', password: 'StrongInvitePassword123!' }),
    });
    assert.equal(login.status, 200);

    const expiredOnboard = await fetch(`${baseUrl}/api/v1/platform/merchants`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ organizationName: 'Expired Invite Shop', shopCode: 'expired-invite', ownerName: 'Expired Owner', ownerEmail: 'expired-invite@example.test', planTier: 'GROWTH' }),
    });
    assert.equal(expiredOnboard.status, 201);
    const expiredBody = await expiredOnboard.json() as any;
    db.execute(`UPDATE account_invitations SET expires_at = ? WHERE token_hash = ?`, [new Date(Date.now() - 1000).toISOString(), crypto.createHash('sha256').update(expiredBody.invitationToken).digest('hex')]);
    const expiredAccept = await fetch(`${baseUrl}/api/v1/auth/invitations/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: expiredBody.invitationToken, password: 'StrongInvitePassword123!' }),
    });
    assert.equal(expiredAccept.status, 400);
    assert.equal(db.queryOne<any>(`SELECT is_active FROM users WHERE email = ?`, ['expired-invite@example.test']).is_active, 0);
  });

  it('invites staff with scoped preset permissions and a single-use activation token', async () => {
    const staffPayload = {
      fullName: 'Asha Staff', email: `asha-${crypto.randomUUID()}@example.test`,
      rolePreset: 'Order Handler', phone: '+91 97654 32100',
    };
    const wrongShop = await fetch(`${baseUrl}/api/v1/merchant/staff`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}`, 'x-shop-id': 'shop-starter-99' },
      body: JSON.stringify(staffPayload),
    });
    assert.equal(wrongShop.status, 403);

    const staffSessionId = crypto.randomUUID();
    const staffSessionNow = new Date().toISOString();
    const existingStaffToken = createSessionToken({
      sessionId: staffSessionId, userId: 'user-staff-1', email: 'operator@campusprint.in', role: 'SHOP_STAFF',
      organizationId: 'org-campus-network', shopId: 'shop-campus-1', permissions: ['orders:view'],
    });
    db.execute(
      `INSERT INTO user_sessions (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`,
      [staffSessionId, 'user-staff-1', hashSessionToken(existingStaffToken), staffSessionNow, new Date(Date.now() + 60_000).toISOString()]
    );
    const nonOwner = await fetch(`${baseUrl}/api/v1/merchant/staff`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${existingStaffToken}` },
      body: JSON.stringify(staffPayload),
    });
    assert.equal(nonOwner.status, 403);
    db.execute(`UPDATE user_sessions SET revoked_at = ? WHERE id = ?`, [new Date().toISOString(), staffSessionId]);
    for (const invalid of [
      { ...staffPayload, email: 'bad-email' },
      { ...staffPayload, fullName: 'A' },
      { ...staffPayload, phone: 'not-a-phone' },
      { ...staffPayload, rolePreset: 'Platform Owner' },
    ]) {
      const response = await fetch(`${baseUrl}/api/v1/merchant/staff`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify(invalid),
      });
      assert.equal(response.status, 400);
    }

    const created = await fetch(`${baseUrl}/api/v1/merchant/staff`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
      body: JSON.stringify(staffPayload),
    });
    assert.equal(created.status, 201);
    const result = await created.json() as any;
    assert.equal(result.success, true);
    assert.equal(result.staff.rolePreset, 'Order Handler');
    assert.ok(result.invitationToken);
    assert.ok(Date.parse(result.invitationExpiresAt) > Date.now());

    const staff = db.queryOne<any>(`SELECT id, email, phone, is_active, password_hash FROM users WHERE id = ?`, [result.staff.userId]);
    assert.equal(staff.email, staffPayload.email);
    assert.equal(staff.phone, '+919765432100');
    assert.equal(staff.is_active, 0);
    assert.ok(staff.password_hash.startsWith('scrypt$'));
    const membership = db.queryOne<any>(`SELECT organization_id, shop_id, role, permissions FROM memberships WHERE user_id = ?`, [staff.id]);
    assert.equal(membership.organization_id, 'org-campus-network');
    assert.equal(membership.shop_id, 'shop-campus-1');
    assert.equal(membership.role, 'SHOP_STAFF');
    assert.deepEqual(JSON.parse(membership.permissions), ['orders:view', 'orders:process', 'live_print:manage', 'shop_qr:view', 'storage:view']);
    const invite = db.queryOne<any>(`SELECT token_hash FROM account_invitations WHERE user_id = ?`, [staff.id]);
    assert.equal(invite.token_hash, crypto.createHash('sha256').update(result.invitationToken).digest('hex'));
    assert.notEqual(invite.token_hash, result.invitationToken);
    const audit = db.queryOne<any>(`SELECT actor_user_id, shop_id, organization_id, action FROM audit_events WHERE target_id = ?`, [staff.id]);
    assert.equal(audit.actor_user_id, db.queryOne<any>(`SELECT id FROM users WHERE email = 'owner@campusprint.in'`).id);
    assert.equal(audit.shop_id, 'shop-campus-1');
    assert.equal(audit.organization_id, 'org-campus-network');
    assert.equal(audit.action, 'MERCHANT_STAFF_INVITED');

    const duplicate = await fetch(`${baseUrl}/api/v1/merchant/staff`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
      body: JSON.stringify(staffPayload),
    });
    assert.equal(duplicate.status, 409);

    const weakPassword = await fetch(`${baseUrl}/api/v1/auth/invitations/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: result.invitationToken, password: 'weakpassword123' }),
    });
    assert.equal(weakPassword.status, 400);
    const accepted = await fetch(`${baseUrl}/api/v1/auth/invitations/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: result.invitationToken, password: 'StrongStaffPassword123!' }),
    });
    assert.equal(accepted.status, 200);
    assert.equal(db.queryOne<any>(`SELECT is_active FROM users WHERE id = ?`, [staff.id]).is_active, 1);
    const replay = await fetch(`${baseUrl}/api/v1/auth/invitations/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: result.invitationToken, password: 'AnotherStrongPassword123!' }),
    });
    assert.equal(replay.status, 400);

    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: staffPayload.email, password: 'StrongStaffPassword123!' }),
    });
    assert.equal(login.status, 200);
    const loginBody = await login.json() as any;
    assert.equal(loginBody.user.role, 'SHOP_STAFF');
    assert.equal(loginBody.shopId, 'shop-campus-1');
    const loginSession = verifySessionToken(loginBody.token);
    assert.ok(loginSession && loginSession !== 'expired');
    assert.deepEqual((loginSession as any).permissions, JSON.parse(membership.permissions));

    const expiredPayload = { ...staffPayload, email: `expired-staff-${crypto.randomUUID()}@example.test` };
    const expiredCreate = await fetch(`${baseUrl}/api/v1/merchant/staff`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
      body: JSON.stringify(expiredPayload),
    });
    const expiredBody = await expiredCreate.json() as any;
    assert.equal(expiredCreate.status, 201);
    db.execute(`UPDATE account_invitations SET expires_at = ? WHERE user_id = ?`, [new Date(Date.now() - 1000).toISOString(), expiredBody.staff.userId]);
    const expiredAccept = await fetch(`${baseUrl}/api/v1/auth/invitations/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: expiredBody.invitationToken, password: 'StrongStaffPassword123!' }),
    });
    assert.equal(expiredAccept.status, 400);
    assert.equal(db.queryOne<any>(`SELECT is_active FROM users WHERE id = ?`, [expiredBody.staff.userId]).is_active, 0);
  });

  it('allows owners to edit or revoke shop staff access with immediate tenant-scoped effect', async () => {
    const shop = db.queryOne<any>(`SELECT s.id AS shop_id, s.organization_id, o.owner_user_id FROM shops s JOIN organizations o ON o.id = s.organization_id WHERE s.id = 'shop-campus-1'`);
    const ownerId = shop.owner_user_id as string;
    const staffId = `staff-lifecycle-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO users (id, email, phone, password_hash, full_name, role, is_active, created_at, updated_at)
       VALUES (?, ?, NULL, 'test-hash', 'Lifecycle Staff', 'SHOP_STAFF', 1, ?, ?)`,
      [staffId, `${staffId}@example.test`, now, now]
    );
    db.execute(
      `INSERT INTO memberships (id, user_id, organization_id, shop_id, role, permissions, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'SHOP_STAFF', ?, ?, ?)`,
      [`membership-${staffId}`, staffId, shop.organization_id, shop.shop_id, JSON.stringify(['orders:view']), now, now]
    );
    const sessionId = crypto.randomUUID();
    const staffToken = createSessionToken({
      sessionId, userId: staffId, email: `${staffId}@example.test`, role: 'SHOP_STAFF',
      organizationId: shop.organization_id, shopId: shop.shop_id, permissions: ['orders:view'],
    });
    db.execute(
      `INSERT INTO user_sessions (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`,
      [sessionId, staffId, hashSessionToken(staffToken), now, new Date(Date.now() + 60_000).toISOString()]
    );
    const ownerHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` };
    const staffHeaders = { Authorization: `Bearer ${staffToken}` };
    const staffPath = `${baseUrl}/api/v1/merchant/staff/${encodeURIComponent(staffId)}`;

    try {
      const wrongTenant = await fetch(staffPath, {
        method: 'PUT', headers: { ...ownerHeaders, 'x-shop-id': 'shop-starter-99' },
        body: JSON.stringify({ rolePreset: 'Print Operator', isActive: true }),
      });
      assert.equal(wrongTenant.status, 403);

      const nonOwner = await fetch(staffPath, {
        method: 'PUT', headers: { ...staffHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rolePreset: 'Print Operator', isActive: true }),
      });
      assert.equal(nonOwner.status, 403);

      const ownerIdFromToken = verifySessionToken(merchantToken);
      assert.ok(ownerIdFromToken && ownerIdFromToken !== 'expired');
      const ownerLockout = await fetch(`${baseUrl}/api/v1/merchant/staff/${encodeURIComponent(ownerId)}`, {
        method: 'PUT', headers: ownerHeaders,
        body: JSON.stringify({ rolePreset: 'Order Handler', isActive: false }),
      });
      assert.equal(ownerLockout.status, 409);

      const unknownPermission = await fetch(staffPath, {
        method: 'PUT', headers: ownerHeaders,
        body: JSON.stringify({ rolePreset: 'Custom', permissions: ['platform:manage'], isActive: true }),
      });
      assert.equal(unknownPermission.status, 400);

      const presetUpdate = await fetch(staffPath, {
        method: 'PUT', headers: ownerHeaders,
        body: JSON.stringify({ rolePreset: 'Print Operator', isActive: true }),
      });
      assert.equal(presetUpdate.status, 200);
      const printersGranted = await fetch(`${baseUrl}/api/v1/merchant/printers`, { headers: staffHeaders });
      assert.equal(printersGranted.status, 200, 'a persisted grant is effective on the next request despite stale token claims');

      const customUpdate = await fetch(staffPath, {
        method: 'PUT', headers: ownerHeaders,
        body: JSON.stringify({ rolePreset: 'Custom', permissions: ['storage:view'], isActive: true }),
      });
      assert.equal(customUpdate.status, 200);
      const removedPrinterAccess = await fetch(`${baseUrl}/api/v1/merchant/printers`, { headers: staffHeaders });
      assert.equal(removedPrinterAccess.status, 403);
      const storageAccess = await fetch(`${baseUrl}/api/v1/merchant/storage/documents`, { headers: staffHeaders });
      assert.equal(storageAccess.status, 200, 'custom permission changes are also effective on the next request');

      const revoke = await fetch(staffPath, {
        method: 'PUT', headers: ownerHeaders,
        body: JSON.stringify({ rolePreset: 'Custom', permissions: ['storage:view'], isActive: false }),
      });
      assert.equal(revoke.status, 200);
      const revokedSession = await fetch(`${baseUrl}/api/v1/merchant/storage/documents`, { headers: staffHeaders });
      assert.equal(revokedSession.status, 401, 'revoked membership invalidates an existing staff session immediately');
      const audit = db.queryOne<any>(
        `SELECT action, actor_user_id, details FROM audit_events WHERE target_id = ? AND action = 'MERCHANT_STAFF_ACCESS_REVOKED' ORDER BY id DESC LIMIT 1`,
        [`membership-${staffId}`]
      );
      assert.equal(audit.action, 'MERCHANT_STAFF_ACCESS_REVOKED');
      assert.equal(audit.actor_user_id, ownerId);
      assert.equal(JSON.parse(audit.details).isActive, false);
    } finally {
      db.execute(`DELETE FROM user_sessions WHERE user_id = ?`, [staffId]);
      db.execute(`DELETE FROM memberships WHERE user_id = ?`, [staffId]);
      db.execute(`DELETE FROM users WHERE id = ?`, [staffId]);
    }
  });

  it('Developer Portal generates OpenAPI spec and creates scoped API keys', async () => {
    const specRes = await fetch(`${baseUrl}/api/v1/developer/openapi.json`);
    assert.equal(specRes.status, 200);
    const spec = await specRes.json();
    assert.equal(spec.openapi, '3.0.3');
    assert.ok(spec.paths['/portal/quote']);
    assert.ok(spec.paths['/subscriptions/usage']?.get.description.includes('does not create a charge'));
    assert.ok(spec.paths['/subscriptions/invoices']?.get.description.includes('never records payment'));
    assert.ok(spec.paths['/platform/billing/invoices']?.post.description.includes('Does not charge'));
    assert.ok(spec.paths['/platform/admins']?.get.description.includes('Platform-owner only'));
    assert.ok(spec.paths['/platform/admins/{id}/permissions']?.put.description.includes('take effect on the next request'));
    assert.ok(spec.paths['/merchant/settings']?.put.description.includes('settings:manage'));
    assert.ok(!spec.paths['/subscriptions/usage']?.get.description.includes('active subscription'));
    assert.ok(spec.paths['/developer/webhooks/{id}/deliveries']?.get.description.includes('HMAC SHA-256'));

    const requiredMerchantOperations: Record<string, string[]> = {
      '/merchant/dashboard': ['get'],
      '/merchant/orders': ['get'],
      '/merchant/orders/{id}': ['get'],
      '/merchant/orders/{id}/files/{fileId}': ['get'],
      '/merchant/orders/{id}/status': ['patch'],
      '/merchant/orders/{id}/reconcile-output': ['post'],
      '/merchant/orders/{id}/print': ['post'],
      '/merchant/agents/pairing-code': ['post'],
      '/merchant/agents/{id}': ['delete'],
      '/merchant/rates': ['get', 'put'],
      '/merchant/discounts/bulk': ['put'],
      '/merchant/printers': ['get', 'post'],
      '/merchant/printers/{id}/default': ['put'],
      '/merchant/settings': ['get', 'put'],
      '/merchant/settings/razorpay': ['get', 'put', 'delete'],
      '/merchant/settings/razorpay/test': ['post'],
      '/merchant/staff': ['get', 'post'],
      '/merchant/staff/{userId}': ['put'],
      '/merchant/bot-templates': ['get', 'put'],
      '/merchant/credits/balance': ['get'],
      '/merchant/credits/purchase': ['post'],
      '/merchant/payouts': ['get', 'post'],
      '/merchant/storage/categories': ['get', 'post'],
      '/merchant/storage/categories/{id}': ['delete'],
      '/merchant/storage/documents': ['get', 'post'],
      '/merchant/storage/documents/{id}/download': ['get'],
      '/merchant/storage/documents/{id}': ['delete'],
      '/merchant/whatsapp/setup': ['get', 'post'],
      '/merchant/whatsapp/qr-pairing': ['post'],
      '/merchant/whatsapp/qr-pairing/refresh': ['post'],
      '/merchant/whatsapp/account/{id}': ['delete'],
      '/merchant/whatsapp/events': ['get'],
    };
    assert.equal(spec.components.securitySchemes.bearerAuth.scheme, 'bearer');
    for (const [path, methods] of Object.entries(requiredMerchantOperations)) {
      for (const method of methods) {
        const operation = spec.paths[path]?.[method];
        assert.ok(operation, `OpenAPI must document ${method.toUpperCase()} ${path}`);
        assert.ok(operation.summary, `${method.toUpperCase()} ${path} must have a summary`);
        assert.ok(operation.description, `${method.toUpperCase()} ${path} must describe its access requirements`);
        assert.ok(operation.security?.some((requirement: any) => Array.isArray(requirement.bearerAuth)), `${method.toUpperCase()} ${path} must require bearer authentication`);
        assert.ok(operation.responses?.default, `${method.toUpperCase()} ${path} must document a response`);
      }
    }

    // Create developer key
    const keyRes = await fetch(`${baseUrl}/api/v1/developer/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({
        keyName: 'Integration CI Key',
        environment: 'TEST',
        scopes: ['orders:read', 'orders:write'],
      }),
    });

    assert.equal(keyRes.status, 201);
    const keyData = await keyRes.json();
    assert.ok(keyData.apiKeySecret.startsWith('ink_test_'));
    assert.equal('secretHash' in keyData.key, false, 'one-time key creation must not expose the stored verifier');
    const apiKey = keyData.apiKeySecret as string;
    const scopedDashboard = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    assert.equal(scopedDashboard.status, 200, 'valid TEST key with orders:read must authenticate to its bound shop');
    const crossShopApiKey = await fetch(`${baseUrl}/api/v1/merchant/dashboard?shopId=shop-other-tenant`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    assert.equal(crossShopApiKey.status, 403, 'API key must not escape its bound shop');
    const ownerOnlyApiKey = await fetch(`${baseUrl}/api/v1/merchant/settings/razorpay`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    assert.equal(ownerOnlyApiKey.status, 403, 'API key must never inherit merchant-owner route access');

    const readOnlyKeyResponse = await fetch(`${baseUrl}/api/v1/developer/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
      body: JSON.stringify({ keyName: 'Read only test', environment: 'TEST', scopes: ['orders:read'] }),
    });
    assert.equal(readOnlyKeyResponse.status, 201);
    const readOnlyKey = (await readOnlyKeyResponse.json() as any).apiKeySecret as string;
    const readOnlyWrite = await fetch(`${baseUrl}/api/v1/merchant/orders/${cashOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${readOnlyKey}` },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    assert.equal(readOnlyWrite.status, 403, 'orders:read must not authorize order mutation');

    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const wrongEnvironment = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    assert.equal(wrongEnvironment.status, 401, 'TEST API keys must not work in LIVE runtime');
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    process.env.ENABLE_EXTERNAL_API_ACCESS = 'false';
    const disabledApiKey = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    assert.equal(disabledApiKey.status, 403, 'API keys must fail closed when external API access is disabled');
    process.env.ENABLE_EXTERNAL_API_ACCESS = 'true';

    const revokedKeyId = keyData.key.id as string;
    const revoked = await fetch(`${baseUrl}/api/v1/developer/keys/${revokedKeyId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${merchantToken}` },
    });
    assert.equal(revoked.status, 200);
    const revokedUse = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    assert.equal(revokedUse.status, 401, 'revoked API keys must stop authenticating immediately');

    const listedKeysRes = await fetch(`${baseUrl}/api/v1/developer/keys`, { headers: { Authorization: `Bearer ${merchantToken}` } });
    assert.equal(listedKeysRes.status, 200);
    const listedKeys = await listedKeysRes.json() as any[];
    assert.ok(listedKeys.length > 0);
    assert.ok(listedKeys.every((key) => !('secretHash' in key)), 'key listing must never expose stored verifiers');

    const invalidScopes = await fetch(`${baseUrl}/api/v1/developer/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
      body: JSON.stringify({ keyName: 'Invalid scope key', environment: 'TEST', scopes: ['admin:*'] }),
    });
    assert.equal(invalidScopes.status, 400);

    const invalidEnvironment = await fetch(`${baseUrl}/api/v1/developer/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
      body: JSON.stringify({ keyName: 'Invalid env key', environment: 'ROOT', scopes: ['orders:read'] }),
    });
    assert.equal(invalidEnvironment.status, 400);
  });

  it('encrypts webhook secrets at rest and migrates legacy plaintext without exposing stored values', async () => {
    const oldKey = process.env.RAZORPAY_CREDENTIALS_ENCRYPTION_KEY;
    try {
      const orgId = db.queryOne<any>(`SELECT id FROM organizations LIMIT 1`)?.id;
      assert.ok(orgId);
      const repo = new AgentRepository(db);

      delete process.env.RAZORPAY_CREDENTIALS_ENCRYPTION_KEY;
      const unavailable = await fetch(`${baseUrl}/api/v1/developer/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ targetUrl: 'https://hooks.example.com/inklly', eventTypes: ['order.created'] }),
      });
      assert.equal(unavailable.status, 503, 'webhook creation must fail closed without the encryption key');

      process.env.RAZORPAY_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 42).toString('base64');
      for (const unsafeUrl of ['http://hooks.example.com/callback', 'https://localhost/hook', 'https://127.0.0.1/hook', 'https://[::1]/hook']) {
        const rejected = await fetch(`${baseUrl}/api/v1/developer/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
          body: JSON.stringify({ targetUrl: unsafeUrl, eventTypes: ['order.created'] }),
        });
        assert.equal(rejected.status, 400, `unsafe webhook target must be rejected: ${unsafeUrl}`);
      }
      const unsupportedEvent = await fetch(`${baseUrl}/api/v1/developer/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ targetUrl: 'https://hooks.example.com/inklly', eventTypes: ['admin.secret_export'] }),
      });
      assert.equal(unsupportedEvent.status, 400);

      const legacyId = `whk-legacy-${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      db.execute(
        `INSERT INTO webhook_subscriptions (id, organization_id, target_url, secret, event_types, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [legacyId, orgId, 'https://hooks.example.com/callback', 'whsec_legacy_plaintext', JSON.stringify(['order.created']), now, now]
      );
      assert.equal(repo.migrateLegacyWebhookSecrets(encryptWebhookSecret), 1);
      assert.equal(repo.migrateLegacyWebhookSecrets(encryptWebhookSecret), 0, 'legacy migration must be idempotent');
      const migrated = db.queryOne<any>(`SELECT secret FROM webhook_subscriptions WHERE id = ?`, [legacyId]);
      assert.match(migrated.secret, /^inklly:enc:v1:webhook:/);
      assert.equal(decryptWebhookSecret(migrated.secret), 'whsec_legacy_plaintext');
      const originalKey = process.env.RAZORPAY_CREDENTIALS_ENCRYPTION_KEY;
      process.env.RAZORPAY_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 43).toString('base64');
      assert.throws(() => decryptWebhookSecret(migrated.secret));
      process.env.RAZORPAY_CREDENTIALS_ENCRYPTION_KEY = originalKey;

      const created = await fetch(`${baseUrl}/api/v1/developer/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ targetUrl: 'https://hooks.example.com/inklly', eventTypes: ['order.created'] }),
      });
      assert.equal(created.status, 201);
      const createdBody = await created.json() as any;
      assert.match(createdBody.webhookSecret, /^whsec_[a-f0-9]{64}$/);
      const stored = db.queryOne<any>(`SELECT secret FROM webhook_subscriptions WHERE id = ?`, [createdBody.id]);
      assert.match(stored.secret, /^inklly:enc:v1:webhook:/);
      assert.equal(decryptWebhookSecret(stored.secret), createdBody.webhookSecret);

      const listed = await fetch(`${baseUrl}/api/v1/developer/webhooks`, { headers: { Authorization: `Bearer ${merchantToken}` } });
      assert.equal(listed.status, 200);
      const subscriptions = await listed.json() as any[];
      assert.ok(subscriptions.every((item) => !('secret' in item) && !('webhookSecret' in item)));

      const eventId = repo.enqueueWebhookEvent(createdBody.organizationId, 'order.created', `webhook-history-test:${crypto.randomUUID()}`, { orderId: 'ord_history_test' });
      const historyResponse = await fetch(`${baseUrl}/api/v1/developer/webhooks/${encodeURIComponent(createdBody.id)}/deliveries`, {
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(historyResponse.status, 200);
      const history = await historyResponse.json() as any[];
      assert.equal(history.length, 1);
      assert.equal(history[0].eventId, eventId);
      assert.equal(history[0].status, 'PENDING');

      const invalidHistoryQuery = await fetch(`${baseUrl}/api/v1/developer/webhooks/${encodeURIComponent(createdBody.id)}/deliveries?limit=500`, {
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(invalidHistoryQuery.status, 400);

      db.execute(`UPDATE webhook_deliveries SET status = 'IN_PROGRESS' WHERE event_id = ?`, [eventId]);
      const blockedRotation = await fetch(`${baseUrl}/api/v1/developer/webhooks/${encodeURIComponent(createdBody.id)}/rotate-secret`, {
        method: 'POST', headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(blockedRotation.status, 409, 'secret rotation must not race an in-flight signed attempt');
      db.execute(`UPDATE webhook_deliveries SET status = 'PENDING' WHERE event_id = ?`, [eventId]);

      const rotation = await fetch(`${baseUrl}/api/v1/developer/webhooks/${encodeURIComponent(createdBody.id)}/rotate-secret`, {
        method: 'POST', headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(rotation.status, 200);
      const rotated = await rotation.json() as any;
      assert.notEqual(rotated.webhookSecret, createdBody.webhookSecret);
      assert.equal(decryptWebhookSecret(db.queryOne<any>(`SELECT secret FROM webhook_subscriptions WHERE id = ?`, [createdBody.id]).secret), rotated.webhookSecret);

      const revoked = await fetch(`${baseUrl}/api/v1/developer/webhooks/${encodeURIComponent(createdBody.id)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(revoked.status, 200);
      assert.equal(db.queryOne<any>(`SELECT status FROM webhook_deliveries WHERE event_id = ? AND subscription_id = ?`, [eventId, createdBody.id]).status, 'CANCELLED');
      const afterRevoke = await fetch(`${baseUrl}/api/v1/developer/webhooks/${encodeURIComponent(createdBody.id)}/deliveries`, {
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(afterRevoke.status, 200, 'delivery history remains available after revocation');
      const afterRevokeList = await fetch(`${baseUrl}/api/v1/developer/webhooks`, { headers: { Authorization: `Bearer ${merchantToken}` } });
      const afterRevokeSubscriptions = await afterRevokeList.json() as any[];
      assert.equal(afterRevokeSubscriptions.find((item) => item.id === createdBody.id)?.isActive, false,
        'revoked destinations remain visible to their owner for audit history');
    } finally {
      if (oldKey === undefined) delete process.env.RAZORPAY_CREDENTIALS_ENCRYPTION_KEY;
      else process.env.RAZORPAY_CREDENTIALS_ENCRYPTION_KEY = oldKey;
    }
  });

  // ─── MILESTONE 1: ONBOARDING, AUTHENTICATION & TENANT ISOLATION ───

  it('Registers new merchant, provisions org, shop, and baseline rates (pending subscription payment)', async () => {
    const regPayload = {
      orgName: 'Om Sai Digital Xerox',
      shopName: 'Om Sai Xerox Hub',
      shopCode: 'om-sai-hub',
      ownerName: 'Vikas Patil',
      email: 'vikas@omsaixerox.in',
      password: 'NewMerchantPassword123!',
      phone: '+91 98222 33445',
      address: 'Shop 4, University Road',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411007',
    };

    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regPayload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.registrationComplete, true);
    assert.equal(body.organization.planStatus, 'TRIAL');
    assert.equal(body.subscription.status, 'TRIALING');
    assert.equal(body.subscription.amountPaise, 0);
    assert.equal(body.user.email, 'vikas@omsaixerox.in');
    assert.equal(body.shop.shopCode, 'om-sai-hub');
    assert.equal(body.organization.planTier, 'STARTER');
    assert.ok(body.shopId);
    assert.ok(body.organizationId);

    // Activate subscription via platform admin (simulate payment completion)
    const activateRes = await fetch(`${baseUrl}/api/v1/platform/merchants/${body.organizationId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        planTier: 'STARTER',
        planStatus: 'ACTIVE',
      }),
    });
    assert.equal(activateRes.status, 200);

    // Log in to get credentials
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'vikas@omsaixerox.in',
        password: 'NewMerchantPassword123!',
      }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.ok(loginData.token);

    // Verify baseline rates created in portal
    const shopRes = await fetch(`${baseUrl}/api/v1/portal/shop/om-sai-hub`);
    assert.equal(shopRes.status, 200);
    const shopData = await shopRes.json();
    assert.equal(shopData.rates.bw_simplex, 2);
    assert.equal(shopData.rates.bw_duplex, 1.5);
    assert.equal(shopData.rates.color_simplex, 10);
  });

  it('Rejects duplicate email registration with HTTP 409 Conflict (case-insensitive)', async () => {
    const duplicatePayload = {
      shopName: 'Duplicate Xerox',
      ownerName: 'Vikas P',
      email: '  VIKAS@omsaixerox.in  ',
      password: 'NewMerchantPassword123!',
    };

    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(duplicatePayload),
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.ok(body.error.includes('already exists'));
  });

  it('Resolves slug collisions by auto-incrementing hyphenated suffix', async () => {
    // 1st collision with seeded 'campus1'
    const res1 = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: 'Campus Print 1',
        shopCode: 'campus1',
        ownerName: 'Owner 2',
        email: 'collision1@test.in',
        password: 'NewMerchantPassword123!',
      }),
    });
    assert.equal(res1.status, 201);
    const body1 = await res1.json();
    assert.equal(body1.shop.shopCode, 'campus1-1');

    // 2nd collision
    const res2 = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: 'Campus Print 1',
        shopCode: 'campus1',
        ownerName: 'Owner 3',
        email: 'collision2@test.in',
        password: 'NewMerchantPassword123!',
      }),
    });
    assert.equal(res2.status, 201);
    const body2 = await res2.json();
    assert.equal(body2.shop.shopCode, 'campus1-2');
  });

  it('Normalizes special characters and spaces in shop slug', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: 'Shree Balaji & Sons Xerox @ Karve Nagar!!',
        ownerName: 'Sunil Joshi',
        email: 'sunil@balajixerox.in',
        password: 'NewMerchantPassword123!',
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.shop.shopCode, 'shree-balaji-sons-xerox-karve-nagar');
  });

  it('Rejects registration with missing required fields with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'incomplete@test.in', password: '123' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('Missing required'));
  });

  it('Rejects login with invalid credentials or unknown email with HTTP 401/400', async () => {
    // Unknown email
    const unknownRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ghost@nonexistent.in', password: 'password123' }),
    });
    assert.equal(unknownRes.status, 401);

    // Wrong password
    const wrongPassRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@campusprint.in', password: 'TotallyWrongPassword!' }),
    });
    assert.equal(wrongPassRes.status, 401);

    // Missing fields
    const missingRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@campusprint.in' }),
    });
    assert.equal(missingRes.status, 400);
  });

  it('Hydrates authenticated session via GET /api/v1/auth/me', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user.email, 'owner@campusprint.in');
    assert.equal(body.shop.id, 'shop-campus-1');
    assert.equal(body.organization.id, 'org-campus-network');
  });

  it('Rejects protected endpoints when token is missing, malformed, or expired with HTTP 401', async () => {
    // Missing token
    const noTokenRes = await fetch(`${baseUrl}/api/v1/merchant/dashboard`);
    assert.equal(noTokenRes.status, 401);

    // Malformed token
    const malformedRes = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
      headers: { Authorization: 'Bearer this-is-not-valid-base64-json' },
    });
    assert.equal(malformedRes.status, 401);

    // Expired token
    const expiredPayload = {
      userId: 'user-expired',
      email: 'expired@test.in',
      role: 'MERCHANT_OWNER',
      shopId: 'shop-campus-1',
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour in the past
    };
    const expiredToken = Buffer.from(JSON.stringify(expiredPayload)).toString('base64');
    const expiredRes = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(expiredRes.status, 401);
    const expiredBody = await expiredRes.json();
    assert.ok(expiredBody.error.includes('expired') || expiredBody.error.includes('Invalid'));
  });

  it('Enforces cross-tenant isolation: blocks foreign shop query, header spoofing, and order tampering with HTTP 403', async () => {
    // 1. Cross-tenant query param tampering
    const foreignQueryRes = await fetch(`${baseUrl}/api/v1/merchant/dashboard?shopId=shop-other-tenant`, {
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    assert.equal(foreignQueryRes.status, 403);
    const foreignQueryBody = await foreignQueryRes.json();
    assert.ok(foreignQueryBody.error.includes('Tenant isolation violation'));

    // 2. Cross-tenant header spoofing
    const headerSpoofRes = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
      headers: {
        Authorization: `Bearer ${merchantToken}`,
        'x-shop-id': 'shop-other-tenant',
      },
    });
    assert.equal(headerSpoofRes.status, 403);

    // 3. Register a second merchant to obtain a different tenant token
    const reg2 = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: 'Tenant 2 Xerox',
        ownerName: 'Tenant Two',
        email: 'tenant2@test.in',
        password: 'NewMerchantPassword123!',
      }),
    });
    assert.equal(reg2.status, 201);
    const reg2Body = await reg2.json();
    assert.equal(reg2Body.registrationComplete, true);

    // Activate tenant 2 subscription via platform admin
    const activateRes = await fetch(`${baseUrl}/api/v1/platform/merchants/${reg2Body.organizationId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        planTier: 'STARTER',
        planStatus: 'ACTIVE',
      }),
    });
    assert.equal(activateRes.status, 200);

    // Log in as tenant 2 to get token
    const login2Res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tenant2@test.in',
        password: 'NewMerchantPassword123!',
      }),
    });
    assert.equal(login2Res.status, 200);
    const tenant2Token = (await login2Res.json()).token;

    const vaultUpload = await fetch(`${baseUrl}/api/v1/merchant/storage/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
      body: JSON.stringify({ fileName: 'private-vault.pdf', fileData: makeTestPdf().toString('base64') }),
    });
    assert.equal(vaultUpload.status, 201);
    const vaultDocument = (await vaultUpload.json() as any).document;
    const crossTenantDownload = await fetch(`${baseUrl}${vaultDocument.downloadUrl}`, {
      headers: { Authorization: `Bearer ${tenant2Token}` },
    });
    assert.equal(crossTenantDownload.status, 404);
    const crossTenantDelete = await fetch(`${baseUrl}/api/v1/merchant/storage/documents/${encodeURIComponent(vaultDocument.id)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${tenant2Token}` },
    });
    assert.equal(crossTenantDelete.status, 404);
    const ownerDeleteVault = await fetch(`${baseUrl}/api/v1/merchant/storage/documents/${encodeURIComponent(vaultDocument.id)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${merchantToken}` },
    });
    assert.equal(ownerDeleteVault.status, 200);

    // 4. Fetch Tenant 1's order to get its real ID
    const ordersRes = await fetch(`${baseUrl}/api/v1/merchant/orders`, {
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    const orders = await ordersRes.json();
    const tenant1OrderId = orders[0]?.id;
    assert.ok(tenant1OrderId);

    // 5. Tenant 2 attempts to inspect Tenant 1's order
    const getOrderRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${tenant1OrderId}`, {
      headers: { Authorization: `Bearer ${tenant2Token}` },
    });
    assert.equal(getOrderRes.status, 403);

    // 6. Tenant 2 attempts to tamper with Tenant 1's order status
    const tamperRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${tenant1OrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({ status: 'COLLECTED' }),
    });
    assert.equal(tamperRes.status, 403);

    // 7. Tenant 2 attempts to collect cash for Tenant 1's order
    const cashRes = await fetch(`${baseUrl}/api/v1/payments/orders/${tenant1OrderId}/collect-cash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tenant2Token}` },
    });
    assert.equal(cashRes.status, 403);
  });

  it('blocks merchant sessions after their shop is deactivated', async () => {
    db.execute(`UPDATE shops SET is_active = 0 WHERE id = ?`, ['shop-campus-1']);
    try {
      const dashboard = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(dashboard.status, 403);
      assert.match((await dashboard.json() as any).error, /shop is inactive/i);

      const printers = await fetch(`${baseUrl}/api/v1/merchant/printers`, {
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(printers.status, 403);
    } finally {
      db.execute(`UPDATE shops SET is_active = 1 WHERE id = ?`, ['shop-campus-1']);
    }
  });

  it('revokes paired-agent access immediately when its shop is deactivated', async () => {
    const agentId = `agt-inactive-shop-${crypto.randomUUID()}`;
    const secret = crypto.randomBytes(48).toString('base64url');
    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO agent_registrations (id, shop_id, secret_key_hash, hostname, os_platform, os_version, agent_version, is_active, last_heartbeat, created_at, updated_at)
       VALUES (?, 'shop-campus-1', ?, 'INACTIVE-SHOP-AGENT', 'win32', 'Windows 11', 'test', 1, ?, ?, ?)`,
      [agentId, crypto.createHash('sha256').update(secret).digest('hex'), now, now, now]
    );
    const headers = { 'Content-Type': 'application/json', 'X-Agent-Id': agentId, Authorization: `Bearer ${secret}` };
    db.execute(`UPDATE shops SET is_active = 0 WHERE id = ?`, ['shop-campus-1']);
    try {
      const heartbeat = await fetch(`${baseUrl}/api/v1/agent/heartbeat`, {
        method: 'POST', headers, body: JSON.stringify({ status: 'ONLINE', activePrintersCount: 0, localQueueDepth: 0, sqliteCacheHealthy: true }),
      });
      assert.equal(heartbeat.status, 401);
      assert.equal(db.queryOne<any>(`SELECT last_heartbeat FROM agent_registrations WHERE id = ?`, [agentId]).last_heartbeat, now,
        'inactive-shop agent heartbeat must not update persisted state');

      const polling = await fetch(`${baseUrl}/api/v1/agent/poll-commands`, { headers });
      assert.equal(polling.status, 401);

      const fileDownload = await fetch(`${baseUrl}/api/v1/agent/files/not-a-real-file`, { headers });
      assert.equal(fileDownload.status, 401, 'inactive-shop agents cannot probe or download order files');
    } finally {
      db.execute(`UPDATE shops SET is_active = 1 WHERE id = ?`, ['shop-campus-1']);
      db.execute(`DELETE FROM agent_registrations WHERE id = ?`, [agentId]);
    }
  });

  it('Allows Platform Owner to access tenant data without isolation error', async () => {
    const adminRes = await fetch(`${baseUrl}/api/v1/merchant/dashboard?shopId=shop-campus-1`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.equal(adminRes.status, 200);
    const body = await adminRes.json();
    assert.equal(body.shopId, 'shop-campus-1');
  });

  // ─── MILESTONE 2: REFUNDS ───

  it('Creates a refund request for a verified cash-on-collection order', async () => {
    const refundRes = await fetch(`${baseUrl}/api/v1/payments/orders/${cashOrderId}/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({ amountPaise: 500, reason: 'Customer cancelled order before printing' }),
    });
    assert.equal(refundRes.status, 201);
    const refundBody = await refundRes.json();
    assert.equal(refundBody.success, true);
    assert.equal(refundBody.status, 'REQUESTED');
    assert.equal(refundBody.amountPaise, 500);
    assert.ok(refundBody.refundId);
  });

  it('reserves concurrent partial refunds against the remaining payment balance', async () => {
    const suffix = crypto.randomUUID();
    const orderId = `refund-concurrency-${suffix}`;
    const orderNumber = `RF-${suffix.slice(0, 12)}`;
    const paymentId = `pay-refund-${suffix}`;
    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO orders (id, shop_id, order_number, token_number, customer_name, channel, status, payment_status, payment_method,
       total_amount_paise, currency, quote_version, created_at, updated_at)
       VALUES (?, 'shop-campus-1', ?, 'T-RF', 'Refund Test', 'QR_PORTAL', 'READY_FOR_COLLECTION', 'VERIFIED', 'CASH_ON_COLLECTION', 1000, 'INR', 'v1', ?, ?)`,
      [orderId, orderNumber, now, now]
    );
    db.execute(
      `INSERT INTO payments (id, order_id, provider, provider_transaction_id, provider_event_id, amount_paise, currency, status, created_at, updated_at)
       VALUES (?, ?, 'MANUAL_CASH', ?, ?, 1000, 'INR', 'VERIFIED', ?, ?)`,
      [paymentId, orderId, paymentId, paymentId, now, now]
    );

    const makeRequest = () => fetch(`${baseUrl}/api/v1/payments/orders/${orderId}/refunds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
      body: JSON.stringify({ amountPaise: 700, reason: 'Concurrent partial refund test' }),
    });
    const responses = await Promise.all([makeRequest(), makeRequest()]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
    const reserved = db.queryOne<any>(
      `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM refunds WHERE order_id = ? AND status IN ('REQUESTED', 'PROCESSING', 'COMPLETED')`,
      [orderId]
    );
    assert.equal(Number(reserved.total), 700);
  });

  it('Lists refunds for the authenticated shop', async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments/refunds`, {
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    assert.equal(res.status, 200);
    const refunds = await res.json();
    assert.ok(Array.isArray(refunds));
    assert.ok(refunds.length >= 1);
    assert.ok(refunds.some((r: any) => r.status === 'REQUESTED'));
  });

  it('Rejects refund amount exceeding order total', async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments/orders/${cashOrderId}/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({ amountPaise: 999999999, reason: 'Excessive refund' }),
    });
    assert.equal(res.status, 400);
  });

  it('keeps a refund pending until provider processing is configured', async () => {
    // Create a fresh refund to process
    const createRes = await fetch(`${baseUrl}/api/v1/payments/orders/${cashOrderId}/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({ amountPaise: 300, reason: 'Test approval' }),
    });
    assert.equal(createRes.status, 201);
    const createBody = await createRes.json();
    assert.ok(createBody.refundId);

    const processRes = await fetch(`${baseUrl}/api/v1/payments/refunds/${createBody.refundId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({ action: 'APPROVE' }),
    });
    assert.equal(processRes.status, 503);
    const processBody = await processRes.json();
    assert.match(processBody.error, /remains pending/);
  });

  it('Rejects a refund request without moving money and releases its reserved balance', async () => {
    const createRes = await fetch(`${baseUrl}/api/v1/payments/orders/${cashOrderId}/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({ amountPaise: 200, reason: 'Test reject' }),
    });
    assert.equal(createRes.status, 201);
    const createBody = await createRes.json();
    assert.ok(createBody.refundId);

    const rejectRes = await fetch(`${baseUrl}/api/v1/payments/refunds/${createBody.refundId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({ action: 'REJECT', reason: 'Customer abuse' }),
    });
    assert.equal(rejectRes.status, 200);
    const rejectBody = await rejectRes.json();
    assert.equal(rejectBody.status, 'FAILED');
    assert.equal(rejectBody.moneyMoved, false);
    assert.equal(db.queryOne<any>(`SELECT status, failure_reason FROM refunds WHERE id = ?`, [createBody.refundId]).status, 'FAILED');
    assert.equal(Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM audit_events WHERE action = 'REFUND_REQUEST_REJECTED' AND target_id = ?`, [createBody.refundId]).count), 1);
    assert.equal(Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM ledger_entries WHERE domain = 'CUSTOMER_PRINT_PAYMENT' AND order_id = ? AND amount_paise = -200`, [cashOrderId]).count), 0);
    const remainingReservation = Number(db.queryOne<any>(`SELECT COALESCE(SUM(amount_paise), 0) AS total FROM refunds WHERE order_id = ? AND status IN ('REQUESTED', 'PROCESSING', 'COMPLETED')`, [cashOrderId]).total);
    assert.equal(remainingReservation, 800, 'the rejected refund is excluded from reserved refundable amount');
  });

  // ─── MILESTONE 3: SUBSCRIPTIONS ───

  it('Creates a subscription for an organization', async () => {
    const res = await fetch(`${baseUrl}/api/v1/platform/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        organizationId: 'org-campus-network',
        planId: 'plan-pro',
        planTier: 'PRO',
        amountPaise: 249900,
      }),
    });
    assert.equal(res.status, 503);
  });

  it('Lists subscriptions for platform admin', async () => {
    const res = await fetch(`${baseUrl}/api/v1/platform/subscriptions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const subs = await res.json();
    assert.ok(Array.isArray(subs));
  });

  it('does not allow unverified subscription status changes', async () => {
    const updateRes = await fetch(`${baseUrl}/api/v1/platform/subscriptions/not-created`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'PAST_DUE' }),
    });
    assert.equal(updateRes.status, 503);
  });

  // ─── MILESTONE 4: CREDITS ───

  it('Gets credit balance for a shop', async () => {
    const res = await fetch(`${baseUrl}/api/v1/merchant/credits/balance`, {
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.domain, 'CONVERSION_CREDIT');
    assert.equal(body.currency, 'INR');
    assert.ok(Number.isInteger(body.balancePaise));
  });

  it('Purchases credits for a shop', async () => {
    const res = await fetch(`${baseUrl}/api/v1/merchant/credits/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({ amountPaise: 5000, paymentMethod: 'MANUAL_CASH' }),
    });
    assert.equal(res.status, 503);
  });

  // ─── MILESTONE 5: PAYOUTS ───

  it('Requests a payout for a shop', async () => {
    // First create and collect cash on a higher-value order to build eligible balance
    const uploadRes = await fetch(`${baseUrl}/api/v1/portal/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: 'shop-campus-1',
        fileName: 'large-doc.pdf',
        fileData: makeTestPdf(50).toString('base64'),
        pageCount: 50,
      }),
    });
    assert.equal(uploadRes.status, 201);
    const upload = await uploadRes.json();

    const bigOrderRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'order-test-large-00001' },
      body: JSON.stringify({
        shopId: 'shop-campus-1',
        customerName: 'Big Order Customer',
        customerPhone: '+91 99999 99999',
        paymentMethod: 'CASH_ON_COLLECTION',
        files: [{
          fileName: 'large-doc.pdf',
          pageCount: 50,
          storageKey: upload.storageKey,
          fileSizeBytes: upload.fileSizeBytes,
          mimeType: upload.mimeType,
          options: { colorMode: 'bw', duplexMode: 'simplex', paperSize: 'A4', copies: 1 },
        }],
      }),
    });
    assert.equal(bigOrderRes.status, 201);
    const bigOrder = await bigOrderRes.json();

    const cashRes = await fetch(`${baseUrl}/api/v1/payments/orders/${bigOrder.orderId}/collect-cash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    assert.equal(cashRes.status, 200);

    const res = await fetch(`${baseUrl}/api/v1/merchant/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({ amountPaise: 10000, destinationAccountMasked: '****1234' }),
    });
    assert.equal(res.status, 503);
  });

  it('Lists payouts for a shop', async () => {
    const res = await fetch(`${baseUrl}/api/v1/merchant/payouts`, {
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    assert.equal(res.status, 200);
    const payouts = await res.json();
    assert.ok(Array.isArray(payouts));
  });

  it('Rejects duplicate concurrent payout requests', async () => {
    const res = await fetch(`${baseUrl}/api/v1/merchant/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({ amountPaise: 10000, destinationAccountMasked: '****5678' }),
    });
    assert.equal(res.status, 503);
  });

  it('Rejects payout exceeding eligible balance', async () => {
    const res = await fetch(`${baseUrl}/api/v1/merchant/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({ amountPaise: 999999999, destinationAccountMasked: '****9999' }),
    });
    assert.equal(res.status, 503);
  });
});
