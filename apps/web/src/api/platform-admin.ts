import { API_BASE } from './client';

/**
 * API helpers for the platform owner control centre (/platform).
 * Kept separate from client.ts so the console can grow without touching the
 * shared client. Session handling matches client.ts (Bearer token from
 * localStorage `inklly_token`).
 */

function headers(): Record<string, string> {
  const result: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = localStorage.getItem('inklly_token');
    if (token) result.Authorization = `Bearer ${token}`;
  } catch { /* storage unavailable: request goes unauthenticated */ }
  return result;
}

async function request<T>(path: string, init: RequestInit = {}, fallbackError = 'Request failed'): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...headers(), ...(init.headers as Record<string, string> | undefined) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error || fallbackError);
  return body as T;
}

function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === 'ALL') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

// ─── Types ────────────────────────────────────────────────────────────────

export type PaymentMethod = 'CASH_ON_COLLECTION' | 'ONLINE_RAZORPAY' | 'UPI_DIRECT';

export interface ConsoleOrder {
  id: string;
  orderNumber: string;
  tokenNumber: string | null;
  shopId: string;
  shopName: string | null;
  shopCode: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  channel: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalAmountPaise: number;
  currency: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  collectedAt: string | null;
}

export interface ConsoleAlert {
  id: string;
  level: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  target?: { tab: string; filter?: Record<string, string> };
}

export interface PlatformOverview {
  metrics: {
    shops: number;
    activeShops: number;
    shopsOnMap: number;
    ordersToday: number;
    orders7d: number;
    openOrders: number;
    gmvTodayPaise: number;
    gmv7dPaise: number;
    gmvAllTimePaise: number;
    agentsRegistered: number;
    agentsOnline: number;
    printersTotal: number;
    printersOnline: number;
    customers7d: number;
    totalOrganizations: number;
    totalShops: number;
    totalOrdersProcessed: number;
    platformGMVPaise: number;
  };
  health: { apiStatus: string; databaseEngine: string; version: string; timestamp: string };
  recentOrders: ConsoleOrder[];
  alerts: ConsoleAlert[];
}

export interface ConsoleShopRow {
  id: string;
  shopCode: string;
  name: string;
  phone: string;
  city: string;
  isActive: boolean;
  organizationId: string;
  organizationName: string;
  planTier: string;
  planStatus: string;
  owner: { name: string | null; email: string | null };
  listedOnMap: boolean;
  hasLocation: boolean;
  hasUpi: boolean;
  orders7d: number;
  lastOrderAt: string | null;
  agentsOnline: number;
  agentsRegistered: number;
  createdAt: string;
}

export interface ConsoleShopDetail {
  shop: {
    id: string; shopCode: string; name: string; tagline: string | null; phone: string; email: string; address: string; city: string;
    state: string; pinCode: string; gstin: string | null; isActive: boolean; acceptCashOnCollection: boolean; paymentGateway: string;
    createdAt: string; updatedAt: string;
  };
  organization: { id: string; name: string; planTier: string; planStatus: string; createdAt: string };
  owner: { id: string; name: string | null; email: string | null; phone: string | null; isActive: boolean } | null;
  payments: { upiId: string | null; upiPayeeName: string | null };
  profile: { latitude: number | null; longitude: number | null; landmark: string | null; openingHours: any; listedOnMap: boolean; updatedAt: string | null };
  printers: Array<{ id: string; name: string; driverName: string; isOnline: boolean; reportedOnline: boolean; isDefault: boolean; supportsColor: boolean; supportsDuplex: boolean; lastHeartbeat: string | null }>;
  agents: Array<{ agentId: string; hostname: string | null; osPlatform: string | null; osVersion: string | null; agentVersion: string | null; status: string; lastHeartbeat: string | null; createdAt: string }>;
  pairingCodePendingUntil: string | null;
  recentOrders: ConsoleOrder[];
  revenue: { todayPaise: number; last7dPaise: number; last30dPaise: number; allTimePaise: number };
  orderCounts: { today: number; last7d: number; last30d: number; open: number };
}

export interface ConsoleOrderDetail {
  order: ConsoleOrder;
  shop: { id: string; name: string; shopCode: string; phone: string; organizationId: string };
  files: Array<{ id: string; fileName: string; mimeType: string; fileSizeBytes: number; pageCount: number; printOptions: any; lineSubtotalPaise: number; deletedByRetention: boolean }>;
  payments: Array<{ id: string; provider: string; providerTransactionId: string | null; amountPaise: number; currency: string; status: string; createdAt: string; updatedAt: string }>;
  upiClaim: { upiReference: string | null; payerApp: string | null; claimedAt: string } | null;
  printJobs: Array<{ id: string; status: string; printerName: string | null; orderFileId: string; updatedAt: string }>;
  adminActions: Array<{ id: string; action: string; note: string | null; actorName: string | null; createdAt: string }>;
}

