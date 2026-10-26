import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { createApp } from '../index';
import { DatabaseService } from '@inklly/db';
import * as http from 'node:http';

describe('Inklly Backend API Integration Test Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  let db: DatabaseService;
  let merchantToken: string;
  let adminToken: string;

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
  });

  after(() => {
    server.close();
    db.close();
  });

  it('Health Check responds with HEALTHY status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'HEALTHY');
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
    assert.ok(orderData.orderId);
    assert.equal(orderData.status, 'AWAITING_REVIEW');

    // Query status
    const statusRes = await fetch(`${baseUrl}/api/v1/portal/orders/${orderData.orderId}`);
    assert.equal(statusRes.status, 200);
    const statusBody = await statusRes.json();
    assert.equal(statusBody.customerName, 'Priya Patel');
    assert.equal(statusBody.totalAmountPaise, 2000);
  });

  it('Authenticates merchant owner and returns JWT session payload', async () => {
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@campusprint.in', password: 'owner123' }),
    });

    assert.equal(loginRes.status, 200);
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
    // 1. Enroll
    const enrollRes = await fetch(`${baseUrl}/api/v1/agent/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: 'shop-campus-1',
        secretKey: 'agent-secret-key-123',
        hostname: 'POS-DESK-WIN11',
      }),
    });
    assert.equal(enrollRes.status, 201);
    const enrollData = await enrollRes.json();
    assert.ok(enrollData.agentId);

    // 2. Heartbeat
    const hbRes = await fetch(`${baseUrl}/api/v1/agent/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: enrollData.agentId,
        shopId: 'shop-campus-1',
        status: 'ONLINE',
        activePrintersCount: 2,
        localQueueDepth: 0,
      }),
    });
    assert.equal(hbRes.status, 200);

    // 3. Poll commands
    const pollRes = await fetch(`${baseUrl}/api/v1/agent/poll-commands?shopId=shop-campus-1`);
    assert.equal(pollRes.status, 200);
    const tickets = await pollRes.json();
    assert.ok(Array.isArray(tickets));

    if (tickets.length > 0) {
      const ticket = tickets[0];
      // Report Uncertain Output - safety invariant verification!
      const resultRes = await fetch(`${baseUrl}/api/v1/agent/command-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  it('Agent download endpoint generates Windows setup script and metadata', async () => {
    // 1. Script format (BAT download)
    const scriptRes = await fetch(`${baseUrl}/api/v1/agent/download?platform=win-x64&shopCode=campus1&format=script`);
    assert.equal(scriptRes.status, 200);
    assert.ok(scriptRes.headers.get('content-disposition')?.includes('Inklly-Agent-Setup-win-x64.bat'));
    const scriptText = await scriptRes.text();
    assert.ok(scriptText.includes('INKLLY EDGE PRINT AGENT'));
    assert.ok(scriptText.includes('campus1'));
    assert.ok(scriptText.includes('OUTPUT_UNCERTAIN'));

    // 2. Metadata format (JSON)
    const metaRes = await fetch(`${baseUrl}/api/v1/agent/download?platform=win-legacy-x86&shopCode=campus1&format=json`);
    assert.equal(metaRes.status, 200);
    const metaJson = await metaRes.json();
    assert.equal(metaJson.agentName, 'Inklly Edge Print Agent');
    assert.equal(metaJson.targetArch, 'x86 (32-bit)');
    assert.equal(metaJson.spoolerPort, 8765);

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
    const ordersRes = await fetch(`${baseUrl}/api/v1/merchant/orders`, {
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    const orders = await ordersRes.json();
    const targetOrder = orders[0];

    const cashRes = await fetch(`${baseUrl}/api/v1/payments/orders/${targetOrder.id}/collect-cash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${merchantToken}` },
    });

    assert.equal(cashRes.status, 200);
    const cashBody = await cashRes.json();
    assert.equal(cashBody.order.paymentStatus, 'VERIFIED');
  });

  it('Platform Owner Console returns system metrics and ledger', async () => {
    const res = await fetch(`${baseUrl}/api/v1/platform/overview`, {
      headers: {
        'x-user-role': 'PLATFORM_OWNER',
        'x-user-id': 'user-admin-1',
      },
    });

    assert.equal(res.status, 200);
    const overview = await res.json();
    assert.ok(overview.metrics.totalOrganizations >= 1);
    assert.ok(overview.metrics.totalShops >= 1);
    assert.equal(overview.health.apiStatus, 'HEALTHY');
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
});
