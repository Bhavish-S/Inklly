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

  async submitOrder(orderPayload: any, idempotencyKey: string = crypto.randomUUID()) {
    const res = await fetch(`${API_BASE}/portal/orders`, {
      method: 'POST',
      headers: getHeaders({ 'Idempotency-Key': idempotencyKey }),
      body: JSON.stringify(orderPayload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err.error || 'Failed to submit order') as Error & { currentQuote?: any };
      error.currentQuote = err.currentQuote;
      throw error;
    }
    return res.json();
  },

  async getOrderStatus(orderId: string) {
    const res = await fetch(`${API_BASE}/portal/orders/${encodeURIComponent(orderId)}`);
    if (!res.ok) throw new Error(res.status === 404 ? 'Order not found' : 'Could not load order status');
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

  async updateMe(profile: { fullName: string; phone: string | null }) {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(profile),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to update account profile');
    return body;
  },

  async changePassword(passwords: { currentPassword: string; newPassword: string }) {
    const res = await fetch(`${API_BASE}/auth/password`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(passwords),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to change password');
    return body;
  },

  // Appearance & Account settings
  async getPreferences() {
    const res = await fetch(`${API_BASE}/auth/preferences`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load preferences');
    return res.json();
  },

  async updatePreferences(preferences: { theme?: string; language?: string; emailNotifications?: boolean; smsNotifications?: boolean }) {
    const res = await fetch(`${API_BASE}/auth/preferences`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(preferences),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to update preferences');
    }
    return res.json();
  },

  async requestPasswordReset(email: string) {
    const res = await fetch(`${API_BASE}/auth/password-reset/request`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error('Password reset request failed');
    return res.json();
  },

  async getSessions() {
    const res = await fetch(`${API_BASE}/auth/sessions`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load sessions');
    return res.json();
  },

  async revokeSession(sessionId: string) {
    const res = await fetch(`${API_BASE}/auth/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to revoke session');
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

  async getOrders(statusFilter?: string, options?: { page?: number; pageSize?: number; search?: string; sortBy?: 'createdAt' | 'totalAmountPaise' | 'status' | 'orderNumber'; sortOrder?: 'asc' | 'desc' }) {
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);
    if (options) {
      if (options.page !== undefined) params.set('page', String(options.page));
      if (options.pageSize !== undefined) params.set('pageSize', String(options.pageSize));
      if (options.search) params.set('search', options.search);
      if (options.sortBy) params.set('sortBy', options.sortBy);
      if (options.sortOrder) params.set('sortOrder', options.sortOrder);
    }
    const query = params.toString();
    const url = `${API_BASE}/merchant/orders${query ? `?${query}` : ''}`;
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

  async dispatchPrint(orderId: string, printerId?: string) {
    const res = await fetch(`${API_BASE}/merchant/orders/${orderId}/print`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(printerId ? { printerId } : {}),
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
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to record cash');
    return body;
  },

  async getSubscriptionUsage() {
    const res = await fetch(`${API_BASE}/subscriptions/usage`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not load print-side usage');
    return body as { periodStart: string; periodEnd: string; confirmedOrders: number; confirmedSides: number; meter: string; billingStatus: 'METERING_ONLY'; chargeCreated: false };
  },

  async getSubscriptionBillingReadiness() {
    const res = await fetch(`${API_BASE}/subscriptions/billing/readiness`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not load subscription billing status');
    return body as {
      provider: 'RAZORPAY'; mode: 'TEST' | 'LIVE' | null; credentialsConfigured: boolean;
      keyId: string | null; webhookConfigured: boolean; checkoutReady: boolean; tariffConfigured: boolean;
      monthlyBasePaise: number | null; perSidePaise: number | null; includedSides: number | null;
      activeSubscriptionEndsAt: string | null; checkoutAvailable: boolean; usageStatementsRemainManual: boolean;
    };
  },

  async getSubscriptionBillingAttempts() {
    const res = await fetch(`${API_BASE}/subscriptions/billing/attempts`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not load subscription payment history');
    return body as Array<{ id: string; status: string; amountPaise: number; currency: string; providerOrderId: string | null; periodStart: string; periodEnd: string; failureCode: string | null; createdAt: string; capturedAt: string | null }>;
  },

  async createSubscriptionCheckout(planId: string, idempotencyKey: string) {
    const res = await fetch(`${API_BASE}/subscriptions/checkout`, {
      method: 'POST', headers: getHeaders({ 'Idempotency-Key': idempotencyKey }),
      body: JSON.stringify({ planId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not start subscription checkout');
    return body as { success: boolean; duplicate?: boolean; razorpayOrderId: string; keyId: string; amount: number; currency: string; attempt: { id: string; status: string } };
  },

  async verifySubscriptionCheckout(payment: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    const res = await fetch(`${API_BASE}/subscriptions/verify`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payment) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Subscription payment is still being confirmed');
    return body;
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

  async processRefund(refundId: string, action: 'APPROVE' | 'REJECT' | 'RECORD_OFFLINE', reason?: string, cashReturned = false) {
    const res = await fetch(`${API_BASE}/payments/refunds/${refundId}/process`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action, reason, cashReturned }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Refund processing failed' }));
      throw new Error(err.error || 'Refund processing failed');
    }
    return res.json();
  },

  async getRates() {
    const res = await fetch(`${API_BASE}/merchant/rates`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not load rate rules');
    return body;
  },

  async updateRate(rateData: any) {
    const res = await fetch(`${API_BASE}/merchant/rates`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(rateData),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not save rate rule');
    return body;
  },

  async updateDiscountSettings(settings: any) {
    const res = await fetch(`${API_BASE}/merchant/discounts`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(settings),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not save discount settings');
    return body;
  },

  async getPrinters() {
    const res = await fetch(`${API_BASE}/merchant/printers`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not load printers');
    return body;
  },

  async reconcilePrintOutput(orderId: string, reason: string, confirmedJobIds?: string[]) {
    const res = await fetch(`${API_BASE}/merchant/orders/${encodeURIComponent(orderId)}/reconcile-output`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ physicalOutputConfirmed: true, reason, ...(confirmedJobIds ? { confirmedJobIds } : {}) }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not reconcile print output');
    return body;
  },

  async addPrinter(printerData: any) {
    const res = await fetch(`${API_BASE}/merchant/printers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(printerData),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not save printer');
    return body;
  },

  async setDefaultPrinter(printerId: string) {
    const res = await fetch(`${API_BASE}/merchant/printers/${encodeURIComponent(printerId)}/default`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not set the default printer');
    return body;
  },

  async getStorageCategories() {
    const res = await fetch(`${API_BASE}/merchant/storage/categories`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not load storage categories');
    return body as Array<{ id: string; name: string; description?: string; documentCount: number; createdAt: string }>;
  },

  async createStorageCategory(name: string, description?: string) {
    const res = await fetch(`${API_BASE}/merchant/storage/categories`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ name, description }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not create storage category');
    return body.category;
  },

  async getStorageDocuments(options: { cursor?: string; limit?: number; categoryId?: string } = {}) {
    const params = new URLSearchParams({ limit: String(options.limit ?? 50) });
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.categoryId) params.set('categoryId', options.categoryId);
    const res = await fetch(`${API_BASE}/merchant/storage/documents?${params.toString()}`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not load stored documents');
    return body as {
      documents: Array<{
        id: string; name: string; fileName: string; mimeType: string; fileSizeBytes: number;
        pageCount: number; categoryId: string | null; categoryName: string | null; downloadUrl: string; createdAt: string;
      }>;
      total: number; uncategorizedCount: number; limit: number; nextCursor: string | null;
    };
  },

  async uploadStorageDocument(fileName: string, fileData: string, categoryId?: string) {
    const res = await fetch(`${API_BASE}/merchant/storage/documents`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ fileName, fileData, categoryId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not upload document');
    return body.document;
  },

  async downloadStorageDocument(documentId: string) {
    const res = await fetch(`${API_BASE}/merchant/storage/documents/${encodeURIComponent(documentId)}/download`, {
      headers: getHeaders({ 'Content-Type': '' }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Could not download document');
    }
    return res.blob();
  },

  async deleteStorageDocument(documentId: string) {
    const res = await fetch(`${API_BASE}/merchant/storage/documents/${encodeURIComponent(documentId)}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not delete document');
    return body;
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

  async testRazorpayCredentials() {
    const res = await fetch(`${API_BASE}/merchant/settings/razorpay/test`, {
      method: 'POST', headers: getHeaders(),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not verify Razorpay credentials');
    return body;
  },

  async removeRazorpayCredentials() {
    const res = await fetch(`${API_BASE}/merchant/settings/razorpay`, { method: 'DELETE', headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not remove Razorpay settings');
    return body;
  },

  // WhatsApp Setup
  async getWhatsAppSetup() {
    const res = await fetch(`${API_BASE}/merchant/whatsapp/setup`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Could not load WhatsApp setup');
    return res.json();
  },

  async saveWhatsAppSetup(data: { connectionType: string; businessPhoneNumber?: string; displayName?: string; metaAppId?: string; metaAppSecret?: string }) {
    const res = await fetch(`${API_BASE}/merchant/whatsapp/setup`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not save WhatsApp setup');
    return body;
  },

  async generateWhatsAppQrPairing() {
    const res = await fetch(`${API_BASE}/merchant/whatsapp/qr-pairing`, { method: 'POST', headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not start QR pairing');
    return body;
  },

  async refreshWhatsAppQrPairing() {
    const res = await fetch(`${API_BASE}/merchant/whatsapp/qr-pairing/refresh`, { method: 'POST', headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not refresh QR pairing');
    return body;
  },

  async removeWhatsAppAccount(accountId: string) {
    const res = await fetch(`${API_BASE}/merchant/whatsapp/account/${encodeURIComponent(accountId)}`, { method: 'DELETE', headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not remove WhatsApp account');
    return body;
  },

  async getWhatsAppEvents(limit?: number, offset?: number) {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    const res = await fetch(`${API_BASE}/merchant/whatsapp/events?${params.toString()}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Could not load WhatsApp events');
    return res.json();
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
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to update shop settings');
    return body;
  },

  async getStaff() {
    const res = await fetch(`${API_BASE}/merchant/staff`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to load staff accounts');
    return body;
  },

  async addStaff(staffData: any) {
    const res = await fetch(`${API_BASE}/merchant/staff`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(staffData),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to invite staff member');
    return body;
  },

  async updateStaffAccess(userId: string, access: { rolePreset: string; permissions?: string[]; isActive: boolean }) {
    const res = await fetch(`${API_BASE}/merchant/staff/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(access),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to update staff access');
    return body;
  },

  async getBotTemplates() {
    const res = await fetch(`${API_BASE}/merchant/bot-templates`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to load saved message templates');
    return body;
  },

  async updateBotTemplate(templateData: any) {
    const res = await fetch(`${API_BASE}/merchant/bot-templates`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(templateData),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to save message template');
    return body;
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
    if (!res.ok) throw new Error('Failed to load platform overview');
    return res.json();
  },

  async getPlatformAdmins() {
    const res = await fetch(`${API_BASE}/platform/admins`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not load platform admin access');
    return body;
  },

  async updatePlatformAdminPermissions(adminId: string, permissions: string[]) {
    const res = await fetch(`${API_BASE}/platform/admins/${encodeURIComponent(adminId)}/permissions`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify({ permissions }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not update platform admin permissions');
    return body;
  },

  async getPlatformAgents() {
    const res = await fetch(`${API_BASE}/platform/agents`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to load registered agent fleet');
    if (!Array.isArray(body)) throw new Error('The registered agent fleet response is invalid.');
    return body;
  },

  async getPlatformRetentionStats() {
    const res = await fetch(`${API_BASE}/platform/retention`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to load retention statistics');
    return body;
  },

  async runPlatformRetentionPurge() {
    const res = await fetch(`${API_BASE}/platform/retention/purge`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 207) throw new Error(body.error || 'Retention purge failed');
    return body;
  },

  async getPlatformMerchants() {
    const res = await fetch(`${API_BASE}/platform/merchants`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to load merchant organizations');
    return body;
  },

  async createPlatformMerchant(payload: { organizationName: string; shopCode?: string; ownerName: string; ownerEmail: string; planTier: string }) {
    const res = await fetch(`${API_BASE}/platform/merchants`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not provision merchant');
    return body;
  },

  async acceptOwnerInvitation(token: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/invitations/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not accept invitation');
    return body;
  },

  async updateMerchantStatus(orgId: string, updates: any) {
    const res = await fetch(`${API_BASE}/platform/merchants/${orgId}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to update organization');
    return body;
  },

  async getPlatformLedger(domain?: string, cursor?: string, limit = 100) {
    const params = new URLSearchParams();
    if (domain) params.set('domain', domain);
    if (cursor) params.set('cursor', cursor);
    params.set('limit', String(limit));
    const url = `${API_BASE}/platform/ledger?${params.toString()}`;
    const res = await fetch(url, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to load platform ledger');
    return body;
  },

  async getAuditLogs(cursor?: string, limit = 100) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    const res = await fetch(`${API_BASE}/platform/audit-logs?${params.toString()}`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to load audit events');
    return body;
  },

  async getPlatformEnquiries() {
    const res = await fetch(`${API_BASE}/platform/enquiries?limit=100`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to load enquiries');
    return body;
  },

  async getPlatformIncidents(cursor?: string, limit = 50, filters?: { status?: string; severity?: string }) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    if (filters?.status && filters.status !== 'ALL') params.set('status', filters.status);
    if (filters?.severity && filters.severity !== 'ALL') params.set('severity', filters.severity);
    const res = await fetch(`${API_BASE}/platform/incidents?${params.toString()}`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to load incidents');
    return body;
  },

  async createPlatformIncident(payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/platform/incidents`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to create incident');
    return body;
  },

  async updatePlatformIncident(incidentId: string, payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/platform/incidents/${encodeURIComponent(incidentId)}`, {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to update incident');
    return body;
  },

  async getPlatformIncidentAssignees() {
    const res = await fetch(`${API_BASE}/platform/incidents/assignees`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to load incident assignees');
    return body;
  },

  // Subscriptions
  async getSubscriptions() {
    const res = await fetch(`${API_BASE}/platform/subscriptions`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load subscriptions');
    return res.json();
  },

  async getSubscriptionInvoices() {
    const res = await fetch(`${API_BASE}/subscriptions/invoices`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to load billing statements');
    return body;
  },

  async getPlatformBillingInvoices(organizationId?: string) {
    const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';
    const res = await fetch(`${API_BASE}/platform/billing/invoices${query}`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to load pilot invoices');
    return body;
  },

  async getPlatformBillingTariffs(organizationId: string) {
    const res = await fetch(`${API_BASE}/platform/billing/organizations/${encodeURIComponent(organizationId)}/tariffs`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to load billing rates');
    return body;
  },

  async addPlatformBillingTariff(organizationId: string, payload: { monthlyBasePaise: number; perSidePaise: number; includedSides: number; effectiveFrom: string }) {
    const res = await fetch(`${API_BASE}/platform/billing/organizations/${encodeURIComponent(organizationId)}/tariffs`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to save pilot billing rates');
    return body;
  },

  async issuePlatformBillingInvoice(payload: { organizationId: string; period: string }) {
    const res = await fetch(`${API_BASE}/platform/billing/invoices`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to issue pilot invoice');
    return body;
  },

  async getPlatformPlans() {
    const res = await fetch(`${API_BASE}/platform/plans`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to load plan catalog');
    return body;
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

  async createWebhook(targetUrl: string, eventTypes: string[]) {
    const res = await fetch(`${API_BASE}/developer/webhooks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ targetUrl, eventTypes }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not create webhook subscription');
    return body;
  },

  async getWebhookDeliveries(webhookId: string, limit = 50, offset = 0) {
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const res = await fetch(`${API_BASE}/developer/webhooks/${encodeURIComponent(webhookId)}/deliveries?${query}`, { headers: getHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not load webhook delivery history');
    return body;
  },

  async rotateWebhookSecret(webhookId: string) {
    const res = await fetch(`${API_BASE}/developer/webhooks/${encodeURIComponent(webhookId)}/rotate-secret`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not rotate webhook secret');
    return body;
  },

  async revokeWebhook(webhookId: string) {
    const res = await fetch(`${API_BASE}/developer/webhooks/${encodeURIComponent(webhookId)}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not revoke webhook destination');
    return body;
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