export interface ConsoleCustomer {
  phoneKey: string;
  phone: string;
  name: string | null;
  email: string | null;
  orderCount: number;
  shopCount: number;
  lastOrderAt: string;
  firstOrderAt: string;
  totalPaidPaise: number;
}

export interface Page { total: number; limit: number; offset: number; hasMore: boolean }

export type AnnouncementTone = 'info' | 'success' | 'warning' | 'critical';
export type FeatureFlag = 'map_discovery' | 'upi_direct' | 'razorpay_online';

export interface PlatformSettings {
  announcement: { text: string; tone: AnnouncementTone; active: boolean };
  maintenance: { active: boolean; message: string };
  mapDefaults: { city: string; latitude: number; longitude: number };
  supportContacts: { phone: string; whatsapp: string };
  maxUploadMb: number;
  signupsOpen: boolean;
  featureFlags: Record<FeatureFlag, boolean>;
}

export interface PlatformSettingsSnapshot {
  settings: PlatformSettings;
  updatedAt: string | null;
  updatedBy: { id: string; name: string | null; email: string | null } | null;
  unchanged?: boolean;
}

export interface PublicPlatformConfig {
  announcement: { text: string; tone: AnnouncementTone } | null;
  maintenance: { active: boolean; message: string };
  featureFlags: Record<FeatureFlag, boolean>;
  supportContacts: { phone: string; whatsapp: string };
  mapDefaults: { city: string; latitude: number; longitude: number };
}

// ─── Calls ────────────────────────────────────────────────────────────────

export const platformAdminApi = {
  overview: () => request<PlatformOverview>('/platform/overview', {}, 'Could not load the overview'),

  shops: (params: { search?: string; status?: string; limit?: number; offset?: number }) =>
    request<Page & { shops: ConsoleShopRow[] }>(`/platform/shops${query(params)}`, {}, 'Could not load shops'),
  shop: (id: string) => request<ConsoleShopDetail>(`/platform/shops/${encodeURIComponent(id)}`, {}, 'Could not load this shop'),
  updateShop: (id: string, body: { name?: string; phone?: string; address?: string; city?: string; listedOnMap?: boolean; note?: string }) =>
    request<{ success: boolean; unchanged: boolean; shop: ConsoleShopDetail }>(`/platform/shops/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }, 'Could not save the shop'),
  setShopActive: (id: string, active: boolean, note: string) =>
    request<{ success: boolean; isActive: boolean }>(`/platform/shops/${encodeURIComponent(id)}/status`, { method: 'POST', body: JSON.stringify({ active, note }) }, 'Could not change the shop status'),
  resetAgentPairing: (id: string, note: string) =>
    request<{ success: boolean; revokedAgents: number }>(`/platform/shops/${encodeURIComponent(id)}/agent-pairing/reset`, { method: 'POST', body: JSON.stringify({ note }) }, 'Could not reset the print agent'),
  updateOrganizationPlan: (organizationId: string, body: { planTier?: string; planStatus?: string; reason: string }) =>
    request<{ success: boolean }>(`/platform/merchants/${encodeURIComponent(organizationId)}/status`, { method: 'PATCH', body: JSON.stringify(body) }, 'Could not update the plan'),

  orders: (params: { search?: string; status?: string; paymentMethod?: string; paymentStatus?: string; shopId?: string; limit?: number; offset?: number }) =>
    request<Page & { orders: ConsoleOrder[] }>(`/platform/orders${query(params)}`, {}, 'Could not load orders'),
  order: (id: string) => request<ConsoleOrderDetail>(`/platform/orders/${encodeURIComponent(id)}`, {}, 'Could not load this order'),
  cancelOrder: (id: string, note: string) =>
    request<{ success: boolean; refundRequired: boolean; order: ConsoleOrder }>(`/platform/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: JSON.stringify({ note }) }, 'Could not cancel the order'),
  markOrderPaid: (id: string, note: string, collectedVia?: 'CASH' | 'UPI') =>
    request<{ success: boolean; paymentId: string; order: ConsoleOrder }>(`/platform/orders/${encodeURIComponent(id)}/mark-paid`, { method: 'POST', body: JSON.stringify({ note, collectedVia }) }, 'Could not mark the order paid'),

  customers: (params: { search?: string; limit?: number; offset?: number }) =>
    request<Page & { customers: ConsoleCustomer[] }>(`/platform/customers${query(params)}`, {}, 'Could not load customers'),

  settings: () => request<PlatformSettingsSnapshot>('/platform/settings', {}, 'Could not load platform settings'),
  saveSettings: (patch: Partial<PlatformSettings> & { note?: string }) =>
    request<PlatformSettingsSnapshot>('/platform/settings', { method: 'PUT', body: JSON.stringify(patch) }, 'Could not save platform settings'),

  /** Public: no sign-in needed. Used for banners and feature flags in customer pages. */
  publicConfig: () => request<PublicPlatformConfig>('/portal/platform-config', {}, 'Could not load platform configuration'),
};
