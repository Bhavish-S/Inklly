import * as crypto from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { DatabaseService } from '@inklly/db';

/**
 * Shop location profiles and the public "find a print shop near me" search.
 *
 * Distance is computed in JS (Haversine) so the SQL stays portable between
 * SQLite and Postgres. A bounding-box prefilter keeps the SQL result small.
 */

export interface OpeningHours {
  open: string;   // "HH:MM", shop local time (IST)
  close: string;  // "HH:MM"; earlier than open means it closes after midnight
  closedDays: number[]; // 0 = Sunday ... 6 = Saturday
}

export interface ShopProfile {
  latitude: number | null;
  longitude: number | null;
  landmark: string | null;
  openingHours: OpeningHours | null;
  listedOnMap: boolean;
  updatedAt: string | null;
}

export interface NearbyShop {
  shopCode: string;
  name: string;
  tagline: string | null;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  landmark: string | null;
  openingHours: OpeningHours | null;
  isOpenNow: boolean | null;
  acceptingOrders: boolean;
  acceptsUpi: boolean;
  acceptsCash: boolean;
  portalPath: string;
}

export interface NearbyQuery {
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number;
  limit?: number;
  q?: string;
}

export class ShopProfileError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SHOP_TIME_ZONE = 'Asia/Kolkata';
const DEFAULT_RADIUS_KM = 25;
const MAX_RADIUS_KM = 500;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_QUERY_LENGTH = 80;
const MAX_LANDMARK_LENGTH = 120;
const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function parseOpeningHours(raw: unknown): OpeningHours | null {
  if (raw === null || raw === undefined || raw === '') return null;
  let value: any = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { return null; }
  }
  if (!value || typeof value !== 'object') return null;
  if (typeof value.open !== 'string' || typeof value.close !== 'string' || !TIME.test(value.open) || !TIME.test(value.close)) return null;
  const closedDays = Array.isArray(value.closedDays)
    ? [...new Set<number>(value.closedDays.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))].sort()
    : [];
  return { open: value.open, close: value.close, closedDays };
}

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Day of week (0 = Sunday) and minutes since midnight in the shop's time zone. */
function shopLocalNow(now: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: SHOP_TIME_ZONE, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** null when the shop has not set opening hours. */
export function isOpenAt(hours: OpeningHours | null, now: Date = new Date()): boolean | null {
  if (!hours) return null;
  const { day, minutes } = shopLocalNow(now);
  const open = minutesOf(hours.open);
  const close = minutesOf(hours.close);
  if (open === close) return !hours.closedDays.includes(day); // open all day
  if (open < close) return !hours.closedDays.includes(day) && minutes >= open && minutes < close;
  // Overnight: open from `open` today until `close` tomorrow.
  if (minutes >= open) return !hours.closedDays.includes(day);
  if (minutes < close) return !hours.closedDays.includes((day + 6) % 7);
  return false;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = toNumber(value);
  if (n === null) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function findNearbyShops(db: DatabaseService, input: NearbyQuery, now: Date = new Date()): NearbyShop[] {
  const lat = toNumber(input.lat);
  const lng = toNumber(input.lng);
  const hasOrigin = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const radiusKm = Math.min(MAX_RADIUS_KM, Math.max(0.1, toNumber(input.radiusKm) ?? DEFAULT_RADIUS_KM));
  const limit = clampInt(input.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const q = typeof input.q === 'string' ? input.q.trim().slice(0, MAX_QUERY_LENGTH).toLowerCase() : '';

  const where: string[] = [
    's.is_active = 1',
    'p.listed_on_map = 1',
    'p.latitude IS NOT NULL',
    'p.longitude IS NOT NULL',
  ];
  const params: (string | number)[] = [];

  if (hasOrigin) {
    // Bounding box prefilter (degrees); exact distance is checked in JS.
    const dLat = radiusKm / 111.32;
    const cosLat = Math.max(0.01, Math.cos((lat! * Math.PI) / 180));
    const dLng = Math.min(180, radiusKm / (111.32 * cosLat));
    where.push('p.latitude BETWEEN ? AND ?');
    params.push(lat! - dLat, lat! + dLat);
    if (lng! - dLng >= -180 && lng! + dLng <= 180) {
      where.push('p.longitude BETWEEN ? AND ?');
      params.push(lng! - dLng, lng! + dLng);
    }
  }

  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    where.push(`(LOWER(s.name) LIKE ? ESCAPE '\\' OR LOWER(s.city) LIKE ? ESCAPE '\\' OR LOWER(s.address) LIKE ? ESCAPE '\\')`);
    params.push(like, like, like);
  }

  const rows = db.query<any>(
    `SELECT s.shop_code, s.name, s.tagline, s.address, s.city, s.accept_cash_on_collection,
            p.latitude, p.longitude, p.landmark, p.opening_hours,
            os.accepting_orders, cs.upi_id
       FROM shops s
       JOIN shop_profiles p ON p.shop_id = s.id
       LEFT JOIN shop_operating_status os ON os.shop_id = s.id
       LEFT JOIN shop_counter_settings cs ON cs.shop_id = s.id
      WHERE ${where.join(' AND ')}`,
    params
  );

  const shops: NearbyShop[] = [];
  for (const row of rows) {
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    let distanceKm: number | null = null;
    if (hasOrigin) {
      const exact = haversineKm(lat!, lng!, latitude, longitude);
      if (exact > radiusKm) continue;
      distanceKm = Math.round(exact * 100) / 100;
    }
    const openingHours = parseOpeningHours(row.opening_hours);
    shops.push({
      shopCode: row.shop_code,
      name: row.name,
      tagline: row.tagline || null,
      address: row.address,
      city: row.city,
      latitude,
      longitude,
      distanceKm,
      landmark: row.landmark || null,
      openingHours,
      isOpenNow: isOpenAt(openingHours, now),
      acceptingOrders: row.accepting_orders === null || row.accepting_orders === undefined ? true : Number(row.accepting_orders) === 1,
      acceptsUpi: typeof row.upi_id === 'string' && row.upi_id.trim().length > 0,
      acceptsCash: Number(row.accept_cash_on_collection) === 1,
      portalPath: `/p/${row.shop_code}`,
    });
  }

  shops.sort(hasOrigin
    ? (a, b) => (a.distanceKm! - b.distanceKm!) || a.name.localeCompare(b.name)
    : (a, b) => a.name.localeCompare(b.name) || a.shopCode.localeCompare(b.shopCode));
  return shops.slice(0, limit);
}

export function getShopProfile(db: DatabaseService, shopId: string): ShopProfile {
  const row = db.queryOne<any>(`SELECT latitude, longitude, landmark, opening_hours, listed_on_map, updated_at FROM shop_profiles WHERE shop_id = ?`, [shopId]);
  if (!row) return { latitude: null, longitude: null, landmark: null, openingHours: null, listedOnMap: true, updatedAt: null };
  return {
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    landmark: row.landmark || null,
    openingHours: parseOpeningHours(row.opening_hours),
    listedOnMap: Number(row.listed_on_map) === 1,
    updatedAt: row.updated_at || null,
  };
}

function validateOpeningHours(value: unknown): OpeningHours | null {
  if (value === null || value === '') return null;
  let v: any = value;
  if (typeof value === 'string') {
    try { v = JSON.parse(value); } catch { throw new ShopProfileError('Opening hours must look like {"open":"09:00","close":"21:00","closedDays":[0]}.'); }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ShopProfileError('Opening hours must include open and close times.');
  if (typeof v.open !== 'string' || !TIME.test(v.open)) throw new ShopProfileError('Opening time must be HH:MM in 24-hour format, for example 09:00.');
  if (typeof v.close !== 'string' || !TIME.test(v.close)) throw new ShopProfileError('Closing time must be HH:MM in 24-hour format, for example 21:00.');
  const closedDays = v.closedDays ?? [];
  if (!Array.isArray(closedDays) || closedDays.length > 7 || closedDays.some((d: unknown) => !Number.isInteger(d) || (d as number) < 0 || (d as number) > 6)) {
    throw new ShopProfileError('Closed days must be a list of weekday numbers from 0 (Sunday) to 6 (Saturday).');
  }
  return { open: v.open, close: v.close, closedDays: [...new Set<number>(closedDays)].sort() };
}

export function updateShopProfile(db: DatabaseService, shopId: string, input: any): ShopProfile {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ShopProfileError('Send the shop profile as a JSON object.');
  const current = getShopProfile(db, shopId);

  const coord = (key: 'latitude' | 'longitude', limit: number): number | null => {
    if (input[key] === undefined) return current[key];
    if (input[key] === null || input[key] === '') return null;
    const n = typeof input[key] === 'number' ? input[key] : typeof input[key] === 'string' ? Number(input[key]) : NaN;
    if (!Number.isFinite(n) || Math.abs(n) > limit) {
      throw new ShopProfileError(key === 'latitude' ? 'Latitude must be a number between -90 and 90.' : 'Longitude must be a number between -180 and 180.');
    }
    return Math.round(n * 1e6) / 1e6;
  };
  const latitude = coord('latitude', 90);
  const longitude = coord('longitude', 180);
  if ((latitude === null) !== (longitude === null)) throw new ShopProfileError('Set both latitude and longitude, or clear both.');

  let landmark = current.landmark;
  if (input.landmark !== undefined) {
    if (input.landmark !== null && typeof input.landmark !== 'string') throw new ShopProfileError('Landmark must be text.');
    landmark = typeof input.landmark === 'string' ? input.landmark.trim() || null : null;
    if (landmark && landmark.length > MAX_LANDMARK_LENGTH) throw new ShopProfileError(`Landmark must be up to ${MAX_LANDMARK_LENGTH} characters.`);
  }

  const openingHours = input.openingHours === undefined ? current.openingHours : validateOpeningHours(input.openingHours);

  let listedOnMap = current.listedOnMap;
  if (input.listedOnMap !== undefined) {
    if (typeof input.listedOnMap !== 'boolean') throw new ShopProfileError('listedOnMap must be true or false.');
    listedOnMap = input.listedOnMap;
  }

  const updatedAt = new Date().toISOString();
  db.execute(
    `INSERT INTO shop_profiles (shop_id, latitude, longitude, landmark, opening_hours, listed_on_map, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(shop_id) DO UPDATE SET latitude = excluded.latitude, longitude = excluded.longitude, landmark = excluded.landmark,
       opening_hours = excluded.opening_hours, listed_on_map = excluded.listed_on_map, updated_at = excluded.updated_at`,
    [shopId, latitude, longitude, landmark, openingHours ? JSON.stringify(openingHours) : null, listedOnMap ? 1 : 0, updatedAt]
  );
  nearbyCaches.delete(db);
  return { latitude, longitude, landmark, openingHours, listedOnMap, updatedAt };
}

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 500;
const nearbyCaches = new WeakMap<DatabaseService, Map<string, { expires: number; body: string }>>();

function cacheKey(query: Record<string, unknown>): string {
  // Round the origin to ~100 m so nearby callers share cache entries.
  const round = (v: unknown) => { const n = toNumber(v); return n === null ? '' : n.toFixed(3); };
  const q = typeof query.q === 'string' ? query.q.trim().toLowerCase().slice(0, MAX_QUERY_LENGTH) : '';
  return [round(query.lat), round(query.lng), toNumber(query.radiusKm) ?? '', toNumber(query.limit) ?? '', q].join('|');
}

/** Small fixed-window per-IP limiter for the public search endpoint. */
export function createNearbyRateLimit(maxPerMinute = 120): RequestHandler {
  const buckets = new Map<string, { windowStart: number; count: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = req.ip || 'unknown';
    let bucket = buckets.get(ip);
    if (!bucket || now - bucket.windowStart >= 60_000) {
      if (buckets.size > 10_000) buckets.clear();
      bucket = { windowStart: now, count: 0 };
      buckets.set(ip, bucket);
    }
    bucket.count += 1;
    if (bucket.count > maxPerMinute) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.windowStart + 60_000 - now) / 1000)));
      return res.status(429).json({ error: 'Too many searches. Please wait a moment and try again.' });
    }
    next();
  };
}

