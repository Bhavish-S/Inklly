import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { createApp } from '../index';
import { DatabaseService } from '@inklly/db';

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
    assert.equal(body.mode, 'TEST');
    assert.equal(body.isSandbox, true);
    assert.ok(body.razorpayOrderId.startsWith('order_test_'));
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
});
