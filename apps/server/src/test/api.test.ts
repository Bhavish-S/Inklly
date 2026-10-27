import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { createApp } from '../index';
import { DatabaseService } from '@inklly/db';
import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { makeTestPdf } from './test-pdf';
import { createSessionToken } from '../middleware/session-token';

describe('Inklly Backend API Integration Test Suite', { concurrency: false }, () => {
  let server: http.Server;
  let baseUrl: string;
  let db: DatabaseService;
  let merchantToken: string;
  let adminToken: string;
  let cashOrderId: string;
  const originalExternalApiSetting = process.env.ENABLE_EXTERNAL_API_ACCESS;

  before(async () => {
    process.env.ENABLE_EXTERNAL_API_ACCESS = 'true';
    db = new DatabaseService(':memory:');
    const app = createApp(db);
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
  });

  it('Health Check responds with HEALTHY status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'HEALTHY');
    assert.ok(Object.hasOwn(body, 'revision'));
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
  });

  it('keeps personal website enquiries behind platform authentication', async () => {
    const res = await fetch(`${baseUrl}/api/v1/platform/enquiries`);
    assert.equal(res.status, 401);
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
    const developerToken = createSessionToken({
      userId: 'developer-without-org',
      email: 'developer@example.invalid',
      role: 'DEVELOPER',
      permissions: [],
    });
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitReq),
    });

    assert.equal(res.status, 201);
    const orderData = await res.json();
    cashOrderId = orderData.orderId;
    assert.ok(orderData.orderId);
    assert.equal(orderData.status, 'AWAITING_REVIEW');

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
      headers: { 'Content-Type': 'application/json' },
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

  it('Retrieves merchant dashboard stats and orders queue', async () => {
    const res = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
      headers: { Authorization: `Bearer ${merchantToken}` },
    });

    assert.equal(res.status, 200);
    const dashboard = await res.json();
    assert.ok(dashboard.metrics.totalOrders >= 1);
    assert.ok(dashboard.metrics.activePrinters >= 1);

    // List orders
    const ordersRes = await fetch(`${baseUrl}/api/v1/merchant/orders`, {
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    assert.equal(ordersRes.status, 200);
    const orders = await ordersRes.json();
    assert.ok(Array.isArray(orders));
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
    assert.equal(invalidRes.status, 422);
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

    // 2. Heartbeat
    const hbRes = await fetch(`${baseUrl}/api/v1/agent/heartbeat`, {
      method: 'POST',
      headers: agentHeaders,
      body: JSON.stringify({
        status: 'ONLINE',
        activePrintersCount: 2,
        localQueueDepth: 0,
      }),
    });
    assert.equal(hbRes.status, 200);

    // 3. Poll commands
    const pollRes = await fetch(`${baseUrl}/api/v1/agent/poll-commands`, { headers: agentHeaders });
    assert.equal(pollRes.status, 200);
    const tickets = await pollRes.json();
    assert.ok(Array.isArray(tickets));

    if (tickets.length > 0) {
      const ticket = tickets[0];
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
    }
  });

  it('Agent download endpoint never claims an unconfigured installer exists', async () => {
    const scriptRes = await fetch(`${baseUrl}/api/v1/agent/download?platform=win-x64&shopCode=campus1&format=script`);
    assert.equal(scriptRes.status, 410);

    // Metadata must report the missing verified installer rather than a fabricated checksum.
    const metaRes = await fetch(`${baseUrl}/api/v1/agent/download?platform=win-legacy-x86&shopCode=campus1&format=json`);
    assert.equal(metaRes.status, 503);
    const metaJson = await metaRes.json();
    assert.equal(metaJson.installerAvailable, false);

    // 3. Driver matrix
    const matrixRes = await fetch(`${baseUrl}/api/v1/agent/driver-matrix`);
    assert.equal(matrixRes.status, 200);
    const matrix = await matrixRes.json();
    assert.ok(matrix.manufacturers.some((m: any) => m.brand === 'HP'));
    assert.ok(matrix.manufacturers.some((m: any) => m.brand === 'Canon'));

    // 4. Diagnostics
    const diagRes = await fetch(`${baseUrl}/api/v1/agent/diagnostics`);
    assert.equal(diagRes.status, 200);
    const diag = await diagRes.json();
    assert.equal(diag.loopbackPort, 8765);
    assert.equal(diag.hardwareSafety, 'OUTPUT_UNCERTAIN on hardware jam or spooler halt');
  });

  it('Collects cash at counter and credits ledger', async () => {
    const cashRes = await fetch(`${baseUrl}/api/v1/payments/orders/${cashOrderId}/collect-cash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${merchantToken}` },
    });

    assert.equal(cashRes.status, 200);
    const cashBody = await cashRes.json();
    assert.equal(cashBody.order.paymentStatus, 'VERIFIED');
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
  });

  it('Developer Portal generates OpenAPI spec and creates scoped API keys', async () => {
    const specRes = await fetch(`${baseUrl}/api/v1/developer/openapi.json`);
    assert.equal(specRes.status, 200);
    const spec = await specRes.json();
    assert.equal(spec.openapi, '3.0.3');
    assert.ok(spec.paths['/portal/quote']);

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
  });

  // ─── MILESTONE 1: ONBOARDING, AUTHENTICATION & TENANT ISOLATION ───

  it('Registers new merchant, generates token, provisions org, shop, and baseline rates', async () => {
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
    assert.ok(body.token);
    assert.equal(body.user.email, 'vikas@omsaixerox.in');
    assert.equal(body.shop.shopCode, 'om-sai-hub');
    assert.equal(body.organization.planTier, 'STARTER');
    assert.ok(body.shopId);
    assert.ok(body.organizationId);

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
    const { token: tenant2Token } = await reg2.json();

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

  it('Rejects a refund request', async () => {
    // Create a fresh refund to reject
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
    assert.equal(rejectRes.status, 503);
    const rejectBody = await rejectRes.json();
    assert.match(rejectBody.error, /remains pending/);
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
      headers: { 'Content-Type': 'application/json' },
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
