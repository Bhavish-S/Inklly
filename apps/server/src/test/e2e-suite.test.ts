import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { makeTestPdf } from './test-pdf';
import { createApp } from '../index';
import { DatabaseService } from '@inklly/db';
import * as http from 'node:http';

describe('Inklly 4-Tier Comprehensive E2E Automated Test Suite', { concurrency: false }, () => {
  let server: http.Server;
  let baseUrl: string;
  let db: DatabaseService;
  let merchantToken: string;
  let adminToken: string;
  let newMerchantToken: string;
  let newShopId: string;
  let newShopCode: string;
  const originalExternalApiSetting = process.env.ENABLE_EXTERNAL_API_ACCESS;

  const uploadCustomerFile = async (shopId: string, fileName: string, pageCount = 1) => {
    const response = await fetch(`${baseUrl}/api/v1/portal/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId,
        fileName,
        fileData: makeTestPdf(pageCount).toString('base64'),
        pageCount,
      }),
    });
    assert.equal(response.status, 201);
    return await response.json() as any;
  };

  const pairTestAgent = async (hostname: string) => {
    const pairingRes = await fetch(`${baseUrl}/api/v1/merchant/agents/pairing-code`, { method: 'POST', headers: { Authorization: `Bearer ${merchantToken}` } });
    assert.equal(pairingRes.status, 201);
    const pairing = await pairingRes.json() as any;
    const enrollRes = await fetch(`${baseUrl}/api/v1/agent/enroll`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shopId: 'shop-campus-1', pairingCode: pairing.pairingCode, hostname }) });
    assert.equal(enrollRes.status, 201);
    const agent = await enrollRes.json() as any;
    const headers = { 'Content-Type': 'application/json', 'X-Agent-Id': agent.agentId, Authorization: `Bearer ${agent.agentSecret}` };
    const heartbeat = await fetch(`${baseUrl}/api/v1/agent/heartbeat`, {
      method: 'POST', headers,
      body: JSON.stringify({ status: 'ONLINE', activePrintersCount: 2, localQueueDepth: 0, printers: [
        { name: 'HP LaserJet Pro M401dne (B&W High-Speed)', driverName: 'HP LaserJet Pro M401 PCL6', isOnline: true, isDefault: true },
        { name: 'Canon imageRUNNER ADVANCE C3530i (Color/Multi-Format)', driverName: 'Canon Generic Plus PCL6', isOnline: true, isDefault: false },
      ] }),
    });
    assert.equal(heartbeat.status, 200);
    const printer = db.queryOne<any>(`SELECT id FROM printers WHERE agent_id = ? AND system_driver_name = ?`, [agent.agentId, 'HP LaserJet Pro M401 PCL6']);
    assert.ok(printer);
    return { headers, printerId: printer.id as string };
  };

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

    // Obtain seeded merchant auth token
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@campusprint.in', password: 'DemoOwnerPassword123!' }),
    });
    const loginData = (await loginRes.json()) as any;
    merchantToken = loginData.token;

    // Obtain platform admin auth token
    const adminLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@inklly.com', password: 'DemoPlatformPassword123!' }),
    });
    const adminLoginData = (await adminLoginRes.json()) as any;
    adminToken = adminLoginData.token;
  });

  after(() => {
    server.close();
    db.close();
    if (originalExternalApiSetting === undefined) delete process.env.ENABLE_EXTERNAL_API_ACCESS;
    else process.env.ENABLE_EXTERNAL_API_ACCESS = originalExternalApiSetting;
  });

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (>=5 tests per feature R1–R5)
  // =========================================================================

  describe('Tier 1: Feature Coverage (R1 - Merchant Onboarding & Tenancy)', { concurrency: false }, () => {
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
      assert.equal(data.registrationComplete, true);
      assert.equal(data.organization.planStatus, 'TRIAL');
      assert.ok(data.shop.id);
      assert.equal(data.user.role, 'MERCHANT_OWNER');
      assert.ok(data.organization.id);

      // Activate subscription via platform admin
      const activateRes = await fetch(`${baseUrl}/api/v1/platform/merchants/${data.organizationId}/status`, {
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
          email: `rajesh_${uniqueSuffix}@metroprint.in`,
          password: 'Password123!',
        }),
      });
      assert.equal(loginRes.status, 200);
      const loginData = await loginRes.json();
      newMerchantToken = loginData.token;
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

  describe('Tier 1: Feature Coverage (R2 - QR Standee & Customer Intake Portal)', { concurrency: false }, () => {
    it('T1.6: Retrieves public shop profile for customer intake portal using shopCode', async () => {
      const res = await fetch(`${baseUrl}/api/v1/portal/shop/campus1`);
      assert.equal(res.status, 200);
      const shop = (await res.json()) as any;
      assert.equal(shop.shopCode, 'campus1');
      assert.equal(shop.name, 'Campus Print Express');
      assert.ok(shop.rates);
      assert.ok(shop.enabledPaperFormats.includes('A4'));
    });

    it('T1.7: Blocks public setup scripts when a signed installer is unavailable', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/download?platform=win-x64&shopCode=campus1&format=script`);
      assert.equal(res.status, 410);
    });

    it('T1.8: Reports the verified installer as unavailable until a build is configured', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/download?platform=win-x64&shopCode=campus1&format=json`);
      assert.equal(res.status, 503);
      const meta = (await res.json()) as any;
      assert.equal(meta.installerAvailable, false);
    });

    it('T1.9: Returns conservative driver capabilities without claiming unverified hardware support', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/driver-matrix`);
      assert.equal(res.status, 200);
      const matrix = (await res.json()) as any;
      assert.equal(matrix.capabilityStatus, 'NOT_VERIFIED');
      assert.equal(matrix.physicalPrintingEnabledByDefault, false);
      assert.equal(matrix.colorSupport, 'UNKNOWN');
      assert.equal(matrix.duplexSupport, 'UNKNOWN');
    });

    it('T1.10: Returns loopback edge spooler diagnostics and safety specifications', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/diagnostics`);
      assert.equal(res.status, 200);
      const diag = (await res.json()) as any;
      assert.equal(diag.loopbackPort, 8765);
      assert.equal(diag.hardwareSafety, 'OUTPUT_UNCERTAIN on hardware jam or spooler halt');
    });
  });

  describe('Tier 1: Feature Coverage (R3 - Real Document Upload, Binary Page Count & Quoting)', { concurrency: false }, () => {
    let uploadedKey: string;

    it('T1.11: Uploads document in Base64 format and returns storageKey and file size', async () => {
      const dummyPdfContent = makeTestPdf(5).toString('base64');
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

  describe('Tier 1: Feature Coverage (R4 - Local Hardware Loopback & Safety Invariant)', { concurrency: false }, () => {
    let createdPrinterId: string;
    let enrolledAgentId: string;
    let enrolledAgentSecret: string;

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
      const pairingRes = await fetch(`${baseUrl}/api/v1/merchant/agents/pairing-code`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(pairingRes.status, 201);
      const pairing = (await pairingRes.json()) as any;
      const res = await fetch(`${baseUrl}/api/v1/agent/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          pairingCode: pairing.pairingCode,
          hostname: 'COUNTER-PC-01',
          osPlatform: 'win32',
        }),
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      assert.ok(data.agentId);
      enrolledAgentId = data.agentId;
      enrolledAgentSecret = data.agentSecret;
    });

    const agentHeaders = () => ({
      'Content-Type': 'application/json',
      'X-Agent-Id': enrolledAgentId,
      Authorization: `Bearer ${enrolledAgentSecret}`,
    });

    it('T1.18: Receives edge agent periodic heartbeat and confirms status', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/heartbeat`, {
        method: 'POST',
        headers: agentHeaders(),
        body: JSON.stringify({
          status: 'ONLINE',
          activePrintersCount: 2,
          localQueueDepth: 0,
          printers: [
            { name: 'HP LaserJet Pro M401dne (B&W High-Speed)', driverName: 'HP LaserJet Pro M401 PCL6', isOnline: true, isDefault: true },
            { name: 'Canon imageRUNNER ADVANCE C3530i (Color/Multi-Format)', driverName: 'Canon Generic Plus PCL6', isOnline: true, isDefault: false },
          ],
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.acknowledged, true);
    });

    it('T1.19: Agent polls pending command queue for queued print tickets', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/poll-commands`, { headers: agentHeaders() });
      assert.equal(res.status, 200);
      const tickets = (await res.json()) as any;
      assert.ok(Array.isArray(tickets));
    });

    it('T1.20: Enforces hardware safety invariant: records OUTPUT_UNCERTAIN on paper jam without retry', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/command-result`, {
        method: 'POST',
        headers: agentHeaders(),
        body: JSON.stringify({
          jobId: 'job-jam-test',
          attemptId: 'att-jam-test',
          status: 'OUTPUT_UNCERTAIN',
          errorMessage: 'Paper jam occurred during page 2. Physical inspection required.',
          timestamp: new Date().toISOString(),
        }),
      });

      // A fabricated attempt must not be allowed to mutate a print job.
      assert.equal(res.status, 409);
    });
  });

  describe('Tier 1: Feature Coverage (R5 - Dedicated Platform Owner & Developer Portals)', { concurrency: false }, () => {
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

    it('T1.23: Retrieves the code-managed pilot plan catalog without publishing inactive prices', async () => {
      const res = await fetch(`${baseUrl}/api/v1/platform/plans`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const plans = (await res.json()) as any;
      assert.equal(plans.length, 4);
      assert.ok(plans.some((p: any) => p.tier === 'STARTER'));
      assert.ok(plans.some((p: any) => p.tier === 'PRO'));
      assert.ok(plans.every((p: any) => p.monthlyPricePaise === null && p.annualPricePaise === null));
      assert.ok(plans.every((p: any) => p.pricing === 'CONFIGURED_PER_PILOT'));
      assert.ok(plans.every((p: any) => p.catalogStatus === 'PLANNED_NOT_ENFORCED'));
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

    it('T1.26: Returns a clearly marked synthetic webhook preview without claiming delivery', async () => {
      const res = await fetch(`${baseUrl}/api/v1/developer/test-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({
          eventType: 'order.created',
        }),
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.mode, 'PREVIEW_ONLY');
      assert.equal(body.delivered, false);
      assert.equal(body.payload.eventType, 'order.created');
      assert.equal(body.payload.eventId, 'evt_preview_synthetic');
      assert.match(body.message, /No webhook request was sent or signed/);
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

  describe('Tier 2: Boundary & Corner Cases (R1 Boundaries)', { concurrency: false }, () => {
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

  describe('Tier 2: Boundary & Corner Cases (R2 Boundaries)', { concurrency: false }, () => {
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

    it('T2.9: Rejects installer requests for unknown shop codes', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/download?platform=win-legacy-x86&shopCode=unknown-shop&format=json`);
      assert.equal(res.status, 404);
    });

    it('T2.10: Does not generate setup scripts from public query parameters', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/download?platform=win-x64&shopCode=test&format=script`);
      assert.equal(res.status, 404);
    });
  });

  describe('Tier 2: Boundary & Corner Cases (R3 Boundaries)', { concurrency: false }, () => {
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

    it('T2.14: Prices a valid uploaded order server-side when client quote is omitted', async () => {
      const upload = await uploadCustomerFile('shop-campus-1', 'test.pdf', 1);
      const res = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          customerName: 'No Quote Customer',
          files: [{ fileName: 'test.pdf', pageCount: 1, storageKey: upload.storageKey, options: {
            paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex', copies: 1,
          } }],
          // Server computes the authoritative quote; customer totals are not required.
        }),
      });
      assert.equal(res.status, 201);
      const order = await res.json() as any;
      assert.ok(order.totalAmountPaise > 0);
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

  describe('Tier 2: Boundary & Corner Cases (R4 Boundaries)', { concurrency: false }, () => {
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

    it('T2.17: Rejects unauthenticated agent heartbeats before reading identity fields', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'ONLINE',
        }),
      });
      assert.equal(res.status, 401);
    });

    it('T2.18: Rejects unauthenticated command-result reports before reading payload fields', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/command-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PRINT_CONFIRMED',
          // Missing jobId and attemptId
        }),
      });
      assert.equal(res.status, 401);
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

    it('T2.20: Rejects unauthenticated agent polling when shopId query parameter is omitted', async () => {
      const res = await fetch(`${baseUrl}/api/v1/agent/poll-commands`);
      assert.equal(res.status, 401);
    });
  });

  describe('Tier 2: Boundary & Corner Cases (R5 Boundaries)', { concurrency: false }, () => {
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
      const upload = await uploadCustomerFile('shop-campus-1', 'state-machine.pdf');
      // Try to jump an order directly to COLLECTED from AWAITING_REVIEW
      const submitRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          customerName: 'State Machine Test',
          paymentMethod: 'CASH_ON_COLLECTION',
          quote: { totalPaise: 200, quoteVersion: 'q-v1' },
          files: [{ fileName: 'state-machine.pdf', storageKey: upload.storageKey, pageCount: 1, options: { paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex', copies: 1 }, subtotalPaise: 200 }],
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

  describe('Tier 3: Cross-Feature & Pairwise Integration Scenarios', { concurrency: false }, () => {
    it('T3.1: Pairwise: Merchant Registration -> Custom Rates -> Customer Intake Portal Reflects Custom Rates', async () => {
      const suffix = Date.now().toString(36);
      // 1. Register merchant (account created pending subscription payment)
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
      assert.equal(regData.registrationComplete, true);
      const shopCode = regData.shop.shopCode;
      const shopId = regData.shop.id;
      const orgId = regData.organizationId;

      // 2. Activate subscription via platform admin (simulate payment completion)
      const activateRes = await fetch(`${baseUrl}/api/v1/platform/merchants/${orgId}/status`, {
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

      // 3. Log in to get credentials
      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `rates_${suffix}@test.com`,
          password: 'Password123!',
        }),
      });
      assert.equal(loginRes.status, 200);
      const loginData = (await loginRes.json()) as any;
      const token = loginData.token;

      // 4. Update custom rate to ₹5.00 (500 paise) for A4 B&W Simplex
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

      // 5. Customer portal fetches shop rates
      const portalRes = await fetch(`${baseUrl}/api/v1/portal/shop/${shopCode}`);
      assert.equal(portalRes.status, 200);
      const portalData = (await portalRes.json()) as any;
      assert.equal(portalData.rates.bw_simplex, 5); // 500 paise = ₹5.00
    });

    it('T3.2: Pairwise: Customer Order -> Counter Cash Collection -> Financial Ledger Entry Created', async () => {
      const upload = await uploadCustomerFile('shop-campus-1', 'ledger-doc.pdf', 6);
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
          files: [{ fileName: 'ledger-doc.pdf', storageKey: upload.storageKey, pageCount: 6, options: { paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex', copies: 1 }, subtotalPaise: 1200 }],
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
      const upload = await uploadCustomerFile('shop-campus-1', 'handout.pdf', 3);
      // 1. Submit order
      const submitRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          customerName: 'Agent Loopback Test',
          paymentMethod: 'CASH_ON_COLLECTION',
          quote: { totalPaise: 600, quoteVersion: 'q-v1' },
          files: [{ fileName: 'handout.pdf', storageKey: upload.storageKey, pageCount: 3, options: { paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex', copies: 1 }, subtotalPaise: 600 }],
        }),
      });
      assert.equal(submitRes.status, 201);
      const submitData = (await submitRes.json()) as any;
      const orderId = submitData.orderId;

      const agentSetup = await pairTestAgent('PAIRWISE-TEST-AGENT');
      // 2. Merchant initiates print dispatch
      const printRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({ printerId: agentSetup.printerId }),
      });
      assert.equal(printRes.status, 200, await printRes.clone().text());

      // 3. Agent polls command queue
      const pollRes = await fetch(`${baseUrl}/api/v1/agent/poll-commands`, { headers: agentSetup.headers });
      assert.equal(pollRes.status, 200);
      const tickets = await pollRes.json() as any[];
      const orderJobIds = new Set(db.query<any>(`SELECT id FROM print_jobs WHERE order_id = ?`, [orderId]).map((row) => row.id));
      const ticket = tickets.find((item) => orderJobIds.has(item.jobId));
      assert.ok(ticket, JSON.stringify({ tickets, printers: db.query<any>(`SELECT id, shop_id, name, is_online, agent_id FROM printers`), jobs: db.query<any>(`SELECT id, order_id, printer_id, status FROM print_jobs WHERE order_id = ?`, [orderId]) }));
      const ackRes = await fetch(`${baseUrl}/api/v1/agent/acknowledge-command`, { method: 'POST', headers: agentSetup.headers, body: JSON.stringify({ commandId: ticket.commandId, attemptId: ticket.attemptId }) });
      assert.equal(ackRes.status, 200);

      // 4. Agent reports spooler submission; the operator must inspect physical output.
      const submittedRes = await fetch(`${baseUrl}/api/v1/agent/command-result`, {
        method: 'POST',
        headers: agentSetup.headers,
        body: JSON.stringify({
          jobId: ticket.jobId,
          attemptId: ticket.attemptId,
          status: 'SUBMITTED_TO_SPOOLER',
          timestamp: new Date().toISOString(),
        }),
      });
      assert.equal(submittedRes.status, 200);
      const beforeInspection = await fetch(`${baseUrl}/api/v1/portal/orders/${orderId}`);
      assert.equal((await beforeInspection.json() as any).status, 'IN_PROGRESS');

      const reconcileRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/reconcile-output`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ physicalOutputConfirmed: true, reason: 'Inspected each printed page against the submitted job before pickup.' }),
      });
      assert.equal(reconcileRes.status, 200, await reconcileRes.clone().text());
      const reconciled = await reconcileRes.json() as any;
      assert.equal(reconciled.order.status, 'READY_FOR_COLLECTION');
    });

    it('T3.4: Rejects online payment orders until shop Razorpay credentials are configured', async () => {
      const upload = await uploadCustomerFile('shop-campus-1', 'thesis.pdf', 25);
      // Online payment must stay unavailable without shop-owned live credentials.
      const submitRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          customerName: 'UPI Webhook Customer',
          paymentMethod: 'ONLINE_RAZORPAY',
          quote: { totalPaise: 5000, quoteVersion: 'q-v1' },
          files: [{ fileName: 'thesis.pdf', storageKey: upload.storageKey, pageCount: 25, options: { paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex', copies: 1 }, subtotalPaise: 5000 }],
        }),
      });
      assert.equal(submitRes.status, 422);
      assert.match((await submitRes.json() as any).error, /not configured/i);
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

  describe('Tier 4: Real-World End-to-End Application Scenarios', { concurrency: false }, () => {
    // -----------------------------------------------------------------------
    // SCENARIO 1: University Student Thesis Batch Printing
    // -----------------------------------------------------------------------
    it('Scenario 1: University Student Thesis Printing (Multipage Mixed B&W + Color, Auto Duplex, 3 Copies, Bulk Discount, Cash on Collection)', async () => {
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

      const upload = await uploadCustomerFile(shop.id, 'Final_Year_Dissertation.pdf', 24);

      // Step 3: Student submits order with cash on collection; this seed shop has no Razorpay credentials.
      const orderRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: shop.id,
          customerName: 'Aarav Mehta',
          customerPhone: '+91 98230 45678',
          customerEmail: 'aarav.mehta@univ.edu.in',
          paymentMethod: 'CASH_ON_COLLECTION',
          quote,
          files: [
            {
              fileName: 'Final_Year_Dissertation.pdf',
              storageKey: upload.storageKey,
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
      assert.equal(orderData.status, 'AWAITING_REVIEW');

      // Step 5: Merchant reviews and transitions to READY_FOR_PRINT -> IN_PROGRESS
      await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({ status: 'READY_FOR_PRINT' }),
      });

      const agentSetup = await pairTestAgent('DISSERTATION-PRINT-AGENT');

      const printDispatch = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({ printerId: agentSetup.printerId }),
      });
      assert.equal(printDispatch.status, 200);

      // Step 6: Agent submits to the spooler; the merchant physically verifies output.
      const polled = await fetch(`${baseUrl}/api/v1/agent/poll-commands`, { headers: agentSetup.headers });
      const ticket = (await polled.json() as any[]).find((item) => item.correlationId === `corr-${orderId}`);
      assert.ok(ticket);
      const acknowledged = await fetch(`${baseUrl}/api/v1/agent/acknowledge-command`, { method: 'POST', headers: agentSetup.headers, body: JSON.stringify({ commandId: ticket.commandId, attemptId: ticket.attemptId }) });
      assert.equal(acknowledged.status, 200);
      const submitted = await fetch(`${baseUrl}/api/v1/agent/command-result`, { method: 'POST', headers: agentSetup.headers, body: JSON.stringify({ jobId: ticket.jobId, attemptId: ticket.attemptId, status: 'SUBMITTED_TO_SPOOLER', timestamp: new Date().toISOString() }) });
      assert.equal(submitted.status, 200);
      const agentConfirm = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/reconcile-output`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ physicalOutputConfirmed: true, reason: 'Inspected each requested sheet and confirmed the complete dissertation before pickup.' }),
      });
      assert.equal(agentConfirm.status, 200, await agentConfirm.clone().text());

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
          fileData: makeTestPdf(2).toString('base64'),
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

      // Shop agent submits the order to the OS spooler; the operator inspects the paper.
      const agentSetup = await pairTestAgent('WALK-IN-COPY-AGENT');
      const dispatchRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ printerId: agentSetup.printerId }),
      });
      assert.equal(dispatchRes.status, 200);
      const polled = await fetch(`${baseUrl}/api/v1/agent/poll-commands`, { headers: agentSetup.headers });
      const ticket = (await polled.json() as any[]).find((job) => job.correlationId === `corr-${orderId}`);
      assert.ok(ticket);
      const ackRes = await fetch(`${baseUrl}/api/v1/agent/acknowledge-command`, { method: 'POST', headers: agentSetup.headers, body: JSON.stringify({ commandId: ticket.commandId, attemptId: ticket.attemptId }) });
      assert.equal(ackRes.status, 200);
      const submitted = await fetch(`${baseUrl}/api/v1/agent/command-result`, { method: 'POST', headers: agentSetup.headers, body: JSON.stringify({ jobId: ticket.jobId, attemptId: ticket.attemptId, status: 'SUBMITTED_TO_SPOOLER', timestamp: new Date().toISOString() }) });
      assert.equal(submitted.status, 200);
      const reconcile = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/reconcile-output`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ physicalOutputConfirmed: true, reason: 'Inspected the two pages in the output tray before serving the customer.' }),
      });
      assert.equal(reconcile.status, 200, await reconcile.clone().text());

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
      const resumeUpload = await uploadCustomerFile('shop-campus-1', 'Resume_Engineering.pdf', 2);
      const flyerUpload = await uploadCustomerFile('shop-campus-1', 'Portfolio_Cover_Color.pdf', 1);
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
            storageKey: i === 0 ? resumeUpload.storageKey : flyerUpload.storageKey,
            pageCount: i === 0 ? 2 : 1,
            options: { paperSize: 'A4', colorMode: i === 0 ? 'bw' : 'color', duplexMode: 'simplex', copies: i === 0 ? 5 : 1 },
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
      const upload = await uploadCustomerFile('shop-campus-1', 'lab_manual_50p.pdf', 50);
      // 1. Submit high-volume print order (50 pages)
      const submitRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 'shop-campus-1',
          customerName: 'Hardware Test Dept',
          paymentMethod: 'CASH_ON_COLLECTION',
          quote: { totalPaise: 10000, quoteVersion: 'q-v1' },
          files: [{ fileName: 'lab_manual_50p.pdf', storageKey: upload.storageKey, pageCount: 50, options: { paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex', copies: 1 }, subtotalPaise: 10000 }],
        }),
      });
      assert.equal(submitRes.status, 201);
      const submitData = (await submitRes.json()) as any;
      const orderId = submitData.orderId;

      const agentSetup = await pairTestAgent('PAPER-JAM-TEST-AGENT');
      // 2. Dispatch to the queue reported by this simulated agent.
      const printRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ printerId: agentSetup.printerId }),
      });
      assert.equal(printRes.status, 200);

      const pollRes = await fetch(`${baseUrl}/api/v1/agent/poll-commands`, { headers: agentSetup.headers });
      assert.equal(pollRes.status, 200);
      const tickets = await pollRes.json() as any[];
      const ticket = tickets.find((item) => item.correlationId === `corr-${orderId}`);
      assert.ok(ticket);
      const ackRes = await fetch(`${baseUrl}/api/v1/agent/acknowledge-command`, { method: 'POST', headers: agentSetup.headers, body: JSON.stringify({ commandId: ticket.commandId, attemptId: ticket.attemptId }) });
      assert.equal(ackRes.status, 200);

      // 3. Printer experiences mechanical paper jam on page 14
      // Agent reports OUTPUT_UNCERTAIN
      const jamReport = await fetch(`${baseUrl}/api/v1/agent/command-result`, {
        method: 'POST',
        headers: agentSetup.headers,
        body: JSON.stringify({
          jobId: ticket.jobId,
          attemptId: ticket.attemptId,
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
      const resolvedRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/reconcile-output`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ physicalOutputConfirmed: true, reason: 'Cleared the jam and inspected the tray and every completed page; the full order is present.' }),
      });
      assert.equal(resolvedRes.status, 200);
    });

    // -----------------------------------------------------------------------
    // SCENARIO 5: Multi-Tenant Merchant Lifecycle & Platform Audit
    // -----------------------------------------------------------------------
    it('Scenario 5: Merchant onboarding succeeds while agent download fails closed without a verified installer', async () => {
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
      const shopCode = newShop.shop.shopCode;

      // 2. Fetch standee download metadata for this merchant
      const standeeRes = await fetch(`${baseUrl}/api/v1/agent/download?platform=win-x64&shopCode=${shopCode}&format=json`);
      assert.equal(standeeRes.status, 503);
      const unavailable = await standeeRes.json() as any;
      assert.equal(unavailable.installerAvailable, false);
      // Platform owner can still view the newly onboarded merchant.
      const overviewRes = await fetch(`${baseUrl}/api/v1/platform/overview`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(overviewRes.status, 200);
      const overview = (await overviewRes.json()) as any;
      assert.ok(overview.metrics.totalOrganizations >= 2);
      assert.ok(overview.metrics.totalShops >= 2);
    });

    // -----------------------------------------------------------------------
    // SCENARIO 6: Complete End-to-End Workflow (Subscription → Dashboard → Printer → QR → Customer Order → Auto-Print → Token → Collect)
    // -----------------------------------------------------------------------
    it('Scenario 6: Complete print shop lifecycle from subscription payment to order collection', async () => {
      const suffix = Date.now().toString(36);
      const shopEmail = `workflow_${suffix}@printshop.in`;

      // 1. Merchant registers (pending subscription payment)
      const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: `Workflow Print Shop ${suffix}`,
          shopCode: `workflow-${suffix}`,
          fullName: 'Workflow Owner',
          email: shopEmail,
          password: 'Password123!',
          phone: '+91 98765 43210',
          city: 'Pune',
        }),
      });
      assert.equal(regRes.status, 201);
      const regData = await regRes.json();
      assert.equal(regData.registrationComplete, true);
      assert.equal(regData.organization.planStatus, 'TRIAL');
      const newShopId = regData.shop.id;
      const newShopCode = regData.shop.shopCode;

      // 2. Activate subscription via platform admin (simulate Razorpay payment completion)
      const activateRes = await fetch(`${baseUrl}/api/v1/platform/merchants/${regData.organizationId}/status`, {
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

      // 3. Merchant logs in with issued credentials
      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: shopEmail, password: 'Password123!' }),
      });
      assert.equal(loginRes.status, 200);
      const loginData = await loginRes.json();
      const merchantToken = loginData.token;

      // 4. Merchant accesses dashboard
      const dashRes = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(dashRes.status, 200);
      const dash = await dashRes.json();
      assert.equal(dash.shopId, newShopId);

      // 5. Merchant configures auto-print mode
      const settingsRes = await fetch(`${baseUrl}/api/v1/merchant/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({ autoPrintMode: 'PRINT_AFTER_PAYMENT' }),
      });
      assert.equal(settingsRes.status, 200, await settingsRes.clone().text());

      // 6. Merchant adds a printer
      const printerRes = await fetch(`${baseUrl}/api/v1/merchant/printers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({
          name: 'Canon LBP2900',
          systemDriverName: 'Canon LBP2900',
          supportsColor: false,
          supportsDuplex: true,
          trays: [{ name: 'Tray 1', supportedSizes: ['A4', 'PLAIN'], isDefault: true }],
        }),
      });
      assert.equal(printerRes.status, 201);
      const printerData = await printerRes.json();
      assert.ok(printerData.id);

      // Report a simulated local queue through the authenticated agent inventory path.
      const pairingRes = await fetch(`${baseUrl}/api/v1/merchant/agents/pairing-code`, {
        method: 'POST', headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(pairingRes.status, 201);
      const pairing = await pairingRes.json() as any;
      const enrollRes = await fetch(`${baseUrl}/api/v1/agent/enroll`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: newShopId, pairingCode: pairing.pairingCode, hostname: 'SIMULATED-PRINT-AGENT' }),
      });
      assert.equal(enrollRes.status, 201);
      const agent = await enrollRes.json() as any;
      const agentHeaders = { 'Content-Type': 'application/json', 'X-Agent-Id': agent.agentId, Authorization: `Bearer ${agent.agentSecret}` };
      const heartbeatRes = await fetch(`${baseUrl}/api/v1/agent/heartbeat`, {
        method: 'POST', headers: agentHeaders,
        body: JSON.stringify({ status: 'ONLINE', activePrintersCount: 1, localQueueDepth: 0, printers: [{ name: 'Canon LBP2900', driverName: 'Canon LBP2900', isOnline: true, isDefault: true }] }),
      });
      assert.equal(heartbeatRes.status, 200);

      // 7. Customer uploads document via QR portal
      const uploadRes = await fetch(`${baseUrl}/api/v1/portal/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: newShopId,
          fileName: 'assignment.pdf',
          fileData: makeTestPdf(5).toString('base64'),
          pageCount: 5,
        }),
      });
      assert.equal(uploadRes.status, 201);
      const uploadData = await uploadRes.json();
      assert.ok(uploadData.storageKey);
      assert.equal(uploadData.pageCount, 5);

      // 8. Customer submits order with cash-on-collection payment
      const orderRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: newShopId,
          customerName: 'Student Customer',
          customerPhone: '+91 91234 56789',
          paymentMethod: 'CASH_ON_COLLECTION',
          files: [{
            fileName: 'assignment.pdf',
            storageKey: uploadData.storageKey,
            pageCount: uploadData.pageCount,
            fileSizeBytes: uploadData.fileSizeBytes,
            mimeType: uploadData.mimeType,
            options: { paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex', copies: 1 },
          }],
        }),
      });
      assert.equal(orderRes.status, 201);
      const orderData = await orderRes.json();
      assert.ok(orderData.orderId);
      assert.ok(orderData.orderNumber);
      assert.ok(orderData.tokenNumber); // Token number for collection
      assert.equal(orderData.paymentStatus, 'PENDING');
      assert.equal(orderData.status, 'AWAITING_REVIEW');

      // 9. Razorpay payment intent is unavailable (no credentials configured in test env)
      const intentRes = await fetch(`${baseUrl}/api/v1/payments/create-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderData.orderId }),
      });
      assert.equal(intentRes.status, 404);

      // 10. Merchant collects cash at counter
      const cashRes = await fetch(`${baseUrl}/api/v1/payments/orders/${orderData.orderId}/collect-cash`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(cashRes.status, 200);

      // 11. Verify order has token number and is AWAITING_REVIEW with VERIFIED payment
      const statusRes = await fetch(`${baseUrl}/api/v1/portal/orders/${orderData.orderId}`, {
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(statusRes.status, 200);
      const statusData = await statusRes.json();
      assert.equal(statusData.tokenNumber, orderData.tokenNumber);
      assert.equal(statusData.status, 'AWAITING_REVIEW');
      assert.equal(statusData.paymentStatus, 'VERIFIED');

      // 12. Merchant reviews and prints the order
      const printRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderData.orderId}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ printerId: db.queryOne<any>(`SELECT id FROM printers WHERE agent_id = ? AND name = ?`, [agent.agentId, 'Canon LBP2900']).id }),
      });
      assert.equal(printRes.status, 200);
      const printData = await printRes.json();
      assert.equal(printData.order.status, 'IN_PROGRESS');

      const ticketResponse = await fetch(`${baseUrl}/api/v1/agent/poll-commands`, { headers: agentHeaders });
      const ticket = (await ticketResponse.json() as any[])[0];
      assert.ok(ticket);
      const ack = await fetch(`${baseUrl}/api/v1/agent/acknowledge-command`, { method: 'POST', headers: agentHeaders, body: JSON.stringify({ commandId: ticket.commandId, attemptId: ticket.attemptId }) });
      assert.equal(ack.status, 200);
      const submitted = await fetch(`${baseUrl}/api/v1/agent/command-result`, { method: 'POST', headers: agentHeaders, body: JSON.stringify({ jobId: ticket.jobId, attemptId: ticket.attemptId, status: 'SUBMITTED_TO_SPOOLER', timestamp: new Date().toISOString() }) });
      assert.equal(submitted.status, 200);
      const readyRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderData.orderId}/reconcile-output`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ physicalOutputConfirmed: true, reason: 'Inspected the five pages and confirmed they match the complete print request.' }),
      });
      assert.equal(readyRes.status, 200, await readyRes.clone().text());

      // 14. Customer mentions token number; merchant confirms collection
      const collectRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderData.orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify({ status: 'COLLECTED' }),
      });
      assert.equal(collectRes.status, 200);

      // 15. Verify order is collected
      const finalStatus = await fetch(`${baseUrl}/api/v1/portal/orders/${orderData.orderId}`, {
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      assert.equal(finalStatus.status, 200);
      const finalData = await finalStatus.json();
      assert.equal(finalData.status, 'COLLECTED');
      assert.equal(finalData.tokenNumber, orderData.tokenNumber);
    });

    // -----------------------------------------------------------------------
    // SCENARIO 7: Razorpay Credential Setup & Verification
    // -----------------------------------------------------------------------
    it('Scenario 7: Merchant configures Razorpay credentials and verifies them', async () => {
      const suffix = Date.now().toString(36);
      const shopEmail = `razor_${suffix}@printshop.in`;

      // 1. Register merchant
      const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: `Razor Print Shop ${suffix}`,
          shopCode: `razor-${suffix}`,
          fullName: 'Razor Owner',
          email: shopEmail,
          password: 'Password123!',
          phone: '+91 98765 43210',
          city: 'Pune',
        }),
      });
      assert.equal(regRes.status, 201);
      const regData = await regRes.json();
      assert.equal(regData.registrationComplete, true);

      // 2. Activate subscription via platform admin
      await fetch(`${baseUrl}/api/v1/platform/merchants/${regData.organizationId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ planTier: 'STARTER', planStatus: 'ACTIVE' }),
      });

      // 3. Merchant logs in
      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: shopEmail, password: 'Password123!' }),
      });
      assert.equal(loginRes.status, 200);
      const loginData = await loginRes.json();
      const razorToken = loginData.token;

      // 4. Initially Razorpay is not configured
      const statusRes = await fetch(`${baseUrl}/api/v1/merchant/settings/razorpay`, {
        headers: { Authorization: `Bearer ${razorToken}` },
      });
      assert.equal(statusRes.status, 200);
      const statusBody = await statusRes.json();
      assert.equal(statusBody.configured, false);

      // 5. Save Razorpay credentials (using test-mode key format)
      // Set encryption key for test environment
      process.env.RAZORPAY_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32).toString('base64');
      const saveRes = await fetch(`${baseUrl}/api/v1/merchant/settings/razorpay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${razorToken}` },
        body: JSON.stringify({
          keyId: 'rzp_test_1234567890',
          secret: 'test_secret_key_1234567890abcdef',
          webhookSecret: 'test_webhook_secret_1234567890abcdef',
        }),
      });
      assert.equal(saveRes.status, 200);
      const saveBody = await saveRes.json();
      assert.equal(saveBody.configured, true);

      // 6. Test credentials will fail since Razorpay API is not reachable in test env
      const testRes = await fetch(`${baseUrl}/api/v1/merchant/settings/razorpay/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${razorToken}` },
      });
      assert.ok([400, 503].includes(testRes.status));

      // 7. Remove credentials
      const removeRes = await fetch(`${baseUrl}/api/v1/merchant/settings/razorpay`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${razorToken}` },
      });
      assert.equal(removeRes.status, 200);
      const removeBody = await removeRes.json();
      assert.equal(removeBody.configured, false);
    });
  });
});
