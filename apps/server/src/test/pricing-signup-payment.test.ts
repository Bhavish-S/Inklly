import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { createApp } from '../index';
import { DatabaseService } from '@inklly/db';
import * as crypto from 'node:crypto';

describe('Pricing, Signup Credentials & Razorpay Sandbox Payment', { concurrency: false }, () => {
  let server: http.Server;
  let baseUrl = '';
  let db: DatabaseService;

  before(async () => {
    process.env.NODE_ENV = 'test';
    db = new DatabaseService(':memory:');
    const app = createApp(db);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
  });

  it('lists all subscription plans with full monthly, annual and lifetime Paise pricing', async () => {
    const res = await fetch(`${baseUrl}/api/v1/subscriptions/plans`);
    assert.equal(res.status, 200);
    const plans = await res.json() as any[];
    assert.equal(Array.isArray(plans), true);
    assert.equal(plans.length, 5);

    const starter = plans.find((p) => p.id === 'plan-starter');
    assert.ok(starter);
    assert.equal(starter.tier, 'STARTER');
    assert.equal(starter.monthlyPricePaise, 9900);
    assert.equal(starter.annualPricePaise, 99900);

    const growth = plans.find((p) => p.id === 'plan-growth');
    assert.ok(growth);
    assert.equal(growth.tier, 'GROWTH');
    assert.equal(growth.monthlyPricePaise, 19900);
    assert.equal(growth.annualPricePaise, 199900);

    const pro = plans.find((p) => p.id === 'plan-pro');
    assert.ok(pro);
    assert.equal(pro.tier, 'PRO');
    assert.equal(pro.monthlyPricePaise, 49900);
    assert.equal(pro.annualPricePaise, 499900);

    const scale = plans.find((p) => p.id === 'plan-scale');
    assert.ok(scale);
    assert.equal(scale.tier, 'SCALE');
    assert.equal(scale.monthlyPricePaise, 89900);
    assert.equal(scale.annualPricePaise, 899900);

    const lifetime = plans.find((p) => p.id === 'plan-lifetime');
    assert.ok(lifetime);
    assert.equal(lifetime.monthlyPricePaise, 149900);
    assert.equal(lifetime.annualPricePaise, 149900);
  });

  it('creates a signup checkout order in sandbox test mode', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/signup-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: 'plan-growth',
        billingCycle: 'monthly',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.success, true);
    // No platform gateway is configured in tests, so local development gets a
    // simulated checkout; production would refuse (covered below).
    assert.equal(body.mode, 'SANDBOX');
    assert.equal(body.isSandbox, true);
    assert.ok(body.razorpayOrderId.startsWith('order_sandbox_'));
    assert.equal(body.amount, 19900);
    assert.equal(body.currency, 'INR');
    assert.equal(body.plan.id, 'plan-growth');
    assert.equal(body.plan.tier, 'GROWTH');
    assert.equal(body.plan.billingCycle, 'monthly');
  });

  it('completes signup with user credentials and activates paid subscription upon payment', async () => {
    const email = 'newowner@testprint.in';
    const password = 'SuperSecurePassword2026!';

    // Register with credentials and sandbox test payment
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerName: 'Sunil Rao',
        businessName: 'Sunil Digital Print Center',
        shopCode: 'sunil-prints',
        email,
        password,
        phone: '9876543210',
        address: 'MG Road, Camp',
        city: 'Pune',
        state: 'Maharashtra',
        pinCode: '411001',
        planId: 'plan-growth',
        billingCycle: 'monthly',
        paymentDetails: {
          provider: 'SANDBOX_TEST_KIT',
          razorpay_order_id: 'order_test_demo123',
          razorpay_payment_id: 'pay_test_demo456',
          testSimulated: true,
        },
      }),
    });

    if (regRes.status !== 201) {
      const errText = await regRes.text();
      console.error('Registration failed with:', regRes.status, errText);
    }
    assert.equal(regRes.status, 201);
    const regData = await regRes.json() as any;
    assert.equal(regData.success, true);
    assert.equal(regData.registrationComplete, true);
    assert.ok(regData.token);
    assert.equal(regData.user.email, email);
    assert.equal(regData.user.fullName, 'Sunil Rao');
    assert.equal(regData.user.role, 'MERCHANT_OWNER');
    assert.equal(regData.credentials.email, email);

    // Organization and subscription should be ACTIVE (not trial)
    assert.equal(regData.organization.planStatus, 'ACTIVE');
    assert.equal(regData.organization.planTier, 'GROWTH');
    assert.equal(regData.subscription.status, 'ACTIVE');
    assert.equal(regData.subscription.amountPaise, 19900);

    // Verify user can immediately sign in with their credentials
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json() as any;
    assert.ok(loginData.token);
    assert.equal(loginData.user.email, email);
    assert.equal(loginData.organization.planTier, 'GROWTH');

    // Verify ledger entry was created
    const ledger = db.query<any>(`SELECT * FROM ledger_entries WHERE organization_id = ?`, [regData.organizationId]);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].domain, 'SAAS_SUBSCRIPTION');
    assert.equal(Number(ledger[0].amount_paise), 19900);
    assert.equal(ledger[0].provider, 'RAZORPAY');

    // Verify billing attempt was recorded
    const attempt = db.query<any>(`SELECT * FROM platform_subscription_payment_attempts WHERE organization_id = ?`, [regData.organizationId]);
    assert.equal(attempt.length, 1);
    assert.equal(attempt[0].status, 'VERIFIED');
    assert.equal(attempt[0].plan_tier, 'GROWTH');
    assert.equal(Number(attempt[0].amount_paise), 19900);
  });

  it('completes lifetime plan signup with 149900 paise and activates lifetime access', async () => {
    const email = 'lifetimeowner@testprint.in';
    const password = 'SuperSecurePassword2026!';

    // 1. Checkout for lifetime
    const checkoutRes = await fetch(`${baseUrl}/api/v1/auth/signup-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: 'plan-lifetime',
        billingCycle: 'lifetime',
      }),
    });
    assert.equal(checkoutRes.status, 200);
    const checkout = await checkoutRes.json() as any;
    assert.equal(checkout.amount, 149900);
    assert.equal(checkout.plan.billingCycle, 'lifetime');
    assert.equal(checkout.plan.id, 'plan-lifetime');

    // 2. Register with lifetime payment
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerName: 'Priya Sharma',
        businessName: 'Priya Express Print',
        shopCode: 'priya-express',
        email,
        password,
        phone: '9822012345',
        address: 'FC Road',
        city: 'Pune',
        state: 'Maharashtra',
        pinCode: '411004',
        planId: 'plan-lifetime',
        billingCycle: 'lifetime',
        paymentDetails: {
          provider: 'SANDBOX_TEST_KIT',
          razorpay_order_id: checkout.razorpayOrderId,
          razorpay_payment_id: 'pay_test_lifetime123',
          testSimulated: true,
        },
      }),
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json() as any;
    assert.equal(regData.success, true);
    assert.equal(regData.subscription.status, 'ACTIVE');
    assert.equal(regData.subscription.amountPaise, 149900);

    // Verify current_period_end is > 50 years in future
    const sub = db.queryOne<any>(`SELECT * FROM subscriptions WHERE organization_id = ?`, [regData.organizationId]);
    assert.ok(sub);
    const endYear = new Date(sub.current_period_end).getFullYear();
    assert.ok(endYear > 2070, `Expected endYear > 2070, got ${endYear}`);
  });
  describe('paid signup requires a payment verified with Razorpay', () => {
    const keyEnv = { INKLLY_RAZORPAY_KEY_ID: 'rzp_test_signupKey1', INKLLY_RAZORPAY_KEY_SECRET: 'signup-secret-value', INKLLY_RAZORPAY_WEBHOOK_SECRET: 'signup-webhook-secret-1234' };
    const realFetch = globalThis.fetch;
    let razorpayPayment: any = null;

    before(() => {
      Object.assign(process.env, keyEnv);
      // Intercept only Razorpay API calls; requests to the test server pass through.
      globalThis.fetch = (async (input: any, init?: any) => {
        const url = String(input instanceof URL ? input.href : input?.url || input);
        if (url.startsWith('https://api.razorpay.com/v1/payments/')) {
          return razorpayPayment
            ? new Response(JSON.stringify(razorpayPayment), { status: 200, headers: { 'Content-Type': 'application/json' } })
            : new Response(JSON.stringify({ error: { code: 'BAD_REQUEST_ERROR' } }), { status: 400 });
        }
        return realFetch(input, init);
      }) as typeof fetch;
    });

    after(() => {
      globalThis.fetch = realFetch;
      for (const key of Object.keys(keyEnv)) delete process.env[key];
    });

    const sign = (orderId: string, paymentId: string) =>
      crypto.createHmac('sha256', keyEnv.INKLLY_RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
    const register = (email: string, paymentDetails: any, planId = 'plan-growth', billingCycle = 'monthly') => fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerName: 'Verify Owner', businessName: `Shop ${email}`, email, password: 'VerifyOwnerPass2026!', planId, billingCycle, paymentDetails }),
    });

    it('rejects a client-claimed simulated payment once a gateway is configured', async () => {
      const res = await register('forged-sim@testprint.in', { testSimulated: true, razorpay_payment_id: 'pay_forged123', razorpay_order_id: 'order_forged123' });
      assert.equal(res.status, 400);
      const created = db.queryOne<any>(`SELECT id FROM users WHERE email = ?`, ['forged-sim@testprint.in']);
      assert.equal(created, null);
    });

    it('rejects a payment whose signature does not match', async () => {
      const res = await register('forged-sig@testprint.in', { razorpay_order_id: 'order_abc12345', razorpay_payment_id: 'pay_abc12345', razorpay_signature: 'a'.repeat(64) });
      assert.equal(res.status, 402);
      assert.equal(db.queryOne<any>(`SELECT id FROM users WHERE email = ?`, ['forged-sig@testprint.in']), null);
    });

    it('rejects a genuine payment for a cheaper plan than the one requested', async () => {
      razorpayPayment = { id: 'pay_cheap12345', order_id: 'order_cheap12345', amount: 9900, currency: 'INR', status: 'captured', captured: true };
      const res = await register('cheap@testprint.in', { razorpay_order_id: 'order_cheap12345', razorpay_payment_id: 'pay_cheap12345', razorpay_signature: sign('order_cheap12345', 'pay_cheap12345') }, 'plan-lifetime', 'lifetime');
      assert.equal(res.status, 402);
      assert.equal(db.queryOne<any>(`SELECT id FROM users WHERE email = ?`, ['cheap@testprint.in']), null);
    });

    it('activates the plan for a verified captured payment and refuses to reuse it', async () => {
      razorpayPayment = { id: 'pay_good12345', order_id: 'order_good12345', amount: 19900, currency: 'INR', status: 'captured', captured: true };
      const details = { razorpay_order_id: 'order_good12345', razorpay_payment_id: 'pay_good12345', razorpay_signature: sign('order_good12345', 'pay_good12345') };
      const res = await register('verified@testprint.in', details);
      assert.equal(res.status, 201);
      const body = await res.json() as any;
      assert.equal(body.organization.planStatus, 'ACTIVE');
      assert.equal(body.organization.planTier, 'GROWTH');

      const replay = await register('replay@testprint.in', details);
      assert.equal(replay.status, 409);
      assert.equal(db.queryOne<any>(`SELECT id FROM users WHERE email = ?`, ['replay@testprint.in']), null);
    });
  });

  it('refuses simulated signup checkout and payment in production', async () => {
    process.env.NODE_ENV = 'production';
    try {
      const checkout = await fetch(`${baseUrl}/api/v1/auth/signup-checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: 'plan-growth', billingCycle: 'monthly' }),
      });
      assert.equal(checkout.status, 503);
      const reg = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerName: 'Prod Owner', businessName: 'Prod Shop', email: 'prod-sim@testprint.in', password: 'ProdOwnerPass2026!', planId: 'plan-lifetime', billingCycle: 'lifetime', paymentDetails: { testSimulated: true } }),
      });
      assert.equal(reg.status, 503);
      assert.equal(db.queryOne<any>(`SELECT id FROM users WHERE email = ?`, ['prod-sim@testprint.in']), null);
    } finally {
      process.env.NODE_ENV = 'test';
    }
  });
});
