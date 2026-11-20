import { urls } from '../config';

export type NearbyShop = {
  shopCode: string;
  name: string;
  tagline?: string | null;
  address?: string | null;
  city?: string | null;
  latitude: number;
  longitude: number;
  distanceKm?: number | null;
  landmark?: string | null;
  openingHours?: string | null;
  isOpenNow?: boolean | null;
  acceptingOrders?: boolean | null;
  acceptsUpi?: boolean | null;
  acceptsCash?: boolean | null;
  portalPath?: string | null;
};

export type NearbyResult =
  | { status: 'ok'; shops: NearbyShop[] }
  /** Endpoint not deployed yet (404) — treat as "nothing nearby" rather than an error. */
  | { status: 'unavailable'; shops: [] }
  | { status: 'error'; shops: []; message: string };

const TIMEOUT_MS = 30_000; // Render free tier can cold-start slowly.

function isValidShop(value: unknown): value is NearbyShop {
  const s = value as NearbyShop;
  return (
    !!s &&
    typeof s.shopCode === 'string' &&
    typeof s.name === 'string' &&
    Number.isFinite(Number(s.latitude)) &&
    Number.isFinite(Number(s.longitude))
  );
}

export async function fetchNearbyShops(params: { lat: number; lng: number; q?: string; radiusKm?: number }): Promise<NearbyResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(urls.nearbyShops(params), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.status === 404) return { status: 'unavailable', shops: [] };
    if (!res.ok) return { status: 'error', shops: [], message: `Server responded with ${res.status}` };
    const text = await res.text();
    if (!text.trim()) return { status: 'ok', shops: [] };
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return { status: 'unavailable', shops: [] };
    }
    const raw = (body as { shops?: unknown })?.shops ?? (body as { data?: { shops?: unknown } })?.data?.shops;
    const shops = Array.isArray(raw)
      ? raw.filter(isValidShop).map((s) => ({ ...s, latitude: Number(s.latitude), longitude: Number(s.longitude) }))
      : [];
    shops.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    return { status: 'ok', shops };
  } catch (e) {
    const aborted = (e as Error)?.name === 'AbortError';
    return {
      status: 'error',
      shops: [],
      message: aborted ? 'The server took too long to respond.' : 'Could not reach Inklly. Check your internet connection.',
    };
  } finally {
    clearTimeout(timer);
  }
}

export function formatDistance(km?: number | null): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
