import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { ShopProfile } from '../api/shop-map-types';

// Leaflet is only downloaded when this panel is on screen.
const LocationPickerMap = lazy(() => import('./map/LocationPickerMap'));

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function currentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location is not available in this browser.')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: Math.round(pos.coords.latitude * 1e6) / 1e6, lng: Math.round(pos.coords.longitude * 1e6) / 1e6 }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'Location permission was denied. Tap the map to place your shop instead.' : 'Could not get your location. Tap the map to place your shop instead.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

/** Business setup: pin the shop on the Inklly map, with landmark and opening hours. */
export const ShopLocationPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const [landmark, setLandmark] = useState('');
  const [hasHours, setHasHours] = useState(true);
  const [open, setOpen] = useState('09:00');
  const [close, setClose] = useState('21:00');
  const [closedDays, setClosedDays] = useState<number[]>([0]);
  const [listedOnMap, setListedOnMap] = useState(true);

  const apply = (profile: ShopProfile) => {
    setPosition(profile.latitude !== null && profile.longitude !== null ? { lat: profile.latitude, lng: profile.longitude } : null);
    setLandmark(profile.landmark || '');
    setHasHours(Boolean(profile.openingHours) || !profile.updatedAt);
    if (profile.openingHours) {
      setOpen(profile.openingHours.open);
      setClose(profile.openingHours.close);
      setClosedDays(profile.openingHours.closedDays);
    }
    setListedOnMap(profile.listedOnMap);
  };

  useEffect(() => {
    let cancelled = false;
    api.getShopProfile()
      .then((profile) => { if (!cancelled) apply(profile); })
      .catch((err) => { if (!cancelled) setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not load the shop location.' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const onPick = useCallback((value: { lat: number; lng: number }) => { setPosition(value); setMessage(null); }, []);

  const useMyLocation = async () => {
    setLocating(true);
    setMessage(null);
    try {
      setPosition(await currentPosition());
      setRecenterKey((k) => k + 1);
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not get your location.' });
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await api.updateShopProfile({
        latitude: position ? position.lat : null,
        longitude: position ? position.lng : null,
        landmark: landmark.trim() || null,
        openingHours: hasHours ? { open, close, closedDays } : null,
        listedOnMap,
      });
      apply(saved);
      setMessage({ tone: 'ok', text: saved.latitude === null ? 'Saved. Place a pin so customers can find you on the map.' : saved.listedOnMap ? 'Saved. Customers can now find your shop on the Inklly map.' : 'Saved. Your shop is hidden from the map.' });
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not save the shop location.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: number) => setClosedDays((days) => days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort());
  const input = 'w-full min-h-[44px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#4D64E6]';

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4" aria-labelledby="shop-location-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="shop-location-heading" className="text-base font-extrabold text-[#172031] dark:text-white">Shop location on the Inklly map</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Nearby customers find you on Inklly’s “Find a print shop” map and go straight to your portal. Tap the map or drag the pin to your door.</p>
        </div>
        <button
          type="button"
          onClick={() => void useMyLocation()}
          disabled={locating || loading}
          className="min-h-[40px] px-3.5 rounded-xl border border-[#4D64E6]/40 text-[#4D64E6] text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-60"
        >
          {locating ? 'Locating…' : 'Use my current location'}
        </button>
      </div>

      <div className="relative h-64 sm:h-72 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 z-0">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-gray-500">Loading map…</div>
        ) : (
          <Suspense fallback={<div className="h-full flex items-center justify-center text-xs text-gray-500">Loading map…</div>}>
            <LocationPickerMap value={position} onChange={onPick} recenterKey={recenterKey} />
          </Suspense>
        )}
        {!loading && !position && (
          <div className="pointer-events-none absolute bottom-2 left-2 right-2 z-[400] rounded-lg bg-white/95 dark:bg-gray-900/95 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 shadow">
            Tap the map to drop your shop’s pin.
          </div>
        )}
      </div>
      {position && (
        <p className="text-[11px] text-gray-400">
          Pinned at {position.lat.toFixed(5)}, {position.lng.toFixed(5)} ·{' '}
          <button type="button" className="font-bold text-gray-500 hover:underline" onClick={() => setPosition(null)}>Remove pin</button>
        </p>
      )}

      <label className="block">
        <span className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">Landmark (optional)</span>
        <input className={input} value={landmark} maxLength={120} onChange={(e) => setLandmark(e.target.value)} placeholder="e.g. Opposite SBI ATM, near bus stop" />
      </label>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={hasHours} onChange={(e) => setHasHours(e.target.checked)} className="h-4 w-4 accent-[#4D64E6]" />
          Show opening hours
        </label>
        {hasHours && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs text-gray-500 mb-1">Opens at</span>
                <input type="time" className={input} value={open} onChange={(e) => setOpen(e.target.value)} />
              </label>
              <label className="block">
                <span className="block text-xs text-gray-500 mb-1">Closes at</span>
                <input type="time" className={input} value={close} onChange={(e) => setClose(e.target.value)} />
              </label>
            </div>
            <div>
              <span className="block text-xs text-gray-500 mb-1">Closed on</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Closed days">
                {DAYS.map((label, day) => {
                  const closed = closedDays.includes(day);
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={closed}
                      onClick={() => toggleDay(day)}
                      className={`min-h-[36px] min-w-[48px] px-2 rounded-lg text-xs font-bold border transition ${closed ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <label className="flex items-start gap-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3 cursor-pointer">
        <input type="checkbox" checked={listedOnMap} onChange={(e) => setListedOnMap(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#4D64E6]" />
        <span>
          <span className="block text-sm font-bold text-gray-800 dark:text-gray-100">Show my shop on the Inklly map</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">Turn off to hide your shop from public search. Your QR portal keeps working.</span>
        </span>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {message ? (
          <p className={`text-xs font-semibold ${message.tone === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p>
        ) : <span />}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || loading}
          className="min-h-[44px] px-5 rounded-xl bg-[#4D64E6] hover:bg-[#3d53d1] text-white text-sm font-bold disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save location'}
        </button>
      </div>
    </section>
  );
};

export default ShopLocationPanel;
