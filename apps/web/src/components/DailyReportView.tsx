import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

interface DailyReport {
  date: string;
  orders: { received: number; completed: number; cancelled: number; open: number };
  revenue: { totalPaise: number; cashPaise: number; onlinePaise: number; refundsPaise: number };
  pages: { bw: number; color: number; total: number };
  averageTurnaroundMinutes: number | null;
  averageOrderPaise: number | null;
  hourly: Array<{ hour: number; orders: number }>;
  lastSevenDays: Array<{ date: string; orders: number; revenuePaise: number }>;
  topCustomers: Array<{ name: string; phone: string | null; orders: number; spentPaise: number }>;
}

const inr = (paise: number | null | undefined) =>
  typeof paise === 'number' ? `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}` : '—';

const localToday = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const shiftDate = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

const hourLabel = (hour: number) => `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`;

/** End-of-day numbers a shop owner checks before closing: money, pages, busy hours. */
export const DailyReportView: React.FC = () => {
  const [date, setDate] = useState(localToday());
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.getDailyReport(date)
      .then((data) => { if (active) setReport(data); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Could not load the report.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date]);

  const busiest = useMemo(() => {
    if (!report) return null;
    const top = [...report.hourly].sort((a, b) => b.orders - a.orders)[0];
    return top && top.orders > 0 ? top : null;
  }, [report]);

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ['Inklly daily report', report.date],
      [],
      ['Orders received', report.orders.received],
      ['Orders completed', report.orders.completed],
      ['Orders cancelled', report.orders.cancelled],
      ['Orders still open', report.orders.open],
      ['Cash collected (INR)', (report.revenue.cashPaise / 100).toFixed(2)],
      ['Online payments (INR)', (report.revenue.onlinePaise / 100).toFixed(2)],
      ['Refunds (INR)', (report.revenue.refundsPaise / 100).toFixed(2)],
      ['Net takings (INR)', (report.revenue.totalPaise / 100).toFixed(2)],
      ['Black & white pages', report.pages.bw],
      ['Colour pages', report.pages.color],
      ['Average order (INR)', report.averageOrderPaise === null ? '' : (report.averageOrderPaise / 100).toFixed(2)],
      ['Average time to pickup (min)', report.averageTurnaroundMinutes ?? ''],
      [],
      ['Hour', 'Orders'],
      ...report.hourly.map((h) => [hourLabel(h.hour), h.orders]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `inklly-report-${report.date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const maxHour = Math.max(1, ...(report?.hourly.map((h) => h.orders) || [1]));
  const maxDay = Math.max(1, ...(report?.lastSevenDays.map((d) => d.revenuePaise) || [1]));
  const isToday = date === localToday();

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Reports</p>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{isToday ? 'Today' : new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setDate(shiftDate(date, -1))} className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold" aria-label="Previous day">‹</button>
          <input type="date" value={date} max={localToday()} onChange={(e) => e.target.value && setDate(e.target.value)} className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
          <button type="button" disabled={isToday} onClick={() => setDate(shiftDate(date, 1))} className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold disabled:opacity-40" aria-label="Next day">›</button>
          <button type="button" disabled={!report} onClick={exportCsv} className="min-h-[40px] px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold disabled:opacity-40">Download CSV</button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {loading && !report && <p className="text-sm text-slate-500">Loading report…</p>}

      {report && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Net takings', value: inr(report.revenue.totalPaise), note: `${inr(report.revenue.cashPaise)} cash · ${inr(report.revenue.onlinePaise)} online` },
              { label: 'Orders', value: String(report.orders.received), note: `${report.orders.completed} done · ${report.orders.open} open` },
              { label: 'Pages printed', value: report.pages.total.toLocaleString('en-IN'), note: `${report.pages.bw} B&W · ${report.pages.color} colour` },
              { label: 'Avg. pickup time', value: report.averageTurnaroundMinutes === null ? '—' : `${report.averageTurnaroundMinutes} min`, note: `Avg. order ${inr(report.averageOrderPaise)}` },
            ].map((tile) => (
              <div key={tile.label} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4">
                <p className="text-xs font-semibold text-slate-500">{tile.label}</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">{tile.value}</p>
                <p className="mt-1 text-[11px] text-slate-500">{tile.note}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Orders by hour</h2>
                <span className="text-[11px] text-slate-500">{busiest ? `Busiest: ${hourLabel(busiest.hour)}` : 'No orders yet'}</span>
              </div>
              <div className="flex items-end gap-[3px] h-32" role="img" aria-label="Orders per hour">
                {report.hourly.slice(7, 23).map((h) => (
                  <div key={h.hour} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                    <div className="w-full rounded-t-md bg-indigo-500/85" style={{ height: `${(h.orders / maxHour) * 100}%`, minHeight: h.orders ? 4 : 1 }} title={`${hourLabel(h.hour)}: ${h.orders}`} />
                    <span className="text-[9px] text-slate-400">{h.hour % 3 === 0 ? hourLabel(h.hour) : ''}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Last 7 days</h2>
              <div className="space-y-2">
                {report.lastSevenDays.map((day) => (
                  <button key={day.date} type="button" onClick={() => setDate(day.date)} className="w-full flex items-center gap-3 text-left">
                    <span className={`w-14 text-[11px] ${day.date === date ? 'font-bold text-indigo-600' : 'text-slate-500'}`}>{new Date(`${day.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}</span>
                    <span className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${(day.revenuePaise / maxDay) * 100}%` }} />
                    </span>
                    <span className="w-24 text-right text-xs font-semibold text-slate-800 dark:text-slate-200">{inr(day.revenuePaise)} · {day.orders}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Top customers</h2>
            {report.topCustomers.length === 0 ? (
              <p className="text-sm text-slate-500">No orders on this day.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.topCustomers.map((customer) => (
                  <li key={`${customer.name}-${customer.phone}`} className="flex items-center justify-between py-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-semibold text-slate-900 dark:text-white">{customer.name}</span>
                      {customer.phone && <span className="ml-2 text-xs text-slate-500">{customer.phone}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-slate-600 dark:text-slate-300">{customer.orders} order{customer.orders > 1 ? 's' : ''} · <strong>{inr(customer.spentPaise)}</strong></span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};
