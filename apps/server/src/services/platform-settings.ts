import { DatabaseService } from '@inklly/db';

/**
 * Platform-wide settings edited by the platform owner from /platform.
 *
 * Each top-level setting is stored as one row in `platform_settings`
 * (`setting_key`, JSON `setting_value`). Storage keys are snake_case because
 * other services read them directly, for example
 * `feature_flags.upi_direct` in services/upi-direct.ts.
 */

export type AnnouncementTone = 'info' | 'success' | 'warning' | 'critical';
export const ANNOUNCEMENT_TONES: AnnouncementTone[] = ['info', 'success', 'warning', 'critical'];
export const FEATURE_FLAG_KEYS = ['map_discovery', 'upi_direct', 'razorpay_online'] as const;
export type FeatureFlagKey = typeof FEATURE_FLAG_KEYS[number];

export interface PlatformSettings {
  announcement: { text: string; tone: AnnouncementTone; active: boolean };
  maintenance: { active: boolean; message: string };
  mapDefaults: { city: string; latitude: number; longitude: number };
  supportContacts: { phone: string; whatsapp: string };
  maxUploadMb: number;
  signupsOpen: boolean;
  featureFlags: Record<FeatureFlagKey, boolean>;
}

/** The subset any visitor may read. Never add secrets or internal limits here. */
export interface PublicPlatformConfig {
  announcement: { text: string; tone: AnnouncementTone } | null;
  maintenance: { active: boolean; message: string };
  featureFlags: Record<FeatureFlagKey, boolean>;
  supportContacts: { phone: string; whatsapp: string };
  mapDefaults: { city: string; latitude: number; longitude: number };
}

// Geographic centre of India: a neutral starting point until the owner sets a city.
export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  announcement: { text: '', tone: 'info', active: false },
  maintenance: { active: false, message: '' },
  mapDefaults: { city: '', latitude: 20.5937, longitude: 78.9629 },
  supportContacts: { phone: '', whatsapp: '' },
  maxUploadMb: 50,
  signupsOpen: true,
  featureFlags: { map_discovery: true, upi_direct: true, razorpay_online: true },
};

/** API field -> storage key. */
const STORAGE_KEYS: Record<keyof PlatformSettings, string> = {
  announcement: 'announcement',
  maintenance: 'maintenance',
  mapDefaults: 'map_defaults',
  supportContacts: 'support_contacts',
  maxUploadMb: 'max_upload_mb',
  signupsOpen: 'signups_open',
  featureFlags: 'feature_flags',
};

const SETTING_FIELDS = Object.keys(STORAGE_KEYS) as Array<keyof PlatformSettings>;
const PHONE = /^\+?[0-9][0-9 ()-]{5,19}$/;

export class PlatformSettingsError extends Error {
  constructor(message: string) { super(message); }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Merge a stored value over the default, keeping only known fields of the right type. */
function coerceStored(field: keyof PlatformSettings, raw: unknown, fallback: any): any {
  if (fallback !== null && typeof fallback === 'object') {
    if (!isPlainObject(raw)) return clone(fallback);
    const merged: Record<string, unknown> = clone(fallback);
    for (const key of Object.keys(fallback)) {
      if (typeof raw[key] === typeof fallback[key]) merged[key] = raw[key];
    }
    return merged;
  }
  return typeof raw === typeof fallback ? raw : fallback;
}

export interface PlatformSettingsSnapshot {
  settings: PlatformSettings;
  updatedAt: string | null;
  updatedBy: { id: string; name: string | null; email: string | null } | null;
}

export function readPlatformSettings(db: DatabaseService): PlatformSettingsSnapshot {
  const rows = db.query<any>(
    `SELECT ps.setting_key, ps.setting_value, ps.updated_by, ps.updated_at, u.full_name, u.email
     FROM platform_settings ps LEFT JOIN users u ON u.id = ps.updated_by`
  );
  const byKey = new Map(rows.map((row) => [String(row.setting_key), row]));
  const settings = clone(DEFAULT_PLATFORM_SETTINGS);
  let latest: any = null;
  for (const field of SETTING_FIELDS) {
    const row = byKey.get(STORAGE_KEYS[field]);
    if (!row) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(String(row.setting_value)); } catch { continue; }
    (settings as any)[field] = coerceStored(field, parsed, (DEFAULT_PLATFORM_SETTINGS as any)[field]);
    if (!latest || String(row.updated_at) > String(latest.updated_at)) latest = row;
  }
  return {
    settings,
    updatedAt: latest ? String(latest.updated_at) : null,
    updatedBy: latest?.updated_by ? { id: String(latest.updated_by), name: latest.full_name || null, email: latest.email || null } : null,
  };
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new PlatformSettingsError(`${label} must be true or false.`);
  return value;
}

function requireText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string') throw new PlatformSettingsError(`${label} must be text.`);
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length > max) throw new PlatformSettingsError(`${label} must be at most ${max} characters.`);
  return text;
}

function requireNumber(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new PlatformSettingsError(`${label} must be a number from ${min} to ${max}.`);
  }
  return value;
}

function requirePhone(value: unknown, label: string): string {
  const text = requireText(value, label, 20);
  if (text && !PHONE.test(text)) throw new PlatformSettingsError(`${label} must be a phone number such as +91 98765 43210.`);
  return text;
}

function sectionPatch(value: unknown, label: string): Record<string, unknown> {
  if (!isPlainObject(value)) throw new PlatformSettingsError(`${label} must be an object.`);
  return value;
}

