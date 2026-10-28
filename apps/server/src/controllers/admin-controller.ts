import { Request, Response } from 'express';
import { DatabaseService, EnquiryRepository, LedgerRepository, UserRepository, hashPassword } from '@inklly/db';
import { SubscriptionPlan, MoneyDomain } from '@inklly/shared';
import * as crypto from 'node:crypto';
import { PrivateFileStorage } from '../services/private-file-storage';
import { purgeExpiredPrintFiles } from '../services/print-file-retention';

export const SAAS_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-starter',
    tier: 'STARTER',
    name: 'Inklly Starter',
    monthlyPricePaise: 49900, // ₹499/mo
    annualPricePaise: 499000, // ₹4,990/yr
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
    monthlyPricePaise: 119900, // ₹1,199/mo
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
    monthlyPricePaise: 249900, // ₹2,499/mo
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
    monthlyPricePaise: 699900, // ₹6,999/mo
    annualPricePaise: 6999000,
    currency: 'INR',
    orderLimitMonthly: 100000,
    printerLimit: 100,
    fileSizeMaxMB: 500,
    includedConversionCredits: 10000,
    features: ['Unlimited Orders', 'Dedicated Hardware Queue', 'Custom Integrations', 'Dedicated Account Manager'],
  },
];

export class AdminController {
  constructor(
    private db: DatabaseService,
    private ledgerRepo: LedgerRepository,
    private userRepo: UserRepository,
    private enquiryRepo: EnquiryRepository,
    private fileStorage: PrivateFileStorage
  ) {}

  public getOverview = (req: Request, res: Response) => {
    const orgs = this.db.query<any>(`SELECT COUNT(*) as count FROM organizations`);
    const shops = this.db.query<any>(`SELECT COUNT(*) as count FROM shops`);
    const orders = this.db.query<any>(`SELECT COUNT(*) as count FROM orders`);
    const gmvRow = this.db.queryOne<any>(
      `SELECT SUM(amount_paise) as total FROM ledger_entries WHERE domain = 'CUSTOMER_PRINT_PAYMENT'`
    );

    res.json({
      metrics: {
        totalOrganizations: orgs[0]?.count || 0,
        totalShops: shops[0]?.count || 0,
        totalOrdersProcessed: orders[0]?.count || 0,
        platformGMVPaise: Number(gmvRow?.total ?? 0),
        // Subscription billing creation/collection is not implemented yet, so
        // ledger totals cannot be presented as recurring monthly revenue.
        platformMRRPaise: null,
        mrrStatus: 'UNAVAILABLE_SUBSCRIPTION_BILLING_NOT_CONFIGURED',
      },
      health: {
        apiStatus: 'HEALTHY',
        databaseEngine: this.db.getEngineName(),
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      },
    });
  };

  public getAgents = (req: Request, res: Response) => {
    const rows = this.db.query<any>(
      `SELECT ar.id, ar.shop_id, ar.hostname, ar.os_platform, ar.os_version, ar.agent_version,
              ar.is_active, ar.last_heartbeat, ar.created_at,
              s.shop_code, s.name AS shop_name,
              (SELECT COUNT(*) FROM printers p WHERE p.agent_id = ar.id AND p.is_online = 1) AS online_printers,
              (SELECT COUNT(*) FROM print_attempts pa WHERE pa.agent_id = ar.id AND pa.status = 'DISPATCHED_TO_AGENT') AS pending_commands
       FROM agent_registrations ar
       LEFT JOIN shops s ON s.id = ar.shop_id
       ORDER BY ar.created_at DESC`
    );
    const now = Date.now();
    res.json(rows.map((row) => {
      const heartbeatTime = row.last_heartbeat ? Date.parse(row.last_heartbeat) : NaN;
      const status = !row.is_active ? 'REVOKED'
        : Number.isFinite(heartbeatTime) ? now - heartbeatTime <= 45_000 ? 'ONLINE' : 'STALE'
          : 'UNKNOWN';
      return {
        agentId: row.id,
        shopId: row.shop_id,
        shopCode: row.shop_code || null,
        shopName: row.shop_name || null,
        hostname: row.hostname || null,
        osPlatform: row.os_platform || null,
        osVersion: row.os_version || null,
        agentVersion: row.agent_version || null,
        status,
        lastHeartbeat: row.last_heartbeat || null,
        onlinePrinters: Number(row.online_printers || 0),
        pendingCommands: Number(row.pending_commands || 0),
        createdAt: row.created_at,
      };
    }));
  };

