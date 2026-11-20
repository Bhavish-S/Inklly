import React, { useCallback, useEffect, useState } from 'react';
import { ConsoleShopDetail, platformAdminApi } from '../../api/platform-admin';
import { MapPinIcon, PrinterIcon } from '../../components/icons';
import {
  Badge, Button, Card, ConfirmWithNote, DetailList, Drawer, EmptyState, ErrorNotice, Field, Select, Skeleton, Toggle,
  errorMessage, formatCount, formatDateTime, formatPaise, formatRelative, humanize, inputClass, orderStatusTone, PAYMENT_METHOD_LABELS,
} from '../../components/console-ui';
import { ConsoleContext, PLAN_STATUSES, PLAN_TIERS } from './context';

type PendingAction =
  | { kind: 'status'; active: boolean }
  | { kind: 'reset-agent' }
  | { kind: 'plan'; planTier: string; planStatus: string }
  | null;

export const ShopDrawer: React.FC<{ shopId: string | null; ctx: ConsoleContext; onClose: () => void; onChanged: () => void }> = ({ shopId, ctx, onClose, onChanged }) => {
  const [detail, setDetail] = useState<ConsoleShopDetail | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', address: '', city: '' });
  const [saving, setSaving] = useState(false);
  const [planDraft, setPlanDraft] = useState({ planTier: '', planStatus: '' });
  const [pending, setPending] = useState<PendingAction>(null);
  const canManage = ctx.can('platform:manage');

  const load = useCallback(async (id: string) => {
    try {
      const next = await platformAdminApi.shop(id);
      setDetail(next);
      setForm({ name: next.shop.name, phone: next.shop.phone, address: next.shop.address, city: next.shop.city });
      setPlanDraft({ planTier: next.organization.planTier, planStatus: next.organization.planStatus });
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load this shop.'));
    }
  }, []);

  useEffect(() => {
    setDetail(null);
    setError('');
    if (shopId) void load(shopId);
  }, [shopId, load]);

  const dirty = detail && (form.name !== detail.shop.name || form.phone !== detail.shop.phone || form.address !== detail.shop.address || form.city !== detail.shop.city);
  const planDirty = detail && (planDraft.planTier !== detail.organization.planTier || planDraft.planStatus !== detail.organization.planStatus);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detail || !dirty) return;
    setSaving(true);
    try {
      const changes: Record<string, string> = {};
      (Object.keys(form) as Array<keyof typeof form>).forEach((key) => { if (form[key] !== (detail.shop as any)[key]) changes[key] = form[key]; });
      const result = await platformAdminApi.updateShop(detail.shop.id, changes);
      setDetail(result.shop);
      ctx.notify('Shop details saved.');
      onChanged();
    } catch (err) {
      ctx.notify(errorMessage(err, 'Could not save the shop.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleMap = async (listed: boolean) => {
    if (!detail) return;
    try {
      const result = await platformAdminApi.updateShop(detail.shop.id, { listedOnMap: listed });
      setDetail(result.shop);
      ctx.notify(listed ? 'Shop is now shown on the customer map.' : 'Shop is hidden from the customer map.');
      onChanged();
    } catch (err) {
      ctx.notify(errorMessage(err, 'Could not change map listing.'), 'error');
    }
  };

  const confirmPending = async (note: string) => {
    if (!detail || !pending) return;
    if (pending.kind === 'status') {
      await platformAdminApi.setShopActive(detail.shop.id, pending.active, note);
      ctx.notify(pending.active ? 'Shop activated.' : 'Shop deactivated. Its data is kept.');
    } else if (pending.kind === 'reset-agent') {
      const result = await platformAdminApi.resetAgentPairing(detail.shop.id, note);
      ctx.notify(result.revokedAgents ? `Unpaired ${result.revokedAgents} print agent${result.revokedAgents === 1 ? '' : 's'}. The shop can pair again from its app.` : 'Pairing cleared. No active agent was paired.');
    } else {
      const body: { planTier?: string; planStatus?: string; reason: string } = { reason: note };
      if (pending.planTier !== detail.organization.planTier) body.planTier = pending.planTier;
      if (pending.planStatus !== detail.organization.planStatus) body.planStatus = pending.planStatus;
      await platformAdminApi.updateOrganizationPlan(detail.organization.id, body);
      ctx.notify('Plan updated.');
    }
    setPending(null);
    await load(detail.shop.id);
    onChanged();
  };

  const d = detail;
  const hasLocation = d && d.profile.latitude !== null && d.profile.longitude !== null;

  return (
    <Drawer
      open={Boolean(shopId)}
      onClose={onClose}
      wide
      title={d ? d.shop.name : 'Shop'}
      subtitle={d && <span className="flex flex-wrap items-center gap-1.5"><span className="font-mono">{d.shop.shopCode}</span>
        {d.shop.isActive ? <Badge tone="success" dot>Active</Badge> : <Badge dot>Deactivated</Badge>}
        <Badge tone="brand">{humanize(d.organization.planTier)} · {humanize(d.organization.planStatus)}</Badge></span>}
      footer={d && canManage && (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant={d.shop.isActive ? 'danger' : 'primary'} onClick={() => setPending({ kind: 'status', active: !d.shop.isActive })}>
            {d.shop.isActive ? 'Deactivate shop' : 'Activate shop'}
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      )}
    >
      {error && <ErrorNotice message={error} onRetry={() => shopId && void load(shopId)} />}
      {!d && !error && <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /><Skeleton className="h-32" /></div>}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Today', value: formatPaise(d.revenue.todayPaise), hint: `${formatCount(d.orderCounts.today)} orders` },
              { label: 'Last 7 days', value: formatPaise(d.revenue.last7dPaise), hint: `${formatCount(d.orderCounts.last7d)} orders` },
              { label: 'Last 30 days', value: formatPaise(d.revenue.last30dPaise), hint: `${formatCount(d.orderCounts.last30d)} orders` },
              { label: 'All time', value: formatPaise(d.revenue.allTimePaise), hint: `${formatCount(d.orderCounts.open)} open now` },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-ink-border bg-white p-3 dark:border-ink-dark-border dark:bg-ink-dark-surface">
                <p className="text-[11px] text-ink-text-muted dark:text-ink-dark-text-muted">{stat.label}</p>
                <p className="mt-0.5 text-base font-bold tabular-nums text-ink-text dark:text-ink-dark-text">{stat.value}</p>
                <p className="text-[11px] text-ink-text-secondary dark:text-ink-dark-text-secondary">{stat.hint}</p>
              </div>
            ))}
          </div>
          <p className="-mt-2 text-[11px] text-ink-text-muted dark:text-ink-dark-text-muted">Revenue is payments recorded in the ledger (cash, UPI and online).</p>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-bold text-ink-text dark:text-ink-dark-text">Shop profile</h3>
            {canManage ? (
              <form onSubmit={saveProfile} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Shop name"><input required minLength={2} maxLength={160} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></Field>
                  <Field label="Phone"><input maxLength={20} inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} /></Field>
                  <Field label="Address" className="sm:col-span-2"><input maxLength={300} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputClass} /></Field>
                  <Field label="City"><input maxLength={80} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputClass} /></Field>
                </div>
                <div className="flex justify-end gap-2">
                  {dirty && <Button size="sm" onClick={() => setForm({ name: d.shop.name, phone: d.shop.phone, address: d.shop.address, city: d.shop.city })}>Discard</Button>}
                  <Button size="sm" type="submit" variant="primary" disabled={!dirty} busy={saving}>Save changes</Button>
                </div>
              </form>
            ) : (
              <DetailList items={[{ label: 'Phone', value: d.shop.phone || '—' }, { label: 'City', value: d.shop.city || '—' }, { label: 'Address', value: d.shop.address || '—' }]} />
            )}
            <div className="mt-3 border-t border-ink-border pt-3 dark:border-ink-dark-border">
              <DetailList items={[
                { label: 'Email', value: d.shop.email || '—' },
                { label: 'State / PIN', value: [d.shop.state, d.shop.pinCode].filter(Boolean).join(' · ') || '—' },
                { label: 'GSTIN', value: d.shop.gstin || '—' },
                { label: 'Joined', value: formatDateTime(d.shop.createdAt) },
              ]} />
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-1 text-sm font-bold text-ink-text dark:text-ink-dark-text">Location and map</h3>
            <Toggle checked={d.profile.listedOnMap} onChange={(checked) => void toggleMap(checked)} disabled={!canManage} label="Show on customer map" description={hasLocation ? 'Customers can find this shop on the map.' : 'The shop has not set its location yet, so it will not appear even when listed.'} />
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              {hasLocation ? (
                <a href={`https://www.google.com/maps?q=${d.profile.latitude},${d.profile.longitude}`} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline dark:text-brand-dark">
                  <MapPinIcon size={14} />{Number(d.profile.latitude).toFixed(5)}, {Number(d.profile.longitude).toFixed(5)}
                </a>
              ) : <span className="text-ink-text-secondary dark:text-ink-dark-text-secondary">Location not set</span>}
              {d.profile.landmark && <span className="text-ink-text-secondary dark:text-ink-dark-text-secondary">Near {d.profile.landmark}</span>}
              {d.profile.openingHours && typeof d.profile.openingHours === 'object' && d.profile.openingHours.open && (
                <span className="text-ink-text-secondary dark:text-ink-dark-text-secondary">Open {d.profile.openingHours.open}–{d.profile.openingHours.close}</span>
              )}
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-bold text-ink-text dark:text-ink-dark-text">Owner</h3>
              {d.owner ? <DetailList columns={1} items={[
                { label: 'Name', value: d.owner.name },
                { label: 'Email', value: d.owner.email },
                { label: 'Phone', value: d.owner.phone || '—' },
                { label: 'Account', value: d.owner.isActive ? 'Active' : 'Not activated yet' },
              ]} /> : <p className="text-sm text-ink-text-secondary">No owner on record.</p>}
            </Card>
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-bold text-ink-text dark:text-ink-dark-text">Payments</h3>
              <DetailList columns={1} items={[
                { label: 'UPI ID', value: d.payments.upiId ? <span className="font-mono">{d.payments.upiId}</span> : <Badge tone="warning">Not set</Badge> },
                { label: 'UPI payee name', value: d.payments.upiPayeeName || '—' },
                { label: 'Cash at pickup', value: d.shop.acceptCashOnCollection ? 'Accepted' : 'Off' },
                { label: 'Online gateway', value: humanize(d.shop.paymentGateway) },
              ]} />
            </Card>
          </div>

          <Card className="p-4">
            <h3 className="text-sm font-bold text-ink-text dark:text-ink-dark-text">Plan</h3>
            <p className="mb-3 text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">Applies to the whole organisation “{d.organization.name}”.</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Plan tier"><Select label="Plan tier" value={planDraft.planTier} onChange={(value) => setPlanDraft({ ...planDraft, planTier: value })} options={PLAN_TIERS.map((tier) => ({ value: tier, label: humanize(tier) }))} /></Field>
              <Field label="Plan status"><Select label="Plan status" value={planDraft.planStatus} onChange={(value) => setPlanDraft({ ...planDraft, planStatus: value })} options={PLAN_STATUSES.map((status) => ({ value: status, label: humanize(status) }))} /></Field>
              {canManage && <Button variant="primary" disabled={!planDirty} onClick={() => setPending({ kind: 'plan', ...planDraft })}>Update plan</Button>}
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-ink-text dark:text-ink-dark-text">Print agent and printers</h3>
              {canManage && <Button size="sm" variant="danger" onClick={() => setPending({ kind: 'reset-agent' })} disabled={!d.agents.some((agent) => agent.status !== 'REVOKED') && !d.pairingCodePendingUntil}>Reset pairing</Button>}
            </div>
            {d.agents.length === 0 ? <p className="text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary">No print agent has been paired with this shop{d.pairingCodePendingUntil ? `. A pairing code is waiting until ${formatDateTime(d.pairingCodePendingUntil)}.` : '.'}</p> : (
              <ul className="space-y-2">
                {d.agents.map((agent) => (
                  <li key={agent.agentId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink-surface-subtle px-3 py-2 text-sm dark:bg-ink-dark-elevated">
                    <span className="min-w-0">
                      <span className="block font-medium text-ink-text dark:text-ink-dark-text">{agent.hostname || 'Unnamed computer'}</span>
                      <span className="block text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{[agent.osPlatform, agent.agentVersion && `v${agent.agentVersion}`].filter(Boolean).join(' · ') || 'Details not reported'} · seen {formatRelative(agent.lastHeartbeat)}</span>
                    </span>
                    <Badge tone={agent.status === 'ONLINE' ? 'success' : agent.status === 'REVOKED' ? 'neutral' : 'warning'} dot>{agent.status === 'REVOKED' ? 'Unpaired' : humanize(agent.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 border-t border-ink-border pt-3 dark:border-ink-dark-border">
              {d.printers.length === 0 ? <p className="text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary">No printers reported yet.</p> : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {d.printers.map((printer) => (
                    <li key={printer.id} className="flex items-center gap-3 rounded-xl border border-ink-border px-3 py-2 dark:border-ink-dark-border">
                      <PrinterIcon size={16} className={printer.isOnline ? 'text-status-success' : 'text-ink-text-muted'} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-text dark:text-ink-dark-text">{printer.name}{printer.isDefault && <span className="ml-1 text-xs text-ink-text-muted">(default)</span>}</span>
                        <span className="block text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{printer.supportsColor ? 'Colour' : 'B/W'}{printer.supportsDuplex ? ' · Duplex' : ''}</span>
                      </span>
                      <Badge tone={printer.isOnline ? 'success' : 'neutral'}>{printer.isOnline ? 'Online' : 'Offline'}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between px-4 pt-4">
              <h3 className="text-sm font-bold text-ink-text dark:text-ink-dark-text">Recent orders</h3>
              <button type="button" onClick={() => { ctx.goTo('orders', { shopId: d.shop.id, shopName: d.shop.name }); onClose(); }} className="text-xs font-semibold text-brand hover:underline dark:text-brand-dark">All orders for this shop</button>
            </div>
            {d.recentOrders.length === 0 ? <EmptyState title="No orders yet" description="Orders placed at this shop will show here." /> : (
              <ul className="mt-2 divide-y divide-ink-border dark:divide-ink-dark-border">
                {d.recentOrders.map((order) => (
                  <li key={order.id}>
                    <button type="button" onClick={() => ctx.openOrder(order.id)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-ink-surface-subtle dark:hover:bg-ink-dark-hover">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink-text dark:text-ink-dark-text">Token {order.tokenNumber || '—'} · {order.customerName || 'Customer'}</span>
                        <span className="block text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{PAYMENT_METHOD_LABELS[order.paymentMethod] || humanize(order.paymentMethod)} · {formatRelative(order.createdAt)}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-semibold tabular-nums">{formatPaise(order.totalAmountPaise)}</span>
                        <Badge tone={orderStatusTone(order.status)}>{humanize(order.status)}</Badge>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <p className="break-all text-[11px] text-ink-text-muted dark:text-ink-dark-text-muted">Shop ID {d.shop.id} · Organisation ID {d.organization.id}</p>
        </>
      )}

      <ConfirmWithNote
        open={pending !== null}
        onCancel={() => setPending(null)}
        onConfirm={confirmPending}
        minLength={pending?.kind === 'plan' ? 10 : 5}
        danger={pending?.kind === 'reset-agent' || (pending?.kind === 'status' && !pending.active)}
        title={pending?.kind === 'status' ? (pending.active ? 'Activate this shop?' : 'Deactivate this shop?')
          : pending?.kind === 'reset-agent' ? 'Reset the print agent pairing?' : 'Change the plan?'}
        description={pending?.kind === 'status' ? (pending.active
          ? 'Customers can order again and staff can sign in.'
          : 'Customers cannot order and staff cannot sign in. Orders, payments and history are kept. You can activate it again at any time.')
          : pending?.kind === 'reset-agent' ? 'Every paired computer for this shop is unpaired and pending pairing codes are cleared. Printing stops until the shop pairs again from its app.'
            : pending?.kind === 'plan' ? `${humanize(d?.organization.planTier)} · ${humanize(d?.organization.planStatus)} → ${humanize(pending.planTier)} · ${humanize(pending.planStatus)}` : undefined}
        confirmLabel={pending?.kind === 'status' ? (pending.active ? 'Activate' : 'Deactivate') : pending?.kind === 'reset-agent' ? 'Reset pairing' : 'Update plan'}
      />
    </Drawer>
  );
};
