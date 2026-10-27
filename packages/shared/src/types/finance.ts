export type MoneyDomain =
  | 'CUSTOMER_PRINT_PAYMENT'
  | 'SAAS_SUBSCRIPTION'
  | 'CONVERSION_CREDIT'
  | 'MERCHANT_PAYOUT'
  | 'REFUND_DISPUTE'
  | 'REFERRAL_REWARD';

export interface LedgerEntry {
  id: string;
  domain: MoneyDomain;
  organizationId?: string;
  shopId?: string;
  orderId?: string;
  amountPaise: number; // positive = credit/inflow, negative = debit/outflow
  currency: string;
  provider: 'RAZORPAY' | 'STRIPE' | 'INTERNAL_CREDIT' | 'MANUAL_CASH' | 'PENDING_PROVIDER';
  providerTransactionId?: string;
  providerEventId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface SubscriptionPlan {
  id: string;
  tier: 'STARTER' | 'GROWTH' | 'PRO' | 'SCALE';
  name: string;
  monthlyPricePaise: number;
  annualPricePaise: number;
  currency: string;
  orderLimitMonthly: number;
  printerLimit: number;
  fileSizeMaxMB: number;
  includedConversionCredits: number;
  features: string[];
}
