import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { makeTestPdf } from './test-pdf';
import { createApp } from '../index';
import { DatabaseService } from '@inklly/db';
import * as http from 'node:http';

describe('Milestone 1 Challenger Adversarial Stress Suite', { concurrency: false }, () => {
  let server: http.Server;
  let baseUrl: string;
  let db: DatabaseService;

  let tenant1Token: string;
  let tenant1ShopId: string;
  let tenant1OrderId: string;

  let tenant2Token: string;
  let tenant2ShopId: string;

  let platformAdminToken: string;

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

    // 0. Setup Platform Admin (needed to activate tenant subscriptions)
    const adminLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@inklly.com', password: 'DemoPlatformPassword123!' }),
    });
    const adminLoginData = await adminLoginRes.json();
    platformAdminToken = adminLoginData.token;

    // 1. Setup Tenant 1
    const reg1Res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: 'Alpha Print Org',
        shopName: 'Alpha Print Station',
        shopCode: 'alpha-station',
        ownerName: 'Alpha Owner',
        email: 'alpha@print.in',
        password: 'Password123!',
        phone: '+91 91111 22222',
        address: '101 Alpha St',
        city: 'Mumbai',
        state: 'Maharashtra',
        pinCode: '400001',
      }),
    });
    assert.equal(reg1Res.status, 201, 'Tenant 1 registration failed');
    const reg1Data = await reg1Res.json();
    assert.equal(reg1Data.registrationComplete, true);
    tenant1ShopId = reg1Data.shopId;

    // Activate tenant 1 subscription via platform admin
    await fetch(`${baseUrl}/api/v1/platform/merchants/${reg1Data.organizationId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${platformAdminToken}`,
      },
      body: JSON.stringify({
        planTier: 'STARTER',
        planStatus: 'ACTIVE',
        reason: 'Adversarial suite tenant 1 subscription activation',
      }),
    });

    // Log in as tenant 1 to get token
    const login1Res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alpha@print.in',
        password: 'Password123!',
      }),
    });
    assert.equal(login1Res.status, 200);
    tenant1Token = (await login1Res.json()).token;

    const uploadRes = await fetch(`${baseUrl}/api/v1/portal/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: tenant1ShopId,
        fileName: 'idor-check.pdf',
        fileData: makeTestPdf(2).toString('base64'),
        pageCount: 2,
      }),
    });
    assert.equal(uploadRes.status, 201);
    const uploadedFile = await uploadRes.json();

    // Create an order belonging to Tenant 1 using an actual shop-scoped upload.
    const order1Res = await fetch(`${baseUrl}/api/v1/portal/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: tenant1ShopId,
        customerName: 'Customer One',
        customerPhone: '+91 98888 77777',
        paymentMethod: 'CASH_ON_COLLECTION',
        quote: {
          quoteId: 'quote-test-1',
          quoteVersion: 'q-v1',
          totalPaise: 500,
          subtotalPaise: 500,
          bulkDiscountPaise: 0,
          lineItems: [],
        },
        files: [
          {
            fileId: 'file-1',
            fileName: 'sample.pdf',
            pageCount: 2,
            storageKey: uploadedFile.storageKey,
            options: {
              paperSize: 'A4',
              colorMode: 'bw',
              duplexMode: 'simplex',
              copies: 1,
            },
          },
        ],
      }),
    });
    assert.equal(order1Res.status, 201, 'Failed to create order for Tenant 1');
    const order1Data = await order1Res.json();
    tenant1OrderId = order1Data.orderId;

    // 2. Setup Tenant 2
    const reg2Res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: 'Beta Print Org',
        shopName: 'Beta Print Station',
        shopCode: 'beta-station',
        ownerName: 'Beta Owner',
        email: 'beta@print.in',
        password: 'Password123!',
        phone: '+91 92222 33333',
        address: '202 Beta Ave',
        city: 'Bangalore',
        state: 'Karnataka',
        pinCode: '560001',
      }),
    });
    assert.equal(reg2Res.status, 201, 'Tenant 2 registration failed');
    const reg2Data = await reg2Res.json();
    assert.equal(reg2Data.registrationComplete, true);
    tenant2ShopId = reg2Data.shopId;

    // Activate tenant 2 subscription via platform admin
    await fetch(`${baseUrl}/api/v1/platform/merchants/${reg2Data.organizationId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${platformAdminToken}`,
      },
      body: JSON.stringify({
        planTier: 'STARTER',
        planStatus: 'ACTIVE',
        reason: 'Adversarial suite tenant 1 subscription activation',
      }),
    });

    // Log in as tenant 2 to get token
    const login2Res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'beta@print.in',
        password: 'Password123!',
      }),
    });
    assert.equal(login2Res.status, 200);
    tenant2Token = (await login2Res.json()).token;
  });

  after(() => {
    server.close();
    db.close();
  });

  // =========================================================================
  // ATTACK VECTOR 1: Cross-Tenant IDOR & Tenancy Boundaries
  // =========================================================================
  describe('Adversarial IDOR & Multi-Tenant Attack Scenarios', { concurrency: false }, () => {
    it('IDOR 1.1: Tenant 2 cannot distinguish Tenant 1 order from a missing order', async () => {
      const res = await fetch(`${baseUrl}/api/v1/merchant/orders/${tenant1OrderId}`, {
        headers: { Authorization: `Bearer ${tenant2Token}` },
      });
      assert.equal(res.status, 404);
      assert.deepEqual(await res.json(), { error: 'Order not found' });
    });

    it('IDOR 1.2: Tenant 2 cannot mutate Tenant 1 order status or learn its existence', async () => {
      const res = await fetch(`${baseUrl}/api/v1/merchant/orders/${tenant1OrderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant2Token}`,
        },
        body: JSON.stringify({ status: 'COLLECTED' }),
      });
      assert.equal(res.status, 404);
      assert.deepEqual(await res.json(), { error: 'Order not found' });
    });

    it('IDOR 1.3: Tenant 2 cannot trigger print dispatch or learn foreign order existence', async () => {
      const res = await fetch(`${baseUrl}/api/v1/merchant/orders/${tenant1OrderId}/print`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tenant2Token}` },
      });
      assert.equal(res.status, 404);
      assert.deepEqual(await res.json(), { error: 'Order not found' });
    });

    it('IDOR 1.4: Tenant 2 cannot collect cash for Tenant 1 order via POST /payments/orders/:id/collect-cash (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/payments/orders/${tenant1OrderId}/collect-cash`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tenant2Token}` },
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.error, 'Order is not available to this shop.');
    });

    it('IDOR 1.5: Tenant 2 cannot view Tenant 1 dashboard via query param ?shopId= (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/merchant/dashboard?shopId=${tenant1ShopId}`, {
        headers: { Authorization: `Bearer ${tenant2Token}` },
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.ok(data.error.includes('Tenant isolation violation'));
    });

    it('IDOR 1.6: Tenant 2 cannot view Tenant 1 dashboard via spoofed x-shop-id header (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
        headers: {
          Authorization: `Bearer ${tenant2Token}`,
          'x-shop-id': tenant1ShopId,
        },
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.ok(data.error.includes('Tenant isolation violation'));
    });

    it('IDOR 1.7: Tenant 2 cannot view Tenant 1 order list via query param ?shopId= (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/merchant/orders?shopId=${tenant1ShopId}`, {
        headers: { Authorization: `Bearer ${tenant2Token}` },
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.ok(data.error.includes('Tenant isolation violation'));
    });

    it('IDOR 1.8: Unauthenticated request to /orders/:id is rejected with HTTP 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/v1/merchant/orders/${tenant1OrderId}`);
      assert.equal(res.status, 401);
    });

    it('IDOR 1.9: Platform Owner is granted legitimate cross-tenant oversight', async () => {
      const res = await fetch(`${baseUrl}/api/v1/merchant/orders/${tenant1OrderId}`, {
        headers: { Authorization: `Bearer ${platformAdminToken}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.id, tenant1OrderId);
      assert.equal(data.shopId, tenant1ShopId);
    });
  });

  // =========================================================================
  // ATTACK VECTOR 2: Expired & Malformed JWT Tokens
  // =========================================================================
  describe('Adversarial JWT Expiration & Tampering Scenarios', { concurrency: false }, () => {
    it('JWT 2.1: Rejects unsigned token with expired-looking payload', async () => {
      const payload = {
        userId: 'user-expired-1',
        email: 'exp1@test.in',
        role: 'MERCHANT_OWNER',
        shopId: tenant1ShopId,
        exp: Math.floor(Date.now() / 1000) - 1,
      };
      const token = Buffer.from(JSON.stringify(payload)).toString('base64');
      const res = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error, 'Invalid authentication token');
    });

    it('JWT 2.2: Rejects unsigned token with long-expired-looking payload', async () => {
      const payload = {
        userId: 'user-expired-30d',
        email: 'exp30d@test.in',
        role: 'MERCHANT_OWNER',
        shopId: tenant1ShopId,
        exp: Math.floor(Date.now() / 1000) - 86400 * 30,
      };
      const token = Buffer.from(JSON.stringify(payload)).toString('base64');
      const res = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error, 'Invalid authentication token');
    });

    it('JWT 2.3: Accepts a valid signed merchant session', async () => {
      const res = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
        headers: { Authorization: `Bearer ${tenant1Token}` },
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.shopId, tenant1ShopId);
    });

    it('JWT 2.4: Rejects malformed random string token with HTTP 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
        headers: { Authorization: 'Bearer not_a_valid_token_xyz!@#$%^' },
      });
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error, 'Invalid authentication token');
    });

    it('JWT 2.5: Rejects Base64 encoded non-JSON string with HTTP 401 Unauthorized', async () => {
      const rawBase64 = Buffer.from('Plain text that is not json at all').toString('base64');
      const res = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
        headers: { Authorization: `Bearer ${rawBase64}` },
      });
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error, 'Invalid authentication token');
    });

    it('JWT 2.6: Rejects empty Bearer token with HTTP 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/v1/merchant/dashboard`, {
        headers: { Authorization: 'Bearer ' },
      });
      assert.equal(res.status, 401);
    });
  });

  // =========================================================================
  // ATTACK VECTOR 3: Slug Collision Stress
  // =========================================================================
  describe('Adversarial Slug Collision & Sanitization Stress', { concurrency: false }, () => {
    it('SLUG 3.1: Successfully provisions first shop with slug "campus-print"', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: 'Campus Print',
          ownerName: 'Owner First',
          email: 'slugtest1@domain.in',
          password: 'Pass123!Safe',
        }),
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.shop.shopCode, 'campus-print');
    });

    it('SLUG 3.2: Collision 1 with hyphenated lowercase "campus-print" increments to "campus-print-1"', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: 'campus-print',
          ownerName: 'Owner Second',
          email: 'slugtest2@domain.in',
          password: 'Pass123!Safe',
        }),
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.shop.shopCode, 'campus-print-1');
    });

    it('SLUG 3.3: Collision 2 with uppercase "CAMPUS PRINT" increments to "campus-print-2"', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: 'CAMPUS PRINT',
          ownerName: 'Owner Third',
          email: 'slugtest3@domain.in',
          password: 'Pass123!Safe',
        }),
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.shop.shopCode, 'campus-print-2');
    });

    it('SLUG 3.4: Collision 3 with special characters "*** Campus   Print !!!" increments to "campus-print-3"', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: '*** Campus   Print !!!',
          ownerName: 'Owner Fourth',
          email: 'slugtest4@domain.in',
          password: 'Pass123!Safe',
        }),
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.shop.shopCode, 'campus-print-3');
    });

    it('SLUG 3.5: Explicit conflicting shopCode "campus-print" increments to "campus-print-4"', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: 'Different Display Name',
          shopCode: 'campus-print',
          ownerName: 'Owner Fifth',
          email: 'slugtest5@domain.in',
          password: 'Pass123!Safe',
        }),
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.shop.shopCode, 'campus-print-4');
    });

    it('SLUG 3.6: All provisioned collision slugs are resolvable via Customer Intake Portal without error', async () => {
      const slugs = ['campus-print', 'campus-print-1', 'campus-print-2', 'campus-print-3', 'campus-print-4'];
      for (const slug of slugs) {
        const res = await fetch(`${baseUrl}/api/v1/portal/shop/${slug}`);
        assert.equal(res.status, 200, `Failed to fetch portal for slug: ${slug}`);
        const shopData = await res.json();
        assert.equal(shopData.shopCode, slug);
        assert.ok(shopData.rates, `Rates missing for ${slug}`);
      }
    });

    it('SLUG 3.7: Degenerate shopName consisting only of symbols generates a valid fallback slug without crashing', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: '@@@ ### $$$ %%%',
          ownerName: 'Symbol Owner',
          email: 'symbols@domain.in',
          password: 'Pass123!Safe',
        }),
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.ok(body.shop.shopCode.startsWith('shop-'), `Expected fallback shop- code, got: ${body.shop.shopCode}`);
    });
  });

  // =========================================================================
  // ATTACK VECTOR 4: Duplicate Email Registration Handling
  // =========================================================================
  describe('Adversarial Duplicate Email Signup Scenarios', { concurrency: false }, () => {
    it('EMAIL 4.1: Registers base user with unique email', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: 'Unique Email Shop',
          ownerName: 'Target User',
          email: 'target-user@printsafe.in',
          password: 'Password123!',
        }),
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.user.email, 'target-user@printsafe.in');
    });

    it('EMAIL 4.2: Duplicate registration with exact email returns HTTP 409 Conflict', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: 'Another Shop Name',
          ownerName: 'Another Owner',
          email: 'target-user@printsafe.in',
          password: 'DifferentPassword123!',
        }),
      });
      assert.equal(res.status, 409);
      const body = await res.json();
      assert.ok(body.error.includes('already exists'));
    });

    it('EMAIL 4.3: Duplicate registration with UPPERCASE email returns HTTP 409 Conflict', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: 'Uppercase Attempt',
          ownerName: 'Another Owner',
          email: 'TARGET-USER@PRINTSAFE.IN',
          password: 'DifferentPassword123!',
        }),
      });
      assert.equal(res.status, 409);
      const body = await res.json();
      assert.ok(body.error.includes('already exists'));
    });

    it('EMAIL 4.4: Duplicate registration with whitespace-padded email returns HTTP 409 Conflict', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: 'Whitespace Attempt',
          ownerName: 'Another Owner',
          email: '   target-user@printsafe.in   ',
          password: 'DifferentPassword123!',
        }),
      });
      assert.equal(res.status, 409);
      const body = await res.json();
      assert.ok(body.error.includes('already exists'));
    });

    it('EMAIL 4.5: Registration with missing mandatory fields returns HTTP 400 Bad Request', async () => {
      const missingPayloads = [
        { ownerName: 'A', password: '123' }, // missing shopName and email
        { shopName: 'B', password: '123' }, // missing ownerName and email
        { shopName: 'C', ownerName: 'C', password: '123' }, // missing email
        { shopName: 'D', ownerName: 'D', email: 'd@d.in' }, // missing password
      ];

      for (const payload of missingPayloads) {
        const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400, `Expected 400 for payload: ${JSON.stringify(payload)}`);
        const body = await res.json();
        assert.ok(body.error.includes('Missing required'));
      }
    });
  });
});
