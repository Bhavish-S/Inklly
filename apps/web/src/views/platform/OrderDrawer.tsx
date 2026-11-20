import React, { useCallback, useEffect, useState } from 'react';
import { ConsoleOrderDetail, platformAdminApi } from '../../api/platform-admin';
import {
  Badge, Button, Card, ConfirmWithNote, DetailList, Drawer, ErrorNotice, Field, PAYMENT_METHOD_LABELS, Select, Skeleton,
  errorMessage, formatDateTime, formatPaise, humanize, orderStatusTone, paymentStatusTone,
} from '../../components/console-ui';
import { ConsoleContext } from './context';

function describeOptions(options: any): string {
  if (!options || typeof options !== 'object') return '';
  const parts = [
    options.copies ? `${options.copies} cop${Number(options.copies) === 1 ? 'y' : 'ies'}` : null,
    options.colorMode === 'color' ? 'Colour' : options.colorMode === 'mixed' ? `Mixed colour (${options.colorPages || 'some pages'})` : options.colorMode === 'bw' ? 'B/W' : null,
    options.duplexMode && options.duplexMode !== 'simplex' ? 'Both sides' : options.duplexMode === 'simplex' ? 'One side' : null,
    options.paperSize || null,
    options.pageRange ? `Pages ${options.pageRange}` : null,
    options.pagesPerSheet && Number(options.pagesPerSheet) > 1 ? `${options.pagesPerSheet} per sheet` : null,
  ];
  return parts.filter(Boolean).join(' · ');
}

const ACTION_LABELS: Record<string, string> = {
  PLATFORM_ORDER_CANCELLED: 'Cancelled by platform',
  PLATFORM_ORDER_MARKED_PAID: 'Marked paid by platform',
};

