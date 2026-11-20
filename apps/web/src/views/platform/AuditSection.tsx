import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { DownloadIcon, ShieldIcon } from '../../components/icons';
import {
  Badge, Button, Card, EmptyState, ErrorNotice, LoadingRows, PageHeader, SearchInput, Tabs,
  downloadCsv, errorMessage, humanize, Tone,
} from '../../components/console-ui';
import { ConsoleContext } from './context';

type Category = 'all' | 'shops' | 'orders' | 'settings' | 'team' | 'billing' | 'other';

/** Plain-language sentence for each audited action. Unknown actions fall back to a humanised code. */
const ACTIONS: Record<string, { text: string; category: Category; tone?: Tone }> = {
  PLATFORM_SHOP_UPDATED: { text: 'edited shop details', category: 'shops' },
  PLATFORM_SHOP_ACTIVATED: { text: 'activated a shop', category: 'shops', tone: 'success' },
  PLATFORM_SHOP_DEACTIVATED: { text: 'deactivated a shop', category: 'shops', tone: 'danger' },
  PLATFORM_SHOP_AGENT_PAIRING_RESET: { text: 'reset a shop’s print agent pairing', category: 'shops', tone: 'warning' },
  PLATFORM_MERCHANT_ONBOARDED: { text: 'added a new shop', category: 'shops', tone: 'success' },
  PLATFORM_MERCHANT_STATUS_UPDATED: { text: 'changed an organisation’s plan', category: 'shops' },
  PLATFORM_ORDER_CANCELLED: { text: 'cancelled an order', category: 'orders', tone: 'danger' },
  PLATFORM_ORDER_MARKED_PAID: { text: 'marked an order paid', category: 'orders', tone: 'success' },
  PLATFORM_SETTINGS_UPDATED: { text: 'changed platform settings', category: 'settings' },
  RUN_PRINT_FILE_RETENTION_PURGE: { text: 'ran the file clean-up', category: 'settings' },
  PLATFORM_ADMIN_PERMISSIONS_UPDATED: { text: 'changed a team member’s permissions', category: 'team', tone: 'warning' },
  VIEW_PUBLIC_ENQUIRIES: { text: 'opened website enquiries', category: 'other' },
  PLATFORM_INCIDENT_CREATED: { text: 'opened an incident', category: 'other' },
  PLATFORM_INCIDENT_UPDATED: { text: 'updated an incident', category: 'other' },
  PILOT_BILLING_TARIFF_CREATED: { text: 'added a billing rate', category: 'billing' },
  PILOT_BILLING_INVOICE_ISSUED: { text: 'issued an invoice', category: 'billing' },
};

function categoryOf(event: any): Category {
  if (ACTIONS[event.action]) return ACTIONS[event.action].category;
  if (/ORDER|PAYMENT|CASH/.test(event.action)) return 'orders';
  if (/BILLING|SUBSCRIPTION|INVOICE/.test(event.action)) return 'billing';
  if (/SHOP|MERCHANT|PRINTER|AGENT/.test(event.action)) return 'shops';
  return 'other';
}

