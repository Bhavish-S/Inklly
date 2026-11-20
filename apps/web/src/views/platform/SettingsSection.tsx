import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { AnnouncementTone, FeatureFlag, PlatformSettings, PlatformSettingsSnapshot, platformAdminApi } from '../../api/platform-admin';
import {
  Button, Card, CardHeader, ErrorNotice, Field, PageHeader, Select, Skeleton, Toggle,
  cx, errorMessage, formatCount, formatDateTime, inputClass,
} from '../../components/console-ui';
import { ConsoleContext } from './context';

const TONES: Array<{ value: AnnouncementTone; label: string; className: string }> = [
  { value: 'info', label: 'Information (blue)', className: 'bg-status-info-bg text-status-info dark:bg-status-dark-info-bg dark:text-status-dark-info' },
  { value: 'success', label: 'Good news (green)', className: 'bg-status-success-bg text-status-success dark:bg-status-dark-success-bg dark:text-status-dark-success' },
  { value: 'warning', label: 'Heads up (amber)', className: 'bg-status-warning-bg text-status-warning dark:bg-status-dark-warning-bg dark:text-status-dark-warning' },
  { value: 'critical', label: 'Urgent (red)', className: 'bg-status-danger-bg text-status-danger dark:bg-status-dark-danger-bg dark:text-status-dark-danger' },
];

const FLAGS: Array<{ key: FeatureFlag; label: string; description: string }> = [
  { key: 'map_discovery', label: 'Shop map', description: 'Customers can find nearby shops on a map.' },
  { key: 'upi_direct', label: 'UPI to shop', description: 'Customers can pay the shop’s own UPI ID from any UPI app.' },
  { key: 'razorpay_online', label: 'Online payments (Razorpay)', description: 'Customers can pay online at shops that connected Razorpay.' },
];

