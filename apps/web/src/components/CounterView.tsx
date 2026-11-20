import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api/client';
import { formatInr, printReceipt } from '../receipt';
import { playChime } from '../ready-alert';
import { BrowserPrintJob, buildJobPdf, openPrintDialog, planBrowserPrintJobs } from '../browser-print';

/**
 * The shop counter, in the order the work actually happens:
 * the customer says their token or name → staff find the order → choose a
 * printer for each file → Print → check the pages → take payment → hand over.
 * Nothing prints until staff press Print.
 */

type Stage = 'payment' | 'print' | 'printing' | 'collect' | 'done' | 'issue' | 'cancelled';

interface OrderFile {
  id: string;
  fileName: string;
  pageCount: number;
  mimeType?: string;
  lineSubtotalPaise?: number;
  printOptions?: {
    colorMode?: 'bw' | 'color' | 'mixed';
    colorPages?: string;
    duplexMode?: string;
    paperSize?: string;
    orientation?: string;
    copies?: number;
    pageRange?: string;
    note?: string;
  };
}
interface PrintJob { id: string; orderFileId: string; status: string; printerId: string | null }
interface Order {
  id: string;
  orderNumber: string;
  tokenNumber?: string;
  customerName?: string;
  customerPhone?: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalAmountPaise: number;
  createdAt: string;
  files: OrderFile[];
  printJobs?: PrintJob[];
  upiClaim?: { upiReference: string | null; payerApp: string | null; claimedAt: string } | null;
}
interface Printer {
  id: string;
  name: string;
  agentId?: string;
  isDefault?: boolean;
  supportsColor: boolean;
  supportsDuplex: boolean;
  trays: Array<{ supportedSizes: string[] }>;
  healthStatus?: string;
}

const ACTIVE_STATUSES = [
  'AWAITING_PAYMENT', 'SUBMITTED', 'AWAITING_REVIEW', 'READY_FOR_PRINT', 'PENDING_RELEASE', 'PENDING_AGENT_SPOOL',
  'IN_PROGRESS', 'PRINT_FAILED', 'PRINT_UNCONFIRMED', 'READY_FOR_COLLECTION', 'ON_HOLD', 'FAILED_REQUIRES_SUPPORT',
].join(',');

export function stageOf(order: Order): Stage {
  if (order.status === 'CANCELLED') return 'cancelled';
  if (order.status === 'COLLECTED') return 'done';
  if (order.status === 'READY_FOR_COLLECTION') return 'collect';
  if (order.status === 'AWAITING_PAYMENT') return 'payment';
  if (['PRINT_UNCONFIRMED', 'ON_HOLD', 'FAILED_REQUIRES_SUPPORT'].includes(order.status)) return 'issue';
  const jobs = order.printJobs || [];
  if (order.status === 'IN_PROGRESS' && jobs.some((job) => job.status === 'DISPATCH_FAILED') && jobs.every((job) => job.status === 'DISPATCH_FAILED' || job.status === 'PRINT_CONFIRMED')) return 'print';
  if (order.status === 'IN_PROGRESS') return 'printing';
  return 'print';
}

