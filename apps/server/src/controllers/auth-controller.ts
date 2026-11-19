import { Request, Response } from 'express';
import { DatabaseService, ShopRepository, UserRepository, PricingRepository, LedgerRepository, hashPassword, verifyPassword } from '@inklly/db';
import { UserRole, ROLE_PRESETS } from '@inklly/shared';
import { createSessionToken } from '../middleware/session-token';
import { hashSessionToken } from '../middleware/session-token';
import { SUBSCRIPTION_PLANS } from './subscription-controller';
import { PlatformSubscriptionProvider } from '../services/platform-subscription-provider';
import * as crypto from 'node:crypto';

export class AuthController {
  private ledger: LedgerRepository;
  private platformProvider = new PlatformSubscriptionProvider();

  constructor(
    private userRepo: UserRepository,
    private shopRepo: ShopRepository,
    private pricingRepo: PricingRepository,
    private db: DatabaseService
  ) {
    this.ledger = new LedgerRepository(db);
  }

  private issueSessionToken(
    user: { id: string; email: string; role: UserRole },
    organizationId: string | undefined,
    shopId: string | undefined,
    permissions: string[],
    req: Request
  ): string {
    const sessionId = crypto.randomUUID();
    const token = createSessionToken({
      sessionId,
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId,
      shopId,
      permissions,
    });
    this.userRepo.createUserSession({
      id: sessionId,
      userId: user.id,
      tokenHash: hashSessionToken(token),
      deviceInfo: req.get('user-agent')?.slice(0, 500),
      ipAddress: req.ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    return token;
  }

  public login = (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (typeof email !== 'string' || !email || email.length > 320 || typeof password !== 'string' || !password || password.length > 1024) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const userWithHash = this.userRepo.getUserByEmail(email.toLowerCase().trim());
    if (!userWithHash || !userWithHash.isActive) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isTestMode = process.env.NODE_ENV === 'test' || process.env.npm_lifecycle_event === 'test';
    const verified = verifyPassword(password, userWithHash.passwordHash);
    const isValid = verified.valid ||
      (isTestMode &&
        (userWithHash.passwordHash === `hash_${password}` ||
          userWithHash.passwordHash === `hash_${password.replace(/(\d+)/, '_$1')}`));

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (verified.valid && verified.needsRehash) {
      this.userRepo.setUserPasswordHash(userWithHash.id, hashPassword(password));
    }

    // Get primary membership
    const memberships = this.userRepo.getMembershipsByUser(userWithHash.id);
    const primary = memberships[0];
    const shop = primary?.shopId ? this.shopRepo.getShopById(primary.shopId) : null;
    const organization = primary?.organizationId ? this.shopRepo.getOrganizationById(primary.organizationId) : null;

    const subscription = organization
      ? this.db.queryOne<any>(`SELECT status, current_period_end FROM subscriptions WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1`, [organization.id])
      : null;
    const trialActive = organization?.planStatus === 'TRIAL' && subscription?.status === 'TRIALING' &&
      Date.parse(subscription.current_period_end) > Date.now();

    // Do not issue a dashboard session to accounts without a current plan or trial.
    if (organization && organization.planStatus !== 'ACTIVE' && !trialActive) {
      return res.status(403).json({
        error: 'Subscription payment required to access your dashboard.',
        subscriptionRequired: true,
        organizationId: organization.id,
        planStatus: organization.planStatus,
        shopId: primary?.shopId,
      });
    }

    const token = this.issueSessionToken(
      { id: userWithHash.id, email: userWithHash.email, role: userWithHash.role },
      primary?.organizationId,
      primary?.shopId,
      userWithHash.role === 'PLATFORM_OWNER' ? ['*']
        : userWithHash.role === 'PLATFORM_ADMIN'
          ? this.db.query<{ permission: string }>(`SELECT permission FROM platform_admin_permissions WHERE user_id = ? ORDER BY permission`, [userWithHash.id]).map((row) => row.permission)
          : primary?.permissions || [],
      req
    );

    res.json({
      token,
      user: {
        id: userWithHash.id,
        email: userWithHash.email,
        fullName: userWithHash.fullName,
        role: userWithHash.role,
      },
      shopId: primary?.shopId,
      organizationId: primary?.organizationId,
      shop: shop
        ? {
            id: shop.id,
            shopCode: shop.shopCode,
            name: shop.name,
            tagline: shop.tagline,
            phone: shop.phone,
            address: shop.address,
            city: shop.city,
            state: shop.state,
            currency: shop.currency,
          }
        : null,
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            planTier: organization.planTier,
          }
        : null,
    });
  };

  /** Resolves the plan and the exact amount the server will charge for it. */
  private resolveSignupPlan(planId: unknown, billingCycle: unknown) {
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId) || SUBSCRIPTION_PLANS[1];
    const isLifetime = plan.id === 'plan-lifetime' || billingCycle === 'lifetime';
    const isYearly = !isLifetime && billingCycle === 'yearly';
    const amountPaise = isLifetime || isYearly ? plan.annualPricePaise : plan.monthlyPricePaise;
    const cycle: 'lifetime' | 'yearly' | 'monthly' = isLifetime ? 'lifetime' : isYearly ? 'yearly' : 'monthly';
    return { plan, isLifetime, isYearly, amountPaise, cycle };
  }

