import * as crypto from 'node:crypto';

export interface PlatformRazorpayConfig {
  keyId: string;
  secret: string;
  webhookSecret: string;
  mode: 'TEST' | 'LIVE';
}

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
}

export interface RazorpayPaymentResult {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  captured?: boolean;
}

export interface RazorpayOrderLookup {
  id: string;
  amount: number;
  currency: string;
  receipt: string | null;
  status: string;
}

export class PlatformBillingProviderError extends Error {
  constructor(message: string, public readonly uncertain = false) { super(message); }
}

/** Platform SaaS charges use a dedicated Razorpay account, never shop credentials. */
export class PlatformSubscriptionProvider {
  getConfig(): PlatformRazorpayConfig | null {
    const keyId = (process.env.INKLLY_RAZORPAY_KEY_ID || '').trim();
    const secret = process.env.INKLLY_RAZORPAY_KEY_SECRET || '';
    const webhookSecret = process.env.INKLLY_RAZORPAY_WEBHOOK_SECRET || '';
    if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId) || secret.length < 8 || webhookSecret.length < 16) return null;
    return { keyId, secret, webhookSecret, mode: keyId.startsWith('rzp_test_') ? 'TEST' : 'LIVE' };
  }

  readiness() {
    const keyId = (process.env.INKLLY_RAZORPAY_KEY_ID || '').trim();
    const secret = process.env.INKLLY_RAZORPAY_KEY_SECRET || '';
    const webhookSecret = process.env.INKLLY_RAZORPAY_WEBHOOK_SECRET || '';
    const mode = keyId.startsWith('rzp_test_') ? 'TEST' : keyId.startsWith('rzp_live_') ? 'LIVE' : null;
    const credentialsConfigured = /^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId) && secret.length >= 8;
    const webhookConfigured = webhookSecret.length >= 16;
    return {
      provider: 'RAZORPAY',
      mode,
      credentialsConfigured,
      webhookConfigured,
      checkoutReady: credentialsConfigured && webhookConfigured,
      webhookReady: credentialsConfigured && webhookConfigured,
      requiredEnvironment: ['INKLLY_RAZORPAY_KEY_ID', 'INKLLY_RAZORPAY_KEY_SECRET', 'INKLLY_RAZORPAY_WEBHOOK_SECRET'],
    } as const;
  }

  verifyCheckoutSignature(orderId: string, paymentId: string, suppliedHex: string): boolean {
    const config = this.getConfig();
    if (!config || !/^[a-f0-9]{64}$/i.test(suppliedHex)) return false;
    const expected = crypto.createHmac('sha256', config.secret).update(`${orderId}|${paymentId}`).digest();
    const supplied = Buffer.from(suppliedHex, 'hex');
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  }

  verifyWebhookSignature(rawBody: Buffer, suppliedHex: string): boolean {
    const config = this.getConfig();
    if (!config || !/^[a-f0-9]{64}$/i.test(suppliedHex)) return false;
    const expected = crypto.createHmac('sha256', config.webhookSecret).update(rawBody).digest();
    const supplied = Buffer.from(suppliedHex, 'hex');
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  }

  async createOrder(input: { attemptId: string; amountPaise: number; organizationId: string }): Promise<RazorpayOrderResult> {
    const config = this.getConfig();
    if (!config) throw new PlatformBillingProviderError('Platform Razorpay credentials are not configured.');
    let response: Response;
    try {
      response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.keyId}:${config.secret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: input.amountPaise,
          currency: 'INR',
          receipt: input.attemptId,
          notes: { inklly_billing_attempt_id: input.attemptId, inklly_organization_id: input.organizationId },
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new PlatformBillingProviderError('Razorpay order creation outcome is uncertain; reconcile before retrying.', true);
    }
    const result = await response.json().catch(() => ({})) as any;
    if (!response.ok) throw new PlatformBillingProviderError('Razorpay rejected subscription checkout creation.');
    if (typeof result.id !== 'string' || result.id.length < 6 || result.id.length > 128 || result.amount !== input.amountPaise || result.currency !== 'INR') {
      throw new PlatformBillingProviderError('Razorpay returned an invalid subscription order; reconcile before retrying.', true);
    }
    return { id: result.id, amount: result.amount, currency: result.currency };
  }

  async fetchPayment(paymentId: string): Promise<RazorpayPaymentResult | null> {
    const config = this.getConfig();
    if (!config) throw new PlatformBillingProviderError('Platform Razorpay credentials are not configured.');
    let response: Response;
    try {
      response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${config.keyId}:${config.secret}`).toString('base64')}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new PlatformBillingProviderError('Razorpay payment verification is temporarily unavailable.', true);
    }
    const result = await response.json().catch(() => ({})) as any;
    if (!response.ok) return null;
    if (typeof result.id !== 'string' || typeof result.order_id !== 'string' || !Number.isSafeInteger(result.amount) || typeof result.currency !== 'string' || typeof result.status !== 'string') return null;
    return {
      id: result.id,
      order_id: result.order_id,
      amount: result.amount,
      currency: result.currency,
      status: result.status,
      captured: result.captured === true,
    };
  }

  async fetchOrder(orderId: string): Promise<RazorpayOrderLookup | null> {
    const config = this.getConfig();
    if (!config) throw new PlatformBillingProviderError('Platform Razorpay credentials are not configured.');
    let response: Response;
    try {
      response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${config.keyId}:${config.secret}`).toString('base64')}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new PlatformBillingProviderError('Razorpay order reconciliation is temporarily unavailable.', true);
    }
    const result = await response.json().catch(() => ({})) as any;
    if (!response.ok) return null;
    if (typeof result.id !== 'string' || !Number.isSafeInteger(result.amount) || typeof result.currency !== 'string' || typeof result.status !== 'string') return null;
    return { id: result.id, amount: result.amount, currency: result.currency, receipt: typeof result.receipt === 'string' ? result.receipt : null, status: result.status };
  }
}