  public getRetentionStats = (req: Request, res: Response) => {
    const total = this.db.queryOne<any>(
      `SELECT COUNT(*) AS file_count, COALESCE(SUM(file_size_bytes), 0) AS bytes
       FROM order_files WHERE storage_key NOT LIKE 'expired:%'`
    );
    const eligible = this.db.queryOne<any>(
      `SELECT COUNT(*) AS file_count, COALESCE(SUM(of.file_size_bytes), 0) AS bytes
       FROM order_files of JOIN orders o ON o.id = of.order_id
       WHERE o.status IN ('COLLECTED', 'CANCELLED')
         AND COALESCE(o.collected_at, o.updated_at) <= ?
         AND of.storage_key NOT LIKE 'expired:%'`,
      [new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()]
    );
    const expired = this.db.queryOne<any>(`SELECT COUNT(*) AS file_count FROM order_files WHERE storage_key LIKE 'expired:%'`);
    const vault = this.db.queryOne<any>(
      `SELECT COUNT(*) AS file_count, COALESCE(SUM(file_size_bytes), 0) AS bytes FROM storage_documents`
    );
    res.json({
      customerOrderFiles: {
        activeCount: Number(total?.file_count || 0),
        storedBytesEstimate: Number(total?.bytes || 0),
        eligibleForDeletionCount: Number(eligible?.file_count || 0),
        eligibleBytesEstimate: Number(eligible?.bytes || 0),
        deletedObjectMarkers: Number(expired?.file_count || 0),
      },
      merchantVault: { persistentDocumentCount: Number(vault?.file_count || 0), storedBytesEstimate: Number(vault?.bytes || 0) },
      policy: { orderFileRetentionHours: 24, unclaimedUploadRetentionHours: 48, automaticSweepIntervalMinutes: 15 },
      estimatesExcludeUnclaimedObjects: true,
    });
  };

  public runRetentionPurge = async (req: Request, res: Response) => {
    try {
      const summary = await purgeExpiredPrintFiles(this.db, this.fileStorage);
      const hadFailures = summary.expiredFilesFailed > 0 || summary.orphanFilesFailed > 0;
      this.userRepo.logAuditEvent({
        id: crypto.randomUUID(),
        actorUserId: req.user?.userId,
        actorRole: req.user?.role,
        action: 'RUN_PRINT_FILE_RETENTION_PURGE',
        targetType: 'PRIVATE_FILE_RETENTION',
        targetId: 'customer-order-files-and-unclaimed-uploads',
        outcome: hadFailures ? 'FAILED' : 'SUCCESS',
        ipAddress: req.ip,
        details: { ...summary },
        createdAt: new Date().toISOString(),
      });
      return res.status(hadFailures ? 207 : 200).json({ success: !hadFailures, summary });
    } catch {
      return res.status(503).json({ error: 'Retention purge could not complete. No deletion result is available.' });
    }
  };

