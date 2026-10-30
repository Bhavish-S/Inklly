import { Request, Response } from 'express';
import { SubscriptionPlan } from '@inklly/shared';
import { DatabaseService, LedgerRepository, UserRepository } from '@inklly/db';
import { PilotBillingService } from '../services/pilot-billing';
import { PlatformBillingProviderError, PlatformSubscriptionProvider, RazorpayPaymentResult } from '../services/platform-subscription-provider';
import * as crypto from 'node:crypto';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-starter',
    tier: 'STARTER',
    name: 'Inklly Starter',
    monthlyPricePaise: 49900,
    annualPricePaise: 499000,
    currency: 'INR',
    orderLimitMonthly: 500,
    printerLimit: 2,
    fileSizeMaxMB: 15,
    includedConversionCredits: 100,
    features: ['Single Shop QR', 'Web Customer Portal', 'Basic Queue', 'Cash on Delivery'],
  },
  {
    id: 'plan-growth',
    tier: 'GROWTH',
    name: 'Inklly Growth',
    monthlyPricePaise: 119900,
    annualPricePaise: 1199000,
    currency: 'INR',
    orderLimitMonthly: 2000,
    printerLimit: 5,
    fileSizeMaxMB: 50,
    includedConversionCredits: 500,
    features: ['Multi-printer Routing', 'WhatsApp Automation', 'Custom Rates & Discounts', 'Analytics'],
  },
  {
    id: 'plan-pro',
    tier: 'PRO',
    name: 'Inklly Pro (Multi-Counter)',
    monthlyPricePaise: 249900,
    annualPricePaise: 2499000,
    currency: 'INR',
    orderLimitMonthly: 10000,
    printerLimit: 15,
    fileSizeMaxMB: 150,
    includedConversionCredits: 2000,
    features: ['Desktop Agent Fast Spooling', 'Staff Role Management', 'Developer API Access', 'Priority SLA'],
  },
  {
    id: 'plan-scale',
    tier: 'SCALE',
    name: 'Inklly Enterprise / Campus',
    monthlyPricePaise: 699900,
    annualPricePaise: 6999000,
    currency: 'INR',
    orderLimitMonthly: 100000,
    printerLimit: 100,
    fileSizeMaxMB: 500,
    includedConversionCredits: 10000,
    features: ['Unlimited Orders', 'Dedicated Hardware Queue', 'Custom Integrations', 'Dedicated Account Manager'],
  },
];

export class SubscriptionController {
  private readonly pilotBilling: PilotBillingService;
  private readonly provider = new PlatformSubscriptionProvider();
  private readonly ledger: LedgerRepository;
  private readonly userRepo: UserRepository;
  constructor(private readonly db: DatabaseService) {
    this.pilotBilling = new PilotBillingService(db);
    this.ledger = new LedgerRepository(db);
    this.userRepo = new UserRepository(db);
  }

  public listPlans = (_req: Request, res: Response) => {
    res.json(SUBSCRIPTION_PLANS);
  };

  private currentAttemptView(row: any) {
    return {
      id: row.id,
      organizationId: row.organization_id,
      planId: row.plan_id,
      planTier: row.plan_tier,
      amountPaise: Number(row.amount_paise),
      currency: row.currency,
      status: row.status,
      providerOrderId: row.provider_order_id || null,
      providerPaymentId: row.provider_payment_id || null,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      failureCode: row.failure_code || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      capturedAt: row.captured_at || null,
    };
  }