export const SettingsSection: React.FC<{ ctx: ConsoleContext }> = ({ ctx }) => {
  const canManage = ctx.can('platform:manage');
  const [snapshot, setSnapshot] = useState<PlatformSettingsSnapshot | null>(null);
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const [coords, setCoords] = useState({ latitude: '', longitude: '' });
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const apply = (next: PlatformSettingsSnapshot) => {
    setSnapshot(next);
    setDraft(JSON.parse(JSON.stringify(next.settings)));
    setCoords({ latitude: String(next.settings.mapDefaults.latitude), longitude: String(next.settings.mapDefaults.longitude) });
  };

  useEffect(() => {
    platformAdminApi.settings().then((next) => { apply(next); setError(''); }).catch((err) => setError(errorMessage(err, 'Could not load settings.')));
  }, [ctx.refreshKey]);

  const update = <K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) => setDraft((current) => current ? { ...current, [key]: value } : current);

  const latitude = Number(coords.latitude);
  const longitude = Number(coords.longitude);
  const coordsValid = coords.latitude.trim() !== '' && coords.longitude.trim() !== '' && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  const merged: PlatformSettings | null = draft && coordsValid ? { ...draft, mapDefaults: { ...draft.mapDefaults, latitude, longitude } } : draft;
  const changedKeys = snapshot && merged ? (Object.keys(merged) as Array<keyof PlatformSettings>).filter((key) => JSON.stringify(merged[key]) !== JSON.stringify(snapshot.settings[key])) : [];

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!merged || !changedKeys.length) return;
    if (!coordsValid) { ctx.notify('Map centre needs a latitude from -90 to 90 and longitude from -180 to 180.', 'error'); return; }
    setSaving(true);
    try {
      const patch: Record<string, unknown> = Object.fromEntries(changedKeys.map((key) => [key, merged[key]]));
      if (note.trim()) patch.note = note.trim();
      apply(await platformAdminApi.saveSettings(patch as any));
      setNote('');
      ctx.notify('Settings saved. Public pages pick them up within a minute.');
    } catch (err) {
      ctx.notify(errorMessage(err, 'Could not save settings.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <div className="space-y-5"><PageHeader title="Platform settings" /><ErrorNotice message={error} /></div>;
  if (!draft || !snapshot) return <div className="space-y-4"><PageHeader title="Platform settings" /><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div>;

  const tone = TONES.find((option) => option.value === draft.announcement.tone) || TONES[0];
  const disabled = !canManage;

  return (
    <form onSubmit={save} className="space-y-5 pb-24">
      <PageHeader
        title="Platform settings"
        description="Applies to every shop and customer. Every change is saved in the audit log."
        actions={snapshot.updatedAt && <span className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">Last changed {formatDateTime(snapshot.updatedAt)}{snapshot.updatedBy ? ` by ${snapshot.updatedBy.name || snapshot.updatedBy.email}` : ''}</span>}
      />
      {!canManage && <p className="rounded-xl bg-status-info-bg px-4 py-3 text-sm text-status-info dark:bg-status-dark-info-bg dark:text-status-dark-info">You can view settings. Changing them needs the “Manage platform” permission.</p>}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Announcement banner" subtitle="A short message shown at the top of customer and shop pages." />
          <div className="space-y-3 p-4 sm:p-5">
            <Toggle label="Show the banner" checked={draft.announcement.active} disabled={disabled} onChange={(active) => update('announcement', { ...draft.announcement, active })} />
            <Field label="Message" hint={`${draft.announcement.text.length}/280`}>
              <textarea rows={2} maxLength={280} disabled={disabled} value={draft.announcement.text} onChange={(e) => update('announcement', { ...draft.announcement, text: e.target.value })} className={cx(inputClass, 'py-2')} placeholder="For example: Shops close early on Sunday for Diwali." />
            </Field>
            <Field label="Style"><Select label="Banner style" value={draft.announcement.tone} onChange={(value) => update('announcement', { ...draft.announcement, tone: value as AnnouncementTone })} options={TONES} /></Field>
            {draft.announcement.text.trim() && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-text-muted">Preview</p>
                <div className={cx('rounded-xl px-4 py-2.5 text-sm font-medium', tone.className, !draft.announcement.active && 'opacity-50')}>{draft.announcement.text}</div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Maintenance mode" subtitle="Tell everyone the service is paused for maintenance." />
          <div className="space-y-3 p-4 sm:p-5">
            <Toggle label="Maintenance mode on" description="Shows the message below on public pages." checked={draft.maintenance.active} disabled={disabled} onChange={(active) => update('maintenance', { ...draft.maintenance, active })} />
            <Field label="Message" hint={`${draft.maintenance.message.length}/500`}>
              <textarea rows={3} maxLength={500} disabled={disabled} value={draft.maintenance.message} onChange={(e) => update('maintenance', { ...draft.maintenance, message: e.target.value })} className={cx(inputClass, 'py-2')} placeholder="For example: We are upgrading Inklly. Back by 6 am." />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Features" subtitle="Switch features on or off for everyone." />
          <div className="divide-y divide-ink-border px-4 sm:px-5 dark:divide-ink-dark-border">
            {FLAGS.map((flag) => (
              <Toggle key={flag.key} label={flag.label} description={flag.description} checked={draft.featureFlags[flag.key]} disabled={disabled}
                onChange={(checked) => update('featureFlags', { ...draft.featureFlags, [flag.key]: checked })} />
            ))}
            <Toggle label="New shop sign-ups" description="Allow print shops to sign up on their own." checked={draft.signupsOpen} disabled={disabled} onChange={(checked) => update('signupsOpen', checked)} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Map defaults" subtitle="Where the customer map opens before it knows the customer’s location." />
          <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
            <Field label="City" className="sm:col-span-3"><input maxLength={80} disabled={disabled} value={draft.mapDefaults.city} onChange={(e) => update('mapDefaults', { ...draft.mapDefaults, city: e.target.value })} className={inputClass} placeholder="For example: Pune" /></Field>
            <Field label="Centre latitude"><input inputMode="decimal" disabled={disabled} value={coords.latitude} onChange={(e) => setCoords({ ...coords, latitude: e.target.value })} className={cx(inputClass, !coordsValid && 'border-status-danger')} /></Field>
            <Field label="Centre longitude"><input inputMode="decimal" disabled={disabled} value={coords.longitude} onChange={(e) => setCoords({ ...coords, longitude: e.target.value })} className={cx(inputClass, !coordsValid && 'border-status-danger')} /></Field>
            <div className="flex items-end">
              {coordsValid && <a className="pb-2 text-xs font-semibold text-brand hover:underline dark:text-brand-dark" target="_blank" rel="noreferrer noopener" href={`https://www.google.com/maps?q=${latitude},${longitude}`}>Check on map</a>}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Support contacts" subtitle="Shown to customers and shops who need help." />
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            <Field label="Phone"><input type="tel" maxLength={20} disabled={disabled} value={draft.supportContacts.phone} onChange={(e) => update('supportContacts', { ...draft.supportContacts, phone: e.target.value })} className={inputClass} placeholder="+91 …" /></Field>
            <Field label="WhatsApp"><input type="tel" maxLength={20} disabled={disabled} value={draft.supportContacts.whatsapp} onChange={(e) => update('supportContacts', { ...draft.supportContacts, whatsapp: e.target.value })} className={inputClass} placeholder="+91 …" /></Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Uploads" subtitle="Largest document a customer can upload." />
          <div className="p-4 sm:p-5">
            <Field label="Maximum upload size (MB)" hint="Whole number from 1 to 500.">
              <input type="number" min={1} max={500} step={1} disabled={disabled} value={draft.maxUploadMb} onChange={(e) => update('maxUploadMb', Math.round(Number(e.target.value)))} className={cx(inputClass, 'sm:w-40')} />
            </Field>
          </div>
        </Card>
      </div>

      <RetentionCard ctx={ctx} />

      {canManage && changedKeys.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-border bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur dark:border-ink-dark-border dark:bg-ink-dark-surface/95">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center">
            <p className="text-sm font-semibold text-ink-text dark:text-ink-dark-text sm:mr-auto">{changedKeys.length} unsaved change{changedKeys.length === 1 ? '' : 's'}</p>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note for the audit log (optional)" aria-label="Note for the audit log" className={cx(inputClass, 'sm:w-72')} />
            <div className="flex gap-2">
              <Button onClick={() => apply(snapshot)} disabled={saving}>Discard</Button>
              <Button type="submit" variant="primary" busy={saving} disabled={!coordsValid}>Save changes</Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

/** File retention: customer files are deleted automatically after pickup. */
const RetentionCard: React.FC<{ ctx: ConsoleContext }> = ({ ctx }) => {
  const [stats, setStats] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.getPlatformRetentionStats().then(setStats).catch(() => setStats(null)); }, [ctx.refreshKey]);
  const purge = async () => {
    setBusy(true);
    try {
      const result = await api.runPlatformRetentionPurge();
      setStats(await api.getPlatformRetentionStats());
      const s = result.summary || {};
      ctx.notify(`Deleted ${s.expiredFilesDeleted ?? 0} old order files and ${s.orphanFilesDeleted ?? 0} unused uploads.`);
    } catch (err) {
      ctx.notify(errorMessage(err, 'Clean-up failed.'), 'error');
    } finally { setBusy(false); }
  };
  if (!stats) return null;
  const mb = (bytes: number) => `${(Number(bytes || 0) / (1024 * 1024)).toFixed(1)} MB`;
  return (
    <Card>
      <CardHeader
        title="Customer file storage"
        subtitle={`Order files are deleted ${stats.policy?.orderFileRetentionHours ?? 24} h after pickup or cancellation. A clean-up runs every ${stats.policy?.automaticSweepIntervalMinutes ?? 15} minutes.`}
        actions={ctx.can('platform:manage') && <Button size="sm" onClick={() => void purge()} busy={busy}>Run clean-up now</Button>}
      />
      <dl className="grid grid-cols-2 gap-4 p-4 text-sm sm:grid-cols-4 sm:p-5">
        <div><dt className="text-xs text-ink-text-muted">Stored order files</dt><dd className="font-semibold">{formatCount(stats.customerOrderFiles?.activeCount)} · {mb(stats.customerOrderFiles?.storedBytesEstimate)}</dd></div>
        <div><dt className="text-xs text-ink-text-muted">Ready to delete</dt><dd className="font-semibold">{formatCount(stats.customerOrderFiles?.eligibleForDeletionCount)} · {mb(stats.customerOrderFiles?.eligibleBytesEstimate)}</dd></div>
        <div><dt className="text-xs text-ink-text-muted">Already deleted</dt><dd className="font-semibold">{formatCount(stats.customerOrderFiles?.deletedObjectMarkers)}</dd></div>
        <div><dt className="text-xs text-ink-text-muted">Shop document vault</dt><dd className="font-semibold">{formatCount(stats.merchantVault?.persistentDocumentCount)} · {mb(stats.merchantVault?.storedBytesEstimate)}</dd></div>
      </dl>
    </Card>
  );
};
