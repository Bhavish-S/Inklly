import { useEffect, useState } from 'react';
import { API_BASE } from './api/client';

export interface PlatformConfig {
  announcement: { text: string; tone: 'info' | 'success' | 'warning' | 'critical' } | null;
  maintenance: { active: boolean; message: string };
  featureFlags: { map_discovery: boolean; upi_direct: boolean; razorpay_online: boolean };
  supportContacts: { phone: string; whatsapp: string };
  signupsOpen?: boolean;
}

let cached: Promise<PlatformConfig | null> | null = null;

/** Public platform settings set by the Inklly admin (fetched once per page load). */
export function loadPlatformConfig(): Promise<PlatformConfig | null> {
  cached ||= fetch(`${API_BASE}/portal/platform-config`).then((res) => (res.ok ? res.json() : null)).catch(() => null);
  return cached;
}

export function usePlatformConfig(): PlatformConfig | null {
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  useEffect(() => { let alive = true; void loadPlatformConfig().then((value) => { if (alive) setConfig(value); }); return () => { alive = false; }; }, []);
  return config;
}
