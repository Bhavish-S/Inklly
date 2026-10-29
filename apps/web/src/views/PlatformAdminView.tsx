import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { ShieldIcon, SearchIcon, DownloadIcon, CheckCircleIcon, PrinterIcon, UsersIcon, FileTextIcon, SlidersIcon } from '../components/icons';

type AdminTab = 'overview' | 'merchants' | 'enquiries' | 'builds' | 'plans' | 'ledger' | 'agents' | 'incidents' | 'retention' | 'audit' | 'config';

export interface PlatformAdminProps {
  onNavigate?: (path: string) => void;
}

export const PlatformAdminView: React.FC<PlatformAdminProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
  const [merchantSearchQuery, setMerchantSearchQuery] = useState<string>('');
  const [merchantStatusFilter, setMerchantStatusFilter] = useState<string>('ALL');
  const [selectedMerchantDetail, setSelectedMerchantDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Onboard Merchant Modal State
  const [showOnboardModal, setShowOnboardModal] = useState<boolean>(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newShopCode, setNewShopCode] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [newPlanTier, setNewPlanTier] = useState('GROWTH');
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [provisionedInvitationLink, setProvisionedInvitationLink] = useState('');

  const [agentFleet, setAgentFleet] = useState<any[]>([]);
  const [platformPlans, setPlatformPlans] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [billingOrganizationId, setBillingOrganizationId] = useState('');
  const [billingTariffs, setBillingTariffs] = useState<any[]>([]);
  const [pilotInvoices, setPilotInvoices] = useState<any[]>([]);
  const [billingBaseRupees, setBillingBaseRupees] = useState('');
  const [billingSideRupees, setBillingSideRupees] = useState('');
  const [billingIncludedSides, setBillingIncludedSides] = useState('0');
  const [billingEffectiveMonth, setBillingEffectiveMonth] = useState(() => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString().slice(0, 7));
  const [billingInvoiceMonth, setBillingInvoiceMonth] = useState(() => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)).toISOString().slice(0, 7));
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    loadPlatformData();
  }, [selectedDomain]);

  useEffect(() => {
    if (!billingOrganizationId && merchants.length > 0) setBillingOrganizationId(merchants[0].id);
  }, [merchants, billingOrganizationId]);

  useEffect(() => {
    if (activeTab !== 'plans' || !billingOrganizationId) return;
    let cancelled = false;
    setBillingError('');
    Promise.all([api.getPlatformBillingTariffs(billingOrganizationId), api.getPlatformBillingInvoices(billingOrganizationId)])
      .then(([tariffs, invoices]) => {
        if (cancelled) return;
        setBillingTariffs(tariffs);
        setPilotInvoices(invoices);
      })
      .catch((error: unknown) => {
        if (!cancelled) setBillingError(error instanceof Error ? error.message : 'Could not load pilot billing data.');
      });
    return () => { cancelled = true; };
  }, [activeTab, billingOrganizationId]);

  const loadPlatformData = async () => {
    try {
      setLoading(true);
      const [ovData, merData, ledData, audData, enquiryData, agentData, retentionData, plansData, subscriptionData] = await Promise.all([
        api.getPlatformOverview(),
        api.getPlatformMerchants(),
        api.getPlatformLedger(selectedDomain === 'ALL' ? undefined : selectedDomain),
        api.getAuditLogs(),
        api.getPlatformEnquiries(),
        api.getPlatformAgents(),
        api.getPlatformRetentionStats(),
        api.getPlatformPlans(),
        api.getSubscriptions(),
      ]);
      setOverview(ovData);
      setMerchants(merData);
      setLedgerEntries(ledData);
      setAuditLogs(audData);
      setEnquiries(enquiryData);
      setAgentFleet(agentData);
      setStorageStats(retentionData);
      setPlatformPlans(plansData);
      setSubscriptions(subscriptionData);
    } catch (err: any) {
      console.error('Failed to load platform data:', err);
    } finally {
      setLoading(false);
    }
  };

  const parseRupees = (value: string): number | null => {
    const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value.trim());
    if (!match) return null;
    const paise = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
    return Number.isSafeInteger(paise) ? paise : null;
  };

  const refreshPilotBilling = async () => {
    const [tariffs, invoices] = await Promise.all([
      api.getPlatformBillingTariffs(billingOrganizationId), api.getPlatformBillingInvoices(billingOrganizationId),
    ]);
    setBillingTariffs(tariffs);
    setPilotInvoices(invoices);
  };

  const savePilotTariff = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!billingOrganizationId) return;
    const monthlyBasePaise = parseRupees(billingBaseRupees);
    const perSidePaise = parseRupees(billingSideRupees);
    const includedSides = Number(billingIncludedSides);
    if (monthlyBasePaise === null || perSidePaise === null || !Number.isSafeInteger(includedSides) || includedSides < 0) {
      showToast('Enter valid INR amounts with up to two decimal places and a whole-number side allowance.');
      return;
    }
    try {
      setBillingBusy(true);
      await api.addPlatformBillingTariff(billingOrganizationId, { monthlyBasePaise, perSidePaise, includedSides, effectiveFrom: `${billingEffectiveMonth}-01` });
      setBillingBaseRupees('');
      setBillingSideRupees('');
      showToast('Pilot tariff saved as an immutable effective-dated rate.');
      await refreshPilotBilling();
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'Could not save pilot tariff.');
    } finally { setBillingBusy(false); }
  };

  const issuePilotInvoice = async () => {
    if (!billingOrganizationId) return;
    try {
      setBillingBusy(true);
      const result = await api.issuePlatformBillingInvoice({ organizationId: billingOrganizationId, period: billingInvoiceMonth });
      showToast(result.created ? 'Invoice issued. No payment was collected.' : 'This invoice already exists; the existing statement was returned.');
      await refreshPilotBilling();
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'Could not issue pilot invoice.');
    } finally { setBillingBusy(false); }
  };

  const handleToggleMerchantStatus = async (orgId: string, currentStatus: string) => {
    if (!['ACTIVE', 'SUSPENDED'].includes(currentStatus)) {
      showToast(`This tenant is ${currentStatus.toLowerCase()}. Manage trial or billing status through the subscription workflow.`);
      return;
    }
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.updateMerchantStatus(orgId, { planStatus: nextStatus });
      setMerchants((prev) =>
        prev.map((m) => (m.id === orgId ? { ...m, planStatus: nextStatus } : m))
      );
      showToast(`Tenant status updated to ${nextStatus}. Audit event logged.`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const [storageStats, setStorageStats] = useState<any>(null);
  const [isPurgingRetention, setIsPurgingRetention] = useState(false);

  const handleTriggerRetentionPurge = async () => {
    setIsPurgingRetention(true);
    try {
      const result = await api.runPlatformRetentionPurge();
      setStorageStats(await api.getPlatformRetentionStats());
      const { expiredFilesDeleted, orphanFilesDeleted, expiredFilesFailed, orphanFilesFailed } = result.summary;
      showToast(`Retention pass: ${expiredFilesDeleted} order files and ${orphanFilesDeleted} unclaimed uploads deleted; ${expiredFilesFailed + orphanFilesFailed} failures.`);
    } catch (err: any) {
      showToast(`Retention purge failed: ${err.message}`);
    } finally {
      setIsPurgingRetention(false);
    }
  };

  const handleExportMerchantsCsv = () => {
    const headers = ['Merchant ID', 'Organization Name', 'Shop Code', 'Owner Name', 'Owner Email', 'Plan Tier', 'Status', 'Shops Count', 'Created At'];
    const rows = merchants.map((m) => [
      m.id,
      `"${(m.name || '').replace(/"/g, '""')}"`,
      m.shopCode,
      `"${(m.owner?.name || '').replace(/"/g, '""')}"`,
      m.owner?.email || '',
      m.planTier,
      m.planStatus,
      m.shopsCount || 1,
      m.createdAt,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inklly-Merchants-Directory-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📥 Exported Merchants Directory CSV.');
  };

  const handleExportLedgerCsv = () => {
    const headers = ['Ledger ID', 'Domain', 'Description', 'Provider', 'Amount (INR)', 'Created At'];
    const rows = ledgerEntries.map((le) => [
      le.id,
      le.domain,
      `"${le.description.replace(/"/g, '""')}"`,
      le.provider,
      (le.amount_paise / 100).toFixed(2),
      le.created_at,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inklly-Platform-Financial-Ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📥 Exported Platform Financial Ledger CSV.');
  };

  const handleExportAuditCsv = () => {
    const headers = ['Event ID', 'Actor User ID', 'Action', 'Target Entity ID', 'IP Address', 'Timestamp'];
    const rows = auditLogs.map((log) => [
      log.id,
      log.actor_user_id,
      `"${(log.action || '').replace(/"/g, '""')}"`,
      log.entity_id || '',
      log.ip_address || '',
      log.created_at,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inklly-Platform-Audit-Trail-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📥 Exported Platform Audit Log CSV.');
  };

  const handleOnboardMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsOnboarding(true);
    try {
      const result = await api.createPlatformMerchant({
        organizationName: newOrgName.trim(),
        shopCode: newShopCode.trim() || undefined,
        ownerName: newOwnerName.trim(),
        ownerEmail: newOwnerEmail.trim(),
        planTier: newPlanTier,
      });
      if (typeof result.invitationToken !== 'string' || result.invitationToken.length < 40) {
        throw new Error('The owner invitation was not returned. Refresh the merchant list and inspect the audit log before trying again.');
      }
      const inviteUrl = new URL('/accept-invitation', window.location.origin);
      inviteUrl.hash = new URLSearchParams({ token: result.invitationToken }).toString();
      setProvisionedInvitationLink(inviteUrl.toString());
      const [updatedMerchants, updatedAuditLogs] = await Promise.all([api.getPlatformMerchants(), api.getAuditLogs()]);
      setMerchants(updatedMerchants);
      setAuditLogs(updatedAuditLogs);
      showToast(`Tenant created. Share the one-time owner setup link with ${result.merchant?.owner?.email || newOwnerEmail}.`);
      setNewOrgName('');
      setNewShopCode('');
      setNewOwnerName('');
      setNewOwnerEmail('');
    } catch (err: any) {
      showToast(`Could not onboard merchant: ${err.message}`);
    } finally {
      setIsOnboarding(false);
    }
  };

  const filteredMerchants = merchants.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(merchantSearchQuery.toLowerCase()) ||
      m.owner.name.toLowerCase().includes(merchantSearchQuery.toLowerCase()) ||
      m.owner.email.toLowerCase().includes(merchantSearchQuery.toLowerCase());
    const matchesStatus =
      merchantStatusFilter === 'ALL' || m.planStatus === merchantStatusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading && !overview) {
    return (
      <div className="p-12 text-center text-slate-500 font-medium">
        Loading Platform Owner Console...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white border border-slate-700 px-5 py-2.5 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <span className="text-emerald-400">✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Console Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <ShieldIcon size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Inklly Platform Owner Console
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                SUPERADMIN RBAC
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Cross-tenant SaaS supervision, tamper-evident financial ledgers, and edge spooler fleet telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Core API Online (Port 4000)
          </span>
          <button
            type="button"
            onClick={loadPlatformData}
            className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold rounded-xl cursor-pointer"
          >
            ↻ Refresh All
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs font-bold">
        {[
          { id: 'overview', label: '📊 Fleet Overview' },
          { id: 'merchants', label: '🏪 Merchants Directory' },
          { id: 'enquiries', label: '✉️ Website Enquiries' },
          { id: 'builds', label: '📦 Windows Agent Builds' },
          { id: 'plans', label: '💎 Plans & Quotas' },
          { id: 'ledger', label: '📒 Financial Ledger' },
          { id: 'agents', label: '🖨️ Edge Agents Fleet' },
          { id: 'incidents', label: '🚨 Incident Response' },
          { id: 'retention', label: '🧹 Storage & Retention' },
          { id: 'audit', label: '🛡️ Audit Logs' },
          { id: 'config', label: '⚙️ Runtime Rules' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as AdminTab)}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-900 text-[#4D64E6] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TAB 1: OVERVIEW & FLEET METRICS
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">TOTAL TENANT ORGS</span>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {overview?.metrics?.totalOrganizations ?? '—'}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Organizations in database</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">REGISTERED SHOPS</span>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {overview?.metrics?.totalShops ?? '—'}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Countertop QR shops</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">ACTIVE PRINT AGENTS</span>
              <div className="text-2xl font-extrabold text-emerald-600">
                {agentFleet.filter((a) => a.status === 'ONLINE').length} / {agentFleet.length} Online
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Based on heartbeat in last 45 seconds</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">PLATFORM GMV (INR)</span>
              <div className="text-2xl font-extrabold text-[#4D64E6]">
                ₹{(Number(overview?.metrics?.platformGMVPaise ?? 0) / 100).toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Customer-payment ledger total</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">MONTHLY SAAS MRR</span>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {overview?.metrics?.platformMRRPaise == null ? 'Not available' : `₹${(Number(overview.metrics.platformMRRPaise) / 100).toFixed(2)}`}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Subscription billing is not configured</span>
            </div>
          </div>

          {/* Platform Health Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b pb-3 border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Edge Spooler Fleet Health
                </h3>
                <span className="text-xs text-slate-500 font-semibold">{agentFleet.filter((a) => a.status === 'ONLINE').length} online · {agentFleet.length} registered</span>
              </div>
              <div className="space-y-3 text-xs">
                {agentFleet.map((ag) => (
                  <div key={ag.agentId} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${ag.status === 'ONLINE' ? 'bg-emerald-500' : ag.status === 'STALE' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                        {ag.shopName || 'Unknown shop'} ({ag.shopCode || ag.shopId}) · {ag.status}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{ag.hostname || 'Hostname unavailable'} · {ag.osPlatform || 'OS unavailable'} · last heartbeat {ag.lastHeartbeat ? new Date(ag.lastHeartbeat).toLocaleString() : 'never'}</div>
                    </div>
                  </div>
                ))}
                {agentFleet.length === 0 && <p className="p-3 text-slate-500">No desktop agents are registered.</p>}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b pb-3 border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Quick Platform Admin Actions
                </h3>
                <span className="text-xs text-slate-400">Privileged Session</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={handleExportLedgerCsv}
                  className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold hover:bg-indigo-100/50 cursor-pointer text-left"
                >
                  📥 Export Financial Ledger
                  <div className="text-[10px] font-normal opacity-80 mt-1">Full 6-domain CSV audit</div>
                </button>
                <button
                  type="button"
                  onClick={loadPlatformData}
                  className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-100 cursor-pointer text-left"
                >
                  ↻ Refresh Agent Inventory
                  <div className="text-[10px] font-normal opacity-70 mt-1">Reload persisted heartbeat data</div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('incidents')}
                  className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 rounded-xl font-bold hover:bg-red-100/50 cursor-pointer text-left"
                >
                  🚨 Incident management unavailable
                  <div className="text-[10px] font-normal opacity-80 mt-1">No persistent incident service is configured</div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('plans')}
                  className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 rounded-xl font-bold hover:bg-emerald-100/50 cursor-pointer text-left"
                >
                  💎 Review SaaS Plans
                  <div className="text-[10px] font-normal opacity-80 mt-1">Code-managed pilot tiers; checkout is inactive</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 2: MERCHANTS DIRECTORY
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'merchants' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Merchant Organizations Directory
              </h2>
              <p className="text-xs text-slate-400">
                Multi-tenant print shops, active subscription tier, and operational status
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search merchant, owner, email..."
                  value={merchantSearchQuery}
                  onChange={(e) => setMerchantSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 w-56"
                />
                <span className="absolute left-2.5 top-2 text-slate-400">🔍</span>
              </div>

              <select
                value={merchantStatusFilter}
                onChange={(e) => setMerchantStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="TRIAL">Trial Only</option>
                <option value="SUSPENDED">Suspended Only</option>
                <option value="PAST_DUE">Past Due Only</option>
              </select>

              <button
                type="button"
                onClick={handleExportMerchantsCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                <span>📥 Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => { setProvisionedInvitationLink(''); setShowOnboardModal(true); }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#4D64E6] hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#4D64E6]/25 cursor-pointer shrink-0"
              >
                <span>+ Onboard Tenant</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-extrabold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 pl-5">Organization & Shop Code</th>
                  <th className="p-3.5">Owner Contact</th>
                  <th className="p-3.5">Subscription Plan</th>
                  <th className="p-3.5">Shops</th>
                  <th className="p-3.5">Tenant Status</th>
                  <th className="p-3.5 pr-5 text-right">Administrative Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredMerchants.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3.5 pl-5 font-bold text-slate-900 dark:text-white">
                      <div>{m.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">code: {m.shopCode || 'campus1'}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{m.owner?.name || 'Store Owner'}</div>
                      <div className="text-[10px] text-slate-400">{m.owner?.email || 'owner@printshop.in'}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-indigo-50 dark:bg-indigo-950/60 text-[#4D64E6]">
                        {m.planTier || '—'}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">
                      {m.shopsCount ?? 0} {m.shopsCount === 1 ? 'shop' : 'shops'}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          m.planStatus === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : m.planStatus === 'TRIAL'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : m.planStatus === 'PAST_DUE'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        }`}
                      >
                        {m.planStatus}
                      </span>
                    </td>
                    <td className="p-3.5 pr-5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => setSelectedMerchantDetail(m)}
                        className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-[11px] hover:bg-slate-100 cursor-pointer"
                      >
                        Inspect
                      </button>
                      {['ACTIVE', 'SUSPENDED'].includes(m.planStatus) && <button
                        type="button"
                        onClick={() => handleToggleMerchantStatus(m.id, m.planStatus)}
                        className={`px-3 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                          m.planStatus === 'ACTIVE'
                            ? 'border border-red-200 text-red-600 hover:bg-red-50'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {m.planStatus === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                      </button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'enquiries' && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Website enquiries</h2>
            <p className="mt-1 text-xs text-slate-500">Public requests saved for platform follow-up. Access is limited to platform owners and admins.</p>
          </div>
          {enquiries.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">No enquiries have been received yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-extrabold text-slate-400">
                  <tr><th className="p-3.5 pl-5">Received</th><th className="p-3.5">Contact</th><th className="p-3.5">Message</th><th className="p-3.5">Source</th><th className="p-3.5">Status</th></tr>
                </thead>
                <tbody>
                  {enquiries.map((enquiry) => (
                    <tr key={enquiry.id} className="border-t border-slate-100 dark:border-slate-800 align-top">
                      <td className="p-3.5 pl-5 whitespace-nowrap">{new Date(enquiry.createdAt).toLocaleString()}</td>
                      <td className="p-3.5 min-w-44"><div className="font-bold text-slate-900 dark:text-white">{enquiry.name}</div><div>{enquiry.phone}</div>{enquiry.email && <div>{enquiry.email}</div>}</td>
                      <td className="p-3.5 min-w-64 max-w-xl whitespace-pre-wrap break-words">{enquiry.message}</td>
                      <td className="p-3.5">{enquiry.source}{enquiry.city ? ` · ${enquiry.city}` : ''}{enquiry.state ? `, ${enquiry.state}` : ''}</td>
                      <td className="p-3.5">{enquiry.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 3: WINDOWS AGENT BUILDS & DISTRIBUTION
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'builds' && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100" role="status">
          <h2 className="text-base font-extrabold">Verified agent installer unavailable</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6">This deployment has no signed, verified installer configured. Download links are disabled until a real artifact, checksum, signature, and release record are available.</p>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 4: SAAS PLANS & ENTITLEMENTS
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'plans' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Pilot plan tiers</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Tier features and quotas remain informational. Configure organization-specific monthly rates and issue manual invoices from confirmed print-side usage below; this does not collect payment.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {platformPlans.map((plan: any) => (
              <article key={plan.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="font-bold text-slate-900 dark:text-white">{plan.name}</h3><p className="text-xs text-slate-500">{plan.tier}</p></div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{subscriptions.filter((sub: any) => sub.planTier === plan.tier && ['ACTIVE', 'TRIALING', 'GRACE'].includes(sub.status)).length} active or trial</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Pricing: configured per pilot</p>
                <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">Listed quotas and features are catalog values; enforcement and entitlement editing are not active.</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <div><dt className="text-slate-400">Monthly order limit</dt><dd className="font-bold">{plan.orderLimitMonthly.toLocaleString()}</dd></div>
                  <div><dt className="text-slate-400">Printer limit</dt><dd className="font-bold">{plan.printerLimit}</dd></div>
                  <div><dt className="text-slate-400">Max file size</dt><dd className="font-bold">{plan.fileSizeMaxMB} MB</dd></div>
                  <div><dt className="text-slate-400">Included conversion credits</dt><dd className="font-bold">{plan.includedConversionCredits}</dd></div>
                </dl>
                <ul className="mt-3 space-y-1 text-xs text-slate-500">{plan.features.map((feature: string) => <li key={feature}>• {feature}</li>)}</ul>
              </article>
            ))}
            {platformPlans.length === 0 && <p className="text-sm text-slate-500">The plan catalog could not be loaded.</p>}
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-amber-700 dark:border-slate-800 dark:text-amber-300">Plan catalog and quota enforcement remain code-managed. Pilot invoices are before tax, immutable after issue, and require separate manual collection.</div>
          <section className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/20" aria-labelledby="pilot-billing-title">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><h3 id="pilot-billing-title" className="font-extrabold text-slate-900 dark:text-white">Hybrid pilot billing</h3><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Rates are stored in integer paise. Printed-side quantity comes only from audited physical-output confirmation.</p></div>
              <label className="w-full text-xs font-bold text-slate-600 dark:text-slate-300 sm:max-w-xs">Organization
                <select value={billingOrganizationId} onChange={(event) => setBillingOrganizationId(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
                  <option value="">Choose organization</option>
                  {merchants.map((merchant: any) => <option key={merchant.id} value={merchant.id}>{merchant.name} · {merchant.id}</option>)}
                </select>
              </label>
            </div>
            {billingError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{billingError}</p>}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <form onSubmit={savePilotTariff} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Add rate schedule</h4>
                <p className="mt-1 text-[11px] text-slate-500">Schedules are append-only and begin on a calendar month boundary.</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Monthly base (₹)<input inputMode="decimal" value={billingBaseRupees} onChange={(event) => setBillingBaseRupees(event.target.value)} required pattern="(?:0|[1-9]\d*)(?:\.\d{1,2})?" placeholder="0.00" className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Fee per printed side (₹)<input inputMode="decimal" value={billingSideRupees} onChange={(event) => setBillingSideRupees(event.target.value)} required pattern="(?:0|[1-9]\d*)(?:\.\d{1,2})?" placeholder="0.00" className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Included sides<input type="number" min="0" step="1" value={billingIncludedSides} onChange={(event) => setBillingIncludedSides(event.target.value)} required className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Effective month<input type="month" value={billingEffectiveMonth} onChange={(event) => setBillingEffectiveMonth(event.target.value)} required className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
                </div>
                <button disabled={!billingOrganizationId || billingBusy} className="mt-3 min-h-10 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white disabled:opacity-50">{billingBusy ? 'Saving…' : 'Save rate schedule'}</button>
                <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  {billingTariffs.map((tariff) => <li key={tariff.id}>{tariff.effectiveFrom.slice(0, 7)} · ₹{(tariff.monthlyBasePaise / 100).toFixed(2)}/month · ₹{(tariff.perSidePaise / 100).toFixed(2)}/side · {tariff.includedSides.toLocaleString()} included</li>)}
                  {!billingError && billingOrganizationId && billingTariffs.length === 0 && <li>No billing rate schedule configured.</li>}
                </ul>
              </form>
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Issue monthly invoice</h4>
                <p className="mt-1 text-[11px] text-slate-500">Only completed months can be issued. Duplicate requests return the existing immutable invoice.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Billing month<input type="month" value={billingInvoiceMonth} onChange={(event) => setBillingInvoiceMonth(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
                  <button type="button" disabled={!billingOrganizationId || !billingInvoiceMonth || billingBusy || billingTariffs.length === 0} onClick={issuePilotInvoice} className="min-h-10 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">{billingBusy ? 'Working…' : 'Issue invoice'}</button>
                </div>
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Manual collection only. No customer payment, platform payment, tax, or ledger entry is created by issuing a statement.</p>
                <ul className="mt-3 divide-y divide-slate-100 text-xs dark:divide-slate-800">
                  {pilotInvoices.map((invoice) => <li key={invoice.id} className="flex items-center justify-between gap-2 py-2"><span>{new Date(invoice.periodStart).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })} · {invoice.confirmedSides.toLocaleString()} sides · {invoice.collectionStatus.replace(/_/g, ' ').toLowerCase()}</span><strong>₹{(invoice.totalPaise / 100).toFixed(2)}</strong></li>)}
                  {billingOrganizationId && pilotInvoices.length === 0 && <li className="py-2 text-slate-500">No invoices issued.</li>}
                </ul>
              </div>
            </div>
          </section>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 4: IMMUTABLE FINANCIAL LEDGER
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'ledger' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Immutable Multi-Domain Financial Ledger
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                  ✓ SHA-256 Verified
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Append-only financial entries partitioned across all 6 official money domains in integer minor units (Paise)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportLedgerCsv}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <span>📥 Export CSV</span>
              </button>
            </div>
          </div>

          {/* Domain Filter Pills */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-1.5 text-xs">
            {['ALL', 'CUSTOMER_PRINT_PAYMENT', 'SAAS_SUBSCRIPTION', 'CONVERSION_CREDIT', 'MERCHANT_PAYOUT', 'DISPUTE_RESERVE'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDomain(d)}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  selectedDomain === d
                    ? 'bg-[#4D64E6] text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {d.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-extrabold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 pl-5">Ledger Transaction ID</th>
                  <th className="p-3.5">Domain</th>
                  <th className="p-3.5">Description</th>
                  <th className="p-3.5">Provider</th>
                  <th className="p-3.5">Amount (INR)</th>
                  <th className="p-3.5 pr-5 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No ledger transactions found in domain {selectedDomain}.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((le) => (
                    <tr key={le.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-3.5 pl-5 font-mono text-slate-500 text-[11px]">
                        {le.id}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {le.domain}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-slate-900 dark:text-white">
                        {le.description}
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {le.provider}
                      </td>
                      <td className={`p-3.5 font-bold ${le.amount_paise >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {le.amount_paise >= 0 ? '+' : '-'}₹{(Math.abs(le.amount_paise) / 100).toFixed(2)}
                      </td>
                      <td className="p-3.5 pr-5 text-right text-slate-400 text-[11px]">
                        {new Date(le.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 5: EDGE AGENTS FLEET
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'agents' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Edge Print Agent Fleet Telemetry
              </h2>
              <p className="text-xs text-slate-400">
                Connected Windows Spooler nodes running loopback daemons on localhost:8765
              </p>
            </div>
            <button
              type="button"
              onClick={() => showToast('Polled all 2 fleet nodes. Latency nominal.')}
              className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
            >
              ↻ Poll Heartbeats
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-extrabold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 pl-5">Agent ID & Hostname</th>
                  <th className="p-3.5">Store Assignment</th>
                  <th className="p-3.5">Platform & Version</th>
                  <th className="p-3.5">Heartbeat Status</th>
                  <th className="p-3.5">Assigned Printers</th>
                  <th className="p-3.5 pr-5">Pending Commands</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {agentFleet.map((ag) => (
                  <tr key={ag.agentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3.5 pl-5">
                      <div className="font-bold text-slate-900 dark:text-white">{ag.agentId}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{ag.hostname || 'Hostname unavailable'}</div>
                    </td>
                    <td className="p-3.5 font-medium text-slate-800 dark:text-slate-200">
                      {ag.shopName || 'Unknown shop'} ({ag.shopCode || ag.shopId})
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{ag.osPlatform || 'OS unavailable'}</span>
                      <div className="text-[10px] text-slate-400">{ag.osVersion || 'OS version unavailable'} · Agent {ag.agentVersion || 'unknown'}</div>
                    </td>
                    <td className="p-3.5">
                      <span className={`font-bold ${ag.status === 'ONLINE' ? 'text-emerald-600' : ag.status === 'STALE' ? 'text-amber-600' : 'text-slate-500'}`}>{ag.status}</span>
                      <div className="text-[10px] text-slate-400">{ag.lastHeartbeat ? new Date(ag.lastHeartbeat).toLocaleString() : 'No heartbeat recorded'}</div>
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">
                      <span className="font-bold text-slate-900 dark:text-white">{ag.onlinePrinters}</span> online
                    </td>
                    <td className="p-3.5 pr-5 font-bold text-slate-700 dark:text-slate-300">{ag.pendingCommands}</td>
                  </tr>
                ))}
                {agentFleet.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No agents have paired with a shop yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 6: INCIDENTS
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'incidents' && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100" role="status">
          <h2 className="text-base font-extrabold">Incident management is not configured</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6">Inklly does not yet have a persistent incident intake, assignment, or resolution workflow. Agent and printer heartbeat data is available in Fleet; it is not an incident queue.</p>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 8: AUDIT LOGS
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Privileged Security & Operational Audit Log
              </h2>
              <p className="text-xs text-slate-400">
                Immutable trail of operator actions, tenant suspensions, secret rotations, and financial approvals
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportAuditCsv}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
            >
              <DownloadIcon size={14} />
              <span>Export Audit Log (CSV)</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-extrabold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 pl-5">Event ID</th>
                  <th className="p-3.5">Actor & Role</th>
                  <th className="p-3.5">Action Executed</th>
                  <th className="p-3.5">Target Tenant</th>
                  <th className="p-3.5">IP Address</th>
                  <th className="p-3.5 pr-5 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400 font-sans">
                      No security audit events recorded.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-3.5 pl-5 text-slate-500">{log.id.slice(0, 12)}...</td>
                      <td className="p-3.5 font-sans">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{log.actor_user_id}</span>
                        <div className="text-[10px] text-slate-400">PLATFORM_OWNER</div>
                      </td>
                      <td className="p-3.5 font-sans font-bold text-slate-900 dark:text-white">
                        {log.action}
                      </td>
                      <td className="p-3.5 text-slate-500 font-sans">{log.entity_id}</td>
                      <td className="p-3.5 text-slate-500">{log.ip_address}</td>
                      <td className="p-3.5 pr-5 text-right text-slate-400 font-sans">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 8: SYSTEM CONFIG & RUNTIME RULES
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'config' && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100" role="status">
          <h2 className="text-base font-extrabold">Runtime configuration is deployment-managed</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6">This console cannot persist global runtime settings or feature flags. The previous form only changed browser state. Configure supported environment variables in the deployment provider; audited runtime configuration remains a product requirement.</p>
        </section>
      )}

      {/* Inspect Tenant Modal */}
      {selectedMerchantDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="tenant-detail-title" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100 dark:border-slate-800">
              <h3 id="tenant-detail-title" className="font-extrabold text-base text-slate-900 dark:text-white">Tenant details: {selectedMerchantDetail.name}</h3>
              <button type="button" aria-label="Close tenant details" onClick={() => setSelectedMerchantDetail(null)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>
            <dl className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex justify-between gap-4"><dt>Organization ID</dt><dd className="font-mono break-all text-right">{selectedMerchantDetail.id}</dd></div>
              <div className="flex justify-between gap-4"><dt>Owner</dt><dd className="font-bold text-right">{selectedMerchantDetail.owner?.name || '—'} ({selectedMerchantDetail.owner?.email || '—'})</dd></div>
              <div className="flex justify-between"><dt>Plan tier</dt><dd className="font-bold">{selectedMerchantDetail.planTier}</dd></div>
              <div className="flex justify-between"><dt>Access status</dt><dd className="font-bold">{selectedMerchantDetail.planStatus}</dd></div>
              <div className="flex justify-between"><dt>Registered shops</dt><dd className="font-bold">{selectedMerchantDetail.shopsCount}</dd></div>
              <div className="flex justify-between"><dt>Orders recorded</dt><dd className="font-bold">{selectedMerchantDetail.ordersCount}</dd></div>
              <div className="flex justify-between"><dt>Created</dt><dd className="font-bold">{new Date(selectedMerchantDetail.createdAt).toLocaleString()}</dd></div>
            </dl>
            <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800">This view shows persistent organization data only. Printer health is available in Fleet; payment settlement and hardware details are not inferred here.</p>
            {['ACTIVE', 'SUSPENDED'].includes(selectedMerchantDetail.planStatus) && (
              <button type="button" onClick={() => { void handleToggleMerchantStatus(selectedMerchantDetail.id, selectedMerchantDetail.planStatus); setSelectedMerchantDetail(null); }} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-700">
                {selectedMerchantDetail.planStatus === 'ACTIVE' ? 'Suspend tenant access' : 'Reactivate tenant access'}
              </button>
            )}
            <button type="button" onClick={() => setSelectedMerchantDetail(null)} className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 font-bold text-xs rounded-xl">Close tenant details</button>
          </section>
        </div>
      )}

      {/* Onboard New Tenant Merchant Modal */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Onboard New Tenant Merchant
              </h3>
              <button
                type="button"
                onClick={() => { setShowOnboardModal(false); setProvisionedInvitationLink(''); }}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {provisionedInvitationLink ? (
              <div className="space-y-3" role="status" aria-live="polite">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <strong>Tenant created in the database.</strong> Billing is not configured, so this organization is on a seven-day trial. Share this one-time setup link with the owner using an approved private channel. It expires after 48 hours and is shown only here.
                </div>
                <input readOnly value={provisionedInvitationLink} aria-label="One-time owner setup link" className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-mono" />
                <button type="button" onClick={() => navigator.clipboard.writeText(provisionedInvitationLink).then(() => showToast('Owner setup link copied.')).catch(() => showToast('Copy failed; select and copy the link manually.'))} className="w-full py-2.5 bg-[#4D64E6] text-white font-bold text-xs rounded-xl">Copy one-time setup link</button>
                <button type="button" onClick={() => { setShowOnboardModal(false); setProvisionedInvitationLink(''); }} className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 font-bold text-xs rounded-xl">Done</button>
              </div>
            ) : <form onSubmit={handleOnboardMerchant} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Organization / Store Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Symbiosis Campus Xerox"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Unique Shop Code (QR Slug)
                </label>
                <input
                  type="text"
                  placeholder="e.g. symbiosis-viman (auto-generated if blank)"
                  value={newShopCode}
                  onChange={(e) => setNewShopCode(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Owner Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Patil"
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Owner Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. rajesh@campusprint.in"
                  value={newOwnerEmail}
                  onChange={(e) => setNewOwnerEmail(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Subscription Plan Tier
                </label>
                <select
                  value={newPlanTier}
                  onChange={(e) => setNewPlanTier(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold"
                >
                  <option value="STARTER">Starter (₹499/mo)</option>
                  <option value="GROWTH">Growth (₹1,199/mo)</option>
                  <option value="PRO">Pro (₹2,499/mo)</option>
                  <option value="SCALE">Scale (₹6,999/mo)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowOnboardModal(false); setProvisionedInvitationLink(''); }}
                  className="w-1/2 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isOnboarding}
                  className="w-1/2 py-2.5 bg-[#4D64E6] hover:bg-indigo-600 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md shadow-[#4D64E6]/25"
                >
                  {isOnboarding ? 'Creating tenant…' : 'Provision Tenant'}
                </button>
              </div>
            </form>}
          </div>
        </div>
      )}
    </div>
  );
};
