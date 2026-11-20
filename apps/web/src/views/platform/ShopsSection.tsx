import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { ConsoleShopRow, platformAdminApi } from '../../api/platform-admin';
import { DownloadIcon, MapPinIcon, StoreIcon } from '../../components/icons';
import {
  Badge, Button, Card, EmptyState, ErrorNotice, Field, LoadingRows, Modal, PageHeader, Pager, SearchInput, Select, Table, Td,
  downloadCsv, errorMessage, formatCount, formatRelative, humanize, inputClass, useDebounced,
} from '../../components/console-ui';
import { ConsoleContext, PLAN_TIERS } from './context';

const PAGE_SIZE = 25;

export const ShopsSection: React.FC<{ ctx: ConsoleContext; reloadKey: number }> = ({ ctx, reloadKey }) => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<ConsoleShopRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const debouncedSearch = useDebounced(search);

  useEffect(() => { setOffset(0); }, [debouncedSearch, status]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    platformAdminApi.shops({ search: debouncedSearch, status, limit: PAGE_SIZE, offset })
      .then((page) => { if (!cancelled) { setRows(page.shops); setTotal(page.total); setError(''); } })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, 'Could not load shops.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedSearch, status, offset, reloadKey, ctx.refreshKey]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all: ConsoleShopRow[] = [];
      for (let next = 0; ; next += 100) {
        const page = await platformAdminApi.shops({ search: debouncedSearch, status, limit: 100, offset: next });
        all.push(...page.shops);
        if (!page.hasMore) break;
      }
      downloadCsv(`inklly-shops-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Shop ID', 'Shop code', 'Name', 'City', 'Phone', 'Active', 'Organisation', 'Plan', 'Plan status', 'Owner', 'Owner email', 'On map', 'UPI set', 'Orders 7d', 'Last order', 'Created'],
        all.map((shop) => [shop.id, shop.shopCode, shop.name, shop.city, shop.phone, shop.isActive ? 'yes' : 'no', shop.organizationName, shop.planTier, shop.planStatus,
          shop.owner.name, shop.owner.email, shop.listedOnMap ? 'yes' : 'no', shop.hasUpi ? 'yes' : 'no', shop.orders7d, shop.lastOrderAt || '', shop.createdAt]));
      ctx.notify(`Exported ${all.length} shops.`);
    } catch (err) {
      ctx.notify(errorMessage(err, 'Could not export shops.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Shops"
        description="Every print shop on Inklly. Open a shop to edit it, change its plan, or reset its print agent."
        actions={<>
          <Button size="sm" onClick={() => void exportCsv()} busy={exporting} disabled={total === 0}><DownloadIcon size={14} />Export CSV</Button>
          {ctx.can('platform:manage') && <Button size="sm" variant="primary" onClick={() => setOnboardOpen(true)}>+ Add shop</Button>}
        </>}
      />

      <Card>
        <div className="flex flex-col gap-2 border-b border-ink-border p-4 sm:flex-row sm:items-center dark:border-ink-dark-border">
          <SearchInput className="flex-1" value={search} onChange={setSearch} placeholder="Search shop, code, city, phone or owner" />
          <Select className="sm:w-44" label="Shop status" value={status} onChange={setStatus} options={[{ value: 'ALL', label: 'All shops' }, { value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Deactivated' }]} />
        </div>
        {error && <div className="p-4"><ErrorNotice message={error} /></div>}
        {loading && rows.length === 0 ? <LoadingRows /> : rows.length === 0 ? (
          <EmptyState icon={<StoreIcon size={22} />} title={debouncedSearch || status !== 'ALL' ? 'No shops match' : 'No shops yet'} description={debouncedSearch || status !== 'ALL' ? 'Try a different search or filter.' : 'Add the first shop to get started.'} />
        ) : (
          <>
            {/* Phone: cards */}
            <ul className="divide-y divide-ink-border md:hidden dark:divide-ink-dark-border">
              {rows.map((shop) => (
                <li key={shop.id}>
                  <button type="button" onClick={() => ctx.openShop(shop.id)} className="w-full px-4 py-3 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-text dark:text-ink-dark-text">{shop.name}</p>
                        <p className="truncate text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{shop.city || 'City not set'} · {shop.shopCode}</p>
                      </div>
                      <ShopStatusBadge shop={shop} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone="brand">{humanize(shop.planTier)}</Badge>
                      <AgentBadge shop={shop} />
                      <Badge>{formatCount(shop.orders7d)} orders · 7d</Badge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {/* Tablet and desktop: table */}
            <Table className="hidden md:block" head={['Shop', 'Owner', 'Plan', 'Print agent', 'Orders 7d', 'Last order', 'Status']}>
              {rows.map((shop) => (
                <tr key={shop.id} onClick={() => ctx.openShop(shop.id)} className="cursor-pointer transition hover:bg-ink-surface-subtle dark:hover:bg-ink-dark-hover">
                  <Td>
                    <button type="button" onClick={(event) => { event.stopPropagation(); ctx.openShop(shop.id); }} className="text-left">
                      <span className="block font-semibold hover:text-brand">{shop.name}</span>
                      <span className="flex items-center gap-1 text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">
                        {shop.city || 'City not set'} · <span className="font-mono">{shop.shopCode}</span>
                        {shop.listedOnMap && shop.hasLocation && <MapPinIcon size={12} aria-label="Listed on map" />}
                      </span>
                    </button>
                  </Td>
                  <Td><span className="block">{shop.owner.name || '—'}</span><span className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{shop.owner.email || ''}</span></Td>
                  <Td><span className="block">{humanize(shop.planTier)}</span><span className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{humanize(shop.planStatus)}</span></Td>
                  <Td><AgentBadge shop={shop} /></Td>
                  <Td className="tabular-nums">{formatCount(shop.orders7d)}</Td>
                  <Td className="whitespace-nowrap text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{shop.lastOrderAt ? formatRelative(shop.lastOrderAt) : 'No orders'}</Td>
                  <Td><ShopStatusBadge shop={shop} /></Td>
                </tr>
              ))}
            </Table>
            <Pager offset={offset} limit={PAGE_SIZE} total={total} onChange={setOffset} busy={loading} />
          </>
        )}
      </Card>

      <OnboardShopModal open={onboardOpen} onClose={() => setOnboardOpen(false)} onCreated={() => { setOffset(0); setSearch(''); ctx.notify('Shop created. Share the setup link with the owner.'); }} />
    </div>
  );
};

const ShopStatusBadge: React.FC<{ shop: ConsoleShopRow }> = ({ shop }) => {
  if (!shop.isActive) return <Badge tone="neutral" dot>Deactivated</Badge>;
  if (['PAST_DUE', 'SUSPENDED', 'CANCELLED'].includes(shop.planStatus)) return <Badge tone="danger" dot>{humanize(shop.planStatus)}</Badge>;
  if (shop.planStatus === 'TRIAL') return <Badge tone="info" dot>Trial</Badge>;
  return <Badge tone="success" dot>Active</Badge>;
};

const AgentBadge: React.FC<{ shop: ConsoleShopRow }> = ({ shop }) => {
  if (shop.agentsRegistered === 0) return <Badge tone="neutral">Not paired</Badge>;
  if (shop.agentsOnline > 0) return <Badge tone="success" dot>Online</Badge>;
  return <Badge tone="warning" dot>Offline</Badge>;
};

/** Creates an organisation, its first shop and an owner invitation (existing onboarding endpoint). */
const OnboardShopModal: React.FC<{ open: boolean; onClose: () => void; onCreated: () => void }> = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState({ organizationName: '', shopCode: '', ownerName: '', ownerEmail: '', planTier: 'STARTER' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  useEffect(() => {
    if (open) { setForm({ organizationName: '', shopCode: '', ownerName: '', ownerEmail: '', planTier: 'STARTER' }); setError(''); setInviteLink(''); setBusy(false); }
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.createPlatformMerchant({
        organizationName: form.organizationName.trim(), shopCode: form.shopCode.trim() || undefined,
        ownerName: form.ownerName.trim(), ownerEmail: form.ownerEmail.trim(), planTier: form.planTier,
      });
      if (typeof result.invitationToken !== 'string' || result.invitationToken.length < 40) {
        throw new Error('The shop was created but no owner invitation came back. Check the audit log before trying again.');
      }
      const url = new URL('/accept-invitation', window.location.origin);
      url.hash = new URLSearchParams({ token: result.invitationToken }).toString();
      setInviteLink(url.toString());
      onCreated();
    } catch (err) {
      setError(errorMessage(err, 'Could not create the shop.'));
    } finally {
      setBusy(false);
    }
  };

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <Modal open={open} onClose={() => { if (!busy) onClose(); }} title={inviteLink ? 'Shop created' : 'Add a shop'} description={inviteLink ? undefined : 'Creates the organisation, its first shop and a 7-day trial. The owner sets their own password from a one-time link.'}>
      {inviteLink ? (
        <div className="space-y-3">
          <p className="rounded-xl bg-status-success-bg p-3 text-sm text-status-success dark:bg-status-dark-success-bg dark:text-status-dark-success">Send this one-time setup link to the owner privately. It expires in 48 hours and is shown only once.</p>
          <input readOnly value={inviteLink} aria-label="Owner setup link" className={`${inputClass} font-mono text-xs`} onFocus={(event) => event.target.select()} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={onClose}>Done</Button>
            <Button variant="primary" onClick={() => void navigator.clipboard.writeText(inviteLink).catch(() => undefined)}>Copy link</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <Field label="Shop or business name"><input required maxLength={160} value={form.organizationName} onChange={set('organizationName')} className={inputClass} placeholder="Shop name as customers know it" /></Field>
          <Field label="Shop code (QR link)" hint="Lowercase letters, numbers and dashes. Leave blank to generate from the name."><input maxLength={80} value={form.shopCode} onChange={set('shopCode')} className={`${inputClass} font-mono`} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Owner name"><input required maxLength={160} value={form.ownerName} onChange={set('ownerName')} className={inputClass} /></Field>
            <Field label="Owner email"><input required type="email" maxLength={320} value={form.ownerEmail} onChange={set('ownerEmail')} className={inputClass} /></Field>
          </div>
          <Field label="Plan"><select value={form.planTier} onChange={set('planTier')} className={inputClass}>{PLAN_TIERS.map((tier) => <option key={tier} value={tier}>{humanize(tier)}</option>)}</select></Field>
          {error && <p role="alert" className="text-xs font-medium text-status-danger dark:text-status-dark-danger">{error}</p>}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="primary" busy={busy}>Create shop</Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
