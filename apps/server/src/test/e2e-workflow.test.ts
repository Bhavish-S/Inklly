import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { createApp } from '../index';
import { DatabaseService } from '@inklly/db';
import * as http from 'node:http';

describe('Inklly End-to-End Automated Printing & Multi-Plan Workflow Test Suite', { concurrency: false }, () => {
  let server: http.Server;
  let baseUrl: string;
  let db: DatabaseService;
  let merchantToken: string;
  let adminToken: string;
  let createdOrderId: string;
  let uploadedStorageKey: string;

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

    // Obtain merchant auth token
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@campusprint.in', password: 'DemoOwnerPassword123!' }),
    });
    const loginData = await loginRes.json();
    merchantToken = loginData.token;

    // Obtain platform admin auth token
    const adminLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@inklly.com', password: 'DemoPlatformPassword123!' }),
    });
    const adminLoginData = await adminLoginRes.json();
    adminToken = adminLoginData.token;
  });

  after(() => {
    server.close();
    db.close();
  });

  // ─────────────────────────────────────────────────────────────
  // STEP 1: MERCHANT ONBOARDING & HARDWARE PRINTER SETUP
  // ─────────────────────────────────────────────────────────────
  it('Step 1: Merchant registers and configures hardware printer (Canon LBP2900)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/merchant/printers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({
        name: 'Canon LBP2900 (High-Speed USB Laser)',
        systemDriverName: 'Canon LBP2900',
        supportsColor: false,
        supportsDuplex: false,
        trays: [{ name: 'Main Paper Cassette', supportedSizes: ['A4', 'PLAIN'], isDefault: true }],
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.name, 'Canon LBP2900 (High-Speed USB Laser)');
    assert.equal(body.systemDriverName, 'Canon LBP2900');
  });

  // ─────────────────────────────────────────────────────────────
  // STEP 2: CUSTOMER PORTAL DISCOVERY & DETERMINISTIC QUOTE
  // ─────────────────────────────────────────────────────────────
  it('Step 2: Customer accesses QR Portal, uploads document, and calculates quote in integer Paise', async () => {
    // 2a. Shop discovery
    const shopRes = await fetch(`${baseUrl}/api/v1/portal/shop/campus1`);
    assert.equal(shopRes.status, 200);
    const shop = await shopRes.json();
    assert.equal(shop.shopCode, 'campus1');

    const uploadRes = await fetch(`${baseUrl}/api/v1/portal/upload`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: 'shop-campus-1', fileName: 'Annual_Project_Dissertation.pdf', fileData: Buffer.from('%PDF-1.4\n%%EOF').toString('base64'), pageCount: 20 }),
    });
    assert.equal(uploadRes.status, 201);
    uploadedStorageKey = (await uploadRes.json() as any).storageKey;

    // 2b. Deterministic Quote calculation
    // 20 pages B&W simplex, 2 copies
    const quoteRes = await fetch(`${baseUrl}/api/v1/portal/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: 'shop-campus-1',
        files: [
          {
            fileId: 'doc-e2e-01',
            fileName: 'Annual_Project_Dissertation.pdf',
            pageCount: 20,
            options: {
              colorMode: 'bw',
              duplexMode: 'simplex',
              paperSize: 'A4',
              orientation: 'portrait',
              copies: 2,
              fitMode: 'fit',
              pagesPerSheet: 1,
              collation: true,
            },
          },
        ],
      }),
    });

    assert.equal(quoteRes.status, 200);
    const quote = await quoteRes.json();
    // 20 pages simplex @ ₹2.00 (200 paise) = 4000 paise * 2 copies = 8000 paise (₹80.00)
    assert.equal(quote.totalPaise, 8000);
    assert.ok(quote.lineItems.length === 1);
  });

  // ─────────────────────────────────────────────────────────────
  // STEP 3: CUSTOMER SUBMITS PRINT ORDER (AUTOMATIC WORKFLOW TRIGGER)
  // ─────────────────────────────────────────────────────────────
  it('Step 3: Customer submits an uploaded print order for cash on collection', async () => {
    const submitRes = await fetch(`${baseUrl}/api/v1/portal/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: 'shop-campus-1',
        customerName: 'Priya Nair',
        customerPhone: '+91 98765 88990',
        paymentMethod: 'CASH_ON_COLLECTION',
        quote: {
          totalPaise: 8000,
          quoteVersion: 'q-v2',
        },
        files: [
          {
            fileName: 'Annual_Project_Dissertation.pdf',
            storageKey: uploadedStorageKey,
            pageCount: 20,
            options: {
              colorMode: 'bw',
              duplexMode: 'simplex',
              paperSize: 'A4',
              orientation: 'portrait',
              copies: 2,
              fitMode: 'fit',
              pagesPerSheet: 1,
              collation: true,
            },
            subtotalPaise: 8000,
          },
        ],
      }),
    });

    assert.equal(submitRes.status, 201);
    const orderData = await submitRes.json();
    assert.ok(orderData.orderId);
    assert.ok(orderData.orderNumber);

    createdOrderId = orderData.orderId;
  });

  // ─────────────────────────────────────────────────────────────
  // STEP 4: AUTOMATED PRINT SPOOLING TO CANON LBP2900
  // ─────────────────────────────────────────────────────────────
  it('Step 4: System dispatches automated print command transitioning order status to IN_PROGRESS', async () => {
    const printRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${createdOrderId}/print`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({
        printerName: 'Canon LBP2900',
      }),
    });

    assert.equal(printRes.status, 200);
    const printData = await printRes.json();
    assert.equal(printData.success, true);
    assert.equal(printData.order.status, 'IN_PROGRESS');
  });

  // ─────────────────────────────────────────────────────────────
  // STEP 5: EDGE PRINT AGENT QUEUE POLLING & LIFECYCLE
  // ─────────────────────────────────────────────────────────────
  it('Step 5: Edge Print Agent polls queue and updates order to READY_FOR_COLLECTION and COLLECTED', async () => {
    // Pair a real agent and authenticate its queue poll.
    const pairingRes = await fetch(`${baseUrl}/api/v1/merchant/agents/pairing-code`, { method: 'POST', headers: { Authorization: `Bearer ${merchantToken}` } });
    assert.equal(pairingRes.status, 201);
    const pairing = await pairingRes.json() as any;
    const enrollRes = await fetch(`${baseUrl}/api/v1/agent/enroll`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shopId: 'shop-campus-1', pairingCode: pairing.pairingCode, hostname: 'E2E-AGENT' }) });
    assert.equal(enrollRes.status, 201);
    const agent = await enrollRes.json() as any;
    const agentHeaders = { 'Content-Type': 'application/json', 'X-Agent-Id': agent.agentId, Authorization: `Bearer ${agent.agentSecret}` };

    // 5a. Authenticated agent polls pending tickets
    const pollRes = await fetch(`${baseUrl}/api/v1/agent/poll-commands`, { headers: agentHeaders });
    assert.equal(pollRes.status, 200);
    const tickets = await pollRes.json() as any[];
    const ticket = tickets.find((item) => item.correlationId === `corr-${createdOrderId}`);
    assert.ok(ticket, 'Agent should receive the submitted order ticket');
    const resultRes = await fetch(`${baseUrl}/api/v1/agent/command-result`, { method: 'POST', headers: agentHeaders, body: JSON.stringify({ jobId: ticket.jobId, attemptId: ticket.attemptId, status: 'PRINT_CONFIRMED', timestamp: new Date().toISOString() }) });
    assert.equal(resultRes.status, 200);

    // Successful agent confirmation moves the order to READY_FOR_COLLECTION.
    const readyRes = await fetch(`${baseUrl}/api/v1/portal/orders/${createdOrderId}`);
    assert.equal(readyRes.status, 200);
    const readyOrder = await readyRes.json();
    assert.equal(readyOrder.status, 'READY_FOR_COLLECTION');

    // 5c. Customer collects printed job: transition to COLLECTED
    const collectedRes = await fetch(`${baseUrl}/api/v1/merchant/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({
        status: 'COLLECTED',
      }),
    });

    assert.equal(collectedRes.status, 200);
    const collectedBody = await collectedRes.json();
    assert.equal(collectedBody.order.status, 'COLLECTED');

    // 5d. Public tracking query: confirmed COLLECTED
    const statusRes = await fetch(`${baseUrl}/api/v1/portal/orders/${createdOrderId}`);
    assert.equal(statusRes.status, 200);
    const finalOrder = await statusRes.json();
    assert.equal(finalOrder.status, 'COLLECTED');
    assert.equal(finalOrder.customerName, 'Priya Nair');
    assert.equal(finalOrder.totalAmountPaise, 8000);
  });

  // ─────────────────────────────────────────────────────────────
  // STEP 6: VERIFY MULTI-TIER PAID PLANS & SEEDED MERCHANTS
  // ─────────────────────────────────────────────────────────────
  it('Step 6: Verifies demo merchants and feature availability across all paid plans', async () => {
    // 6a. Starter Plan Merchant (₹99/mo)
    const starterRes = await fetch(`${baseUrl}/api/v1/portal/shop/quickprint99`);
    assert.equal(starterRes.status, 200);
    const starterShop = await starterRes.json();
    assert.equal(starterShop.shopCode, 'quickprint99');
    assert.equal(starterShop.name, 'QuickPrint Corner (Starter ₹99/mo)');

    // 6b. Growth Plan Yearly Merchant (₹159/mo)
    const hostelRes = await fetch(`${baseUrl}/api/v1/portal/shop/hostelprint`);
    assert.equal(hostelRes.status, 200);
    const hostelShop = await hostelRes.json();
    assert.equal(hostelShop.shopCode, 'hostelprint');
    assert.equal(hostelShop.name, 'Hostel FastPrint (Growth Yearly ₹159/mo)');

    // 6c. Pro Plan Merchant (₹499/mo)
    const metroRes = await fetch(`${baseUrl}/api/v1/portal/shop/metro-xerox`);
    assert.equal(metroRes.status, 200);
    const metroShop = await metroRes.json();
    assert.equal(metroShop.shopCode, 'metro-xerox');
    assert.equal(metroShop.name, 'Metro Xerox Hub (Pro ₹499/mo)');

    // 6d. Scale / Enterprise Plan Merchant (₹899/mo)
    const apexRes = await fetch(`${baseUrl}/api/v1/portal/shop/apex-univ`);
    assert.equal(apexRes.status, 200);
    const apexShop = await apexRes.json();
    assert.equal(apexShop.shopCode, 'apex-univ');
    assert.equal(apexShop.name, 'Apex University Print Network (Scale ₹899/mo)');
  });

  // ─────────────────────────────────────────────────────────────
  // STEP 7: VERIFY PLATFORM ADMIN PLAN CATALOG
  // ─────────────────────────────────────────────────────────────
  it('Step 7: Verifies Platform Admin Plan Catalog and Tier Specifications', async () => {
    const plansRes = await fetch(`${baseUrl}/api/v1/platform/plans`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(plansRes.status, 200);
    const plans = await plansRes.json();
    assert.ok(Array.isArray(plans));
    assert.ok(plans.length >= 3);

    const starter = plans.find((p: any) => p.tier.toLowerCase() === 'starter');
    const growth = plans.find((p: any) => p.tier.toLowerCase() === 'growth');

    assert.ok(starter, 'Starter plan must exist in catalog');
    assert.ok(growth, 'Growth plan must exist in catalog');
  });
});
