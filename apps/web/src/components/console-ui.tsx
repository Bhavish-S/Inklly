import React, { useEffect, useId, useRef, useState } from 'react';
import { SearchIcon } from './icons';

/**
 * Shared building blocks for the platform console (/platform) and the
 * developer portal (/developer): cards, stat tiles, badges, tables, drawers,
 * confirm-with-note dialogs and empty states. Light and dark aware.
 */

// ─── Formatting ───────────────────────────────────────────────────────────

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** Money is always integer paise on the wire. */
export function formatPaise(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || !Number.isFinite(Number(paise))) return '—';
  return inr.format(Number(paise) / 100);
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('en-IN');
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '—';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 0) return formatDateTime(iso);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDateTime(iso);
}

/** "READY_FOR_COLLECTION" → "Ready for collection" */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const text = value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_:.]+/g, ' ').toLowerCase().trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function downloadCsv(fileName: string, header: string[], rows: unknown[][]) {
  const cell = (value: unknown) => {
    const text = String(value ?? '').replace(/[\r\n]+/g, ' ');
    const safe = /^[\s]*[=+@\-\t]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = [header.map(cell).join(','), ...rows.map((row) => row.map(cell).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Layout ───────────────────────────────────────────────────────────────

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

export const Card: React.FC<{ className?: string; children: React.ReactNode; as?: 'section' | 'div' | 'article'; 'aria-labelledby'?: string }> = ({ className, children, as = 'section', ...rest }) => {
  const Tag = as as any;
  return (
    <Tag {...rest} className={cx('rounded-2xl border border-ink-border bg-white shadow-sm dark:border-ink-dark-border dark:bg-ink-dark-surface', className)}>
      {children}
    </Tag>
  );
};

export const CardHeader: React.FC<{ title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; id?: string }> = ({ title, subtitle, actions, id }) => (
  <div className="flex flex-col gap-3 border-b border-ink-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-ink-dark-border">
    <div className="min-w-0">
      <h2 id={id} className="text-[15px] font-bold text-ink-text dark:text-ink-dark-text">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const PageHeader: React.FC<{ title: string; description?: string; actions?: React.ReactNode }> = ({ title, description, actions }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="text-xl font-extrabold tracking-tight text-ink-text sm:text-2xl dark:text-ink-dark-text">{title}</h1>
      {description && <p className="mt-1 max-w-2xl text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-ink-surface-muted text-ink-text-secondary dark:bg-ink-dark-elevated dark:text-ink-dark-text-secondary',
  brand: 'bg-brand-soft text-brand-deep dark:bg-brand-dark-soft dark:text-brand-dark',
  success: 'bg-status-success-bg text-status-success dark:bg-status-dark-success-bg dark:text-status-dark-success',
  warning: 'bg-status-warning-bg text-status-warning dark:bg-status-dark-warning-bg dark:text-status-dark-warning',
  danger: 'bg-status-danger-bg text-status-danger dark:bg-status-dark-danger-bg dark:text-status-dark-danger',
  info: 'bg-status-info-bg text-status-info dark:bg-status-dark-info-bg dark:text-status-dark-info',
};

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; dot?: boolean; className?: string }> = ({ tone = 'neutral', children, dot, className }) => (
  <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', TONE_CLASSES[tone], className)}>
    {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
    {children}
  </span>
);

export function orderStatusTone(status: string): Tone {
  if (status === 'COLLECTED') return 'success';
  if (status === 'READY_FOR_COLLECTION') return 'brand';
  if (status === 'CANCELLED' || status === 'CANCEL_REQUESTED') return 'neutral';
  if (['FAILED_REQUIRES_SUPPORT', 'PRINT_FAILED', 'PRINT_UNCONFIRMED'].includes(status)) return 'danger';
  if (['AWAITING_PAYMENT', 'ON_HOLD'].includes(status)) return 'warning';
  return 'info';
}

export function paymentStatusTone(status: string): Tone {
  if (status === 'VERIFIED') return 'success';
  if (['FAILED', 'REVERSED', 'RECONCILIATION_REQUIRED'].includes(status)) return 'danger';
  if (['PENDING', 'NOT_STARTED', 'REFUND_PENDING'].includes(status)) return 'warning';
  return 'neutral';
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH_ON_COLLECTION: 'Cash at pickup',
  ONLINE_RAZORPAY: 'Online (Razorpay)',
  UPI_DIRECT: 'UPI to shop',
};

export const StatCard: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: Tone; icon?: React.ReactNode; onClick?: () => void }> = ({ label, value, hint, tone = 'neutral', icon, onClick }) => {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-ink-text-secondary dark:text-ink-dark-text-secondary">{label}</span>
        {icon && <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', TONE_CLASSES[tone])}>{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-ink-text tabular-nums dark:text-ink-dark-text">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-text-muted dark:text-ink-dark-text-muted">{hint}</div>}
    </>
  );
  const className = 'rounded-2xl border border-ink-border bg-white p-4 text-left shadow-sm dark:border-ink-dark-border dark:bg-ink-dark-surface';
  return onClick
    ? <button type="button" onClick={onClick} className={cx(className, 'transition hover:border-brand/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand')}>{body}</button>
    : <div className={className}>{body}</div>;
};

export const EmptyState: React.FC<{ title: string; description?: string; icon?: React.ReactNode; action?: React.ReactNode }> = ({ title, description, icon, action }) => (
  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
    {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-surface-muted text-ink-text-muted dark:bg-ink-dark-elevated dark:text-ink-dark-text-muted">{icon}</div>}
    <p className="text-sm font-semibold text-ink-text dark:text-ink-dark-text">{title}</p>
    {description && <p className="mt-1 max-w-sm text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ErrorNotice: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div role="alert" className="flex flex-col gap-2 rounded-xl border border-status-danger/30 bg-status-danger-bg px-4 py-3 text-sm text-status-danger sm:flex-row sm:items-center sm:justify-between dark:bg-status-dark-danger-bg dark:text-status-dark-danger">
    <span>{message}</span>
    {onRetry && <button type="button" onClick={onRetry} className="text-xs font-bold underline">Try again</button>}
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cx('animate-pulse rounded-lg bg-ink-surface-muted dark:bg-ink-dark-elevated', className)} />
);

export const LoadingRows: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
  </div>
);

// ─── Controls ─────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
const BUTTON_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover shadow-sm',
  secondary: 'border border-ink-border-strong bg-white text-ink-text hover:bg-ink-surface-subtle dark:border-ink-dark-border-strong dark:bg-ink-dark-elevated dark:text-ink-dark-text dark:hover:bg-ink-dark-hover',
  danger: 'bg-status-danger text-white hover:opacity-90 shadow-sm',
  ghost: 'text-ink-text-secondary hover:bg-ink-surface-muted hover:text-ink-text dark:text-ink-dark-text-secondary dark:hover:bg-ink-dark-hover dark:hover:text-ink-dark-text',
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md'; busy?: boolean }> = ({ variant = 'secondary', size = 'md', busy, className, children, disabled, type = 'button', ...rest }) => (
  <button
    type={type}
    disabled={disabled || busy}
    className={cx(
      'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
      size === 'sm' ? 'min-h-8 px-3 text-xs' : 'min-h-10 px-4 text-sm',
      BUTTON_CLASSES[variant],
      className,
    )}
    {...rest}
  >
    {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
    {children}
  </button>
);

export const inputClass = 'min-h-10 w-full rounded-xl border border-ink-border-strong bg-white px-3 text-sm text-ink-text placeholder:text-ink-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60 dark:border-ink-dark-border-strong dark:bg-ink-dark-elevated dark:text-ink-dark-text dark:placeholder:text-ink-dark-text-muted';

export const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode; className?: string }> = ({ label, hint, children, className }) => (
  <label className={cx('block', className)}>
    <span className="mb-1 block text-xs font-semibold text-ink-text-secondary dark:text-ink-dark-text-secondary">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-ink-text-muted dark:text-ink-dark-text-muted">{hint}</span>}
  </label>
);

export const SearchInput: React.FC<{ value: string; onChange: (value: string) => void; placeholder: string; className?: string; label?: string }> = ({ value, onChange, placeholder, className, label }) => (
  <div className={cx('relative', className)}>
    <SearchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-text-muted dark:text-ink-dark-text-muted" aria-hidden />
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={label || placeholder}
      className={cx(inputClass, 'pl-9')}
    />
  </div>
);

export const Select: React.FC<{ value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; label: string; className?: string }> = ({ value, onChange, options, label, className }) => (
  <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={cx(inputClass, 'pr-8', className)}>
    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>
);

export const Toggle: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string; disabled?: boolean }> = ({ checked, onChange, label, description, disabled }) => {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold text-ink-text dark:text-ink-dark-text">{label}</label>
        {description && <p className="mt-0.5 text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50', checked ? 'bg-brand' : 'bg-ink-border-strong dark:bg-ink-dark-border-strong')}
      >
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </div>
  );
};

export const Tabs: React.FC<{ value: string; onChange: (value: string) => void; items: Array<{ id: string; label: string; count?: number }>; label: string }> = ({ value, onChange, items, label }) => (
  <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto rounded-xl bg-ink-surface-muted p-1 dark:bg-ink-dark-elevated">
    {items.map((item) => (
      <button
        key={item.id}
        role="tab"
        type="button"
        aria-selected={value === item.id}
        onClick={() => onChange(item.id)}
        className={cx('whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition', value === item.id ? 'bg-white text-ink-text shadow-sm dark:bg-ink-dark-surface dark:text-ink-dark-text' : 'text-ink-text-secondary hover:text-ink-text dark:text-ink-dark-text-secondary dark:hover:text-ink-dark-text')}
      >
        {item.label}{item.count !== undefined && <span className="ml-1 text-ink-text-muted">{item.count}</span>}
      </button>
    ))}
  </div>
);

// ─── Tables & lists ───────────────────────────────────────────────────────

export const Table: React.FC<{ head: React.ReactNode[]; children: React.ReactNode; className?: string }> = ({ head, children, className }) => (
  <div className={cx('overflow-x-auto', className)}>
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-ink-border text-[11px] font-semibold uppercase tracking-wide text-ink-text-muted dark:border-ink-dark-border dark:text-ink-dark-text-muted">
          {head.map((cell, index) => <th key={index} scope="col" className="whitespace-nowrap px-4 py-2.5 first:pl-5 last:pr-5">{cell}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-ink-border dark:divide-ink-dark-border">{children}</tbody>
    </table>
  </div>
);

export const Td: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className, ...rest }) => (
  <td className={cx('px-4 py-3 align-middle text-ink-text first:pl-5 last:pr-5 dark:text-ink-dark-text', className)} {...rest} />
);

export const DetailList: React.FC<{ items: Array<{ label: string; value: React.ReactNode }>; columns?: 1 | 2 }> = ({ items, columns = 2 }) => (
  <dl className={cx('grid gap-x-6 gap-y-3 text-sm', columns === 2 ? 'sm:grid-cols-2' : '')}>
    {items.map((item) => (
      <div key={item.label} className="min-w-0">
        <dt className="text-xs text-ink-text-muted dark:text-ink-dark-text-muted">{item.label}</dt>
        <dd className="mt-0.5 break-words font-medium text-ink-text dark:text-ink-dark-text">{item.value ?? '—'}</dd>
      </div>
    ))}
  </dl>
);

export const Pager: React.FC<{ offset: number; limit: number; total: number; onChange: (offset: number) => void; busy?: boolean }> = ({ offset, limit, total, onChange, busy }) => {
  if (total <= limit && offset === 0) return null;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink-border px-4 py-3 text-xs text-ink-text-secondary sm:px-5 dark:border-ink-dark-border dark:text-ink-dark-text-secondary">
      <span>{formatCount(from)}–{formatCount(to)} of {formatCount(total)}</span>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>Previous</Button>
        <Button size="sm" disabled={busy || offset + limit >= total} onClick={() => onChange(offset + limit)}>Next</Button>
      </div>
    </div>
  );
};

// ─── Overlays ─────────────────────────────────────────────────────────────

function useEscape(onClose: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, active]);
}

