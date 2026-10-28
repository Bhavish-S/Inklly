import { Request, Response } from 'express';
import { SubscriptionPlan } from '@inklly/shared';
import { DatabaseService } from '@inklly/db';

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
  constructor(private readonly db: DatabaseService) {}

  public listPlans = (_req: Request, res: Response) => {
    res.json(SUBSCRIPTION_PLANS.map(({ monthlyPricePaise: _monthly, annualPricePaise: _annual, ...plan }) => ({
      ...plan,
      catalogStatus: 'PLANNED_NOT_ENFORCED',
      pricing: 'CONFIGURED_PER_PILOT',
      monthlyPricePaise: null,
      annualPricePaise: null,
    })));
  };

  public createCheckout = async (req: Request, res: Response) => {
    return res.status(503).json({ error: 'Paid subscription checkout is not available for the pilot. No charge or subscription change was made.' });
  };

  public verifySubscription = async (req: Request, res: Response) => {
    return res.status(503).json({ error: 'Subscription payment verification is not available for the pilot.' });
  };

  public usage = (req: Request, res: Response) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(403).json({ error: 'An organization owner account is required.' });
    const subscription = this.db.queryOne<any>(
      `SELECT current_period_start, current_period_end FROM subscriptions
       WHERE organization_id = ? AND status IN ('ACTIVE', 'TRIALING', 'GRACE')
       ORDER BY created_at DESC LIMIT 1`,
      [organizationId]
    );
    const now = new Date();
    const periodStart = subscription?.current_period_start || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const periodEnd = subscription?.current_period_end || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
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
}
