import { Request, Response } from 'express';
import { DatabaseService, EnquiryRepository, LedgerRepository, UserRepository } from '@inklly/db';
import { SubscriptionPlan, MoneyDomain } from '@inklly/shared';
import * as crypto from 'node:crypto';

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
    private enquiryRepo: EnquiryRepository
  ) {}

  public getOverview = (req: Request, res: Response) => {
    const orgs = this.db.query<any>(`SELECT COUNT(*) as count FROM organizations`);
    const shops = this.db.query<any>(`SELECT COUNT(*) as count FROM shops`);
    const orders = this.db.query<any>(`SELECT COUNT(*) as count FROM orders`);
    const agents = this.db.query<any>(`SELECT COUNT(*) as count FROM agent_registrations WHERE is_active = 1`);

    const gmvRow = this.db.queryOne<any>(
      `SELECT SUM(amount_paise) as total FROM ledger_entries WHERE domain = 'CUSTOMER_PRINT_PAYMENT'`
    );
    const mrrRow = this.db.queryOne<any>(
      `SELECT SUM(amount_paise) as total FROM ledger_entries WHERE domain = 'SAAS_SUBSCRIPTION'`
    );

    res.json({
      metrics: {
        totalOrganizations: orgs[0]?.count || 0,
        totalShops: shops[0]?.count || 0,
        totalOrdersProcessed: orders[0]?.count || 0,
        activePrintAgents: agents[0]?.count || 0,
        platformGMVPaise: gmvRow?.total || 24000,
        platformMRRPaise: mrrRow?.total || 249900,
      },
      health: {
        apiStatus: 'HEALTHY',
        databaseEngine: 'node:sqlite (sync ACID transactions)',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      },
    });
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
}