export function createNearbyShopsHandler(db: DatabaseService): RequestHandler {
  return (req: Request, res: Response) => {
    try {
      const query = req.query as Record<string, unknown>;
      const key = cacheKey(query);
      let cache = nearbyCaches.get(db);
      if (!cache) { cache = new Map(); nearbyCaches.set(db, cache); }
      const now = Date.now();
      let entry = cache.get(key);
      if (!entry || entry.expires <= now) {
        const shops = findNearbyShops(db, {
          lat: toNumber(query.lat),
          lng: toNumber(query.lng),
          radiusKm: toNumber(query.radiusKm) ?? undefined,
          limit: toNumber(query.limit) ?? undefined,
          q: typeof query.q === 'string' ? query.q : undefined,
        });
        if (cache.size >= CACHE_MAX_ENTRIES) cache.clear();
        entry = { expires: now + CACHE_TTL_MS, body: JSON.stringify({ shops }) };
        cache.set(key, entry);
      }
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.type('application/json').send(entry.body);
    } catch (error) {
      console.error('[ShopMap]', error);
      res.status(500).json({ error: 'Could not load nearby shops. Please try again.' });
    }
  };
}

function merchantShopId(req: Request): string {
  const user: any = (req as any).user;
  if (user?.shopId) return user.shopId;
  if (user?.role === 'PLATFORM_OWNER') return String(req.query.shopId || req.headers['x-shop-id'] || '');
  return '';
}

