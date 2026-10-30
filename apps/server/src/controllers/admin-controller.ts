import { Request, Response } from 'express';
import { DatabaseService, EnquiryRepository, LedgerRepository, UserRepository, hashPassword } from '@inklly/db';
import { SubscriptionPlan } from '@inklly/shared';
import * as crypto from 'node:crypto';
import { PrivateFileStorage } from '../services/private-file-storage';
import { purgeExpiredPrintFiles } from '../services/print-file-retention';
import { PilotBillingError, PilotBillingService } from '../services/pilot-billing';

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

const ALLOWED_PLAN_STATUSES = new Set([
  'TRIAL', 'ACTIVE', 'GRACE', 'PAST_DUE', 'CANCELLED', 'SUSPENDED', 'PENDING_PAYMENT',
]);

export const PLATFORM_ADMIN_PERMISSION_OPTIONS = [
  'platform:view', 'platform:manage', 'support:view', 'support:manage', 'finance:view', 'security:audit', 'billing:view', 'billing:manage',
] as const;

export class AdminController {
  private readonly pilotBilling: PilotBillingService;

  constructor(
    private db: DatabaseService,
    private ledgerRepo: LedgerRepository,
    private userRepo: UserRepository,
    private enquiryRepo: EnquiryRepository,
    private fileStorage: PrivateFileStorage
  ) { this.pilotBilling = new PilotBillingService(db); }

  public listPlatformAdmins = (_req: Request, res: Response) => {
    const rows = this.db.query<any>(
      `SELECT u.id, u.email, u.full_name, u.is_active, u.created_at, p.permission
       FROM users u LEFT JOIN platform_admin_permissions p ON p.user_id = u.id
       WHERE u.role = 'PLATFORM_ADMIN'
       ORDER BY u.created_at ASC, u.id ASC, p.permission ASC`
    );
    const admins = new Map<string, any>();
    for (const row of rows) {
      if (!admins.has(row.id)) admins.set(row.id, {
        id: row.id, email: row.email, fullName: row.full_name,
        isActive: Boolean(row.is_active), createdAt: row.created_at, permissions: [],
      });
      if (typeof row.permission === 'string') admins.get(row.id).permissions.push(row.permission);
    }
    return res.json([...admins.values()]);
  };

