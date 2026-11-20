/**
 * Central configuration for the Inklly mobile app.
 *
 * Override at build/start time with environment variables, e.g.
 *   EXPO_PUBLIC_WEB_URL=https://staging.inklly.in EXPO_PUBLIC_API_URL=https://staging-api.inklly.in/api/v1 npx expo start
 * (EXPO_PUBLIC_* variables are inlined into the JS bundle by Expo.)
 */

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export const WEB_URL = stripTrailingSlash(process.env.EXPO_PUBLIC_WEB_URL || 'https://inklly.vercel.app');
export const API_URL = stripTrailingSlash(process.env.EXPO_PUBLIC_API_URL || 'https://inklly.onrender.com/api/v1');

export const SUPPORT_EMAIL = 'support@inklly.in';
export const SUPPORT_WHATSAPP = 'https://wa.me/918999829418';

/** Appended to the WebView user agent; the web app uses it to detect the native app. */
export const APP_USER_AGENT_SUFFIX = 'InkllyApp/1.0';

const WEB_HOST = safeHost(WEB_URL);

/** Hosts that count as "Inklly" for QR scanning and in-app navigation. */
const INKLLY_HOSTS = new Set([WEB_HOST, 'inklly.vercel.app', 'inklly.in', 'www.inklly.in'].filter(Boolean) as string[]);

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function withAppFlag(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('app', '1');
    return u.toString();
  } catch {
    return url;
  }
}

export function isInkllyUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && u.hostname === 'localhost')) return false;
    const host = u.hostname.toLowerCase();
    return INKLLY_HOSTS.has(host) || host.endsWith('.inklly.in');
  } catch {
    return false;
  }
}

/** Extracts the shop code from `https://<inklly>/p/<shopCode>` (or `/portal/<shopCode>`). */
export function extractShopCode(url: string): string | null {
  if (!isInkllyUrl(url)) return null;
  try {
    const match = new URL(url).pathname.match(/^\/(?:p|portal)\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function isTrackUrl(url: string): boolean {
  if (!isInkllyUrl(url)) return false;
  try {
    return new URL(url).pathname.replace(/\/+$/, '') === '/track';
  } catch {
    return false;
  }
}

export const urls = {
  shop: (shopCode: string) => `${WEB_URL}/p/${encodeURIComponent(shopCode)}?app=1`,
  merchantCounter: () => `${WEB_URL}/merchant?view=counter&app=1`,
  merchantOrders: () => `${WEB_URL}/merchant?view=orders&app=1`,
  inApp: withAppFlag,
  nearbyShops: (params: { lat: number; lng: number; radiusKm?: number; limit?: number; q?: string }) => {
    const qs = new URLSearchParams({
      lat: String(params.lat),
      lng: String(params.lng),
      radiusKm: String(params.radiusKm ?? 25),
      limit: String(params.limit ?? 50),
      q: params.q ?? '',
    });
    return `${API_URL}/portal/shops/nearby?${qs.toString()}`;
  },
};