export const OrderDrawer: React.FC<{ orderId: string | null; ctx: ConsoleContext; onClose: () => void; onChanged: () => void }> = ({ orderId, ctx, onClose, onChanged }) => {
  const [detail, setDetail] = useState<ConsoleOrderDetail | null>(null);
  const [error, setError] = useState('');
  const [action, setAction] = useState<'cancel' | 'paid' | null>(null);
  const [collectedVia, setCollectedVia] = useState<'CASH' | 'UPI'>('CASH');

  const load = useCallback(async (id: string) => {
    try {
      const next = await platformAdminApi.order(id);
      setDetail(next);
      setCollectedVia(next.order.paymentMethod === 'UPI_DIRECT' ? 'UPI' : 'CASH');
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load this order.'));
    }
  }, []);

  useEffect(() => {
    setDetail(null);
    setError('');
    if (orderId) void load(orderId);
  }, [orderId, load]);

  const o = detail?.order;
  const canManage = ctx.can('platform:manage');
  const canCancel = o && !['COLLECTED', 'CANCELLED', 'IN_PROGRESS'].includes(o.status);
  const canMarkPaid = o && o.paymentStatus !== 'VERIFIED' && !['CANCELLED', 'DRAFT'].includes(o.status) && o.paymentMethod !== 'ONLINE_RAZORPAY';

  const confirm = async (note: string) => {
    if (!o) return;
    if (action === 'cancel') {
      const result = await platformAdminApi.cancelOrder(o.id, note);
      ctx.notify(result.refundRequired ? 'Order cancelled. It was already paid, so arrange the refund with the shop.' : 'Order cancelled.');
    } else if (action === 'paid') {
      await platformAdminApi.markOrderPaid(o.id, note, collectedVia);
      ctx.notify('Order marked paid and recorded in the ledger.');
    }
    setAction(null);
    await load(o.id);
    onChanged();
  };

  return (
    <Drawer
      open={Boolean(orderId)}
      onClose={onClose}
      title={o ? `Token ${o.tokenNumber || '—'}` : 'Order'}
      subtitle={o && <span className="flex flex-wrap items-center gap-1.5"><span className="font-mono">{o.orderNumber}</span><Badge tone={orderStatusTone(o.status)}>{humanize(o.status)}</Badge></span>}
      footer={o && canManage && (canCancel || canMarkPaid) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {canCancel && <Button variant="danger" onClick={() => setAction('cancel')}>Cancel order</Button>}
          {canMarkPaid && <Button variant="primary" onClick={() => setAction('paid')}>Mark paid</Button>}
        </div>
      )}
    >
      {error && <ErrorNotice message={error} onRetry={() => orderId && void load(orderId)} />}
      {!detail && !error && <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-40" /></div>}
      {detail && o && (
        <>
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-ink-text-muted dark:text-ink-dark-text-muted">Total</p>
                <p className="text-2xl font-extrabold tabular-nums text-ink-text dark:text-ink-dark-text">{formatPaise(o.totalAmountPaise)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge tone={paymentStatusTone(o.paymentStatus)}>{o.paymentStatus === 'VERIFIED' ? 'Paid' : humanize(o.paymentStatus)}</Badge>
                <span className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{PAYMENT_METHOD_LABELS[o.paymentMethod] || humanize(o.paymentMethod)}</span>
              </div>
            </div>
            <div className="mt-4 border-t border-ink-border pt-4 dark:border-ink-dark-border">
              <DetailList items={[
                { label: 'Customer', value: o.customerName || '—' },
                { label: 'Phone', value: o.customerPhone ? <a className="text-brand hover:underline dark:text-brand-dark" href={`tel:${o.customerPhone.replace(/\s+/g, '')}`}>{o.customerPhone}</a> : '—' },
                { label: 'Shop', value: <button type="button" className="text-left font-medium text-brand hover:underline dark:text-brand-dark" onClick={() => ctx.openShop(detail.shop.id)}>{detail.shop.name}</button> },
                { label: 'Placed', value: formatDateTime(o.createdAt) },
                { label: 'Channel', value: humanize(o.channel) },
                { label: 'Handed over', value: o.collectedAt ? formatDateTime(o.collectedAt) : 'Not yet' },
              ]} />
              {o.notes && <p className="mt-3 rounded-lg bg-ink-surface-subtle p-2 text-sm text-ink-text dark:bg-ink-dark-elevated dark:text-ink-dark-text">“{o.notes}”</p>}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 text-sm font-bold text-ink-text dark:text-ink-dark-text">Documents ({detail.files.length})</h3>
            {detail.files.length === 0 ? <p className="text-sm text-ink-text-secondary">No documents attached.</p> : (
              <ul className="divide-y divide-ink-border dark:divide-ink-dark-border">
                {detail.files.map((file) => (
                  <li key={file.id} className="flex items-start justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink-text dark:text-ink-dark-text">{file.fileName}</span>
                      <span className="block text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{file.pageCount} page{file.pageCount === 1 ? '' : 's'}{describeOptions(file.printOptions) ? ` · ${describeOptions(file.printOptions)}` : ''}</span>
                      {file.deletedByRetention && <span className="text-[11px] text-ink-text-muted">File deleted after the retention period</span>}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{formatPaise(file.lineSubtotalPaise)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 text-sm font-bold text-ink-text dark:text-ink-dark-text">Payments</h3>
            {detail.payments.length === 0 && !detail.upiClaim ? <p className="text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary">No payment recorded yet.</p> : (
              <ul className="space-y-2">
                {detail.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-2 rounded-xl bg-ink-surface-subtle px-3 py-2 text-sm dark:bg-ink-dark-elevated">
                    <span><span className="block font-medium">{humanize(payment.provider)}</span><span className="block text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{formatDateTime(payment.createdAt)}</span></span>
                    <span className="flex flex-col items-end gap-1"><span className="font-semibold tabular-nums">{formatPaise(payment.amountPaise)}</span><Badge tone={paymentStatusTone(payment.status)}>{humanize(payment.status)}</Badge></span>
                  </li>
                ))}
                {detail.upiClaim && (
                  <li className="rounded-xl border border-dashed border-ink-border-strong px-3 py-2 text-sm dark:border-ink-dark-border-strong">
                    Customer says they paid by UPI{detail.upiClaim.payerApp ? ` (${humanize(detail.upiClaim.payerApp)})` : ''} · {formatDateTime(detail.upiClaim.claimedAt)}
                    {detail.upiClaim.upiReference && <span className="block font-mono text-xs">UTR {detail.upiClaim.upiReference}</span>}
                  </li>
                )}
              </ul>
            )}
          </Card>

          {detail.printJobs.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-bold text-ink-text dark:text-ink-dark-text">Printing</h3>
              <ul className="space-y-1.5 text-sm">
                {detail.printJobs.map((job) => (
                  <li key={job.id} className="flex items-center justify-between gap-2">
                    <span className="text-ink-text-secondary dark:text-ink-dark-text-secondary">{job.printerName || 'Printer not chosen'}</span>
                    <Badge tone={job.status === 'PRINT_CONFIRMED' ? 'success' : /FAIL|UNCERTAIN|UNAVAILABLE/.test(job.status) ? 'danger' : 'info'}>{humanize(job.status)}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {detail.adminActions.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-bold text-ink-text dark:text-ink-dark-text">Platform actions</h3>
              <ul className="space-y-2 text-sm">
                {detail.adminActions.map((entry) => (
                  <li key={entry.id}>
                    <span className="font-medium text-ink-text dark:text-ink-dark-text">{ACTION_LABELS[entry.action] || humanize(entry.action)}</span>
                    <span className="text-ink-text-secondary dark:text-ink-dark-text-secondary"> · {entry.actorName || 'Platform'} · {formatDateTime(entry.createdAt)}</span>
                    {entry.note && <span className="block text-ink-text-secondary dark:text-ink-dark-text-secondary">“{entry.note}”</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {o.paymentMethod === 'ONLINE_RAZORPAY' && o.paymentStatus !== 'VERIFIED' && canManage && (
            <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">Online payments are confirmed by Razorpay, so they cannot be marked paid here.</p>
          )}
        </>
      )}

      <ConfirmWithNote
        open={action !== null}
        onCancel={() => setAction(null)}
        onConfirm={confirm}
        danger={action === 'cancel'}
        title={action === 'cancel' ? 'Cancel this order?' : 'Mark this order paid?'}
        description={action === 'cancel'
          ? (o?.paymentStatus === 'VERIFIED' ? 'This order is already paid. Cancelling does not send money back; the shop must refund the customer.' : 'The shop will not print it and the token is freed.')
          : `Records ${formatPaise(o?.totalAmountPaise)} as received by the shop and adds it to the ledger. Use this only when the shop confirms the money arrived.`}
        extra={action === 'paid' ? (
          <Field label="How was it paid?">
            <Select label="How was it paid?" value={collectedVia} onChange={(value) => setCollectedVia(value as 'CASH' | 'UPI')} options={[{ value: 'CASH', label: 'Cash at the counter' }, { value: 'UPI', label: 'UPI to the shop' }]} />
          </Field>
        ) : undefined}
        placeholder={action === 'cancel' ? 'For example: customer called to cancel' : 'For example: shop owner confirmed cash received'}
        confirmLabel={action === 'cancel' ? 'Cancel order' : 'Mark paid'}
      />
    </Drawer>
  );
};