  public updatePlatformAdminPermissions = (req: Request, res: Response) => {
    const requested = req.body?.permissions;
    const allowed = new Set<string>(PLATFORM_ADMIN_PERMISSION_OPTIONS);
    if (!Array.isArray(requested) || requested.length > allowed.size ||
        !requested.every((permission: unknown) => typeof permission === 'string' && allowed.has(permission)) ||
        new Set(requested).size !== requested.length) {
      return res.status(400).json({ error: 'permissions must be a unique list of supported platform permissions.' });
    }
    const targetId = String(req.params.id || '');
    const actorId = req.user?.userId;
    if (!actorId) return res.status(401).json({ error: 'Unauthenticated' });
    const target = this.db.queryOne<any>(`SELECT id, role FROM users WHERE id = ?`, [targetId]);
    if (!target || target.role !== 'PLATFORM_ADMIN') return res.status(404).json({ error: 'Platform admin not found.' });

    const nextPermissions = [...requested].sort();
    const previousPermissions = this.db.query<{ permission: string }>(
      `SELECT permission FROM platform_admin_permissions WHERE user_id = ? ORDER BY permission`, [targetId]
    ).map((row) => row.permission);
    if (JSON.stringify(previousPermissions) === JSON.stringify(nextPermissions)) {
      return res.json({ success: true, adminId: targetId, permissions: nextPermissions, unchanged: true });
    }

    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db.execute(`DELETE FROM platform_admin_permissions WHERE user_id = ?`, [targetId]);
      for (const permission of nextPermissions) {
        this.db.execute(
          `INSERT INTO platform_admin_permissions (user_id, permission, granted_by_user_id, granted_at) VALUES (?, ?, ?, ?)`,
          [targetId, permission, actorId, now]
        );
      }
      this.userRepo.logAuditEvent({
        id: crypto.randomUUID(), actorUserId: actorId, actorRole: req.user?.role,
        action: 'PLATFORM_ADMIN_PERMISSIONS_UPDATED', targetType: 'USER', targetId,
        outcome: 'SUCCESS', ipAddress: req.ip,
        details: { previousPermissions, nextPermissions }, createdAt: now,
      });
    });
    return res.json({ success: true, adminId: targetId, permissions: nextPermissions, unchanged: false });
  };

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
    const paginationRequested = req.query.limit !== undefined || req.query.cursor !== undefined;
    const rawLimit = req.query.limit === undefined ? 100 : typeof req.query.limit === 'string' ? Number(req.query.limit) : NaN;
    if (paginationRequested && (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100)) {
      return res.status(400).json({ error: 'limit must be an integer from 1 to 100.' });
    }
    let cursor: { createdAt: string; id: string } | null = null;
    if (req.query.cursor !== undefined) {
      const rawCursor = typeof req.query.cursor === 'string' ? req.query.cursor : '';
      if (!/^[A-Za-z0-9_-]{1,512}$/.test(rawCursor)) return res.status(400).json({ error: 'Invalid agent cursor.' });
      try {
        const decoded = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8'));
        if (!decoded || typeof decoded.createdAt !== 'string' || decoded.createdAt.length > 64 || typeof decoded.id !== 'string' || decoded.id.length < 1 || decoded.id.length > 128) {
          return res.status(400).json({ error: 'Invalid agent cursor.' });
        }
        cursor = { createdAt: decoded.createdAt, id: decoded.id };
      } catch {
        return res.status(400).json({ error: 'Invalid agent cursor.' });
      }
    }
    const where = cursor ? `WHERE (ar.created_at < ? OR (ar.created_at = ? AND ar.id < ?))` : '';
    const params: Array<string | number> = cursor ? [cursor.createdAt, cursor.createdAt, cursor.id] : [];
    const limitClause = paginationRequested ? 'LIMIT ?' : '';
    if (paginationRequested) params.push(rawLimit + 1);
    const queriedRows = this.db.query<any>(
      `SELECT ar.id, ar.shop_id, ar.hostname, ar.os_platform, ar.os_version, ar.agent_version,
              ar.is_active, ar.last_heartbeat, ar.created_at,
              s.shop_code, s.name AS shop_name,
              (SELECT COUNT(*) FROM printers p WHERE p.agent_id = ar.id AND p.is_online = 1) AS online_printers,
              (SELECT COUNT(*) FROM print_attempts pa WHERE pa.agent_id = ar.id AND pa.status = 'DISPATCHED_TO_AGENT') AS pending_commands
       FROM agent_registrations ar
       LEFT JOIN shops s ON s.id = ar.shop_id
       ${where}
       ORDER BY ar.created_at DESC, ar.id DESC ${limitClause}`,
      params
    );
    const hasMore = paginationRequested && queriedRows.length > rawLimit;
    const rows = paginationRequested ? queriedRows.slice(0, rawLimit) : queriedRows;
    const now = Date.now();
    const agents = rows.map((row) => {
      const heartbeatTime = row.last_heartbeat ? Date.parse(row.last_heartbeat) : NaN;
      const heartbeatAgeMs = now - heartbeatTime;
      const status = !row.is_active ? 'REVOKED'
        : Number.isFinite(heartbeatTime) ? heartbeatAgeMs < 0 ? 'UNKNOWN' : heartbeatAgeMs <= 45_000 ? 'ONLINE' : 'STALE'
          : 'UNKNOWN';
      const reportedOnlinePrinters = Number(row.online_printers || 0);
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
        // Stored queue state is only current while the owning agent has fresh
        // heartbeat evidence. Keep the last reported count separately for
        // diagnostics so stale data cannot be presented as live availability.
        onlinePrinters: status === 'ONLINE' ? reportedOnlinePrinters : 0,
        reportedOnlinePrinters,
        pendingCommands: Number(row.pending_commands || 0),
        createdAt: row.created_at,
      };
    });
    if (!paginationRequested) return res.json(agents);
    const last = rows[rows.length - 1];
    const nextCursor = hasMore && last
      ? Buffer.from(JSON.stringify({ createdAt: last.created_at, id: last.id })).toString('base64url')
      : null;
    return res.json({ agents, nextCursor, hasMore, limit: rawLimit });
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
    const id = String(req.params.id);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const hasPlanStatus = Object.prototype.hasOwnProperty.call(body, 'planStatus');
    const hasPlanTier = Object.prototype.hasOwnProperty.call(body, 'planTier');
    const planStatus = typeof body.planStatus === 'string' ? body.planStatus.trim().toUpperCase() : undefined;
    const planTier = typeof body.planTier === 'string' ? body.planTier.trim().toUpperCase() : undefined;

    if ((!hasPlanStatus && !hasPlanTier) ||
        (hasPlanStatus && (!planStatus || !ALLOWED_PLAN_STATUSES.has(planStatus))) ||
        (hasPlanTier && (!planTier || !SAAS_PLANS.some((plan) => plan.tier === planTier)))) {
      return res.status(400).json({ error: 'Provide at least one valid planStatus or planTier.' });
    }
    const actorId = req.user?.userId;
    if (!actorId) return res.status(401).json({ error: 'Unauthenticated' });

    const now = new Date().toISOString();
    const updated = this.db.transaction(() => {
      const current = this.db.queryOne<any>(`SELECT id, plan_status, plan_tier FROM organizations WHERE id = ?`, [id]);
      if (!current) return null;

      const nextPlanStatus = planStatus ?? current.plan_status;
      const nextPlanTier = planTier ?? current.plan_tier;
      this.db.execute(
        `UPDATE organizations SET plan_status = ?, plan_tier = ?, updated_at = ? WHERE id = ?`,
        [nextPlanStatus, nextPlanTier, now, id]
      );
      this.userRepo.logAuditEvent({
        id: crypto.randomUUID(),
        actorUserId: actorId,
        actorRole: req.user?.role,
        organizationId: id,
        action: 'PLATFORM_MERCHANT_STATUS_UPDATED',
        targetType: 'ORGANIZATION',
        targetId: id,
        outcome: 'SUCCESS',
        ipAddress: req.ip,
        details: {
          previous: { planStatus: current.plan_status, planTier: current.plan_tier },
          next: { planStatus: nextPlanStatus, planTier: nextPlanTier },
        },
        createdAt: now,
      });
      return { planStatus: nextPlanStatus, planTier: nextPlanTier };
    });

    if (!updated) return res.status(404).json({ error: 'Organization not found.' });
    return res.json({ success: true, organization: { id, ...updated } });
  };

  public getPlans = (req: Request, res: Response) => {
    // Pilot pricing is intentionally configurable per tenant and no paid
    // subscription checkout is active. Do not expose illustrative source
    // prices as amounts merchants are currently charged.
    res.json(SAAS_PLANS.map(({ monthlyPricePaise: _monthly, annualPricePaise: _annual, ...plan }) => ({
      ...plan,
      catalogStatus: 'PLANNED_NOT_ENFORCED',
      pricing: 'CONFIGURED_PER_PILOT',
      monthlyPricePaise: null,
      annualPricePaise: null,
    })));
  };

  public getPlatformLedger = (req: Request, res: Response) => {
    const domain = typeof req.query.domain === 'string' ? req.query.domain : undefined;
    const rawLimit = req.query.limit === undefined ? 100 : Number(req.query.limit);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
      return res.status(400).json({ error: 'limit must be an integer between 1 and 100.' });
    }

    const rawCursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    let cursor: { createdAt: string; id: string } | undefined;
    if (rawCursor) {
      if (rawCursor.length > 512) return res.status(400).json({ error: 'cursor is invalid.' });
      try {
        const decoded = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8'));
        if (!decoded || typeof decoded.createdAt !== 'string' || !decoded.createdAt ||
            typeof decoded.id !== 'string' || !decoded.id || Object.keys(decoded).some((key) => !['createdAt', 'id'].includes(key))) {
          return res.status(400).json({ error: 'cursor is invalid.' });
        }
        cursor = { createdAt: decoded.createdAt, id: decoded.id };
      } catch {
        return res.status(400).json({ error: 'cursor is invalid.' });
      }
    }

    const params: Array<string | number> = [];
    const filters: string[] = [];
    if (domain) {
      filters.push('domain = ?');
      params.push(domain);
    }
    if (cursor) {
      filters.push('(created_at < ? OR (created_at = ? AND id < ?))');
      params.push(cursor.createdAt, cursor.createdAt, cursor.id);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const rows = this.db.query<any>(
      `SELECT * FROM ledger_entries ${where} ORDER BY created_at DESC, id DESC LIMIT ?`,
      [...params, rawLimit + 1]
    );
    const hasMore = rows.length > rawLimit;
    const entries = hasMore ? rows.slice(0, rawLimit) : rows;
    const last = entries[entries.length - 1];
    const nextCursor = hasMore && last
      ? Buffer.from(JSON.stringify({ createdAt: last.created_at, id: last.id })).toString('base64url')
      : null;
    return res.json({ entries, nextCursor, hasMore, limit: rawLimit });
  };

  public getAuditLogs = (req: Request, res: Response) => {
    const limit = req.query.limit === undefined ? 100 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'limit must be an integer between 1 and 100.' });
    }
    const rawCursor = req.query.cursor === undefined ? undefined : req.query.cursor;
    let cursor: { createdAt: string; id: string } | undefined;
    if (rawCursor !== undefined) {
      if (typeof rawCursor !== 'string' || rawCursor.length > 512) return res.status(400).json({ error: 'cursor is invalid.' });
      try {
        const decoded = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8'));
        if (!decoded || typeof decoded.createdAt !== 'string' || !decoded.createdAt || decoded.createdAt.length > 64 ||
            !Number.isFinite(Date.parse(decoded.createdAt)) || typeof decoded.id !== 'string' || !decoded.id || decoded.id.length > 128 ||
            Object.keys(decoded).some((key) => !['createdAt', 'id'].includes(key))) {
          return res.status(400).json({ error: 'cursor is invalid.' });
        }
        cursor = { createdAt: decoded.createdAt, id: decoded.id };
      } catch {
        return res.status(400).json({ error: 'cursor is invalid.' });
      }
    }
    const rows = this.userRepo.getAuditEvents(limit + 1, undefined, cursor);
    const hasMore = rows.length > limit;
    const events = hasMore ? rows.slice(0, limit) : rows;
    const last = events[events.length - 1];
    const nextCursor = hasMore && last
      ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString('base64url')
      : null;
    res.json({ events, nextCursor, hasMore, limit });
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

  public getIncidentAssignees = (_req: Request, res: Response) => {
    const assignees = this.db.query<any>(
      `SELECT id, full_name, email FROM users
       WHERE is_active = 1 AND role IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN')
       ORDER BY full_name COLLATE NOCASE ASC, id ASC`
    );
    return res.json({ assignees: assignees.map((user) => ({ id: user.id, fullName: user.full_name, email: user.email })) });
  };

  private presentIncident(row: any) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      organizationId: row.organization_id || null,
      organizationName: row.organization_name || null,
      shopId: row.shop_id || null,
      shopName: row.shop_name || null,
      orderId: row.order_id || null,
      orderNumber: row.order_number || null,
      agentId: row.agent_id || null,
      agentHostname: row.agent_hostname || null,
      assignedToUserId: row.assigned_to_user_id || null,
      assigneeName: row.assignee_name || null,
      assigneeEmail: row.assignee_email || null,
      resolutionNotes: row.resolution_notes || '',
      createdByUserId: row.created_by_user_id || null,
      createdByName: row.created_by_name || null,
      updatedByUserId: row.updated_by_user_id || null,
      updatedByName: row.updated_by_name || null,
      resolvedAt: row.resolved_at || null,
      closedAt: row.closed_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private incidentCursor(raw: unknown): { createdAt: string; id: string } | null | undefined {
    if (raw === undefined) return undefined;
    if (typeof raw !== 'string' || raw.length > 512) return null;
    try {
      const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
      if (!decoded || typeof decoded.createdAt !== 'string' || !decoded.createdAt || decoded.createdAt.length > 64 ||
          !Number.isFinite(Date.parse(decoded.createdAt)) || typeof decoded.id !== 'string' || !decoded.id || decoded.id.length > 128 ||
          Object.keys(decoded).some((key) => !['createdAt', 'id'].includes(key))) return null;
      return { createdAt: decoded.createdAt, id: decoded.id };
    } catch { return null; }
  }

  public getIncidents = (req: Request, res: Response) => {
    const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ error: 'limit must be an integer between 1 and 100.' });
    const statuses = new Set(['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED']);
    const severities = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
    const status = req.query.status === undefined ? undefined : req.query.status;
    const severity = req.query.severity === undefined ? undefined : req.query.severity;
    if (status !== undefined && (typeof status !== 'string' || !statuses.has(status))) return res.status(400).json({ error: 'Unsupported incident status filter.' });
    if (severity !== undefined && (typeof severity !== 'string' || !severities.has(severity))) return res.status(400).json({ error: 'Unsupported incident severity filter.' });
    const cursor = this.incidentCursor(req.query.cursor);
    if (cursor === null) return res.status(400).json({ error: 'cursor is invalid.' });

    const filters: string[] = [];
    const params: Array<string | number | null> = [];
    if (status) { filters.push('i.status = ?'); params.push(status); }
    if (severity) { filters.push('i.severity = ?'); params.push(severity); }
    if (cursor) { filters.push('(i.created_at < ? OR (i.created_at = ? AND i.id < ?))'); params.push(cursor.createdAt, cursor.createdAt, cursor.id); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const rows = this.db.query<any>(
      `SELECT i.*, o.name AS organization_name, s.name AS shop_name, ord.order_number,
              ar.hostname AS agent_hostname, assignee.full_name AS assignee_name, assignee.email AS assignee_email,
              creator.full_name AS created_by_name, updater.full_name AS updated_by_name
       FROM platform_incidents i
       LEFT JOIN organizations o ON o.id = i.organization_id
       LEFT JOIN shops s ON s.id = i.shop_id
       LEFT JOIN orders ord ON ord.id = i.order_id
       LEFT JOIN agent_registrations ar ON ar.id = i.agent_id
       LEFT JOIN users assignee ON assignee.id = i.assigned_to_user_id
       LEFT JOIN users creator ON creator.id = i.created_by_user_id
       LEFT JOIN users updater ON updater.id = i.updated_by_user_id
       ${where}
       ORDER BY i.created_at DESC, i.id DESC LIMIT ?`,
      [...params, limit + 1]
    );
    const hasMore = rows.length > limit;
    const incidents = (hasMore ? rows.slice(0, limit) : rows).map((row) => this.presentIncident(row));
    const last = incidents[incidents.length - 1];
    const nextCursor = hasMore && last ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString('base64url') : null;
    return res.json({ incidents, nextCursor, hasMore, limit });
  };

  private parseOptionalIncidentId(body: any, key: string, fallback: string | null): { value: string | null; error?: string } {
    if (!Object.prototype.hasOwnProperty.call(body, key)) return { value: fallback };
    const value = body[key];
    if (value === null || value === '') return { value: null };
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 128) return { value: fallback, error: `${key} must be a valid identifier or null.` };
    return { value: value.trim() };
  }

  private validateIncidentLinks(input: { organizationId: string | null; shopId: string | null; orderId: string | null; agentId: string | null; assignedToUserId: string | null }): { values?: typeof input; error?: string } {
    const orgs: string[] = [];
    const shops: string[] = [];
    if (input.organizationId) {
      if (!this.db.queryOne(`SELECT id FROM organizations WHERE id = ?`, [input.organizationId])) return { error: 'Organization was not found.' };
      orgs.push(input.organizationId);
    }
    if (input.shopId) {
      const shop = this.db.queryOne<any>(`SELECT id, organization_id FROM shops WHERE id = ?`, [input.shopId]);
      if (!shop) return { error: 'Shop was not found.' };
      shops.push(shop.id); orgs.push(shop.organization_id);
    }
    if (input.orderId) {
      const order = this.db.queryOne<any>(
        `SELECT ord.id, ord.shop_id, s.organization_id FROM orders ord JOIN shops s ON s.id = ord.shop_id WHERE ord.id = ?`,
        [input.orderId]
      );
      if (!order) return { error: 'Order was not found.' };
      shops.push(order.shop_id); orgs.push(order.organization_id);
    }
    if (input.agentId) {
      const agent = this.db.queryOne<any>(
        `SELECT ar.id, ar.shop_id, s.organization_id FROM agent_registrations ar JOIN shops s ON s.id = ar.shop_id WHERE ar.id = ?`,
        [input.agentId]
      );
      if (!agent) return { error: 'Agent was not found.' };
      shops.push(agent.shop_id); orgs.push(agent.organization_id);
    }
    if (new Set(orgs).size > 1) return { error: 'Incident organization, shop, order, and agent must belong to the same organization.' };
    if (new Set(shops).size > 1) return { error: 'Incident shop, order, and agent must refer to the same shop.' };
    const organizationId = orgs[0] || null;
    const shopId = shops[0] || null;
    if (input.assignedToUserId) {
      const assignee = this.db.queryOne<any>(`SELECT id FROM users WHERE id = ? AND is_active = 1 AND role IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN')`, [input.assignedToUserId]);
      if (!assignee) return { error: 'Assignee must be an active platform administrator.' };
    }
    return { values: { ...input, organizationId, shopId } };
  }

  public createIncident = (req: Request, res: Response) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Incident request body must be an object.' });
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const severity = body.severity;
    const resolutionNotes = body.resolutionNotes === undefined ? '' : typeof body.resolutionNotes === 'string' ? body.resolutionNotes.trim() : null;
    if (!title || title.length > 160 || !description || description.length > 4000 || !['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(severity) || resolutionNotes === null || resolutionNotes.length > 4000) {
      return res.status(400).json({ error: 'Provide a title (1–160 characters), description (1–4000 characters), and supported severity.' });
    }
    const org = this.parseOptionalIncidentId(body, 'organizationId', null);
    const shop = this.parseOptionalIncidentId(body, 'shopId', null);
    const order = this.parseOptionalIncidentId(body, 'orderId', null);
    const agent = this.parseOptionalIncidentId(body, 'agentId', null);
    const assignee = this.parseOptionalIncidentId(body, 'assignedToUserId', null);
    const idErrors = [org, shop, order, agent, assignee].find((parsed) => parsed.error);
    if (idErrors?.error) return res.status(400).json({ error: idErrors.error });
    const context = this.validateIncidentLinks({ organizationId: org.value, shopId: shop.value, orderId: order.value, agentId: agent.value, assignedToUserId: assignee.value });
    if (context.error) return res.status(422).json({ error: context.error });
    const actorId = req.user?.userId;
    if (!actorId) return res.status(401).json({ error: 'Unauthenticated' });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db.execute(
        `INSERT INTO platform_incidents (id, title, description, severity, status, organization_id, shop_id, order_id, agent_id, assigned_to_user_id, resolution_notes, created_by_user_id, updated_by_user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, title, description, severity, context.values!.organizationId, context.values!.shopId, order.value, agent.value, assignee.value, resolutionNotes, actorId, actorId, now, now]
      );
      this.userRepo.logAuditEvent({
        id: crypto.randomUUID(), actorUserId: actorId, actorRole: req.user?.role,
        organizationId: context.values!.organizationId || undefined, shopId: context.values!.shopId || undefined,
        action: 'PLATFORM_INCIDENT_CREATED', targetType: 'PLATFORM_INCIDENT', targetId: id, outcome: 'SUCCESS', ipAddress: req.ip,
        details: { severity, status: 'OPEN', organizationId: context.values!.organizationId, shopId: context.values!.shopId, orderId: order.value, agentId: agent.value, assignedToUserId: assignee.value, resolutionNotes }, createdAt: now,
      });
    });
    const row = this.db.queryOne<any>(`SELECT * FROM platform_incidents WHERE id = ?`, [id]);
    return res.status(201).json({ incident: this.presentIncident(row) });
  };

  public updateIncident = (req: Request, res: Response) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Incident request body must be an object.' });
    const id = String(req.params.id || '');
    const current = this.db.queryOne<any>(`SELECT * FROM platform_incidents WHERE id = ?`, [id]);
    if (!current) return res.status(404).json({ error: 'Incident not found.' });

    const title = Object.hasOwn(body, 'title') ? (typeof body.title === 'string' ? body.title.trim() : '') : current.title;
    const description = Object.hasOwn(body, 'description') ? (typeof body.description === 'string' ? body.description.trim() : '') : current.description;
    const severity = Object.hasOwn(body, 'severity') ? body.severity : current.severity;
    const status = Object.hasOwn(body, 'status') ? body.status : current.status;
    const resolutionNotes = Object.hasOwn(body, 'resolutionNotes') ? (typeof body.resolutionNotes === 'string' ? body.resolutionNotes.trim() : null) : (current.resolution_notes || '');
    if (!title || title.length > 160 || !description || description.length > 4000 || !['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(severity) || !['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'].includes(status) || resolutionNotes === null || resolutionNotes.length > 4000) {
      return res.status(400).json({ error: 'Incident title, description, severity, or status is invalid.' });
    }
    const allowedTransitions: Record<string, string[]> = {
      OPEN: ['INVESTIGATING', 'RESOLVED', 'CLOSED'],
      INVESTIGATING: ['OPEN', 'RESOLVED', 'CLOSED'],
      RESOLVED: ['OPEN', 'CLOSED'],
      CLOSED: ['OPEN'],
    };
    if (status !== current.status && !allowedTransitions[current.status]?.includes(status)) return res.status(409).json({ error: `Incident cannot move from ${current.status} to ${status}.` });
    if (status !== current.status && ['RESOLVED', 'CLOSED'].includes(status) && !(typeof body.resolutionNotes === 'string' && body.resolutionNotes.trim())) {
      return res.status(422).json({ error: 'Provide resolution notes before resolving or closing an incident.' });
    }
    const parsed = {
      organizationId: this.parseOptionalIncidentId(body, 'organizationId', current.organization_id || null),
      shopId: this.parseOptionalIncidentId(body, 'shopId', current.shop_id || null),
      orderId: this.parseOptionalIncidentId(body, 'orderId', current.order_id || null),
      agentId: this.parseOptionalIncidentId(body, 'agentId', current.agent_id || null),
      assignedToUserId: this.parseOptionalIncidentId(body, 'assignedToUserId', current.assigned_to_user_id || null),
    };
    const invalidId = Object.values(parsed).find((result) => result.error);
    if (invalidId?.error) return res.status(400).json({ error: invalidId.error });
    const context = this.validateIncidentLinks({
      organizationId: parsed.organizationId.value, shopId: parsed.shopId.value, orderId: parsed.orderId.value,
      agentId: parsed.agentId.value, assignedToUserId: parsed.assignedToUserId.value,
    });
    if (context.error) return res.status(422).json({ error: context.error });
    const actorId = req.user?.userId;
    if (!actorId) return res.status(401).json({ error: 'Unauthenticated' });
    const now = new Date().toISOString();
    const resolvedAt = status === 'RESOLVED' ? (current.resolved_at || now) : null;
    const closedAt = status === 'CLOSED' ? (current.closed_at || now) : null;
    const changedFields = ['title', 'description', 'severity', 'status', 'organizationId', 'shopId', 'orderId', 'agentId', 'assignedToUserId', 'resolutionNotes']
      .filter((key) => key === 'organizationId' ? context.values!.organizationId !== (current.organization_id || null)
        : key === 'shopId' ? context.values!.shopId !== (current.shop_id || null)
          : key === 'orderId' ? parsed.orderId.value !== (current.order_id || null)
            : key === 'agentId' ? parsed.agentId.value !== (current.agent_id || null)
              : key === 'assignedToUserId' ? parsed.assignedToUserId.value !== (current.assigned_to_user_id || null)
                : key === 'resolutionNotes' ? resolutionNotes !== (current.resolution_notes || '')
                : (key === 'title' ? title : key === 'description' ? description : key === 'severity' ? severity : status) !== current[key]);
    this.db.transaction(() => {
      const changed = this.db.queryOne<{ id: string }>(
        `UPDATE platform_incidents SET title = ?, description = ?, severity = ?, status = ?, organization_id = ?, shop_id = ?, order_id = ?, agent_id = ?, assigned_to_user_id = ?, resolution_notes = ?, updated_by_user_id = ?, resolved_at = ?, closed_at = ?, updated_at = ? WHERE id = ? AND updated_at = ? RETURNING id`,
        [title, description, severity, status, context.values!.organizationId, context.values!.shopId, parsed.orderId.value, parsed.agentId.value, parsed.assignedToUserId.value, resolutionNotes, actorId, resolvedAt, closedAt, now, id, current.updated_at]
      );
      if (!changed) throw new Error('Incident changed concurrently. Reload before updating it again.');
      this.userRepo.logAuditEvent({
        id: crypto.randomUUID(), actorUserId: actorId, actorRole: req.user?.role,
        organizationId: context.values!.organizationId || undefined, shopId: context.values!.shopId || undefined,
        action: 'PLATFORM_INCIDENT_UPDATED', targetType: 'PLATFORM_INCIDENT', targetId: id, outcome: 'SUCCESS', ipAddress: req.ip,
        details: { changedFields, previousStatus: current.status, status, previousSeverity: current.severity, severity, assignedToUserId: parsed.assignedToUserId.value, previousResolutionNotes: current.resolution_notes || '', resolutionNotes }, createdAt: now,
      });
    });
    const updated = this.db.queryOne<any>(
      `SELECT i.*, o.name AS organization_name, s.name AS shop_name, ord.order_number,
              ar.hostname AS agent_hostname, assignee.full_name AS assignee_name, assignee.email AS assignee_email,
              creator.full_name AS created_by_name, updater.full_name AS updated_by_name
       FROM platform_incidents i LEFT JOIN organizations o ON o.id = i.organization_id LEFT JOIN shops s ON s.id = i.shop_id
       LEFT JOIN orders ord ON ord.id = i.order_id LEFT JOIN agent_registrations ar ON ar.id = i.agent_id
       LEFT JOIN users assignee ON assignee.id = i.assigned_to_user_id LEFT JOIN users creator ON creator.id = i.created_by_user_id
       LEFT JOIN users updater ON updater.id = i.updated_by_user_id WHERE i.id = ?`, [id]
    );
    return res.json({ incident: this.presentIncident(updated) });
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

  public listBillingTariffs = (req: Request, res: Response) => {
    const organizationId = String(req.params.organizationId || '');
    if (!this.db.queryOne(`SELECT id FROM organizations WHERE id = ?`, [organizationId])) return res.status(404).json({ error: 'Organization not found.' });
    return res.json(this.pilotBilling.listTariffs(organizationId));
  };

  public addBillingTariff = (req: Request, res: Response) => {
    const organizationId = String(req.params.organizationId || '');
    try {
      const tariff = this.db.transaction(() => {
        const created = this.pilotBilling.addTariff({
          organizationId,
          monthlyBasePaise: req.body?.monthlyBasePaise,
          perSidePaise: req.body?.perSidePaise,
          includedSides: req.body?.includedSides ?? 0,
          effectiveFrom: req.body?.effectiveFrom,
          createdBy: req.user!.userId,
        });
        this.userRepo.logAuditEvent({
          id: crypto.randomUUID(), actorUserId: req.user?.userId, actorRole: req.user?.role,
          organizationId, action: 'PILOT_BILLING_TARIFF_CREATED', targetType: 'BILLING_TARIFF', targetId: created.id,
          outcome: 'SUCCESS', ipAddress: req.ip,
          details: { monthlyBasePaise: created.monthlyBasePaise, perSidePaise: created.perSidePaise, includedSides: created.includedSides, effectiveFrom: created.effectiveFrom },
          createdAt: new Date().toISOString(),
        });
        return created;
      });
      return res.status(201).json({ tariff });
    } catch (error) {
      if (error instanceof PilotBillingError) return res.status(error.statusCode).json({ error: error.message });
      throw error;
    }
  };

  public listBillingInvoices = (req: Request, res: Response) => {
    const organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const rawLimit = Number(req.query.limit ?? 100);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.floor(rawLimit))) : 100;
    return res.json(this.pilotBilling.listInvoices(organizationId, limit));
  };

  public issueBillingInvoice = (req: Request, res: Response) => {
    const organizationId = typeof req.body?.organizationId === 'string' ? req.body.organizationId : '';
    try {
      const result = this.db.transaction(() => {
        const issued = this.pilotBilling.issueMonthlyInvoice(organizationId, req.body?.period, req.user!.userId);
        if (issued.created) {
          this.userRepo.logAuditEvent({
            id: crypto.randomUUID(), actorUserId: req.user?.userId, actorRole: req.user?.role,
            organizationId, action: 'PILOT_BILLING_INVOICE_ISSUED', targetType: 'SUBSCRIPTION_INVOICE', targetId: issued.invoice.id,
            outcome: 'SUCCESS', ipAddress: req.ip,
            details: { periodStart: issued.invoice.periodStart, periodEnd: issued.invoice.periodEnd, totalPaise: issued.invoice.totalPaise, currency: issued.invoice.currency },
            createdAt: new Date().toISOString(),
          });
        }
        return issued;
      });
      return res.status(result.created ? 201 : 200).json(result);
    } catch (error) {
      if (error instanceof PilotBillingError) return res.status(error.statusCode).json({ error: error.message });
      throw error;
    }
  };
}
