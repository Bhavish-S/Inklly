import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { UsersIcon } from '../../components/icons';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorNotice, LoadingRows, PageHeader, errorMessage, formatDateTime } from '../../components/console-ui';
import { ConsoleContext, PLATFORM_PERMISSION_OPTIONS } from './context';

export const TeamSection: React.FC<{ ctx: ConsoleContext }> = ({ ctx }) => {
  const [admins, setAdmins] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getPlatformAdmins()
      .then((rows: any[]) => {
        if (cancelled) return;
        setAdmins(rows);
        setDrafts(Object.fromEntries(rows.map((admin) => [admin.id, [...admin.permissions].sort()])));
        setError('');
      })
      .catch((err: unknown) => { if (!cancelled) setError(errorMessage(err, 'Could not load the team.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ctx.refreshKey]);

  const toggle = (adminId: string, permission: string) => setDrafts((current) => {
    const set = new Set(current[adminId] || []);
    if (set.has(permission)) set.delete(permission); else set.add(permission);
    return { ...current, [adminId]: [...set].sort() };
  });

  const save = async (adminId: string) => {
    setSaving(adminId);
    try {
      const result = await api.updatePlatformAdminPermissions(adminId, drafts[adminId] || []);
      setAdmins((current) => current.map((admin) => admin.id === adminId ? { ...admin, permissions: result.permissions } : admin));
      setDrafts((current) => ({ ...current, [adminId]: [...result.permissions].sort() }));
      ctx.notify('Permissions saved. They apply immediately.');
    } catch (err) {
      ctx.notify(errorMessage(err, 'Could not save permissions.'), 'error');
    } finally { setSaving(null); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Team" description="Platform admins and what each one can do. Owners always have full access." />
      {error && <ErrorNotice message={error} />}
      <Card>
        <CardHeader title="Platform admins" subtitle="Tick a permission to grant it, then save." />
        {loading ? <LoadingRows rows={3} /> : admins.length === 0 ? (
          <EmptyState icon={<UsersIcon size={22} />} title="No platform admins yet" description="Platform admin accounts are created by the platform owner. Once created they appear here so you can set their permissions." />
        ) : (
          <ul className="divide-y divide-ink-border dark:divide-ink-dark-border">
            {admins.map((admin) => {
              const draft = drafts[admin.id] || [];
              const dirty = JSON.stringify(draft) !== JSON.stringify([...admin.permissions].sort());
              return (
                <li key={admin.id} className="space-y-3 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-deep dark:bg-brand-dark-soft dark:text-brand-dark" aria-hidden>{String(admin.fullName || admin.email || '?').trim().charAt(0).toUpperCase()}</span>
                      <div>
                        <p className="text-sm font-semibold text-ink-text dark:text-ink-dark-text">{admin.fullName}</p>
                        <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{admin.email} · added {formatDateTime(admin.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {admin.isActive ? <Badge tone="success" dot>Active</Badge> : <Badge dot>Inactive</Badge>}
                      <Button size="sm" variant="primary" disabled={!dirty} busy={saving === admin.id} onClick={() => void save(admin.id)}>Save</Button>
                    </div>
                  </div>
                  <fieldset className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <legend className="sr-only">Permissions for {admin.fullName}</legend>
                    {PLATFORM_PERMISSION_OPTIONS.map((option) => (
                      <label key={option.id} className="flex cursor-pointer items-start gap-2 rounded-xl border border-ink-border p-2.5 text-sm hover:bg-ink-surface-subtle dark:border-ink-dark-border dark:hover:bg-ink-dark-hover">
                        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={draft.includes(option.id)} onChange={() => toggle(admin.id, option.id)} />
                        <span>
                          <span className="block font-medium text-ink-text dark:text-ink-dark-text">{option.label}</span>
                          <span className="block text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{option.description}</span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
};