  public getMerchants = (req: Request, res: Response) => {
    const rows = this.db.query<any>(
      `SELECT o.*, u.full_name as owner_name, u.email as owner_email,
              (SELECT COUNT(*) FROM shops s WHERE s.organization_id = o.id) as shops_count,
              (SELECT COUNT(*) FROM orders ord JOIN shops s ON ord.shop_id = s.id WHERE s.organization_id = o.id) as orders_count
       FROM organizations o
       LEFT JOIN users u ON o.owner_user_id = u.id
       ORDER BY o.created_at DESC`
    );

    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        planTier: r.plan_tier,
        planStatus: r.plan_status,
        billingCurrency: r.billing_currency,
        owner: {
          name: r.owner_name,
          email: r.owner_email,
        },
        shopsCount: r.shops_count,
        ordersCount: r.orders_count,
        createdAt: r.created_at,
      }))
    );
  };

  public onboardMerchant = (req: Request, res: Response) => {
    const { organizationName, shopCode, ownerName, ownerEmail, planTier } = req.body || {};
    const cleanOrgName = typeof organizationName === 'string' ? organizationName.trim() : '';
    const cleanOwnerName = typeof ownerName === 'string' ? ownerName.trim() : '';
    const cleanEmail = typeof ownerEmail === 'string' ? ownerEmail.trim().toLowerCase() : '';
    const tier = typeof planTier === 'string' ? planTier.toUpperCase() : '';
    const plan = SAAS_PLANS.find((item) => item.tier === tier);
    const code = typeof shopCode === 'string'
      ? shopCode.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      : cleanOrgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    if (!cleanOrgName || cleanOrgName.length > 160 || !cleanOwnerName || cleanOwnerName.length > 160 ||
        cleanEmail.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
        !code || code.length > 80 || !plan) {
      return res.status(400).json({ error: 'Provide a valid organization name, shop code, owner name, owner email, and supported plan tier.' });
    }
    if (this.userRepo.getUserByEmail(cleanEmail)) return res.status(409).json({ error: 'An account with this owner email already exists.' });
    if (this.db.queryOne(`SELECT id FROM shops WHERE shop_code = ?`, [code])) return res.status(409).json({ error: 'That shop code is already in use.' });

    const now = new Date().toISOString();
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const userId = crypto.randomUUID();
    const organizationId = crypto.randomUUID();
    const shopId = crypto.randomUUID();
    const invitationToken = crypto.randomBytes(32).toString('base64url');
    const invitationExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const tokenHash = crypto.createHash('sha256').update(invitationToken).digest('hex');
    const actorId = req.user?.userId;
    if (!actorId) return res.status(401).json({ error: 'Unauthenticated' });

    try {
      this.db.transaction(() => {
        this.userRepo.createUser({
          id: userId, email: cleanEmail, fullName: cleanOwnerName, role: 'MERCHANT_OWNER', isActive: false,
          createdAt: now, updatedAt: now,
        }, hashPassword(crypto.randomBytes(48).toString('base64url')));
        this.db.execute(
          `INSERT INTO organizations (id, name, owner_user_id, plan_tier, plan_status, billing_currency, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'TRIAL', 'INR', ?, ?)`,
          [organizationId, cleanOrgName, userId, tier, now, now]
        );
        this.db.execute(
          `INSERT INTO shops (id, organization_id, shop_code, name, phone, email, address, city, state, pin_code, currency, payment_gateway, accept_cash_on_collection, auto_print_mode, order_separator, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', ?, '', '', '', '', 'INR', 'RAZORPAY', 1, 'MANUAL_OFF', 'NONE', 1, ?, ?)`,
          [shopId, organizationId, code, cleanOrgName, cleanEmail, now, now]
        );
        this.userRepo.createMembership({
          id: crypto.randomUUID(), userId, organizationId, shopId, role: 'MERCHANT_OWNER', permissions: ['*'] as any,
          createdAt: now, updatedAt: now,
        });
        const baselineRates = [
          ['A4', 'bw', 'simplex', 200], ['A4', 'bw', 'duplex_auto', 150],
          ['A4', 'color', 'simplex', 1000], ['A4', 'color', 'duplex_auto', 800],
        ] as const;
        for (const [paper, color, duplex, price] of baselineRates) {
          this.db.execute(
            `INSERT INTO rate_rules (id, shop_id, paper_size, color_mode, duplex_mode, price_per_printed_side_paise, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [crypto.randomUUID(), shopId, paper, color, duplex, price, now, now]
          );
        }
        this.db.execute(
          `INSERT INTO subscriptions (id, organization_id, plan_id, plan_tier, status, current_period_start, current_period_end, cancel_at_period_end, amount_paise, currency, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'TRIALING', ?, ?, 0, 0, 'INR', ?, ?)`,
          [crypto.randomUUID(), organizationId, plan.id, tier, now, trialEndsAt, now, now]
        );
        this.db.execute(
          `INSERT INTO account_invitations (id, token_hash, user_id, organization_id, shop_id, expires_at, accepted_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
          [crypto.randomUUID(), tokenHash, userId, organizationId, shopId, invitationExpiresAt, now]
        );
        this.userRepo.logAuditEvent({
          id: crypto.randomUUID(), actorUserId: actorId, actorRole: req.user?.role, organizationId,
          action: 'PLATFORM_MERCHANT_ONBOARDED', targetType: 'ORGANIZATION', targetId: organizationId,
          outcome: 'SUCCESS', ipAddress: req.ip, details: { shopId, planTier: tier, ownerUserId: userId }, createdAt: now,
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/unique|duplicate/i.test(message)) return res.status(409).json({ error: 'Owner email or shop code is already in use.' });
      throw error;
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({
      merchant: {
        id: organizationId, name: cleanOrgName, planTier: tier, planStatus: 'TRIAL', billingCurrency: 'INR',
        owner: { name: cleanOwnerName, email: cleanEmail }, shopsCount: 1, ordersCount: 0, createdAt: now,
        shopCode: code, shopId, trialEndsAt,
      },
      invitationToken,
      invitationExpiresAt,
    });
  };

  public updateMerchantStatus = (req: Request, res: Response) => {
    const { id } = req.params;
    const { planStatus, planTier } = req.body;

    const now = new Date().toISOString();
    this.db.execute(
      `UPDATE organizations SET
        plan_status = COALESCE(?, plan_status),
        plan_tier = COALESCE(?, plan_tier),
        updated_at = ?
       WHERE id = ?`,
      [planStatus || null, planTier || null, now, id]
    );

    res.json({ success: true, message: `Organization ${id} updated` });
  };

  public getPlans = (req: Request, res: Response) => {
    res.json(SAAS_PLANS);
  };

  public getPlatformLedger = (req: Request, res: Response) => {
    const domain = req.query.domain as MoneyDomain | undefined;
    const rows = this.ledgerRepo.getEntriesByOrg('org-campus-network', domain);
    const allRows = domain
      ? this.db.query<any>(`SELECT * FROM ledger_entries WHERE domain = ? ORDER BY created_at DESC LIMIT 100`, [domain])
      : this.db.query<any>(`SELECT * FROM ledger_entries ORDER BY created_at DESC LIMIT 100`);

    res.json(allRows);
  };

  public getAuditLogs = (req: Request, res: Response) => {
    const limit = Number(req.query.limit || 50);
    const logs = this.userRepo.getAuditEvents(limit);
    res.json(logs);
  };

  public getEnquiries = (req: Request, res: Response) => {
    const requestedLimit = Number(req.query.limit);
    const requestedOffset = Number(req.query.offset);
    const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.floor(requestedLimit))) : 50;
    const offset = Number.isFinite(requestedOffset) ? Math.min(100_000, Math.max(0, Math.floor(requestedOffset))) : 0;
    this.userRepo.logAuditEvent({
      id: crypto.randomUUID(),
      actorUserId: req.user?.userId,
      actorRole: req.user?.role,
      action: 'VIEW_PUBLIC_ENQUIRIES',
      targetType: 'PUBLIC_ENQUIRY_COLLECTION',
      targetId: 'latest',
      outcome: 'SUCCESS',
      ipAddress: req.ip,
      details: { reason: 'Platform website enquiry follow-up', limit, offset },
      createdAt: new Date().toISOString(),
    });
    res.json(this.enquiryRepo.list(limit, offset));
  };

  // Subscription management
  public listSubscriptions = (req: Request, res: Response) => {
    const rows = this.db.query<any>(`SELECT * FROM subscriptions ORDER BY created_at DESC`);
    res.json(rows.map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      planId: r.plan_id,
      planTier: r.plan_tier,
      status: r.status,
      currentPeriodStart: r.current_period_start,
      currentPeriodEnd: r.current_period_end,
      cancelAtPeriodEnd: Boolean(r.cancel_at_period_end),
      providerSubscriptionId: r.provider_subscription_id,
      amountPaise: r.amount_paise,
      currency: r.currency,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })));
  };

  public createSubscription = (req: Request, res: Response) => {
    return res.status(503).json({ error: 'Subscription billing is not configured. No subscription or charge was created.' });
  };

  public updateSubscription = (req: Request, res: Response) => {
    return res.status(503).json({ error: 'Subscription billing is not configured. Subscription changes are unavailable.' });
  };
}
