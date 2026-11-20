import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import {
  FileTextIcon, IndianRupeeIcon, LifebuoyIcon, MonitorIcon, RotateCwIcon, ShieldIcon, SlidersIcon, StoreIcon, TrendingUpIcon, UserIcon, UsersIcon,
} from '../components/icons';
import { Button, ErrorNotice, Toast, cx, errorMessage, useToast } from '../components/console-ui';
import { ConsoleContext, ConsoleTab } from './platform/context';
import { OverviewSection } from './platform/OverviewSection';
import { ShopsSection } from './platform/ShopsSection';
import { ShopDrawer } from './platform/ShopDrawer';
import { OrdersSection } from './platform/OrdersSection';
import { OrderDrawer } from './platform/OrderDrawer';
import { CustomersSection } from './platform/CustomersSection';
import { PaymentsSection } from './platform/PaymentsSection';
import { AgentsSection } from './platform/AgentsSection';
import { SupportSection } from './platform/SupportSection';
import { SettingsSection } from './platform/SettingsSection';
import { AuditSection } from './platform/AuditSection';
import { TeamSection } from './platform/TeamSection';

/**
 * Platform owner control centre (/platform, /admin).
 *
 * The shell handles access, navigation and the shop/order drawers; each
 * section lives in views/platform/* and loads its own data. Every write goes
 * through an audited server endpoint.
 */

export interface PlatformAdminProps {
  onNavigate?: (path: string) => void;
}

interface NavItem { id: ConsoleTab; label: string; icon: React.ReactNode; group: 'Operate' | 'Money' | 'Platform'; visible: boolean }

const TAB_STORAGE_KEY = 'inklly_platform_tab';

function readStoredTab(): ConsoleTab | null {
  try { return (sessionStorage.getItem(TAB_STORAGE_KEY) as ConsoleTab | null) || null; } catch { return null; }
}

