import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { MonitorIcon } from '../../components/icons';
import {
  Badge, Button, Card, EmptyState, ErrorNotice, LoadingRows, PageHeader, SearchInput, StatCard, Table, Tabs, Td,
  errorMessage, formatCount, formatDateTime, formatRelative, humanize,
} from '../../components/console-ui';
import { ConsoleContext } from './context';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral' | 'danger'> = { ONLINE: 'success', STALE: 'warning', REVOKED: 'neutral', UNKNOWN: 'danger' };
const STATUS_LABEL: Record<string, string> = { ONLINE: 'Online', STALE: 'Offline', REVOKED: 'Unpaired', UNKNOWN: 'Never connected' };

export const AgentsSection: React.FC<{ ctx: ConsoleContext }> = ({ ctx }) => {
  const [agents, setAgents] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const page = await api.getPlatformAgents(100);
      setAgents(page.agents);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setUpdatedAt(new Date().toISOString());
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load print agents.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load, ctx.refreshKey]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await api.getPlatformAgents(100, cursor);
      setAgents((current) => {
        const seen = new Set(current.map((agent) => agent.agentId));
        return [...current, ...page.agents.filter((agent: any) => !seen.has(agent.agentId))];
      });
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err) {
      ctx.notify(errorMessage(err, 'Could not load more agents.'), 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const counts = useMemo(() => {
    const result: Record<string, number> = { ALL: agents.length, ONLINE: 0, STALE: 0, REVOKED: 0, UNKNOWN: 0 };
    for (const agent of agents) result[agent.status] = (result[agent.status] || 0) + 1;
    return result;
  }, [agents]);
  const printersOnline = agents.reduce((sum, agent) => sum + Number(agent.onlinePrinters || 0), 0);
  const pending = agents.reduce((sum, agent) => sum + Number(agent.pendingCommands || 0), 0);

  const term = search.trim().toLowerCase();
  const visible = agents.filter((agent) => (filter === 'ALL' || agent.status === filter)
    && (!term || [agent.shopName, agent.shopCode, agent.hostname].some((value) => String(value || '').toLowerCase().includes(term))));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Printers and agents"
        description="Each shop runs the Inklly print agent on its counter computer. An agent is online when it checked in within the last 45 seconds."
        actions={updatedAt && <span className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">Updated {formatRelative(updatedAt)}</span>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Agents online" value={formatCount(counts.ONLINE)} hint={`of ${formatCount(counts.ALL - counts.REVOKED)} paired`} tone="success" />
        <StatCard label="Agents offline" value={formatCount(counts.STALE + counts.UNKNOWN)} hint="Not checking in" tone={counts.STALE + counts.UNKNOWN ? 'warning' : 'neutral'} />
        <StatCard label="Printers online" value={formatCount(printersOnline)} hint="Reported by online agents" tone="info" />
        <StatCard label="Jobs waiting" value={formatCount(pending)} hint="Sent to an agent, not yet confirmed" tone={pending ? 'warning' : 'neutral'} />
      </div>
      {error && <ErrorNotice message={error} onRetry={() => void load()} />}
      <Card>
        <div className="flex flex-col gap-2 border-b border-ink-border p-4 lg:flex-row lg:items-center lg:justify-between dark:border-ink-dark-border">
          <Tabs label="Agent status" value={filter} onChange={setFilter} items={[
            { id: 'ALL', label: 'All', count: counts.ALL },
            { id: 'ONLINE', label: 'Online', count: counts.ONLINE },
            { id: 'STALE', label: 'Offline', count: counts.STALE },
            { id: 'UNKNOWN', label: 'Never connected', count: counts.UNKNOWN },
            { id: 'REVOKED', label: 'Unpaired', count: counts.REVOKED },
          ]} />
          <SearchInput className="lg:w-72" value={search} onChange={setSearch} placeholder="Search shop or computer" />
        </div>
        {loading ? <LoadingRows /> : visible.length === 0 ? (
          <EmptyState icon={<MonitorIcon size={22} />} title={agents.length ? 'No agents match' : 'No print agents paired yet'} description={agents.length ? 'Try another filter.' : 'Shops pair the agent from Settings → Printers in their app.'} />
        ) : (
          <Table head={['Shop', 'Computer', 'Status', 'Last check-in', 'Printers online', 'Jobs waiting']}>
            {visible.map((agent) => (
              <tr key={agent.agentId} onClick={() => agent.shopId && ctx.openShop(agent.shopId)} className="cursor-pointer hover:bg-ink-surface-subtle dark:hover:bg-ink-dark-hover">
                <Td><span className="block font-medium">{agent.shopName || 'Unknown shop'}</span><span className="font-mono text-xs text-ink-text-muted">{agent.shopCode || agent.shopId}</span></Td>
                <Td><span className="block">{agent.hostname || 'Unnamed'}</span><span className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">{[agent.osPlatform && humanize(agent.osPlatform), agent.agentVersion && `v${agent.agentVersion}`].filter(Boolean).join(' · ') || '—'}</span></Td>
                <Td><Badge tone={STATUS_TONE[agent.status] || 'neutral'} dot>{STATUS_LABEL[agent.status] || humanize(agent.status)}</Badge></Td>
                <Td className="whitespace-nowrap text-xs" title={formatDateTime(agent.lastHeartbeat)}>{formatRelative(agent.lastHeartbeat)}</Td>
                <Td className="tabular-nums">{formatCount(agent.onlinePrinters)}{agent.status !== 'ONLINE' && agent.reportedOnlinePrinters > 0 && <span className="ml-1 text-xs text-ink-text-muted">({agent.reportedOnlinePrinters} last seen)</span>}</Td>
                <Td className="tabular-nums">{formatCount(agent.pendingCommands)}</Td>
              </tr>
            ))}
          </Table>
        )}
        {hasMore && <div className="border-t border-ink-border px-5 py-3 text-right dark:border-ink-dark-border"><Button size="sm" onClick={() => void loadMore()} busy={loadingMore}>Load older agents</Button></div>}
      </Card>
    </div>
  );
};