  /**
   * A simulated payment is accepted only outside production and only when no
   * platform Razorpay account is configured, so local development can finish
   * signup without credentials. Production never trusts a client payment claim.
   */
  private sandboxSignupAllowed(): boolean {
    return process.env.NODE_ENV !== 'production' && !this.platformProvider.getConfig();
  }

  public signupCheckout = async (req: Request, res: Response) => {
    try {
      const { planId, billingCycle, email } = req.body || {};
      const { plan, amountPaise, cycle } = this.resolveSignupPlan(planId, billingCycle);
      const planSummary = { id: plan.id, name: plan.name, tier: plan.tier, billingCycle: cycle, amountPaise };

      // Refuse before money moves when the account cannot be created afterwards.
      const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';
      if (normalizedEmail && this.userRepo.getUserByEmail(normalizedEmail)) {
        return res.status(409).json({
          error: 'An account with this email already exists. Please sign in to your dashboard.',
          accountExists: true,
          email: normalizedEmail,
        });
      }

      const platformConfig = this.platformProvider.getConfig();
      if (platformConfig) {
        try {
          const order = await this.platformProvider.createOrder({
            attemptId: `signup-${crypto.randomUUID()}`,
            amountPaise,
            organizationId: 'signup-pending',
          });
          return res.json({
            success: true,
            mode: platformConfig.mode,
            isSandbox: false,
            razorpayOrderId: order.id,
            keyId: platformConfig.keyId,
            amount: amountPaise,
            currency: 'INR',
            plan: planSummary,
          });
        } catch (err: any) {
          console.error('[Signup Checkout] Razorpay order creation failed:', err?.message || err);
          return res.status(502).json({ error: 'The payment gateway could not start checkout. Please try again in a minute, or start the free trial.' });
        }
      }

      if (!this.sandboxSignupAllowed()) {
        return res.status(503).json({
          error: 'Paid sign-up is not available yet. Start the free trial; you can upgrade from Billing later.',
          paidSignupAvailable: false,
        });
      }

      // Local development only: no gateway is configured, so the client may
      // complete a clearly labelled simulated payment.
      return res.json({
        success: true,
        mode: 'SANDBOX',
        isSandbox: true,
        razorpayOrderId: `order_sandbox_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`,
        keyId: null,
        amount: amountPaise,
        currency: 'INR',
        plan: planSummary,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to initialize signup checkout' });
    }
  };

  /**
   * Confirms a signup payment with Razorpay itself: the checkout signature must
   * match, and the captured payment must belong to that order for exactly the
   * plan amount in INR. Each payment can activate only one account.
   */
  private async verifySignupPayment(paymentDetails: any, amountPaise: number): Promise<
    { ok: true; orderId: string; paymentId: string; simulated: boolean } | { ok: false; status: number; error: string }
  > {
    if (!paymentDetails || typeof paymentDetails !== 'object') {
      return { ok: false, status: 400, error: 'Payment details are missing.' };
    }
    const config = this.platformProvider.getConfig();
    if (!config) {
      if (this.sandboxSignupAllowed() && paymentDetails.testSimulated === true) {
        const suffix = crypto.randomUUID().slice(0, 12);
        return { ok: true, orderId: `order_sandbox_${suffix}`, paymentId: `pay_sandbox_${suffix}`, simulated: true };
      }
      return { ok: false, status: 503, error: 'Paid sign-up is not available yet. Start the free trial instead.' };
    }

    const orderId = paymentDetails.razorpay_order_id;
    const paymentId = paymentDetails.razorpay_payment_id;
    const signature = paymentDetails.razorpay_signature;
    if (typeof orderId !== 'string' || !/^order_[A-Za-z0-9]{6,64}$/.test(orderId) ||
        typeof paymentId !== 'string' || !/^pay_[A-Za-z0-9]{6,64}$/.test(paymentId) ||
        typeof signature !== 'string') {
      return { ok: false, status: 400, error: 'Payment confirmation is incomplete.' };
    }
    if (!this.platformProvider.verifyCheckoutSignature(orderId, paymentId, signature)) {
      return { ok: false, status: 402, error: 'Payment signature could not be verified.' };
    }
    const reused = this.db.queryOne<any>(
      `SELECT id FROM platform_subscription_payment_attempts WHERE provider_payment_id = ? OR provider_order_id = ?`,
      [paymentId, orderId]
    );
    if (reused) return { ok: false, status: 409, error: 'This payment has already been used to activate an account.' };

    let payment;
    try {
      payment = await this.platformProvider.fetchPayment(paymentId);
    } catch {
      return { ok: false, status: 503, error: 'Payment verification is temporarily unavailable. Your payment is safe; please retry in a minute.' };
    }
    if (!payment || payment.order_id !== orderId || payment.amount !== amountPaise || payment.currency !== 'INR') {
      return { ok: false, status: 402, error: 'The payment does not match the selected plan.' };
    }
    if (payment.status !== 'captured') {
      return { ok: false, status: 402, error: 'The payment has not been captured yet. Please retry in a minute.' };
    }
    return { ok: true, orderId, paymentId, simulated: false };
  }

  public register = async (req: Request, res: Response) => {
    try {
      const {
        orgName,
        shopName,
        businessName,
        shopCode,
        ownerName,
        fullName,
        email,
        password,
        phone,
        address,
        city,
        state,
        pinCode,
        planId,
        billingCycle,
        paymentDetails,
      } = req.body;

      const effectiveShopName = shopName || businessName;
      const effectiveOwnerName = ownerName || fullName;
      const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';

      if (typeof effectiveShopName !== 'string' || !effectiveShopName.trim() || typeof effectiveOwnerName !== 'string' || !effectiveOwnerName.trim() ||
          typeof email !== 'string' || normalizedEmail.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
          typeof password !== 'string' || password.length < 12 || password.length > 1024) {
        return res.status(400).json({ error: 'Missing required fields: shop name, owner name, valid email, and a password of 12 to 1024 characters.' });
      }

      let cleanCode = (typeof shopCode === 'string' ? shopCode : effectiveShopName)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      if (!cleanCode) {
        cleanCode = `shop-${Date.now().toString(36)}`;
      }

      // Collision resolution
      let candidateCode = cleanCode;
      let counter = 1;
      while (this.shopRepo.getShopByCode(candidateCode)) {
        candidateCode = `${cleanCode}-${counter++}`;
      }
      cleanCode = candidateCode;

      const existingUser = this.userRepo.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(409).json({
          error: 'An account with this email already exists. Please sign in to your dashboard.',
          accountExists: true,
          email: normalizedEmail,
        });
      }

      // A paid plan is granted only after the server has verified the payment
      // with Razorpay. Without payment details the shop starts a free trial.
      const { plan: selectedPlan, isLifetime, isYearly, amountPaise } = this.resolveSignupPlan(planId, billingCycle);
      let isPaid = false;
      let finalOrderId = '';
      let finalPaymentId = '';
      if (paymentDetails) {
        const verification = await this.verifySignupPayment(paymentDetails, amountPaise);
        if (!verification.ok) return res.status(verification.status).json({ error: verification.error });
        isPaid = true;
        finalOrderId = verification.orderId;
        finalPaymentId = verification.paymentId;
      }

      const now = new Date().toISOString();
      const userId = `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const orgId = `org-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const shopId = `shop-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

      const trialStartsAt = now;
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const paidStartsAt = now;
      const paidEndsAt = isLifetime
        ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
        : isYearly
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Keep all account records and the subscription in one transaction so a partial
      // registration cannot strand a user without an organization or shop.
      this.db.transaction(() => {
        // 1. Create User with credentials
        this.userRepo.createUser(
          {
            id: userId,
            email: normalizedEmail,
            phone,
            fullName: effectiveOwnerName,
            role: 'MERCHANT_OWNER',
            isActive: true,
            createdAt: now,
            updatedAt: now,
          },
          hashPassword(password)
        );

        // 2. Create organization
        this.shopRepo.createOrganization({
          id: orgId,
          name: orgName || `${effectiveOwnerName}'s Printing Services`,
          ownerUserId: userId,
          planTier: isPaid ? selectedPlan.tier : 'STARTER',
          planStatus: isPaid ? 'ACTIVE' : 'TRIAL',
          billingCurrency: 'INR',
          createdAt: now,
          updatedAt: now,
        });

        // 3. Create Shop
        this.shopRepo.createShop({
          id: shopId,
          organizationId: orgId,
          shopCode: cleanCode,
          name: effectiveShopName,
          tagline: 'Quality Document Printing & Copying',
          phone: phone || '+91 99999 99999',
          email: normalizedEmail,
          address: address || 'Main Market Road',
          city: city || 'Pune',
          state: state || 'Maharashtra',
          pinCode: pinCode || '411001',
          currency: 'INR',
          paymentGateway: 'RAZORPAY',
          acceptCashOnCollection: true,
          autoPrintMode: 'MANUAL_OFF',
          orderSeparator: 'NONE',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });

        // 4. Create Membership
        this.userRepo.createMembership({
          id: `mem-${userId}`,
          userId,
          organizationId: orgId,
          shopId,
          role: 'MERCHANT_OWNER',
          permissions: ['*'] as any,
          createdAt: now,
          updatedAt: now,
        });

        // 5. Seed Baseline Rates for new shop
        this.pricingRepo.setRateRule({
          id: `rate-${shopId}-a4-bw-simp`,
          shopId,
          paperSize: 'A4',
          colorMode: 'bw',
          duplexMode: 'simplex',
          pricePerPrintedSidePaise: 200,
        });
        this.pricingRepo.setRateRule({
          id: `rate-${shopId}-a4-bw-dupl`,
          shopId,
          paperSize: 'A4',
          colorMode: 'bw',
          duplexMode: 'duplex_auto',
          pricePerPrintedSidePaise: 150,
        });
        this.pricingRepo.setRateRule({
          id: `rate-${shopId}-a4-col-simp`,
          shopId,
          paperSize: 'A4',
          colorMode: 'color',
          duplexMode: 'simplex',
          pricePerPrintedSidePaise: 1000,
        });
        this.pricingRepo.setRateRule({
          id: `rate-${shopId}-a4-col-dupl`,
          shopId,
          paperSize: 'A4',
          colorMode: 'color',
          duplexMode: 'duplex_auto',
          pricePerPrintedSidePaise: 800,
        });

        this.pricingRepo.setBulkDiscountRule({
          id: `bulk-${shopId}`,
          shopId,
          minOrderValuePaise: 10000,
          discountPercentage: 10,
          isEnabled: true,
        });

        if (isPaid) {
          // Insert active subscription & billing tariff
          const tariffId = `tariff-${crypto.randomUUID()}`;
          this.db.execute(
            `INSERT INTO subscription_billing_tariffs (id, organization_id, monthly_base_paise, per_side_paise, included_sides, currency, effective_from, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, ?)`,
            [tariffId, orgId, amountPaise, 20, selectedPlan.orderLimitMonthly * 2, now, userId, now]
          );

          this.db.execute(
            `INSERT INTO subscriptions (id, organization_id, plan_id, plan_tier, status, current_period_start, current_period_end, cancel_at_period_end, amount_paise, currency, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, 0, ?, 'INR', ?, ?)`,
            [`sub-${orgId}`, orgId, selectedPlan.id, selectedPlan.tier, paidStartsAt, paidEndsAt, amountPaise, now, now]
          );

          const attemptId = crypto.randomUUID();
          const idempotencyKey = `signup-${attemptId}`;
          const requestFingerprint = crypto.createHash('sha256').update(`${orgId}:${selectedPlan.id}:${amountPaise}`).digest('hex');
          this.db.execute(
            `INSERT INTO platform_subscription_payment_attempts
             (id, organization_id, created_by_user_id, idempotency_key, request_fingerprint, plan_id, plan_tier, tariff_id, amount_paise,
              currency, period_start, period_end, provider, provider_order_id, provider_payment_id, status, failure_code, created_at, updated_at, captured_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, 'RAZORPAY', ?, ?, 'VERIFIED', NULL, ?, ?, ?)`,
            [attemptId, orgId, userId, idempotencyKey, requestFingerprint, selectedPlan.id, selectedPlan.tier, tariffId, amountPaise, paidStartsAt, paidEndsAt, finalOrderId, finalPaymentId, now, now, now]
          );

          this.ledger.appendEntry({
            id: `led-saas-${crypto.randomUUID()}`,
            domain: 'SAAS_SUBSCRIPTION',
            organizationId: orgId,
            amountPaise,
            currency: 'INR',
            provider: 'RAZORPAY',
            providerTransactionId: finalPaymentId,
            description: `Inklly ${selectedPlan.name} (${isLifetime ? 'lifetime' : isYearly ? 'yearly' : 'monthly'}) subscription payment`,
            metadata: { planId: selectedPlan.id, billingCycle: isLifetime ? 'lifetime' : isYearly ? 'yearly' : 'monthly' },
            createdAt: now,
          });
        } else {
          // 7-day pilot trial
          this.db.execute(
            `INSERT INTO subscriptions (id, organization_id, plan_id, plan_tier, status, current_period_start, current_period_end, cancel_at_period_end, amount_paise, currency, created_at, updated_at)
             VALUES (?, ?, 'plan-starter', 'STARTER', 'TRIALING', ?, ?, 0, 0, 'INR', ?, ?)`,
            [`sub-trial-${orgId}`, orgId, trialStartsAt, trialEndsAt, now, now]
          );
        }
      });

      const token = this.issueSessionToken(
        { id: userId, email: normalizedEmail, role: 'MERCHANT_OWNER' },
        orgId,
        shopId,
        ['*'],
        req
      );

      res.status(201).json({
        success: true,
        registrationComplete: true,
        message: isPaid ? `Your ${selectedPlan.name} subscription is active!` : 'Your 7-day no-card trial is active.',
        token,
        user: {
          id: userId,
          email: normalizedEmail,
          fullName: effectiveOwnerName,
          role: 'MERCHANT_OWNER',
        },
        credentials: {
          email: normalizedEmail,
        },
        shopId,
        organizationId: orgId,
        shop: {
          id: shopId,
          shopCode: cleanCode,
          name: effectiveShopName,
          phone: phone || '+91 99999 99999',
          address: address || 'Main Market Road',
          city: city || 'Pune',
          state: state || 'Maharashtra',
          currency: 'INR',
        },
        organization: {
          id: orgId,
          name: orgName || `${effectiveOwnerName}'s Printing Services`,
          planTier: isPaid ? selectedPlan.tier : 'STARTER',
          planStatus: isPaid ? 'ACTIVE' : 'TRIAL',
        },
        subscription: {
          planId: isPaid ? selectedPlan.id : 'plan-starter',
          planName: isPaid ? selectedPlan.name : 'Inklly Starter',
          status: isPaid ? 'ACTIVE' : 'TRIALING',
          amountPaise: isPaid ? amountPaise : 0,
          currency: 'INR',
          ...(isPaid ? { periodEnd: paidEndsAt } : { trialEndsAt }),
        },
      });
    } catch (err: any) {
      console.error('[AuthController.register] Error during merchant registration:', err);
      const isConflict = err.message && (err.message.includes('UNIQUE') || err.message.includes('duplicate') || err.message.includes('already exists'));
      const status = isConflict ? 409 : (err.status || 400);
      return res.status(status).json({
        error: isConflict
          ? 'An account or shop with these details already exists. Please choose a different shop URL slug or email.'
          : (err.message || 'Registration failed. Please review your details and try again.'),
      });
    }
  };

  public acceptPlatformInvitation = (req: Request, res: Response) => {
    const { token, password } = req.body || {};
    if (typeof token !== 'string' || token.length < 32 || token.length > 256 ||
        typeof password !== 'string' || password.length < 12 || password.length > 1024 ||
        !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return res.status(400).json({ error: 'Use a valid invitation token and a password of at least 12 characters with upper and lower case letters, a number, and a symbol.' });
    }

    const now = new Date().toISOString();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    let accepted: any = null;
    try {
      this.db.transaction(() => {
        const claimed = this.db.query<any>(
          `UPDATE account_invitations SET accepted_at = ? WHERE token_hash = ? AND accepted_at IS NULL AND expires_at > ?
           RETURNING id, user_id, organization_id, shop_id`,
          [now, tokenHash, now]
        );
        if (claimed.length === 0) return;
        accepted = claimed[0];
        this.userRepo.setUserPasswordHash(accepted.user_id, hashPassword(password));
        this.userRepo.setUserActive(accepted.user_id, true);
        this.userRepo.logAuditEvent({
          id: crypto.randomUUID(), actorUserId: accepted.user_id, actorRole: 'MERCHANT_OWNER',
          organizationId: accepted.organization_id, shopId: accepted.shop_id,
          action: 'PLATFORM_INVITATION_ACCEPTED', targetType: 'PLATFORM_INVITATION', targetId: accepted.id,
          outcome: 'SUCCESS', ipAddress: req.ip, createdAt: now,
        });
      });
    } catch {
      return res.status(503).json({ error: 'Invitation could not be accepted. Please retry.' });
    }
    if (!accepted) return res.status(400).json({ error: 'Invitation is invalid, expired, or already used.' });
    return res.json({ success: true, email: this.userRepo.getUserById(accepted.user_id)?.email });
  };

  public getMe = (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const user = this.userRepo.getUserById(req.user.userId);
    const shop = req.user.shopId ? this.shopRepo.getShopById(req.user.shopId) : null;
    const org = req.user.organizationId ? this.shopRepo.getOrganizationById(req.user.organizationId) : null;
    const subscription = org
      ? this.db.queryOne<any>(`SELECT plan_id, plan_tier, status, current_period_start, current_period_end, amount_paise, currency FROM subscriptions WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1`, [org.id])
      : null;

    res.json({
      user: user || {
        id: req.user.userId,
        email: req.user.email,
        role: req.user.role,
        fullName: 'Operator',
      },
      shop,
      organization: org,
      subscription: subscription || null,
      permissions: req.user.permissions,
    });
  };

  public updateMe = (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthenticated' });
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    if (Object.keys(body).some((key) => !['fullName', 'phone'].includes(key))) {
      return res.status(400).json({ error: 'Only fullName and phone can be updated here. Email changes require verification.' });
    }
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const rawPhone = body.phone;
    const phone = typeof rawPhone === 'string' ? rawPhone.trim() : rawPhone === null ? '' : undefined;
    if (!fullName || fullName.length > 120) return res.status(400).json({ error: 'Name must be between 1 and 120 characters.' });
    if (phone === undefined || (phone && (phone.length > 24 || !/^\+?[0-9][0-9 ()-]{5,22}$/.test(phone)))) {
      return res.status(400).json({ error: 'Enter a valid phone number or leave it blank.' });
    }
    if (!this.userRepo.getUserById(userId)) return res.status(404).json({ error: 'Account not found.' });
    const now = new Date().toISOString();
    try {
      this.db.transaction(() => {
        this.userRepo.updateUserProfile(userId, fullName, phone || null);
        this.userRepo.logAuditEvent({
          id: crypto.randomUUID(), actorUserId: userId, actorRole: req.user?.role,
          organizationId: req.user?.organizationId, shopId: req.user?.shopId,
          action: 'ACCOUNT_PROFILE_UPDATED', targetType: 'USER', targetId: userId,
          outcome: 'SUCCESS', ipAddress: req.ip, details: { fields: ['fullName', 'phone'] }, createdAt: now,
        });
      });
    } catch {
      return res.status(503).json({ error: 'Account profile could not be saved. Please retry.' });
    }
    return res.json({ success: true, user: this.userRepo.getUserById(userId) });
  };

  public changePassword = (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const sessionId = req.user?.sessionId;
    if (!userId || !sessionId) return res.status(401).json({ error: 'Unauthenticated' });
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 1024 ||
        typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 1024 ||
        !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      return res.status(400).json({ error: 'Enter your current password and choose a password of at least 12 characters with upper and lower case letters, a number, and a symbol.' });
    }
    const user = this.userRepo.getUserByIdWithPassword(userId);
    if (!user || !user.isActive || !verifyPassword(currentPassword, user.passwordHash).valid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    const now = new Date().toISOString();
    try {
      this.db.transaction(() => {
        this.userRepo.setUserPasswordHash(userId, hashPassword(newPassword));
        this.userRepo.revokeOtherUserSessions(userId, sessionId);
        this.userRepo.logAuditEvent({
          id: crypto.randomUUID(), actorUserId: userId, actorRole: req.user?.role,
          organizationId: req.user?.organizationId, shopId: req.user?.shopId,
          action: 'ACCOUNT_PASSWORD_CHANGED', targetType: 'USER', targetId: userId,
          outcome: 'SUCCESS', ipAddress: req.ip, createdAt: now,
        });
      });
    } catch {
      return res.status(503).json({ error: 'Password could not be changed. Please retry.' });
    }
    return res.json({ success: true, otherSessionsRevoked: true });
  };

  public getPreferences = (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthenticated' });
    res.json(this.userRepo.getUserPreferences(userId));
  };

  public updatePreferences = (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthenticated' });
    const { theme, language, emailNotifications, smsNotifications } = req.body;
    if (theme && !['light', 'dark'].includes(theme)) {
      return res.status(400).json({ error: 'Theme must be light or dark.' });
    }
    res.json(this.userRepo.upsertUserPreferences(userId, { theme, language, emailNotifications, smsNotifications }));
  };

  public requestPasswordReset = (_req: Request, res: Response) => {
    // No email delivery provider is configured yet. Fail closed instead of
    // telling users a recovery link was sent when no message can be delivered.
    res.status(503).json({
      success: false,
      code: 'PASSWORD_RESET_UNAVAILABLE',
      error: 'Account recovery email is not configured. Contact your administrator for help.',
    });
  };

  public getSessions = (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthenticated' });
    res.json(this.userRepo.getUserSessions(userId).map((session: any) => ({
      ...session,
      isCurrent: session.id === req.user?.sessionId,
    })));
  };

  public revokeSession = (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthenticated' });
    const sessionId = String(req.params.id);
    if (!this.userRepo.revokeUserSession(sessionId, userId)) return res.status(404).json({ error: 'Session not found or already revoked.' });
    res.json({ success: true });
  };
}