  public billingReadiness = (req: Request, res: Response) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(403).json({ error: 'An organization owner account is required.' });
    const organization = this.db.queryOne<any>(`SELECT plan_status FROM organizations WHERE id = ?`, [organizationId]);
    const now = new Date().toISOString();
    const tariff = this.db.queryOne<any>(`SELECT id, monthly_base_paise, per_side_paise, included_sides, effective_from
      FROM subscription_billing_tariffs WHERE organization_id = ? AND effective_from <= ? ORDER BY effective_from DESC LIMIT 1`, [organizationId, now]);
    const readiness = this.provider.readiness();
    const active = this.db.queryOne<any>(`SELECT id, current_period_end FROM subscriptions WHERE organization_id = ? AND status = 'ACTIVE' AND current_period_end > ?
      ORDER BY created_at DESC LIMIT 1`, [organizationId, now]);
    return res.json({
      ...readiness,
      keyId: this.provider.getConfig()?.keyId || null,
      organizationStatus: organization?.plan_status || 'UNKNOWN',
      tariffConfigured: Boolean(tariff),
      monthlyBasePaise: tariff ? Number(tariff.monthly_base_paise) : null,
      perSidePaise: tariff ? Number(tariff.per_side_paise) : null,
      includedSides: tariff ? Number(tariff.included_sides) : null,
      tariffEffectiveFrom: tariff?.effective_from || null,
      activeSubscriptionEndsAt: active?.current_period_end || null,
      checkoutAvailable: Boolean(organization && tariff && Number(tariff.monthly_base_paise) > 0 && readiness.checkoutReady && !active),
      usageStatementsRemainManual: true,
    });
  };

  public billingAttempts = (req: Request, res: Response) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(403).json({ error: 'An organization owner account is required.' });
    const rows = this.db.query<any>(`SELECT * FROM platform_subscription_payment_attempts WHERE organization_id = ? ORDER BY created_at DESC LIMIT 20`, [organizationId]);
    return res.json(rows.map((row) => this.currentAttemptView(row)));
  };

  public platformBillingAttempts = (req: Request, res: Response) => {
    const organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const rows = organizationId
      ? this.db.query<any>(`SELECT * FROM platform_subscription_payment_attempts WHERE organization_id = ? ORDER BY created_at DESC LIMIT 100`, [organizationId])
      : this.db.query<any>(`SELECT * FROM platform_subscription_payment_attempts ORDER BY created_at DESC LIMIT 100`);
    return res.json(rows.map((row) => this.currentAttemptView(row)));
  };

  public reconcilePlatformBillingAttempt = async (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    const attempt = this.db.queryOne<any>(`SELECT * FROM platform_subscription_payment_attempts WHERE id = ?`, [id]);
    if (!attempt) return res.status(404).json({ error: 'Subscription billing attempt not found.' });
    if (!this.provider.getConfig()) return res.status(503).json({ error: 'Platform Razorpay credentials are not configured.' });

    let providerOrderId = attempt.provider_order_id as string | null;
    const suppliedOrderId = typeof req.body?.providerOrderId === 'string' ? req.body.providerOrderId.trim() : '';
    const paymentId = typeof req.body?.providerPaymentId === 'string' ? req.body.providerPaymentId.trim() : '';
    const staleCreating = attempt.status === 'CREATING' && Date.now() - Date.parse(attempt.updated_at) >= 2 * 60 * 1000;
    if (attempt.status === 'CREATING' && !staleCreating) {
      return res.status(409).json({ error: 'Checkout creation is still within its processing window. Retry reconciliation after two minutes if it remains unresolved.' });
    }
    if (attempt.status === 'CREATE_UNCERTAIN' || staleCreating) {
      if (!suppliedOrderId) return res.status(400).json({ error: 'Provide the Razorpay order ID found by matching this attempt receipt in the Inklly platform Razorpay account.' });
      let order;
      try { order = await this.provider.fetchOrder(suppliedOrderId); }
      catch (error) { return res.status(503).json({ error: error instanceof Error ? error.message : 'Razorpay order lookup is unavailable.' }); }
      if (!order || order.id !== suppliedOrderId || order.receipt !== attempt.id || order.amount !== Number(attempt.amount_paise) || order.currency !== attempt.currency) {
        return res.status(409).json({ error: 'Razorpay order does not match this attempt receipt, amount, or currency. No subscription was activated.' });
      }
      try {
        const associated = this.db.queryOne<any>(`UPDATE platform_subscription_payment_attempts SET provider_order_id = ?, status = 'PENDING', failure_code = NULL, updated_at = ?
          WHERE id = ? AND status IN ('CREATE_UNCERTAIN', 'CREATING') RETURNING id`, [suppliedOrderId, new Date().toISOString(), id]);
        if (!associated) return res.status(409).json({ error: 'Attempt state changed during reconciliation. Reload and review its current state.' });
        providerOrderId = suppliedOrderId;
      } catch {
        return res.status(409).json({ error: 'That Razorpay order is already associated with another billing attempt.' });
      }
    }
    if (!providerOrderId) return res.status(409).json({ error: 'This attempt has no verified Razorpay order ID.' });
    if (!paymentId) {
      const updated = this.db.queryOne<any>(`SELECT * FROM platform_subscription_payment_attempts WHERE id = ?`, [id]);
      return res.json({ success: true, attempt: this.currentAttemptView(updated), paymentStillRequiresCapture: true });
    }

    let payment;
    try { payment = await this.provider.fetchPayment(paymentId); }
    catch (error) { return res.status(503).json({ error: error instanceof Error ? error.message : 'Razorpay payment lookup is unavailable.' }); }
    if (!payment || payment.order_id !== providerOrderId || payment.amount !== Number(attempt.amount_paise) || payment.currency !== attempt.currency || payment.status !== 'captured' || payment.captured !== true) {
      this.db.transaction(() => {
        this.db.execute(`UPDATE platform_subscription_payment_attempts SET status = 'RECONCILIATION_REQUIRED', failure_code = 'ADMIN_RECONCILIATION_MISMATCH', updated_at = ?
          WHERE id = ? AND status IN ('PENDING', 'CREATE_UNCERTAIN', 'RECONCILIATION_REQUIRED')`, [new Date().toISOString(), id]);
        this.userRepo.logAuditEvent({
          id: crypto.randomUUID(), actorUserId: req.user?.userId, actorRole: req.user?.role,
          organizationId: attempt.organization_id, action: 'PLATFORM_SUBSCRIPTION_PAYMENT_RECONCILIATION_REJECTED',
          targetType: 'SUBSCRIPTION_PAYMENT_ATTEMPT', targetId: id, outcome: 'FAILED', ipAddress: req.ip,
          details: { providerOrderId, providerPaymentId: paymentId }, createdAt: new Date().toISOString(),
        });
      });
      return res.status(409).json({ error: 'Razorpay payment is not a captured payment matching this attempt. Subscription remains unchanged.' });
    }

    const result = await this.applyCapturedPayment({
      attempt: { ...attempt, provider_order_id: providerOrderId }, payment,
      eventId: `admin-reconcile:${id}:${payment.id}`, eventType: 'ADMIN_RECONCILIATION',
      payloadHash: crypto.createHash('sha256').update(JSON.stringify(payment)).digest('hex'),
    });
    if (result === 'REJECTED' || result === 'REPLAY') return res.status(409).json({ error: 'Captured payment could not be safely applied. Review the billing event history.' });
    this.userRepo.logAuditEvent({
      id: crypto.randomUUID(), actorUserId: req.user?.userId, actorRole: req.user?.role,
      organizationId: attempt.organization_id, action: 'PLATFORM_SUBSCRIPTION_PAYMENT_RECONCILED',
      targetType: 'SUBSCRIPTION_PAYMENT_ATTEMPT', targetId: id, outcome: 'SUCCESS', ipAddress: req.ip,
      details: { providerOrderId, providerPaymentId: payment.id, result }, createdAt: new Date().toISOString(),
    });
    const updated = this.db.queryOne<any>(`SELECT * FROM platform_subscription_payment_attempts WHERE id = ?`, [id]);
    return res.json({ success: true, duplicate: result === 'DUPLICATE_PAYMENT', attempt: this.currentAttemptView(updated) });
  };

  private addOneMonth(date: Date): Date {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const targetMonth = month + 1;
    const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
    const day = Math.min(date.getUTCDate(), lastDay);
    return new Date(Date.UTC(year, targetMonth, day, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
  }

  private async applyCapturedPayment(input: {
    attempt: any;
    payment: RazorpayPaymentResult;
    eventId: string;
    eventType: string;
    payloadHash: string;
  }): Promise<'APPLIED' | 'DUPLICATE_PAYMENT' | 'REPLAY' | 'REJECTED'> {
    const now = new Date().toISOString();
    return this.db.transaction(() => {
      const current = this.db.queryOne<any>(`SELECT * FROM platform_subscription_payment_attempts WHERE id = ?`, [input.attempt.id]);
      if (!current) return 'REJECTED';
      const paymentMatches = input.payment.order_id === current.provider_order_id && input.payment.amount === Number(current.amount_paise) &&
        input.payment.currency === current.currency && input.payment.status === 'captured' && input.payment.captured === true;
      let outcome: 'APPLIED' | 'DUPLICATE_PAYMENT' | 'REJECTED' = 'APPLIED';
      if (current.status === 'VERIFIED') {
        outcome = current.provider_payment_id === input.payment.id && paymentMatches ? 'DUPLICATE_PAYMENT' : 'REJECTED';
      } else if (current.status !== 'PENDING' || !paymentMatches) {
        outcome = 'REJECTED';
      }

      const insertedEvent = this.db.queryOne<any>(`INSERT INTO platform_subscription_payment_events
        (id, provider_event_id, billing_attempt_id, event_type, outcome, provider_order_id, provider_payment_id, amount_paise, currency, payload_sha256, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (provider_event_id) DO NOTHING RETURNING id`,
      [crypto.randomUUID(), input.eventId, input.attempt.id, input.eventType, outcome, input.payment.order_id, input.payment.id, input.payment.amount, input.payment.currency, input.payloadHash, now]);
      if (!insertedEvent) return 'REPLAY';
      if (outcome === 'DUPLICATE_PAYMENT') return outcome;
      if (outcome === 'REJECTED') {
        if (current.status === 'PENDING' && !paymentMatches) {
          this.db.execute(`UPDATE platform_subscription_payment_attempts SET status = 'RECONCILIATION_REQUIRED', failure_code = 'PROVIDER_PAYMENT_MISMATCH', updated_at = ? WHERE id = ? AND status = 'PENDING'`, [now, current.id]);
        }
        return outcome;
      }

      const updated = this.db.queryOne<any>(`UPDATE platform_subscription_payment_attempts
        SET status = 'VERIFIED', provider_payment_id = ?, failure_code = NULL, updated_at = ?, captured_at = ?
        WHERE id = ? AND status = 'PENDING' RETURNING id`, [input.payment.id, now, now, current.id]);
      if (!updated) throw new Error('Subscription billing attempt changed while applying a captured payment.');

      const existingLedger = this.db.queryOne<any>(`SELECT domain, organization_id, amount_paise, currency FROM ledger_entries
        WHERE provider = 'RAZORPAY' AND provider_transaction_id = ?`, [input.payment.id]);
      if (existingLedger) {
        if (existingLedger.domain !== 'SAAS_SUBSCRIPTION' || existingLedger.organization_id !== current.organization_id ||
            Number(existingLedger.amount_paise) !== Number(current.amount_paise) || existingLedger.currency !== current.currency) {
          throw new Error('Razorpay transaction is already allocated to a different financial record.');
        }
      } else {
        this.ledger.appendEntry({
          id: `led-saas-${crypto.randomUUID()}`,
          domain: 'SAAS_SUBSCRIPTION',
          organizationId: current.organization_id,
          amountPaise: Number(current.amount_paise),
          currency: current.currency,
          provider: 'RAZORPAY',
          providerTransactionId: input.payment.id,
          providerEventId: input.eventId,
          description: `Inklly ${current.plan_tier} subscription payment`,
          metadata: { billingAttemptId: current.id, planId: current.plan_id, tariffId: current.tariff_id },
          createdAt: now,
        });
      }

      const existingSubscription = this.db.queryOne<any>(`SELECT id FROM subscriptions WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1`, [current.organization_id]);
      if (existingSubscription) {
        this.db.execute(`UPDATE subscriptions SET plan_id = ?, plan_tier = ?, status = 'ACTIVE', current_period_start = ?, current_period_end = ?,
          cancel_at_period_end = 0, provider_subscription_id = NULL, amount_paise = ?, currency = 'INR', updated_at = ? WHERE id = ?`,
        [current.plan_id, current.plan_tier, current.period_start, current.period_end, Number(current.amount_paise), now, existingSubscription.id]);
      } else {
        this.db.execute(`INSERT INTO subscriptions (id, organization_id, plan_id, plan_tier, status, current_period_start, current_period_end,
          cancel_at_period_end, provider_subscription_id, amount_paise, currency, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, 0, NULL, ?, 'INR', ?, ?)`,
        [`sub-${crypto.randomUUID()}`, current.organization_id, current.plan_id, current.plan_tier, current.period_start, current.period_end, Number(current.amount_paise), now, now]);
      }
      this.db.execute(`UPDATE organizations SET plan_tier = ?, plan_status = 'ACTIVE', updated_at = ? WHERE id = ?`, [current.plan_tier, now, current.organization_id]);
      return 'APPLIED';
    });
  }

  public createCheckout = async (req: Request, res: Response) => {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;
    if (!organizationId || !userId) return res.status(403).json({ error: 'An organization owner account is required.' });
    const idempotencyKey = String(req.header('idempotency-key') || '').trim();
    const planId = typeof req.body?.planId === 'string' ? req.body.planId : '';
    if (!/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey) || !planId) {
      return res.status(400).json({ error: 'A valid Idempotency-Key header and planId are required.' });
    }
    const plan = SUBSCRIPTION_PLANS.find((item) => item.id === planId);
    if (!plan) return res.status(400).json({ error: 'Unknown subscription plan.' });
    if (!this.provider.getConfig()) {
      return res.status(503).json({ code: 'PLATFORM_BILLING_UNAVAILABLE', error: 'Platform Razorpay billing is not configured. No charge or subscription change was made.' });
    }
    const requestFingerprint = crypto.createHash('sha256').update(planId).digest('hex');
    const prior = this.db.queryOne<any>(`SELECT * FROM platform_subscription_payment_attempts WHERE organization_id = ? AND idempotency_key = ?`, [organizationId, idempotencyKey]);
    if (prior) {
      if (prior.request_fingerprint !== requestFingerprint) return res.status(409).json({ error: 'This Idempotency-Key was already used for a different checkout request.' });
      if (prior.status === 'PENDING' && prior.provider_order_id) {
        return res.json({ success: true, duplicate: true, attempt: this.currentAttemptView(prior), razorpayOrderId: prior.provider_order_id, keyId: this.provider.getConfig()!.keyId, amount: Number(prior.amount_paise), currency: prior.currency });
      }
      if (prior.status === 'VERIFIED') return res.status(409).json({ error: 'This checkout has already been paid.', attempt: this.currentAttemptView(prior) });
      if (prior.status === 'CREATE_UNCERTAIN' || prior.status === 'RECONCILIATION_REQUIRED') return res.status(409).json({ error: 'This checkout requires reconciliation before another charge can be attempted.', attempt: this.currentAttemptView(prior) });
      if (prior.status === 'CREATING') return res.status(409).json({ error: 'This checkout is already being created. Retry with the same Idempotency-Key shortly.' });
      return res.status(409).json({ error: 'This checkout attempt failed. Use a new Idempotency-Key to retry.' });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const organization = this.db.queryOne<any>(`SELECT plan_status FROM organizations WHERE id = ?`, [organizationId]);
    if (!organization) return res.status(404).json({ error: 'Organization not found.' });
    if (organization.plan_status === 'SUSPENDED') return res.status(409).json({ error: 'A suspended organization cannot start subscription checkout.' });
    const activeSubscription = this.db.queryOne<any>(`SELECT current_period_end FROM subscriptions WHERE organization_id = ? AND status = 'ACTIVE'
      ORDER BY created_at DESC LIMIT 1`, [organizationId]);
    if (activeSubscription && Date.parse(activeSubscription.current_period_end) > now.getTime()) {
      return res.status(409).json({ error: 'An active subscription already covers this organization.' });
    }
    const openAttempt = this.db.queryOne<any>(`SELECT id, status FROM platform_subscription_payment_attempts
      WHERE organization_id = ? AND status IN ('CREATING', 'PENDING', 'CREATE_UNCERTAIN', 'RECONCILIATION_REQUIRED') ORDER BY created_at DESC LIMIT 1`, [organizationId]);
    if (openAttempt) return res.status(409).json({ error: 'Resolve the existing subscription checkout before starting another.', attemptId: openAttempt.id, status: openAttempt.status });

    const tariff = this.db.queryOne<any>(`SELECT id, monthly_base_paise FROM subscription_billing_tariffs
      WHERE organization_id = ? AND effective_from <= ? ORDER BY effective_from DESC LIMIT 1`, [organizationId, nowIso]);
    if (!tariff) return res.status(409).json({ error: 'No active pilot tariff is configured for this organization.' });
    const amountPaise = Number(tariff.monthly_base_paise);
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) return res.status(409).json({ error: 'The configured monthly base is zero. Paid checkout is unavailable for this tariff.' });

    const startsAt = now;
    const periodEnd = this.addOneMonth(startsAt);
    const attemptId = crypto.randomUUID();
    try {
      this.db.execute(`INSERT INTO platform_subscription_payment_attempts
        (id, organization_id, created_by_user_id, idempotency_key, request_fingerprint, plan_id, plan_tier, tariff_id, amount_paise,
         currency, period_start, period_end, provider, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, 'RAZORPAY', 'CREATING', ?, ?)`,
      [attemptId, organizationId, userId, idempotencyKey, requestFingerprint, plan.id, plan.tier, tariff.id, amountPaise, startsAt.toISOString(), periodEnd.toISOString(), nowIso, nowIso]);
    } catch (error) {
      // Database uniqueness is the serialization point for concurrent requests.
      // Never call Razorpay unless this request successfully reserved the org slot.
      const sameKey = this.db.queryOne<any>(`SELECT * FROM platform_subscription_payment_attempts WHERE organization_id = ? AND idempotency_key = ?`, [organizationId, idempotencyKey]);
      if (sameKey) {
        if (sameKey.request_fingerprint !== requestFingerprint) return res.status(409).json({ error: 'This Idempotency-Key was already used for a different checkout request.' });
        if (sameKey.status === 'PENDING' && sameKey.provider_order_id) {
          return res.json({ success: true, duplicate: true, attempt: this.currentAttemptView(sameKey), razorpayOrderId: sameKey.provider_order_id, keyId: this.provider.getConfig()!.keyId, amount: Number(sameKey.amount_paise), currency: sameKey.currency });
        }
        return res.status(409).json({ error: 'This checkout reservation already exists. Retry with the same Idempotency-Key shortly.', attempt: this.currentAttemptView(sameKey) });
      }
      const competing = this.db.queryOne<any>(`SELECT id, status FROM platform_subscription_payment_attempts WHERE organization_id = ? AND status IN ('CREATING', 'PENDING', 'CREATE_UNCERTAIN', 'RECONCILIATION_REQUIRED') ORDER BY created_at DESC LIMIT 1`, [organizationId]);
      if (competing) return res.status(409).json({ error: 'Another checkout reserved this organization. Resolve it before starting another.', attemptId: competing.id, status: competing.status });
      throw error;
    }
    let order;
    try {
      order = await this.provider.createOrder({ attemptId, amountPaise, organizationId });
    } catch (error) {
      const uncertain = error instanceof PlatformBillingProviderError && error.uncertain;
      this.db.execute(`UPDATE platform_subscription_payment_attempts SET status = ?, failure_code = ?, updated_at = ? WHERE id = ? AND status = 'CREATING'`,
        [uncertain ? 'CREATE_UNCERTAIN' : 'FAILED', uncertain ? 'PROVIDER_OUTCOME_UNCERTAIN' : 'PROVIDER_REJECTED', new Date().toISOString(), attemptId]);
      if (uncertain) return res.status(503).json({ code: 'CHECKOUT_RECONCILIATION_REQUIRED', error: 'Razorpay order creation outcome is uncertain. Do not retry this attempt automatically.' });
      return res.status(502).json({ error: 'Razorpay could not create subscription checkout. No subscription was activated.' });
    }
    try {
      const associated = this.db.queryOne<any>(`UPDATE platform_subscription_payment_attempts SET provider_order_id = ?, status = 'PENDING', updated_at = ? WHERE id = ? AND status = 'CREATING' RETURNING id`, [order.id, new Date().toISOString(), attemptId]);
      if (!associated) throw new Error('Billing attempt reservation changed before the Razorpay order was associated.');
    } catch {
      // Razorpay has already created a payable order. Treat a lost DB write as
      // uncertain so a new idempotency key cannot create a second charge.
      try {
        this.db.execute(`UPDATE platform_subscription_payment_attempts SET status = 'CREATE_UNCERTAIN', failure_code = 'ORDER_ASSOCIATION_UNCERTAIN', updated_at = ? WHERE id = ? AND status = 'CREATING'`, [new Date().toISOString(), attemptId]);
      } catch { /* keep the unique open-attempt reservation at CREATING */ }
      return res.status(503).json({ code: 'CHECKOUT_RECONCILIATION_REQUIRED', error: 'Razorpay created an order but it could not be associated safely. Do not retry with a new key; ask support to reconcile this checkout.' });
    }
    const attempt = this.db.queryOne<any>(`SELECT * FROM platform_subscription_payment_attempts WHERE id = ?`, [attemptId]);
    return res.status(201).json({ success: true, attempt: this.currentAttemptView(attempt), razorpayOrderId: order.id, keyId: this.provider.getConfig()!.keyId, amount: amountPaise, currency: 'INR' });
  };

  public verifySubscription = async (req: Request, res: Response) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(403).json({ error: 'An organization owner account is required.' });
    const orderId = typeof req.body?.razorpay_order_id === 'string' ? req.body.razorpay_order_id : '';
    const paymentId = typeof req.body?.razorpay_payment_id === 'string' ? req.body.razorpay_payment_id : '';
    const signature = typeof req.body?.razorpay_signature === 'string' ? req.body.razorpay_signature : '';
    if (!orderId || !paymentId || !signature) return res.status(400).json({ error: 'Razorpay checkout order, payment, and signature are required.' });
    const attempt = this.db.queryOne<any>(`SELECT * FROM platform_subscription_payment_attempts WHERE organization_id = ? AND provider_order_id = ?`, [organizationId, orderId]);
    if (!attempt) return res.status(404).json({ error: 'Subscription checkout not found for this organization.' });
    if (!this.provider.verifyCheckoutSignature(orderId, paymentId, signature)) return res.status(401).json({ error: 'Razorpay checkout signature is invalid.' });
    if (attempt.status === 'VERIFIED') {
      if (attempt.provider_payment_id !== paymentId) return res.status(409).json({ error: 'A different captured payment is already applied to this checkout.' });
      return res.json({ success: true, duplicate: true, attempt: this.currentAttemptView(attempt) });
    }
    if (attempt.status !== 'PENDING') return res.status(409).json({ error: 'This checkout is not awaiting payment confirmation.' });
    try {
      const payment = await this.provider.fetchPayment(paymentId);
      if (!payment || payment.order_id !== orderId || payment.amount !== Number(attempt.amount_paise) || payment.currency !== 'INR' || payment.status !== 'captured' || payment.captured !== true) {
        return res.status(409).json({ error: 'Razorpay has not confirmed a captured payment matching this checkout. Subscription remains unchanged.' });
      }
      const result = await this.applyCapturedPayment({
        attempt,
        payment,
        eventId: `checkout-verify:${payment.id}`,
        eventType: 'CHECKOUT_SIGNATURE_VERIFIED',
        payloadHash: crypto.createHash('sha256').update(JSON.stringify({ orderId, paymentId, amount: payment.amount, currency: payment.currency })).digest('hex'),
      });
      if (result === 'REJECTED') return res.status(409).json({ error: 'Captured payment could not be safely applied. This attempt requires reconciliation.' });
      const updated = this.db.queryOne<any>(`SELECT * FROM platform_subscription_payment_attempts WHERE id = ?`, [attempt.id]);
      return res.json({ success: true, duplicate: result === 'DUPLICATE_PAYMENT', attempt: this.currentAttemptView(updated) });
    } catch (error) {
      if (error instanceof PlatformBillingProviderError && error.uncertain) return res.status(503).json({ error: error.message });
      throw error;
    }
  };

  public razorpayWebhook = async (req: Request, res: Response) => {
    const rawBody = (req as any).rawBody as Buffer | undefined;
    const signature = req.header('x-razorpay-signature') || '';
    const providerEventId = req.header('x-razorpay-event-id') || '';
    if (!rawBody?.length || !providerEventId || providerEventId.length > 200 || /[\r\n]/.test(providerEventId)) {
      return res.status(400).json({ error: 'Razorpay subscription webhook requires its raw body and event identifier.' });
    }
    if (!this.provider.readiness().webhookReady) return res.status(503).json({ error: 'Platform Razorpay webhook verification is not configured.' });
    if (!this.provider.verifyWebhookSignature(rawBody, signature)) return res.status(401).json({ error: 'Razorpay subscription webhook signature is invalid.' });
    let event: any;
    try { event = JSON.parse(rawBody.toString('utf8')); } catch { return res.status(400).json({ error: 'Malformed Razorpay webhook body.' }); }
    const eventType = typeof event?.event === 'string' ? event.event : '';
    const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
    if (!['payment.captured', 'order.paid'].includes(eventType)) {
      const inserted = this.db.queryOne<any>(`INSERT INTO platform_subscription_payment_events
        (id, provider_event_id, billing_attempt_id, event_type, outcome, payload_sha256, created_at)
        VALUES (?, ?, NULL, ?, 'IGNORED', ?, ?) ON CONFLICT (provider_event_id) DO NOTHING RETURNING id`,
      [crypto.randomUUID(), providerEventId, eventType || 'UNKNOWN', payloadHash, new Date().toISOString()]);
      return res.status(200).json({ received: true, ignored: true, duplicate: !inserted });
    }
    const payment = event?.payload?.payment?.entity;
    if (!payment || payment.status !== 'captured' || typeof payment.id !== 'string' || typeof payment.order_id !== 'string' ||
        !Number.isSafeInteger(payment.amount) || typeof payment.currency !== 'string') {
      return res.status(400).json({ error: 'Razorpay webhook does not contain a valid captured payment.' });
    }
    const attempt = this.db.queryOne<any>(`SELECT * FROM platform_subscription_payment_attempts WHERE provider_order_id = ?`, [payment.order_id]);
    if (!attempt) {
      const inserted = this.db.queryOne<any>(`INSERT INTO platform_subscription_payment_events
        (id, provider_event_id, billing_attempt_id, event_type, outcome, provider_order_id, provider_payment_id, amount_paise, currency, payload_sha256, created_at)
        VALUES (?, ?, NULL, ?, 'IGNORED', ?, ?, ?, ?, ?, ?) ON CONFLICT (provider_event_id) DO NOTHING RETURNING id`,
      [crypto.randomUUID(), providerEventId, eventType, payment.order_id, payment.id, payment.amount, payment.currency, payloadHash, new Date().toISOString()]);
      return res.status(200).json({ received: true, ignored: true, duplicate: !inserted });
    }
    try {
      const result = await this.applyCapturedPayment({
        attempt,
        payment: { id: payment.id, order_id: payment.order_id, amount: payment.amount, currency: payment.currency, status: 'captured', captured: true },
        eventId: providerEventId,
        eventType,
        payloadHash,
      });
      return res.status(200).json({ received: true, applied: result === 'APPLIED' || result === 'DUPLICATE_PAYMENT', duplicate: result === 'REPLAY' || result === 'DUPLICATE_PAYMENT', reconciliationRequired: result === 'REJECTED' });
    } catch (error) {
      console.error('[Platform Razorpay subscription webhook]', error);
      return res.status(500).json({ error: 'Subscription payment event could not be applied. Razorpay may retry delivery.' });
    }
  };

  public usage = (req: Request, res: Response) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(403).json({ error: 'An organization owner account is required.' });
    const now = new Date().toISOString();
    const subscription = this.db.queryOne<any>(
      `SELECT current_period_start, current_period_end FROM subscriptions
       WHERE organization_id = ? AND status IN ('ACTIVE', 'TRIALING', 'GRACE')
         AND current_period_start <= ? AND current_period_end > ?
       ORDER BY created_at DESC LIMIT 1`,
      [organizationId, now, now]
    );
    const clock = new Date(now);
    const periodStart = subscription?.current_period_start || new Date(Date.UTC(clock.getUTCFullYear(), clock.getUTCMonth(), 1)).toISOString();
    const periodEnd = subscription?.current_period_end || new Date(Date.UTC(clock.getUTCFullYear(), clock.getUTCMonth() + 1, 1)).toISOString();
    const totals = this.db.queryOne<any>(
      `SELECT COUNT(*) AS confirmed_orders, COALESCE(SUM(confirmed_sides), 0) AS confirmed_sides
       FROM subscription_usage_events WHERE organization_id = ? AND created_at >= ? AND created_at < ?`,
      [organizationId, periodStart, periodEnd]
    );
    return res.json({
      periodStart,
      periodEnd,
      confirmedOrders: Number(totals?.confirmed_orders || 0),
      confirmedSides: Number(totals?.confirmed_sides || 0),
      meter: 'operator-confirmed selected document pages multiplied by copies',
      billingStatus: 'METERING_ONLY',
      chargeCreated: false,
    });
  };

  public invoices = (req: Request, res: Response) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(403).json({ error: 'An organization owner account is required.' });
    return res.json(this.pilotBilling.listInvoices(organizationId));
  };
}
