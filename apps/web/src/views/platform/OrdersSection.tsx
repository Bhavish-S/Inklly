import React, { useEffect, useState } from 'react';
import { ConsoleOrder, platformAdminApi } from '../../api/platform-admin';
import { FileTextIcon } from '../../components/icons';
import {
  Badge, Card, EmptyState, ErrorNotice, LoadingRows, PAYMENT_METHOD_LABELS, PageHeader, Pager, SearchInput, Select, Table, Td,
  errorMessage, formatDateTime, formatPaise, formatRelative, humanize, orderStatusTone, paymentStatusTone, useDebounced,
} from '../../components/console-ui';
import { ConsoleContext } from './context';

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'OPEN', label: 'Open (not finished)' },
  { value: 'NEEDS_ATTENTION', label: 'Needs attention' },
  ...['AWAITING_PAYMENT', 'AWAITING_REVIEW', 'READY_FOR_PRINT', 'IN_PROGRESS', 'READY_FOR_COLLECTION', 'COLLECTED', 'ON_HOLD', 'PRINT_FAILED', 'FAILED_REQUIRES_SUPPORT', 'CANCELLED']
    .map((status) => ({ value: status, label: humanize(status) })),
];
const METHOD_OPTIONS = [
  { value: 'ALL', label: 'All payment methods' },
  { value: 'CASH_ON_COLLECTION', label: PAYMENT_METHOD_LABELS.CASH_ON_COLLECTION },
  { value: 'UPI_DIRECT', label: PAYMENT_METHOD_LABELS.UPI_DIRECT },
  { value: 'ONLINE_RAZORPAY', label: PAYMENT_METHOD_LABELS.ONLINE_RAZORPAY },
];
const PAYMENT_STATUS_OPTIONS = [
  { value: 'ALL', label: 'Paid or unpaid' },
  { value: 'VERIFIED', label: 'Paid' },
  { value: 'NOT_STARTED', label: 'Not paid yet' },
  { value: 'PENDING', label: 'Payment pending' },
  { value: 'FAILED', label: 'Payment failed' },
  { value: 'REFUND_PENDING', label: 'Refund pending' },
  { value: 'REFUNDED', label: 'Refunded' },
];

