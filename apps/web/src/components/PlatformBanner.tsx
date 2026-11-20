import { useState } from 'react';
import { usePlatformConfig } from '../platform-config';

const TONES = {
  info: 'bg-indigo-600 text-white',
  success: 'bg-emerald-600 text-white',
  warning: 'bg-amber-400 text-amber-950',
  critical: 'bg-rose-600 text-white',
} as const;

/** Site-wide announcement or maintenance notice set in the platform admin. */
export function PlatformBanner() {
  const config = usePlatformConfig();
  const [hidden, setHidden] = useState(false);
  if (!config || hidden) return null;
  if (config.maintenance.active) {
    return (
      <div role="alert" className="bg-amber-400 px-4 py-2.5 text-center text-sm font-bold text-amber-950">
        🛠️ {config.maintenance.message || 'Inklly is under maintenance. New orders are paused for a short while.'}
      </div>
    );
  }
  if (!config.announcement) return null;
  return (
    <div role="status" className={`flex items-center justify-center gap-3 px-4 py-2 text-sm font-semibold ${TONES[config.announcement.tone] || TONES.info}`}>
      <span className="text-center">{config.announcement.text}</span>
      <button type="button" onClick={() => setHidden(true)} aria-label="Dismiss announcement" className="shrink-0 rounded-lg px-2 py-0.5 opacity-80 hover:opacity-100">✕</button>
    </div>
  );
}
