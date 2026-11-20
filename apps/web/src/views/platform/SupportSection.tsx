import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { InboxIcon, LifebuoyIcon } from '../../components/icons';
import {
  Badge, Button, Card, CardHeader, EmptyState, ErrorNotice, Field, LoadingRows, Modal, PageHeader, Select, Tabs,
  errorMessage, formatDateTime, formatRelative, humanize, inputClass, Tone, cx,
} from '../../components/console-ui';
import { ConsoleContext } from './context';

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUSES = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'];
const severityTone = (severity: string): Tone => severity === 'CRITICAL' ? 'danger' : severity === 'HIGH' ? 'warning' : severity === 'MEDIUM' ? 'info' : 'neutral';
const statusTone = (status: string): Tone => status === 'OPEN' ? 'danger' : status === 'INVESTIGATING' ? 'warning' : status === 'RESOLVED' ? 'success' : 'neutral';

export const SupportSection: React.FC<{ ctx: ConsoleContext }> = ({ ctx }) => {
  const canIncidents = ctx.can('support:view') || ctx.can('support:manage');
  const canEnquiries = ctx.can('support:view');
  const [tab, setTab] = useState<'incidents' | 'enquiries'>(canIncidents ? 'incidents' : 'enquiries');
  return (
    <div className="space-y-5">
      <PageHeader title="Support" description="Track incidents that affect shops, and follow up on enquiries from the website." />
      {canIncidents && canEnquiries && <Tabs label="Support views" value={tab} onChange={(value) => setTab(value as 'incidents' | 'enquiries')} items={[{ id: 'incidents', label: 'Incidents' }, { id: 'enquiries', label: 'Website enquiries' }]} />}
      {tab === 'incidents' && canIncidents && <IncidentsPanel ctx={ctx} />}
      {tab === 'enquiries' && canEnquiries && <EnquiriesPanel ctx={ctx} />}
    </div>
  );
};

const emptyIncident = { title: '', description: '', severity: 'MEDIUM', shopId: '', orderId: '', agentId: '', assignedToUserId: '' };

