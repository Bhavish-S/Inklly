import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api/client';
import { formatInr, printReceipt } from '../receipt';

interface Service { id: string; name: string; unitLabel: string; unitPricePaise: number; kind: 'bw_page' | 'color_page' | 'scan' | 'other' }
interface CartLine { key: string; serviceId: string | null; name: string; unitPricePaise: number; quantity: number; unitLabel: string }
interface Sale {
  id: string; saleNumber: string; customerName: string | null; customerPhone: string | null;
  items: Array<{ name: string; quantity: number; unitPricePaise: number; lineTotalPaise: number; unitLabel: string }>;
  totalPaise: number; paymentMethod: 'CASH' | 'UPI'; createdAt: string; voidedAt: string | null;
}
interface Settings { autoPrint: 'off' | 'paid' | 'all'; upiId: string | null; upiPayeeName: string | null }

interface QuickSaleViewProps {
  shop: { name: string; address?: string; phone?: string };
  canManage: boolean;
}

const rupeesToPaise = (value: string) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : NaN;
};

/**
 * Counter billing for walk-in customers: tap services (or press their number
 * keys), adjust quantities, take cash or show a UPI QR, then print a receipt.
 */
export const QuickSaleView: React.FC<QuickSaleViewProps> = ({ shop, canManage }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [payment, setPayment] = useState<'CASH' | 'UPI'>('CASH');
  const [cashGiven, setCashGiven] = useState('');
  const [sales, setSales] = useState<Sale[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [upiQr, setUpiQr] = useState<string | null>(null);
  const [tab, setTab] = useState<'bill' | 'prices' | 'settings'>('bill');
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    try {
      const [serviceList, counterSettings, todays] = await Promise.all([api.getCounterServices(), api.getCounterSettings(), api.getCounterSales()]);
      setServices(serviceList);
      setSettings(counterSettings);
      setSales(todays.sales || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the counter.');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const totalPaise = useMemo(() => cart.reduce((sum, line) => sum + line.unitPricePaise * line.quantity, 0), [cart]);
  const changePaise = useMemo(() => {
    const given = rupeesToPaise(cashGiven);
    return Number.isFinite(given) && given >= totalPaise ? given - totalPaise : null;
  }, [cashGiven, totalPaise]);

  // A UPI QR with the exact amount, so the customer's app pre-fills it.
  useEffect(() => {
    let active = true;
    if (payment !== 'UPI' || !settings?.upiId || totalPaise <= 0) { setUpiQr(null); return; }
    const params = new URLSearchParams({ pa: settings.upiId, pn: (settings.upiPayeeName || shop.name).slice(0, 50), am: (totalPaise / 100).toFixed(2), cu: 'INR', tn: `${shop.name} counter`.slice(0, 50) });
    QRCode.toDataURL(`upi://pay?${params}`, { margin: 1, width: 360 }).then((url) => { if (active) setUpiQr(url); }).catch(() => setUpiQr(null));
    return () => { active = false; };
  }, [payment, settings, totalPaise, shop.name]);

  const addService = (service: Service, amount = 1) => {
    setCart((current) => {
      const existing = current.find((line) => line.serviceId === service.id);
      if (existing) return current.map((line) => line === existing ? { ...line, quantity: Math.min(10000, line.quantity + amount) } : line);
      return [...current, { key: service.id, serviceId: service.id, name: service.name, unitPricePaise: service.unitPricePaise, quantity: amount, unitLabel: service.unitLabel }];
    });
    setTimeout(() => qtyRefs.current[service.id]?.select(), 0);
  };

  const addCustom = () => {
    const price = rupeesToPaise(customPrice);
    if (!customName.trim() || !Number.isFinite(price) || price <= 0) { setError('Enter a name and a price for the custom item.'); return; }
    const key = `custom-${Date.now()}`;
    setCart((current) => [...current, { key, serviceId: null, name: customName.trim().slice(0, 60), unitPricePaise: price, quantity: 1, unitLabel: 'item' }]);
    setCustomName('');
    setCustomPrice('');
    setError('');
  };

  const setQuantity = (key: string, quantity: number) => {
    setCart((current) => current
      .map((line) => line.key === key ? { ...line, quantity: Math.max(0, Math.min(10000, Math.floor(quantity) || 0)) } : line)
      .filter((line) => line.quantity > 0 || line.key === key));
  };

  const clearSale = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setCashGiven('');
    setPayment('CASH');
    setError('');
  };

  const receiptFor = (sale: Sale) => ({
    shopName: shop.name,
    shopAddress: shop.address,
    shopPhone: shop.phone,
    title: sale.voidedAt ? 'CANCELLED SALE' : 'Receipt',
    reference: sale.saleNumber,
    customer: sale.customerName,
    createdAt: sale.createdAt,
    lines: sale.items.map((item) => ({ label: item.name, detail: `${item.quantity} ${item.unitLabel}${item.quantity > 1 ? 's' : ''} × ${formatInr(item.unitPricePaise)}`, amountPaise: item.lineTotalPaise })),
    totalPaise: sale.totalPaise,
    paymentLabel: sale.paymentMethod === 'UPI' ? 'UPI' : 'Cash',
  });

  const charge = async (printAfter: boolean) => {
    const lines = cart.filter((line) => line.quantity > 0);
    if (!lines.length || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.createCounterSale({
        paymentMethod: payment,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        items: lines.map((line) => line.serviceId
          ? { serviceId: line.serviceId, quantity: line.quantity }
          : { name: line.name, unitPricePaise: line.unitPricePaise, quantity: line.quantity }),
      });
      setLastSale(result.sale);
      setSales((current) => [result.sale, ...current]);
      if (printAfter) printReceipt(receiptFor(result.sale));
      clearSale();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The sale could not be saved. Nothing was charged.');
    } finally {
      setBusy(false);
    }
  };

  // Keyboard: 1–9 add a service, Enter charges, Ctrl/⌘+Enter charges and prints, Esc clears.
  useEffect(() => {
    if (tab !== 'bill') return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void charge(true); return; }
      if (event.key === 'Escape') { clearSale(); return; }
      if (typing) return;
      if (/^[1-9]$/.test(event.key)) {
        const service = services[Number(event.key) - 1];
        if (service) { event.preventDefault(); addService(service); }
      } else if (event.key === 'Enter') {
        event.preventDefault();
        void charge(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const todaysTotal = sales.filter((sale) => !sale.voidedAt).reduce((sum, sale) => sum + sale.totalPaise, 0);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Counter</p>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Quick sale</h1>
          <p className="text-xs text-slate-500">Bill walk-in work: photocopies, prints, lamination, binding. Today: {sales.filter((s) => !s.voidedAt).length} sales · <strong>{formatInr(todaysTotal)}</strong></p>
        </div>
        <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-sm font-semibold">
          {(['bill', 'prices', 'settings'] as const).map((value) => (
            <button key={value} type="button" onClick={() => setTab(value)} className={`px-4 py-2 rounded-lg ${tab === value ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}>
              {value === 'bill' ? 'Bill' : value === 'prices' ? 'Price list' : 'Counter settings'}
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {tab === 'bill' && (
        <div className="grid lg:grid-cols-[1fr_380px] gap-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {services.map((service, index) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => addService(service)}
                  className="relative text-left rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 hover:border-indigo-400 hover:shadow-sm active:scale-[0.99] transition"
                >
                  {index < 9 && <kbd className="absolute top-2 right-2 text-[10px] font-mono text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1">{index + 1}</kbd>}
                  <span className="block text-sm font-bold text-slate-900 dark:text-white pr-6">{service.name}</span>
                  <span className="block mt-1 text-xs text-slate-500">{formatInr(service.unitPricePaise)} / {service.unitLabel}</span>
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-3 flex flex-wrap items-center gap-2">
              <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Other item (e.g. Stapling)" maxLength={60} className="flex-1 min-w-[160px] min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" />
              <input value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} inputMode="decimal" placeholder="₹ price" className="w-28 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
              <button type="button" onClick={addCustom} className="min-h-[40px] px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold">Add</button>
            </div>
            <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Today’s counter sales</h2>
              {sales.length === 0 ? <p className="text-sm text-slate-500">No walk-in sales yet today.</p> : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
                  {sales.map((sale) => (
                    <li key={sale.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className={`font-mono font-semibold ${sale.voidedAt ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>{sale.saleNumber}</span>
                        <span className="ml-2 text-xs text-slate-500">{new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {sale.items.map((item) => `${item.quantity}× ${item.name}`).join(', ')}</span>
                      </span>
                      <span className="shrink-0 flex items-center gap-2">
                        <span className={`font-bold ${sale.voidedAt ? 'text-slate-400 line-through' : ''}`}>{formatInr(sale.totalPaise)}</span>
                        <span className="text-[11px] text-slate-500">{sale.paymentMethod}</span>
                        <button type="button" onClick={() => printReceipt(receiptFor(sale))} className="text-xs font-semibold text-indigo-600">Receipt</button>
                        {canManage && !sale.voidedAt && (
                          <button type="button" className="text-xs font-semibold text-red-600" onClick={async () => {
                            const reason = window.prompt(`Cancel ${sale.saleNumber} (${formatInr(sale.totalPaise)})? Reason:`);
                            if (!reason) return;
                            try {
                              const updated = await api.voidCounterSale(sale.id, reason);
                              setSales((current) => current.map((item) => item.id === sale.id ? updated : item));
                            } catch (err) { setError(err instanceof Error ? err.message : 'Could not cancel the sale.'); }
                          }}>Cancel</button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 lg:sticky lg:top-4 h-fit space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Current bill</h2>
            {cart.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">Tap a service or press its number key.</p>
            ) : (
              <ul className="space-y-2">
                {cart.map((line) => (
                  <li key={line.key} className="flex items-center gap-2">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">{line.name}</span>
                      <span className="block text-[11px] text-slate-500">{formatInr(line.unitPricePaise)} / {line.unitLabel}</span>
                    </span>
                    <button type="button" aria-label={`One less ${line.name}`} onClick={() => setQuantity(line.key, line.quantity - 1)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold">−</button>
                    <input
                      ref={(node) => { if (line.serviceId) qtyRefs.current[line.serviceId] = node; }}
                      value={line.quantity}
                      onChange={(e) => setQuantity(line.key, Number(e.target.value.replace(/\D/g, '')))}
                      inputMode="numeric"
                      aria-label={`Quantity of ${line.name}`}
                      className="w-14 h-8 text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold"
                    />
                    <button type="button" aria-label={`One more ${line.name}`} onClick={() => setQuantity(line.key, line.quantity + 1)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold">+</button>
                    <span className="w-20 text-right text-sm font-bold">{formatInr(line.unitPricePaise * line.quantity)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-baseline justify-between border-t border-slate-200 dark:border-slate-700 pt-3">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Total</span>
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{formatInr(totalPaise)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer (optional)" maxLength={80} className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" />
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Mobile (optional)" inputMode="tel" maxLength={14} className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['CASH', 'UPI'] as const).map((method) => (
                <button key={method} type="button" onClick={() => setPayment(method)} aria-pressed={payment === method}
                  className={`min-h-[44px] rounded-xl border text-sm font-bold ${payment === method ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {method === 'CASH' ? 'Cash' : 'UPI'}
                </button>
              ))}
            </div>
            {payment === 'CASH' && totalPaise > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <input value={cashGiven} onChange={(e) => setCashGiven(e.target.value)} inputMode="decimal" placeholder="Cash received ₹" className="flex-1 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3" />
                <span className="text-slate-600 dark:text-slate-300">Change: <strong>{changePaise === null ? '—' : formatInr(changePaise)}</strong></span>
              </div>
            )}
            {payment === 'UPI' && totalPaise > 0 && (
              settings?.upiId ? (
                <div className="text-center rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                  {upiQr && <img src={upiQr} alt={`UPI QR for ${formatInr(totalPaise)}`} className="mx-auto w-44 h-44 rounded-lg bg-white p-1" />}
                  <p className="mt-1 text-xs text-slate-500">Customer scans to pay {formatInr(totalPaise)} to {settings.upiId}. Check your UPI app before confirming.</p>
                </div>
              ) : (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-2">Add your shop’s UPI ID in Counter settings to show a pay QR here.</p>
              )
            )}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button type="button" disabled={!cart.length || busy || totalPaise <= 0} onClick={() => void charge(false)} className="min-h-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold disabled:opacity-40">
                {busy ? 'Saving…' : `Charge ${formatInr(totalPaise)}`}
              </button>
              <button type="button" disabled={!cart.length || busy || totalPaise <= 0} onClick={() => void charge(true)} className="min-h-[52px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold disabled:opacity-40">
                Charge + receipt
              </button>
            </div>
            <p className="text-[11px] text-slate-400">Keys: <kbd>1</kbd>–<kbd>9</kbd> add · <kbd>Enter</kbd> charge · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> charge & print · <kbd>Esc</kbd> clear</p>
            {lastSale && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-3 text-sm flex items-center justify-between gap-2">
                <span className="text-emerald-900 dark:text-emerald-100">Saved {lastSale.saleNumber} · {formatInr(lastSale.totalPaise)}</span>
                <button type="button" onClick={() => printReceipt(receiptFor(lastSale))} className="text-xs font-bold text-emerald-800 dark:text-emerald-200 underline">Print receipt</button>
              </div>
            )}
          </aside>
        </div>
      )}

      {tab === 'prices' && <PriceListEditor services={services} canManage={canManage} onSaved={setServices} onError={setError} />}
      {tab === 'settings' && settings && <CounterSettingsPanel settings={settings} canManage={canManage} onSaved={setSettings} onError={setError} />}
    </div>
  );
};

const PriceListEditor: React.FC<{ services: Service[]; canManage: boolean; onSaved: (s: Service[]) => void; onError: (m: string) => void }> = ({ services, canManage, onSaved, onError }) => {
  const [rows, setRows] = useState(() => services.map((service) => ({ ...service, price: (service.unitPricePaise / 100).toString() })));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setRows(services.map((service) => ({ ...service, price: (service.unitPricePaise / 100).toString() }))); }, [services]);
  const update = (index: number, patch: Partial<(typeof rows)[number]>) => { setSaved(false); setRows((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row)); };
  const save = async () => {
    setSaving(true);
    onError('');
    try {
      const payload = rows.map((row) => ({ id: row.id, name: row.name, unitLabel: row.unitLabel, kind: row.kind, unitPricePaise: rupeesToPaise(row.price) }));
      if (payload.some((row) => !Number.isSafeInteger(row.unitPricePaise))) throw new Error('Every price must be a number in rupees.');
      onSaved(await api.saveCounterServices(payload));
      setSaved(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save the price list.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 max-w-3xl">
      <p className="text-sm text-slate-500 mb-3">The first nine items get number keys on the Bill screen. “Counts as” puts sold pages into your daily report.</p>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={row.id || index} className="grid grid-cols-[1fr_90px_90px_120px_auto] gap-2 items-center">
            <input disabled={!canManage} value={row.name} onChange={(e) => update(index, { name: e.target.value })} className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" aria-label="Service name" />
            <input disabled={!canManage} value={row.price} onChange={(e) => update(index, { price: e.target.value })} inputMode="decimal" className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" aria-label="Price in rupees" />
            <input disabled={!canManage} value={row.unitLabel} onChange={(e) => update(index, { unitLabel: e.target.value })} className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" aria-label="Unit" />
            <select disabled={!canManage} value={row.kind} onChange={(e) => update(index, { kind: e.target.value as Service['kind'] })} className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-sm" aria-label="Counts as">
              <option value="bw_page">B&W pages</option>
              <option value="color_page">Colour pages</option>
              <option value="scan">Scans</option>
              <option value="other">Other</option>
            </select>
            <button disabled={!canManage} type="button" onClick={() => { setSaved(false); setRows((current) => current.filter((_, i) => i !== index)); }} className="text-sm text-red-600 px-2" aria-label={`Remove ${row.name}`}>✕</button>
          </div>
        ))}
      </div>
      {canManage && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setRows((current) => [...current, { id: '', name: '', unitLabel: 'item', unitPricePaise: 0, kind: 'other', sortOrder: current.length, price: '' }])} className="min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold">+ Add service</button>
          <button type="button" disabled={saving} onClick={() => void save()} className="min-h-[40px] px-5 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50">{saving ? 'Saving…' : 'Save price list'}</button>
          {saved && <span className="self-center text-sm text-emerald-700">Saved</span>}
        </div>
      )}
    </section>
  );
};

const CounterSettingsPanel: React.FC<{ settings: Settings; canManage: boolean; onSaved: (s: Settings) => void; onError: (m: string) => void }> = ({ settings, canManage, onSaved, onError }) => {
  const [autoPrint, setAutoPrint] = useState(settings.autoPrint);
  const [upiId, setUpiId] = useState(settings.upiId || '');
  const [payee, setPayee] = useState(settings.upiPayeeName || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = async () => {
    setSaving(true);
    onError('');
    try {
      onSaved(await api.updateCounterSettings({ autoPrint, upiId: upiId.trim() || null, upiPayeeName: payee.trim() || null }));
      setSaved(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save counter settings.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="grid lg:grid-cols-2 gap-4 max-w-4xl">
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Auto-print</h2>
        <p className="text-xs text-slate-500 mt-1 mb-3">Send QR orders to the right printer without pressing Print. Needs the Inklly app running on your print computer.</p>
        {([
          ['off', 'Off', 'Staff press Print for every order.'],
          ['paid', 'Paid orders only', 'Orders paid online print straight away. Cash orders wait for you.'],
          ['all', 'All orders', 'Every order prints as soon as it arrives. Collect cash at pickup.'],
        ] as const).map(([value, title, hint]) => (
          <label key={value} className={`flex gap-3 rounded-xl border p-3 mb-2 cursor-pointer ${autoPrint === value ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
            <input type="radio" name="autoPrint" disabled={!canManage} checked={autoPrint === value} onChange={() => { setAutoPrint(value); setSaved(false); }} className="mt-1" />
            <span><span className="block text-sm font-bold text-slate-900 dark:text-white">{title}</span><span className="block text-xs text-slate-500">{hint}</span></span>
          </label>
        ))}
      </section>
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">UPI at the counter</h2>
        <p className="text-xs text-slate-500 mt-1 mb-3">Quick sale shows a QR with the exact amount. Money goes straight to your UPI account; Inklly never holds it.</p>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">UPI ID
          <input disabled={!canManage} value={upiId} onChange={(e) => { setUpiId(e.target.value); setSaved(false); }} placeholder="shopname@okaxis" className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm font-normal" />
        </label>
        <label className="block mt-3 text-xs font-semibold text-slate-700 dark:text-slate-300">Name shown to the payer
          <input disabled={!canManage} value={payee} onChange={(e) => { setPayee(e.target.value); setSaved(false); }} placeholder="Your shop name" maxLength={80} className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm font-normal" />
        </label>
      </section>
      {canManage && (
        <div className="lg:col-span-2 flex items-center gap-3">
          <button type="button" disabled={saving} onClick={() => void save()} className="min-h-[44px] px-6 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50">{saving ? 'Saving…' : 'Save counter settings'}</button>
          {saved && <span className="text-sm text-emerald-700">Saved</span>}
        </div>
      )}
    </div>
  );
};
