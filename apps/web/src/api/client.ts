const isProduction = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
export const API_BASE = (import.meta.env.VITE_API_BASE as string) || (isProduction ? 'https://inklly.onrender.com/api/v1' : 'http://localhost:4000/api/v1');

function getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem('inklly_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  async submitEnquiry(payload: { source: 'HOME' | 'CONTACT'; name: string; phone: string; email?: string; message: string; city?: string; state?: string; website?: string }, idempotencyKey: string) {
    const res = await fetch(`${API_BASE}/enquiry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not send your enquiry. Please try again.');
    if (typeof body.id !== 'string' || body.status !== 'OPEN') {
      throw new Error('The enquiry service is updating. Please try again shortly.');
    }
    return body as { id: string; status: string; message: string };
  },

  // Public Customer QR Portal
  async getShop(shopCode: string) {
    const res = await fetch(`${API_BASE}/portal/shop/${shopCode}`);
    if (!res.ok) throw new Error('Shop offline or not found');
    return res.json();
  },

  async uploadDocument(uploadPayload: { fileName: string; fileData: string; mimeType?: string; shopId?: string; pageCount?: number }) {
    const res = await fetch(`${API_BASE}/portal/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(uploadPayload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  },

  async getQuote(quoteRequest: any) {
    const res = await fetch(`${API_BASE}/portal/quote`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(quoteRequest),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to calculate quote');
    }
    return res.json();
  },

  async submitOrder(orderPayload: any) {
    const res = await fetch(`${API_BASE}/portal/orders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(orderPayload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to submit order');
    }
    return res.json();
  },

  async getOrderStatus(orderId: string) {
    const res = await fetch(`${API_BASE}/portal/orders/${orderId}`);
    if (!res.ok) throw new Error('Order not found');
    return res.json();
  },

  // Auth
  async register(registrationData: any) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(err.error || 'Registration failed');
    }
    return res.json();
  },

  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }
    return res.json();
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Unauthenticated');
    return res.json();
  },

  // Merchant Operating Workspace
  async getDashboard() {
    const res = await fetch(`${API_BASE}/merchant/dashboard`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load merchant dashboard');
    return res.json();
  },

  async getOrders(statusFilter?: string) {
    const url = statusFilter && statusFilter !== 'ALL'
      ? `${API_BASE}/merchant/orders?status=${statusFilter}`
      : `${API_BASE}/merchant/orders`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load orders');
    return res.json();
  },

  async previewOrderFile(orderId: string, fileId: string) {
    const preview = window.open('', '_blank');
    if (!preview) throw new Error('Allow pop-ups to preview this document');
    const res = await fetch(`${API_BASE}/merchant/orders/${encodeURIComponent(orderId)}/files/${encodeURIComponent(fileId)}`, { headers: getHeaders({ 'Content-Type': '' }) });
    if (!res.ok) { preview.close(); throw new Error('Could not open this document'); }
    const blobUrl = URL.createObjectURL(await res.blob());
    preview.location.href = blobUrl;
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  },

  async updateOrderStatus(orderId: string, status: string) {
    const res = await fetch(`${API_BASE}/merchant/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to transition order status');
    }
    return res.json();
  },

  async dispatchPrint(orderId: string) {
    const res = await fetch(`${API_BASE}/merchant/orders/${orderId}/print`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Print dispatch failed');
    }
    return res.json();
  },

  async collectCash(orderId: string) {
    const res = await fetch(`${API_BASE}/payments/orders/${orderId}/collect-cash`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to record cash');
    return res.json();
  },

  // Refunds
  async createRefund(orderId: string, amountPaise: number, reason: string) {
    const res = await fetch(`${API_BASE}/payments/orders/${orderId}/refunds`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ amountPaise, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Refund failed' }));
      throw new Error(err.error || 'Refund failed');
    }
    return res.json();
  },

  async listRefunds() {
    const res = await fetch(`${API_BASE}/payments/refunds`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load refunds');
    return res.json();
  },

  async processRefund(refundId: string, action: 'APPROVE' | 'REJECT', reason?: string) {
    const res = await fetch(`${API_BASE}/payments/refunds/${refundId}/process`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Refund processing failed' }));
      throw new Error(err.error || 'Refund processing failed');
    }
    return res.json();
  },

  async getRates() {
    const res = await fetch(`${API_BASE}/merchant/rates`, { headers: getHeaders() });
    return res.json();
  },

  async updateRate(rateData: any) {
    const res = await fetch(`${API_BASE}/merchant/rates`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(rateData),
    });
    return res.json();
  },

  async getPrinters() {
    const res = await fetch(`${API_BASE}/merchant/printers`, { headers: getHeaders() });
    return res.json();
  },

  async addPrinter(printerData: any) {
    const res = await fetch(`${API_BASE}/merchant/printers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(printerData),
    });
    return res.json();
  },

  async createAgentPairingCode() {
    const res = await fetch(`${API_BASE}/merchant/agents/pairing-code`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not create agent pairing code');
    return body as { pairingCode: string; expiresAt: string; shopId: string };
  },

  async getRazorpayCredentials() {
    const res = await fetch(`${API_BASE}/merchant/settings/razorpay`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not load Razorpay settings');
    return { ...body, webhookUrl: body.shopId ? `${API_BASE}/payments/webhook/razorpay/${encodeURIComponent(body.shopId)}` : '' };
  },

  async saveRazorpayCredentials(credentials: { keyId: string; secret: string; webhookSecret: string }) {
    const res = await fetch(`${API_BASE}/merchant/settings/razorpay`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(credentials),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not save Razorpay settings');
    return { ...body, webhookUrl: body.shopId ? `${API_BASE}/payments/webhook/razorpay/${encodeURIComponent(body.shopId)}` : '' };
  },

  async removeRazorpayCredentials() {
    const res = await fetch(`${API_BASE}/merchant/settings/razorpay`, { method: 'DELETE', headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not remove Razorpay settings');
    return body;
  },

  async createPaymentIntent(orderId: string) {
    const res = await fetch(`${API_BASE}/payments/create-intent`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ orderId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not start online payment');
    return body as { success: boolean; razorpayOrderId: string; keyId: string; amount: number; currency: string };
  },

  async verifyRazorpayPayment(payment: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    const res = await fetch(`${API_BASE}/payments/verify`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(payment),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Payment status is still being confirmed');
    return body;
  },

  async getShopSettings() {
    const res = await fetch(`${API_BASE}/merchant/settings`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load shop settings');
    return res.json();
  },

  async updateShopSettings(updates: any) {
    const res = await fetch(`${API_BASE}/merchant/settings`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update shop settings');
    return res.json();
  },

  async getStaff() {
    const res = await fetch(`${API_BASE}/merchant/staff`, { headers: getHeaders() });
    return res.json();
  },

  async addStaff(staffData: any) {
    const res = await fetch(`${API_BASE}/merchant/staff`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(staffData),
    });
    return res.json();
  },

  async getBotTemplates() {
    const res = await fetch(`${API_BASE}/merchant/bot-templates`, { headers: getHeaders() });
    return res.json();
  },

  async updateBotTemplate(templateData: any) {
    const res = await fetch(`${API_BASE}/merchant/bot-templates`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(templateData),
    });
    return res.json();
  },

  // Credits
  async getCreditBalance() {
    const res = await fetch(`${API_BASE}/merchant/credits/balance`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load credit balance');
    return res.json();
  },

  async purchaseCredits(amountPaise: number, paymentMethod: 'ONLINE_RAZORPAY' | 'MANUAL_CASH' = 'ONLINE_RAZORPAY') {
    const res = await fetch(`${API_BASE}/merchant/credits/purchase`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ amountPaise, paymentMethod }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Credit purchase failed' }));
      throw new Error(err.error || 'Credit purchase failed');
    }
    return res.json();
  },

  // Payouts / Withdrawals
  async getPayouts() {
    const res = await fetch(`${API_BASE}/merchant/payouts`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load payouts');
    return res.json();
  },

  async requestPayout(amountPaise: number, destinationAccountMasked: string) {
    const res = await fetch(`${API_BASE}/merchant/payouts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ amountPaise, destinationAccountMasked }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Payout request failed' }));
      throw new Error(err.error || 'Payout request failed');
    }
    return res.json();
  },

  // Platform Owner Console
  async getPlatformOverview() {
    const res = await fetch(`${API_BASE}/platform/overview`, { headers: getHeaders() });
    return res.json();
  },

  async getPlatformMerchants() {
    const res = await fetch(`${API_BASE}/platform/merchants`, { headers: getHeaders() });
    return res.json();
  },

  async updateMerchantStatus(orgId: string, updates: any) {
    const res = await fetch(`${API_BASE}/platform/merchants/${orgId}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async getPlatformLedger(domain?: string) {
    const url = domain ? `${API_BASE}/platform/ledger?domain=${domain}` : `${API_BASE}/platform/ledger`;
    const res = await fetch(url, { headers: getHeaders() });
    return res.json();
  },

  async getAuditLogs() {
    const res = await fetch(`${API_BASE}/platform/audit-logs`, { headers: getHeaders() });
    return res.json();
  },

  async getPlatformEnquiries() {
    const res = await fetch(`${API_BASE}/platform/enquiries?limit=100`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to load enquiries');
    return body;
  },

  // Subscriptions
  async getSubscriptions() {
    const res = await fetch(`${API_BASE}/platform/subscriptions`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load subscriptions');
    return res.json();
  },

  async createSubscription(data: { organizationId: string; planId: string; planTier: string; amountPaise: number; currency?: string }) {
    const res = await fetch(`${API_BASE}/platform/subscriptions`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Subscription creation failed' }));
      throw new Error(err.error || 'Subscription creation failed');
    }
    return res.json();
  },

  async updateSubscription(subId: string, data: { status?: string; cancelAtPeriodEnd?: boolean; planTier?: string }) {
    const res = await fetch(`${API_BASE}/platform/subscriptions/${subId}`, {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Subscription update failed' }));
      throw new Error(err.error || 'Subscription update failed');
    }
    return res.json();
  },

  // Developer Portal
  async getOpenApiSpec() {
    const res = await fetch(`${API_BASE}/developer/openapi.json`);
    return res.json();
  },

  async getApiKeys() {
    const res = await fetch(`${API_BASE}/developer/keys`, { headers: getHeaders() });
    if (!res.ok) throw new Error((await res.json()).error || 'Could not load API keys');
    return res.json();
  },

  async getWebhooks() {
    const res = await fetch(`${API_BASE}/developer/webhooks`, { headers: getHeaders() });
    if (!res.ok) throw new Error((await res.json()).error || 'Could not load webhooks');
    return res.json();
  },

  async createApiKey(keyData: any) {
    const res = await fetch(`${API_BASE}/developer/keys`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(keyData),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Could not create API key');
    return res.json();
  },

  async revokeApiKey(keyId: string) {
    const res = await fetch(`${API_BASE}/developer/keys/${keyId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Could not revoke API key');
    return res.json();
  },

  async testWebhook(eventType: string) {
    const res = await fetch(`${API_BASE}/developer/test-webhook`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ eventType }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Could not generate webhook preview');
    return res.json();
  },
};
