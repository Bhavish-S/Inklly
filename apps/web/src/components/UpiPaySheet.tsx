import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';

export interface UpiPayment {
  upiId: string;
  payeeName: string;
  amount: string;
  note: string;
  uri: string;
}

interface UpiApp {
  id: string;
  name: string;
  /** Android package, opened with an intent link so the chosen app opens directly. */
  androidPackage: string;
  /** App URL scheme used on iPhone and inside the Inklly app. */
  scheme: (query: string) => string;
  colour: string;
  initials: string;
}

const UPI_APPS: UpiApp[] = [
  { id: 'phonepe', name: 'PhonePe', androidPackage: 'com.phonepe.app', scheme: (q) => `phonepe://pay?${q}`, colour: '#5f259f', initials: 'Pe' },
  { id: 'gpay', name: 'Google Pay', androidPackage: 'com.google.android.apps.nbu.paisa.user', scheme: (q) => `gpay://upi/pay?${q}`, colour: '#1a73e8', initials: 'G' },
  { id: 'paytm', name: 'Paytm', androidPackage: 'net.one97.paytm', scheme: (q) => `paytmmp://pay?${q}`, colour: '#00baf2', initials: 'P' },
  { id: 'cred', name: 'CRED', androidPackage: 'com.dreamplug.androidapp', scheme: (q) => `credpay://upi/pay?${q}`, colour: '#111827', initials: 'C' },
  { id: 'bhim', name: 'BHIM', androidPackage: 'in.org.npci.upiapp', scheme: (q) => `upi://pay?${q}`, colour: '#f37021', initials: 'B' },
  { id: 'amazonpay', name: 'Amazon Pay', androidPackage: 'in.amazon.mShop.android.shopping', scheme: (q) => `upi://pay?${q}`, colour: '#232f3e', initials: 'a' },
];

function platform() {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const inApp = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('app') === '1' || /InkllyApp/i.test(ua));
  return {
    android: /Android/i.test(ua),
    ios: /iPhone|iPad|iPod/i.test(ua),
    mobile: /Android|iPhone|iPad|iPod|Mobile/i.test(ua),
    inApp,
  };
}

function appLink(app: UpiApp, uri: string): string {
  const query = uri.split('?')[1] || '';
  const env = platform();
  if (env.android && !env.inApp) {
    // Chrome on Android opens exactly this app; if it is missing, the browser
    // falls back to the generic UPI link, which shows every installed UPI app.
    return `intent://pay?${query}#Intent;scheme=upi;package=${app.androidPackage};S.browser_fallback_url=${encodeURIComponent(uri)};end`;
  }
  return app.scheme(query);
}

const PAYER_APP_KEY = 'inklly.lastUpiApp';

export function UpiPaySheet(props: {
  payment: UpiPayment;
  shopName: string;
  token?: string | null;
  claimed?: boolean;
  onClaim: (details: { upiReference?: string; payerApp?: string }) => Promise<void>;
}) {
  const { payment } = props;
  const env = useMemo(platform, []);
  const [qr, setQr] = useState<string | null>(null);
  const [chosenApp, setChosenApp] = useState<string | null>(() => {
    try { return localStorage.getItem(PAYER_APP_KEY); } catch { return null; }
  });
  const [opened, setOpened] = useState(false);
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(Boolean(props.claimed));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(payment.uri, { margin: 1, width: 260, errorCorrectionLevel: 'M', color: { dark: '#111827', light: '#ffffff' } })
      .then((url) => { if (alive) setQr(url); })
      .catch(() => setQr(null));
    return () => { alive = false; };
  }, [payment.uri]);

  const open = (href: string, appId: string | null) => {
    if (appId) {
      setChosenApp(appId);
      try { localStorage.setItem(PAYER_APP_KEY, appId); } catch { /* optional */ }
    }
    setOpened(true);
    window.location.href = href;
  };

  const claim = async () => {
    setSaving(true);
    setError(null);
    try {
      await props.onClaim({ upiReference: reference.trim() || undefined, payerApp: chosenApp || undefined });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const copyUpiId = async () => {
    try { await navigator.clipboard.writeText(payment.upiId); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  if (done) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-center animate-fade-in">
        <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-emerald-500 text-2xl text-white">✓</div>
        <p className="text-base font-extrabold text-emerald-900">Thanks! The shop will confirm your UPI payment</p>
        <p className="mt-1 text-sm text-emerald-800">Show {props.token ? <>token <b>#{props.token}</b></> : 'your token'} at the counter to collect your prints.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="upi-pay-title" className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-indigo-600 to-violet-600 px-5 py-5 text-white">
        <p id="upi-pay-title" className="text-xs font-bold uppercase tracking-widest text-indigo-100">Pay by UPI</p>
        <p className="mt-1 text-4xl font-black tabular-nums">₹{payment.amount}</p>
        <p className="mt-1 text-sm text-indigo-100">to <b className="text-white">{payment.payeeName}</b> · goes straight to the shop</p>
      </div>

      <div className="space-y-4 p-5">
        {env.mobile ? (
          <>
            {env.android && (
              <button
                type="button"
                onClick={() => open(payment.uri, null)}
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-base font-extrabold text-white shadow-lg active:scale-[0.98] transition"
              >
                Pay ₹{payment.amount} with a UPI app
              </button>
            )}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{env.android ? 'Or open a specific app' : 'Choose your UPI app'}</p>
              <div className="grid grid-cols-3 gap-2">
                {UPI_APPS.filter((app) => !(env.ios && (app.id === 'bhim' || app.id === 'amazonpay'))).map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => open(appLink(app, payment.uri), app.id)}
                    className={`flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-bold text-slate-700 transition active:scale-95 ${chosenApp === app.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl text-sm font-black text-white" style={{ background: app.colour }} aria-hidden>{app.initials}</span>
                    {app.name}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-center text-xs text-slate-500">The amount is filled in for you — just enter your UPI PIN.</p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <div className="rounded-2xl border border-slate-200 p-2">
              {qr ? <img src={qr} alt={`UPI QR code to pay ₹${payment.amount} to ${payment.payeeName}`} className="h-52 w-52" /> : <div className="h-52 w-52 animate-pulse rounded-xl bg-slate-100" />}
            </div>
            <div className="text-sm text-slate-600">
              <p className="font-bold text-slate-900">Scan with any UPI app</p>
              <p className="mt-1">PhonePe, Google Pay, Paytm, BHIM, CRED or your bank app. ₹{payment.amount} is already filled in.</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-500">UPI ID</span>
          <span className="flex items-center gap-2 font-mono font-bold text-slate-800">
            {payment.upiId}
            <button type="button" onClick={copyUpiId} className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600">{copied ? 'Copied' : 'Copy'}</button>
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-sm font-extrabold text-slate-900">{opened ? 'Did the payment go through?' : 'After paying'}</p>
          <label className="mt-2 block text-xs font-semibold text-slate-500" htmlFor="upi-utr">UPI reference / UTR (optional — helps the shop find it)</label>
          <input
            id="upi-utr"
            inputMode="numeric"
            autoComplete="off"
            maxLength={35}
            value={reference}
            onChange={(event) => setReference(event.target.value.replace(/[^A-Za-z0-9]/g, ''))}
            placeholder="12-digit number from your UPI app"
            className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
          <button
            type="button"
            disabled={saving}
            onClick={claim}
            className="mt-3 min-h-[52px] w-full rounded-2xl bg-emerald-600 px-4 text-base font-extrabold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? 'Saving…' : "I've paid"}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-500">Payment failed? Try another app, or pay at the counter when you collect.</p>
        </div>
      </div>
    </section>
  );
}