function describeChanges(details: any): string[] {
  if (!details || typeof details !== 'object') return [];
  const lines: string[] = [];
  if (details.changes && typeof details.changes === 'object') {
    for (const [field, change] of Object.entries<any>(details.changes)) lines.push(`${humanize(field)}: ${String(change?.from ?? '—') || '—'} → ${String(change?.to ?? '—') || '—'}`);
  }
  if (Array.isArray(details.changed) && details.next) {
    for (const key of details.changed) lines.push(`${humanize(key)} updated`);
  }
  if (details.previous?.planTier && details.next?.planTier) lines.push(`Plan ${humanize(details.previous.planTier)} · ${humanize(details.previous.planStatus)} → ${humanize(details.next.planTier)} · ${humanize(details.next.planStatus)}`);
  if (Array.isArray(details.previousPermissions) && Array.isArray(details.nextPermissions)) lines.push(`Permissions: ${details.nextPermissions.join(', ') || 'none'}`);
  if (details.orderNumber) lines.push(`Order ${details.orderNumber}`);
  if (details.amountPaise !== undefined && Number.isFinite(Number(details.amountPaise))) lines.push(`Amount ₹${(Number(details.amountPaise) / 100).toFixed(2)}`);
  return lines;
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export const AuditSection: React.FC<{ ctx: ConsoleContext }> = ({ ctx }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getAuditLogs()
      .then((page: any) => { if (!cancelled) { setEvents(Array.isArray(page.events) ? page.events : []); setCursor(typeof page.nextCursor === 'string' ? page.nextCursor : null); setError(''); } })
      .catch((err: unknown) => { if (!cancelled) setError(errorMessage(err, 'Could not load the audit log.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ctx.refreshKey]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await api.getAuditLogs(cursor);
      setEvents((current) => {
        const seen = new Set(current.map((event) => event.id));
        return [...current, ...(page.events || []).filter((event: any) => !seen.has(event.id))];
      });
      setCursor(typeof page.nextCursor === 'string' ? page.nextCursor : null);
    } catch (err) {
      ctx.notify(errorMessage(err, 'Could not load older events.'), 'error');
    } finally { setLoadingMore(false); }
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const all: any[] = [];
      let next: string | undefined;
      do {
        const page = await api.getAuditLogs(next);
        all.push(...(page.events || []));
        next = typeof page.nextCursor === 'string' ? page.nextCursor : undefined;
      } while (next);
      downloadCsv(`inklly-audit-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Event ID', 'When', 'Actor', 'Actor email', 'Actor role', 'Action', 'Target type', 'Target ID', 'Shop', 'Outcome', 'Note', 'IP address'],
        all.map((event) => [event.id, event.createdAt, event.actorName, event.actorEmail, event.actorRole, event.action, event.targetType, event.targetId, event.shopName, event.outcome, event.details?.note || event.details?.reason || '', event.ipAddress]));
      ctx.notify(`Exported ${all.length} audit events.`);
    } catch (err) {
      ctx.notify(errorMessage(err, 'Could not export the audit log.'), 'error');
    } finally { setExporting(false); }
  };

  const term = search.trim().toLowerCase();
  const visible = useMemo(() => events.filter((event) => (category === 'all' || categoryOf(event) === category)
    && (!term || [event.action, event.actorName, event.actorEmail, event.shopName, event.targetId, event.details?.note, event.details?.reason, event.details?.orderNumber]
      .some((value) => String(value || '').toLowerCase().includes(term)))), [events, category, term]);

  const groups = useMemo(() => {
    const result: Array<{ day: string; items: any[] }> = [];
    for (const event of visible) {
      const day = dayLabel(event.createdAt);
      const last = result[result.length - 1];
      if (last && last.day === day) last.items.push(event); else result.push({ day, items: [event] });
    }
    return result;
  }, [visible]);

  return (
    <div className="space-y-5">
      <PageHeader title="Audit log" description="Who changed what, newest first. Entries cannot be edited or deleted." actions={<Button size="sm" onClick={() => void exportAll()} busy={exporting}><DownloadIcon size={14} />Export CSV</Button>} />
      <Card>
        <div className="flex flex-col gap-2 border-b border-ink-border p-4 lg:flex-row lg:items-center lg:justify-between dark:border-ink-dark-border">
          <Tabs label="Audit category" value={category} onChange={(value) => setCategory(value as Category)} items={[
            { id: 'all', label: 'All' }, { id: 'shops', label: 'Shops' }, { id: 'orders', label: 'Orders' }, { id: 'settings', label: 'Settings' },
            { id: 'team', label: 'Team' }, { id: 'billing', label: 'Billing' }, { id: 'other', label: 'Other' },
          ]} />
          <SearchInput className="lg:w-72" value={search} onChange={setSearch} placeholder="Search person, shop, note or order" />
        </div>
        {error && <div className="p-4"><ErrorNotice message={error} /></div>}
        {loading ? <LoadingRows /> : visible.length === 0 ? (
          <EmptyState icon={<ShieldIcon size={22} />} title={events.length ? 'Nothing matches' : 'No audit events yet'} description={events.length ? (cursor ? 'Load older events or change the filter.' : 'Try another filter.') : 'Changes made by admins and shops will be listed here.'} />
        ) : (
          <div>
            {groups.map((group) => (
              <section key={group.day}>
                <h3 className="sticky top-0 z-[1] bg-ink-surface-subtle px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-text-muted sm:px-5 dark:bg-ink-dark-elevated dark:text-ink-dark-text-muted">{group.day}</h3>
                <ul className="divide-y divide-ink-border dark:divide-ink-dark-border">
                  {group.items.map((event) => {
                    const known = ACTIONS[event.action];
                    const actor = event.actorName || event.actorEmail || (event.actorRole ? humanize(event.actorRole) : 'System');
                    const note = event.details?.note || event.details?.reason;
                    const lines = describeChanges(event.details);
                    return (
                      <li key={event.id} className="flex gap-3 px-4 py-3 sm:px-5">
                        <time className="w-14 shrink-0 pt-0.5 text-xs tabular-nums text-ink-text-muted dark:text-ink-dark-text-muted" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</time>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ink-text dark:text-ink-dark-text">
                            <span className="font-semibold">{actor}</span>{' '}
                            {known ? known.text : humanize(event.action).toLowerCase()}
                            {event.shopName && <> · <button type="button" className="font-medium text-brand hover:underline dark:text-brand-dark" onClick={() => ctx.openShop(event.shopId)}>{event.shopName}</button></>}
                            {event.targetType === 'ORDER' && <> · <button type="button" className="font-medium text-brand hover:underline dark:text-brand-dark" onClick={() => ctx.openOrder(event.targetId)}>view order</button></>}
                          </p>
                          {note && <p className="mt-0.5 text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary">“{note}”</p>}
                          {lines.length > 0 && <p className="mt-0.5 text-xs text-ink-text-muted dark:text-ink-dark-text-muted">{lines.join(' · ')}</p>}
                        </div>
                        <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                          {event.outcome !== 'SUCCESS' ? <Badge tone="danger">{humanize(event.outcome)}</Badge> : known?.tone ? <Badge tone={known.tone}>{humanize(categoryOf(event))}</Badge> : <Badge>{humanize(categoryOf(event))}</Badge>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
        {cursor && <div className="border-t border-ink-border px-5 py-3 text-right dark:border-ink-dark-border"><Button size="sm" onClick={() => void loadMore()} busy={loadingMore}>Load older events</Button></div>}
      </Card>
    </div>
  );
};