/** Right-side drawer on desktop, full-height sheet on phones. */
export const Drawer: React.FC<{ open: boolean; onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }> = ({ open, onClose, title, subtitle, children, footer, wide }) => {
  useEscape(onClose, open);
  const titleId = useId();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button type="button" aria-label="Close panel" onClick={onClose} className="absolute inset-0 bg-navy-3/50 backdrop-blur-[2px]" />
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className={cx('relative flex h-full w-full flex-col bg-ink-app shadow-2xl dark:bg-ink-dark-app', wide ? 'sm:max-w-3xl' : 'sm:max-w-xl')}>
        <header className="flex items-start justify-between gap-3 border-b border-ink-border bg-white px-4 py-4 sm:px-6 dark:border-ink-dark-border dark:bg-ink-dark-surface">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-base font-bold text-ink-text dark:text-ink-dark-text">{title}</h2>
            {subtitle && <div className="mt-0.5 text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-text-muted hover:bg-ink-surface-muted hover:text-ink-text dark:hover:bg-ink-dark-hover dark:hover:text-ink-dark-text">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
        {footer && <footer className="border-t border-ink-border bg-white px-4 py-3 sm:px-6 dark:border-ink-dark-border dark:bg-ink-dark-surface">{footer}</footer>}
      </section>
    </div>
  );
};

