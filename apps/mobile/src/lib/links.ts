import { Alert, Linking, Platform } from 'react-native';

const PAYMENT_SCHEMES = ['upi', 'phonepe', 'paytmmp', 'paytm', 'tez', 'gpay', 'credpay', 'bhim', 'amazonpay'];

/** https hosts that should leave the WebView and open in their own app / the browser. */
const EXTERNAL_HTTP_HOSTS = [
  'wa.me',
  'api.whatsapp.com',
  'chat.whatsapp.com',
  'play.google.com',
  'maps.google.com',
  'maps.app.goo.gl',
  'goo.gl',
  'apps.apple.com',
];

export function getScheme(url: string): string {
  const m = url.match(/^([a-z][a-z0-9+.-]*):/i);
  return m ? m[1].toLowerCase() : '';
}

export function isHttpUrl(url: string): boolean {
  const s = getScheme(url);
  return s === 'http' || s === 'https';
}

/** Non-web URLs (upi:, tel:, intent:, …) never load inside the WebView. */
export function isExternalScheme(url: string): boolean {
  const s = getScheme(url);
  return !!s && !['http', 'https', 'about', 'data', 'blob', 'file', 'javascript'].includes(s);
}

export function shouldOpenHttpExternally(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (EXTERNAL_HTTP_HOSTS.includes(host)) return true;
    if ((host === 'www.google.com' || host === 'google.com') && u.pathname.startsWith('/maps')) return true;
    return false;
  } catch {
    return false;
  }
}

function isPaymentUrl(url: string): boolean {
  const scheme = getScheme(url);
  if (PAYMENT_SCHEMES.includes(scheme)) return true;
  if (scheme === 'intent') return /scheme=(upi|phonepe|paytmmp|tez|gpay|credpay)/i.test(url) || /^intent:\/\/(upi\/)?pay/i.test(url);
  return false;
}

/**
 * Android `intent://host/path#Intent;scheme=upi;package=...;S.browser_fallback_url=...;end`
 * can't be opened directly by React Native's Linking, so convert it to `scheme://host/path`.
 */
function parseIntentUrl(url: string): { target: string | null; fallback: string | null } {
  const hashIndex = url.indexOf('#Intent;');
  const body = url.slice('intent://'.length, hashIndex === -1 ? undefined : hashIndex);
  const params: Record<string, string> = {};
  if (hashIndex !== -1) {
    url
      .slice(hashIndex + '#Intent;'.length)
      .split(';')
      .forEach((part) => {
        const eq = part.indexOf('=');
        if (eq > 0) params[part.slice(0, eq)] = part.slice(eq + 1);
      });
  }
  const scheme = params.scheme;
  const fallbackRaw = params['S.browser_fallback_url'];
  let fallback: string | null = null;
  if (fallbackRaw) {
    try {
      fallback = decodeURIComponent(fallbackRaw);
    } catch {
      fallback = fallbackRaw;
    }
  }
  return { target: scheme ? `${scheme}://${body}` : null, fallback };
}

/**
 * Opens a non-web link (UPI apps, phone, mail, WhatsApp…). Returns true if something opened.
 * `onHttpFallback` lets the caller load an https fallback URL inside its WebView.
 */
export async function openExternal(url: string, onHttpFallback?: (url: string) => void): Promise<boolean> {
  const payment = isPaymentUrl(url);
  const candidates: string[] = [];
  let fallback: string | null = null;

  if (getScheme(url) === 'intent') {
    const parsed = parseIntentUrl(url);
    if (Platform.OS === 'android') candidates.push(url); // some Android builds accept it as-is
    if (parsed.target) candidates.unshift(parsed.target);
    fallback = parsed.fallback;
  } else {
    candidates.push(url);
  }

  for (const candidate of candidates) {
    try {
      await Linking.openURL(candidate);
      return true;
    } catch {
      // try next candidate
    }
  }

  if (fallback && isHttpUrl(fallback)) {
    if (onHttpFallback) onHttpFallback(fallback);
    else await Linking.openURL(fallback).catch(() => undefined);
    return true;
  }

  if (payment) {
    Alert.alert(
      'No UPI app found',
      'Install a UPI app such as PhonePe, Google Pay, Paytm or BHIM to pay the shop directly, or choose "Pay at pickup" (cash).'
    );
  } else {
    Alert.alert("Couldn't open link", 'No app on this phone can open this link.');
  }
  return false;
}
