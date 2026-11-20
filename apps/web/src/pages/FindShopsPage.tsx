import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { API_BASE, api } from '../api/client';
import type { NearbyShop, OpeningHours } from '../api/shop-map-types';
import { FALLBACK_CENTER, OSM_ATTRIBUTION, OSM_TILE_URL, getCurrentPosition, shopPin, userLocationPin } from '../components/map/leaflet-pins';

interface FindShopsPageProps {
  onNavigate: (path: string) => void;
}

type LatLng = { lat: number; lng: number };

const NEAR_RADIUS_KM = 25;
const WIDE_RADIUS_KM = 150;

/** Reads `mapDefaults` from the platform config when the server provides it. */
async function loadMapDefaults(signal: AbortSignal): Promise<{ center: [number, number]; zoom: number } | null> {
  try {
    const res = await fetch(`${API_BASE}/portal/platform-config`, { signal });
    if (!res.ok) return null;
    const body = await res.json();
    const d = body?.mapDefaults;
    if (!d) return null;
    const lat = Number(d.lat ?? d.latitude ?? d.center?.[0] ?? d.center?.lat);
    const lng = Number(d.lng ?? d.longitude ?? d.center?.[1] ?? d.center?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    const zoom = Number(d.zoom);
    return { center: [lat, lng], zoom: Number.isFinite(zoom) && zoom >= 3 && zoom <= 18 ? zoom : 12 };
  } catch {
    return null;
  }
}

function formatDistance(km: number | null): string | null {
  if (km === null || km === undefined) return null;
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
}

function hoursLabel(isOpen: boolean | null, hours: OpeningHours | null): string | null {
  if (!hours || isOpen === null) return null;
  if (hours.open === hours.close) return isOpen ? 'Open 24 hours' : 'Closed today';
  return isOpen ? `Open · till ${formatTime(hours.close)}` : `Closed · opens ${formatTime(hours.open)}`;
}

function directionsUrl(shop: NearbyShop): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'P';
}

