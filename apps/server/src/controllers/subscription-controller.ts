import { Request, Response } from 'express';
import { SubscriptionPlan } from '@inklly/shared';

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
  public listPlans = (_req: Request, res: Response) => {
    res.json(SUBSCRIPTION_PLANS.map(({ monthlyPricePaise: _monthly, annualPricePaise: _annual, ...plan }) => ({
      ...plan,
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
}