export const PlatformAdminView: React.FC<PlatformAdminProps> = () => {
  const [isOwner] = useState(() => {
    try { return JSON.parse(localStorage.getItem('inklly_user') || 'null')?.role === 'PLATFORM_OWNER'; } catch { return false; }
  });
  const [permissions, setPermissions] = useState<string[]>(() => (isOwner ? ['*'] : []));
  const [accessReady, setAccessReady] = useState(isOwner);
  const [accessError, setAccessError] = useState('');
  const [tab, setTab] = useState<ConsoleTab>(() => readStoredTab() || 'overview');
  const [tabFilter, setTabFilter] = useState<Record<string, string> | undefined>(undefined);
  const [shopId, setShopId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);
  const { toast, show } = useToast();

  // Platform admins: load their current grants from the server (owners hold all).
  useEffect(() => {
    if (isOwner) return;
    let cancelled = false;
    api.getMe()
      .then((session: any) => { if (!cancelled) setPermissions(Array.isArray(session.permissions) ? session.permissions : []); })
      .catch((error: unknown) => { if (!cancelled) setAccessError(errorMessage(error, 'Could not check your platform access.')); })
      .finally(() => { if (!cancelled) setAccessReady(true); });
    return () => { cancelled = true; };
  }, [isOwner]);

  const can = useCallback((permission: string) => isOwner || permissions.includes('*') || permissions.includes(permission), [isOwner, permissions]);

  const nav: NavItem[] = useMemo(() => [
    { id: 'overview', label: 'Overview', icon: <TrendingUpIcon size={18} />, group: 'Operate', visible: can('platform:view') },
    { id: 'shops', label: 'Shops', icon: <StoreIcon size={18} />, group: 'Operate', visible: can('platform:view') },
    { id: 'orders', label: 'Orders', icon: <FileTextIcon size={18} />, group: 'Operate', visible: can('platform:view') },
    { id: 'customers', label: 'Customers', icon: <UserIcon size={18} />, group: 'Operate', visible: can('platform:view') },
    { id: 'agents', label: 'Printers & agents', icon: <MonitorIcon size={18} />, group: 'Operate', visible: can('platform:view') },
    { id: 'support', label: 'Support', icon: <LifebuoyIcon size={18} />, group: 'Operate', visible: can('support:view') || can('support:manage') },
    { id: 'payments', label: 'Payments', icon: <IndianRupeeIcon size={18} />, group: 'Money', visible: can('finance:view') || can('billing:view') },
    { id: 'settings', label: 'Settings', icon: <SlidersIcon size={18} />, group: 'Platform', visible: can('platform:view') },
    { id: 'audit', label: 'Audit log', icon: <ShieldIcon size={18} />, group: 'Platform', visible: can('security:audit') },
    { id: 'team', label: 'Team', icon: <UsersIcon size={18} />, group: 'Platform', visible: isOwner },
  ], [can, isOwner]);
  const visibleNav = nav.filter((item) => item.visible);

  // Keep the selected tab valid for this account.
  useEffect(() => {
    if (!accessReady || !visibleNav.length) return;
    if (!visibleNav.some((item) => item.id === tab)) setTab(visibleNav[0].id);
  }, [accessReady, visibleNav, tab]);

  useEffect(() => {
    try { sessionStorage.setItem(TAB_STORAGE_KEY, tab); } catch { /* ignore */ }
  }, [tab]);

  const goTo = useCallback((next: ConsoleTab, filter?: Record<string, string>) => {
    setTabFilter(filter ? { ...filter } : undefined);
    setTab(next);
    setShopId(null);
    setOrderId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const ctx: ConsoleContext = useMemo(() => ({
    can, isOwner, notify: show, goTo,
    openShop: (id: string) => setShopId(id),
    openOrder: (id: string) => setOrderId(id),
    refreshKey,
  }), [can, isOwner, show, goTo, refreshKey]);

  const onDataChanged = useCallback(() => setDataVersion((value) => value + 1), []);
  const selectTab = (next: ConsoleTab) => { setTabFilter(undefined); setTab(next); };

  if (!accessReady) {
    return <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-ink-text-secondary">Checking your access…</div>;
  }

  return (
    <div className="min-h-full bg-ink-app dark:bg-ink-dark-app">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:grid lg:grid-cols-[14.5rem_minmax(0,1fr)] lg:gap-8 lg:py-8">
        {/* Navigation: sidebar on desktop, scrollable pills on phones */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-4 hidden items-center gap-3 lg:flex">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white"><ShieldIcon size={20} /></span>
            <div>
              <p className="text-sm font-extrabold text-ink-text dark:text-ink-dark-text">Inklly Control</p>
              <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{isOwner ? 'Platform owner' : 'Platform admin'}</p>
            </div>
          </div>
          <nav aria-label="Control centre sections" className="-mx-4 mb-5 overflow-x-auto px-4 lg:mx-0 lg:mb-0 lg:overflow-visible lg:px-0">
            <ul className="flex gap-1.5 lg:flex-col lg:gap-0.5">
              {(['Operate', 'Money', 'Platform'] as const).map((group) => {
                const items = visibleNav.filter((item) => item.group === group);
                if (!items.length) return null;
                return (
                  <React.Fragment key={group}>
                    <li className="hidden px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-text-muted first:pt-0 lg:block dark:text-ink-dark-text-muted">{group}</li>
                    {items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-current={tab === item.id ? 'page' : undefined}
                          onClick={() => selectTab(item.id)}
                          className={cx(
                            'flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition',
                            tab === item.id
                              ? 'bg-brand text-white shadow-sm lg:bg-white lg:text-brand lg:shadow-sm lg:ring-1 lg:ring-ink-border dark:lg:bg-ink-dark-surface dark:lg:text-brand-dark dark:lg:ring-ink-dark-border'
                              : 'bg-white text-ink-text-secondary ring-1 ring-ink-border hover:text-ink-text lg:bg-transparent lg:ring-0 lg:hover:bg-white dark:bg-ink-dark-surface dark:text-ink-dark-text-secondary dark:ring-ink-dark-border dark:hover:text-ink-dark-text lg:dark:bg-transparent lg:dark:hover:bg-ink-dark-surface',
                          )}
                        >
                          <span className="shrink-0" aria-hidden>{item.icon}</span>{item.label}
                        </button>
                      </li>
                    ))}
                  </React.Fragment>
                );
              })}
            </ul>
          </nav>
          <div className="mt-6 hidden lg:block">
            <Button size="sm" variant="ghost" onClick={() => setRefreshKey((value) => value + 1)}><RotateCwIcon size={14} />Refresh data</Button>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mb-4 flex justify-end lg:hidden">
            <Button size="sm" variant="ghost" onClick={() => setRefreshKey((value) => value + 1)}><RotateCwIcon size={14} />Refresh</Button>
          </div>
          {accessError && <div className="mb-4"><ErrorNotice message={accessError} /></div>}
          {visibleNav.length === 0 ? (
            <section role="status" className="rounded-2xl border border-status-warning/30 bg-status-warning-bg p-6 text-sm text-status-warning dark:bg-status-dark-warning-bg dark:text-status-dark-warning">
              Your platform account has no permissions yet. Ask the platform owner to give you access from the Team page.
            </section>
          ) : (
            <>
              {tab === 'overview' && <OverviewSection ctx={ctx} />}
              {tab === 'shops' && <ShopsSection ctx={ctx} reloadKey={dataVersion} />}
              {tab === 'orders' && <OrdersSection ctx={ctx} initialFilter={tabFilter} reloadKey={dataVersion} />}
              {tab === 'customers' && <CustomersSection ctx={ctx} />}
              {tab === 'agents' && <AgentsSection ctx={ctx} />}
              {tab === 'support' && <SupportSection ctx={ctx} />}
              {tab === 'payments' && <PaymentsSection ctx={ctx} />}
              {tab === 'settings' && <SettingsSection ctx={ctx} />}
              {tab === 'audit' && <AuditSection ctx={ctx} />}
              {tab === 'team' && isOwner && <TeamSection ctx={ctx} />}
            </>
          )}
        </main>
      </div>

      {can('platform:view') && (
        <>
          <ShopDrawer shopId={shopId} ctx={ctx} onClose={() => setShopId(null)} onChanged={onDataChanged} />
          <OrderDrawer orderId={orderId} ctx={ctx} onClose={() => setOrderId(null)} onChanged={onDataChanged} />
        </>
      )}
      <Toast message={toast?.message || null} tone={toast?.tone} />
    </div>
  );
};