/** Moves the map when the selection, the user's position or the results change. */
const MapDirector: React.FC<{ shops: NearbyShop[]; me: LatLng | null; selected: NearbyShop | null; fitKey: number }> = ({ shops, me, selected, fitKey }) => {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 50);
    return () => window.clearTimeout(id);
  }, [map]);
  // On phones the search card covers the top of the map and the bottom sheet
  // covers roughly half of it, so frame pins inside the strip that stays visible.
  const insets = () => {
    const height = map.getSize().y;
    return window.innerWidth < 768 ? { top: 96, bottom: Math.round(height * 0.52) + 16 } : { top: 40, bottom: 40 };
  };
  const flyToVisible = (latlng: L.LatLngExpression, zoom: number, duration: number) => {
    const { top, bottom } = insets();
    const shift = (bottom - top) / 2;
    const point = map.project(latlng, zoom).add([0, shift]);
    map.flyTo(map.unproject(point, zoom), zoom, { duration });
  };
  useEffect(() => {
    if (!fitKey) return;
    const points: L.LatLngExpression[] = shops.slice(0, 15).map((s) => [s.latitude, s.longitude]);
    if (me) points.push([me.lat, me.lng]);
    if (points.length === 0) return;
    if (points.length === 1) { flyToVisible(points[0], 15, 0.6); return; }
    const { top, bottom } = insets();
    map.flyToBounds(L.latLngBounds(points), { paddingTopLeft: [40, top], paddingBottomRight: [40, bottom], maxZoom: 15, duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);
  useEffect(() => {
    if (selected) flyToVisible([selected.latitude, selected.longitude], Math.max(map.getZoom(), 15), 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, map]);
  return null;
};

const Badge: React.FC<{ tone: 'green' | 'red' | 'slate' | 'indigo' | 'amber'; children: React.ReactNode }> = ({ tone, children }) => {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300',
    red: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-300',
    slate: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-950/40 dark:text-indigo-300',
    amber: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300',
  } as const;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${tones[tone]}`}>{children}</span>;
};

const ShopCard: React.FC<{ shop: NearbyShop; active: boolean; onSelect: () => void; onPrint: () => void }> = ({ shop, active, onSelect, onPrint }) => {
  const distance = formatDistance(shop.distanceKm);
  const hours = hoursLabel(shop.isOpenNow, shop.openingHours);
  return (
    <li
      id={`shop-card-${shop.shopCode}`}
      className={`rounded-2xl border bg-white dark:bg-slate-900 p-4 transition-all ${active ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/10' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'}`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left" aria-label={`Show ${shop.name} on the map`}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-extrabold flex items-center justify-center text-sm" aria-hidden="true">
            {initials(shop.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white leading-snug truncate">{shop.name}</h3>
              {distance && <span className="shrink-0 text-sm font-extrabold text-indigo-600 dark:text-indigo-300">{distance}</span>}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {shop.landmark ? `${shop.landmark} · ` : ''}{shop.address}, {shop.city}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {hours && <Badge tone={shop.isOpenNow ? 'green' : 'red'}>{hours}</Badge>}
              {!shop.acceptingOrders && <Badge tone="amber">Not taking online orders</Badge>}
              {shop.acceptsUpi && <Badge tone="indigo">UPI</Badge>}
              {shop.acceptsCash && <Badge tone="slate">Cash</Badge>}
            </div>
          </div>
        </div>
      </button>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={onPrint}
          disabled={!shop.acceptingOrders}
          className="min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[.98] disabled:bg-slate-300 disabled:dark:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-bold transition"
        >
          {shop.acceptingOrders ? 'Print here' : 'Paused right now'}
        </button>
        <a
          href={directionsUrl(shop)}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8-8-2z" /></svg>
          Directions
        </a>
      </div>
    </li>
  );
};

const SkeletonCard = () => (
  <li className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 animate-pulse">
    <div className="flex gap-3">
      <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-3 w-1/3 rounded bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  </li>
);

export const FindShopsPage: React.FC<FindShopsPageProps> = ({ onNavigate }) => {
  const [center, setCenter] = useState<[number, number]>(FALLBACK_CENTER);
  const [zoom, setZoom] = useState(12);
  const [me, setMe] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [shops, setShops] = useState<NearbyShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [widened, setWidened] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [fitKey, setFitKey] = useState(0);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void loadMapDefaults(controller.signal).then((d) => {
      if (d) { setCenter(d.center); setZoom(d.zoom); }
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const q = debouncedQuery || undefined;
        let result: NearbyShop[];
        let wide = false;
        if (me) {
          result = (await api.getNearbyShops({ lat: me.lat, lng: me.lng, radiusKm: q ? WIDE_RADIUS_KM : NEAR_RADIUS_KM, q }, controller.signal)).shops;
          if (result.length === 0 && !q) {
            result = (await api.getNearbyShops({ lat: me.lat, lng: me.lng, radiusKm: WIDE_RADIUS_KM }, controller.signal)).shops;
            wide = true;
          }
        } else {
          result = (await api.getNearbyShops({ q }, controller.signal)).shops;
        }
        if (controller.signal.aborted) return;
        setShops(result);
        setWidened(wide);
        setFitKey((k) => k + 1);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Could not load shops.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [me, debouncedQuery, reloadKey]);

  const useMyLocation = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    try {
      setMe(await getCurrentPosition());
      setSelectedCode(null);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Could not get your location.');
    } finally {
      setLocating(false);
    }
  }, []);

  const selected = useMemo(() => shops.find((s) => s.shopCode === selectedCode) || null, [shops, selectedCode]);

  const selectShop = (shop: NearbyShop, fromMap: boolean) => {
    setSelectedCode(shop.shopCode);
    if (fromMap) {
      setSheetExpanded(false);
      window.requestAnimationFrame(() => document.getElementById(`shop-card-${shop.shopCode}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }
  };

  const printAt = (shop: NearbyShop) => onNavigate(shop.portalPath);

  const statusLine = loading
    ? 'Finding print shops…'
    : error
      ? null
      : shops.length === 0
        ? null
        : me
          ? `${shops.length} shop${shops.length === 1 ? '' : 's'} ${widened ? `within ${WIDE_RADIUS_KM} km` : 'near you'}`
          : `${shops.length} shop${shops.length === 1 ? '' : 's'} on Inklly`;

  const panel = (
    <>
      <div className="px-4 pt-1 pb-3 md:pt-5 space-y-3 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="hidden md:block">
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Find a print shop</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Pick a shop, upload your files and pay from your phone.</p>
        </div>
        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search shops by name, area or city</span>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSheetExpanded(true)}
              placeholder="Search shop, area or city"
              maxLength={80}
              className="w-full min-h-[46px] rounded-xl bg-slate-100 dark:bg-slate-900 pl-10 pr-3 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900"
            />
          </label>
          <button
            type="button"
            onClick={() => void useMyLocation()}
            disabled={locating}
            className={`shrink-0 min-h-[46px] px-3.5 rounded-xl text-sm font-bold inline-flex items-center gap-1.5 transition ${me ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'} disabled:opacity-70`}
            aria-label="Use my location"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={locating ? 'animate-spin' : ''}>
              {locating ? <path d="M12 3a9 9 0 1 0 9 9" /> : <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>}
            </svg>
            <span className="hidden sm:inline">{locating ? 'Locating…' : me ? 'Located' : 'Use my location'}</span>
          </button>
        </div>
        {locationError && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400" role="alert">{locationError}</p>}
        {statusLine && <p className="text-xs font-semibold text-slate-500 dark:text-slate-400" aria-live="polite">{statusLine}</p>}
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 bg-slate-50 dark:bg-slate-950">
        {error ? (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-5 text-center">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</p>
            <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="mt-3 min-h-[40px] px-4 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 text-sm font-bold">Try again</button>
          </div>
        ) : loading && shops.length === 0 ? (
          <ul className="space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <SkeletonCard key={i} />)}</ul>
        ) : shops.length === 0 ? (
          <div className="text-center py-10 px-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-2xl" aria-hidden="true">🖨️</div>
            <p className="mt-3 font-bold text-slate-800 dark:text-slate-100">No print shops found</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {debouncedQuery ? 'Try a different name, area or city.' : 'No Inklly shops are listed around here yet.'}
            </p>
            {(debouncedQuery || me) && (
              <button type="button" onClick={() => { setQuery(''); setMe(null); }} className="mt-4 min-h-[40px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold">Show all shops</button>
            )}
          </div>
        ) : (
          <ul className={`space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {shops.map((shop) => (
              <ShopCard key={shop.shopCode} shop={shop} active={shop.shopCode === selectedCode} onSelect={() => selectShop(shop, false)} onPrint={() => printAt(shop)} />
            ))}
          </ul>
        )}
      </div>
    </>
  );

  return (
    <div className="relative h-[calc(100dvh-4rem)] min-h-[480px] w-full overflow-hidden md:grid md:grid-cols-[400px_1fr] lg:grid-cols-[440px_1fr]">
      {/* One list: a bottom sheet on phones, a side column on desktop */}
      <div
        id="shop-list"
        className={`absolute inset-x-0 bottom-0 z-[500] flex flex-col rounded-t-3xl bg-white dark:bg-slate-950 shadow-[0_-12px_32px_rgba(15,23,42,0.18)] transition-[height] duration-300 ease-out ${sheetExpanded ? 'h-[85%]' : 'h-[52%]'} md:static md:z-auto md:h-full md:min-h-0 md:rounded-none md:shadow-none md:border-r md:border-slate-200 md:dark:border-slate-800 md:transition-none`}
      >
        <button
          type="button"
          onClick={() => setSheetExpanded((v) => !v)}
          className="md:hidden w-full pt-2.5 pb-1 flex justify-center"
          aria-label={sheetExpanded ? 'Show more map' : 'Show more shops'}
          aria-expanded={sheetExpanded}
        >
          <span className="block h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
        </button>
        <div className="flex-1 min-h-0 flex flex-col">{panel}</div>
      </div>

      {/* Map */}
      <section className="absolute inset-0 md:static md:h-full z-0" aria-label="Map of print shops">
        <MapContainer center={center} zoom={zoom} key={`${center[0]},${center[1]}`} className="h-full w-full" zoomControl={false} scrollWheelZoom>
          <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} maxZoom={19} />
          <MapDirector shops={shops} me={me} selected={selected} fitKey={fitKey} />
          {me && <Marker position={[me.lat, me.lng]} icon={userLocationPin()} interactive={false} />}
          {shops.map((shop) => (
            <Marker
              key={shop.shopCode}
              position={[shop.latitude, shop.longitude]}
              icon={shopPin(initials(shop.name), shop.shopCode === selectedCode ? 'active' : shop.acceptingOrders && shop.isOpenNow !== false ? 'default' : 'muted')}
              eventHandlers={{ click: () => selectShop(shop, true) }}
            >
              <Popup>
                <div className="min-w-[180px]">
                  <p className="font-bold text-slate-900 text-sm m-0">{shop.name}</p>
                  <p className="text-xs text-slate-500 !my-1">{[formatDistance(shop.distanceKm), hoursLabel(shop.isOpenNow, shop.openingHours)].filter(Boolean).join(' · ') || shop.city}</p>
                  <button type="button" onClick={() => printAt(shop)} disabled={!shop.acceptingOrders} className="mt-1 w-full min-h-[36px] rounded-lg bg-indigo-600 disabled:bg-slate-300 text-white text-xs font-bold">
                    {shop.acceptingOrders ? 'Print here' : 'Paused right now'}
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        <a
          href="#shop-list"
          onClick={(e) => { e.preventDefault(); setSheetExpanded(true); }}
          className="md:hidden absolute top-3 left-3 right-3 z-[400] rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-lg px-4 py-3"
        >
          <span className="block text-base font-extrabold text-slate-900 dark:text-white">Find a print shop</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">Pick a shop, upload files, pay from your phone</span>
        </a>
      </section>

    </div>
  );
};

export default FindShopsPage;