function rejectUnknown(patch: Record<string, unknown>, allowed: string[], label: string) {
  const unknown = Object.keys(patch).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new PlatformSettingsError(`${label} has unsupported field(s): ${unknown.join(', ')}.`);
}

/**
 * Validate a partial update and merge it over the current settings.
 * Throws PlatformSettingsError with a user-facing message on bad input.
 */
export function mergeSettingsPatch(current: PlatformSettings, body: unknown): { next: PlatformSettings; changed: Array<keyof PlatformSettings> } {
  if (!isPlainObject(body)) throw new PlatformSettingsError('Settings update must be a JSON object.');
  const input = isPlainObject(body.settings) ? body.settings : body;
  const patch = Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'note'));
  rejectUnknown(patch, SETTING_FIELDS as string[], 'Settings');
  if (!Object.keys(patch).length) throw new PlatformSettingsError('Provide at least one setting to change.');

  const next = clone(current);
  if ('announcement' in patch) {
    const section = sectionPatch(patch.announcement, 'announcement');
    rejectUnknown(section, ['text', 'tone', 'active'], 'announcement');
    if ('text' in section) next.announcement.text = requireText(section.text, 'Announcement text', 280);
    if ('tone' in section) {
      if (!ANNOUNCEMENT_TONES.includes(section.tone as AnnouncementTone)) throw new PlatformSettingsError(`Announcement tone must be one of ${ANNOUNCEMENT_TONES.join(', ')}.`);
      next.announcement.tone = section.tone as AnnouncementTone;
    }
    if ('active' in section) next.announcement.active = requireBoolean(section.active, 'Announcement active');
    if (next.announcement.active && !next.announcement.text) throw new PlatformSettingsError('Add announcement text before turning the banner on.');
  }
  if ('maintenance' in patch) {
    const section = sectionPatch(patch.maintenance, 'maintenance');
    rejectUnknown(section, ['active', 'message'], 'maintenance');
    if ('message' in section) next.maintenance.message = requireText(section.message, 'Maintenance message', 500);
    if ('active' in section) next.maintenance.active = requireBoolean(section.active, 'Maintenance mode');
    if (next.maintenance.active && !next.maintenance.message) throw new PlatformSettingsError('Add a maintenance message before turning maintenance mode on.');
  }
  if ('mapDefaults' in patch) {
    const section = sectionPatch(patch.mapDefaults, 'mapDefaults');
    rejectUnknown(section, ['city', 'latitude', 'longitude'], 'mapDefaults');
    if ('city' in section) next.mapDefaults.city = requireText(section.city, 'Default map city', 80);
    if ('latitude' in section) next.mapDefaults.latitude = requireNumber(section.latitude, 'Map centre latitude', -90, 90);
    if ('longitude' in section) next.mapDefaults.longitude = requireNumber(section.longitude, 'Map centre longitude', -180, 180);
  }
  if ('supportContacts' in patch) {
    const section = sectionPatch(patch.supportContacts, 'supportContacts');
    rejectUnknown(section, ['phone', 'whatsapp'], 'supportContacts');
    if ('phone' in section) next.supportContacts.phone = requirePhone(section.phone, 'Support phone');
    if ('whatsapp' in section) next.supportContacts.whatsapp = requirePhone(section.whatsapp, 'Support WhatsApp');
  }
  if ('maxUploadMb' in patch) {
    const value = patch.maxUploadMb;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 500) {
      throw new PlatformSettingsError('Max upload size must be a whole number of MB from 1 to 500.');
    }
    next.maxUploadMb = value;
  }
  if ('signupsOpen' in patch) next.signupsOpen = requireBoolean(patch.signupsOpen, 'Signups open');
  if ('featureFlags' in patch) {
    const section = sectionPatch(patch.featureFlags, 'featureFlags');
    rejectUnknown(section, [...FEATURE_FLAG_KEYS], 'featureFlags');
    for (const key of FEATURE_FLAG_KEYS) {
      if (key in section) next.featureFlags[key] = requireBoolean(section[key], `Feature flag ${key}`);
    }
  }

  const changed = SETTING_FIELDS.filter((field) => JSON.stringify(next[field]) !== JSON.stringify(current[field]));
  return { next, changed };
}

/** Persist the given fields. Call inside a transaction together with the audit event. */
export function writePlatformSettings(db: DatabaseService, settings: PlatformSettings, fields: Array<keyof PlatformSettings>, actorUserId: string | null, now: string): void {
  for (const field of fields) {
    db.execute(
      `INSERT INTO platform_settings (setting_key, setting_value, updated_by, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      [STORAGE_KEYS[field], JSON.stringify(settings[field]), actorUserId, now]
    );
  }
}

export function toPublicPlatformConfig(settings: PlatformSettings): PublicPlatformConfig {
  return {
    announcement: settings.announcement.active && settings.announcement.text
      ? { text: settings.announcement.text, tone: settings.announcement.tone }
      : null,
    maintenance: { active: settings.maintenance.active, message: settings.maintenance.active ? settings.maintenance.message : '' },
    featureFlags: { ...settings.featureFlags },
    supportContacts: { ...settings.supportContacts },
    mapDefaults: { ...settings.mapDefaults },
  };
}

export function getPublicPlatformConfig(db: DatabaseService): PublicPlatformConfig {
  return toPublicPlatformConfig(readPlatformSettings(db).settings);
}