function profileError(res: Response, error: unknown) {
  if (error instanceof ShopProfileError) return res.status(error.status).json({ error: error.message });
  console.error('[ShopProfile]', error);
  return res.status(500).json({ error: 'Could not save the shop location. Please try again.' });
}

export function createShopProfileHandlers(db: DatabaseService): { get: RequestHandler; update: RequestHandler } {
  const requireShop = (req: Request) => {
    const shopId = merchantShopId(req);
    if (!shopId) throw new ShopProfileError('Select a shop first.', 400);
    const shop = db.queryOne<any>(`SELECT id, organization_id FROM shops WHERE id = ?`, [shopId]);
    if (!shop) throw new ShopProfileError('Shop not found.', 404);
    return { id: shop.id as string, organizationId: shop.organization_id as string };
  };
  return {
    get: (req, res) => {
      try { res.json(getShopProfile(db, requireShop(req).id)); } catch (error) { profileError(res, error); }
    },
    update: (req, res) => {
      try {
        const shop = requireShop(req);
        const profile = updateShopProfile(db, shop.id, req.body);
        const user: any = (req as any).user;
        db.execute(
          `INSERT INTO audit_events (id, actor_user_id, actor_role, shop_id, organization_id, action, target_type, target_id, outcome, ip_address, details, created_at)
           VALUES (?, ?, ?, ?, ?, 'SHOP_PROFILE_UPDATED', 'SHOP', ?, 'SUCCESS', ?, ?, ?)`,
          [crypto.randomUUID(), user?.userId || null, user?.role || null, shop.id, shop.organizationId, shop.id, req.ip || null, JSON.stringify(profile), new Date().toISOString()]
        );
        res.json(profile);
      } catch (error) { profileError(res, error); }
    },
  };
}