export const OrdersSection: React.FC<{ ctx: ConsoleContext; initialFilter?: Record<string, string>; reloadKey: number }> = ({ ctx, initialFilter, reloadKey }) => {
  const [search, setSearch] = useState(initialFilter?.search || '');
  const [status, setStatus] = useState(initialFilter?.status || 'ALL');
  const [method, setMethod] = useState(initialFilter?.paymentMethod || 'ALL');
  const [paymentStatus, setPaymentStatus] = useState('ALL');
  const [shop, setShop] = useState<{ id: string; name: string } | null>(initialFilter?.shopId ? { id: initialFilter.shopId, name: initialFilter.shopName || 'Selected shop' } : null);
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<ConsoleOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const debouncedSearch = useDebounced(search);

  // A new deep link (for example from an alert) replaces the filters.
  useEffect(() => {
    if (!initialFilter) return;
    setSearch(initialFilter.search || '');
    setStatus(initialFilter.status || 'ALL');
    setMethod(initialFilter.paymentMethod || 'ALL');
    setShop(initialFilter.shopId ? { id: initialFilter.shopId, name: initialFilter.shopName || 'Selected shop' } : null);
  }, [initialFilter]);

  useEffect(() => { setOffset(0); }, [debouncedSearch, status, method, paymentStatus, shop?.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    platformAdminApi.orders({ search: debouncedSearch, status, paymentMethod: method, paymentStatus, shopId: shop?.id, limit: PAGE_SIZE, offset })
      .then((page) => { if (!cancelled) { setRows(page.orders); setTotal(page.total); setError(''); } })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, 'Could not load orders.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedSearch, status, method, paymentStatus, shop?.id, offset, reloadKey, ctx.refreshKey]);

  const filtered = Boolean(debouncedSearch || status !== 'ALL' || method !== 'ALL' || paymentStatus !== 'ALL' || shop);

  return (
    <div className="space-y-5">
      <PageHeader title="Orders" description="Search every order across all shops by token, order number, customer name or phone." />
      <Card>
        <div className="space-y-2 border-b border-ink-border p-4 dark:border-ink-dark-border">
          <SearchInput value={search} onChange={setSearch} placeholder="Token, order number, customer name or phone" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Select label="Order status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
            <Select label="Payment method" value={method} onChange={setMethod} options={METHOD_OPTIONS} />
            <Select label="Payment status" value={paymentStatus} onChange={setPaymentStatus} options={PAYMENT_STATUS_OPTIONS} />
          </div>
          {(shop || filtered) && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              {shop && <Badge tone="brand">Shop: {shop.name} <button type="button" aria-label="Remove shop filter" onClick={() => setShop(null)} className="ml-1 font-bold">×</button></Badge>}
              <span className="text-ink-text-secondary dark:text-ink-dark-text-secondary">{total.toLocaleString('en-IN')} matching</span>
              <button type="button" className="font-semibold text-brand hover:underline dark:text-brand-dark" onClick={() => { setSearch(''); setStatus('ALL'); setMethod('ALL'); setPaymentStatus('ALL'); setShop(null); }}>Clear filters</button>
            </div>
          )}
        </div>
        {error && <div className="p-4"><ErrorNotice message={error} /></div>}
        {loading && rows.length === 0 ? <LoadingRows /> : rows.length === 0 ? (
          <EmptyState icon={<FileTextIcon size={22} />} title={filtered ? 'No orders match' : 'No orders yet'} description={filtered ? 'Try another search or clear the filters.' : 'Orders from every shop will appear here.'} />
        ) : (
          <>
            <ul className="divide-y divide-ink-border md:hidden dark:divide-ink-dark-border">
              {rows.map((order) => (
                <li key={order.id}>
                  <button type="button" onClick={() => ctx.openOrder(order.id)} className="w-full px-4 py-3 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-text dark:text-ink-dark-text">Token {order.tokenNumber || '—'} · {order.customerName || 'Customer'}</p>
                        <p className="truncate text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{order.shopName} · {formatRelative(order.createdAt)}</p>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-ink-text dark:text-ink-dark-text">{formatPaise(order.totalAmountPaise)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone={orderStatusTone(order.status)}>{humanize(order.status)}</Badge>
                      <Badge tone={paymentStatusTone(order.paymentStatus)}>{order.paymentStatus === 'VERIFIED' ? 'Paid' : humanize(order.paymentStatus)}</Badge>
                      <Badge>{PAYMENT_METHOD_LABELS[order.paymentMethod] || humanize(order.paymentMethod)}</Badge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <Table className="hidden md:block" head={['Token', 'Customer', 'Shop', 'Amount', 'Payment', 'Status', 'Placed']}>
              {rows.map((order) => (
                <tr key={order.id} onClick={() => ctx.openOrder(order.id)} className="cursor-pointer transition hover:bg-ink-surface-subtle dark:hover:bg-ink-dark-hover">
                  <Td>
                    <button type="button" onClick={(event) => { event.stopPropagation(); ctx.openOrder(order.id); }} className="text-left">
                      <span className="block text-base font-bold tabular-nums">{order.tokenNumber || '—'}</span>
                      <span className="block font-mono text-[11px] text-ink-text-muted">{order.orderNumber}</span>
                    </button>
                  </Td>
                  <Td><span className="block font-medium">{order.customerName || '—'}</span><span className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{order.customerPhone || ''}</span></Td>
                  <Td className="max-w-[12rem] truncate">{order.shopName}</Td>
                  <Td className="font-semibold tabular-nums">{formatPaise(order.totalAmountPaise)}</Td>
                  <Td>
                    <span className="block text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{PAYMENT_METHOD_LABELS[order.paymentMethod] || humanize(order.paymentMethod)}</span>
                    <Badge tone={paymentStatusTone(order.paymentStatus)}>{order.paymentStatus === 'VERIFIED' ? 'Paid' : humanize(order.paymentStatus)}</Badge>
                  </Td>
                  <Td><Badge tone={orderStatusTone(order.status)}>{humanize(order.status)}</Badge></Td>
                  <Td className="whitespace-nowrap text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary" title={formatDateTime(order.createdAt)}>{formatRelative(order.createdAt)}</Td>
                </tr>
              ))}
            </Table>
            <Pager offset={offset} limit={PAGE_SIZE} total={total} onChange={setOffset} busy={loading} />
          </>
        )}
      </Card>
      {!ctx.can('platform:manage') && <p className="text-xs text-ink-text-muted">You can view orders. Cancelling or marking paid needs the “Manage platform” permission.</p>}
    </div>
  );
};