const IncidentsPanel: React.FC<{ ctx: ConsoleContext }> = ({ ctx }) => {
  const canManage = ctx.can('support:manage');
  const [incidents, setIncidents] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignees, setAssignees] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyIncident);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [draft, setDraft] = useState({ status: '', severity: '', assignedToUserId: '', resolutionNotes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await api.getPlatformIncidents(undefined, 50, { status: statusFilter, severity: severityFilter });
      setIncidents(Array.isArray(page.incidents) ? page.incidents : []);
      setCursor(typeof page.nextCursor === 'string' ? page.nextCursor : null);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load incidents.'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter]);

  useEffect(() => { void load(); }, [load, ctx.refreshKey]);
  useEffect(() => {
    if (!canManage) return;
    api.getPlatformIncidentAssignees().then((result: any) => setAssignees(Array.isArray(result.assignees) ? result.assignees : [])).catch(() => setAssignees([]));
  }, [canManage]);

  const loadMore = async () => {
    if (!cursor) return;
    try {
      const page = await api.getPlatformIncidents(cursor, 50, { status: statusFilter, severity: severityFilter });
      setIncidents((current) => [...current, ...(page.incidents || []).filter((row: any) => !current.some((item) => item.id === row.id))]);
      setCursor(typeof page.nextCursor === 'string' ? page.nextCursor : null);
    } catch (err) {
      ctx.notify(errorMessage(err, 'Could not load older incidents.'), 'error');
    }
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([key, value]) => key === 'severity' || String(value).trim()));
      await api.createPlatformIncident(payload);
      setCreateOpen(false);
      setForm(emptyIncident);
      ctx.notify('Incident created.');
      await load();
    } catch (err) {
      ctx.notify(errorMessage(err, 'Could not create the incident.'), 'error');
    } finally { setBusy(false); }
  };

  const openEdit = (incident: any) => {
    setEditing(incident);
    setDraft({ status: incident.status, severity: incident.severity, assignedToUserId: incident.assignedToUserId || '', resolutionNotes: incident.resolutionNotes || '' });
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    if (['RESOLVED', 'CLOSED'].includes(draft.status) && draft.status !== editing.status && !draft.resolutionNotes.trim()) {
      ctx.notify('Add resolution notes before resolving or closing.', 'error');
      return;
    }
    setBusy(true);
    try {
      await api.updatePlatformIncident(editing.id, { status: draft.status, severity: draft.severity, assignedToUserId: draft.assignedToUserId || null, resolutionNotes: draft.resolutionNotes.trim() });
      setEditing(null);
      ctx.notify('Incident updated.');
      await load();
    } catch (err) {
      ctx.notify(errorMessage(err, 'Could not update the incident.'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader
        title="Incidents"
        subtitle="Problems that need follow-up, such as a shop that cannot print."
        actions={<>
          <Select className="w-36" label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'ALL', label: 'Any status' }, ...STATUSES.map((s) => ({ value: s, label: humanize(s) }))]} />
          <Select className="w-36" label="Severity" value={severityFilter} onChange={setSeverityFilter} options={[{ value: 'ALL', label: 'Any severity' }, ...SEVERITIES.map((s) => ({ value: s, label: humanize(s) }))]} />
          {canManage && <Button size="sm" variant="primary" onClick={() => setCreateOpen(true)}>+ New incident</Button>}
        </>}
      />
      {error && <div className="p-4"><ErrorNotice message={error} onRetry={() => void load()} /></div>}
      {loading ? <LoadingRows /> : incidents.length === 0 ? (
        <EmptyState icon={<LifebuoyIcon size={22} />} title="No incidents" description={statusFilter !== 'ALL' || severityFilter !== 'ALL' ? 'Nothing matches these filters.' : 'Nothing is being tracked right now.'} />
      ) : (
        <ul className="divide-y divide-ink-border dark:divide-ink-dark-border">
          {incidents.map((incident) => (
            <li key={incident.id} className="px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-semibold text-ink-text dark:text-ink-dark-text">{incident.title}</p>
                    <Badge tone={severityTone(incident.severity)}>{humanize(incident.severity)}</Badge>
                    <Badge tone={statusTone(incident.status)} dot>{humanize(incident.status)}</Badge>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary">{incident.description}</p>
                  <p className="mt-1 text-xs text-ink-text-muted dark:text-ink-dark-text-muted">
                    {[incident.shopName && `Shop: ${incident.shopName}`, incident.orderNumber && `Order ${incident.orderNumber}`, incident.agentHostname && `Computer ${incident.agentHostname}`,
                      `Owner: ${incident.assigneeName || 'unassigned'}`, `Opened ${formatRelative(incident.createdAt)}`].filter(Boolean).join(' · ')}
                  </p>
                  {incident.resolutionNotes && <p className="mt-1 text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">Resolution: {incident.resolutionNotes}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {incident.shopId && <Button size="sm" variant="ghost" onClick={() => ctx.openShop(incident.shopId)}>Shop</Button>}
                  {incident.orderId && <Button size="sm" variant="ghost" onClick={() => ctx.openOrder(incident.orderId)}>Order</Button>}
                  {canManage && <Button size="sm" onClick={() => openEdit(incident)}>Update</Button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {cursor && <div className="border-t border-ink-border px-5 py-3 text-right dark:border-ink-dark-border"><Button size="sm" onClick={() => void loadMore()}>Load older incidents</Button></div>}

      <Modal open={createOpen} onClose={() => { if (!busy) setCreateOpen(false); }} title="New incident" description="Link a shop, order or computer if you know it. Every change is audited.">
        <form onSubmit={create} className="space-y-3">
          <Field label="Title"><input required maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} /></Field>
          <Field label="What is happening?"><textarea required rows={3} maxLength={4000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={cx(inputClass, 'py-2')} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Severity"><Select label="Severity" value={form.severity} onChange={(value) => setForm({ ...form, severity: value })} options={SEVERITIES.map((s) => ({ value: s, label: humanize(s) }))} /></Field>
            <Field label="Owner"><Select label="Owner" value={form.assignedToUserId} onChange={(value) => setForm({ ...form, assignedToUserId: value })} options={[{ value: '', label: 'Unassigned' }, ...assignees.map((a) => ({ value: a.id, label: a.fullName || a.email }))]} /></Field>
            <Field label="Shop ID (optional)"><input value={form.shopId} onChange={(e) => setForm({ ...form, shopId: e.target.value })} className={`${inputClass} font-mono text-xs`} /></Field>
            <Field label="Order ID (optional)"><input value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value })} className={`${inputClass} font-mono text-xs`} /></Field>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button onClick={() => setCreateOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="primary" busy={busy}>Create incident</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => { if (!busy) setEditing(null); }} title={editing ? `Update: ${editing.title}` : 'Update incident'}>
        <form onSubmit={saveEdit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status"><Select label="Status" value={draft.status} onChange={(value) => setDraft({ ...draft, status: value })} options={STATUSES.map((s) => ({ value: s, label: humanize(s) }))} /></Field>
            <Field label="Severity"><Select label="Severity" value={draft.severity} onChange={(value) => setDraft({ ...draft, severity: value })} options={SEVERITIES.map((s) => ({ value: s, label: humanize(s) }))} /></Field>
          </div>
          <Field label="Owner"><Select label="Owner" value={draft.assignedToUserId} onChange={(value) => setDraft({ ...draft, assignedToUserId: value })} options={[{ value: '', label: 'Unassigned' }, ...assignees.map((a) => ({ value: a.id, label: a.fullName || a.email }))]} /></Field>
          <Field label="Resolution notes" hint="Required to resolve or close."><textarea rows={3} maxLength={4000} value={draft.resolutionNotes} onChange={(e) => setDraft({ ...draft, resolutionNotes: e.target.value })} className={cx(inputClass, 'py-2')} /></Field>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="primary" busy={busy}>Save</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
};

const EnquiriesPanel: React.FC<{ ctx: ConsoleContext }> = ({ ctx }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getPlatformEnquiries()
      .then((result: any) => { if (!cancelled) { setRows(Array.isArray(result) ? result : []); setError(''); } })
      .catch((err: unknown) => { if (!cancelled) setError(errorMessage(err, 'Could not load enquiries.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ctx.refreshKey]);

  return (
    <Card>
      <CardHeader title="Website enquiries" subtitle="Messages sent from the Inklly website. Opening this list is recorded in the audit log." />
      {error && <div className="p-4"><ErrorNotice message={error} /></div>}
      {loading ? <LoadingRows /> : rows.length === 0 ? <EmptyState icon={<InboxIcon size={22} />} title="No enquiries yet" /> : (
        <ul className="divide-y divide-ink-border dark:divide-ink-dark-border">
          {rows.map((enquiry) => (
            <li key={enquiry.id} className="px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink-text dark:text-ink-dark-text">{enquiry.name} <span className="font-normal text-ink-text-secondary dark:text-ink-dark-text-secondary">· {enquiry.phone}{enquiry.email ? ` · ${enquiry.email}` : ''}</span></p>
                <span className="flex items-center gap-2 text-xs text-ink-text-muted"><Badge>{humanize(enquiry.status)}</Badge>{formatDateTime(enquiry.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary">{enquiry.message}</p>
              <p className="mt-1 text-xs text-ink-text-muted">{humanize(enquiry.source)}{enquiry.city ? ` · ${enquiry.city}` : ''}{enquiry.state ? `, ${enquiry.state}` : ''}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