const token = (order: Order) => `#${String(order.tokenNumber || order.orderNumber.slice(-4)).replace(/^T-/, '')}`;
const isPaid = (order: Order) => order.paymentStatus === 'VERIFIED';
const minutesAgo = (iso: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
const colourLabel = (file: OrderFile) => file.printOptions?.colorMode === 'color' ? 'Colour' : file.printOptions?.colorMode === 'mixed' ? 'Mixed colour' : 'B&W';
const needsColour = (file: OrderFile) => file.printOptions?.colorMode === 'color' || file.printOptions?.colorMode === 'mixed';

/** Why a printer cannot print a file, or null when it can. Mirrors the server check. */
export function printerProblem(printer: Printer, file: OrderFile): string | null {
  if (printer.healthStatus && printer.healthStatus !== 'ONLINE') return 'offline';
  if (!printer.agentId) return 'not connected';
  if (!printer.trays?.length) return 'not set up';
  if (needsColour(file) && !printer.supportsColor) return 'B&W only';
  if (file.printOptions?.duplexMode && file.printOptions.duplexMode !== 'simplex' && !printer.supportsDuplex) return 'no double-sided';
  const size = file.printOptions?.paperSize || 'A4';
  if (!printer.trays.some((tray) => tray.supportedSizes?.includes(size))) return `no ${size}`;
  return null;
}

/** Suggests the printer a shopkeeper would pick: colour work on a colour printer, B&W on a mono one. */
export function suggestPrinter(printers: Printer[], file: OrderFile): Printer | null {
  const usable = printers.filter((printer) => !printerProblem(printer, file));
  if (!usable.length) return null;
  const preferred = usable.filter((printer) => needsColour(file) ? printer.supportsColor : !printer.supportsColor);
  const pool = preferred.length ? preferred : usable;
  return pool.find((printer) => printer.isDefault) || pool[0];
}

const STAGE_STYLE: Record<Stage, { label: string; chip: string }> = {
  payment: { label: 'Waiting for online payment', chip: 'bg-slate-100 text-slate-600' },
  print: { label: 'To print', chip: 'bg-indigo-100 text-indigo-700' },
  printing: { label: 'Printing', chip: 'bg-sky-100 text-sky-700' },
  collect: { label: 'Ready for pickup', chip: 'bg-emerald-100 text-emerald-700' },
  done: { label: 'Collected', chip: 'bg-slate-100 text-slate-500' },
  issue: { label: 'Check printer', chip: 'bg-amber-100 text-amber-800' },
  cancelled: { label: 'Cancelled', chip: 'bg-slate-100 text-slate-400' },
};

interface CounterViewProps {
  shop: { name: string; address?: string; phone?: string };
  onOpenPrinterSetup?: () => void;
}

export const CounterView: React.FC<CounterViewProps> = ({ shop, onOpenPrinterSetup }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchResults, setSearchResults] = useState<Order[] | null>(null);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'print' | 'printing' | 'collect'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; issues?: string[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [upiId, setUpiId] = useState<string | null>(null);
  const [upiPayee, setUpiPayee] = useState<string | null>(null);
  const [upiQr, setUpiQr] = useState<string | null>(null);
  const [showUpi, setShowUpi] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Printing through this computer's print dialog (no print app needed).
  const [browserJobs, setBrowserJobs] = useState<{ orderId: string; jobs: BrowserPrintJob[]; printed: string[] } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const knownIds = useRef<Set<string> | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const result = await api.getOrders(ACTIVE_STATUSES, { pageSize: 100, sortBy: 'createdAt', sortOrder: 'asc' });
      const list: Order[] = Array.isArray(result) ? result : result.orders || [];
      if (knownIds.current) {
        const fresh = list.filter((order) => !knownIds.current!.has(order.id) && stageOf(order) === 'print');
        if (fresh.length) {
          playChime();
          setNotice(fresh.length > 1 ? `${fresh.length} new orders` : `New order ${token(fresh[0])} from ${fresh[0].customerName || 'a customer'}`);
        }
      }
      knownIds.current = new Set(list.map((order) => order.id));
      setOrders(list);
      setLoaded(true);
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Could not load orders.' });
    }
  }, []);

  const loadPrinters = useCallback(async () => {
    try {
      const list = await api.getPrinters();
      setPrinters(Array.isArray(list) ? list : []);
    } catch { /* printers panel shows the empty state */ }
  }, []);

  useEffect(() => {
    void loadOrders();
    void loadPrinters();
    api.getCounterSettings().then((settings: any) => { setUpiId(settings.upiId || null); setUpiPayee(settings.upiPayeeName || null); }).catch(() => undefined);
    const ordersTimer = window.setInterval(() => void loadOrders(), 5000);
    const printersTimer = window.setInterval(() => void loadPrinters(), 15000);
    searchRef.current?.focus();
    return () => { window.clearInterval(ordersTimer); window.clearInterval(printersTimer); };
  }, [loadOrders, loadPrinters]);

  // Search all orders (including collected ones) by token, name, phone or file.
  useEffect(() => {
    const term = query.trim().replace(/^#/, '');
    if (!term) { setSearchResults(null); return; }
    const timer = window.setTimeout(async () => {
      try {
        const result = await api.getOrders('ALL', { search: term, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc' });
        setSearchResults(Array.isArray(result) ? result : result.orders || []);
      } catch { setSearchResults([]); }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visible = useMemo(() => {
    const source = searchResults ?? orders;
    if (searchResults || filter === 'all') return source;
    return source.filter((order) => {
      const stage = stageOf(order);
      return filter === 'print' ? stage === 'print' || stage === 'issue' : stage === filter;
    });
  }, [orders, searchResults, filter]);

  const counts = useMemo(() => ({
    print: orders.filter((order) => ['print', 'issue'].includes(stageOf(order))).length,
    printing: orders.filter((order) => stageOf(order) === 'printing').length,
    collect: orders.filter((order) => stageOf(order) === 'collect').length,
  }), [orders]);

  const agentReady = printers.some((printer) => printer.agentId && printer.healthStatus === 'ONLINE');

  const selected = useMemo(
    () => [...orders, ...(searchResults || [])].find((order) => order.id === selectedId) || null,
    [orders, searchResults, selectedId]
  );

  // Default printer per file for the selected order.
  const chosenPrinter = (order: Order, file: OrderFile): string => {
    const picked = assignments[order.id]?.[file.id];
    if (picked && printers.some((printer) => printer.id === picked)) return picked;
    const jobPrinter = order.printJobs?.find((job) => job.orderFileId === file.id)?.printerId;
    if (jobPrinter && printers.some((printer) => printer.id === jobPrinter && !printerProblem(printer, file))) return jobPrinter;
    return suggestPrinter(printers, file)?.id || '';
  };

  useEffect(() => {
    setShowUpi(false);
    setError(null);
    setBrowserJobs((current) => (current && current.orderId === selectedId ? current : null));
  }, [selectedId]);

  useEffect(() => {
    let active = true;
    if (!showUpi || !selected || !upiId) { setUpiQr(null); return; }
    const params = new URLSearchParams({ pa: upiId, pn: (upiPayee || shop.name).slice(0, 50), am: (selected.totalAmountPaise / 100).toFixed(2), cu: 'INR', tn: `Print order ${token(selected)}` });
    QRCode.toDataURL(`upi://pay?${params}`, { margin: 1, width: 320 }).then((url) => { if (active) setUpiQr(url); }).catch(() => undefined);
    return () => { active = false; };
  }, [showUpi, selected, upiId, upiPayee, shop.name]);

  const refreshAfter = async (orderId: string) => {
    await loadOrders();
    if (searchResults) {
      try {
        const result = await api.getOrders('ALL', { search: query.trim().replace(/^#/, ''), pageSize: 20 });
        setSearchResults(Array.isArray(result) ? result : result.orders || []);
      } catch { /* keep previous results */ }
    }
    setSelectedId(orderId);
  };

  const run = async (label: string, action: () => Promise<unknown>, success: string) => {
    if (!selected || busy) return;
    setBusy(label);
    setError(null);
    try {
      await action();
      setNotice(success);
      await refreshAfter(selected.id);
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Something went wrong.', issues: (err as any)?.issues });
    } finally {
      setBusy(null);
    }
  };

  const printSelected = () => {
    if (!selected) return;
    const map: Record<string, string> = {};
    for (const file of selected.files) {
      const printerId = chosenPrinter(selected, file);
      if (!printerId) { setError({ message: `Choose a printer for “${file.fileName}”.` }); return; }
      map[file.id] = printerId;
    }
    const names = [...new Set(Object.values(map).map((id) => printers.find((p) => p.id === id)?.name || 'printer'))];
    void run('print', () => api.printOrderToPrinters(selected.id, map), `${token(selected)} sent to ${names.join(' and ')}`);
  };

  const confirmPages = () => {
    if (!selected) return;
    const jobIds = (selected.printJobs || []).filter((job) => job.status !== 'PRINT_CONFIRMED').map((job) => job.id);
    void run('pages', () => api.reconcilePrintOutput(selected.id, 'Staff checked the printed pages at the counter.', jobIds), `${token(selected)} is ready for pickup`);
  };

  /** Downloads the files and prepares one print job per colour/sides/paper group. */
  const prepareBrowserPrint = async () => {
    if (!selected || busy) return;
    setBusy('browser');
    setError(null);
    try {
      const files = await Promise.all(selected.files.map(async (file) => ({
        fileName: file.fileName,
        mimeType: file.mimeType,
        pageCount: file.pageCount,
        blob: await api.fetchOrderFileBlob(selected.id, file.id),
        options: file.printOptions || {},
      })));
      const jobs = planBrowserPrintJobs(files as any);
      setBrowserJobs({ orderId: selected.id, jobs, printed: [] });
      if (jobs.length === 1) await printBrowserJob(jobs[0], selected.id);
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Could not prepare the files for printing.' });
    } finally {
      setBusy(null);
    }
  };

  const printBrowserJob = async (job: BrowserPrintJob, orderId = browserJobs?.orderId) => {
    try {
      const bytes = await buildJobPdf(job);
      await openPrintDialog(bytes, `${job.label} — ${job.files.map((f) => f.fileName).join(', ')}`);
      setBrowserJobs((current) => current && current.orderId === orderId
        ? { ...current, printed: [...new Set([...current.printed, job.key])] }
        : current ?? (orderId ? { orderId, jobs: [job], printed: [job.key] } : null));
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Could not open the print dialog.' });
    }
  };

  const confirmBrowserPrinted = () => {
    if (!selected) return;
    void run('manual', () => api.reconcilePrintOutput(selected.id, 'Printed from the counter computer and checked by staff.', undefined, true), `${token(selected)} is ready for pickup`)
      .then(() => setBrowserJobs(null));
  };

  const printedHere = () => {
    if (!selected) return;
    if (!window.confirm(`Mark ${token(selected)} as printed? Use this when you printed it yourself from this computer.`)) return;
    void run('manual', () => api.reconcilePrintOutput(selected.id, 'Printed from the counter computer and checked by staff.', undefined, true), `${token(selected)} is ready for pickup`);
  };

  const collect = (method: 'CASH' | 'UPI') => {
    if (!selected) return;
    const order = selected;
    void run(method, () => api.collectAtCounter(order.id, method), `${token(order)} done · ${formatInr(order.totalAmountPaise)} ${method === 'UPI' ? 'UPI' : 'cash'} received`);
  };

  const handOver = () => {
    if (!selected) return;
    void run('handover', () => api.updateOrderStatus(selected.id, 'COLLECTED'), `${token(selected)} handed over`);
  };

  const reject = () => {
    if (!selected) return;
    if (!window.confirm(`Cancel order ${token(selected)}? The customer will see it as cancelled.`)) return;
    void run('reject', () => api.updateOrderStatus(selected.id, 'CANCELLED'), `${token(selected)} cancelled`);
  };

  const openFile = async (file: OrderFile) => {
    if (!selected) return;
    try { await api.previewOrderFile(selected.id, file.id); } catch (err) { setError({ message: err instanceof Error ? err.message : 'Could not open the file.' }); }
  };

  const receipt = (order: Order) => printReceipt({
    shopName: shop.name,
    shopAddress: shop.address,
    shopPhone: shop.phone,
    title: isPaid(order) ? 'Receipt' : 'Order slip — amount due',
    reference: order.orderNumber,
    token: token(order),
    customer: order.customerName,
    createdAt: order.createdAt,
    lines: order.files.map((file) => ({
      label: file.fileName,
      detail: `${file.pageCount} pages · ${colourLabel(file)} · ×${file.printOptions?.copies || 1}`,
      amountPaise: Number(file.lineSubtotalPaise || 0),
    })),
    totalPaise: order.totalAmountPaise,
    paymentLabel: isPaid(order) ? (order.paymentMethod === 'ONLINE_RAZORPAY' ? 'Paid online' : 'Paid at counter') : 'Due at counter',
  });

  // Keyboard: / search · ↑↓ move · P print · K pages OK · C cash · U UPI · H hand over
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT';
      if (event.key === 'Escape') { setQuery(''); setSelectedId(null); searchRef.current?.focus(); return; }
      if (typing && target !== searchRef.current) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const index = visible.findIndex((order) => order.id === selectedId);
        const next = event.key === 'ArrowDown' ? Math.min(visible.length - 1, index + 1) : Math.max(0, index - 1);
        if (visible[next]) setSelectedId(visible[next].id);
        return;
      }
      if (target === searchRef.current) {
        if (event.key === 'Enter' && visible[0]) { event.preventDefault(); setSelectedId(visible[0].id); searchRef.current?.blur(); }
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || !selected) return;
      const stage = stageOf(selected);
      const key = event.key.toLowerCase();
      if (key === 'p' && stage === 'print') { event.preventDefault(); if (agentReady) printSelected(); else void prepareBrowserPrint(); }
      else if (key === 'k' && stage === 'printing') { event.preventDefault(); confirmPages(); }
      else if (key === 'c' && stage === 'collect' && !isPaid(selected)) { event.preventDefault(); collect('CASH'); }
      else if (key === 'u' && stage === 'collect' && !isPaid(selected)) { event.preventDefault(); setShowUpi(true); }
      else if (key === 'h' && stage === 'collect' && isPaid(selected)) { event.preventDefault(); handOver(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const connectedPrinters = printers.filter((printer) => printer.agentId);
  const onlinePrinters = connectedPrinters.filter((printer) => printer.healthStatus === 'ONLINE');

  return (
    <div className="h-full flex flex-col lg:flex-row min-h-[calc(100vh-72px)] bg-[#F4F5FA] dark:bg-slate-950">
      {/* Queue */}
      <section className="lg:w-[400px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
        <div className="p-4 space-y-3 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg" aria-hidden="true">⌕</span>
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Token, name or phone…"
              aria-label="Find an order by token, name or phone"
              className="w-full min-h-[52px] rounded-2xl border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 bg-slate-50 dark:bg-slate-800 pl-10 pr-16 text-lg font-semibold outline-none transition-colors"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5">/</kbd>
          </div>
          {!searchResults && (
            <div className="grid grid-cols-4 gap-1 text-[12px] font-bold">
              {([
                ['all', 'All', orders.length],
                ['print', 'To print', counts.print],
                ['printing', 'Printing', counts.printing],
                ['collect', 'Pickup', counts.collect],
              ] as const).map(([value, label, count]) => (
                <button key={value} type="button" onClick={() => setFilter(value)}
                  className={`rounded-xl py-2 transition-colors ${filter === value ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}>
                  {label} <span className="opacity-70">{count}</span>
                </button>
              ))}
            </div>
          )}
          {searchResults && <p className="text-xs text-slate-500">{searchResults.length} match{searchResults.length === 1 ? '' : 'es'} for “{query}” · <button type="button" className="font-semibold text-indigo-600" onClick={() => setQuery('')}>Clear</button></p>}
        </div>

        <ul className="flex-1 overflow-y-auto p-3 space-y-2" aria-label="Orders">
          {!loaded && <li className="p-6 text-center text-sm text-slate-400">Loading orders…</li>}
          {loaded && visible.length === 0 && (
            <li className="p-8 text-center">
              <div className="mx-auto mb-3 w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-2xl">🖨️</div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{searchResults ? 'No order found' : 'No orders right now'}</p>
              <p className="text-xs text-slate-500 mt-1">{searchResults ? 'Check the token, or search by name or phone.' : 'New QR orders appear here with a chime.'}</p>
            </li>
          )}
          {visible.map((order) => {
            const stage = stageOf(order);
            const pages = order.files.reduce((sum, file) => sum + (file.pageCount || 0) * (file.printOptions?.copies || 1), 0);
            const colour = order.files.some(needsColour);
            const active = order.id === selectedId;
            return (
              <li key={order.id}>
                <button type="button" onClick={() => setSelectedId(order.id)}
                  className={`w-full text-left rounded-2xl border p-3 transition-all animate-fadeIn ${active ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-sm' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-2xl font-black text-slate-900 dark:text-white tracking-wide">{token(order)}</span>
                    <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${STAGE_STYLE[stage].chip}`}>{STAGE_STYLE[stage].label}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-semibold text-slate-700 dark:text-slate-200">{order.customerName || 'Customer'}</span>
                    <span className="shrink-0 text-slate-400">{minutesAgo(order.createdAt)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span>{order.files.length} file{order.files.length > 1 ? 's' : ''} · {pages} pages</span>
                    {colour && <span className="rounded bg-fuchsia-100 text-fuchsia-700 px-1.5 font-bold">Colour</span>}
                    <span className="ml-auto font-bold text-slate-800 dark:text-slate-100">{formatInr(order.totalAmountPaise)}</span>
                    <span className={isPaid(order) ? 'text-emerald-600 font-bold' : order.upiClaim ? 'text-violet-600 font-bold' : 'text-amber-600 font-bold'}>{isPaid(order) ? 'Paid' : order.upiClaim ? 'UPI sent' : order.paymentMethod === 'UPI_DIRECT' ? 'UPI' : 'Due'}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="p-3 border-t border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${onlinePrinters.length ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {onlinePrinters.length ? `${onlinePrinters.length} printer${onlinePrinters.length > 1 ? 's' : ''} ready` : 'No printer connected'}
          </span>
          {onOpenPrinterSetup && <button type="button" onClick={onOpenPrinterSetup} className="font-semibold text-indigo-600">Printers</button>}
        </div>
      </section>

      {/* Selected order */}
      <section className="flex-1 min-w-0 p-4 sm:p-6 overflow-y-auto">
        {notice && (
          <div role="status" className="mb-4 rounded-2xl bg-emerald-600 text-white px-4 py-3 text-sm font-semibold shadow-sm animate-fadeIn">✓ {notice}</div>
        )}
        {!selected ? (
          <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center px-6">
            <CounterIllustration />
            <h2 className="mt-6 text-xl font-extrabold text-slate-900 dark:text-white">Ask the customer for their token</h2>
            <p className="mt-2 max-w-md text-sm text-slate-500">Type the token, name or phone number on the left and press Enter. Choose the printer, press <strong>Print</strong>, check the pages, take payment and hand over.</p>
            <div className="mt-6 grid grid-cols-3 gap-3 max-w-lg w-full text-left">
              {[['1', 'Find', 'Token or name'], ['2', 'Print', 'Pick the printer'], ['3', 'Hand over', 'Cash or UPI']].map(([n, title, hint]) => (
                <div key={n} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">{n}</span>
                  <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{title}</p>
                  <p className="text-xs text-slate-500">{hint}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <OrderPanel
            order={selected}
            printers={printers}
            chosenPrinter={chosenPrinter}
            onChoose={(fileId, printerId) => setAssignments((current) => ({ ...current, [selected.id]: { ...(current[selected.id] || {}), [fileId]: printerId } }))}
            busy={busy}
            error={error}
            upiId={upiId}
            upiQr={upiQr}
            showUpi={showUpi}
            onShowUpi={() => setShowUpi(true)}
            onPrint={printSelected}
            agentReady={agentReady}
            browserJobs={browserJobs && browserJobs.orderId === selected.id ? browserJobs : null}
            onBrowserPrint={() => void prepareBrowserPrint()}
            onPrintBrowserJob={(job) => void printBrowserJob(job, selected.id)}
            onConfirmBrowserPrinted={confirmBrowserPrinted}
            onPrintedHere={printedHere}
            onPagesOk={confirmPages}
            onCollect={collect}
            onHandOver={handOver}
            onReject={reject}
            onOpenFile={openFile}
            onReceipt={() => receipt(selected)}
            onOpenPrinterSetup={onOpenPrinterSetup}
          />
        )}
      </section>
    </div>
  );
};

interface OrderPanelProps {
  order: Order;
  printers: Printer[];
  chosenPrinter: (order: Order, file: OrderFile) => string;
  onChoose: (fileId: string, printerId: string) => void;
  busy: string | null;
  error: { message: string; issues?: string[] } | null;
  upiId: string | null;
  upiQr: string | null;
  showUpi: boolean;
  onShowUpi: () => void;
  onPrint: () => void;
  agentReady: boolean;
  browserJobs: { orderId: string; jobs: BrowserPrintJob[]; printed: string[] } | null;
  onBrowserPrint: () => void;
  onPrintBrowserJob: (job: BrowserPrintJob) => void;
  onConfirmBrowserPrinted: () => void;
  onPrintedHere: () => void;
  onPagesOk: () => void;
  onCollect: (method: 'CASH' | 'UPI') => void;
  onHandOver: () => void;
  onReject: () => void;
  onOpenFile: (file: OrderFile) => void;
  onReceipt: () => void;
  onOpenPrinterSetup?: () => void;
}

const STEPS: Array<{ key: Stage[]; label: string }> = [
  { key: ['print', 'issue', 'payment'], label: 'Print' },
  { key: ['printing'], label: 'Check pages' },
  { key: ['collect'], label: 'Payment & handover' },
  { key: ['done'], label: 'Done' },
];

const OrderPanel: React.FC<OrderPanelProps> = (props) => {
  const { order, printers, busy, error } = props;
  const stage = stageOf(order);
  const stepIndex = STEPS.findIndex((step) => step.key.includes(stage));
  const bw = printers.filter((printer) => printer.agentId && !printer.supportsColor);
  const colour = printers.filter((printer) => printer.agentId && printer.supportsColor);
  const paid = isPaid(order);
  const jobStatus = (file: OrderFile) => order.printJobs?.find((job) => job.orderFileId === file.id)?.status;

  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-fadeIn">
      <header className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 grid grid-cols-[auto_1fr] sm:flex sm:flex-wrap items-center gap-3 sm:gap-4">
        <div className="rounded-2xl bg-indigo-600 text-white px-4 sm:px-5 py-2.5 sm:py-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Token</p>
          <p className="font-mono text-3xl sm:text-4xl font-black leading-none">{token(order)}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-extrabold text-slate-900 dark:text-white truncate">{order.customerName || 'Customer'}</p>
          <p className="text-sm text-slate-500">
            {order.customerPhone ? <a className="hover:underline" href={`tel:${order.customerPhone}`}>{order.customerPhone}</a> : 'No phone'} · {minutesAgo(order.createdAt)}
          </p>
        </div>
        <div className="col-span-2 flex items-baseline justify-between gap-3 sm:block sm:text-right border-t border-slate-100 dark:border-slate-800 pt-3 sm:border-0 sm:pt-0">
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{formatInr(order.totalAmountPaise)}</p>
          <p className={`text-xs font-bold ${paid ? 'text-emerald-600' : 'text-amber-600'}`}>
            {paid ? (order.paymentMethod === 'ONLINE_RAZORPAY' ? '✓ Paid online' : '✓ Paid') : order.paymentMethod === 'ONLINE_RAZORPAY' ? 'Online payment pending' : order.paymentMethod === 'UPI_DIRECT' ? (order.upiClaim ? 'Says paid by UPI — check your app' : 'Paying by UPI') : 'Collect at counter'}
          </p>
        </div>
      </header>

      {/* Progress */}
      {stage !== 'cancelled' && (
        <ol className="grid grid-cols-4 gap-2" aria-label="Order progress">
          {STEPS.map((step, index) => (
            <li key={step.label} className={`rounded-xl px-3 py-2 text-xs font-bold text-center transition-colors ${index < stepIndex ? 'bg-emerald-100 text-emerald-700' : index === stepIndex ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-800'}`}>
              {index < stepIndex ? '✓ ' : ''}{step.label}
            </li>
          ))}
        </ol>
      )}

      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">{error.message}</p>
          {error.issues?.length ? <ul className="mt-1 list-disc pl-5 text-xs">{error.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
        </div>
      )}

      {/* Files and printer choice */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
        {order.files.map((file) => {
          const options = file.printOptions || {};
          const selectedPrinter = props.chosenPrinter(order, file);
          const canChoose = stage === 'print';
          const status = jobStatus(file);
          return (
            <div key={file.id} className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className={`w-11 h-14 shrink-0 rounded-lg border-2 flex items-end justify-center pb-1 text-[9px] font-black ${needsColour(file) ? 'border-fuchsia-300 bg-gradient-to-b from-fuchsia-50 to-amber-50 text-fuchsia-700' : 'border-slate-300 bg-slate-50 text-slate-500'}`}>
                  {String(file.mimeType || file.fileName).toLowerCase().includes('pdf') ? 'PDF' : 'IMG'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{file.fileName}</p>
                    <button type="button" onClick={() => props.onOpenFile(file)} className="shrink-0 text-xs font-semibold text-indigo-600 hover:underline">View</button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                    <span className={`rounded-md px-2 py-0.5 ${needsColour(file) ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-slate-100 text-slate-700'}`}>{colourLabel(file)}{options.colorMode === 'mixed' && options.colorPages ? ` (p. ${options.colorPages})` : ''}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">{options.pageRange && options.pageRange !== 'All' ? `Pages ${options.pageRange}` : `${file.pageCount} pages`}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">{options.duplexMode === 'duplex_auto' ? 'Both sides' : 'Single side'}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">{options.paperSize || 'A4'} · {options.orientation === 'landscape' ? 'Landscape' : 'Portrait'}</span>
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-indigo-700">× {options.copies || 1} cop{(options.copies || 1) > 1 ? 'ies' : 'y'}</span>
                  </div>
                  {options.note && <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-900">📝 {options.note}</p>}
                </div>
              </div>
              {((props.agentReady && canChoose) || selectedPrinter) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-slate-500" htmlFor={`printer-${file.id}`}>Printer</label>
                <select
                  id={`printer-${file.id}`}
                  disabled={!canChoose}
                  value={selectedPrinter}
                  onChange={(event) => props.onChoose(file.id, event.target.value)}
                  className="flex-1 min-w-[220px] min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm font-semibold disabled:opacity-60"
                >
                  {!selectedPrinter && <option value="">— Choose a printer —</option>}
                  {bw.length > 0 && (
                    <optgroup label="Black & white printers">
                      {bw.map((printer) => { const problem = printerProblem(printer, file); return <option key={printer.id} value={printer.id} disabled={Boolean(problem)}>{printer.name}{problem ? ` — ${problem}` : ''}</option>; })}
                    </optgroup>
                  )}
                  {colour.length > 0 && (
                    <optgroup label="Colour printers">
                      {colour.map((printer) => { const problem = printerProblem(printer, file); return <option key={printer.id} value={printer.id} disabled={Boolean(problem)}>{printer.name}{problem ? ` — ${problem}` : ''}</option>; })}
                    </optgroup>
                  )}
                </select>
                {status && status !== 'RECEIVED' && <span className="text-[11px] font-bold text-sky-700 bg-sky-50 rounded-md px-2 py-1">{status.replace(/_/g, ' ').toLowerCase()}</span>}
              </div>
              )}
            </div>
          );
        })}
      </section>

      {/* The one next step */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
        {stage === 'payment' && (
          <p className="text-sm text-slate-600 dark:text-slate-300">The customer chose to pay online and hasn’t finished paying. You can print once the payment shows as received, or cancel the order.</p>
        )}

        {stage === 'print' && !props.browserJobs && (
          props.agentReady ? (
            <div className="grid sm:grid-cols-[1fr_auto] gap-2">
              <button type="button" onClick={props.onPrint} disabled={Boolean(busy)} className="min-h-[60px] rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-lg font-extrabold shadow-md disabled:opacity-50 transition">
                {busy === 'print' ? 'Sending…' : '🖨️  Print'} <span className="ml-2 text-xs font-mono opacity-70">P</span>
              </button>
              <button type="button" onClick={props.onBrowserPrint} disabled={Boolean(busy)} className="min-h-[60px] px-5 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50">
                {busy === 'browser' ? 'Preparing…' : 'Print on this computer instead'}
              </button>
            </div>
          ) : (
            <>
              <button type="button" onClick={props.onBrowserPrint} disabled={Boolean(busy)} className="w-full min-h-[64px] rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-lg font-extrabold shadow-md disabled:opacity-50 transition">
                {busy === 'browser' ? 'Preparing files…' : '🖨️  Print on this computer'} <span className="ml-2 text-xs font-mono opacity-70">P</span>
              </button>
              <p className="text-xs text-slate-500">Opens your computer’s print dialog — pick your printer there. Pages and copies are already set. To send jobs straight to your printers without a dialog, {props.onOpenPrinterSetup ? <button type="button" className="font-semibold text-indigo-600 underline" onClick={props.onOpenPrinterSetup}>install the Inklly print app</button> : 'install the Inklly print app'}.</p>
            </>
          )
        )}

        {stage === 'print' && props.browserJobs && (
          <div className="space-y-3 animate-fadeIn">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">In the print dialog, choose your printer and check these settings:</p>
            {props.browserJobs.jobs.map((job, index) => {
              const done = props.browserJobs!.printed.includes(job.key);
              return (
                <div key={job.key} className={`rounded-2xl border p-3 flex flex-wrap items-center gap-3 ${done ? 'border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{props.browserJobs!.jobs.length > 1 ? `Job ${index + 1}: ` : ''}{job.files.map((f) => f.fileName).join(', ')}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-bold">
                      <span className={`rounded-md px-2 py-0.5 ${job.colour ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-slate-900 text-white'}`}>Colour: {job.colour ? 'Colour' : 'Black & white'}</span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">Two-sided: {job.duplex ? 'On (long edge)' : 'Off'}</span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">Paper: {job.paperSize}</span>
                      {job.landscape && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">Landscape</span>}
                      <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-indigo-700">{job.sheets} page{job.sheets === 1 ? '' : 's'} · copies already included</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => props.onPrintBrowserJob(job)} className={`min-h-[44px] px-5 rounded-xl font-bold text-sm ${done ? 'border border-emerald-300 text-emerald-800' : 'bg-indigo-600 text-white'}`}>
                    {done ? 'Print again' : 'Open print dialog'}
                  </button>
                </div>
              );
            })}
            <div className="grid sm:grid-cols-[1fr_auto] gap-2 pt-1">
              <button type="button" onClick={props.onConfirmBrowserPrinted} disabled={Boolean(busy) || props.browserJobs.printed.length === 0} className="min-h-[56px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold disabled:opacity-40">
                {busy === 'manual' ? 'Saving…' : '✓ All pages printed correctly'}
              </button>
              <p className="self-center text-xs text-slate-500 sm:max-w-[200px]">Check the pages first. Then take payment and hand over.</p>
            </div>
          </div>
        )}

        {stage === 'printing' && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">Sent to the printer. Pick up the pages and check them, then confirm.</p>
            <button type="button" onClick={props.onPagesOk} disabled={Boolean(busy)} className="w-full min-h-[60px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-extrabold shadow-md disabled:opacity-50">
              {busy === 'pages' ? 'Saving…' : '✓ Pages are OK'} <span className="ml-2 text-xs font-mono opacity-70">K</span>
            </button>
          </>
        )}

        {stage === 'issue' && (
          <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">The printer did not confirm this job. Check the printer and the pages. If the pages printed correctly use “Printed from this computer”; otherwise cancel and ask the customer to order again.</p>
        )}

        {stage === 'collect' && (
          paid ? (
            <button type="button" onClick={props.onHandOver} disabled={Boolean(busy)} className="w-full min-h-[60px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-extrabold shadow-md disabled:opacity-50">
              {busy === 'handover' ? 'Saving…' : '✓ Hand over (already paid)'} <span className="ml-2 text-xs font-mono opacity-70">H</span>
            </button>
          ) : (
            <>
              {order.paymentMethod === 'UPI_DIRECT' && (
                <div className="rounded-2xl border border-violet-200 bg-violet-50 dark:bg-violet-950/40 dark:border-violet-800 p-3 text-sm text-violet-900 dark:text-violet-100">
                  {order.upiClaim ? (
                    <>
                      <p className="font-extrabold">📱 Customer says they paid {formatInr(order.totalAmountPaise)} by UPI{order.upiClaim.payerApp ? ` (${order.upiClaim.payerApp === 'gpay' ? 'Google Pay' : order.upiClaim.payerApp === 'phonepe' ? 'PhonePe' : order.upiClaim.payerApp})` : ''}</p>
                      {order.upiClaim.upiReference && <p className="mt-0.5">UTR <span className="font-mono font-bold">{order.upiClaim.upiReference}</span></p>}
                      <p className="mt-1 text-xs opacity-80">Check the credit in your UPI app or SMS, then press <b>UPI received</b>.</p>
                    </>
                  ) : (
                    <p>Customer chose UPI. If they haven’t paid yet, show your UPI QR below.</p>
                  )}
                </div>
              )}
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Collect <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{formatInr(order.totalAmountPaise)}</span> and hand over</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => props.onCollect('CASH')} disabled={Boolean(busy)} className="min-h-[60px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-extrabold shadow-md disabled:opacity-50">
                  {busy === 'CASH' ? 'Saving…' : '💵 Cash received'} <span className="ml-1 text-xs font-mono opacity-70">C</span>
                </button>
                <button type="button" onClick={props.showUpi || order.upiClaim ? () => props.onCollect('UPI') : props.onShowUpi} disabled={Boolean(busy)} className="min-h-[60px] rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-lg font-extrabold shadow-md disabled:opacity-50">
                  {busy === 'UPI' ? 'Saving…' : props.showUpi || order.upiClaim ? '✓ UPI received' : '📱 UPI'} <span className="ml-1 text-xs font-mono opacity-70">U</span>
                </button>
              </div>
              {props.showUpi && (
                props.upiId ? (
                  <div className="flex items-center gap-4 rounded-2xl bg-slate-50 dark:bg-slate-800 p-3 animate-fadeIn">
                    {props.upiQr && <img src={props.upiQr} alt={`UPI QR for ${formatInr(order.totalAmountPaise)}`} className="w-36 h-36 rounded-xl bg-white p-1" />}
                    <p className="text-sm text-slate-600 dark:text-slate-300">Customer scans and pays <strong>{formatInr(order.totalAmountPaise)}</strong> to <strong>{props.upiId}</strong>. Check your UPI app, then press <strong>UPI received</strong>.</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Show your shop’s UPI QR to the customer. Add your UPI ID in Quick sale → Counter settings to show a QR with the exact amount here.</p>
                )
              )}
            </>
          )
        )}

        {stage === 'done' && (
          <p className="text-center text-lg font-extrabold text-emerald-700">✓ Completed — {formatInr(order.totalAmountPaise)} {order.paymentMethod === 'ONLINE_RAZORPAY' ? 'paid online' : 'paid at counter'}</p>
        )}
        {stage === 'cancelled' && <p className="text-center text-sm font-semibold text-slate-500">This order was cancelled.</p>}

        <div className="flex flex-wrap items-center gap-3 pt-1 text-sm">
          <button type="button" onClick={props.onReceipt} className="font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900">🧾 Receipt</button>
          {['print', 'payment', 'issue'].includes(stage) && (
            <button type="button" onClick={props.onReject} disabled={Boolean(busy)} className="font-semibold text-red-600 hover:text-red-700 ml-auto">Cancel order</button>
          )}
        </div>
      </section>
      <p className="text-center text-[11px] text-slate-400">Keys: <kbd>/</kbd> search · <kbd>↑</kbd><kbd>↓</kbd> move · <kbd>P</kbd> print · <kbd>K</kbd> pages OK · <kbd>C</kbd> cash · <kbd>U</kbd> UPI · <kbd>H</kbd> hand over · <kbd>Esc</kbd> back</p>
    </div>
  );
};

/** A small illustration of the counter: phone → printer → paper. */
const CounterIllustration: React.FC = () => (
  <svg width="260" height="150" viewBox="0 0 260 150" role="img" aria-label="A phone sending a document to a printer" className="drop-shadow-sm">
    <defs>
      <linearGradient id="ink-g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#6366F1" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient>
    </defs>
    <rect x="18" y="22" width="56" height="100" rx="12" fill="#0F172A" />
    <rect x="24" y="32" width="44" height="78" rx="6" fill="#EEF2FF" />
    <rect x="31" y="42" width="30" height="6" rx="3" fill="#6366F1" />
    <rect x="31" y="54" width="22" height="5" rx="2.5" fill="#A5B4FC" />
    <text x="46" y="94" textAnchor="middle" fontFamily="ui-monospace,monospace" fontWeight="800" fontSize="15" fill="#4F46E5">#4821</text>
    <path d="M84 72 C110 52 132 52 150 66" stroke="#A5B4FC" strokeWidth="3" strokeDasharray="5 6" fill="none">
      <animate attributeName="stroke-dashoffset" from="22" to="0" dur="1.2s" repeatCount="indefinite" />
    </path>
    <rect x="150" y="54" width="92" height="52" rx="12" fill="url(#ink-g)" />
    <rect x="164" y="40" width="64" height="20" rx="4" fill="#E0E7FF" />
    <rect x="170" y="96" width="52" height="40" rx="3" fill="#FFFFFF" stroke="#E2E8F0">
      <animate attributeName="y" values="88;100;100" dur="2.4s" repeatCount="indefinite" />
    </rect>
    <circle cx="228" cy="70" r="4" fill="#34D399" />
  </svg>
);