export const Modal: React.FC<{ open: boolean; onClose: () => void; title: string; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }> = ({ open, onClose, title, description, children, footer }) => {
  useEscape(onClose, open);
  const titleId = useId();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4" role="presentation">
      <button type="button" aria-label="Close dialog" onClick={onClose} className="absolute inset-0 bg-navy-3/60" />
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl dark:bg-ink-dark-surface">
        <h3 id={titleId} className="text-base font-bold text-ink-text dark:text-ink-dark-text">{title}</h3>
        {description && <div className="mt-1.5 text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary">{description}</div>}
        <div className="mt-4 space-y-3">{children}</div>
        {footer && <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </section>
    </div>
  );
};

/**
 * Confirm a sensitive admin action. The note is required and stored in the
 * audit log on the server.
 */
export const ConfirmWithNote: React.FC<{
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  minLength?: number;
  placeholder?: string;
  extra?: React.ReactNode;
  onCancel: () => void;
  onConfirm: (note: string) => Promise<void>;
}> = ({ open, title, description, confirmLabel, danger, minLength = 5, placeholder, extra, onCancel, onConfirm }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (open) { setNote(''); setError(''); setBusy(false); window.setTimeout(() => textRef.current?.focus(), 0); }
  }, [open]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (note.trim().length < minLength) { setError(`Write at least ${minLength} characters.`); return; }
    setBusy(true);
    setError('');
    try {
      await onConfirm(note.trim());
    } catch (err) {
      setError(errorMessage(err, 'That did not work. Please try again.'));
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={() => { if (!busy) onCancel(); }} title={title} description={description}>
      <form onSubmit={submit} className="space-y-3">
        {extra}
        <Field label="Note for the audit log" hint={`${note.trim().length}/500 · at least ${minLength} characters`}>
          <textarea ref={textRef} rows={3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder={placeholder || 'Why are you doing this?'} className={cx(inputClass, 'py-2 leading-5')} />
        </Field>
        {error && <p role="alert" className="text-xs font-medium text-status-danger dark:text-status-dark-danger">{error}</p>}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} busy={busy}>{confirmLabel}</Button>
        </div>
      </form>
    </Modal>
  );
};

export const Toast: React.FC<{ message: string | null; tone?: 'success' | 'error' }> = ({ message, tone = 'success' }) => {
  if (!message) return null;
  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl bg-navy px-4 py-3 text-sm font-medium text-white shadow-2xl sm:bottom-6">
      <span className={tone === 'error' ? 'text-status-dark-danger' : 'text-status-dark-success'} aria-hidden>{tone === 'error' ? '✕' : '✓'} </span>
      {message}
    </div>
  );
};

export function useToast() {
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = (message: string, tone: 'success' | 'error' = 'success') => {
    window.clearTimeout(timer.current);
    setToast({ message, tone });
    timer.current = window.setTimeout(() => setToast(null), 3800);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { toast, show };
}

/** Debounce a fast-changing value such as a search box. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
