import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { createApp } from '../index';
import { DatabaseService } from '@inklly/db';

describe('Platform Razorpay subscription billing', { concurrency: false }, () => {
  let server: http.Server;
  let baseUrl = '';
  let db: DatabaseService;
  let ownerToken = '';
  let originalFetch: typeof globalThis.fetch;
  const originalEnv = new Map<string, string | undefined>();
  const envKeys = ['INKLLY_RAZORPAY_KEY_ID', 'INKLLY_RAZORPAY_KEY_SECRET', 'INKLLY_RAZORPAY_WEBHOOK_SECRET'] as const;
  let createOrderCalls = 0;
  let paymentFetchCalls = 0;
  let latestOrderId = '';
  let paymentResponse: any = null;

  const hmac = (secret: string, value: string | Buffer) => crypto.createHmac('sha256', secret).update(value).digest('hex');
  const providerConfig = () => {
    process.env.INKLLY_RAZORPAY_KEY_ID = 'rzp_test_inkllyplatform123';
    process.env.INKLLY_RAZORPAY_KEY_SECRET = 'test_platform_api_secret_123';
    process.env.INKLLY_RAZORPAY_WEBHOOK_SECRET = 'test_platform_webhook_secret_123';
  };
  const platformOwnerHeaders = (extra: Record<string, string> = {}) => ({
    'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}`, ...extra,
  });
  const createCheckout = (idempotencyKey: string) => fetch(`${baseUrl}/api/v1/subscriptions/checkout`, {
    method: 'POST', headers: platformOwnerHeaders({ 'Idempotency-Key': idempotencyKey }),
    body: JSON.stringify({ planId: 'plan-starter', organizationId: 'attacker-org', amountPaise: 1 }),
  });

  before(async () => {
    process.env.NODE_ENV = 'test';
    for (const key of envKeys) originalEnv.set(key, process.env[key]);
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://api.razorpay.com/v1/orders') {
        createOrderCalls += 1;
        const body = JSON.parse(String(init?.body || '{}'));
        latestOrderId = `order_platform_${createOrderCalls}`;
        return Response.json({ id: latestOrderId, amount: body.amount, currency: body.currency, receipt: body.receipt }, { status: 200 });
      }
      if (url.startsWith('https://api.razorpay.com/v1/payments/')) {
        paymentFetchCalls += 1;
        return Response.json(paymentResponse, { status: paymentResponse?.httpStatus || 200 });
      }
      return originalFetch(input, init);
    }) as typeof globalThis.fetch;

    db = new DatabaseService(':memory:');
    const app = createApp(db);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@campusprint.in', password: 'DemoOwnerPassword123!' }),
    });
    assert.equal(login.status, 200);
    ownerToken = (await login.json() as any).token;
    const month = new Date();
    const effectiveFrom = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1)).toISOString();
    const now = new Date().toISOString();
    db.execute(`UPDATE organizations SET plan_status = 'TRIAL' WHERE id = 'org-campus-network'`);
    db.execute(`UPDATE subscriptions SET status = 'TRIALING' WHERE organization_id = 'org-campus-network'`);
    db.execute(`INSERT INTO subscription_billing_tariffs
      (id, organization_id, monthly_base_paise, per_side_paise, included_sides, currency, effective_from, created_by, created_at)
      VALUES ('tariff-platform-test', 'org-campus-network', 12000, 7, 100, 'INR', ?, 'user-owner-1', ?)`, [effectiveFrom, now]);
  });

  after(() => {
    server?.close();
    db?.close();
    if (originalFetch) globalThis.fetch = originalFetch;
    process.env.NODE_ENV = 'test';
    for (const key of envKeys) {
      const value = originalEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('fails closed without platform credentials and reports only readiness metadata', async () => {
    for (const key of envKeys) delete process.env[key];
    const status = await fetch(`${baseUrl}/api/v1/subscriptions/billing/readiness`, { headers: platformOwnerHeaders() });
    assert.equal(status.status, 200);
    const body = await status.json() as any;
    assert.equal(body.provider, 'RAZORPAY');
    assert.equal(body.checkoutReady, false);
    assert.equal(body.credentialsConfigured, false);
    assert.equal(body.webhookReady, false);
    assert.equal(body.monthlyBasePaise, 12000);
    assert.equal('secret' in body, false);
    assert.equal('webhookSecret' in body, false);

    const beforeCalls = createOrderCalls;
    const checkout = await createCheckout('no-config-checkout-0001');
    assert.equal(checkout.status, 503);
    assert.equal((await checkout.json() as any).code, 'PLATFORM_BILLING_UNAVAILABLE');
    assert.equal(createOrderCalls, beforeCalls);
    assert.equal(db.queryOne<any>(`SELECT COUNT(*) AS count FROM platform_subscription_payment_attempts`)?.count, 0);
    providerConfig();
  });

  it('serializes concurrent checkout reservations for same and different idempotency keys', async () => {
    providerConfig();
    const beforeCalls = createOrderCalls;
    const sameKey = 'platform-same-key-race-0001';
    const same = await Promise.all([createCheckout(sameKey), createCheckout(sameKey)]);
    assert.equal(createOrderCalls - beforeCalls, 1, 'one reservation may create only one Razorpay order');
    assert.ok(same.some((response) => response.status === 201));
    assert.ok(same.some((response) => response.status === 200 || response.status === 409));
    const sameAttempt = db.queryOne<any>(`SELECT * FROM platform_subscription_payment_attempts WHERE idempotency_key = ?`, [sameKey]);
    assert.equal(sameAttempt.status, 'PENDING');
    db.execute(`UPDATE platform_subscription_payment_attempts SET status = 'FAILED' WHERE id = ?`, [sameAttempt.id]);

    const callsBeforeDifferent = createOrderCalls;
    const different = await Promise.all([
      createCheckout('platform-different-key-race-0001'),
      createCheckout('platform-different-key-race-0002'),
    ]);
    assert.equal(createOrderCalls - callsBeforeDifferent, 1, 'unique open-attempt constraint prevents a second order for the organization');
    assert.equal(different.filter((response) => response.status === 201).length, 1);
    assert.equal(different.filter((response) => response.status === 409).length, 1);
    db.execute(`UPDATE platform_subscription_payment_attempts SET status = 'FAILED' WHERE idempotency_key LIKE 'platform-different-key-race-%'`);
  });

  it('binds checkout to the authenticated organization, deduplicates retries, and activates only after fetched captured payment', async () => {
    providerConfig();
    const providerCallsBeforeCheckout = createOrderCalls;
    const idempotencyKey = 'platform-checkout-test-0001';
    const checkout = await createCheckout(idempotencyKey);
    assert.equal(checkout.status, 201);
    const checkoutBody = await checkout.json() as any;
    assert.equal(checkoutBody.amount, 12000, 'client-supplied amount is ignored in favor of persisted tariff Paise');
    assert.equal(checkoutBody.currency, 'INR');
    assert.equal(checkoutBody.attempt.organizationId, 'org-campus-network', 'client cannot select a billing tenant');
    assert.equal(checkoutBody.attempt.status, 'PENDING');
    assert.equal(checkoutBody.attempt.providerOrderId, latestOrderId);
    assert.equal(createOrderCalls - providerCallsBeforeCheckout, 1);
    assert.equal(db.queryOne<any>(`SELECT plan_status FROM organizations WHERE id = 'org-campus-network'`)?.plan_status, 'TRIAL');

    const retry = await createCheckout(idempotencyKey);
    assert.equal(retry.status, 200);
    const retryBody = await retry.json() as any;
    assert.equal(retryBody.duplicate, true);
    assert.equal(retryBody.attempt.id, checkoutBody.attempt.id);
    assert.equal(retryBody.razorpayOrderId, checkoutBody.razorpayOrderId);
    assert.equal(createOrderCalls - providerCallsBeforeCheckout, 1, 'an idempotent retry must not create a second provider order');

    const conflictingRetry = await fetch(`${baseUrl}/api/v1/subscriptions/checkout`, {
      method: 'POST', headers: platformOwnerHeaders({ 'Idempotency-Key': idempotencyKey }),
      body: JSON.stringify({ planId: 'plan-growth' }),
    });
    assert.equal(conflictingRetry.status, 409);

    const paymentId = 'pay_platform_capture_001';
    const signature = hmac(process.env.INKLLY_RAZORPAY_KEY_SECRET!, `${latestOrderId}|${paymentId}`);
    const invalidSignature = await fetch(`${baseUrl}/api/v1/subscriptions/verify`, {
      method: 'POST', headers: platformOwnerHeaders(),
      body: JSON.stringify({ razorpay_order_id: latestOrderId, razorpay_payment_id: paymentId, razorpay_signature: '0'.repeat(64) }),
    });
    assert.equal(invalidSignature.status, 401);
    assert.equal(paymentFetchCalls, 0);

    paymentResponse = { id: paymentId, order_id: latestOrderId, amount: 12000, currency: 'INR', status: 'created', captured: false };
    const notCaptured = await fetch(`${baseUrl}/api/v1/subscriptions/verify`, {
      method: 'POST', headers: platformOwnerHeaders(),
      body: JSON.stringify({ razorpay_order_id: latestOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature }),
    });
    assert.equal(notCaptured.status, 409);
    assert.equal(db.queryOne<any>(`SELECT status FROM platform_subscription_payment_attempts WHERE id = ?`, [checkoutBody.attempt.id])?.status, 'PENDING');
    assert.equal(db.queryOne<any>(`SELECT plan_status FROM organizations WHERE id = 'org-campus-network'`)?.plan_status, 'TRIAL');

    paymentResponse = { id: paymentId, order_id: latestOrderId, amount: 12000, currency: 'INR', status: 'captured', captured: true };
    const verified = await fetch(`${baseUrl}/api/v1/subscriptions/verify`, {
      method: 'POST', headers: platformOwnerHeaders(),
      body: JSON.stringify({ razorpay_order_id: latestOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature }),
    });
    assert.equal(verified.status, 200);
    assert.equal((await verified.json() as any).attempt.status, 'VERIFIED');
    assert.equal(db.queryOne<any>(`SELECT plan_status FROM organizations WHERE id = 'org-campus-network'`)?.plan_status, 'ACTIVE');
    assert.equal(db.queryOne<any>(`SELECT status FROM subscriptions WHERE organization_id = 'org-campus-network' ORDER BY created_at DESC LIMIT 1`)?.status, 'ACTIVE');
    assert.equal(db.queryOne<any>(`SELECT COUNT(*) AS count FROM ledger_entries WHERE domain = 'SAAS_SUBSCRIPTION' AND provider_transaction_id = ?`, [paymentId])?.count, 1);

    const duplicateVerify = await fetch(`${baseUrl}/api/v1/subscriptions/verify`, {
      method: 'POST', headers: platformOwnerHeaders(),
      body: JSON.stringify({ razorpay_order_id: latestOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature }),
    });
    assert.equal(duplicateVerify.status, 200);
    assert.equal((await duplicateVerify.json() as any).duplicate, true);
    assert.equal(paymentFetchCalls, 2, 'a verified attempt is idempotent and does not fetch the payment again');
    assert.equal(db.queryOne<any>(`SELECT COUNT(*) AS count FROM ledger_entries WHERE domain = 'SAAS_SUBSCRIPTION' AND provider_transaction_id = ?`, [paymentId])?.count, 1);
  });

  it('applies signed webhook captures once and keeps webhook history append-only', async () => {
    providerConfig();
    const expired = new Date(Date.now() - 1000).toISOString();
    db.execute(`UPDATE subscriptions SET status = 'PAST_DUE', current_period_end = ? WHERE organization_id = 'org-campus-network'`, [expired]);
    db.execute(`UPDATE organizations SET plan_status = 'PAST_DUE' WHERE id = 'org-campus-network'`);
    const checkout = await createCheckout('platform-checkout-webhook-0002');
    assert.equal(checkout.status, 201);
    const checkoutBody = await checkout.json() as any;
    const eventBody = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_platform_webhook_002', order_id: checkoutBody.razorpayOrderId, amount: 12000, currency: 'INR', status: 'captured' } } },
    });
    const eventId = 'evt_platform_capture_002';
    const signature = hmac(process.env.INKLLY_RAZORPAY_WEBHOOK_SECRET!, eventBody);
    const webhook = () => fetch(`${baseUrl}/api/v1/subscriptions/webhook/razorpay`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature, 'x-razorpay-event-id': eventId }, body: eventBody,
    });
    const badWebhook = await fetch(`${baseUrl}/api/v1/subscriptions/webhook/razorpay`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': 'f'.repeat(64), 'x-razorpay-event-id': 'evt_bad_signature_002' }, body: eventBody,
    });
    assert.equal(badWebhook.status, 401);
    assert.equal(db.queryOne<any>(`SELECT COUNT(*) AS count FROM platform_subscription_payment_events`)?.count, 1, 'only the earlier checkout verification event is recorded');

    const first = await webhook();
    assert.equal(first.status, 200);
    assert.equal((await first.json() as any).applied, true);
    assert.equal(db.queryOne<any>(`SELECT status FROM platform_subscription_payment_attempts WHERE id = ?`, [checkoutBody.attempt.id])?.status, 'VERIFIED');
    assert.equal(db.queryOne<any>(`SELECT plan_status FROM organizations WHERE id = 'org-campus-network'`)?.plan_status, 'ACTIVE');
    assert.equal(db.queryOne<any>(`SELECT COUNT(*) AS count FROM ledger_entries WHERE provider_transaction_id = 'pay_platform_webhook_002' AND domain = 'SAAS_SUBSCRIPTION'`)?.count, 1);

    const duplicate = await webhook();
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json() as any).duplicate, true);
    assert.equal(db.queryOne<any>(`SELECT COUNT(*) AS count FROM platform_subscription_payment_events WHERE provider_event_id = ?`, [eventId])?.count, 1);
    assert.equal(db.queryOne<any>(`SELECT COUNT(*) AS count FROM ledger_entries WHERE provider_transaction_id = 'pay_platform_webhook_002' AND domain = 'SAAS_SUBSCRIPTION'`)?.count, 1);
    assert.throws(() => db.execute(`UPDATE platform_subscription_payment_events SET outcome = 'REJECTED' WHERE provider_event_id = ?`, [eventId]), /append-only/);
  });
});
