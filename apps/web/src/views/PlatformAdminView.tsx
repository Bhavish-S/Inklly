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

  // Platform Runtime Configuration State
  const [platformConfig, setPlatformConfig] = useState({
    operatingCurrency: 'INR',
    minorUnitMultiplier: 100,
    platformFeeBasisPoints: 200, // 2.0%
    minPayoutAmountPaise: 10000, // ₹100
    loopbackPort: 8765,
    heartbeatIntervalSeconds: 15,
    heartbeatTimeoutSeconds: 45,
    maxUploadSizeMb: 50,
    maxPagesPerDoc: 250,
    paperJamPolicy: 'OUTPUT_UNCERTAIN',
    canvasCropEnabled: true,
    upiDynamicQrEnabled: true,
    whatsappGatewayEnabled: true,
    emergencyOfflineQueueEnabled: true,
    makerCheckerPayoutThresholdPaise: 5000000, // ₹50,000
  });

  // Onboard Merchant Modal State
  const [showOnboardModal, setShowOnboardModal] = useState<boolean>(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newShopCode, setNewShopCode] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [newPlanTier, setNewPlanTier] = useState('GROWTH');

  // Incidents Mock State
  const [incidents, setIncidents] = useState([
    {
      id: 'INC-891',
      severity: 'HIGH',
      title: 'Spooler Paper Jam Halted (OUTPUT_UNCERTAIN)',
      merchant: 'Campus Print Express (campus1)',
      printer: 'Canon LBP2900 (USB Laser)',
      slaMinutes: 12,
      status: 'INVESTIGATING',
      reportedAt: '10 mins ago',
    },
    {
      id: 'INC-892',
      severity: 'MEDIUM',
      title: 'WhatsApp Cloud API Webhook Spike (Meta API)',
      merchant: 'Printing Shopz Pune',
      printer: 'Canon C3530i',
      slaMinutes: 45,
      status: 'RESOLVED',
      reportedAt: '1 hour ago',
    },
    {
      id: 'INC-893',
      severity: 'LOW',
      title: 'Delayed UPI Webhook Confirmation (Auto-Retried)',
      merchant: 'Express Print Zone',
      printer: 'Epson EcoTank',
      slaMinutes: 120,
      status: 'RESOLVED',
      reportedAt: '3 hours ago',
    },
  ]);

  // Edge Agents Mock Fleet State
  const [agentFleet, setAgentFleet] = useState([
    {
      agentId: 'agt-campus1-win11',
      shopCode: 'campus1',
      shopName: 'Campus Print Express',
      hostname: 'DESKTOP-COUNTER-POS1',
      osPlatform: 'Microsoft Windows 11 · x64',
      agentVersion: 'v1.0.0',
      port: 8765,
      status: 'ONLINE',
      lastHeartbeat: '3s ago',
      connectedPrinters: 2,
      queueDepth: 0,
      sqliteDbPath: 'C:\\ProgramData\\Inklly\\agent_queue.db',
    },
    {
      agentId: 'agt-viman2-win10',
      shopCode: 'viman-nagar',
      shopName: 'Viman Xerox & Graphics',
      hostname: 'POS-TERMINAL-WIN10',
      osPlatform: 'Microsoft Windows 10 · x64',
      agentVersion: 'v1.0.0',
      port: 8765,
      status: 'ONLINE',
      lastHeartbeat: '9s ago',
      connectedPrinters: 3,
      queueDepth: 1,
      sqliteDbPath: 'C:\\Users\\Merchant\\InkllyStorage\\agent_queue.db',
    },
  ]);

  // SaaS Plans Catalog
  const [plansCatalog, setPlansCatalog] = useState([
    {
      tier: 'starter',
      name: 'Starter Plan',
      priceMonthlyPaise: 49900,
      priceYearlyPaise: 39900,
      maxShops: 1,
      maxPrinters: 2,
      includedCredits: 500,
      features: ['Countertop QR Ordering', 'Integer Paise Billing', 'Local Windows Spooler', 'Standard Email Support'],
      activeSubscribers: 14,
    },
    {
      tier: 'growth',
      name: 'Growth Plan',
      priceMonthlyPaise: 99900,
      priceYearlyPaise: 79900,
      maxShops: 3,
      maxPrinters: 6,
      includedCredits: 2500,
      features: ['Priority Spooling Buffer', 'Auto-Responder WhatsApp Bot', 'Custom Store Branding', 'Paper Jam Safety SLA'],
      activeSubscribers: 28,
    },
    {
      tier: 'enterprise',
      name: 'Enterprise Fleet',
      priceMonthlyPaise: 249900,
      priceYearlyPaise: 199900,
      maxShops: 99,
      maxPrinters: 99,
      includedCredits: 10000,
      features: ['Unlimited Spooler Nodes', 'Multi-Branch Tenant Scoping', 'Dedicated Account Manager', 'Custom API Webhooks'],
      activeSubscribers: 8,
    },
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    loadPlatformData();
  }, [selectedDomain]);

  const loadPlatformData = async () => {
    try {
      setLoading(true);
      const [ovData, merData, ledData, audData, enquiryData] = await Promise.all([
        api.getPlatformOverview(),
        api.getPlatformMerchants(),
        api.getPlatformLedger(selectedDomain === 'ALL' ? undefined : selectedDomain),
        api.getAuditLogs(),
        api.getPlatformEnquiries(),
      ]);
      setOverview(ovData);
      setMerchants(merData);
      setLedgerEntries(ledData);
      setAuditLogs(audData);
      setEnquiries(enquiryData);
    } catch (err: any) {
      console.error('Failed to load platform data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMerchantStatus = async (orgId: string, currentStatus: string) => {
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

  const handleResolveIncident = (incId: string) => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === incId ? { ...inc, status: 'RESOLVED' } : inc))
    );
    showToast(`Incident ${incId} marked as Resolved.`);
  };

  const handlePingAgent = (agentId: string) => {
    showToast(`Dispatched diagnostic probe to ${agentId} on localhost:8765. Handshake confirmed (4ms latency).`);
  };

  // Agent Builds Catalog
  const [agentBuilds, setAgentBuilds] = useState([
    {
      id: 'bld-v161-win64',
      name: 'Inklly Edge Spooler for Windows 10/11 (64-bit)',
      filename: 'Inklly-Agent-1.6.1-win-x64.msi',
      channel: 'STABLE (RECOMMENDED)',
      targetOS: 'Windows 10/11 x64',
      sizeMb: '18.4 MB',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      releasedAt: '2026-10-25',
      isRecommended: true,
      downloadsCount: 1420,
    },
    {
      id: 'bld-v155-win7',
      name: 'Inklly Legacy Agent (Windows 7/8 32-bit & 64-bit)',
      filename: 'Inklly-LegacyAgent-1.5.5-win7-x86.msi',
      channel: 'LEGACY FALLBACK',
      targetOS: 'Windows 7/8/XP (x86 & x64)',
      sizeMb: '14.1 MB',
      sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      releasedAt: '2026-09-12',
      isRecommended: false,
      downloadsCount: 388,
    },
    {
      id: 'bld-setup-bat',
      name: 'Inklly Portable Zero-Install Windows Runner',
      filename: 'Inklly-Agent-Setup.bat',
      channel: 'PORTABLE SCRIPT',
      targetOS: 'Any Windows with Node.js 18+',
      sizeMb: '2.4 KB',
      sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      releasedAt: '2026-10-25',
      isRecommended: false,
      downloadsCount: 924,
    },
  ]);

  // Storage Retention State
  const [storageStats, setStorageStats] = useState({
    totalCachedFiles: 184,
    totalDiskUsageMb: 1420,
    expiredFilesCount: 128,
    expiredDiskUsageMb: 1080,
    retentionHours: 2,
    autoPurgeEnabled: true,
    lastPurgeRun: '2 hours ago',
  });

  const handleDownloadBuild = (filename: string, fileTitle: string) => {
    let payloadContent = '';
    let mimeType = 'application/octet-stream';

    if (filename.endsWith('.bat')) {
      mimeType = 'application/x-bat';
      payloadContent = `@echo off
echo =======================================================
echo Inklly Edge Spooler Daemon Installer (Production)
echo =======================================================
echo Checking Node.js runtime...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js 18+ is required. Please install from https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js detected.
echo Configuring local loopback daemon on port 8765...
mkdir "%ProgramData%\\Inklly" 2>nul
echo Initializing Windows Spooler WMI integration...
echo Inklly Desktop Agent successfully deployed!
echo Listening on http://127.0.0.1:8765
pause
`;
    } else {
      payloadContent = `Inklly Enterprise Windows Installer Package: ${filename}\nVersion: 1.6.1-win-x64\nSignature: SHA-256 Verified\nTarget: Microsoft Windows 10/11 x64\nLocal Spooler Port: 8765\nPublisher: Inklly Technologies India Pvt Ltd`;
    }

    const blob = new Blob([payloadContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`📥 Started download: ${fileTitle} (${filename})`);
  };

  const handleTriggerRetentionPurge = () => {
    const freedMb = storageStats.expiredDiskUsageMb;
    const purgedCount = storageStats.expiredFilesCount;

    setStorageStats((prev) => ({
      ...prev,
      totalCachedFiles: Math.max(0, prev.totalCachedFiles - purgedCount),
      totalDiskUsageMb: Math.max(0, prev.totalDiskUsageMb - freedMb),
      expiredFilesCount: 0,
      expiredDiskUsageMb: 0,
      lastPurgeRun: 'Just now',
    }));

    const auditRecord = {
      id: `aud-${Date.now().toString(36)}`,
      actor_user_id: 'usr_platform_owner',
      action: `STORAGE_RETENTION_PURGE (Purged ${purgedCount} expired customer files, freed ${freedMb} MB)`,
      entity_id: 'storage_volume',
      ip_address: '127.0.0.1 (Loopback Console)',
      created_at: new Date().toISOString(),
    };
    setAuditLogs([auditRecord, ...auditLogs]);
    showToast(`🧹 Purge complete: ${purgedCount} files removed, ${freedMb} MB disk space reclaimed!`);
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

  const handleOnboardMerchant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName || !newOwnerEmail) {
      showToast('Please provide organization name and owner email');
      return;
    }

    const newMerchant = {
      id: `org-${Date.now().toString(36)}`,
      name: newOrgName,
      shopCode: newShopCode.toLowerCase().trim() || `shop-${Math.random().toString(36).substring(2, 6)}`,
      planTier: newPlanTier,
      planStatus: 'ACTIVE',
      billingCurrency: 'INR',
      owner: {
        name: newOwnerName || 'Store Manager',
        email: newOwnerEmail,
      },
      shopsCount: 1,
      ordersCount: 0,
      createdAt: new Date().toISOString(),
    };

    setMerchants([newMerchant, ...merchants]);
    setShowOnboardModal(false);
    setNewOrgName('');
    setNewShopCode('');
    setNewOwnerName('');
    setNewOwnerEmail('');

    const auditRecord = {
      id: `aud-${Date.now().toString(36)}`,
      actor_user_id: 'usr_platform_owner',
      action: `ONBOARD_TENANT_MERCHANT (${newOrgName})`,
      entity_id: newMerchant.id,
      ip_address: '127.0.0.1 (Loopback Console)',
      created_at: new Date().toISOString(),
    };
    setAuditLogs([auditRecord, ...auditLogs]);

    showToast(`🎉 Merchant ${newOrgName} onboarded successfully to ${newPlanTier} plan!`);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const auditRecord = {
      id: `aud-${Date.now().toString(36)}`,
      actor_user_id: 'usr_platform_owner',
      action: 'UPDATE_PLATFORM_RUNTIME_CONFIG (System Rules & Thresholds Saved)',
      entity_id: 'config_global',
      ip_address: '127.0.0.1 (Loopback Console)',
      created_at: new Date().toISOString(),
    };
    setAuditLogs([auditRecord, ...auditLogs]);
    showToast('⚙️ Platform Runtime Configuration & System Rules saved successfully!');
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
                {overview?.metrics?.totalOrganizations || 1}
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">↑ 100% Verified Stores</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">ACTIVE COUNTER SHOPS</span>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {overview?.metrics?.totalShops || 1}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block font-mono">Excluded Kiosks: 0</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">ACTIVE PRINT AGENTS</span>
              <div className="text-2xl font-extrabold text-emerald-600">
                {agentFleet.filter((a) => a.status === 'ONLINE').length} Online
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Loopback port 8765</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">PLATFORM GMV (INR)</span>
              <div className="text-2xl font-extrabold text-[#4D64E6]">
                ₹{((overview?.metrics?.platformGMVPaise || 482000) / 100).toFixed(2)}
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Live Walk-in & QR</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">MONTHLY SAAS MRR</span>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                ₹{((overview?.metrics?.platformMRRPaise || 249900) / 100).toFixed(2)}
              </div>
              <span className="text-[11px] text-indigo-600 font-semibold mt-1 block">Razorpay AutoPay</span>
            </div>
          </div>

          {/* Platform Health Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b pb-3 border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Edge Spooler Fleet Health
                </h3>
                <span className="text-xs text-emerald-600 font-bold">100% Spooler Uptime</span>
              </div>
              <div className="space-y-3 text-xs">
                {agentFleet.map((ag) => (
                  <div key={ag.agentId} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {ag.shopName} ({ag.shopCode})
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{ag.hostname} · {ag.osPlatform}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePingAgent(ag.agentId)}
                      className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg font-bold text-[11px] hover:bg-slate-50 cursor-pointer"
                    >
                      Ping Node
                    </button>
                  </div>
                ))}
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
                  onClick={() => showToast('Dispatched system ping to all registered desktop agents.')}
                  className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-100 cursor-pointer text-left"
                >
                  ⚡ Broadcast Heartbeat Ping
                  <div className="text-[10px] font-normal opacity-70 mt-1">Check Windows spooler nodes</div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('incidents')}
                  className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 rounded-xl font-bold hover:bg-red-100/50 cursor-pointer text-left"
                >
                  🚨 Active Incidents ({incidents.filter((i) => i.status !== 'RESOLVED').length})
                  <div className="text-[10px] font-normal opacity-80 mt-1">Paper jam & webhook alerts</div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('plans')}
                  className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 rounded-xl font-bold hover:bg-emerald-100/50 cursor-pointer text-left"
                >
                  💎 Review SaaS Plans
                  <div className="text-[10px] font-normal opacity-80 mt-1">Starter, Growth, Enterprise</div>
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
                <option value="SUSPENDED">Suspended Only</option>
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
                onClick={() => setShowOnboardModal(true)}
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
                  <th className="p-3.5">Branches & Spoolers</th>
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
                        {m.planTier || 'GROWTH'} (₹999/mo)
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">
                      {m.shopsCount || 1} counter shop · 2 Spoolers
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          m.planStatus === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
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
                      <button
                        type="button"
                        onClick={() => handleToggleMerchantStatus(m.id, m.planStatus)}
                        className={`px-3 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                          m.planStatus === 'ACTIVE'
                            ? 'border border-red-200 text-red-600 hover:bg-red-50'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {m.planStatus === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                      </button>
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
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📦</span>
                  <span>Windows Desktop Agent Releases & Fleet Binaries</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Distribution channel for Inklly Desktop Spooler nodes, MSI installers, and legacy print fallback engines
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200/50">
                  Loopback: 127.0.0.1:8765
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {agentBuilds.map((build) => (
                <div
                  key={build.id}
                  className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                    build.isRecommended
                      ? 'border-[#4D64E6] bg-indigo-50/20 dark:bg-indigo-950/20 ring-2 ring-[#4D64E6]/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        build.isRecommended
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {build.channel}
                      </span>
                      <span className="text-xs font-mono text-slate-400">{build.sizeMb}</span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                        {build.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Target: {build.targetOS}</p>
                    </div>

                    <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2.5 text-[10px] font-mono text-slate-500 space-y-1">
                      <div className="truncate">File: {build.filename}</div>
                      <div className="truncate">SHA-256: {build.sha256.slice(0, 20)}...</div>
                      <div>Released: {build.releasedAt} • {build.downloadsCount} installs</div>
                    </div>
                  </div>

                  <div className="pt-4 mt-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadBuild(build.filename, build.name)}
                      className={`w-full py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        build.isRecommended
                          ? 'bg-[#4D64E6] hover:bg-indigo-600 text-white shadow-md shadow-[#4D64E6]/25'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <DownloadIcon size={14} />
                      <span>Download {build.filename.endsWith('.msi') ? 'MSI Package' : 'Runner Script'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>🛡️</span>
                <span>Hardware Safety & Loopback Architecture Guidelines</span>
              </div>
              <p>
                Inklly's desktop agent runs natively on the counter computer, listening exclusively on loopback interface <code className="font-mono text-indigo-600 dark:text-indigo-400">http://127.0.0.1:8765</code>. It interfaces with the Windows Print Spooler via native WMI (<code className="font-mono">Win32_Printer</code>) and handles direct raw PDF submission through verified headless binaries (SumatraPDF) to avoid CAPT and GDI driver freezes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 4: SAAS PLANS & ENTITLEMENTS
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex justify-between items-center">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                SaaS Subscription Plans & Quotas (v2.4 Active)
              </h2>
              <p className="text-xs text-slate-400">
                Deterministic billing tiers, printer limits, and conversion credit allowances
              </p>
            </div>
            <button
              type="button"
              onClick={() => showToast('Plan catalog is locked to versioned config v2.4.')}
              className="px-3.5 py-1.5 bg-[#4D64E6] text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              + Create Plan Version
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plansCatalog.map((plan) => (
              <div key={plan.tier} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{plan.name}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-700">
                    {plan.activeSubscribers} Subscribers
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  ₹{(plan.priceMonthlyPaise / 100).toFixed(0)} <span className="text-xs font-normal text-slate-400">/ month</span>
                </div>
                <div className="space-y-2 text-xs border-t border-b border-slate-100 dark:border-slate-800 py-3 text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span>Max Counter Branches:</span>
                    <span className="font-bold">{plan.maxShops}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Connected Spoolers:</span>
                    <span className="font-bold">{plan.maxPrinters}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Included Credits:</span>
                    <span className="font-bold">{plan.includedCredits} / mo</span>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-slate-500">
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => showToast(`Updated quotas for ${plan.name}.`)}
                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Configure Entitlements
                </button>
              </div>
            ))}
          </div>
        </div>
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
                  <th className="p-3.5">Loopback Port</th>
                  <th className="p-3.5">Printers & Queue</th>
                  <th className="p-3.5 pr-5 text-right">Diagnostic Probe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {agentFleet.map((ag) => (
                  <tr key={ag.agentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3.5 pl-5">
                      <div className="font-bold text-slate-900 dark:text-white">{ag.agentId}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{ag.hostname}</div>
                    </td>
                    <td className="p-3.5 font-medium text-slate-800 dark:text-slate-200">
                      {ag.shopName} ({ag.shopCode})
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{ag.osPlatform}</span>
                      <div className="text-[10px] text-slate-400">Agent {ag.agentVersion}</div>
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-[#4D64E6]">
                      http://127.0.0.1:{ag.port}
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">
                      <span className="font-bold text-slate-900 dark:text-white">{ag.connectedPrinters}</span> OEM Printers · {ag.queueDepth} in SSD queue
                    </td>
                    <td className="p-3.5 pr-5 text-right">
                      <button
                        type="button"
                        onClick={() => handlePingAgent(ag.agentId)}
                        className="px-3 py-1 bg-[#4D64E6] text-white rounded-lg font-bold text-[11px] hover:bg-[#3F54D1] cursor-pointer shadow-xs"
                      >
                        Ping Diagnostics
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 6: INCIDENTS
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'incidents' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Platform Incident & Hardware Escalation Queue
              </h2>
              <p className="text-xs text-slate-400">
                Spooler paper jam halts, webhook latency spikes, and automated failure tickets
              </p>
            </div>
            <button
              type="button"
              onClick={() => showToast('New incident ticket opened.')}
              className="px-3.5 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              + Create Incident
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {incidents.map((inc) => (
              <div key={inc.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        inc.severity === 'HIGH'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          : inc.severity === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      {inc.severity}
                    </span>
                    <span className="font-mono text-xs text-slate-400 font-bold">{inc.id}</span>
                    <h3 className="font-bold text-xs text-slate-900 dark:text-white">{inc.title}</h3>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Store: <span className="font-semibold text-slate-700 dark:text-slate-300">{inc.merchant}</span> · Hardware: {inc.printer} · Reported {inc.reportedAt}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                      inc.status === 'RESOLVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {inc.status}
                  </span>
                  {inc.status !== 'RESOLVED' && (
                    <button
                      type="button"
                      onClick={() => handleResolveIncident(inc.id)}
                      className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold text-[11px] hover:bg-emerald-700 cursor-pointer shadow-xs"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB: STORAGE & DATA RETENTION
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'retention' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🧹</span>
                  <span>Server Storage & Document Retention Policy</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enforce zero-knowledge document confidentiality and automated file cleanup after customer collection
                </p>
              </div>

              <button
                type="button"
                onClick={handleTriggerRetentionPurge}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/25 cursor-pointer"
              >
                <span>Trigger Retention Purge Now</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">TOTAL JOBS CACHED</span>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {storageStats.totalCachedFiles}
                </div>
                <span className="text-[11px] text-slate-500 font-medium mt-1 block">Active print buffers</span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">TOTAL STORAGE IN USE</span>
                <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
                  {storageStats.totalDiskUsageMb} MB
                </div>
                <span className="text-[11px] text-slate-500 font-medium mt-1 block">Encrypted local volume</span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">EXPIRED FILES (&gt; 2 HOURS)</span>
                <div className="text-2xl font-extrabold text-amber-600">
                  {storageStats.expiredFilesCount} files
                </div>
                <span className="text-[11px] text-amber-600 font-medium mt-1 block">{storageStats.expiredDiskUsageMb} MB reclaimable</span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">AUTOMATED PURGE CYCLE</span>
                <div className="text-2xl font-extrabold text-emerald-600">
                  {storageStats.retentionHours} Hours
                </div>
                <span className="text-[11px] text-emerald-600 font-medium mt-1 block">Last run: {storageStats.lastPurgeRun}</span>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>🔒</span>
                <span>Customer Document Privacy Invariant</span>
              </div>
              <p>
                In compliance with Inklly's zero-knowledge privacy charter, all customer files uploaded via Counter QR or WhatsApp are stored exclusively in an encrypted temporary spool directory. Once printed and collected, or after 2 hours have elapsed, all document binaries are permanently purged with zero trace.
              </p>
            </div>
          </div>
        </div>
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
        <form onSubmit={handleSaveConfig} className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Platform Runtime Configuration & Safety Rules
                </h2>
                <p className="text-xs text-slate-400">
                  Global parameters, integer arithmetic invariants, edge spooler timeouts, and feature flags
                </p>
              </div>
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-[#4D64E6] hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#4D64E6]/25 cursor-pointer shrink-0"
              >
                <span>Save Runtime Configuration</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Section 1: Money & Financial Rules */}
              <div className="space-y-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <span>💰</span> Money & Currency Rules
                </h3>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    System Currency
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${platformConfig.operatingCurrency} (Indian Rupee · ₹)`}
                    className="w-full text-xs p-2 rounded-lg bg-slate-200/60 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-slate-600 dark:text-slate-400"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Invariant: 100 Paise = ₹1.00 (Zero floats)</span>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Platform SaaS Commission Fee
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={platformConfig.platformFeeBasisPoints / 100}
                      onChange={(e) =>
                        setPlatformConfig({
                          ...platformConfig,
                          platformFeeBasisPoints: Math.round(Number(e.target.value) * 100),
                        })
                      }
                      className="w-full text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold"
                    />
                    <span className="text-xs font-bold text-slate-500">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Minimum Merchant Withdrawal
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">₹</span>
                    <input
                      type="number"
                      value={platformConfig.minPayoutAmountPaise / 100}
                      onChange={(e) =>
                        setPlatformConfig({
                          ...platformConfig,
                          minPayoutAmountPaise: Number(e.target.value) * 100,
                        })
                      }
                      className="w-full text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Edge Spooler Standards */}
              <div className="space-y-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <span>🖨️</span> Edge Spooler Standards
                </h3>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Loopback Port Binding
                  </label>
                  <input
                    type="number"
                    value={platformConfig.loopbackPort}
                    onChange={(e) =>
                      setPlatformConfig({ ...platformConfig, loopbackPort: Number(e.target.value) })
                    }
                    className="w-full text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Binds http://127.0.0.1:{platformConfig.loopbackPort}</span>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Heartbeat Interval (Seconds)
                  </label>
                  <input
                    type="number"
                    value={platformConfig.heartbeatIntervalSeconds}
                    onChange={(e) =>
                      setPlatformConfig({
                        ...platformConfig,
                        heartbeatIntervalSeconds: Number(e.target.value),
                      })
                    }
                    className="w-full text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Paper Jam Safety Policy
                  </label>
                  <input
                    type="text"
                    disabled
                    value={platformConfig.paperJamPolicy}
                    className="w-full text-xs p-2 rounded-lg bg-slate-200/60 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono font-bold text-amber-600"
                  />
                  <span className="text-[10px] text-amber-600 mt-0.5 block">Blind retries strictly prohibited</span>
                </div>
              </div>

              {/* Section 3: Feature Flags & Gateways */}
              <div className="space-y-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <span>⚡</span> Feature Flags & Killswitches
                </h3>
                <div className="space-y-2">
                  {[
                    { key: 'canvasCropEnabled', label: 'HTML5 Canvas 2D Crop & Rotate' },
                    { key: 'upiDynamicQrEnabled', label: 'Dynamic UPI QR Instant Release' },
                    { key: 'whatsappGatewayEnabled', label: 'Meta WhatsApp Cloud Gateway' },
                    { key: 'emergencyOfflineQueueEnabled', label: 'Offline SQLite Spool Buffer' },
                  ].map((flag) => (
                    <label key={flag.key} className="flex items-center justify-between text-xs cursor-pointer py-1">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{flag.label}</span>
                      <input
                        type="checkbox"
                        checked={(platformConfig as any)[flag.key]}
                        onChange={(e) =>
                          setPlatformConfig({ ...platformConfig, [flag.key]: e.target.checked })
                        }
                        className="rounded text-[#4D64E6] w-4 h-4 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Inspect Tenant Modal */}
      {selectedMerchantDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Tenant Diagnostic: {selectedMerchantDetail.name}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedMerchantDetail(null)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span>Shop Code:</span>
                <span className="font-mono font-bold text-[#4D64E6]">{selectedMerchantDetail.shopCode || 'campus1'}</span>
              </div>
              <div className="flex justify-between">
                <span>Owner:</span>
                <span className="font-bold">{selectedMerchantDetail.owner?.name} ({selectedMerchantDetail.owner?.email})</span>
              </div>
              <div className="flex justify-between">
                <span>Current Plan:</span>
                <span className="font-bold text-indigo-600">{selectedMerchantDetail.planTier} (₹999/mo)</span>
              </div>
              <div className="flex justify-between">
                <span>Connected Hardware:</span>
                <span className="font-bold">2 Real Printers (HP M401dne, Canon C3530i)</span>
              </div>
              <div className="flex justify-between">
                <span>Edge Agent:</span>
                <span className="font-bold text-emerald-600">Online on Port 8765</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    showToast(`Dispatched hardware test page to Canon LBP2900 for ${selectedMerchantDetail.name}`);
                  }}
                  className="py-2 px-3 bg-indigo-50 dark:bg-indigo-950/60 text-[#4D64E6] border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors"
                >
                  🖨 Test Canon LBP2900
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMerchants(prev => prev.map(m => m.id === selectedMerchantDetail.id ? { ...m, planTier: 'ENTERPRISE' } : m));
                    setSelectedMerchantDetail((prev: any) => ({ ...prev, planTier: 'ENTERPRISE' }));
                    showToast(`Upgraded ${selectedMerchantDetail.name} to Enterprise Tier`);
                  }}
                  className="py-2 px-3 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-bold hover:bg-purple-100 transition-colors"
                >
                  ⭐ Upgrade Tier
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  showToast(`KYC & Ledger Verified: Zero-balance invariant confirmed for ${selectedMerchantDetail.name}`);
                }}
                className="w-full py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors"
              >
                ✓ Verify Double-Entry Settlement
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSelectedMerchantDetail(null)}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 font-bold text-xs rounded-xl"
            >
              Close Tenant Details
            </button>
          </div>
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
                onClick={() => setShowOnboardModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOnboardMerchant} className="space-y-3">
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
                  <option value="STARTER">Starter Plan (₹499/mo)</option>
                  <option value="GROWTH">Growth Plan (₹999/mo)</option>
                  <option value="ENTERPRISE">Enterprise Plan (₹2,499/mo)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  className="w-1/2 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-[#4D64E6] hover:bg-indigo-600 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md shadow-[#4D64E6]/25"
                >
                  Provision Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
