import React, { useCallback, useEffect, useState } from 'react';
import { platformAdminApi, PlatformOverview } from '../../api/platform-admin';
import { BellIcon, CheckCircleIcon, FileTextIcon, IndianRupeeIcon, MonitorIcon, PrinterIcon, StoreIcon, TrendingUpIcon } from '../../components/icons';
import {
  Badge, Card, CardHeader, EmptyState, ErrorNotice, PAYMENT_METHOD_LABELS, PageHeader, Skeleton, StatCard,
  errorMessage, formatCount, formatPaise, formatRelative, humanize, orderStatusTone, cx,
} from '../../components/console-ui';
import { ConsoleContext, ConsoleTab } from './context';

const LIVE_REFRESH_MS = 30_000;

export const OverviewSection: React.FC<{ ctx: ConsoleContext }> = ({ ctx }) => {
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await platformAdminApi.overview());
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load the overview.'));
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, LIVE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load, ctx.refreshKey]);

  const m = data?.metrics;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Live numbers across every shop. Updates every 30 seconds."
        actions={data && <span className="flex items-center gap-2 text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary"><span className="h-2 w-2 animate-pulse rounded-full bg-status-success" aria-hidden />Updated {formatRelative(data.health.timestamp)}</span>}
      />
      {error && <ErrorNotice message={error} onRetry={() => void load()} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {!m ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-[112px] rounded-2xl" />) : (
          <>
            <StatCard label="Active shops" value={formatCount(m.activeShops)} hint={`${formatCount(m.shops)} total · ${formatCount(m.shopsOnMap)} on map`} icon={<StoreIcon size={16} />} tone="brand" onClick={() => ctx.goTo('shops')} />
            <StatCard label="Orders today" value={formatCount(m.ordersToday)} hint={`${formatCount(m.openOrders)} open now`} icon={<FileTextIcon size={16} />} tone="info" onClick={() => ctx.goTo('orders')} />
            <StatCard label="Orders · 7 days" value={formatCount(m.orders7d)} hint={`${formatCount(m.customers7d)} customers`} icon={<TrendingUpIcon size={16} />} tone="info" onClick={() => ctx.goTo('orders')} />
            <StatCard label="GMV · 7 days" value={formatPaise(m.gmv7dPaise)} hint={`Today ${formatPaise(m.gmvTodayPaise)}`} icon={<IndianRupeeIcon size={16} />} tone="success" onClick={ctx.can('finance:view') ? () => ctx.goTo('payments') : undefined} />
            <StatCard label="Printers online" value={`${formatCount(m.printersOnline)}`} hint={`of ${formatCount(m.printersTotal)} printers`} icon={<PrinterIcon size={16} />} tone={m.printersOnline > 0 ? 'success' : 'warning'} onClick={() => ctx.goTo('agents')} />
            <StatCard label="Agents online" value={`${formatCount(m.agentsOnline)}`} hint={`of ${formatCount(m.agentsRegistered)} paired`} icon={<MonitorIcon size={16} />} tone={m.agentsOnline < m.agentsRegistered ? 'warning' : 'success'} onClick={() => ctx.goTo('agents')} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Needs attention" subtitle="Generated from live data" />
          {!data ? <div className="space-y-2 p-4"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
            : data.alerts.length === 0 ? <EmptyState icon={<CheckCircleIcon size={22} />} title="All clear" description="No failed prints, offline agents or overdue payments right now." />
              : (
                <ul className="divide-y divide-ink-border dark:divide-ink-dark-border">
                  {data.alerts.map((alert) => (
                    <li key={alert.id}>
                      <button
                        type="button"
                        disabled={!alert.target}
                        onClick={() => alert.target && ctx.goTo(alert.target.tab as ConsoleTab, alert.target.filter)}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-ink-surface-subtle disabled:cursor-default sm:px-5 dark:hover:bg-ink-dark-hover"
                      >
                        <span className={cx('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                          alert.level === 'critical' ? 'bg-status-danger-bg text-status-danger dark:bg-status-dark-danger-bg dark:text-status-dark-danger'
                            : alert.level === 'warning' ? 'bg-status-warning-bg text-status-warning dark:bg-status-dark-warning-bg dark:text-status-dark-warning'
                              : 'bg-status-info-bg text-status-info dark:bg-status-dark-info-bg dark:text-status-dark-info')}
                        ><BellIcon size={14} /></span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-ink-text dark:text-ink-dark-text">{alert.title}</span>
                          <span className="block text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{alert.detail}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Recent orders" subtitle="Newest first, all shops" actions={<button type="button" onClick={() => ctx.goTo('orders')} className="text-xs font-semibold text-brand hover:underline dark:text-brand-dark">View all</button>} />
          {!data ? <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12" />)}</div>
            : data.recentOrders.length === 0 ? <EmptyState icon={<FileTextIcon size={22} />} title="No orders yet" description="Orders will appear here as soon as a customer places one at any shop." />
              : (
                <ul className="divide-y divide-ink-border dark:divide-ink-dark-border">
                  {data.recentOrders.map((order) => (
                    <li key={order.id}>
                      <button type="button" onClick={() => ctx.openOrder(order.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-surface-subtle sm:px-5 dark:hover:bg-ink-dark-hover">
                        <span className="flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-ink-surface-muted text-ink-text dark:bg-ink-dark-elevated dark:text-ink-dark-text">
                          <span className="text-[9px] font-semibold uppercase text-ink-text-muted">Token</span>
                          <span className="text-sm font-bold tabular-nums">{order.tokenNumber || '—'}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink-text dark:text-ink-dark-text">{order.customerName || 'Customer'} · {order.shopName}</span>
                          <span className="block truncate text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{PAYMENT_METHOD_LABELS[order.paymentMethod] || humanize(order.paymentMethod)} · {formatRelative(order.createdAt)}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-sm font-bold tabular-nums text-ink-text dark:text-ink-dark-text">{formatPaise(order.totalAmountPaise)}</span>
                          <Badge tone={orderStatusTone(order.status)}>{humanize(order.status)}</Badge>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
        </Card>
      </div>

      {data && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-text-muted dark:text-ink-dark-text-muted">
          <span>API {data.health.apiStatus === 'HEALTHY' ? 'healthy' : humanize(data.health.apiStatus)}</span>
          <span>Database {data.health.databaseEngine}</span>
          <span>{formatCount(m?.totalOrganizations)} organisations · {formatCount(m?.totalOrdersProcessed)} orders all time · {formatPaise(m?.gmvAllTimePaise)} GMV all time</span>
        </div>
      )}
    </div>
  );
};
