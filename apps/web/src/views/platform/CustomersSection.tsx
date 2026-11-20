import React, { useEffect, useState } from 'react';
import { ConsoleCustomer, platformAdminApi } from '../../api/platform-admin';
import { UsersIcon } from '../../components/icons';
import {
  Card, EmptyState, ErrorNotice, LoadingRows, PageHeader, Pager, SearchInput, Table, Td,
  errorMessage, formatCount, formatDateTime, formatPaise, formatRelative, useDebounced,
} from '../../components/console-ui';
import { ConsoleContext } from './context';

const PAGE_SIZE = 25;

export const CustomersSection: React.FC<{ ctx: ConsoleContext }> = ({ ctx }) => {
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<ConsoleCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const debounced = useDebounced(search);

  useEffect(() => { setOffset(0); }, [debounced]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    platformAdminApi.customers({ search: debounced, limit: PAGE_SIZE, offset })
      .then((page) => { if (!cancelled) { setRows(page.customers); setTotal(page.total); setError(''); } })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, 'Could not load customers.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced, offset, ctx.refreshKey]);

  const openOrders = (customer: ConsoleCustomer) => ctx.goTo('orders', { search: customer.phoneKey });

  return (
    <div className="space-y-5">
      <PageHeader title="Customers" description="Everyone who has placed an order, grouped by phone number. “Paid” counts only orders with a confirmed payment." />
      <Card>
        <div className="border-b border-ink-border p-4 dark:border-ink-dark-border">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, phone or email" />
        </div>
        {error && <div className="p-4"><ErrorNotice message={error} /></div>}
        {loading && rows.length === 0 ? <LoadingRows /> : rows.length === 0 ? (
          <EmptyState icon={<UsersIcon size={22} />} title={debounced ? 'No customers match' : 'No customers yet'} description={debounced ? 'Try another name or number.' : 'Customers appear after their first order.'} />
        ) : (
          <>
            <ul className="divide-y divide-ink-border md:hidden dark:divide-ink-dark-border">
              {rows.map((customer) => (
                <li key={customer.phoneKey}>
                  <button type="button" onClick={() => openOrders(customer)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink-text dark:text-ink-dark-text">{customer.name || 'Name not given'}</span>
                      <span className="block text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{customer.phone} · {formatCount(customer.orderCount)} orders · {formatRelative(customer.lastOrderAt)}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums">{formatPaise(customer.totalPaidPaise)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <Table className="hidden md:block" head={['Customer', 'Phone', 'Orders', 'Shops', 'Last order', 'Paid total']}>
              {rows.map((customer) => (
                <tr key={customer.phoneKey} onClick={() => openOrders(customer)} className="cursor-pointer transition hover:bg-ink-surface-subtle dark:hover:bg-ink-dark-hover">
                  <Td>
                    <button type="button" onClick={(event) => { event.stopPropagation(); openOrders(customer); }} className="text-left">
                      <span className="block font-medium hover:text-brand">{customer.name || 'Name not given'}</span>
                      {customer.email && <span className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{customer.email}</span>}
                    </button>
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-xs">{customer.phone}</Td>
                  <Td className="tabular-nums">{formatCount(customer.orderCount)}</Td>
                  <Td className="tabular-nums">{formatCount(customer.shopCount)}</Td>
                  <Td className="whitespace-nowrap text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary" title={formatDateTime(customer.lastOrderAt)}>{formatRelative(customer.lastOrderAt)}</Td>
                  <Td className="font-semibold tabular-nums">{formatPaise(customer.totalPaidPaise)}</Td>
                </tr>
              ))}
            </Table>
            <Pager offset={offset} limit={PAGE_SIZE} total={total} onChange={setOffset} busy={loading} />
          </>
        )}
      </Card>
      <p className="text-xs text-ink-text-muted dark:text-ink-dark-text-muted">Select a customer to see their orders. Customer details are personal data; use them only to help with an order.</p>
    </div>
  );
};
