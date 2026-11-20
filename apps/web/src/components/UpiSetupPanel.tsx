import { useEffect, useState } from 'react';
import { api } from '../api/client';

/**
 * The shop's own UPI ID. Customers pay it straight from PhonePe / Google Pay /
 * Paytm with the amount filled in, and the counter's UPI QR uses it too.
 */
export function UpiSetupPanel() {
  const [upiId, setUpiId] = useState('');
  const [payee, setPayee] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.getCounterSettings()
      .then((settings: any) => { setUpiId(settings?.upiId || ''); setPayee(settings?.upiPayeeName || ''); })
      .catch(() => { /* shown as empty */ })
      .finally(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const saved: any = await api.updateCounterSettings({ upiId: upiId.trim() || null, upiPayeeName: payee.trim() || null });
      setUpiId(saved?.upiId || '');
      setPayee(saved?.upiPayeeName || '');
      setMessage({ tone: 'ok', text: saved?.upiId ? 'Saved. Customers can now pay you by UPI when they order.' : 'UPI payments are off. Customers pay at the counter.' });
    } catch (error: any) {
      setMessage({ tone: 'error', text: error?.message || 'Could not save.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="upi-setup-title" className="rounded-2xl border border-[#E8EAF3] dark:border-gray-800 bg-white dark:bg-gray-800 p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-xl text-white" aria-hidden>⚡</span>
        <div>
          <h3 id="upi-setup-title" className="text-sm font-extrabold text-[#172031] dark:text-white">Get paid by UPI</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Customers pay this UPI ID from PhonePe, Google Pay, Paytm or any UPI app — the amount is filled in for them and the money comes straight to you. Inklly never holds it.</p>
        </div>
        {loaded && (
          <span className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${upiId ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{upiId ? 'On' : 'Not set'}</span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
          Your UPI ID
          <input value={upiId} onChange={(e) => setUpiId(e.target.value.replace(/\s/g, ''))} placeholder="yourshop@ybl" autoComplete="off" inputMode="email"
            className="mt-1 w-full min-h-[44px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm font-mono" />
        </label>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
          Name customers see
          <input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="Shop name on your bank account" maxLength={80}
            className="mt-1 w-full min-h-[44px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm" />
        </label>
      </div>

      <p className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 px-3 py-2 text-[11px] text-indigo-900 dark:text-indigo-200">
        Tip: use a <b>business</b> UPI ID (PhonePe Business, Paytm for Business, Google Pay for Business, BharatPe). Some apps limit payments to personal UPI IDs.
        At the counter, check the credit in your UPI app before handing over prints.
      </p>

      {message && <p role="status" className={`text-xs font-semibold ${message.tone === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</p>}
      <button type="button" onClick={save} disabled={saving || !loaded}
        className="min-h-[44px] rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">
        {saving ? 'Saving…' : 'Save UPI details'}
      </button>
    </section>
  );
}
