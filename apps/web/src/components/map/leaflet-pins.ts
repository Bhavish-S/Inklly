import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** Bengaluru: used when the platform has no configured map centre. */
export const FALLBACK_CENTER: [number, number] = [12.9716, 77.5946];

export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Pins are drawn with CSS (divIcon) so no marker images need bundling.
const PIN_STYLE_ID = 'inklly-map-pin-styles';
function ensurePinStyles() {
  if (typeof document === 'undefined' || document.getElementById(PIN_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PIN_STYLE_ID;
  style.textContent = `
.inklly-pin{background:none;border:none}
.inklly-pin__body{width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
  background:#4f46e5;border:3px solid #fff;box-shadow:0 4px 12px rgba(15,23,42,.35);transition:transform .15s ease,background .15s ease}
.inklly-pin__body span{transform:rotate(45deg);color:#fff;font:700 12px/1 system-ui,sans-serif}
.inklly-pin--muted .inklly-pin__body{background:#94a3b8}
.inklly-pin--active .inklly-pin__body{background:#7c3aed;transform:rotate(-45deg) scale(1.25)}
.inklly-me{background:none;border:none}
.inklly-me__dot{width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.25),0 2px 6px rgba(15,23,42,.3)}
.leaflet-container{font-family:inherit}
.leaflet-popup-content-wrapper{border-radius:14px}
`;
  document.head.appendChild(style);
}

const pinCache = new Map<string, L.DivIcon>();
export function shopPin(label: string, variant: 'default' | 'muted' | 'active' = 'default'): L.DivIcon {
  ensurePinStyles();
  const key = `${label}|${variant}`;
  let icon = pinCache.get(key);
  if (!icon) {
    const safe = label.replace(/[^0-9A-Za-z]/g, '').slice(0, 2);
    icon = L.divIcon({
      className: `inklly-pin${variant === 'default' ? '' : ` inklly-pin--${variant}`}`,
      html: `<div class="inklly-pin__body"><span>${safe}</span></div>`,
      iconSize: [30, 30],
      iconAnchor: [4, 30],
      popupAnchor: [11, -30],
    });
    pinCache.set(key, icon);
  }
  return icon;
}

let meIcon: L.DivIcon | null = null;
export function userLocationPin(): L.DivIcon {
  ensurePinStyles();
  if (!meIcon) meIcon = L.divIcon({ className: 'inklly-me', html: '<div class="inklly-me__dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
  return meIcon;
}

export function getCurrentPosition(timeoutMs = 10000): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED
        ? 'Location permission was denied. Allow location access in your browser, or search by area instead.'
        : 'Could not get your location. Please try again or search by area.')),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}
