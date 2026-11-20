import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { DownloadIcon, IndianRupeeIcon } from '../../components/icons';
import {
  Badge, Button, Card, CardHeader, EmptyState, ErrorNotice, Field, LoadingRows, PageHeader, Select, Table, Tabs, Td,
  downloadCsv, errorMessage, formatCount, formatDateTime, formatPaise, humanize, inputClass,
} from '../../components/console-ui';
import { ConsoleContext } from './context';

const LEDGER_DOMAINS = [
  { value: 'ALL', label: 'All entries' },
  { value: 'CUSTOMER_PRINT_PAYMENT', label: 'Customer payments' },
  { value: 'REFUND_DISPUTE', label: 'Refunds and disputes' },
  { value: 'SAAS_SUBSCRIPTION', label: 'Shop subscriptions' },
  { value: 'MERCHANT_PAYOUT', label: 'Payouts' },
  { value: 'CONVERSION_CREDIT', label: 'Conversion credits' },
  { value: 'REFERRAL_REWARD', label: 'Referral rewards' },
];

export const PaymentsSection: React.FC<{ ctx: ConsoleContext }> = ({ ctx }) => {
  const canLedger = ctx.can('finance:view');
  const canBilling = ctx.can('billing:view');
  const [tab, setTab] = useState<'ledger' | 'billing'>(canLedger ? 'ledger' : 'billing');
  return (
    <div className="space-y-5">
      <PageHeader title="Payments" description="Money recorded on the platform, and how shops are billed for Inklly." />
      {canLedger && canBilling && <Tabs label="Payments views" value={tab} onChange={(value) => setTab(value as 'ledger' | 'billing')} items={[{ id: 'ledger', label: 'Ledger' }, { id: 'billing', label: 'Shop billing' }]} />}
      {tab === 'ledger' && canLedger && <LedgerPanel ctx={ctx} />}
      {tab === 'billing' && canBilling && <BillingPanel ctx={ctx} />}
    </div>
  );
};

