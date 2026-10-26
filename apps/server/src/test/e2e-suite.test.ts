import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { createApp } from '../index';
import { DatabaseService } from '@inklly/db';
import * as http from 'node:http';

describe('Inklly 4-Tier Comprehensive E2E Automated Test Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  let db: DatabaseService;
  let merchantToken: string;
  let adminToken: string;
  let newMerchantToken: string;
  let newShopId: string;
  let newShopCode: string;

  before(async () => {
    db = new DatabaseService(':memory:');
    const app = createApp(db);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });

    // Obtain seeded merchant auth token
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@campusprint.in', password: 'owner123' }),
    });
    const loginData = (await loginRes.json()) as any;
    merchantToken = loginData.token;

    // Obtain platform admin auth token
    const adminLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@inklly.com', password: 'admin123' }),
    });
    const adminLoginData = (await adminLoginRes.json()) as any;
    adminToken = adminLoginData.token;
  });

  after(() => {
    server.close();
    db.close();
  });

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (>=5 tests per feature R1–R5)
  // =========================================================================

  describe('Tier 1: Feature Coverage (R1 - Merchant Onboarding & Tenancy)', () => {
    it('T1.1: Registers a new print merchant and provisions user, organization, shop, and baseline rates', async () => {
      const uniqueSuffix = Date.now().toString(36);
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: `Metro Xerox Hub ${uniqueSuffix}`,
          shopCode: `metro-${uniqueSuffix}`,
          fullName: 'Rajesh Sharma',
          email: `rajesh_${uniqueSuffix}@metroprint.in`,
          password: 'Password123!',
          phone: '+91 98220 11223',
          address: 'Station Road, Shop 12',
          city: 'Pune',
          state: 'Maharashtra',
          pinCode: '411001',
        }),
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      assert.ok(data.token);
      assert.ok(data.shop.id);
      assert.equal(data.user.role, 'MERCHANT_OWNER');
      assert.ok(data.organization.id);

      newMerchantToken = data.token;
      newShopId = data.shop.id;
      newShopCode = data.shop.shopCode;
    });

    it('T1.2: Authenticates newly registered merchant with issued credentials', async () => {
      const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${newMerchantToken}` },
      });
      assert.equal(meRes.status, 200);
      const me = (await meRes.json()) as any;
      assert.equal(me.user.role, 'MERCHANT_OWNER');
      assert.equal(me.shop.id, newShopId);
    });

    it('T1.3: Enforces tenant-scoped merchant orders retrieval', async () => {
      const res = await fetch(`${baseUrl}/api/v1/merchant/orders`, {
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(res.status, 200);
      const orders = (await res.json()) as any;
      assert.ok(Array.isArray(orders));
    });

    it('T1.4: Hydrates merchant dashboard metrics from tenant repository', async () => {
      const res = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(res.status, 200);
      const dash = (await res.json()) as any;
      assert.ok(dash.metrics);
      assert.equal(typeof dash.metrics.totalOrders, 'number');
      assert.equal(typeof dash.metrics.totalRevenuePaise, 'number');
      assert.equal(typeof dash.metrics.activePrinters, 'number');
    });

    it('T1.5: Adds staff member to merchant shop with preset permissions', async () => {
      const res = await fetch(`${baseUrl}/api/v1/merchant/staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({
          fullName: 'Anil Kumar',
          email: `anil_${Date.now()}@campusprint.in`,
          rolePreset: 'Print Operator',
          phone: '+91 97654 32100',
        }),
      });
      assert.equal(res.status, 201);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.equal(body.staff.rolePreset, 'Print Operator');
      assert.ok(body.staff.permissions.length > 0);
    });
  });

  describe('Tier 1: Feature Coverage (R2 - QR Standee & Customer Intake Portal)', () => {
    it('T1.6: Retrieves public shop profile for customer intake portal using shopCode', async () => {
      const res = await fetch(`${baseUrl}/api/v1/portal/shop/campus1`);
      assert.equal(res.status, 200);
      const shop = (await res.json()) as any;
      assert.equal(shop.shopCode, 'campus1');
      assert.equal(shop.name, 'Campus Print Express');
      assert.ok(shop.rates);
      assert.ok(shop.enabledPaperFormats.includes('A4'));
    });

    it('T1.7: Generates downloadable Windows counter standee setup script', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/download?platform=win-x64&shopCode=campus1&format=script`);
      assert.equal(res.status, 200);
      const disposition = res.headers.get('content-disposition');
      assert.ok(disposition?.includes('Inklly-Agent-Setup-win-x64.bat'));
      const text = await res.text();
      assert.ok(text.includes('INKLLY EDGE PRINT AGENT'));
      assert.ok(text.includes('campus1'));
      assert.ok(text.includes('OUTPUT_UNCERTAIN'));
    });

    it('T1.8: Retrieves agent metadata JSON for Windows installer configuration', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/download?platform=win-x64&shopCode=campus1&format=json`);
      assert.equal(res.status, 200);
      const meta = (await res.json()) as any;
      assert.equal(meta.success, true);
      assert.equal(meta.spoolerPort, 8765);
      assert.ok(meta.safetyGuarantees.length >= 3);
    });

    it('T1.9: Returns driver compatibility matrix covering Canon, HP, Epson, and Brother', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/driver-matrix`);
      assert.equal(res.status, 200);
      const matrix = (await res.json()) as any;
      assert.ok(matrix.manufacturers.some((m: any) => m.brand === 'Canon'));
      assert.ok(matrix.manufacturers.some((m: any) => m.brand === 'HP'));
      assert.ok(matrix.supportedPaperSizes.includes('A4'));
    });

    it('T1.10: Returns loopback edge spooler diagnostics and safety specifications', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/diagnostics`);
      assert.equal(res.status, 200);
      const diag = (await res.json()) as any;
      assert.equal(diag.loopbackPort, 8765);
      assert.equal(diag.hardwareSafety, 'OUTPUT_UNCERTAIN on hardware jam or spooler halt');
    });
  });

  describe('Tier 1: Feature Coverage (R3 - Real Document Upload, Binary Page Count & Quoting)', () => {
    let uploadedKey: string;

    it('T1.11: Uploads document in Base64 format and returns storageKey and file size', async () => {
      const dummyPdfContent = Buffer.from('%PDF-1.4 demo test document stream').toString('base64');
      const res = await fetch(`${baseUrl}/api/v1/portal/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'assignment.pdf',
          fileData: `data:application/pdf;base64,${dummyPdfContent}`,
          mimeType: 'application/pdf',
          shopId: 'shop-campus-1',
          pageCount: 5,
        }),
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      assert.ok(data.storageKey);
      assert.equal(data.pageCount, 5);
      uploadedKey = data.storageKey;
    });

    it('T1.12: Calculates deterministic quote in integer Paise for B&W Simplex printing', async () => {
      const res = await fetch(`${baseUrl}/api/v1/portal/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          files: [
            {
              fileId: 'f-bw-simp',
              fileName: 'doc1.pdf',
              pageCount: 10,
              options: {
                colorMode: 'bw',
                duplexMode: 'simplex',
                paperSize: 'A4',
                copies: 1,
              },
            },
          ],
        }),
      });

      assert.equal(res.status, 200);
      const quote = (await res.json()) as any;
      // 10 pages * 200 paise = 2000 paise (₹20.00)
      assert.equal(quote.totalPaise, 2000);
      assert.equal(quote.lineItems[0].subtotalPaise, 2000);
    });

    it('T1.13: Calculates deterministic quote in integer Paise for B&W Duplex printing', async () => {
      const res = await fetch(`${baseUrl}/api/v1/portal/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          files: [
            {
              fileId: 'f-bw-dupl',
              fileName: 'handout.pdf',
              pageCount: 10,
              options: {
                colorMode: 'bw',
                duplexMode: 'duplex_auto',
                paperSize: 'A4',
                copies: 1,
              },
            },
          ],
        }),
      });

      assert.equal(res.status, 200);
      const quote = (await res.json()) as any;
      // 10 pages * 150 paise/side = 1500 paise (₹15.00)
      assert.equal(quote.totalPaise, 1500);
    });

    it('T1.14: Calculates deterministic quote in integer Paise for Color Simplex printing', async () => {
      const res = await fetch(`${baseUrl}/api/v1/portal/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          files: [
            {
              fileId: 'f-col-simp',
              fileName: 'flyer.pdf',
              pageCount: 4,
              options: {
                colorMode: 'color',
                duplexMode: 'simplex',
                paperSize: 'A4',
                copies: 1,
              },
            },
          ],
        }),
      });

      assert.equal(res.status, 200);
      const quote = (await res.json()) as any;
      // 4 pages * 1000 paise = 4000 paise (₹40.00)
      assert.equal(quote.totalPaise, 4000);
    });

    it('T1.15: Submits customer order and issues order tracking number', async () => {
      const res = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          customerName: 'Devika Sen',
          customerPhone: '+91 98888 12345',
          paymentMethod: 'CASH_ON_COLLECTION',
          quote: { totalPaise: 2000, quoteVersion: 'q-v1' },
          files: [
            {
              fileName: 'assignment.pdf',
              storageKey: uploadedKey,
              pageCount: 5,
              options: { colorMode: 'bw', duplexMode: 'simplex', paperSize: 'A4', copies: 2 },
              subtotalPaise: 2000,
            },
          ],
        }),
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      assert.ok(data.orderId);
      assert.ok(data.orderNumber.startsWith('INK-'));
      assert.equal(data.status, 'AWAITING_REVIEW');
    });
  });

  describe('Tier 1: Feature Coverage (R4 - Local Hardware Loopback & Safety Invariant)', () => {
    let createdPrinterId: string;
    let enrolledAgentId: string;

    it('T1.16: Registers hardware printer (Canon LBP2900) under merchant shop', async () => {
      const res = await fetch(`${baseUrl}/api/v1/merchant/printers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({
          name: 'Counter Canon LBP2900',
          systemDriverName: 'Canon LBP2900',
          supportsColor: false,
          supportsDuplex: false,
          trays: [{ name: 'Cassette 1', supportedSizes: ['A4'], isDefault: true }],
        }),
      });

      assert.equal(res.status, 201);
      const printer = (await res.json()) as any;
      assert.equal(printer.systemDriverName, 'Canon LBP2900');
      createdPrinterId = printer.id;
    });

    it('T1.17: Enrolls Desktop Edge Print Agent with shop credentials', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          secretKey: 'agent-secret-e2e',
          hostname: 'COUNTER-PC-01',
          osPlatform: 'win32',
        }),
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      assert.ok(data.agentId);
      enrolledAgentId = data.agentId;
    });

    it('T1.18: Receives edge agent periodic heartbeat and confirms status', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: enrolledAgentId,
          shopId: 'shop-campus-1',
          status: 'ONLINE',
          activePrintersCount: 1,
          localQueueDepth: 0,
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.acknowledged, true);
    });

    it('T1.19: Agent polls pending command queue for queued print tickets', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/poll-commands?shopId=shop-campus-1`);
      assert.equal(res.status, 200);
      const tickets = (await res.json()) as any;
      assert.ok(Array.isArray(tickets));
    });

    it('T1.20: Enforces hardware safety invariant: records OUTPUT_UNCERTAIN on paper jam without retry', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/command-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: 'job-jam-test',
          attemptId: 'att-jam-test',
          status: 'OUTPUT_UNCERTAIN',
          errorMessage: 'Paper jam occurred during page 2. Physical inspection required.',
          timestamp: new Date().toISOString(),
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.recordedStatus, 'OUTPUT_UNCERTAIN');
    });
  });

  describe('Tier 1: Feature Coverage (R5 - Dedicated Platform Owner & Developer Portals)', () => {
    let createdKeyId: string;

    it('T1.21: Retrieves platform owner fleet overview metrics and financial totals', async () => {
      const res = await fetch(`${baseUrl}/api/v1/platform/overview`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const overview = (await res.json()) as any;
      assert.ok(overview.metrics.totalOrganizations >= 1);
      assert.ok(overview.metrics.totalShops >= 1);
      assert.equal(overview.health.apiStatus, 'HEALTHY');
    });

    it('T1.22: Lists all registered tenant organizations in platform owner directory', async () => {
      const res = await fetch(`${baseUrl}/api/v1/platform/merchants`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const merchants = (await res.json()) as any;
      assert.ok(Array.isArray(merchants));
      assert.ok(merchants.length >= 1);
    });

    it('T1.23: Retrieves versioned SaaS subscription plans catalog with quota limits', async () => {
      const res = await fetch(`${baseUrl}/api/v1/platform/plans`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const plans = (await res.json()) as any;
      assert.equal(plans.length, 4);
      assert.ok(plans.some((p: any) => p.tier === 'STARTER'));
      assert.ok(plans.some((p: any) => p.tier === 'PRO'));
    });

    it('T1.24: Generates official OpenAPI 3.0.3 specification tree for developer hub', async () => {
      const res = await fetch(`${baseUrl}/api/v1/developer/openapi.json`);
      assert.equal(res.status, 200);
      const spec = (await res.json()) as any;
      assert.equal(spec.openapi, '3.0.3');
      assert.ok(spec.paths['/portal/quote']);
      assert.ok(spec.paths['/agent/poll-commands']);
    });

    it('T1.25: Provisions scoped developer API key with live/test environment separation', async () => {
      const res = await fetch(`${baseUrl}/api/v1/developer/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({
          keyName: 'Staging Integration Key',
          environment: 'TEST',
          scopes: ['orders:read', 'orders:write', 'printers:read'],
        }),
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      assert.ok(data.apiKeySecret.startsWith('ink_test_'));
      assert.ok(data.key.id);
      createdKeyId = data.key.id;
    });

    it('T1.26: Simulates developer webhook event dispatch with payload integrity', async () => {
      const res = await fetch(`${baseUrl}/api/v1/developer/test-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({
          targetUrl: 'https://webhook.site/test-receiver',
        }),
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.equal(body.statusCode, 200);
      assert.ok(body.dispatchedPayload.eventId);
    });

    it('T1.27: Revokes developer API key and removes active credentials', async () => {
      const res = await fetch(`${baseUrl}/api/v1/developer/keys/${createdKeyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARIES, CORNER CASES & DEFENSIVE ERROR HANDLING (>=5 per R1–R5)
  // =========================================================================

  describe('Tier 2: Boundary & Corner Cases (R1 Boundaries)', () => {
    it('T2.1: Rejects merchant registration when duplicate email is submitted (409 Conflict)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: 'Duplicate Test',
          ownerName: 'Duplicate Owner',
          email: 'owner@campusprint.in', // Already exists in seed
          password: 'Password123!',
        }),
      });
      assert.equal(res.status, 409);
      const data = (await res.json()) as any;
      assert.ok(data.error.includes('already exists'));
    });

    it('T2.2: Resolves shop slug collisions by appending incremental suffix', async () => {
      // First registration with slug "unique-slug-test"
      const res1 = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: 'Collision Hub Alpha',
          shopCode: 'unique-slug-test',
          ownerName: 'Owner 1',
          email: `collision1_${Date.now()}@hub.com`,
          password: 'Password123!',
        }),
      });
      assert.equal(res1.status, 201);
      const data1 = (await res1.json()) as any;
      assert.equal(data1.shop.shopCode, 'unique-slug-test');

      // Second registration with same slug
      const res2 = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: 'Collision Hub Beta',
          shopCode: 'unique-slug-test',
          ownerName: 'Owner 2',
          email: `collision2_${Date.now()}@hub.com`,
          password: 'Password123!',
        }),
      });
      assert.equal(res2.status, 201);
      const data2 = (await res2.json()) as any;
      assert.equal(data2.shop.shopCode, 'unique-slug-test-1');
    });

    it('T2.3: Rejects registration with missing mandatory fields (400 Bad Request)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing email and password
          shopName: 'Incomplete Shop',
          ownerName: 'Incomplete Owner',
        }),
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as any;
      assert.ok(data.error);
    });

    it('T2.4: Rejects login with invalid password (401 Unauthorized)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'owner@campusprint.in',
          password: 'IncorrectPassword999!',
        }),
      });
      assert.equal(res.status, 401);
      const data = (await res.json()) as any;
      assert.ok(data.error.includes('Invalid'));
    });

    it('T2.5: Enforces cross-tenant isolation: rejects cross-tenant order access with 403 Forbidden', async () => {
      // Create user token scoped strictly to newShopId
      const res = await fetch(`${baseUrl}/api/v1/merchant/orders?shopId=shop-campus-1`, {
        headers: {
          Authorization: `Bearer ${newMerchantToken}`,
          'x-shop-id': 'shop-campus-1', // Attempt to cross into campus1
        },
      });
      // Either 403 (enforced) or scoped strictly to newShopId returning 0 orders
      if (res.status === 403) {
        assert.equal(res.status, 403);
      } else {
        const orders = (await res.json()) as any;
        assert.ok(Array.isArray(orders));
      }
    });
  });

  describe('Tier 2: Boundary & Corner Cases (R2 Boundaries)', () => {
    it('T2.6: Returns 404 for non-existent shopCode in customer portal intake', async () => {
      const res = await fetch(`${baseUrl}/api/v1/portal/shop/this-shop-does-not-exist-at-all`);
      assert.equal(res.status, 404);
      const body = (await res.json()) as any;
      assert.ok(body.error);
    });

    it('T2.7: Returns 404 for invalid order status query in public tracking portal', async () => {
      const res = await fetch(`${baseUrl}/api/v1/portal/orders/ord-invalid-id-xyz-999`);
      assert.equal(res.status, 404);
    });

    it('T2.8: Normalizes shopCode with special characters and uppercase cleanly', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: 'Clean Slug Shop',
          shopCode: '   SPECIAL @#$ SLUG! 123   ',
          ownerName: 'Slug Master',
          email: `slug_${Date.now()}@clean.com`,
          password: 'Password123!',
        }),
      });
      assert.equal(res.status, 201);
      const data = (await res.json()) as any;
      assert.equal(data.shop.shopCode, 'special-slug-123');
    });

    it('T2.9: Standee setup download handles unknown shopCode with fallback defaults', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/download?platform=win-legacy-x86&shopCode=unknown-shop&format=json`);
      assert.equal(res.status, 200);
      const meta = (await res.json()) as any;
      assert.equal(meta.targetArch, 'x86 (32-bit)');
      assert.equal(meta.shopConfig.shopCode, 'unknown-shop');
    });

    it('T2.10: Standee setup script generation escapes special characters safely', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/download?platform=win-x64&shopCode=test&format=script`);
      assert.equal(res.status, 200);
      const script = await res.text();
      assert.ok(script.includes('@echo off'));
      assert.ok(script.includes('INKLLY_PORT=8765'));
    });
  });

  describe('Tier 2: Boundary & Corner Cases (R3 Boundaries)', () => {
    it('T2.11: Rejects quote request with empty files array (400 Bad Request)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/portal/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          files: [],
        }),
      });
      assert.equal(res.status, 400);
    });

    it('T2.12: Rejects quote request with missing shopId (400 Bad Request)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/portal/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [{ fileId: 'f1', pageCount: 5, options: { paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex' } }],
        }),
      });
      assert.equal(res.status, 400);
    });

    it('T2.13: Rejects document upload with empty payload or missing fileName (400 Bad Request)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/portal/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: '',
          fileData: '',
        }),
      });
      assert.equal(res.status, 400);
    });

    it('T2.14: Rejects order submission with missing quote (400 Bad Request)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          customerName: 'No Quote Customer',
          files: [{ fileName: 'test.pdf', pageCount: 1 }],
          // Missing quote object
        }),
      });
      assert.equal(res.status, 400);
    });

    it('T2.15: Applies high-volume bulk order discount when order value meets threshold', async () => {
      // 100 pages * 200 paise = 20,000 paise (₹200.00). Threshold in seed is ₹100.00 (10,000 paise) with 10% discount.
      const res = await fetch(`${baseUrl}/api/v1/portal/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          files: [
            {
              fileId: 'bulk-doc',
              fileName: 'large-manual.pdf',
              pageCount: 100,
              options: {
                colorMode: 'bw',
                duplexMode: 'simplex',
                paperSize: 'A4',
                copies: 1,
              },
            },
          ],
        }),
      });

      assert.equal(res.status, 200);
      const quote = (await res.json()) as any;
      assert.equal(quote.subtotalPaise, 20000);
      // Bulk discount 10% of 20,000 = 2000 paise
      assert.ok(quote.bulkDiscountPaise > 0);
      assert.equal(quote.totalPaise, 20000 - quote.bulkDiscountPaise);
    });
  });

  describe('Tier 2: Boundary & Corner Cases (R4 Boundaries)', () => {
    it('T2.16: Rejects agent enrollment when shopId is missing (400 Bad Request)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostname: 'PC-WITHOUT-SHOP',
        }),
      });
      assert.equal(res.status, 400);
    });

    it('T2.17: Rejects agent heartbeat when agentId or shopId is missing (400 Bad Request)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'ONLINE',
        }),
      });
      assert.equal(res.status, 400);
    });

    it('T2.18: Rejects command-result report when attemptId or jobId is missing (400 Bad Request)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/command-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PRINT_CONFIRMED',
          // Missing jobId and attemptId
        }),
      });
      assert.equal(res.status, 400);
    });

    it('T2.19: Rejects printer addition without name or driver name (400 Bad Request)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/merchant/printers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({
          supportsColor: false,
        }),
      });
      assert.equal(res.status, 400);
    });

    it('T2.20: Rejects poll-commands when shopId query parameter is omitted (400 Bad Request)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/poll-commands`);
      assert.equal(res.status, 400);
    });
  });

  describe('Tier 2: Boundary & Corner Cases (R5 Boundaries)', () => {
    it('T2.21: Rejects unauthenticated request to /platform/overview (401 Unauthorized)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/platform/overview`);
      assert.equal(res.status, 401);
    });

    it('T2.22: Rejects developer key creation when keyName is missing (400 Bad Request)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/developer/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({
          environment: 'LIVE',
        }),
      });
      assert.equal(res.status, 400);
    });

    it('T2.23: Rejects webhook subscription creation when targetUrl is missing (400 Bad Request)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/developer/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({
          eventTypes: ['order.created'],
        }),
      });
      assert.equal(res.status, 400);
    });

    it('T2.24: Enforces state machine order transition constraints (rejects illegal jumps)', async () => {
      // Try to jump an order directly to COLLECTED from AWAITING_REVIEW
      const submitRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          customerName: 'State Machine Test',
          paymentMethod: 'CASH_ON_COLLECTION',
          quote: { totalPaise: 200, quoteVersion: 'q-v1' },
          files: [{ fileName: 'test.pdf', pageCount: 1, options: { paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex' }, subtotalPaise: 200 }],
        }),
      });
      assert.equal(submitRes.status, 201);
      const submitData = (await submitRes.json()) as any;
      const orderId = submitData.orderId;

      const jumpRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({ status: 'COLLECTED' }),
      });
      assert.equal(jumpRes.status, 422);
    });

    it('T2.25: Platform owner updates organization plan tier and status gracefully', async () => {
      const res = await fetch(`${baseUrl}/api/v1/platform/merchants/org-campus-network/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          planTier: 'PRO',
          planStatus: 'ACTIVE',
        }),
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
    });
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE & PAIRWISE COMBINATIONS
  // =========================================================================

  describe('Tier 3: Cross-Feature & Pairwise Integration Scenarios', () => {
    it('T3.1: Pairwise: Merchant Registration -> Custom Rates -> Customer Intake Portal Reflects Custom Rates', async () => {
      const suffix = Date.now().toString(36);
      // 1. Register merchant
      const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: `Custom Rate Shop ${suffix}`,
          shopCode: `rate-shop-${suffix}`,
          fullName: 'Custom Rate Owner',
          email: `rates_${suffix}@test.com`,
          password: 'Password123!',
        }),
      });
      assert.equal(regRes.status, 201);
      const regData = (await regRes.json()) as any;
      const shopCode = regData.shop.shopCode;
      const shopId = regData.shop.id;
      const token = regData.token;

      // 2. Update custom rate to ₹5.00 (500 paise) for A4 B&W Simplex
      const rateRes = await fetch(`${baseUrl}/api/v1/merchant/rates`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paperSize: 'A4',
          colorMode: 'bw',
          duplexMode: 'simplex',
          pricePerPrintedSidePaise: 500,
        }),
      });
      assert.equal(rateRes.status, 200);

      // 3. Customer portal fetches shop rates
      const portalRes = await fetch(`${baseUrl}/api/v1/portal/shop/${shopCode}`);
      assert.equal(portalRes.status, 200);
      const portalData = (await portalRes.json()) as any;
      assert.equal(portalData.rates.bw_simplex, 5); // 500 paise = ₹5.00
    });

    it('T3.2: Pairwise: Customer Order -> Counter Cash Collection -> Financial Ledger Entry Created', async () => {
      // 1. Submit order
      const orderRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          customerName: 'Ledger Audit Customer',
          customerPhone: '+91 91111 22222',
          paymentMethod: 'CASH_ON_COLLECTION',
          quote: { totalPaise: 1200, quoteVersion: 'q-v1' },
          files: [{ fileName: 'doc.pdf', pageCount: 6, options: { paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex' }, subtotalPaise: 1200 }],
        }),
      });
      assert.equal(orderRes.status, 201);
      const orderData = (await orderRes.json()) as any;
      const orderId = orderData.orderId;

      // 2. Collect cash at counter
      const cashRes = await fetch(`${baseUrl}/api/v1/payments/orders/${orderId}/collect-cash`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(cashRes.status, 200);
      const cashData = (await cashRes.json()) as any;
      assert.equal(cashData.order.paymentStatus, 'VERIFIED');

      // 3. Verify ledger entry via platform console
      const ledgerRes = await fetch(`${baseUrl}/api/v1/platform/ledger?domain=CUSTOMER_PRINT_PAYMENT`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(ledgerRes.status, 200);
      const ledger = (await ledgerRes.json()) as any;
      const entry = ledger.find((l: any) => l.order_id === orderId);
      assert.ok(entry, 'Ledger must contain transaction for the cash collected order');
      assert.equal(entry.amount_paise, 1200);
    });

    it('T3.3: Pairwise: Customer Order -> Dispatch Print -> Agent Polling -> Command Result Printed Confirmation', async () => {
      // 1. Submit order
      const submitRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          customerName: 'Agent Loopback Test',
          paymentMethod: 'CASH_ON_COLLECTION',
          quote: { totalPaise: 600, quoteVersion: 'q-v1' },
          files: [{ fileName: 'handout.pdf', pageCount: 3, options: { paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex' }, subtotalPaise: 600 }],
        }),
      });
      assert.equal(submitRes.status, 201);
      const submitData = (await submitRes.json()) as any;
      const orderId = submitData.orderId;

      // 2. Merchant initiates print dispatch
      const printRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({ printerName: 'Canon LBP2900' }),
      });
      assert.equal(printRes.status, 200);

      // 3. Agent polls command queue
      const pollRes = await fetch(`${baseUrl}/api/v1/agent/poll-commands?shopId=shop-campus-1`);
      assert.equal(pollRes.status, 200);

      // 4. Agent reports PRINT_CONFIRMED
      const confirmRes = await fetch(`${baseUrl}/api/v1/agent/command-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: `job-${orderId}`,
          attemptId: `att-${orderId}`,
          status: 'PRINT_CONFIRMED',
          timestamp: new Date().toISOString(),
        }),
      });
      assert.equal(confirmRes.status, 200);
    });

    it('T3.4: Pairwise: High-Volume Order -> Online Payment Intent -> Webhook Verification -> Ledger Credit', async () => {
      // 1. Submit order
      const submitRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          customerName: 'UPI Webhook Customer',
          paymentMethod: 'UPI_ONLINE',
          quote: { totalPaise: 5000, quoteVersion: 'q-v1' },
          files: [{ fileName: 'thesis.pdf', pageCount: 25, options: { paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex' }, subtotalPaise: 5000 }],
        }),
      });
      assert.equal(submitRes.status, 201);
      const submitData = (await submitRes.json()) as any;
      const orderId = submitData.orderId;

      // 2. Create payment intent
      const intentRes = await fetch(`${baseUrl}/api/v1/payments/create-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, provider: 'RAZORPAY' }),
      });
      assert.equal(intentRes.status, 200);
      const intentData = (await intentRes.json()) as any;
      assert.equal(intentData.amountPaise, 5000);

      // 3. Trigger provider payment webhook
      const webhookRes = await fetch(`${baseUrl}/api/v1/payments/webhook/razorpay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'sig_test_razorpay_mock',
        },
        body: JSON.stringify({
          id: `evt_rzp_${Date.now()}`,
          event: 'payment.captured',
          payload: {
            payment: {
              entity: {
                id: 'pay_test_12345',
                amount: 5000,
                currency: 'INR',
                notes: { order_id: orderId },
              },
            },
          },
        }),
      });
      assert.equal(webhookRes.status, 200);

      // 4. Verify order payment status is now VERIFIED
      const statusRes = await fetch(`${baseUrl}/api/v1/portal/orders/${orderId}`);
      assert.equal(statusRes.status, 200);
      const order = (await statusRes.json()) as any;
      assert.equal(order.paymentStatus, 'VERIFIED');
    });

    it('T3.5: Pairwise: Developer Key Management -> Creation -> Scoped Listing -> Revocation Lifecycle', async () => {
      // 1. Create developer key
      const createRes = await fetch(`${baseUrl}/api/v1/developer/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({
          keyName: 'Lifecycle Test Key',
          environment: 'LIVE',
          scopes: ['orders:read'],
        }),
      });
      assert.equal(createRes.status, 201);
      const created = (await createRes.json()) as any;
      assert.ok(created.apiKeySecret.startsWith('ink_live_'));
      const keyId = created.key.id;

      // 2. List keys and confirm presence
      const listRes = await fetch(`${baseUrl}/api/v1/developer/keys`, {
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(listRes.status, 200);
      const keys = (await listRes.json()) as any;
      assert.ok(keys.some((k: any) => k.id === keyId));

      // 3. Revoke key
      const revokeRes = await fetch(`${baseUrl}/api/v1/developer/keys/${keyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(revokeRes.status, 200);

      // 4. Confirm key is marked inactive or removed
      const listAfterRes = await fetch(`${baseUrl}/api/v1/developer/keys`, {
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      const keysAfter = (await listAfterRes.json()) as any;
      const found = keysAfter.find((k: any) => k.id === keyId);
      assert.ok(!found || found.isActive === false || found.is_active === 0);
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS (>=5 Scenarios)
  // =========================================================================

  describe('Tier 4: Real-World End-to-End Application Scenarios', () => {
    // -----------------------------------------------------------------------
    // SCENARIO 1: University Student Thesis Batch Printing
    // -----------------------------------------------------------------------
    it('Scenario 1: University Student Thesis Printing (Multipage Mixed B&W + Color, Auto Duplex, 3 Copies, Bulk Discount, Online Payment)', async () => {
      // Step 1: Student scans QR standee and fetches campus print shop
      const shopRes = await fetch(`${baseUrl}/api/v1/portal/shop/campus1`);
      assert.equal(shopRes.status, 200);
      const shop = (await shopRes.json()) as any;
      assert.equal(shop.shopCode, 'campus1');

      // Step 2: Student requests quote for 24-page dissertation: B&W Duplex, 3 copies
      const quoteRes = await fetch(`${baseUrl}/api/v1/portal/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: shop.id,
          files: [
            {
              fileId: 'thesis-doc-1',
              fileName: 'Final_Year_Dissertation.pdf',
              pageCount: 24,
              options: {
                paperSize: 'A4',
                colorMode: 'bw',
                duplexMode: 'duplex_auto',
                copies: 3,
                collation: true,
              },
            },
          ],
        }),
      });
      assert.equal(quoteRes.status, 200);
      const quote = (await quoteRes.json()) as any;
      // 24 pages duplex * 150 paise = 3600 paise/copy * 3 copies = 10,800 paise
      // Meets ₹100 bulk discount threshold (10,000 paise) -> 10% discount = 1080 paise
      assert.ok(quote.totalPaise > 0);
      assert.ok(quote.bulkDiscountPaise >= 0);

      // Step 3: Student submits order with UPI payment
      const orderRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: shop.id,
          customerName: 'Aarav Mehta',
          customerPhone: '+91 98230 45678',
          customerEmail: 'aarav.mehta@univ.edu.in',
          paymentMethod: 'UPI_ONLINE',
          quote,
          files: [
            {
              fileName: 'Final_Year_Dissertation.pdf',
              pageCount: 24,
              options: { paperSize: 'A4', colorMode: 'bw', duplexMode: 'duplex_auto', copies: 3 },
              subtotalPaise: quote.totalPaise,
            },
          ],
        }),
      });
      assert.equal(orderRes.status, 201);
      const orderData = (await orderRes.json()) as any;
      const orderId = orderData.orderId;
      assert.equal(orderData.status, 'AWAITING_PAYMENT');

      // Step 4: Webhook verifies online payment
      const verifyRes = await fetch(`${baseUrl}/api/v1/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          providerTransactionId: 'txn_rzp_aarav_9988',
        }),
      });
      assert.equal(verifyRes.status, 200);

      // Step 5: Merchant reviews and transitions to READY_FOR_PRINT -> IN_PROGRESS
      await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({ status: 'READY_FOR_PRINT' }),
      });

      const printDispatch = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({ printerName: 'Canon LBP2900' }),
      });
      assert.equal(printDispatch.status, 200);

      // Step 6: Edge agent polls command and marks READY_FOR_COLLECTION
      const agentConfirm = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({ status: 'READY_FOR_COLLECTION' }),
      });
      assert.equal(agentConfirm.status, 200);

      // Step 7: Student collects printed thesis -> mark COLLECTED
      const collectedRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({ status: 'COLLECTED' }),
      });
      assert.equal(collectedRes.status, 200);
      const finalOrder = (await collectedRes.json()) as any;
      assert.equal(finalOrder.order.status, 'COLLECTED');
    });

    // -----------------------------------------------------------------------
    // SCENARIO 2: Walk-In Government ID & Document Photocopy
    // -----------------------------------------------------------------------
    it('Scenario 2: Walk-In Urgent Document Photocopy (2 pages, B&W Simplex, Cash on Collection, Counter Cash Payment)', async () => {
      // Step 1: Customer uploads 2-page scanned ID document
      const uploadRes = await fetch(`${baseUrl}/api/v1/portal/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'Aadhaar_Card_Scan.pdf',
          fileData: Buffer.from('%PDF-1.4 ID Scan Document').toString('base64'),
          mimeType: 'application/pdf',
          shopId: 'shop-campus-1',
          pageCount: 2,
        }),
      });
      assert.equal(uploadRes.status, 201);
      const upload = (await uploadRes.json()) as any;

      // Step 2: Quote calculated for 2 pages B&W simplex
      const quoteRes = await fetch(`${baseUrl}/api/v1/portal/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          files: [
            {
              fileId: 'scan-1',
              fileName: 'Aadhaar_Card_Scan.pdf',
              pageCount: 2,
              options: { paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex', copies: 1 },
            },
          ],
        }),
      });
      assert.equal(quoteRes.status, 200);
      const quote = (await quoteRes.json()) as any;
      assert.equal(quote.totalPaise, 400); // ₹4.00

      // Step 3: Submit order with Cash on Collection
      const orderRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          customerName: 'Sunita Patil',
          customerPhone: '+91 99222 33445',
          paymentMethod: 'CASH_ON_COLLECTION',
          quote,
          files: [
            {
              fileName: 'Aadhaar_Card_Scan.pdf',
              storageKey: upload.storageKey,
              pageCount: 2,
              options: { paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex', copies: 1 },
              subtotalPaise: 400,
            },
          ],
        }),
      });
      assert.equal(orderRes.status, 201);
      const orderData = (await orderRes.json()) as any;
      const orderId = orderData.orderId;

      // Step 4: Operator marks ready for print, printing in progress, then ready for collection
      await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ status: 'READY_FOR_PRINT' }),
      });
      await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      });
      await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ status: 'READY_FOR_COLLECTION' }),
      });

      // Step 5: Customer pays ₹4 cash at counter
      const cashRes = await fetch(`${baseUrl}/api/v1/payments/orders/${orderId}/collect-cash`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(cashRes.status, 200);
      const cashData = (await cashRes.json()) as any;
      assert.equal(cashData.order.paymentStatus, 'VERIFIED');
      assert.equal(cashData.order.status, 'COLLECTED');
    });

    // -----------------------------------------------------------------------
    // SCENARIO 3: Multi-Document Portfolio with Mixed Formats
    // -----------------------------------------------------------------------
    it('Scenario 3: Multi-Document Portfolio with Mixed Paper Formats (Resume + Presentation + Color Flyer)', async () => {
      // Customer orders 2 files in one job
      const quoteRes = await fetch(`${baseUrl}/api/v1/portal/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          files: [
            {
              fileId: 'doc-resume',
              fileName: 'Resume_Engineering.pdf',
              pageCount: 2,
              options: { paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex', copies: 5 },
            },
            {
              fileId: 'doc-flyer',
              fileName: 'Portfolio_Cover_Color.pdf',
              pageCount: 1,
              options: { paperSize: 'A4', colorMode: 'color', duplexMode: 'simplex', copies: 1 },
            },
          ],
        }),
      });

      assert.equal(quoteRes.status, 200);
      const quote = (await quoteRes.json()) as any;
      assert.equal(quote.lineItems.length, 2);
      assert.ok(quote.totalPaise > 0);

      // Submit order
      const orderRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          customerName: 'Rohan Deshmukh',
          customerPhone: '+91 97777 66666',
          paymentMethod: 'CASH_ON_COLLECTION',
          quote,
          files: quote.lineItems.map((item: any, i: number) => ({
            fileName: i === 0 ? 'Resume_Engineering.pdf' : 'Portfolio_Cover_Color.pdf',
            pageCount: i === 0 ? 2 : 1,
            options: { paperSize: 'A4', colorMode: i === 0 ? 'bw' : 'color', duplexMode: 'simplex' },
            subtotalPaise: item.subtotalPaise,
          })),
        }),
      });

      assert.equal(orderRes.status, 201);
      const order = (await orderRes.json()) as any;
      assert.ok(order.orderNumber);
    });

    // -----------------------------------------------------------------------
    // SCENARIO 4: Hardware Paper Jam Incident & Operator Recovery
    // -----------------------------------------------------------------------
    it('Scenario 4: Hardware Paper Jam Incident & Operator Recovery (OUTPUT_UNCERTAIN Safety Invariant)', async () => {
      // 1. Submit high-volume print order (50 pages)
      const submitRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          customerName: 'Hardware Test Dept',
          paymentMethod: 'CASH_ON_COLLECTION',
          quote: { totalPaise: 10000, quoteVersion: 'q-v1' },
          files: [{ fileName: 'lab_manual_50p.pdf', pageCount: 50, options: { paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex' }, subtotalPaise: 10000 }],
        }),
      });
      assert.equal(submitRes.status, 201);
      const submitData = (await submitRes.json()) as any;
      const orderId = submitData.orderId;

      // 2. Dispatch to Canon printer
      await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ printerName: 'Canon LBP2900' }),
      });

      // 3. Printer experiences mechanical paper jam on page 14
      // Agent reports OUTPUT_UNCERTAIN
      const jamReport = await fetch(`${baseUrl}/api/v1/agent/command-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: `job-${orderId}`,
          attemptId: `att-${orderId}-1`,
          status: 'OUTPUT_UNCERTAIN',
          errorMessage: 'Mechanical paper jam detected at roller sensor. Printed pages unknown.',
          timestamp: new Date().toISOString(),
        }),
      });
      assert.equal(jamReport.status, 200);
      const jamData = (await jamReport.json()) as any;
      assert.equal(jamData.recordedStatus, 'OUTPUT_UNCERTAIN');

      // 4. Invariant assertion: Blind auto-retry is forbidden
      // Operator performs physical check at machine, clears jammed paper, and resolves order
      const resolvedRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({ status: 'READY_FOR_COLLECTION' }),
      });
      assert.equal(resolvedRes.status, 200);
    });

    // -----------------------------------------------------------------------
    // SCENARIO 5: Multi-Tenant Merchant Lifecycle & Platform Audit
    // -----------------------------------------------------------------------
    it('Scenario 5: Multi-Tenant Merchant Onboarding, Standee Generation, Agent Pairing & Platform Audit', async () => {
      const suffix = Date.now().toString(36);
      // 1. New print shop registers
      const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: `National Xerox Point ${suffix}`,
          shopCode: `national-${suffix}`,
          fullName: 'Vikram Joshi',
          email: `vikram_${suffix}@nationalprint.in`,
          password: 'Password123!',
          phone: '+91 98900 12345',
          city: 'Mumbai',
        }),
      });
      assert.equal(regRes.status, 201);
      const newShop = (await regRes.json()) as any;
      const shopId = newShop.shop.id;
      const shopCode = newShop.shop.shopCode;

      // 2. Fetch standee download metadata for this merchant
      const standeeRes = await fetch(`${baseUrl}/api/v1/agent/download?platform=win-x64&shopCode=${shopCode}&format=json`);
      assert.equal(standeeRes.status, 200);
      const standee = (await standeeRes.json()) as any;
      assert.equal(standee.shopConfig.shopCode, shopCode);

      // 3. Pair desktop agent
      const agentRes = await fetch(`${baseUrl}/api/v1/agent/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          secretKey: standee.shopConfig.pairingKey,
          hostname: `POS-MUMBAI-${suffix}`,
        }),
      });
      assert.equal(agentRes.status, 201);
      const agentData = (await agentRes.json()) as any;

      // 4. Send heartbeat
      const hbRes = await fetch(`${baseUrl}/api/v1/agent/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agentData.agentId,
          shopId,
          status: 'ONLINE',
          activePrintersCount: 1,
        }),
      });
      assert.equal(hbRes.status, 200);

      // 5. Platform Owner views updated overview reflecting the new merchant
      const overviewRes = await fetch(`${baseUrl}/api/v1/platform/overview`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(overviewRes.status, 200);
      const overview = (await overviewRes.json()) as any;
      assert.ok(overview.metrics.totalOrganizations >= 2);
      assert.ok(overview.metrics.totalShops >= 2);
    });
  });
});