const LedgerPanel: React.FC<{ ctx: ConsoleContext }> = ({ ctx }) => {
  const [domain, setDomain] = useState('ALL');
  const [entries, setEntries] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getPlatformLedger(domain === 'ALL' ? undefined : domain)
      .then((page: any) => { if (!cancelled) { setEntries(Array.isArray(page.entries) ? page.entries : []); setCursor(typeof page.nextCursor === 'string' ? page.nextCursor : null); setError(''); } })
      .catch((err: unknown) => { if (!cancelled) setError(errorMessage(err, 'Could not load the ledger.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [domain, ctx.refreshKey]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await api.getPlatformLedger(domain === 'ALL' ? undefined : domain, cursor);
      setEntries((current) => {
        const seen = new Set(current.map((entry) => entry.id));
        return [...current, ...(page.entries || []).filter((entry: any) => !seen.has(entry.id))];
      });
      setCursor(typeof page.nextCursor === 'string' ? page.nextCursor : null);
    } catch (err) {
      ctx.notify(errorMessage(err, 'Could not load more entries.'), 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const all: any[] = [];
      let next: string | undefined;
      do {
        const page = await api.getPlatformLedger(domain === 'ALL' ? undefined : domain, next);
        all.push(...(page.entries || []));
        next = typeof page.nextCursor === 'string' ? page.nextCursor : undefined;
      } while (next);
      downloadCsv(`inklly-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Entry ID', 'Type', 'Description', 'Provider', 'Amount (paise)', 'Currency', 'Shop ID', 'Order ID', 'Created at'],
        all.map((entry) => [entry.id, entry.domain, entry.description, entry.provider, entry.amount_paise, entry.currency, entry.shop_id, entry.order_id, entry.created_at]));
      ctx.notify(`Exported ${all.length} ledger entries.`);
    } catch (err) {
      ctx.notify(errorMessage(err, 'Could not export the ledger.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const pageTotal = entries.reduce((sum, entry) => sum + Number(entry.amount_paise || 0), 0);

  return (
    <Card>
      <CardHeader
        title="Ledger"
        subtitle="Append-only record of every amount, in rupees. Entries are never edited."
        actions={<>
          <Select className="w-48" label="Entry type" value={domain} onChange={setDomain} options={LEDGER_DOMAINS} />
          <Button size="sm" onClick={() => void exportAll()} busy={exporting}><DownloadIcon size={14} />Export</Button>
        </>}
      />
      {error && <div className="p-4"><ErrorNotice message={error} /></div>}
      {loading ? <LoadingRows /> : entries.length === 0 ? (
        <EmptyState icon={<IndianRupeeIcon size={22} />} title="No ledger entries" description="Entries are added when a payment is confirmed, refunded or billed." />
      ) : (
        <>
          <Table head={['When', 'Description', 'Type', 'Method', 'Amount']}>
            {entries.map((entry) => (
              <tr key={entry.id} className={entry.order_id ? 'cursor-pointer hover:bg-ink-surface-subtle dark:hover:bg-ink-dark-hover' : ''} onClick={() => entry.order_id && ctx.openOrder(entry.order_id)}>
                <Td className="whitespace-nowrap text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{formatDateTime(entry.created_at)}</Td>
                <Td className="min-w-[14rem]">{entry.description}</Td>
                <Td><Badge>{LEDGER_DOMAINS.find((option) => option.value === entry.domain)?.label || humanize(entry.domain)}</Badge></Td>
                <Td className="whitespace-nowrap text-xs">{humanize(entry.provider)}</Td>
                <Td className={`whitespace-nowrap text-right font-semibold tabular-nums ${Number(entry.amount_paise) < 0 ? 'text-status-danger dark:text-status-dark-danger' : ''}`}>{formatPaise(Number(entry.amount_paise))}</Td>
              </tr>
            ))}
          </Table>
          <div className="flex flex-col gap-2 border-t border-ink-border px-5 py-3 text-xs text-ink-text-secondary sm:flex-row sm:items-center sm:justify-between dark:border-ink-dark-border dark:text-ink-dark-text-secondary">
            <span>{formatCount(entries.length)} entries shown · {formatPaise(pageTotal)} total</span>
            {cursor && <Button size="sm" onClick={() => void loadMore()} busy={loadingMore}>Load older entries</Button>}
          </div>
        </>
      )}
    </Card>
  );
};

const parseRupees = (value: string): number | null => {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const paise = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  return Number.isSafeInteger(paise) ? paise : null;
};

const BillingPanel: React.FC<{ ctx: ConsoleContext }> = ({ ctx }) => {
  const canManage = ctx.can('billing:manage');
  const [plans, setPlans] = useState<any[]>([]);
  const [summary, setSummary] = useState<Array<{ planTier: string; status: string; count: number }>>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [orgId, setOrgId] = useState('');
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [base, setBase] = useState('');
  const [perSide, setPerSide] = useState('');
  const [included, setIncluded] = useState('0');
  const [effectiveMonth, setEffectiveMonth] = useState(() => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString().slice(0, 7));
  const [invoiceMonth, setInvoiceMonth] = useState(() => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)).toISOString().slice(0, 7));

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getPlatformPlans().catch(() => []),
      api.getSubscriptionSummary().catch(() => []),
      ctx.can('platform:view') ? api.getAllPlatformMerchants().catch(() => []) : Promise.resolve([]),
    ]).then(([planRows, summaryRows, orgRows]) => {
      if (cancelled) return;
      setPlans(Array.isArray(planRows) ? planRows : []);
      setSummary(Array.isArray(summaryRows) ? summaryRows : []);
      setOrgs(Array.isArray(orgRows) ? orgRows : []);
      if (Array.isArray(orgRows) && orgRows.length) setOrgId((current) => current || orgRows[0].id);
    });
    return () => { cancelled = true; };
  }, [ctx.refreshKey]);

  const refreshOrg = async (id: string) => {
    const [tariffRows, invoiceRows] = await Promise.all([api.getPlatformBillingTariffs(id), api.getPlatformBillingInvoices(id)]);
    setTariffs(Array.isArray(tariffRows) ? tariffRows : []);
    setInvoices(Array.isArray(invoiceRows) ? invoiceRows : []);
  };

  useEffect(() => {
    if (!orgId) return;
    setError('');
    refreshOrg(orgId).catch((err) => setError(errorMessage(err, 'Could not load billing for this organisation.')));
  }, [orgId]);

  const saveTariff = async (event: React.FormEvent) => {
    event.preventDefault();
    const monthlyBasePaise = parseRupees(base);
    const perSidePaise = parseRupees(perSide);
    const includedSides = Number(included);
    if (monthlyBasePaise === null || perSidePaise === null || !Number.isSafeInteger(includedSides) || includedSides < 0) {
      ctx.notify('Enter rupee amounts with up to two decimals and a whole number of included sides.', 'error');
      return;
    }
    setBusy(true);
    try {
      await api.addPlatformBillingTariff(orgId, { monthlyBasePaise, perSidePaise, includedSides, effectiveFrom: `${effectiveMonth}-01` });
      setBase(''); setPerSide('');
      ctx.notify('Billing rate saved.');
      await refreshOrg(orgId);
    } catch (err) {
      ctx.notify(errorMessage(err, 'Could not save the rate.'), 'error');
    } finally { setBusy(false); }
  };

  const issueInvoice = async () => {
    setBusy(true);
    try {
      const result = await api.issuePlatformBillingInvoice({ organizationId: orgId, period: invoiceMonth });
      ctx.notify(result.created ? 'Invoice issued. Collect payment separately.' : 'That invoice already exists.');
      await refreshOrg(orgId);
    } catch (err) {
      ctx.notify(errorMessage(err, 'Could not issue the invoice.'), 'error');
    } finally { setBusy(false); }
  };

  const activeCount = (tier: string) => summary.filter((row) => row.planTier === tier && ['ACTIVE', 'TRIALING', 'GRACE'].includes(row.status)).reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Plans" subtitle="Plan limits are shown for reference. Pilot prices are set per organisation below." />
        {plans.length === 0 ? <EmptyState title="Plan catalogue unavailable" /> : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-xl border border-ink-border p-4 dark:border-ink-dark-border">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-ink-text dark:text-ink-dark-text">{plan.name}</p>
                  <Badge tone="brand">{activeCount(plan.tier)} on plan</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><dt className="text-ink-text-muted">Orders / month</dt><dd className="font-semibold">{formatCount(plan.orderLimitMonthly)}</dd></div>
                  <div><dt className="text-ink-text-muted">Printers</dt><dd className="font-semibold">{plan.printerLimit}</dd></div>
                  <div><dt className="text-ink-text-muted">Max file</dt><dd className="font-semibold">{plan.fileSizeMaxMB} MB</dd></div>
                  <div><dt className="text-ink-text-muted">Credits</dt><dd className="font-semibold">{formatCount(plan.includedConversionCredits)}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Pilot billing"
          subtitle="Monthly base fee plus a fee per printed side. Invoices are statements only; no money is collected here."
          actions={<Select className="w-64" label="Organisation" value={orgId} onChange={setOrgId} options={orgs.length ? orgs.map((org) => ({ value: org.id, label: org.name })) : [{ value: '', label: 'No organisations' }]} />}
        />
        {error && <div className="p-4"><ErrorNotice message={error} /></div>}
        {!orgId ? <EmptyState title="No organisations yet" description="Add a shop first." /> : (
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-ink-text dark:text-ink-dark-text">Rates</h3>
              {tariffs.length === 0 ? <p className="text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary">No rate set for this organisation.</p> : (
                <ul className="space-y-1.5 text-sm">
                  {tariffs.map((tariff) => (
                    <li key={tariff.id} className="rounded-lg bg-ink-surface-subtle px-3 py-2 dark:bg-ink-dark-elevated">
                      From {String(tariff.effectiveFrom).slice(0, 7)}: {formatPaise(tariff.monthlyBasePaise)}/month + {formatPaise(tariff.perSidePaise)}/side · {formatCount(tariff.includedSides)} sides included
                    </li>
                  ))}
                </ul>
              )}
              {canManage && (
                <form onSubmit={saveTariff} className="grid grid-cols-2 gap-3 rounded-xl border border-ink-border p-3 dark:border-ink-dark-border">
                  <Field label="Monthly base (₹)"><input required inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} placeholder="0.00" className={inputClass} /></Field>
                  <Field label="Per printed side (₹)"><input required inputMode="decimal" value={perSide} onChange={(e) => setPerSide(e.target.value)} placeholder="0.00" className={inputClass} /></Field>
                  <Field label="Included sides"><input required type="number" min={0} step={1} value={included} onChange={(e) => setIncluded(e.target.value)} className={inputClass} /></Field>
                  <Field label="Starts in"><input required type="month" value={effectiveMonth} onChange={(e) => setEffectiveMonth(e.target.value)} className={inputClass} /></Field>
                  <div className="col-span-2 flex justify-end"><Button type="submit" size="sm" variant="primary" busy={busy}>Add rate</Button></div>
                </form>
              )}
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-ink-text dark:text-ink-dark-text">Invoices</h3>
              {canManage && (
                <div className="flex items-end gap-2">
                  <Field label="Month" className="flex-1"><input type="month" value={invoiceMonth} onChange={(e) => setInvoiceMonth(e.target.value)} className={inputClass} /></Field>
                  <Button variant="primary" onClick={() => void issueInvoice()} busy={busy} disabled={!tariffs.length}>Issue invoice</Button>
                </div>
              )}
              {invoices.length === 0 ? <p className="text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary">No invoices issued.</p> : (
                <ul className="divide-y divide-ink-border text-sm dark:divide-ink-dark-border">
                  {invoices.map((invoice) => (
                    <li key={invoice.id} className="flex items-center justify-between gap-2 py-2">
                      <span>{new Date(invoice.periodStart).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })} · {formatCount(invoice.confirmedSides)} sides · {humanize(invoice.collectionStatus)}</span>
                      <span className="font-semibold tabular-nums">{formatPaise(invoice.totalPaise)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
