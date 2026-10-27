import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { api } from '../api/client';
import {
  Logo,
  InkllyMark,
  PrinterIcon,
  QrCodeIcon,
  WhatsAppIcon,
  MonitorIcon,
  SlidersIcon,
  StoreIcon,
  UsersIcon,
  FileTextIcon,
  CheckIcon,
  ClockIcon,
  DollarSignIcon,
  ShieldIcon,
  EyeIcon,
  SearchIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SendIcon,
  PackageIcon,
  TrendingUpIcon,
  BellIcon,
  MoonIcon,
  SunIcon,
  LogOutIcon,
  InboxIcon,
  WifiIcon,
  MenuIcon,
  IndianRupeeIcon,
} from '../components/icons';


export interface DemoMerchant {
  id: string;
  shopCode: string;
  name: string;
  tagline: string;
  ownerName: string;
  phone: string;
  email: string;
  planTier: 'starter' | 'growth' | 'pro' | 'scale';
  planBadge: string;
  planPriceText: string;
  billingCycle: 'monthly' | 'yearly';
  maxPrinters: number;
  monthlyOrderLimit: number | 'Unlimited';
  whatsappBotEnabled: boolean;
  tokenDisplayEnabled: boolean;
  customBrandingEnabled: boolean;
  shiftReconciliationEnabled: boolean;
  multiBranchEnabled: boolean;
  apiAccessEnabled: boolean;
  accentColor: string;
  branches?: string[];
  customDomain?: string;
  features: string[];
}

export const DEMO_MERCHANTS: DemoMerchant[] = [];

export interface MerchantAppViewProps {
  onNavigate?: (path: string) => void;
}

export const MerchantAppView: React.FC<MerchantAppViewProps> = ({ onNavigate }) => {
  // Sidebar state
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<
    | 'dashboard'
    | 'orders'
    | 'live_print'
    | 'whatsapp_setup'
    | 'storage'
    | 'credits'
    | 'withdraw'
    | 'referrals'
    | 'employees'
    | 'train_bot'
    | 'business_setup'
    | 'shop_qr'
  >('dashboard');

  // Business Setup tab state
    const [selectedMerchantId, setSelectedMerchantId] = useState<string>('merchant-growth-monthly');
  const [merchantMenuOpen, setMerchantMenuOpen] = useState<boolean>(false);
  const [activeBranch, setActiveBranch] = useState<string>('Central Library Branch');

  // Real Authenticated Merchant State
  const [liveShop, setLiveShop] = useState<any>(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('inklly_shop') : null;
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [liveUser, setLiveUser] = useState<any>(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('inklly_user') : null;
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [liveOrganization, setLiveOrganization] = useState<any>(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('inklly_organization') : null;
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [liveSubscription, setLiveSubscription] = useState<any>(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('inklly_subscription') : null;
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    api.getMe()
      .then((data) => {
        if (data.shop) {
          setLiveShop(data.shop);
          localStorage.setItem('inklly_shop', JSON.stringify(data.shop));
        }
        if (data.user) {
          setLiveUser(data.user);
          localStorage.setItem('inklly_user', JSON.stringify(data.user));
        }
        if (data.organization) {
          setLiveOrganization(data.organization);
          localStorage.setItem('inklly_organization', JSON.stringify(data.organization));
        }
        if (data.subscription) {
          setLiveSubscription(data.subscription);
          localStorage.setItem('inklly_subscription', JSON.stringify(data.subscription));
        }
      })
      .catch(() => {
        // Fallback to offline/cached state
      });
  }, []);

  const currentMerchant = liveShop ? {
    id: liveShop.id,
    shopCode: liveShop.shopCode,
    name: liveShop.name,
    tagline: liveShop.tagline || 'High Speed Quality Printing & Photocopying',
    ownerName: liveUser?.fullName || 'Shop Owner',
    phone: liveShop.phone || '',
    email: liveShop.email || liveUser?.email || 'shop@inklly.com',
    planTier: liveShop.planTier || 'starter',
    planBadge: liveSubscription?.status === 'TRIALING'
      ? `${(liveShop.planTier || 'STARTER').toUpperCase()} · FREE TRIAL`
      : `${(liveShop.planTier || 'STARTER').toUpperCase()} · ${liveOrganization?.planStatus || 'PILOT'}`,
    planPriceText: liveSubscription?.status === 'TRIALING' && liveSubscription.current_period_end
      ? `Trial ends ${new Date(liveSubscription.current_period_end).toLocaleDateString()}`
      : 'Pilot pricing',
    billingCycle: 'monthly',
    maxPrinters: liveShop.planTier === 'starter' ? 1 : 3,
    monthlyOrderLimit: 1000,
    whatsappBotEnabled: false,
    tokenDisplayEnabled: true,
    customBrandingEnabled: false,
    shiftReconciliationEnabled: false,
    multiBranchEnabled: false,
    branches: ['Main Counter'],
    apiAccessEnabled: true,
    accentColor: '#4D64E6',
    features: ['1 Connected Printer', 'Self-service QR Portal', 'Standard Cash on Counter'],
  } : {
    id: 'my-shop',
    shopCode: 'my-shop',
    name: 'My Print Shop',
    tagline: 'High Speed Quality Printing & Photocopying',
    ownerName: 'Shop Owner',
    phone: '',
    email: '',
    planTier: 'starter',
    planBadge: 'Pilot account',
    planPriceText: 'Pilot pricing',
    billingCycle: 'monthly',
    maxPrinters: 1,
    monthlyOrderLimit: 1000,
    whatsappBotEnabled: false,
    tokenDisplayEnabled: true,
    customBrandingEnabled: false,
    shiftReconciliationEnabled: false,
    multiBranchEnabled: false,
    branches: ['Main Counter'],
    apiAccessEnabled: false,
    accentColor: '#4D64E6',
    features: ['1 Connected Printer', 'Self-service QR Portal', 'Standard Cash on Counter'],
  };

  // Dynamic Real Scannable QR State
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const liveShopUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/p/${currentMerchant.shopCode || 'campus1'}`
    : `https://inklly.vercel.app/p/${currentMerchant.shopCode || 'campus1'}`;

  useEffect(() => {
    QRCode.toDataURL(liveShopUrl, {
      width: 360,
      margin: 1,
      color: {
        dark: '#172031',
        light: '#FFFFFF',
      },
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [currentMerchant.shopCode, liveShopUrl]);

  const handleDownloadQrPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `Inklly-${currentMerchant.shopCode}-Counter-QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setGlobalToast(`Downloaded ${currentMerchant.name} Counter QR (PNG)`);
  };

  const handleCopyShopUrl = () => {
    navigator.clipboard?.writeText(liveShopUrl);
    setGlobalToast('Shop QR URL copied to clipboard!');
  };

  // Real Edge Print Agent Health & Detection State (Port 8765)
  const [agentOnline, setAgentOnline] = useState<boolean>(false);
  const [agentInfo, setAgentInfo] = useState<{ version?: string; hostname?: string } | null>(null);

  const checkAgentHealth = async (showToast: boolean = false) => {
    try {
      const res = await fetch('http://127.0.0.1:8765/health', { method: 'GET', signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        setAgentOnline(true);
        setAgentInfo(data);
        if (showToast) {
          setGlobalToast('✓ Inklly Agent is ONLINE and communicating on port 8765');
        }
        return true;
      }
    } catch {
      setAgentOnline(false);
      if (showToast) {
        setGlobalToast('⚠️ Inklly Agent is OFFLINE. Run Inklly-Agent-Setup.bat or InkllyAgent.exe on this PC.');
      }
    }
    return false;
  };

  useEffect(() => {
    checkAgentHealth(false);
    const interval = setInterval(() => checkAgentHealth(false), 12000);
    return () => clearInterval(interval);
  }, []);

  const handleDownloadAgent = (platform: string, format: string = 'bundle') => {
    const isProd = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
    const apiBase = (import.meta.env.VITE_API_BASE as string) || (isProd ? 'https://inklly.onrender.com/api/v1' : 'http://localhost:4000/api/v1');
    const downloadUrl = `${apiBase}/agent/download?platform=${platform}&shopCode=${currentMerchant.shopCode || 'campus1'}&format=${format}`;
    window.location.href = downloadUrl;
    setGlobalToast(`Downloading Inklly Agent for ${platform}...`);
  };

  const handleSwitchMerchant = (merchantId: string) => {
    setSelectedMerchantId(merchantId);
    setMerchantMenuOpen(false);
  };

  const [setupTab, setSetupTab] = useState<
    'profile' | 'printers' | 'pricing' | 'discounts' | 'portal' | 'automation'
  >('profile');

  // Dark mode
  // Interactive Guided Product Tour State
  const [tourOpen, setTourOpen] = useState<boolean>(false);
  const [tourStep, setTourStep] = useState<number>(0);
  const [showTourBanner, setShowTourBanner] = useState<boolean>(true);

  // Real Hardware Printer Connectivity & Detection State
  const [agentConnected, setAgentConnected] = useState<boolean>(false);
  const [detectingPrinters, setDetectingPrinters] = useState<boolean>(false);
  const [detectedPrinters, setDetectedPrinters] = useState<Array<{
    name: string;
    driver: string;
    port: string;
    status: 'Ready' | 'Printing' | 'Offline';
    isDefault: boolean;
    isPhysical: boolean;
    supportsColor: boolean;
    supportsDuplex: boolean;
    tray: string;
  }>>([]);
  const [selectedDefaultPrinter, setSelectedDefaultPrinter] = useState<string>('');
  const [selectedPaperTray, setSelectedPaperTray] = useState<string>('Auto-Select');
  const [showAddPrinterModal, setShowAddPrinterModal] = useState<boolean>(false);
  const [newPrinterName, setNewPrinterName] = useState<string>('');
  const [newPrinterPort, setNewPrinterPort] = useState<string>('USB002');
  const [newPrinterColor, setNewPrinterColor] = useState<boolean>(true);
  const [newPrinterDuplex, setNewPrinterDuplex] = useState<boolean>(true);

  // Checklist Interactive State
  const [checklistStatus, setChecklistStatus] = useState<Record<string, { status: string; ready: boolean }>>({
    Profile: { status: 'Needs review', ready: false },
    Printers: { status: 'Connect agent', ready: false },
    Pricing: { status: 'Needs review', ready: false },
    Discounts: { status: 'Optional', ready: false },
    'Customer Portal': { status: 'Needs review', ready: false },
    'Automation & Payment': { status: 'Needs review', ready: false },
  });



  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Upgrade Plan Modal State
  const [upgradeModalOpen, setUpgradeModalOpen] = useState<boolean>(false);
  const [currentPlan, setCurrentPlan] = useState<string>('Starter Plan');
  const [selectedPlanTier, setSelectedPlanTier] = useState<'starter' | 'growth' | 'pro' | 'scale'>('growth');
  const [billingCycleUpgrade, setBillingCycleUpgrade] = useState<'monthly' | 'yearly' | 'lifetime'>('monthly');
  const [billingName, setBillingName] = useState<string>('Printing Shopz');
  const [billingEmail, setBillingEmail] = useState<string>('owner@printingshopz.in');
  const [billingMobile, setBillingMobile] = useState<string>('+91 98765 43210');
  const [billingAddress, setBillingAddress] = useState<string>('Shop 4, Ground Floor, Academic Complex');
  const [billingCity, setBillingCity] = useState<string>('Pune');
  const [billingState, setBillingState] = useState<string>('Maharashtra');
  const [billingPincode, setBillingPincode] = useState<string>('411007');
  const [billingGstin, setBillingGstin] = useState<string>('27AABCU9603R1ZM');
  const [selectedAddons, setSelectedAddons] = useState<{ [key: string]: boolean }>({
    extraPrinter: false,
    extraWhatsapp: false,
    creditPack: false,
  });
  const [upgradeProcessing, setUpgradeProcessing] = useState<boolean>(false);

  // Global toast
  const [showOfflineToast, setShowOfflineToast] = useState<boolean>(true);

  // Profile dropdown
  const [profileDropdownOpen, setProfileDropdownOpen] = useState<boolean>(false);

  // Dashboard state
  const [dashboardMetricToggle, setDashboardMetricToggle] = useState<'orders' | 'revenue'>('orders');
  const [screenshotEmptyMode, setScreenshotEmptyMode] = useState<boolean>(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('INR');

  // Orders queue state
  const [ordersTab, setOrdersTab] = useState<
    'pending' | 'processing' | 'printing' | 'rejected' | 'print_failed' | 'done' | 'all'
  >('pending');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // Credits state
  const [creditQuantity, setCreditQuantity] = useState<number>(100);

  // Withdraw state
  const [withdrawMethod, setWithdrawMethod] = useState<'upi' | 'bank'>('upi');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [upiId, setUpiId] = useState<string>('9876543210@upi');
  const [savedUpi, setSavedUpi] = useState<boolean>(true);
  const [withdrawHistoryTab, setWithdrawHistoryTab] = useState<'transactions' | 'withdrawals'>('transactions');

  // Live Print search & filter
  const [livePrintSearch, setLivePrintSearch] = useState<string>('');
  const [livePrintFilter, setLivePrintFilter] = useState<'all' | 'working' | 'alerts'>('all');

  // WhatsApp setup
  const [whatsappHelpOpen, setWhatsappHelpOpen] = useState<boolean>(false);

  // Referrals
  const [referralTab, setReferralTab] = useState<'merchants' | 'history'>('merchants');
  const [referralQrOpen, setReferralQrOpen] = useState<boolean>(false);
  const [referralWithdrawAmount, setReferralWithdrawAmount] = useState<string>('');

  // Train Bot state
  const [botTab, setBotTab] = useState<'rules' | 'qa'>('rules');
  const [testChatMessage, setTestChatMessage] = useState<string>('');
  const [chatLog, setChatLog] = useState<Array<{ sender: 'bot' | 'user'; text: string; time: string }>>([
    {
      sender: 'bot',
      text: 'Welcome to Printing Shopz. Upload your document here: https://inklly.in/p/campus1 Link expires in 30 minutes.',
      time: '01:27 pm',
    },
  ]);

  // Global save notification
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);
  const setGlobalToast = (msg: string) => {
    setSaveSuccessToast(msg);
    setTimeout(() => setSaveSuccessToast(null), 4000);
  };

  // Business Setup: Profile
  const [shopName, setShopName] = useState<string>(() => liveShop?.name || 'Printing Shopz');
  const [shopTagline, setShopTagline] = useState<string>(() => liveShop?.tagline || 'High Speed Xerox, Document Printing & Lamination');
  const [shopPhone, setShopPhone] = useState<string>(() => liveShop?.phone || '+91 98765 43210');
  const [shopEmail, setShopEmail] = useState<string>(() => liveShop?.email || liveUser?.email || 'support@printingshopz.in');
  const [shopAddress, setShopAddress] = useState<string>(() => liveShop?.address || 'Shop 4, Ground Floor, Academic Complex');
  const [shopLocality, setShopLocality] = useState<string>('Near Central Library, University Campus');
  const [shopCity, setShopCity] = useState<string>(() => liveShop?.city || 'Pune');
  const [shopState, setShopState] = useState<string>(() => liveShop?.state || 'Maharashtra');
  const [shopPincode, setShopPincode] = useState<string>(() => liveShop?.pinCode || '411007');
  const [shopGstin, setShopGstin] = useState<string>('27AABCU9603R1ZM');

  useEffect(() => {
    if (liveShop) {
      if (liveShop.name) setShopName(liveShop.name);
      if (liveShop.tagline) setShopTagline(liveShop.tagline);
      if (liveShop.phone) setShopPhone(liveShop.phone);
      if (liveShop.email || liveUser?.email) setShopEmail(liveShop.email || liveUser?.email);
      if (liveShop.address) setShopAddress(liveShop.address);
      if (liveShop.city) setShopCity(liveShop.city);
      if (liveShop.state) setShopState(liveShop.state);
      if (liveShop.pinCode) setShopPincode(liveShop.pinCode);
      if (liveShop.name) setReceiptBusinessName(liveShop.name);
    }
  }, [liveShop, liveUser]);
  const [advancedServicesEnabled, setAdvancedServicesEnabled] = useState<boolean>(true);
  const [physicalServicesEnabled, setPhysicalServicesEnabled] = useState<boolean>(true);
  const [portalServices, setPortalServices] = useState<Record<string, boolean>>({
    'Black & White': true,
    'Color': true,
    'Single-Sided': true,
    'Back-to-Back (Auto)': true,
    'Back-to-Back (Manual)': true,
    'A4 Plain Paper': true,
    'Scaling': true,
    'Photo Collage': true,
    'ID Card': true,
    'Passport Photo': true,
    'PDF Page Selection': true,
    'Stapling Requests': false,
  });
  const [previewColorMode, setPreviewColorMode] = useState<'bw' | 'color'>('bw');
  const [previewPrintStyle, setPreviewPrintStyle] = useState<'single' | 'duplex_auto' | 'duplex_manual'>('single');
  const [previewPaperSize, setPreviewPaperSize] = useState<string>('A4');

  const toggleServiceOffered = (name: string) => {
    setServicesOffered((prev) => {
      const exists = prev.includes(name);
      const next = exists ? prev.filter((s) => s !== name) : [...prev, name];
      setGlobalToast(`Service "${name}" ${exists ? 'disabled' : 'enabled'}`);
      return next;
    });
  };

  const togglePortalService = (serviceKey: string, enable: boolean) => {
    setPortalServices((prev) => {
      const updated = { ...prev, [serviceKey]: enable };
      setGlobalToast(`"${serviceKey}" is now ${enable ? 'Enabled' : 'Disabled'} on customer portal`);
      return updated;
    });
  };

  const [servicesOffered, setServicesOffered] = useState<string[]>([
    'Black & White',
    'Colour',
    'Single-sided',
    'Back-to-Back Auto',
    'Back-to-Back Manual',
    'A4 Standard (75 GSM)',
    'A3 Poster / Large',
    'Legal / Stamp Paper',
    'Spiral Binding',
    'Hardcover Binding',
    'Lamination',
    'Corner Stapling',
  ]);

  // Business Setup: Printers
  const [testPrintAlert, setTestPrintAlert] = useState<string | null>(null);
  const [selectedAgentPlatform, setSelectedAgentPlatform] = useState<string>('win-x64');
  const [agentLoopbackChecking, setAgentLoopbackChecking] = useState<boolean>(false);
  const [agentLoopbackStatus, setAgentLoopbackStatus] = useState<'online' | 'offline'>('online');
  const [defaultPaperTray, setDefaultPaperTray] = useState<string>('Auto-Select');
  const [idCardPrintingEnabled, setIdCardPrintingEnabled] = useState<boolean>(true);
  const [photoPrintingEnabled, setPhotoPrintingEnabled] = useState<boolean>(true);
  const [printersList, setPrintersList] = useState([
    {
      id: 'p-1',
      name: 'HP LaserJet Pro M401dne',
      model: 'HP LaserJet Pro M401 PCL6',
      status: 'Online',
      lastSeen: '4s ago',
      isDefault: true,
      autoPrint: true,
      color: false,
      duplex: true,
      trays: ['Tray 1 (A4, 250 sheets)', 'Tray 2 (A4 Manual bypass)'],
    },
    {
      id: 'p-2',
      name: 'Canon imageRUNNER ADVANCE C3530i',
      model: 'Canon Generic Plus PCL6',
      status: 'Online',
      lastSeen: '8s ago',
      isDefault: false,
      autoPrint: false,
      color: true,
      duplex: true,
      trays: ['Tray 1 (A4 Plain)', 'Tray 2 (A3 Heavy)', 'Tray 3 (Photo 4x6 / 5x7)'],
    },
  ]);

  // Business Setup: Pricing
  const [pricingProfile, setPricingProfile] = useState<'default' | 'hp_m401' | 'canon_c3530'>('default');
  const [pricingPaperSize, setPricingPaperSize] = useState<'A4' | 'A3' | 'Legal'>('A4');
  // A4 rates
  const [rateBwSingle, setRateBwSingle] = useState<string>('1.50');
  const [rateBwDuplex, setRateBwDuplex] = useState<string>('1.20');
  const [rateColorSingle, setRateColorSingle] = useState<string>('8.00');
  const [rateColorDuplex, setRateColorDuplex] = useState<string>('6.50');
  // A3 rates
  const [rateA3BwSingle, setRateA3BwSingle] = useState<string>('3.00');
  const [rateA3BwDuplex, setRateA3BwDuplex] = useState<string>('2.50');
  const [rateA3ColorSingle, setRateA3ColorSingle] = useState<string>('15.00');
  const [rateA3ColorDuplex, setRateA3ColorDuplex] = useState<string>('12.00');
  // Legal rates
  const [rateLegalBwSingle, setRateLegalBwSingle] = useState<string>('2.00');
  const [rateLegalBwDuplex, setRateLegalBwDuplex] = useState<string>('1.80');
  const [rateLegalColorSingle, setRateLegalColorSingle] = useState<string>('10.00');
  const [rateLegalColorDuplex, setRateLegalColorDuplex] = useState<string>('8.50');
  // Finishing services rates
  const [rateSpiralBinding, setRateSpiralBinding] = useState<string>('35.00');
  const [rateHardBinding, setRateHardBinding] = useState<string>('150.00');
  const [rateLaminationA4, setRateLaminationA4] = useState<string>('25.00');

  // Hydrate Live Rate Rules from API
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('inklly_token') : null;
    if (token) {
      api.getRates()
        .then((ratesData) => {
          if (ratesData?.rateRules && Array.isArray(ratesData.rateRules)) {
            const rules = ratesData.rateRules;
            const a4BwSimp = rules.find((r: any) => r.paperSize === 'A4' && r.colorMode === 'bw' && r.duplexMode === 'simplex');
            const a4BwDupl = rules.find((r: any) => r.paperSize === 'A4' && r.colorMode === 'bw' && (r.duplexMode === 'duplex_auto' || r.duplexMode === 'duplex_manual'));
            const a4ColSimp = rules.find((r: any) => r.paperSize === 'A4' && r.colorMode === 'color' && r.duplexMode === 'simplex');
            const a4ColDupl = rules.find((r: any) => r.paperSize === 'A4' && r.colorMode === 'color' && (r.duplexMode === 'duplex_auto' || r.duplexMode === 'duplex_manual'));

            if (a4BwSimp) setRateBwSingle((a4BwSimp.pricePerPrintedSidePaise / 100).toFixed(2));
            if (a4BwDupl) setRateBwDuplex((a4BwDupl.pricePerPrintedSidePaise / 100).toFixed(2));
            if (a4ColSimp) setRateColorSingle((a4ColSimp.pricePerPrintedSidePaise / 100).toFixed(2));
            if (a4ColDupl) setRateColorDuplex((a4ColDupl.pricePerPrintedSidePaise / 100).toFixed(2));
          }
        })
        .catch(() => {});
    }
  }, [liveShop?.id]);

  // Business Setup: Discounts
  const [bulkDiscountEnabled, setBulkDiscountEnabled] = useState<boolean>(true);
  const [bulkMinThreshold, setBulkMinThreshold] = useState<number>(100);
  const [bulkTiers, setBulkTiers] = useState([
    { id: 't1', min: 100, max: 499, percent: 5 },
    { id: 't2', min: 500, max: 999, percent: 10 },
    { id: 't3', min: 1000, max: 99999, percent: 15 },
  ]);
  const [copyDiscountEnabled, setCopyDiscountEnabled] = useState<boolean>(true);
  const [copyDiscountPercent, setCopyDiscountPercent] = useState<number>(10);

  // Business Setup: Portal Customization toggles
  const [portalShopTitle, setPortalShopTitle] = useState<string>('Printing Shopz · Fast Counter Print');
  const [portalTheme, setPortalTheme] = useState<'brand' | 'navy' | 'emerald' | 'purple'>('brand');
  const [portalDetailsPage, setPortalDetailsPage] = useState<boolean>(false);
  const [portalAllowPageRange, setPortalAllowPageRange] = useState<boolean>(true);
  const [portalBw, setPortalBw] = useState<boolean>(true);
  const [portalColor, setPortalColor] = useState<boolean>(true);
  const [portalSingle, setPortalSingle] = useState<boolean>(true);
  const [portalDuplexAuto, setPortalDuplexAuto] = useState<boolean>(true);
  const [portalDuplexManual, setPortalDuplexManual] = useState<boolean>(false);
  const [portalAllowPaperSize, setPortalAllowPaperSize] = useState<boolean>(true);
  const [portalAllowPaperFinish, setPortalAllowPaperFinish] = useState<boolean>(true);
  const [portalAllowCopies, setPortalAllowCopies] = useState<boolean>(true);
  const [portalAllowNotes, setPortalAllowNotes] = useState<boolean>(true);

  // Business Setup: Automation & Payment
  const [automationCurrency, setAutomationCurrency] = useState<string>('INR');
  const [razorpayTestMode, setRazorpayTestMode] = useState<boolean>(false);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpaySecret, setRazorpaySecret] = useState('');
  const [razorpayWebhookSecret, setRazorpayWebhookSecret] = useState('');
  const [razorpayCredentialStatus, setRazorpayCredentialStatus] = useState<any>({ configured: false });
  const [acceptOnlinePayments, setAcceptOnlinePayments] = useState<boolean>(true);
  const [allowManualPayment, setAllowManualPayment] = useState<boolean>(true);
  const [autoPrintMode, setAutoPrintMode] = useState<'all' | 'after_payment' | 'off'>('after_payment');
  const [orderSeparator, setOrderSeparator] = useState<'none' | 'invoice' | 'blank'>('invoice');
  const [separatorThreshold, setSeparatorThreshold] = useState<number>(2);
  const [receiptBusinessName, setReceiptBusinessName] = useState<string>('Printing Shopz');
  const [receiptFooterNote, setReceiptFooterNote] = useState<string>('Thank you for printing with us! Visit again.');
  const [receiptIncludeGst, setReceiptIncludeGst] = useState<boolean>(true);
  const [receiptIncludeQr, setReceiptIncludeQr] = useState<boolean>(true);
  const [notifyOnOrderReceived, setNotifyOnOrderReceived] = useState<boolean>(true);
  const [notifyOnOrderCompleted, setNotifyOnOrderCompleted] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    if (liveShop?.id && localStorage.getItem('inklly_token')) {
      api.getRazorpayCredentials().then((status) => {
        if (active) setRazorpayCredentialStatus(status);
      }).catch(() => {
        if (active) setRazorpayCredentialStatus({ configured: false });
      });
    }
    return () => { active = false; };
  }, [liveShop?.id]);

  const saveRazorpayCredentials = async () => {
    try {
      const status = await api.saveRazorpayCredentials({ keyId: razorpayKeyId, secret: razorpaySecret, webhookSecret: razorpayWebhookSecret });
      setRazorpayCredentialStatus(status);
      setRazorpayKeyId('');
      setRazorpaySecret('');
      setRazorpayWebhookSecret('');
      triggerSaveNotification('Razorpay credentials');
    } catch (error: any) {
      triggerSaveNotification(error.message || 'Failed to save Razorpay credentials');
    }
  };

  const removeRazorpayCredentials = async () => {
    try {
      const status = await api.removeRazorpayCredentials();
      setRazorpayCredentialStatus(status);
      setRazorpayKeyId('');
      setRazorpaySecret('');
      setRazorpayWebhookSecret('');
      triggerSaveNotification('Razorpay credentials removed');
    } catch (error: any) {
      triggerSaveNotification(error.message || 'Failed to remove Razorpay credentials');
    }
  };

  const triggerSaveNotification = (sectionName: string) => {
    setSaveSuccessToast(`${sectionName} saved successfully to Inklly Cloud.`);
    setTimeout(() => setSaveSuccessToast(null), 3500);
  };

  const handleSaveBusinessSetup = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('inklly_token') : null;
      if (token) {
        // 1. Save Shop Details
        try {
          await api.updateShopSettings({
            name: shopName,
            phone: shopPhone,
            address: shopAddress,
            city: shopCity,
            state: shopState,
            pinCode: shopPincode,
            tagline: shopTagline,
          });
        } catch {
          // Direct fallback to PUT in case client PATCH is used
          const isProduction = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
          const apiBase = (import.meta.env.VITE_API_BASE as string) || (isProduction ? 'https://inklly.onrender.com/api/v1' : 'http://localhost:4000/api/v1');
          await fetch(`${apiBase}/merchant/settings`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: shopName,
              phone: shopPhone,
              address: shopAddress,
              city: shopCity,
              state: shopState,
              pinCode: shopPincode,
              tagline: shopTagline,
            }),
          });
        }

        // 2. Save Rate Rules (Integer Paise conversion)
        const bwSimpPaise = Math.round(parseFloat(rateBwSingle || '2') * 100);
        const bwDuplPaise = Math.round(parseFloat(rateBwDuplex || '1.5') * 100);
        const colSimpPaise = Math.round(parseFloat(rateColorSingle || '10') * 100);
        const colDuplPaise = Math.round(parseFloat(rateColorDuplex || '8') * 100);

        await Promise.all([
          api.updateRate({ paperSize: 'A4', colorMode: 'bw', duplexMode: 'simplex', pricePerPrintedSidePaise: bwSimpPaise }),
          api.updateRate({ paperSize: 'A4', colorMode: 'bw', duplexMode: 'duplex_auto', pricePerPrintedSidePaise: bwDuplPaise }),
          api.updateRate({ paperSize: 'A4', colorMode: 'color', duplexMode: 'simplex', pricePerPrintedSidePaise: colSimpPaise }),
          api.updateRate({ paperSize: 'A4', colorMode: 'color', duplexMode: 'duplex_auto', pricePerPrintedSidePaise: colDuplPaise }),
        ]);

        // 3. Update localStorage shop cache
        const stored = localStorage.getItem('inklly_shop');
        if (stored) {
          const parsed = JSON.parse(stored);
          const updated = {
            ...parsed,
            name: shopName,
            phone: shopPhone,
            address: shopAddress,
            city: shopCity,
            state: shopState,
            pinCode: shopPincode,
            tagline: shopTagline,
          };
          localStorage.setItem('inklly_shop', JSON.stringify(updated));
          setLiveShop(updated);
        }
      }
      triggerSaveNotification('Business Setup and Rates');
    } catch (err: any) {
      triggerSaveNotification('Failed to save settings: ' + (err.message || 'Unknown error'));
    }
  };

  // Plan Upgrade Calculation Helpers
  const getBasePlanPrice = () => {
    if (billingCycleUpgrade === 'lifetime') {
      if (selectedPlanTier === 'starter') return 999;
      if (selectedPlanTier === 'growth') return 1999;
      if (selectedPlanTier === 'pro') return 4999;
      return 8999;
    }
    if (selectedPlanTier === 'starter') return billingCycleUpgrade === 'monthly' ? 99 : 79;
    if (selectedPlanTier === 'growth') return billingCycleUpgrade === 'monthly' ? 199 : 159;
    if (selectedPlanTier === 'pro') return billingCycleUpgrade === 'monthly' ? 499 : 399;
    return billingCycleUpgrade === 'monthly' ? 899 : 719;
  };

  const getAddonTotal = () => {
    let total = 0;
    if (selectedAddons.extraWhatsapp) total += 99;
    if (selectedAddons.extraPrinter) total += 49;
    if (selectedAddons.creditPack) total += 50;
    return total;
  };

  const totalUpgradeSubtotal = getBasePlanPrice() + getAddonTotal();
  const upgradeGst = Math.round(totalUpgradeSubtotal * 0.18);
  const totalDueToday = totalUpgradeSubtotal + upgradeGst;

  const handleConfirmUpgrade = () => {
    setUpgradeModalOpen(false);
    if (onNavigate) onNavigate('/pricing');
    else setSaveSuccessToast('Pilot pricing is configured directly with Inklly. Visit Contact to discuss your shop.');
  };

  // Orders Search & Action Toast
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [orderActionToast, setOrderActionToast] = useState<string | null>(null);

  // Storage State
  const [storageAgentOnline, setStorageAgentOnline] = useState<boolean>(false);
  const [selectedStorageCategory, setSelectedStorageCategory] = useState<string>('college');
  const [selectedStorageFile, setSelectedStorageFile] = useState<any>(null);
  const [newCategoryModalOpen, setNewCategoryModalOpen] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [storageCategories, setStorageCategories] = useState([
    { id: 'temporary', name: 'Temporary customer uploads', count: 0, size: '0 MB' },
  ]);
  const [storageFiles, setStorageFiles] = useState<Record<string, Array<{ id: string; name: string; pages: number; size: string; date: string; type: string }>>>({ temporary: [] });

  // WhatsApp State
  const [whatsappConnected, setWhatsappConnected] = useState<boolean>(false);
  const [whatsappQrTimer, setWhatsappQrTimer] = useState<number>(60);

  // Live Print State
  const [printerPausedMap, setPrinterPausedMap] = useState<Record<string, boolean>>({
    'p-hp-401': false,
    'p-canon-c3530': false,
  });

  // Credits State
  const [creditsRemaining, setCreditsRemaining] = useState<number>(50);
  const [creditsUsed, setCreditsUsed] = useState<number>(12);
  const [creditsPurchased, setCreditsPurchased] = useState<number>(0);
  const [creditPurchaseToast, setCreditPurchaseToast] = useState<string | null>(null);

  // Withdraw State
  const [withdrawAvailable, setWithdrawAvailable] = useState<number>(4753.0);
  const [withdrawGross, setWithdrawGross] = useState<number>(4850.0);
  const [withdrawFee, setWithdrawFee] = useState<number>(97.0);
  const [withdrawSettled, setWithdrawSettled] = useState<number>(18420.0);
  const [withdrawToast, setWithdrawToast] = useState<string | null>(null);
  const [withdrawHistory, setWithdrawHistory] = useState<Array<{ id: string; date: string; method: string; amount: string; status: string }>>([
    { id: 'WTH-20261020-8812', date: '20 Oct 2026', method: 'UPI (9876543210@upi)', amount: '₹5,000.00', status: 'Settled to Bank' },
    { id: 'WTH-20261012-4109', date: '12 Oct 2026', method: 'Bank Transfer (HDFC Bank)', amount: '₹13,420.00', status: 'Settled to Bank' },
  ]);

  // Referrals State
  const [copiedReferralToast, setCopiedReferralToast] = useState<boolean>(false);
  const [referralBonusClaimable, setReferralBonusClaimable] = useState<number>(500.0);

  // Employees State
  const [showAddEmpModal, setShowAddEmpModal] = useState<boolean>(false);
  const [newEmpName, setNewEmpName] = useState<string>('');
  const [newEmpPhone, setNewEmpPhone] = useState<string>('');
  const [newEmpRole, setNewEmpRole] = useState<'Operator' | 'Manager' | 'Cashier'>('Operator');
  const [newEmpShift, setNewEmpShift] = useState<'Morning (8 AM - 2 PM)' | 'Evening (2 PM - 9 PM)' | 'Full Day'>('Morning (8 AM - 2 PM)');
  const [employeeList, setEmployeeList] = useState<Array<{ id: string; name: string; phone: string; role: string; shift: string; status: string }>>([]);

  // Live Orders Data (Populated in real-time from server API and customer intake)
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [isRefreshingOrders, setIsRefreshingOrders] = useState<boolean>(false);
  const [lastOrderSyncTime, setLastOrderSyncTime] = useState<string>('Just now');

  const mapServerOrderToUiOrder = (o: any) => {
    const file = o.files?.[0];
    const printOpts = file?.printOptions || {};

    let tab: 'pending' | 'processing' | 'printing' | 'rejected' | 'print_failed' | 'done' = 'pending';
    if (o.status === 'READY_FOR_PRINT') tab = 'processing';
    else if (o.status === 'IN_PROGRESS' || o.status === 'SPOOLING') tab = 'printing';
    else if (o.status === 'CANCELLED' || o.status === 'REJECTED') tab = 'rejected';
    else if (o.status === 'FAILED' || o.status === 'OUTPUT_UNCERTAIN') tab = 'print_failed';
    else if (o.status === 'COLLECTED' || o.status === 'READY_FOR_COLLECTION' || o.status === 'COMPLETED') tab = 'done';
    else tab = 'pending';

    const orderTime = o.createdAt
      ? new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    const colorModeLabel = printOpts.colorMode === 'color'
      ? 'Colour Print'
      : (printOpts.colorMode === 'mixed'
          ? `Mixed (Color: p. ${printOpts.colorPages || 'custom'})`
          : 'Black & White');

    const pageRangeStr = printOpts.pageRange && printOpts.pageRange !== 'All'
      ? `Pages ${printOpts.pageRange} (${file?.pageCount || 1}p)`
      : `${file?.pageCount || 1} pages`;

    return {
      id: o.orderNumber || o.id,
      rawId: o.id,
      rawStatus: o.status,
      customer: o.customerName || 'Walk-in Customer',
      phone: o.customerPhone || 'Counter QR',
      document: file?.fileName || 'Customer_Document.pdf',
      pages: file?.pageCount || 1,
      pageRange: printOpts.pageRange || 'All',
      pageRangeDisplay: pageRangeStr,
      copies: printOpts.copies || 1,
      colorMode: colorModeLabel,
      rawColorMode: printOpts.colorMode,
      colorPages: printOpts.colorPages,
      duplex: printOpts.duplexMode === 'duplex_auto' ? 'Back-to-Back' : 'Single Sided',
      paperSize: printOpts.paperSize || 'A4',
      orientation: printOpts.orientation || 'Portrait',
      rotation: printOpts.rotation || 0,
      customerNote: printOpts.note || o.notes || '',
      amount: `₹${((o.totalAmountPaise || 0) / 100).toFixed(2)}`,
      time: orderTime,
      tab,
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMode: o.paymentMethod === 'ONLINE_UPI' ? 'Online UPI' : 'Cash on Counter',
      paymentMethod: o.paymentMethod,
      storageKey: undefined,
      fileUrl: file?.fileUrl,
      notes: o.notes,
      rawOrder: o,
    };
  };

  const fetchLiveOrdersFromApi = async () => {
    try {
      setIsRefreshingOrders(true);
      const serverOrders = await api.getOrders('ALL');
      if (Array.isArray(serverOrders)) {
        const mapped = serverOrders.map(mapServerOrderToUiOrder);
        setOrdersList(mapped);
        setLastOrderSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err) {
      console.warn('[MerchantAppView] Could not fetch live orders from API:', err);
    } finally {
      setIsRefreshingOrders(false);
    }
  };

  useEffect(() => {
    fetchLiveOrdersFromApi();
    const interval = setInterval(() => {
      fetchLiveOrdersFromApi();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Synchronize orders with Customer Portal via LocalStorage
  const updateOrderInStorage = (orderId: string, updates: any) => {
    try {
      const stored = JSON.parse(localStorage.getItem('inklly_live_orders') || '[]');
      const updated = stored.map((o: any) => (o.id === orderId || o.orderNumber === orderId ? { ...o, ...updates } : o));
      localStorage.setItem('inklly_live_orders', JSON.stringify(updated));
    } catch (e) {
      console.warn('Sync storage error', e);
    }
  };

  // Order Queue Handlers
  const handleOneClickPrint = async (orderId: string) => {
    const order = ordersList.find((o) => o.id === orderId || o.rawId === orderId);
    const targetId = order?.rawId || orderId;

    try {
      await api.dispatchPrint(targetId);
      setOrderActionToast(`Order #${orderId} was queued for the shop print agent.`);
      await fetchLiveOrdersFromApi();
    } catch (e) {
      console.warn('Server dispatch print warning:', e);
      setOrderActionToast(e instanceof Error ? e.message : 'Could not queue this order for printing.');
    }
    setTimeout(() => setOrderActionToast(null), 3000);
  };

  const handleRejectOrder = async (orderId: string) => {
    const order = ordersList.find((o) => o.id === orderId || o.rawId === orderId);
    const targetId = order?.rawId || orderId;
    try {
      await api.updateOrderStatus(targetId, 'REJECTED');
    } catch (e) {
      console.warn('Reject error:', e);
      setOrderActionToast(e instanceof Error ? e.message : 'Could not reject this order.');
      return;
    }
    await fetchLiveOrdersFromApi();
    setOrderActionToast(`Order #${orderId} has been rejected.`);
    setTimeout(() => setOrderActionToast(null), 3000);
  };

  const handleRetryPrint = (orderId: string) => {
    setOrderActionToast(`Order #${orderId} needs an operator review before retry. Check the printer and confirm the previous output to avoid duplicate pages.`);
    setTimeout(() => setOrderActionToast(null), 5000);
  };

  const handleMarkCollected = async (orderId: string) => {
    const order = ordersList.find((o) => o.id === orderId || o.rawId === orderId);
    const targetId = order?.rawId || orderId;
    try {
      if (order?.rawStatus === 'COLLECTED') {
        setSelectedOrder(null);
        return;
      }
      if (order?.rawStatus !== 'READY_FOR_COLLECTION') {
        setOrderActionToast('An order can be collected only after the print agent confirms every job is ready.');
        return;
      }
      await api.updateOrderStatus(targetId, 'COLLECTED');
    } catch (e) {
      console.warn('Update order status to COLLECTED warning:', e);
      setOrderActionToast(e instanceof Error ? e.message : 'Could not mark this order collected.');
      return;
    }
    updateOrderInStorage(orderId, { tab: 'done', rawStatus: 'COLLECTED', status: 'Cash Collected · Order Delivered' });
    setOrdersList((prev) =>
      prev.map((o) =>
        o.id === orderId || o.rawId === orderId
          ? { ...o, tab: 'done', rawStatus: 'COLLECTED', status: 'Cash Collected · Order Delivered' }
          : o
      )
    );
    fetchLiveOrdersFromApi();
    setOrderActionToast(`Order #${orderId} marked as Completed & Delivered.`);
    setTimeout(() => setOrderActionToast(null), 3000);
    setSelectedOrder(null);
  };

  const handlePrintStorageFile = (file: { id: string; name: string; pages: number }) => {
    setOrderActionToast(`${file.name} is a temporary customer upload. Create an order from the shop portal to price it and send it through the print agent.`);
    setTimeout(() => setOrderActionToast(null), 5000);
  };

  const handlePurchaseCredits = (qty: number) => {
    setCreditsRemaining((prev) => prev + qty);
    setCreditsPurchased((prev) => prev + qty);
    setCreditPurchaseToast(`Payment verified! Added ${qty} conversion credits. New balance: ${creditsRemaining + qty}`);
    setTimeout(() => setCreditPurchaseToast(null), 4000);
  };

  // Tour Management Handlers
  const TOUR_STEPS = [
    {
      step: 1,
      title: 'Store Profile & Business Setup',
      desc: 'Configure your shop name, contact number, operating address, and services you offer (Color, Duplex, Finishing, Binding).',
      badge: 'Step 1 of 5',
      targetTab: 'business_setup',
      targetSubtab: 'profile',
      actionText: 'Open Store Profile',
      tip: 'Customers see this identity on your ordering portal.',
    },
    {
      step: 2,
      title: 'Printers & Desktop Agent Connection',
      desc: 'Connect your physical printers (like Canon LBP2900) via the lightweight Inklly desktop agent for Windows. Includes automatic local offline queue and paper jam safety.',
      badge: 'Step 2 of 5',
      targetTab: 'business_setup',
      targetSubtab: 'printers',
      actionText: 'Connect Printers',
      tip: 'Orders are cached directly on your desktop SSD even during internet dropouts.',
    },
    {
      step: 3,
      title: 'Print Rates & Bulk Margin Discounts',
      desc: 'Set accurate per-page simplex and duplex rates in integer Paise. Configure automatic volume tier discounts (e.g. 50+ pages get ₹1.00/page).',
      badge: 'Step 3 of 5',
      targetTab: 'business_setup',
      targetSubtab: 'pricing',
      actionText: 'Configure Rates',
      tip: 'Integer Paise math prevents floating-point penny discrepancies.',
    },
    {
      step: 4,
      title: 'Counter Standee & Permanent Shop QR',
      desc: 'Download your print-ready royal blue counter standee placard. Customers scan the QR code to upload documents and pay directly without waiting in line.',
      badge: 'Step 4 of 5',
      targetTab: 'shop_qr',
      actionText: 'View Shop QR',
      tip: 'Available in PDF and high-res PNG with UPI scan steps.',
    },
    {
      step: 5,
      title: 'Live Print Queue',
      desc: 'Review customer orders, dispatch approved jobs to the paired desktop agent, and confirm collection after the print agent reports completion.',
      badge: 'Step 5 of 5',
      targetTab: 'live_print',
      actionText: 'View Live Queue',
      tip: 'Customer payments go to the shop’s own Razorpay account. Cash can be collected at the counter.',
    },
  ];

  const handleStartTour = () => {
    setTourStep(0);
    setTourOpen(true);
  };

  const handleNextTourStep = () => {
    if (tourStep < TOUR_STEPS.length - 1) {
      const next = tourStep + 1;
      setTourStep(next);
      const stepObj = TOUR_STEPS[next];
      if (stepObj.targetTab) {
        setActiveView(stepObj.targetTab as any);
        if (stepObj.targetSubtab) {
          setSetupTab(stepObj.targetSubtab as any);
        }
      }
    } else {
      setTourOpen(false);
      triggerSaveNotification('🎉 Onboarding tour completed! You are ready to start printing.');
    }
  };

  const handlePrevTourStep = () => {
    if (tourStep > 0) {
      const prev = tourStep - 1;
      setTourStep(prev);
      const stepObj = TOUR_STEPS[prev];
      if (stepObj.targetTab) {
        setActiveView(stepObj.targetTab as any);
        if (stepObj.targetSubtab) {
          setSetupTab(stepObj.targetSubtab as any);
        }
      }
    }
  };

  // Hardware Printer Probing & Control Handlers
  const handleRefreshPrinters = async () => {
    setDetectingPrinters(true);
    try {
      const result = await api.getPrinters();
      if (!Array.isArray(result)) throw new Error(result?.error || 'Printer list is unavailable.');
      const livePrinters = result;
      setDetectedPrinters(livePrinters);
      setAgentConnected(livePrinters.some((printer: any) => printer.isOnline));
      setSelectedDefaultPrinter(livePrinters.find((printer: any) => printer.isDefault)?.name || '');
      triggerSaveNotification(livePrinters.length ? `Loaded ${livePrinters.length} printer(s) registered with this shop.` : 'No printers are registered yet. Pair the desktop agent to discover local printers.');
    } catch (error) {
      setAgentConnected(false);
      triggerSaveNotification(error instanceof Error ? error.message : 'Could not load printers from the server.');
    } finally {
      setDetectingPrinters(false);
    }
  };

  const handleTestPrint = (printerName?: string) => {
    triggerSaveNotification(`Test printing is not available from this dashboard yet${printerName || selectedDefaultPrinter ? ` for ${printerName || selectedDefaultPrinter}` : ''}. Use the paired desktop agent to verify printer output.`);
  };

  const handleDownloadAgentScript = async () => {
    try {
    const { pairingCode, expiresAt, shopId } = await api.createAgentPairingCode();
    const isProd = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
    const serverUrl = ((import.meta.env.VITE_API_BASE as string) || (isProd ? 'https://inklly.onrender.com/api/v1' : 'http://localhost:4000/api/v1')).replace(/\/+$/, '');
    const batContent = `@echo off
chcp 65001 >nul
set "INKLLY_SERVER_URL=${serverUrl}"
set "INKLLY_SHOP_ID=${shopId}"
set "INKLLY_PAIRING_CODE=${pairingCode}"
set "INKLLY_AGENT_PORT=8765"
if not exist "InkllyAgent.exe" (
  echo Place this script beside the InkllyAgent.exe application first.
  pause
  exit /b 1
)
start "Inklly Agent" "InkllyAgent.exe"
`;
    const blob = new Blob([batContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Inklly-Agent-Setup-win-x64.bat';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerSaveNotification(`One-time setup script downloaded. Pairing code expires ${new Date(expiresAt).toLocaleTimeString()}.`);
    } catch (error) {
      triggerSaveNotification(error instanceof Error ? error.message : 'Could not create pairing code.');
    }
  };

  const handleToggleChecklist = (key: string) => {
    setChecklistStatus((prev) => {
      const current = prev[key] || { status: 'Ready', ready: true };
      const nextReady = !current.ready;
      return {
        ...prev,
        [key]: {
          status: nextReady ? 'Ready' : 'Review',
          ready: nextReady,
        },
      };
    });
  };

  const handleRequestWithdrawal = () => {
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt < 100) {
      setWithdrawToast('⚠️ Minimum withdrawal threshold is ₹100.00.');
      setTimeout(() => setWithdrawToast(null), 3500);
      return;
    }
    if (amt > withdrawAvailable) {
      setWithdrawToast('⚠️ Requested amount exceeds available balance.');
      setTimeout(() => setWithdrawToast(null), 3500);
      return;
    }
    const fee = amt * 0.02;
    const net = amt - fee;
    setWithdrawAvailable((prev) => Math.max(0, prev - amt));
    setWithdrawGross((prev) => Math.max(0, prev - amt));
    setWithdrawFee((prev) => prev + fee);
    const newId = `WTH-${Date.now().toString().slice(-8)}`;
    const newEntry = {
      id: newId,
      date: 'Today, Just now',
      method: withdrawMethod === 'upi' ? `UPI (${upiId || 'shop@upi'})` : 'Bank Transfer',
      amount: `₹${amt.toFixed(2)}`,
      status: 'Processing Settlement',
    };
    setWithdrawHistory((prev) => [newEntry, ...prev]);
    setWithdrawToast(`Withdrawal request of ₹${amt.toFixed(2)} submitted. ₹${net.toFixed(2)} net will settle to your bank account.`);
    setWithdrawAmount('');
    setTimeout(() => setWithdrawToast(null), 4000);
  };

  const handleClaimReferralBonus = () => {
    if (referralBonusClaimable <= 0) return;
    setWithdrawAvailable((prev) => prev + referralBonusClaimable);
    setWithdrawGross((prev) => prev + referralBonusClaimable);
    setReferralBonusClaimable(0);
    setCopiedReferralToast(true);
    setTimeout(() => setCopiedReferralToast(false), 3500);
  };

  const handleRequestReferralWithdrawal = () => {
    const amt = parseFloat(referralWithdrawAmount);
    if (isNaN(amt) || amt < 100) {
      setOrderActionToast('⚠️ Minimum referral payout threshold is ₹100.00.');
      setTimeout(() => setOrderActionToast(null), 3500);
      return;
    }
    setOrderActionToast(`Referral withdrawal request of ₹${amt.toFixed(2)} submitted.`);
    setReferralWithdrawAmount('');
    setTimeout(() => setOrderActionToast(null), 4000);
  };

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;
    const newId = `emp-${Date.now().toString().slice(-4)}`;
    setEmployeeList((prev) => [
      ...prev,
      {
        id: newId,
        name: newEmpName.trim(),
        phone: newEmpPhone.trim() || '+91 90000 00000',
        role: newEmpRole,
        shift: newEmpShift,
        status: 'Active',
      },
    ]);
    setShowAddEmpModal(false);
    setNewEmpName('');
    setNewEmpPhone('');
    setOrderActionToast(`Employee account for ${newEmpName} provisioned with counter QR.`);
    setTimeout(() => setOrderActionToast(null), 3000);
  };

  const handleDeleteEmployee = (empId: string) => {
    setEmployeeList((prev) => prev.filter((e) => e.id !== empId));
    setOrderActionToast('Employee account revoked.');
    setTimeout(() => setOrderActionToast(null), 3000);
  };

  // Order Counts & Filtered Lists
  const pendingOrders = ordersList.filter((o) => o.tab === 'pending');
  const processingOrders = ordersList.filter((o) => o.tab === 'processing');
  const printingOrders = ordersList.filter((o) => o.tab === 'printing');
  const rejectedOrders = ordersList.filter((o) => o.tab === 'rejected');
  const failedOrders = ordersList.filter((o) => o.tab === 'print_failed');
  const doneOrders = ordersList.filter((o) => o.tab === 'done');

  const activeFilteredOrders = ordersList
    .filter((o) => (ordersTab === 'all' ? true : o.tab === ordersTab))
    .filter((o) => {
      if (!orderSearchQuery.trim()) return true;
      const q = orderSearchQuery.toLowerCase();
      return (
        o.id.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.phone.toLowerCase().includes(q) ||
        o.document.toLowerCase().includes(q)
      );
    });

  const filteredOrdersTotalRevenue = activeFilteredOrders
    .reduce((sum, o) => sum + (parseFloat(o.amount.replace('₹', '')) || 0), 0)
    .toFixed(2);

  const filteredOrdersTotalPages = activeFilteredOrders.reduce((sum, o) => sum + (o.pages || 0), 0);

  const totalRevenueNumber = ordersList
    .filter((o) => o.tab === 'done')
    .reduce((acc, o) => acc + (parseFloat(o.amount.replace('₹', '')) || 0), 0)
    .toFixed(2);

  const handleTestChatSend = () => {
    if (!testChatMessage.trim()) return;
    const userMsg = testChatMessage;
    setTestChatMessage('');
    setChatLog((prev) => [
      ...prev,
      { sender: 'user', text: userMsg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ]);

    setTimeout(() => {
      let botReply = 'I can help with printing, prices, services, and order status. Please send a print-related question.';
      if (userMsg.toLowerCase().includes('hi') || userMsg.toLowerCase().includes('hello')) {
        botReply = '👋 Welcome to Printing Shopz. Upload your document here: https://inklly.in/p/campus1';
      } else if (userMsg.toLowerCase().includes('price') || userMsg.toLowerCase().includes('rate')) {
        botReply = `Our A4 B&W is ₹${rateBwSingle}/page (Duplex ₹${rateBwDuplex}/side) and Colour is ₹${rateColorSingle}/page.`;
      }
      setChatLog((prev) => [
        ...prev,
        { sender: 'bot', text: botReply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]);
    }, 400);
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <PackageIcon size={18} /> },
    { id: 'orders', label: 'Orders', icon: <InboxIcon size={18} /> },
    { id: 'live_print', label: 'Live Print', icon: <WifiIcon size={18} /> },
    { id: 'whatsapp_setup', label: 'WhatsApp Setup', icon: <WhatsAppIcon size={18} /> },
    { id: 'storage', label: 'Storage', icon: <StoreIcon size={18} /> },
    { id: 'credits', label: 'Credits', icon: <DollarSignIcon size={18} /> },
    { id: 'withdraw', label: 'Withdraw', icon: <IndianRupeeIcon size={18} /> },
    { id: 'referrals', label: 'Referrals', icon: <UsersIcon size={18} /> },
    { id: 'employees', label: 'Employees', icon: <UsersIcon size={18} /> },
    { id: 'train_bot', label: 'Train Bot', icon: <SlidersIcon size={18} /> },
    { id: 'business_setup', label: 'Business Setup', icon: <StoreIcon size={18} /> },
    { id: 'shop_qr', label: 'Shop QR', icon: <QrCodeIcon size={18} /> },
  ];

  return (
    <div className={`min-h-screen flex ${darkMode ? 'dark bg-[#0F172A] text-white' : 'bg-[#F4F6FC] text-[#172031]'}`}>
      {/* ─────────────────────────────────────────────────────────────
          2.1 LEFT SIDEBAR (Expanded w-64 or Collapsed w-20)
      ───────────────────────────────────────────────────────────── */}
      {/* Mobile Backdrop when off-canvas drawer is open */}
      {sidebarExpanded && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-40 md:hidden animate-fade-in"
          onClick={() => setSidebarExpanded(false)}
        />
      )}

      <aside
        className={`bg-white dark:bg-[#1E293B] border-r border-[#E8EAF3] dark:border-gray-800 flex flex-col justify-between transition-all duration-300 z-50 select-none ${
          sidebarExpanded
            ? 'fixed inset-y-0 left-0 w-72 p-4 shadow-2xl md:static md:w-64 md:shadow-none translate-x-0'
            : 'hidden md:flex md:w-20 p-3 items-center'
        }`}
      >
        <div>
          {/* Logo & Collapse Header */}
          <div className="flex items-center justify-between pb-4 mb-3 border-b border-gray-100 dark:border-gray-800">
            {sidebarExpanded ? (
              <div
                onClick={() => onNavigate && onNavigate('/')}
                className="cursor-pointer"
                title="Go to Inklly Home"
              >
                <Logo size={22} />
              </div>
            ) : (
              <div
                onClick={() => onNavigate && onNavigate('/')}
                className="cursor-pointer mx-auto flex items-center justify-center"
                title="Inklly"
              >
                <InkllyMark size={28} />
              </div>
            )}
            <button
              type="button"
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <ChevronRightIcon size={16} className={`transition-transform duration-200 ${sidebarExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Nav Items List */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id as any)}
                  className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all duration-150 ${
                    sidebarExpanded ? 'gap-3 px-3.5 py-2.5 text-left' : 'p-2.5 justify-center'
                  } ${
                    isActive
                      ? 'bg-[#4E65F6] text-white shadow-xs font-bold'
                      : 'text-[#5B6475] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[#172031]'
                  }`}
                  title={!sidebarExpanded ? item.label : undefined}
                >
                  <span className={isActive ? 'text-white' : 'text-slate-500 dark:text-gray-400'}>
                    {item.icon}
                  </span>
                  {sidebarExpanded && (
                    <div className="flex items-center justify-between flex-1 min-w-0">
                      <span className="truncate">{item.label}</span>
                      {item.id === 'orders' && (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span
                            className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                              isActive ? 'bg-white text-[#4E65F6]' : 'bg-[#4E65F6] text-white'
                            }`}
                          >
                            3
                          </span>
                          <span className={`text-[10px] ${isActive ? 'text-white/80' : 'text-gray-400'}`}>▾</span>
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom: Dark Mode Toggle & Log Out */}
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className={`w-full flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white rounded-xl p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
              sidebarExpanded ? '' : 'justify-center'
            }`}
          >
            <span>{darkMode ? <SunIcon size={16} /> : <MoonIcon size={16} />}</span>
            {sidebarExpanded && <span>{darkMode ? 'Light mode' : 'Dark mode'}</span>}
          </button>

          <button
            type="button"
            onClick={() => {
              if (onNavigate) {
                onNavigate('/login');
              } else {
                window.location.href = '/login';
              }
            }}
            className={`w-full flex items-center gap-2.5 text-xs font-bold text-red-600 bg-[#FEE2E2] hover:bg-[#FECACA] dark:bg-red-950/40 dark:text-red-400 rounded-xl p-2.5 transition-colors ${
              sidebarExpanded ? 'justify-start' : 'justify-center'
            }`}
          >
            <LogOutIcon size={16} />
            {sidebarExpanded && <span>Log Out</span>}
          </button>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          MAIN CONTENT AREA
      ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* 2.2 TOP BAR */}
        <header className="bg-white dark:bg-[#1E293B] border-b border-[#E8EAF3] dark:border-gray-800 min-h-16 py-2 px-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3 sticky top-0 z-30 shadow-2xs">
          {/* Left section: Toggle & Merchant Title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors shrink-0"
              title="Toggle sidebar"
            >
              <MenuIcon size={18} />
            </button>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                MERCHANT COUNTER OS
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-[#172031] dark:text-white leading-tight truncate">
                {currentMerchant.name}
              </h2>
            </div>
          </div>

          {/* Right section: Demo Merchant Switcher, Tour, Actions */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Scale Plan Multi-Branch Switcher */}
            {currentMerchant.multiBranchEnabled && currentMerchant.branches && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 rounded-xl text-xs">
                <span className="text-[10px] font-extrabold text-sky-700 dark:text-sky-300 uppercase">Branch:</span>
                <select
                  value={activeBranch}
                  onChange={(e) => {
                    setActiveBranch(e.target.value);
                    setGlobalToast(`Switched counter to: ${e.target.value}`);
                  }}
                  className="bg-transparent font-bold text-sky-900 dark:text-sky-100 outline-none text-xs cursor-pointer"
                >
                  {(currentMerchant as any).branches?.map((b: string) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Real Merchant Shop Identity & Plan Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-linear-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/60 dark:to-purple-950/60 shadow-xs text-xs">
              <span className="font-extrabold text-indigo-950 dark:text-indigo-200 truncate max-w-[150px]">
                {currentMerchant.name}
              </span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-indigo-600 text-white uppercase shrink-0">
                {currentMerchant.planBadge || 'STARTER · ₹99/mo'}
              </span>
            </div>

            {/* Live Edge Agent Status Pill */}
            <button
              type="button"
              onClick={() => checkAgentHealth(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs ${
                agentOnline
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
              }`}
              title={agentOnline ? 'Edge Print Agent Online on http://127.0.0.1:8765 (Click to re-check)' : 'Edge Agent Offline (Click to test local connection)'}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${agentOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{agentOnline ? 'Agent Online' : 'Agent Offline'}</span>
            </button>

            {/* Fast Counter Standee QR Pill */}
            <button
              type="button"
              onClick={() => setActiveView('shop_qr')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 font-bold text-xs hover:bg-indigo-50 transition-colors shadow-xs cursor-pointer"
              title="Open Counter QR Standee view"
            >
              <span>📱</span>
              <span>Shop QR</span>
            </button>

            {/* Product Tour Button */}
            <button
              type="button"
              onClick={handleStartTour}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 text-[#4D64E6] dark:text-indigo-300 font-bold text-xs hover:bg-indigo-100 transition-colors cursor-pointer shadow-xs"
              title="Take interactive product tour"
            >
              <span>✨</span>
              <span>Tour</span>
            </button>

            {/* Plan Upgrade Trigger */}
            <button
              type="button"
              onClick={() => onNavigate?.('/pricing')}
              className="px-3.5 py-1.5 bg-[#4F46E5] hover:bg-indigo-600 text-white rounded-full text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1 transition-all"
              title="View pilot pricing"
            >
              <span>Pilot pricing</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 transition-colors"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <SunIcon size={15} /> : <MoonIcon size={15} />}
            </button>

            {/* Profile Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-1.5 p-1 pl-1.5 pr-2.5 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-[#4E65F6] text-white flex items-center justify-center font-bold text-xs">
                  {currentMerchant.name.charAt(0)}
                </div>
                <div className="text-left text-xs leading-tight hidden lg:block">
                  <div className="font-bold text-[#172031] dark:text-white truncate max-w-28">{currentMerchant.ownerName}</div>
                </div>
                <ChevronDownIcon size={12} className="text-slate-400" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1E293B] border border-[#E8EAF3] dark:border-gray-800 rounded-xl shadow-xl py-1 text-xs z-50">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('business_setup');
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                  >
                    <SlidersIcon size={14} /> Business settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('shop_qr');
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                  >
                    <QrCodeIcon size={14} /> Shop QR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('orders');
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                  >
                    <InboxIcon size={14} /> Orders
                  </button>
                  <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      localStorage.removeItem('inklly_token');
                      localStorage.removeItem('inklly_user');
                      localStorage.removeItem('inklly_shop');
                      if (onNavigate) {
                        onNavigate('/login');
                      } else {
                        window.location.href = '/login';
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2"
                  >
                    <LogOutIcon size={14} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Top Product Tour Banner */}
        {showTourBanner && (
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-6 py-2.5 flex items-center justify-between text-xs shadow-xs animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="text-base">🚀</span>
              <span>
                <strong>Welcome to Inklly!</strong> Get your shop completely ready to accept print orders and connect your printer in 5 guided steps.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleStartTour}
                className="px-3 py-1 bg-white text-[#4D64E6] rounded-lg font-bold shadow-xs hover:bg-blue-50 transition-all cursor-pointer"
              >
                Start 2-Min Tour →
              </button>
              <button
                type="button"
                onClick={() => setShowTourBanner(false)}
                className="text-white/80 hover:text-white text-xs cursor-pointer"
                title="Dismiss banner"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            VIEW 1: DASHBOARD (Matching Screenshot 2026-10-23 074343.png)
        ───────────────────────────────────────────────────────────── */}
        {activeView === 'dashboard' && (
          <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
            {/* Sub-header notice & Currency Dropdown */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
              <p>Order counts include all currencies. Revenue totals show INR only; no currency conversion.</p>
              <div className="flex items-center gap-3">
                {/* Subtle Toggle: Screenshot Parity (Empty initial) vs Live Demo Orders */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setScreenshotEmptyMode(true)}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      screenshotEmptyMode
                        ? 'bg-white dark:bg-slate-700 text-[#4E65F6] font-bold shadow-xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                    title="Render exact initial 0-orders state matching reference screenshot"
                  >
                    Screenshot Parity (0)
                  </button>
                  <button
                    type="button"
                    onClick={() => setScreenshotEmptyMode(false)}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      !screenshotEmptyMode
                        ? 'bg-white dark:bg-slate-700 text-[#4E65F6] font-bold shadow-xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                    title="Render active live orders with full metrics"
                  >
                    Live Orders ({ordersList.length})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span>Revenue currency</span>
                  <select
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 4 Top Colorful Stat Cards matching Screenshot 2026-10-23 074343.png */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Today's Revenue (Blue Gradient #4E65F6) */}
              <div className="rounded-2xl p-5 bg-gradient-to-br from-[#4E65F6] to-[#5C72FA] text-white shadow-xs flex flex-col justify-between h-36">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-100">Today's Revenue</span>
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
                    <TrendingUpIcon size={16} />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-extrabold tracking-tight">
                    ₹{screenshotEmptyMode ? '0.00' : totalRevenueNumber}
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-blue-100 mt-1">
                    <span>Completed orders · INR</span>
                    <span className="bg-white/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <TrendingUpIcon size={11} /> <span>—</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Total Orders Processed (Warm Gold/Yellow Gradient #FFB72B) */}
              <div className="rounded-2xl p-5 bg-gradient-to-br from-[#FFB72B] to-[#FFC44D] text-white shadow-xs flex flex-col justify-between h-36">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-50">Total Orders Processed</span>
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
                    <PrinterIcon size={16} />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-extrabold tracking-tight text-white">
                    {screenshotEmptyMode ? 0 : ordersList.length}
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-amber-50 mt-1">
                    <span>Completed prints for your shop</span>
                    <span className="bg-white/20 px-2 py-0.5 rounded-full font-bold text-white flex items-center gap-1">
                      <TrendingUpIcon size={11} /> <span>—</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Pending Orders (Coral Red Gradient #FF5C60) */}
              <div className="rounded-2xl p-5 bg-gradient-to-br from-[#FF5C60] to-[#FF7074] text-white shadow-xs flex flex-col justify-between h-36">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-50">Pending Orders</span>
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
                    <ClockIcon size={16} />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-extrabold tracking-tight text-white">
                    {screenshotEmptyMode ? 0 : pendingOrders.length}
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-rose-50 mt-1">
                    <span>Awaiting print action</span>
                    <span className="bg-white/20 px-2 py-0.5 rounded-full font-bold text-white flex items-center gap-1">
                      <TrendingUpIcon size={11} /> <span>—</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 4: Completed (Emerald Green Gradient #10B981) */}
              <div className="rounded-2xl p-5 bg-gradient-to-br from-[#10B981] to-[#14C38E] text-white shadow-xs flex flex-col justify-between h-36">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-50">Completed</span>
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
                    <CheckIcon size={16} />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-extrabold tracking-tight text-white">
                    {screenshotEmptyMode ? 0 : doneOrders.length}
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-emerald-50 mt-1">
                    <span>Orders printed & delivered</span>
                    <span className="bg-white/20 px-2 py-0.5 rounded-full font-bold text-white flex items-center gap-1">
                      <TrendingUpIcon size={11} /> <span>—</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Row (2/3 and 1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Orders This Week Area Chart (lg:col-span-8) */}
              <div className="lg:col-span-8 bg-white dark:bg-[#1E293B] border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Orders This Week</h3>
                    <p className="text-xs text-gray-400">
                      Total {screenshotEmptyMode ? 0 : ordersList.length} orders · ₹{screenshotEmptyMode ? '0.00' : totalRevenueNumber} revenue
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-0.5 rounded-full border border-slate-200/80 dark:border-slate-700 flex text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setDashboardMetricToggle('orders')}
                      className={`px-3 py-1 rounded-full transition-all ${
                        dashboardMetricToggle === 'orders'
                          ? 'bg-[#EEF2FF] text-[#4E65F6] font-bold shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Orders
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardMetricToggle('revenue')}
                      className={`px-3 py-1 rounded-full transition-all ${
                        dashboardMetricToggle === 'revenue'
                          ? 'bg-[#EEF2FF] text-[#4E65F6] font-bold shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Revenue
                    </button>
                  </div>
                </div>

                {/* SVG Area Chart with 4-3-2-1-0 Ticks matching Screenshot */}
                <div className="h-44 w-full pt-2">
                  <div className="relative h-full flex">
                    {/* Y-axis ticks */}
                    <div className="flex flex-col justify-between text-[10px] font-semibold text-gray-400 pr-3 pb-5">
                      <span>4</span>
                      <span>3</span>
                      <span>2</span>
                      <span>1</span>
                      <span>0</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-between relative">
                      <svg viewBox="0 0 500 110" className="w-full h-28 overflow-visible">
                        <line x1="0" y1="5" x2="500" y2="5" stroke="#E2E8F0" strokeDasharray="3 3" />
                        <line x1="0" y1="28" x2="500" y2="28" stroke="#E2E8F0" strokeDasharray="3 3" />
                        <line x1="0" y1="52" x2="500" y2="52" stroke="#E2E8F0" strokeDasharray="3 3" />
                        <line x1="0" y1="75" x2="500" y2="75" stroke="#E2E8F0" strokeDasharray="3 3" />
                        <line x1="0" y1="98" x2="500" y2="98" stroke="#4E65F6" strokeWidth="2" />

                        {ordersList.length === 0 ? (
                          <>
                            <line x1="15" y1="98" x2="485" y2="98" stroke="#4E65F6" strokeWidth="2" />
                            {[15, 93, 171, 250, 328, 406, 485].map((cx, i) => (
                              <circle key={i} cx={cx} cy="98" r="3.5" fill="#4E65F6" stroke="#fff" strokeWidth="1" />
                            ))}
                          </>
                        ) : (
                          <>
                            <defs>
                              <linearGradient id="orderChartGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#4E65F6" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#4E65F6" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            <polygon
                              points="15,98 93,65 171,40 250,55 328,25 406,45 485,15 485,98 15,98"
                              fill="url(#orderChartGrad)"
                            />
                            <polyline
                              points="15,98 93,65 171,40 250,55 328,25 406,45 485,15"
                              fill="none"
                              stroke="#4E65F6"
                              strokeWidth="2.5"
                            />
                            {[
                              { cx: 15, cy: 98 },
                              { cx: 93, cy: 65 },
                              { cx: 171, cy: 40 },
                              { cx: 250, cy: 55 },
                              { cx: 328, cy: 25 },
                              { cx: 406, cy: 45 },
                              { cx: 485, cy: 15 },
                            ].map((pt, i) => (
                              <circle key={i} cx={pt.cx} cy={pt.cy} r="4" fill="#4E65F6" stroke="#fff" strokeWidth="1.5" />
                            ))}
                          </>
                        )}
                      </svg>
                      <div className="flex justify-between text-[11px] font-semibold text-gray-400 mt-1 px-1">
                        <span>Sun</span>
                        <span>Mon</span>
                        <span>Tue</span>
                        <span>Wed</span>
                        <span>Thu</span>
                        <span>Fri</span>
                        <span>Sat</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Status (lg:col-span-4) matching Screenshot 2026-10-23 074343.png */}
              <div className="lg:col-span-4 bg-white dark:bg-[#1E293B] border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Order Status</h3>
                  <p className="text-xs text-gray-400">
                    {screenshotEmptyMode ? 0 : ordersList.length} total orders
                  </p>
                </div>

                {screenshotEmptyMode ? (
                  <div className="my-auto py-8 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
                      <PackageIcon size={24} />
                    </div>
                    <h4 className="text-sm font-bold text-[#172031] dark:text-white">No orders yet</h4>
                    <p className="text-xs text-gray-400 mt-0.5">Status breakdown appears here</p>
                  </div>
                ) : (
                  <>
                    <div className="my-auto py-4 flex items-center justify-center">
                      <div className="relative w-32 h-32 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <path
                            className="text-gray-200 dark:text-gray-700"
                            strokeWidth="3.8"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="text-[#4E65F6]"
                            strokeDasharray="60, 100"
                            strokeWidth="3.8"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute text-center">
                          <div className="text-xl font-extrabold text-[#172031] dark:text-white">{ordersList.length}</div>
                          <div className="text-[10px] text-gray-400">Total</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                          <span className="text-gray-600 dark:text-gray-300">Pending Actions</span>
                        </div>
                        <span className="font-bold">{pendingOrders.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                          <span className="text-gray-600 dark:text-gray-300">Printing / Processing</span>
                        </div>
                        <span className="font-bold">{printingOrders.length + processingOrders.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                          <span className="text-gray-600 dark:text-gray-300">Completed</span>
                        </div>
                        <span className="font-bold">{doneOrders.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                          <span className="text-gray-600 dark:text-gray-300">Failed / Rejected</span>
                        </div>
                        <span className="font-bold">{failedOrders.length + rejectedOrders.length}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bottom Row (1/3 and 2/3) matching Screenshot 2026-10-23 074343.png */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Monthly Revenue Chart (lg:col-span-4) */}
              <div className="lg:col-span-4 bg-white dark:bg-[#1E293B] border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Monthly Revenue</h3>
                  <p className="text-xs text-gray-400">Last 7 months · INR</p>
                </div>

                <div className="h-44 w-full pt-4">
                  <div className="relative h-full flex">
                    {/* Y-axis ticks */}
                    <div className="flex flex-col justify-between text-[10px] font-semibold text-gray-400 pr-2 pb-5">
                      <span>4</span>
                      <span>3</span>
                      <span>2</span>
                      <span>1</span>
                      <span>0</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-between relative">
                      <svg viewBox="0 0 300 110" className="w-full h-28 overflow-visible">
                        <line x1="0" y1="5" x2="300" y2="5" stroke="#E2E8F0" strokeDasharray="3 3" />
                        <line x1="0" y1="28" x2="300" y2="28" stroke="#E2E8F0" strokeDasharray="3 3" />
                        <line x1="0" y1="52" x2="300" y2="52" stroke="#E2E8F0" strokeDasharray="3 3" />
                        <line x1="0" y1="75" x2="300" y2="75" stroke="#E2E8F0" strokeDasharray="3 3" />
                        <line x1="0" y1="98" x2="300" y2="98" stroke="#4E65F6" strokeWidth="2" />

                        {ordersList.length === 0 ? (
                          <>
                            <line x1="15" y1="98" x2="285" y2="98" stroke="#4E65F6" strokeWidth="2" />
                            {[15, 60, 105, 150, 195, 240, 285].map((cx, i) => (
                              <circle key={i} cx={cx} cy="98" r="3" fill="#4E65F6" />
                            ))}
                          </>
                        ) : (
                          <>
                            <polyline
                              points="15,98 60,82 105,70 150,60 195,45 240,32 285,20"
                              fill="none"
                              stroke="#4E65F6"
                              strokeWidth="2.5"
                            />
                            {[
                              { cx: 15, cy: 98 },
                              { cx: 60, cy: 82 },
                              { cx: 105, cy: 70 },
                              { cx: 150, cy: 60 },
                              { cx: 195, cy: 45 },
                              { cx: 240, cy: 32 },
                              { cx: 285, cy: 20 },
                            ].map((pt, i) => (
                              <circle key={i} cx={pt.cx} cy={pt.cy} r="3.5" fill="#4E65F6" stroke="#fff" strokeWidth="1.5" />
                            ))}
                          </>
                        )}
                      </svg>
                      <div className="flex justify-between text-[11px] font-semibold text-gray-400 mt-1 px-1">
                        <span>Apr</span>
                        <span>May</span>
                        <span>Jun</span>
                        <span>Jul</span>
                        <span>Aug</span>
                        <span>Sep</span>
                        <span>Oct</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Orders (lg:col-span-8) */}
              <div className="lg:col-span-8 bg-white dark:bg-[#1E293B] border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Recent Orders</h3>
                    <p className="text-xs text-gray-400">Today's incoming orders</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveView('orders')}
                    className="px-4 py-2 bg-[#4E65F6] hover:bg-[#3F54D1] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                  >
                    <span>Open Order Handler</span>
                    <span>→</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-[#172031] dark:text-gray-200">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-left">
                        <th className="pb-3 px-2">CUSTOMER</th>
                        <th className="pb-3 px-2">DOCUMENT</th>
                        <th className="pb-3 px-2">STATUS</th>
                        <th className="pb-3 px-2 text-right">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordersList.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-12 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
                              <InboxIcon size={24} />
                            </div>
                            <h4 className="text-sm font-bold text-[#172031] dark:text-white">No orders yet</h4>
                            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                              Incoming print orders from your WhatsApp number will show up here in real time.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        ordersList.map((ord) => (
                          <tr key={ord.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-50 dark:border-gray-800/60">
                            <td className="py-3 px-2 font-semibold">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold">
                                  O#
                                </span>
                                <div>
                                  <div>{ord.customer}</div>
                                  <div className="text-[10px] text-gray-400">{ord.time}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-2 font-medium text-gray-700 dark:text-gray-300 truncate max-w-xs">
                              {ord.document} ({ord.pages}p)
                            </td>
                            <td className="py-3 px-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                ● {ord.status}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-right font-extrabold text-[#172031] dark:text-white">
                              {ord.amount}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            VIEW 2: ORDERS (Order Queue - Matching Screenshot 2026-10-23 074435.png)
        ───────────────────────────────────────────────────────────── */}
        {activeView === 'orders' && (
          <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
            {/* Header with Stats matching Screenshot */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold">
                  <ClockIcon size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                    ORDER QUEUE
                  </span>
                  <h2 className="text-xl font-extrabold text-[#172031] dark:text-white capitalize">
                    {ordersTab === 'all'
                      ? 'All Orders'
                      : ordersTab === 'print_failed'
                      ? 'Print Failed Orders'
                      : `${ordersTab} Orders`}
                  </h2>
                  <p className="text-xs text-gray-400">
                    {ordersTab === 'pending' && 'New and downloaded orders awaiting merchant action'}
                    {ordersTab === 'processing' && 'Rasterized documents ready for local edge spooler'}
                    {ordersTab === 'printing' && 'Print jobs currently spooling or outputting on hardware'}
                    {ordersTab === 'rejected' && 'Orders rejected by merchant or customer'}
                    {ordersTab === 'print_failed' && 'Hardware alert: paper jams, spooler faults (OUTPUT_UNCERTAIN)'}
                    {ordersTab === 'done' && 'Completed and delivered print orders'}
                    {ordersTab === 'all' && 'Comprehensive archive of all orders across every status'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:gap-6 text-right">
                <button
                  type="button"
                  onClick={fetchLiveOrdersFromApi}
                  disabled={isRefreshingOrders}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all flex items-center gap-1.5 border border-indigo-200 cursor-pointer shadow-xs disabled:opacity-50"
                  title="Force refresh order queue from server"
                >
                  <span className={isRefreshingOrders ? 'animate-spin' : ''}>🔄</span>
                  <span>{isRefreshingOrders ? 'Syncing...' : 'Refresh'}</span>
                  <span className="text-[10px] text-indigo-400 font-normal hidden sm:inline">({lastOrderSyncTime})</span>
                </button>
                <div>
                  <div className="text-lg font-extrabold text-[#172031] dark:text-white">
                    {screenshotEmptyMode ? 0 : activeFilteredOrders.length}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-gray-400">ORDERS</div>
                </div>
                <div>
                  <div className="text-lg font-extrabold text-[#172031] dark:text-white">
                    ₹{screenshotEmptyMode ? '0.00' : filteredOrdersTotalRevenue}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-gray-400">REVENUE</div>
                </div>
                <div>
                  <div className="text-lg font-extrabold text-[#172031] dark:text-white">
                    {screenshotEmptyMode ? 0 : filteredOrdersTotalPages}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-gray-400">PAGES</div>
                </div>
              </div>
            </div>

            {/* Order Action Feedback Banner */}
            {orderActionToast && (
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-semibold text-blue-800 dark:text-blue-200 flex items-center justify-between shadow-xs animate-fadeIn">
                <div className="flex items-center gap-2">
                  <span>⚡</span>
                  <span>{orderActionToast}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOrderActionToast(null)}
                  className="text-blue-500 hover:text-blue-800 dark:hover:text-blue-100 font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Tab Pills with Counts matching Screenshot */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOrdersTab('pending')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  ordersTab === 'pending' ? 'bg-[#4E65F6] text-white shadow-xs' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                }`}
              >
                Pending {screenshotEmptyMode ? 0 : pendingOrders.length}
              </button>
              <button
                type="button"
                onClick={() => setOrdersTab('processing')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  ordersTab === 'processing' ? 'bg-[#4E65F6] text-white shadow-xs' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                }`}
              >
                Processing {screenshotEmptyMode ? 0 : processingOrders.length}
              </button>
              <button
                type="button"
                onClick={() => setOrdersTab('printing')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  ordersTab === 'printing' ? 'bg-[#4E65F6] text-white shadow-xs' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                }`}
              >
                Printing {screenshotEmptyMode ? 0 : printingOrders.length}
              </button>
              <button
                type="button"
                onClick={() => setOrdersTab('rejected')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  ordersTab === 'rejected' ? 'bg-[#4E65F6] text-white shadow-xs' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                }`}
              >
                Rejected {screenshotEmptyMode ? 0 : rejectedOrders.length}
              </button>
              <button
                type="button"
                onClick={() => setOrdersTab('print_failed')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  ordersTab === 'print_failed' ? 'bg-[#4E65F6] text-white shadow-xs' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                }`}
              >
                Print Failed {screenshotEmptyMode ? 0 : failedOrders.length}
              </button>
              <button
                type="button"
                onClick={() => setOrdersTab('done')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  ordersTab === 'done' ? 'bg-[#4E65F6] text-white shadow-xs' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                }`}
              >
                Done {screenshotEmptyMode ? 0 : doneOrders.length}
              </button>
              <button
                type="button"
                onClick={() => setOrdersTab('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  ordersTab === 'all' ? 'bg-[#4E65F6] text-white shadow-xs' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                }`}
              >
                All Orders {screenshotEmptyMode ? 0 : ordersList.length}
              </button>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <SearchIcon size={14} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  placeholder="Search order ID, name, phone or file…"
                  className="w-full pl-9 pr-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-xs bg-white dark:bg-gray-800 outline-none focus:border-[#4E65F6]"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {orderSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setOrderSearchQuery('')}
                    className="text-xs font-bold text-gray-500 hover:text-black dark:hover:text-white px-2 py-1"
                  >
                    Clear Search ✕
                  </button>
                )}
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs bg-white dark:bg-gray-800 font-bold outline-none cursor-pointer"
                >
                  <option value="today">Today</option>
                  <option value="specific">Specific date</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                  <option value="all">All time</option>
                </select>
              </div>
            </div>

            {/* Table or Empty State */}
            {activeFilteredOrders.length > 0 ? (
              <div className="bg-white dark:bg-[#1E293B] border border-[#E8EAF3] dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 w-10">
                        <input type="checkbox" className="rounded text-[#4D64E6]" />
                      </th>
                      <th className="py-3 px-4">CUSTOMER & CONTACT</th>
                      <th className="py-3 px-4">DOCUMENTS</th>
                      <th className="py-3 px-4">STATUS</th>
                      <th className="py-3 px-4">PRICE</th>
                      <th className="py-3 px-4 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {activeFilteredOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="py-4 px-4">
                          <input type="checkbox" className="rounded text-[#4D64E6]" />
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-blue-100 text-[#4D64E6] dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold">
                              {ord.customer.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <div className="font-bold text-[#172031] dark:text-white flex items-center gap-1.5">
                                <span>{ord.customer}</span>
                                <span className="text-[10px] text-purple-600 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.2 rounded font-mono font-semibold">
                                  #{ord.id}
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-400">{ord.time} · {ord.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-red-50 text-red-600 font-extrabold px-1.5 py-0.5 rounded text-[9px]">PDF</span>
                            <span className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-xs">{ord.document}</span>
                            <span className="text-gray-400 text-[10px]">({ord.pages}p · {ord.copies}x)</span>
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {ord.colorMode} · {ord.duplex}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {ord.tab === 'pending' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center gap-1.5 w-max">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Awaiting Action
                            </span>
                          )}
                          {ord.tab === 'processing' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex items-center gap-1.5 w-max">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              Rasterizing & Ready
                            </span>
                          )}
                          {ord.tab === 'printing' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 flex items-center gap-1.5 w-max">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping" />
                              Spooling to Hardware
                            </span>
                          )}
                          {ord.tab === 'rejected' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-center gap-1.5 w-max">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Rejected by Merchant
                            </span>
                          )}
                          {ord.tab === 'print_failed' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 flex items-center gap-1.5 w-max">
                              <span>⚠️</span>
                              Paper Jam Alert
                            </span>
                          )}
                          {ord.tab === 'done' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 flex items-center gap-1.5 w-max">
                              <span>✓</span>
                              Completed & Delivered
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-bold text-gray-900 dark:text-white">
                          <div className="text-green-600 dark:text-green-400">{ord.amount}</div>
                          <div className="text-[9px] text-gray-400 font-normal">{ord.paymentMode}</div>
                        </td>
                        <td className="py-4 px-4 text-right space-x-1.5">
                          {ord.tab === 'pending' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setSelectedOrder(ord)}
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all border border-indigo-200 cursor-pointer shadow-xs"
                                title="Review Customer Order Specifications"
                              >
                                Review
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOneClickPrint(ord.id)}
                                className="px-3 py-1.5 rounded-lg bg-[#4D64E6] hover:bg-[#3F54D1] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                              >
                                Print
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMarkCollected(ord.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all cursor-pointer"
                                title="Mark Order as Completed & Delivered"
                              >
                                ✓ Complete
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectOrder(ord.id)}
                                className="px-2 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-all cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {(ord.tab === 'processing' || ord.tab === 'printing') && (
                            <>
                              <button
                                type="button"
                                onClick={() => setSelectedOrder(ord)}
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all border border-indigo-200 cursor-pointer shadow-xs"
                              >
                                Review
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMarkCollected(ord.id)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                              >
                                ✓ Complete Order
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOneClickPrint(ord.id)}
                                className="px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-xs font-bold transition-all cursor-pointer"
                              >
                                Re-Spool
                              </button>
                            </>
                          )}
                          {ord.tab === 'print_failed' && (
                            <button
                              type="button"
                              onClick={() => handleRetryPrint(ord.id)}
                              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                            >
                              Clear Jam & Retry
                            </button>
                          )}
                          {ord.tab === 'done' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setSelectedOrder(ord)}
                                className="px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 text-xs font-bold transition-all cursor-pointer"
                              >
                                Details
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOneClickPrint(ord.id)}
                                className="px-2 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 text-xs font-bold transition-all cursor-pointer"
                              >
                                Reprint
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-24 text-center">
                <div className="w-10 h-10 rounded-full border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <ClockIcon size={18} />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                  {ordersTab === 'pending'
                    ? 'No pending orders right now'
                    : `No ${ordersTab.replace('_', ' ')} orders right now`}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  {ordersTab === 'pending'
                    ? 'Orders will appear here as they arrive'
                    : 'Orders will update here automatically as status changes'}
                </p>
                {orderSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setOrderSearchQuery('')}
                    className="mt-4 px-4 py-2 bg-[#4D64E6] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Clear search filter
                  </button>
                )}
              </div>
            )}

            {/* Order Detail Modal / Drawer */}
            {selectedOrder && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn">
                <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#4D64E6] flex items-center justify-center font-bold text-xs">
                        #{selectedOrder.id}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-[#172031] dark:text-white">Order #{selectedOrder.id} Details</h3>
                        <p className="text-[10px] text-gray-400">{selectedOrder.time || '11:26 am'} · Token INK-{selectedOrder.id}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(null)}
                      className="text-gray-400 hover:text-black dark:hover:text-white text-lg font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Customer</span>
                      <div className="font-bold text-gray-900 dark:text-white">{selectedOrder.customer || 'Customer'}</div>
                      <div className="text-gray-400 text-[10px]">{selectedOrder.phone || '+91 98765 43210'}</div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Payment Mode</span>
                      <div className="font-bold text-green-600 dark:text-green-400">{selectedOrder.amount || '₹0.00'}</div>
                      <div className="text-gray-400 text-[10px]">{selectedOrder.paymentMode || 'Cash on Collection'}</div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-2 text-xs">
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Document & Print Options</span>
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded text-[9px]">PDF</span>
                      <span className="truncate">{selectedOrder.document || selectedOrder.name}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-gray-600 dark:text-gray-300">
                      <div><strong>Pages:</strong> {selectedOrder.pageRangeDisplay || `${selectedOrder.pages}p`}</div>
                      <div><strong>Copies:</strong> {selectedOrder.copies || 1} set(s)</div>
                      <div><strong>Color Mode:</strong> {selectedOrder.colorMode || 'Black & White'}</div>
                      <div><strong>Duplex:</strong> {selectedOrder.duplex || 'Single Sided'}</div>
                      <div><strong>Orientation:</strong> {selectedOrder.orientation || 'Portrait'} {selectedOrder.rotation ? `(${selectedOrder.rotation}°)` : ''}</div>
                      <div><strong>Paper:</strong> {selectedOrder.paperSize || 'A4'}</div>
                    </div>
                    {selectedOrder.customerNote && (
                      <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 mt-2">
                        <strong>Customer Instructions:</strong> {selectedOrder.customerNote}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleOneClickPrint(selectedOrder.id);
                        setSelectedOrder(null);
                      }}
                      className="flex-1 py-2.5 bg-[#4D64E6] hover:bg-[#3F54D1] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>🖨️</span>
                      <span>Let it Print (Dispatch)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarkCollected(selectedOrder.id)}
                      className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>✓</span>
                      <span>Complete Order</span>
                    </button>
                    {selectedOrder.tab === 'pending' && (
                      <button
                        type="button"
                        onClick={() => {
                          handleRejectOrder(selectedOrder.id);
                          setSelectedOrder(null);
                        }}
                        className="px-3.5 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            VIEW 3: LIVE PRINT
        ───────────────────────────────────────────────────────────── */}
        {activeView === 'live_print' && (
          <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  🖨️
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-[#172031] dark:text-white">Live Print</h2>
                  <p className="text-xs text-gray-400">Printers & queues</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search printers or orders..."
                    value={livePrintSearch}
                    onChange={(e) => setLivePrintSearch(e.target.value)}
                    className="w-56 pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  />
                  <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔍</span>
                </div>
                <select
                  value={livePrintFilter}
                  onChange={(e) => setLivePrintFilter(e.target.value as any)}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-pointer"
                >
                  <option value="all">Show all</option>
                  <option value="working">Working only</option>
                  <option value="alerts">Alerts only</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setOrderActionToast('Printers & Spoolers polled on port 8765: 2 active devices online.');
                    setTimeout(() => setOrderActionToast(null), 3000);
                  }}
                  className="px-3.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs">
                <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">WORKING PRINTERS</span>
                <span className={`text-3xl font-extrabold ${screenshotEmptyMode ? 'text-gray-900 dark:text-white' : 'text-green-600'}`}>
                  {screenshotEmptyMode ? 0 : 2}
                </span>
                <span className="text-[10px] text-gray-400 block mt-1">
                  {screenshotEmptyMode ? '0 of 0 connected' : '2 of 2 connected on Inklly Agent'}
                </span>
              </div>
              <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs">
                <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">PRINTING NOW</span>
                <span className={`text-3xl font-extrabold ${screenshotEmptyMode ? 'text-gray-900 dark:text-white' : 'text-blue-600'}`}>
                  {screenshotEmptyMode ? 0 : printingOrders.length}
                </span>
                <span className="text-[10px] text-gray-400 block mt-1">Active jobs in hardware buffer</span>
              </div>
              <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs">
                <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">WAITING TO PRINT</span>
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                  {screenshotEmptyMode ? 0 : pendingOrders.length + processingOrders.length}
                </span>
                <span className="text-[10px] text-gray-400 block mt-1">Pending approval & spooling</span>
              </div>
            </div>

            {/* Offline or Empty State Card */}
            {screenshotEmptyMode ? (
              <div className="p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl text-center shadow-xs">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 text-2xl">
                  ⚠️
                </div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white mb-1">
                  No working printers online
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-5 leading-relaxed">
                  Start desktop agent: The Inklly desktop agent runs locally on your PC to connect to physical printers. No working printers detected on your network or Inklly Agent. Please verify the Inklly Agent is running and connected.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('business_setup');
                      setSetupTab('printers');
                    }}
                    className="px-4 py-2 bg-[#4D64E6] hover:bg-[#3F54D1] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Open Printers Setup →
                  </button>
                  <button
                    type="button"
                    onClick={() => setScreenshotEmptyMode(false)}
                    className="px-4 py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Toggle Demo Printers
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Connected Printers Hardware Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-xs space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                          <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">HP LaserJet Pro M401dne</h3>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            DEFAULT B&W
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">USB Local Port 8765 · Edge Spooler Daemon</p>
                      </div>
                      <span className="text-xs font-bold text-green-600">Online & Ready</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <span className="text-[10px] text-gray-400 font-bold block">TRAY 1 (A4 Plain)</span>
                        <div className="font-extrabold mt-0.5">85% Full</div>
                      </div>
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <span className="text-[10px] text-gray-400 font-bold block">TRAY 2 (Legal)</span>
                        <div className="font-extrabold mt-0.5">40% Full</div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={() => {
                          triggerSaveNotification('HP M401dne Calibration Test Page dispatched');
                        }}
                        className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Test Print 📄
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPrinterPausedMap((prev) => ({ ...prev, 'p-hp-401': !prev['p-hp-401'] }));
                          setOrderActionToast(printerPausedMap['p-hp-401'] ? 'HP M401dne queue resumed.' : 'HP M401dne queue paused.');
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          printerPausedMap['p-hp-401']
                            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {printerPausedMap['p-hp-401'] ? 'Resume Queue' : 'Pause Queue'}
                      </button>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-xs space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                          <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Canon imageRUNNER ADVANCE C3530i</h3>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                            COLOUR A3/A4
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">Network IP 192.168.1.120:9100 · High Volume</p>
                      </div>
                      <span className="text-xs font-bold text-green-600">Online & Ready</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <span className="text-[10px] text-gray-400 font-bold block">TRAY 1 (A4 Glossy)</span>
                        <div className="font-extrabold mt-0.5">92% Full</div>
                      </div>
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <span className="text-[10px] text-gray-400 font-bold block">TRAY 2 (A3 Heavy)</span>
                        <div className="font-extrabold mt-0.5">65% Full</div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={() => {
                          triggerSaveNotification('Canon C3530i Colour Calibration Sheet dispatched');
                        }}
                        className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Test Print 📄
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPrinterPausedMap((prev) => ({ ...prev, 'p-canon-c3530': !prev['p-canon-c3530'] }));
                          setOrderActionToast(printerPausedMap['p-canon-c3530'] ? 'Canon C3530i queue resumed.' : 'Canon C3530i queue paused.');
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          printerPausedMap['p-canon-c3530']
                            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {printerPausedMap['p-canon-c3530'] ? 'Resume Queue' : 'Pause Queue'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Active Spool Queue Table */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Active Print Buffer</h3>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {printingOrders.length} Spooling · {pendingOrders.length} Queued
                    </span>
                  </div>
                  {printingOrders.length > 0 || processingOrders.length > 0 ? (
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 dark:bg-gray-800/60 border-b text-[10px] font-bold text-gray-400 uppercase">
                        <tr>
                          <th className="py-3 px-4">TICKET</th>
                          <th className="py-3 px-4">DOCUMENT & CUSTOMER</th>
                          <th className="py-3 px-4">PRINTER ASSIGNED</th>
                          <th className="py-3 px-4">PROGRESS</th>
                          <th className="py-3 px-4 text-right">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {printingOrders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                            <td className="py-3 px-4 font-mono font-bold text-purple-600">TKT-{ord.id}</td>
                            <td className="py-3 px-4">
                              <div className="font-bold">{ord.document}</div>
                              <div className="text-[10px] text-gray-400">{ord.customer} · {ord.pages}p</div>
                            </td>
                            <td className="py-3 px-4 text-gray-600 dark:text-gray-300 font-medium">
                              HP LaserJet Pro M401dne
                            </td>
                            <td className="py-3 px-4">
                              <div className="w-40 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div className="bg-purple-600 h-2 rounded-full animate-pulse w-3/4" />
                              </div>
                              <span className="text-[10px] text-purple-600 font-bold block mt-1">Printing Page 3 of {ord.pages}</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleRejectOrder(ord.id)}
                                className="px-2.5 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg text-xs font-bold"
                              >
                                Cancel Spool
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-xs text-gray-400">
                      All printer spool queues are idle. Incoming print jobs will appear here in real-time.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            VIEW 4: WHATSAPP SETUP
        ───────────────────────────────────────────────────────────── */}
        {activeView === 'whatsapp_setup' && (
          <div className="p-6 max-w-5xl w-full mx-auto space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-800">
              <div>
                {!currentMerchant.whatsappBotEnabled && (
              <div className="mb-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <span className="text-xl">🔒</span>
                  <div>
                    <span className="font-bold text-amber-900 dark:text-amber-200 block">
                      Dedicated WhatsApp Bot is Locked on Starter Plan (₹99/mo)
                    </span>
                    <span className="text-amber-700 dark:text-amber-300 text-[11px]">
                      Automated student document intake over WhatsApp is included in <strong>Growth (₹199/mo)</strong> and <strong>Pro (₹499/mo)</strong>.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSwitchMerchant('merchant-growth-monthly')}
                  className="px-3.5 py-1.5 bg-[#4D64E6] hover:bg-[#3F54D1] text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
                >
                  ⚡ Upgrade to Growth (₹199/mo)
                </button>
              </div>
            )}
            <h2 className="text-xl font-extrabold text-[#172031] dark:text-white">WhatsApp setup</h2>
                <p className="text-xs text-gray-400">Connect your shop's official WhatsApp Business number</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  whatsappConnected
                    ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${whatsappConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                {whatsappConnected ? '● Connected (+91 98765 00000)' : '● Not connected'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Connect with Facebook */}
              <div className="md:col-span-7 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-8 h-8 rounded-lg bg-[#1877F2] text-white flex items-center justify-center font-bold text-sm">f</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                    RECOMMENDED
                  </span>
                </div>
                <h3 className="font-extrabold text-base mb-1 text-[#172031] dark:text-white">Connect with Facebook</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">Official Meta WhatsApp Cloud API connection for your shop.</p>

                <div className="space-y-3 mb-6">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 cursor-pointer">
                    <input type="radio" name="fb_mode" defaultChecked className="text-blue-600" />
                    <div>
                      <div className="text-xs font-bold text-gray-900 dark:text-white">Existing business number</div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">Connect a dedicated SIM registered on WhatsApp Business</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer">
                    <input type="radio" name="fb_mode" className="text-blue-600" />
                    <div>
                      <div className="text-xs font-bold text-gray-900 dark:text-white">Display name</div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">Request Meta verified green tick display name</div>
                    </div>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => triggerSaveNotification('WhatsApp integration is not connected to Meta yet. QR portal ordering is available now.')}
                  className="w-full py-3 bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
                >
                  {whatsappConnected ? 'Re-link with Facebook Cloud API' : 'Continue with Facebook'}
                </button>
              </div>

              {/* Connect by QR */}
              <div className="md:col-span-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 text-center flex flex-col justify-between shadow-xs">
                <div>
                  <h3 className="font-extrabold text-base mb-1 text-[#172031] dark:text-white">OR Login with QR code</h3>
                  <p className="text-xs text-gray-400 mb-4">Alternative · scan with your phone</p>

                  <div className="w-48 h-48 mx-auto bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center p-3 mb-4 relative overflow-hidden">
                    <div className="w-32 h-32 bg-[#172031] rounded-xl flex items-center justify-center text-white text-[9px] font-mono p-1">
                      [WHATSAPP QR]
                    </div>
                    {/* Scanning cyan bar */}
                    <div className="absolute inset-x-4 top-8 h-1 bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
                    <span className="text-[10px] text-gray-400 mt-2">WhatsApp → Linked devices</span>
                  </div>
                </div>

                <div className="space-y-2 border-t border-gray-100 dark:border-gray-700 pt-3">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{whatsappQrTimer}s countdown</span>
                    <button
                      type="button"
                      onClick={() => setOrderActionToast('WhatsApp pairing is unavailable until the Meta integration is configured.')}
                      className="font-bold text-[#4D64E6] cursor-pointer"
                    >
                      Refresh QR
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerSaveNotification('WhatsApp device pairing is not available until the Meta integration is configured.')}
                    className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    WhatsApp pairing unavailable
                  </button>
                </div>
              </div>
            </div>

            {/* Your accounts Card */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-xs">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Your accounts</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  whatsappConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {whatsappConnected ? '1 Account Paired' : '0 Accounts'}
                </span>
              </div>
              {whatsappConnected ? (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 rounded-xl flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-green-500 text-white flex items-center justify-center font-bold text-xs">WA</span>
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white">+91 98765 43210</div>
                      <div className="text-[10px] text-gray-400">Meta Cloud API · Printing Shopz Official</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWhatsappConnected(false);
                      setOrderActionToast('WhatsApp account unlinked.');
                    }}
                    className="text-red-600 hover:underline text-xs font-bold cursor-pointer"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="p-5 text-center text-xs text-gray-400 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                  No WhatsApp account connected yet. Pair your WhatsApp number above to start receiving customer print files directly.
                </div>
              )}
            </div>

            {/* Setup help Accordion */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-xs">
              <button
                type="button"
                onClick={() => setWhatsappHelpOpen(!whatsappHelpOpen)}
                className="w-full flex items-center justify-between text-xs font-extrabold text-left cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className="text-blue-600 font-bold">▶</span> Setup help
                </span>
                <span className="text-gray-400">{whatsappHelpOpen ? '▲ Hide' : '▼ Expand'}</span>
              </button>
              {whatsappHelpOpen && (
                <ol className="mt-4 space-y-2 text-xs text-gray-600 dark:text-gray-300 list-decimal list-inside border-t border-gray-100 dark:border-gray-700 pt-3">
                  <li>Open WhatsApp on your mobile phone</li>
                  <li>Tap Settings (iOS) or Menu ⋮ (Android) and choose <strong>Linked Devices</strong></li>
                  <li>Tap <strong>Link a Device</strong> and verify biometric or PIN</li>
                  <li>Point your phone camera at the QR code above to establish an encrypted session</li>
                </ol>
              )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            VIEW 5: STORAGE
        ───────────────────────────────────────────────────────────── */}
        {activeView === 'storage' && (
          <div className="p-6 max-w-6xl w-full mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
              <div>
                <h2 className="text-xl font-extrabold text-[#172031] dark:text-white">Permanent Local Storage</h2>
                <p className="text-xs text-gray-400">
                  Files reside only on this merchant computer via Inklly Agent (localhost:8765)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setGlobalToast('The permanent file vault is not available. Customer files remain private and are deleted 24 hours after order completion.')}
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  📁 Select local folder
                </button>
                <button
                  type="button"
                  onClick={() => setGlobalToast('Permanent document categories are not available in this pilot.')}
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  + New category
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGlobalToast('Receive documents through a customer order so private storage, pricing, and 24-hour deletion are tracked.');
                  }}
                  className="px-3.5 py-1.5 bg-[#4D64E6] hover:bg-[#3F54D1] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Upload files
                </button>
              </div>
            </div>

            {/* Storage Agent Status Banner */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="font-bold">No permanent customer file vault</span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">· Customer files are temporary order documents</span>
              </div>
              <span className="font-mono text-[10px] bg-white dark:bg-gray-800 px-2 py-0.5 rounded font-bold">24 HOUR RETENTION</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Categories & File List */}
              <div className="md:col-span-7 space-y-4">
                {/* Category Pills */}
                <div className="flex flex-wrap gap-2">
                  {storageCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedStorageCategory(cat.id);
                        setSelectedStorageFile(null);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedStorageCategory === cat.id
                          ? 'bg-[#4D64E6] text-white shadow-xs'
                          : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {cat.name} ({storageFiles[cat.id]?.length || 0})
                    </button>
                  ))}
                </div>

                {/* File List for Selected Category */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-xs">
                  <div className="p-3.5 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center text-xs font-bold">
                    <span>Documents in {storageCategories.find((c) => c.id === selectedStorageCategory)?.name}</span>
                    <span className="text-[10px] text-gray-400 uppercase">
                      {storageFiles[selectedStorageCategory]?.length || 0} Files
                    </span>
                  </div>

                  <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
                    {storageFiles[selectedStorageCategory] && storageFiles[selectedStorageCategory].length > 0 ? (
                      storageFiles[selectedStorageCategory].map((file) => (
                        <div
                          key={file.id}
                          onClick={() => setSelectedStorageFile(file)}
                          className={`p-3.5 flex items-center justify-between text-xs cursor-pointer transition-all ${
                            selectedStorageFile?.id === file.id
                              ? 'bg-blue-50 dark:bg-blue-950/40 border-l-4 border-l-[#4D64E6]'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded text-[9px]">PDF</span>
                            <div>
                              <div className="font-bold text-gray-900 dark:text-white truncate max-w-xs">{file.name}</div>
                              <div className="text-[10px] text-gray-400">
                                {file.pages} pages · {file.size} · {file.date}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintStorageFile(file);
                            }}
                            className="px-2.5 py-1 bg-[#4D64E6] hover:bg-[#3F54D1] text-white rounded-lg text-[11px] font-bold shadow-xs cursor-pointer"
                          >
                            Print 🖨️
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-xs text-gray-400">
                        No files in this category yet. Click "Upload files" above to add documents.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview & Print Options */}
              <div className="md:col-span-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col justify-between shadow-xs min-h-[350px]">
                {selectedStorageFile ? (
                  <div className="space-y-4">
                    <div className="pb-3 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Selected Document</span>
                      <h3 className="font-extrabold text-sm text-[#172031] dark:text-white mt-1 break-all">
                        {selectedStorageFile.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                        <span>{selectedStorageFile.pages} pages</span>
                        <span>·</span>
                        <span>{selectedStorageFile.size}</span>
                        <span>·</span>
                        <span>{selectedStorageFile.type}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-2 text-xs">
                      <span className="text-[10px] font-bold uppercase text-gray-400 block">Dispatch Settings</span>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div><strong>Target:</strong> HP LaserJet Pro M401dne</div>
                        <div><strong>Format:</strong> B&W Duplex</div>
                        <div><strong>Paper:</strong> A4 Standard</div>
                        <div><strong>Est. Cost:</strong> ₹{(selectedStorageFile.pages * 1.2).toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-center text-gray-400 text-xs">
                      📄 Document Preview Rendered Locally
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePrintStorageFile(selectedStorageFile)}
                      className="w-full py-3 bg-[#4D64E6] hover:bg-[#3F54D1] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
                    >
                      Send to Spooler (Print Now) →
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center my-auto text-center p-6 text-gray-400 text-xs space-y-2">
                    <span className="text-3xl block">📑</span>
                    <span className="font-bold text-gray-600 dark:text-gray-300">No document selected</span>
                    <p className="text-[11px] max-w-xs">Click on any file from the categories list on the left to preview and dispatch print jobs.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
    VIEW 6: CREDITS
───────────────────────────────────────────────────────────── */}
{false && activeView === 'credits' && (
  <div className="p-6 max-w-5xl w-full mx-auto space-y-6 animate-fadeIn">
    <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#4D64E6] block">YOUR PLAN</span>
        <h2 className="text-xl font-extrabold text-[#172031] dark:text-white">Conversion credits</h2>
        <p className="text-xs text-gray-400">Credits are used by document conversion during your current billing period.</p>
      </div>
      <button
        type="button"
        onClick={() => triggerSaveNotification('Credits balance refreshed')}
        className="p-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs hover:bg-gray-50 text-gray-500"
      >
        🔄
      </button>
    </div>

    {creditPurchaseToast && (
      <div className="p-3 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-xl text-xs font-semibold text-green-800 dark:text-green-200 shadow-xs animate-fadeIn">
        ✓ {creditPurchaseToast}
      </div>
    )}

    {/* 4 Stat Cards */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xs">
        <div className="text-xs font-bold text-gray-400">Remaining</div>
        <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">50</div>
      </div>
      <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xs">
        <div className="text-xs font-bold text-gray-400">Used</div>
        <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">0</div>
      </div>
      <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xs">
        <div className="text-xs font-bold text-gray-400">Included in plan</div>
        <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">50</div>
      </div>
      <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xs">
        <div className="text-xs font-bold text-gray-400">Purchased</div>
        <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">0</div>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
      {/* Add more credits card */}
      <div className="md:col-span-7 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3 border-b pb-3">
          <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
            🔗
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Add more credits</h3>
            <p className="text-[11px] text-gray-400">₹1.00 per credit, configured for Starter.</p>
          </div>
        </div>

        {/* Quantity Pills */}
        <div className="flex gap-2">
          {[100, 500, 1000, 5000].map((qty) => (
            <button
              key={qty}
              type="button"
              onClick={() => setCreditQuantity(qty)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                creditQuantity === qty
                  ? 'bg-[#4D64E6] text-white border-[#4D64E6] shadow-xs'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
              }`}
            >
              {qty.toLocaleString()}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Custom quantity</label>
          <input
            type="number"
            value={creditQuantity}
            onChange={(e) => setCreditQuantity(Math.max(1, parseInt(e.target.value) || 0))}
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs bg-white dark:bg-gray-900 font-bold"
          />
        </div>

        <div className="flex justify-between items-center p-3.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-bold">
          <span className="text-gray-600 dark:text-gray-400">Payment total</span>
          <span className="text-base font-black text-gray-900 dark:text-white">₹{creditQuantity}.00</span>
        </div>

        <button
          type="button"
          onClick={() => handlePurchaseCredits(creditQuantity)}
          className="w-full py-3 bg-[#4D64E6] hover:bg-[#3D52D5] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
        >
          <span>🔗</span> Pay and add credits
        </button>
      </div>

      {/* Credit policy card */}
      <div className="md:col-span-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 space-y-3 text-xs text-gray-500 shadow-xs">
        <div className="flex items-center gap-2 border-b pb-2">
          <span className="text-emerald-500 font-bold text-base">🛡️</span>
          <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Credit policy</h3>
        </div>
        <p className="leading-relaxed">Plan and purchased credits apply to the current billing period.</p>
        <p className="leading-relaxed">Payment verification is idempotent; the same Razorpay order cannot add credits twice.</p>
        <p className="leading-relaxed">Unused purchased credits expire when the current billing period ends.</p>
        <div className="pt-2 text-[11px] text-gray-400 border-t border-gray-100 dark:border-gray-700">
          Period ends 11/23/2026, 12:00:00 AM.
        </div>
      </div>
    </div>
  </div>
)}

{activeView === 'credits' && (
  <section className="mx-auto my-10 max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
    <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Pilot billing</p>
    <h2 className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">Usage billing is not active yet</h2>
    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">The pilot will use a monthly subscription plus a configurable fee for each successfully printed side. Inkly does not currently sell conversion credits, so this page will not show a balance or take payment.</p>
    <button type="button" onClick={() => onNavigate?.('/pricing')} className="mt-6 min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700">View pilot pricing</button>
  </section>
)}

{/* ─────────────────────────────────────────────────────────────
    VIEW 7: WITHDRAW EARNINGS
───────────────────────────────────────────────────────────── */}
{false && activeView === 'withdraw' && (
  <div className="p-6 max-w-5xl w-full mx-auto space-y-6 animate-fadeIn">
    <div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#4D64E6] block">MERCHANT FINANCE</span>
      <h2 className="text-xl font-extrabold text-[#172031] dark:text-white">Withdraw earnings</h2>
      <p className="text-xs text-gray-400 mt-0.5">
        Platform withdrawals use legacy INR accounting; changing your shop currency does not convert that balance. Direct merchant collections are shown separately in their original currencies.
      </p>
    </div>

    {withdrawToast && (
      <div className="p-3 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-xl text-xs font-semibold text-green-800 dark:text-green-200 shadow-xs animate-fadeIn">
        ✓ {withdrawToast}
      </div>
    )}

    {/* 4 Stat Cards */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xs">
        <div className="text-[11px] text-gray-400 font-bold">Available after commission</div>
        <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">₹0.00</div>
      </div>
      <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xs">
        <div className="text-[11px] text-gray-400 font-bold">Gross available</div>
        <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">₹0.00</div>
      </div>
      <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xs">
        <div className="text-[11px] text-gray-400 font-bold">Razorpay commission</div>
        <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">₹0.00</div>
      </div>
      <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xs">
        <div className="text-[11px] text-gray-400 font-bold">Settled directly to your payment account</div>
        <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">₹0.00</div>
        <div className="text-[10px] text-gray-400 leading-tight mt-1">
          Already paid to your account; it is not part of the withdrawable platform balance.
        </div>
      </div>
    </div>

    {/* Form & History Side-by-Side */}
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
      {/* Form */}
      <div className="md:col-span-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b pb-2">
          <span>⬇</span>
          <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">New withdrawal</h3>
        </div>

        <div>
          <span className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Receive money by</span>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setWithdrawMethod('upi')}
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                withdrawMethod === 'upi'
                  ? 'border-[#4D64E6] bg-blue-50/50 dark:bg-blue-950/40 text-[#4D64E6]'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600'
              }`}
            >
              <span>📱</span> UPI
            </button>
            <button
              type="button"
              onClick={() => setWithdrawMethod('bank')}
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                withdrawMethod === 'bank'
                  ? 'border-[#4D64E6] bg-blue-50/50 dark:bg-blue-950/40 text-[#4D64E6]'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600'
              }`}
            >
              <span>🏦</span> Bank account
            </button>
          </div>
        </div>

        <div className="p-3 border rounded-xl flex justify-between items-center text-xs bg-gray-50 dark:bg-gray-900">
          <span className="font-medium text-gray-800 dark:text-gray-200">7349568649@kotak811</span>
          <button type="button" className="text-[#4D64E6] font-bold underline text-[11px]">Edit</button>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Gross amount</label>
          <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white dark:bg-gray-800">
            <span className="text-gray-400 font-bold">₹</span>
            <input
              type="text"
              placeholder="Minimum ₹100"
              className="w-full text-xs font-medium outline-hidden bg-transparent"
            />
          </div>
        </div>

        <div className="space-y-1.5 text-xs pt-1 border-t">
          <div className="flex justify-between text-gray-500">
            <span>Commission (2.50%)</span>
            <span>- ₹0.00</span>
          </div>
          <div className="flex justify-between font-bold text-emerald-600 text-sm">
            <span>You receive</span>
            <span>₹0.00</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => triggerSaveNotification('Withdrawal requested successfully')}
          className="w-full py-3 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-xs font-extrabold shadow-xs transition-all"
        >
          Request withdrawal
        </button>

        <p className="text-[10px] text-gray-400 leading-tight">
          ⏱ Manual settlement: after approval, the platform transfers funds by UPI or bank and updates every stage here.
        </p>
      </div>

      {/* Withdrawal history top-right */}
      <div className="md:col-span-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-xs min-h-[340px] flex flex-col">
        <h3 className="font-extrabold text-sm text-[#172031] dark:text-white border-b pb-3 mb-4">Withdrawal history</h3>
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
          No withdrawal requests yet.
        </div>
      </div>
    </div>

    {/* Bottom Section: Payment transactions and withdrawal history */}
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-6 shadow-xs space-y-6">
      <div className="flex justify-between items-center border-b pb-3">
        <div>
          <h3 className="font-extrabold text-base text-[#172031] dark:text-white">
            Payment transactions and withdrawal history
          </h3>
          <p className="text-[11px] text-gray-400">
            Verified order, Razorpay and withdrawal records. Dates use India Standard Time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => triggerSaveNotification('Transactions history refreshed')}
          className="p-1.5 border rounded-xl text-xs hover:bg-gray-50 text-gray-500"
        >
          🔄
        </button>
      </div>

      {/* Date Filter Pills */}
      <div className="flex gap-2">
        {['Today', 'Yesterday', 'Specific date', 'All time'].map((f, i) => (
          <button
            key={f}
            type="button"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              i === 0
                ? 'bg-[#4D64E6] text-white shadow-xs'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* 8 Stat Summary Boxes in 2 Rows of 4 */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {[
            { label: 'Orders', val: '0' },
            { label: 'Paid orders', val: '0' },
            { label: 'Order value', val: '₹0.00' },
            { label: 'Collected', val: '₹0.00' },
          ].map((s) => (
            <div key={s.label} className="p-4 bg-gray-50 dark:bg-gray-900 border rounded-2xl">
              <div className="text-[11px] text-gray-400 font-bold">{s.label}</div>
              <div className="text-xl font-black text-gray-900 dark:text-white mt-1">{s.val}</div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-gray-400 italic">
          Order totals are separated by currency. Platform withdrawals use legacy INR accounting; changing your shop currency does not convert that balance.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {[
            { label: 'Lifetime platform collection', val: '₹0.00' },
            { label: 'Reserved / withdrawn', val: '₹0.00' },
            { label: 'Available gross', val: '₹0.00' },
            { label: 'Available after commission', val: '₹0.00' },
          ].map((s) => (
            <div key={s.label} className="p-4 bg-gray-50 dark:bg-gray-900 border rounded-2xl">
              <div className="text-[11px] text-gray-400 font-bold">{s.label}</div>
              <div className="text-xl font-black text-gray-900 dark:text-white mt-1">{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-table 1: Payment transactions */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden space-y-2 p-4">
        <div className="flex items-center gap-2 font-bold text-xs text-[#172031] dark:text-white">
          <span>💳</span> Payment transactions
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b text-[10px] font-bold text-gray-400 uppercase">
              <tr>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Order / document</th>
                <th className="py-2 px-3">Customer</th>
                <th className="py-2 px-3">Razorpay payment ID</th>
                <th className="py-2 px-3">Amount</th>
                <th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400 text-xs">
                  No Razorpay transactions in this period.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Sub-table 2: Withdrawal history */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-4 space-y-3">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-2 font-bold text-[#172031] dark:text-white">
            <span>📅</span> Withdrawal history
          </div>
          <select className="px-2.5 py-1 border rounded-lg text-xs font-medium bg-white dark:bg-gray-900">
            <option>All statuses</option>
          </select>
        </div>

        <div className="py-8 text-center text-gray-400 text-xs">
          No withdrawals in this period.
        </div>

        <div className="flex justify-end items-center gap-2 text-xs text-gray-400 pt-2 border-t">
          <button type="button" className="p-1 hover:text-gray-600">&lt;</button>
          <span>Page 1 of 1</span>
          <button type="button" className="p-1 hover:text-gray-600">&gt;</button>
        </div>
      </div>
    </div>
  </div>
)}

{activeView === 'withdraw' && (
  <section className="mx-auto my-10 max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
    <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Shop settlements</p>
    <h2 className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">Your customer payments go directly to your shop</h2>
    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Inklly does not hold customer payments or run merchant payouts. Razorpay payments settle to the Razorpay account connected to this shop; cash payments are collected at your counter. Payout requests are unavailable.</p>
    <button type="button" onClick={() => setActiveView('business_setup')} className="mt-6 min-h-11 rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100">Review payment setup</button>
  </section>
)}

{/* ─────────────────────────────────────────────────────────────
    VIEW 8: REFERRALS
───────────────────────────────────────────────────────────── */}
{false && activeView === 'referrals' && (
  <div className="p-6 max-w-5xl w-full mx-auto space-y-6 animate-fadeIn">
    <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#4D64E6] block">
          MERCHANT REWARDS
        </span>
        <h2 className="text-xl font-extrabold text-[#172031] dark:text-white">Referrals</h2>
      </div>
      <button
        type="button"
        onClick={() => triggerSaveNotification('Referral status refreshed')}
        className="p-2 border rounded-xl text-xs hover:bg-gray-50 text-gray-500"
      >
        🔄
      </button>
    </div>

    {/* Referral Code Card */}
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-xs space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-blue-600 font-bold">🎁</span>
        <div>
          <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Your referral code</h3>
          <p className="text-[11px] text-gray-400">Share this permanent link with another print merchant.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <input
          type="text"
          readOnly
          value="62PPDMGQC"
          className="w-full sm:w-36 px-3 py-2 border rounded-xl text-xs font-mono font-bold bg-gray-50 dark:bg-gray-900 text-center"
        />
        <input
          type="text"
          readOnly
          value="https://inklly.in/register?ref=62PPDMGQC"
          className="w-full sm:flex-1 px-3 py-2 border rounded-xl text-xs font-mono text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText('https://inklly.in/register?ref=62PPDMGQC');
              triggerSaveNotification('Referral link copied!');
            }}
            className="p-2.5 bg-[#4F46E5] text-white rounded-xl text-xs"
            title="Copy link"
          >
            📋
          </button>
          <button
            type="button"
            onClick={() => triggerSaveNotification('QR code toggled')}
            className="px-3 py-2 border rounded-xl text-xs font-bold hover:bg-gray-50"
          >
            QR
          </button>
          <button
            type="button"
            onClick={() => triggerSaveNotification('Opening WhatsApp share...')}
            className="p-2.5 bg-emerald-600 text-white rounded-xl text-xs"
            title="Share on WhatsApp"
          >
            📱
          </button>
        </div>
      </div>
    </div>

    {/* 6 Stat Cards in a Row */}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {[
        { label: 'Locked', val: '₹0.00' },
        { label: 'Available', val: '₹0.00' },
        { label: 'Reserved', val: '₹0.00' },
        { label: 'Withdrawn', val: '₹0.00' },
        { label: 'Cancelled', val: '₹0.00' },
        { label: 'Reversed', val: '₹0.00' },
      ].map((s) => (
        <div key={s.label} className="p-4 bg-white dark:bg-gray-800 border rounded-2xl text-center shadow-xs">
          <div className="text-[11px] text-gray-400 font-bold">{s.label}</div>
          <div className="text-xl font-black text-gray-900 dark:text-white mt-1">{s.val}</div>
        </div>
      ))}
    </div>

    {/* Withdraw referral balance */}
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-xs space-y-3">
      <div className="flex items-center gap-2">
        <span>💳</span>
        <div>
          <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Withdraw referral balance</h3>
          <p className="text-[11px] text-gray-400">
            Minimum ₹500.00. This wallet is separate from print-order collections and uses the verified payout destination saved in Business Setup.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-2">
        <div className="sm:col-span-4">
          <input
            type="text"
            placeholder="Amount in INR"
            className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50 dark:bg-gray-900"
          />
        </div>
        <div className="sm:col-span-4">
          <select className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50 dark:bg-gray-900 font-medium">
            <option>UPI 73••••@kotak811</option>
          </select>
        </div>
        <div className="sm:col-span-4">
          <button
            type="button"
            onClick={() => triggerSaveNotification('Referral withdrawal requested')}
            className="w-full py-2.5 bg-[#4F46E5] text-white rounded-xl text-xs font-bold hover:bg-[#4338CA]"
          >
            Request withdrawal
          </button>
        </div>
      </div>
    </div>

    {/* Referred merchants section */}
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-xs space-y-2">
      <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Referred merchants</h3>
      <div className="py-6 text-xs text-gray-400">
        No referred merchants yet.
      </div>
    </div>

    {/* Referral earnings section */}
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-xs space-y-2">
      <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Referral earnings</h3>
      <div className="py-8 text-center text-xs text-gray-400">
        No referral earnings yet.
      </div>
    </div>

    {/* Withdrawal history section */}
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-xs space-y-2">
      <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Withdrawal history</h3>
      <div className="py-6 text-xs text-gray-400">
        No referral withdrawals yet.
      </div>
    </div>
  </div>
)}

{activeView === 'referrals' && (
  <section className="mx-auto my-10 max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
    <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Referral program</p>
    <h2 className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">Referral rewards are not available in the pilot</h2>
    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">No referral balance or reward has been issued. We will show this program here once eligibility and payment rules are live.</p>
  </section>
)}

{/* ─────────────────────────────────────────────────────────────
    VIEW 9: EMPLOYEES
───────────────────────────────────────────────────────────── */}
{activeView === 'employees' && (
  <div className="p-6 max-w-5xl w-full mx-auto space-y-6 animate-fadeIn">
    {/* Shift Cash Reconciliation Studio (Pro & Scale Feature) */}
    {currentMerchant.shiftReconciliationEnabled ? (
      <div className="bg-white dark:bg-gray-800 border-2 border-purple-200 dark:border-purple-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-gray-100 dark:border-gray-700">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">💵</span>
              <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">
                Daily Shift Cash Reconciliation & Register Z-Report
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                PRO FEATURE UNLOCKED
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Reconcile counter drawer cash against online UPI auto-settlements to prevent cashier shortages.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setGlobalToast('Shift Z-Report generated and exported to PDF')}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
          >
            📄 Export Shift Z-Report
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-gray-50 dark:bg-gray-900 border rounded-xl">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Opening Drawer Cash</span>
            <span className="font-extrabold text-sm text-gray-900 dark:text-white mt-1 block">₹1,000.00</span>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            <span className="text-emerald-700 dark:text-emerald-300 block text-[10px] uppercase font-bold">Counter Cash Collected</span>
            <span className="font-extrabold text-sm text-emerald-800 dark:text-emerald-200 mt-1 block">+₹3,450.00</span>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl">
            <span className="text-indigo-700 dark:text-indigo-300 block text-[10px] uppercase font-bold">Online UPI Auto-Settled</span>
            <span className="font-extrabold text-sm text-indigo-800 dark:text-indigo-200 mt-1 block">₹5,820.00</span>
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl">
            <span className="text-purple-700 dark:text-purple-300 block text-[10px] uppercase font-bold">Expected Drawer Balance</span>
            <span className="font-extrabold text-sm text-purple-900 dark:text-purple-200 mt-1 block">₹4,450.00</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 font-bold">✓ Cashier Shift Status:</span>
            <span className="font-bold text-gray-800 dark:text-gray-200">Balanced (Variance: ₹0.00)</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded-full">
            Ready for Handover
          </span>
        </div>
      </div>
    ) : (
      <div className="p-5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5">
          <span className="text-xl">🔒</span>
          <div>
            <span className="font-bold text-purple-950 dark:text-purple-200 block">
              Shift Cash Reconciliation is Locked on {currentMerchant.planBadge}
            </span>
            <span className="text-purple-700 dark:text-purple-300 text-[11px]">
              Daily register z-reports, opening/closing drawer balancing, and staff cash audit tools are included in <strong>Pro (₹499/mo)</strong> and <strong>Scale (₹899/mo)</strong>.
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleSwitchMerchant('merchant-pro-monthly')}
          className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
        >
          ⚡ Upgrade to Pro (₹499/mo)
        </button>
      </div>
    )}

    {/* Two Header Info Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-xs space-y-1">
        <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Independent computer setup</h3>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Each employee signs in separately, opens Business Setup → Printers, and prepares their own agent credentials. Connecting or replacing an employee agent does not replace the owner's connection.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-xs space-y-1">
        <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">One shared business</h3>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Use the main shop QR or an optional counter QR. Pricing, services and business preferences stay shared; authorized changes refresh across accounts without overwriting unsaved edits. Employee seats and printer connections follow the merchant's plan/add-on limits.
        </p>
      </div>
    </div>

    {/* Employees Card with Add button */}
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-xs space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            👥
          </div>
          <div>
            <h3 className="font-extrabold text-base text-[#172031] dark:text-white">Employees</h3>
            <p className="text-xs text-gray-400">Assign operational access and the main or a dedicated counter QR.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => triggerSaveNotification('Adding new employee...')}
          className="px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
        >
          <span>+</span> Add employee
        </button>
      </div>

      {/* New Employee Account Form Card */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-6 space-y-5 bg-gray-50/30 dark:bg-gray-900/30">
        <div className="flex justify-between items-center">
          <h4 className="font-extrabold text-sm text-[#172031] dark:text-white">New employee account</h4>
          <button type="button" className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Full name</label>
            <input type="text" className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Login email</label>
            <input type="email" className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Mobile number</label>
            <input type="text" defaultValue="4mh24cs017@gmail.com" className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Temporary password</label>
            <input type="password" defaultValue="password123456" className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-gray-800" />
          </div>
        </div>

        {/* Role Pills */}
        <div className="flex gap-2 pt-1">
          {['ORDER HANDLER', 'PRINT OPERATOR', 'MANAGER', 'CUSTOM'].map((r, i) => (
            <button
              key={r}
              type="button"
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                i === 0
                  ? 'border-[#4D64E6] text-[#4D64E6] bg-blue-50/50'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* 9 Permission Checkboxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {[
            { title: 'Orders', desc: 'View, configure, release and complete customer orders', checked: true },
            { title: 'Dashboard', desc: 'View shop activity and performance', checked: false },
            { title: 'Live Print', desc: 'Monitor printers and their active queues in real time', checked: true },
            { title: 'Employee agent & printers', desc: "Pair this employee's own computer and configure its printers without changing the owner's setup", checked: true },
            { title: 'Shared business setup', desc: 'Update shop-wide services, pricing, discounts and automation for both owner and employees', checked: false },
            { title: 'Shop QR', desc: 'View, download and test the assigned customer QR', checked: true },
            { title: 'Document storage', desc: 'Use documents stored on the connected shop computer', checked: true },
            { title: 'Train bot', desc: 'Manage customer questions and automated replies', checked: false },
          ].map((perm) => (
            <div key={perm.title} className="p-3 border rounded-xl bg-white dark:bg-gray-800 flex items-start gap-3">
              <input type="checkbox" defaultChecked={perm.checked} className="mt-1 rounded text-[#4D64E6]" />
              <div>
                <div className="font-bold text-[#172031] dark:text-white">{perm.title}</div>
                <div className="text-[10px] text-gray-400 leading-tight mt-0.5">{perm.desc}</div>
              </div>
            </div>
          ))}

          {/* Dedicated employee QR (Full width) */}
          <div className="sm:col-span-2 p-3 border rounded-xl bg-white dark:bg-gray-800 flex items-start gap-3">
            <input type="checkbox" className="mt-1 rounded text-[#4D64E6]" />
            <div>
              <div className="font-bold text-[#172031] dark:text-white">Dedicated employee QR</div>
              <div className="text-[10px] text-gray-400 leading-tight mt-0.5">
                Off uses the main shop QR. On creates a revocable counter QR with the same portal UI.
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end items-center gap-3 pt-3 border-t">
          <button type="button" className="px-4 py-2 border rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => triggerSaveNotification('Employee account saved successfully')}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
          >
            Save employee
          </button>
        </div>
      </div>

      {/* Empty State */}
      <div className="border border-gray-100 dark:border-gray-800 rounded-2xl py-12 text-center space-y-2">
        <span className="text-3xl block">🛡️</span>
        <div className="font-bold text-sm text-[#172031] dark:text-white">No employee accounts yet</div>
        <p className="text-xs text-gray-400">The merchant owner keeps full access.</p>
      </div>
    </div>
  </div>
)}


        {/* ─────────────────────────────────────────────────────────────
            VIEW 10: TRAIN BOT
        ───────────────────────────────────────────────────────────── */}
        {activeView === 'train_bot' && (
          <div className="p-6 max-w-7xl w-full mx-auto space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#4D64E6] block">
                  WHATSAPP AUTOMATION
                </span>
                <h2 className="text-xl font-extrabold text-[#172031] dark:text-white">Train Bot</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-full border border-blue-200 dark:border-blue-800">
                  Database + Q&A only
                </span>
                <button
                  type="button"
                  onClick={() => triggerSaveNotification('Bot cache refreshed')}
                  className="p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500"
                >
                  🔄
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Panel: Store Rules & Configuration */}
              <div className="lg:col-span-7 space-y-5">
                {/* Rules Card */}
                <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-5">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
                    <div>
                      <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Train Bot</h3>
                      <p className="text-[11px] text-gray-400">Merchant data and FAQ response configuration</p>
                    </div>
                  </div>

                  {/* Subtabs */}
                  <div className="flex gap-2 border-b border-gray-100 dark:border-gray-700 pb-3 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setBotTab('rules')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        botTab === 'rules'
                          ? 'bg-[#4D64E6] text-white shadow-xs'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white bg-gray-50 dark:bg-gray-900'
                      }`}
                    >
                      Store Rules
                    </button>
                    <button
                      type="button"
                      onClick={() => setBotTab('qa')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        botTab === 'qa'
                          ? 'bg-[#4D64E6] text-white shadow-xs'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white bg-gray-50 dark:bg-gray-900'
                      }`}
                    >
                      Instant Q&A Matrix
                    </button>
                  </div>

                  {/* Bot Status & Display Name */}
                  <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-[#172031] dark:text-white">Bot Status</div>
                        <div className="text-[11px] text-gray-400">Bot is live — responding to customer messages</div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                        ✓ Enabled
                      </span>
                    </div>

                    <div className="pt-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                        BOT DISPLAY NAME
                      </label>
                      <input
                        type="text"
                        defaultValue="Rahul S"
                        className="w-full px-3 py-2 border rounded-xl text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 font-medium"
                      />
                      <span className="text-[10px] text-gray-400 block mt-1">
                        Name shown in system prompts and internal analytics. Not visible to customers.
                      </span>
                    </div>
                  </div>

                  {/* Auto Greeting & Doc Received */}
                  <div className="space-y-4 text-xs">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block font-bold text-gray-700 dark:text-gray-300">
                          AUTO GREETING MESSAGE
                        </label>
                        <span className="text-[10px] text-gray-400">13/40 words</span>
                      </div>
                      <textarea
                        rows={2}
                        defaultValue="Welcome to {shop}. Upload your document here: {link} Link expires in 30 minutes."
                        className="w-full p-3 border rounded-xl text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-mono text-[11px]"
                      />
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        Sent with a fresh upload link when the customer says Hi/Hello. Keep &#123;shop&#125; and &#123;link&#125; where needed.
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block font-bold text-gray-700 dark:text-gray-300">
                          DOCUMENT RECEIVED MESSAGE
                        </label>
                        <span className="text-[10px] text-gray-400">14/40 words</span>
                      </div>
                      <textarea
                        rows={2}
                        defaultValue="We received {file}. Set your print options here: {link} Link expires in 30 minutes."
                        className="w-full p-3 border rounded-xl text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-mono text-[11px]"
                      />
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        Sent after a file arrives. Available placeholders: &#123;file&#125;, &#123;shop&#125;, and &#123;link&#125;.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Meta Cloud API Messages (Light green tint) */}
                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl p-6 shadow-xs space-y-4">
                  <div>
                    <h3 className="font-extrabold text-sm text-emerald-950 dark:text-emerald-200">
                      Meta Cloud API Messages
                    </h3>
                    <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400">
                      Used only for merchants connected through Meta. The secure customer/order URL is attached to the button automatically.
                    </p>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block font-bold text-gray-700 dark:text-gray-300">
                          META GREETING MESSAGE
                        </label>
                        <span className="text-[10px] text-gray-400">19/40 words</span>
                      </div>
                      <textarea
                        rows={2}
                        defaultValue="👋 Welcome to *{shop}* Drop your documents directly in this WhatsApp chat, or upload them using the portal below."
                        className="w-full p-3 border rounded-xl text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-mono text-[11px]"
                      />
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        Sent when a Meta customer says Hi/Hello. Placeholders: &#123;shop&#125;. WhatsApp bold text uses *single asterisks*.
                      </span>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                        GREETING BUTTON
                      </label>
                      <input
                        type="text"
                        defaultValue="Upload Document"
                        className="w-full px-3 py-2 border rounded-xl text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                      />
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        Opens a fresh secure upload portal. Maximum 20 characters.
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block font-bold text-gray-700 dark:text-gray-300">
                          ONE DOCUMENT RECEIVED
                        </label>
                        <span className="text-[10px] text-gray-400">13/40 words</span>
                      </div>
                      <textarea
                        rows={2}
                        defaultValue="✅ *Document received* We received *{file}*. Choose your print settings to continue."
                        className="w-full p-3 border rounded-xl text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-mono text-[11px]"
                      />
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        Sent for one Meta document. Placeholders: &#123;file&#125; and &#123;shop&#125;.
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block font-bold text-gray-700 dark:text-gray-300">
                          MULTIPLE DOCUMENTS RECEIVED
                        </label>
                        <span className="text-[10px] text-gray-400">17/40 words</span>
                      </div>
                      <textarea
                        rows={2}
                        defaultValue="✅ *Documents received* We received *{count} documents* for your order. Review them and choose your print settings."
                        className="w-full p-3 border rounded-xl text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-mono text-[11px]"
                      />
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        Sent once after a group of Meta files arrives. Placeholders: &#123;count&#125; and &#123;shop&#125;.
                      </span>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                        PRINT SETTINGS BUTTON
                      </label>
                      <input
                        type="text"
                        defaultValue="Set Your Print"
                        className="w-full px-3 py-2 border rounded-xl text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                      />
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        Opens that customer's grouped order portal. Maximum 20 characters.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Additional Notification Templates Card */}
                <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-4">
                  <div className="space-y-4 text-xs">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block font-bold text-gray-700 dark:text-gray-300">
                          ORDER REJECTION MESSAGE
                        </label>
                        <span className="text-[10px] text-gray-400">14/40 words</span>
                      </div>
                      <textarea
                        rows={2}
                        defaultValue="Your print request was rejected by {shop_name}. Please contact the shop for more details."
                        className="w-full p-3 border rounded-xl text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-mono text-[11px]"
                      />
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        Sent when the merchant rejects an order. Placeholders: &#123;shop_name&#125;, &#123;customer_name&#125;, &#123;documents&#125;.
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block font-bold text-gray-700 dark:text-gray-300">
                          DOCUMENT REMOVAL MESSAGE
                        </label>
                        <span className="text-[10px] text-gray-400">17/40 words</span>
                      </div>
                      <textarea
                        rows={2}
                        defaultValue="Your document {file_name} was removed by {shop_name}. Please upload it again if you still want it printed."
                        className="w-full p-3 border rounded-xl text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-mono text-[11px]"
                      />
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        Sent when one document is removed from an order. Placeholders: &#123;shop_name&#125;, &#123;customer_name&#125;, &#123;file_name&#125;.
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block font-bold text-gray-700 dark:text-gray-300">
                          UNMATCHED MESSAGE RESPONSE
                        </label>
                        <span className="text-[10px] text-gray-400">15/40 words</span>
                      </div>
                      <textarea
                        rows={2}
                        defaultValue="I can help with printing, prices, services, and order status. Please send a print-related question."
                        className="w-full p-3 border rounded-xl text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-mono text-[11px]"
                      />
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        Used when no merchant data or Q&A answer matches the customer's message.
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block font-bold text-gray-700 dark:text-gray-300">
                          PRINT COMPLETED MESSAGE
                        </label>
                        <span className="text-[10px] text-gray-400">17/40 words</span>
                      </div>
                      <textarea
                        rows={2}
                        defaultValue="Your Order has completed. You can collect your print from {shop_name}. Thank You. Any feedback for us?"
                        className="w-full p-3 border rounded-xl text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-mono text-[11px]"
                      />
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        Sent after the desktop agent reports the print job completed successfully. Placeholders: &#123;shop_name&#125;, &#123;order_number&#125;, &#123;amount&#125;.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Save Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
                  <span className="text-xs text-gray-400">
                    Changes will apply to new conversations immediately
                  </span>
                  <button
                    type="button"
                    onClick={() => triggerSaveNotification('Train Bot templates')}
                    className="w-full sm:w-auto px-6 py-2.5 bg-[#4D64E6] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#3D52D5] transition-all"
                  >
                    Save Settings
                  </button>
                </div>
              </div>

              {/* Right Panel: Live Test Preview */}
              <div className="lg:col-span-5 bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between h-[680px] sticky top-6">
                <div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700 mb-3">
                    <div>
                      <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Live Test Preview</h3>
                      <p className="text-[10px] text-gray-400">0 Instant Q&A pairs active</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        ● Bot Active
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setChatLog([
                            {
                              sender: 'bot',
                              text: 'Welcome to Printing Shopz. Upload your document here: https://inklly.in/p/campus1 Link expires in 30 minutes.',
                              time: '06:03 pm',
                            },
                          ])
                        }
                        className="text-gray-400 hover:text-red-500 p-1 text-xs"
                        title="Clear preview"
                      >
                        🗑️
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerSaveNotification('Preview reloaded')}
                        className="text-gray-400 hover:text-gray-600 p-1 text-xs"
                        title="Reload preview"
                      >
                        🔄
                      </button>
                    </div>
                  </div>

                  {/* Chat messages */}
                  <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1 text-xs">
                    <div className="text-center my-2">
                      <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400 rounded-full text-[10px] font-semibold">
                        Preview Session
                      </span>
                    </div>
                    {chatLog.map((c, i) => (
                      <div
                        key={i}
                        className={`p-3.5 rounded-2xl max-w-[85%] ${
                          c.sender === 'user'
                            ? 'ml-auto bg-[#E7FFDB] text-gray-800'
                            : 'bg-gray-100 dark:bg-gray-700/60 text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        <p className="leading-relaxed">{c.text}</p>
                        <span className="text-[9px] text-gray-400 block text-right mt-1 font-mono">
                          {c.sender === 'bot' ? 'Bot · ' : 'Customer · '}{c.time}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-gray-400 font-semibold px-2 py-1 bg-gray-50 dark:bg-gray-900 rounded-lg whitespace-nowrap">
                      👤 Customer
                    </span>
                    <input
                      type="text"
                      value={testChatMessage}
                      onChange={(e) => setTestChatMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleTestChatSend()}
                      placeholder="Type to test your bot..."
                      className="flex-1 px-3 py-2 border rounded-xl text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                    />
                    <button
                      type="button"
                      onClick={handleTestChatSend}
                      className="p-2 bg-[#4D64E6] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#3D52D5]"
                      title="Send message"
                    >
                      <SendIcon size={14} />
                    </button>
                  </div>
                  <span className="text-[10px] text-gray-400 block text-center">
                    Replies use merchant pricing, services, and configured Q&A only
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            VIEW 11: BUSINESS SETUP (6 Tabs)
        ───────────────────────────────────────────────────────────── */}
        {activeView === 'business_setup' && (
          <div className="p-6 max-w-7xl w-full mx-auto space-y-6 animate-fadeIn">
            {/* Top Workspace Header */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-800">
              <div>
                <h1 className="text-xl font-black text-[#172031] dark:text-white">{currentMerchant.name || 'Printing Shopz'}</h1>
                <p className="text-xs text-gray-400">Merchant workspace</p>
              </div>
              <div className="flex items-center gap-3">
                {setupTab === 'printers' && (
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    Check required fields
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSaveBusinessSetup}
                  className="px-5 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-xs font-bold shadow-xs transition-all"
                >
                  Save changes
                </button>
              </div>
            </div>

            {/* Subtabs Navigation */}
            <div className="flex overflow-x-auto gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 text-xs font-bold scrollbar-none">
              {[
                { id: 'profile', label: 'Profile', icon: '👤' },
                { id: 'printers', label: 'Printers', icon: '🖨' },
                { id: 'pricing', label: 'Pricing', icon: '📄' },
                { id: 'discounts', label: 'Discounts', icon: '🏷' },
                { id: 'portal', label: 'Customer Portal', icon: '📱' },
                { id: 'automation', label: 'Automation & Payment', icon: '⚡' },
              ].map((t) => {
                const isActive = setupTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSetupTab(t.id as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
                      isActive
                        ? 'border-b-2 border-[#4D64E6] text-[#4D64E6] font-extrabold bg-blue-50/50 dark:bg-blue-950/30'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                SUBTAB 1: PROFILE
            ═══════════════════════════════════════════════════════════════ */}
            {setupTab === 'profile' && (
              <div className="space-y-6">
                <div className="text-xs text-gray-400">
                  <span>Shop settings</span> &gt; <span className="text-gray-600 dark:text-gray-300 font-bold">Business Profile</span>
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-[#172031] dark:text-white">Business Profile</h2>
                  <p className="text-xs text-gray-400">Shop identity and customer print services</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column */}
                  <div className="lg:col-span-8 space-y-6">
                    {/* Business Details */}
                    <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-4">
                      <div>
                        <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Business details</h3>
                        <p className="text-[11px] text-gray-400">The information customers see on your ordering portal.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Shop Name</label>
                          <input
                            type="text"
                            value={shopName}
                            onChange={(e) => setShopName(e.target.value)}
                            className="w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-medium"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Contact Number</label>
                          <input
                            type="text"
                            value={shopPhone}
                            onChange={(e) => setShopPhone(e.target.value)}
                            className="w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Services you offer */}
                    <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                        <div>
                          <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Services you offer</h3>
                          <p className="text-[11px] text-gray-400">Choose the print services your shop offers. Changes reflect on customer portal immediately.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const allDefaults = [
                                'Black & White', 'Colour', 'Single-sided', 'Back-to-Back - Automatic', 'Back-to-Back - Manual',
                                'A4', 'A3', 'Plain paper', 'Auto orientation', 'Actual size', 'Draft quality', 'High quality'
                              ];
                              setServicesOffered(allDefaults);
                              setGlobalToast('All standard services enabled');
                            }}
                            className="text-[11px] font-bold text-[#4F46E5] hover:underline"
                          >
                            Enable All Standard
                          </button>
                        </div>
                      </div>

                      {/* Color & print sides */}
                      <div className="space-y-2 text-xs">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Color &amp; print sides</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { name: 'Black & White', desc: 'Standard monochrome laser prints' },
                            { name: 'Colour', desc: 'Vibrant CMYK / Inkjet color prints' },
                            { name: 'Single-sided', desc: 'Single face printed per sheet' },
                            { name: 'Back-to-Back - Automatic', desc: 'Hardware duplex printing on both sides' },
                            { name: 'Back-to-Back - Manual', desc: 'Manual dual-pass printing for simple printers' },
                          ].map((svc) => {
                            const isChecked = servicesOffered.includes(svc.name);
                            return (
                              <label
                                key={svc.name}
                                onClick={(e) => {
                                  e.preventDefault();
                                  toggleServiceOffered(svc.name);
                                }}
                                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                                  isChecked
                                    ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 font-bold dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-700 shadow-xs'
                                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="mt-0.5 rounded text-[#4D64E6] cursor-pointer"
                                />
                                <div className="flex-1">
                                  <div className="text-xs font-bold leading-none mb-1">{svc.name}</div>
                                  <div className="text-[10px] font-normal text-gray-500 dark:text-gray-400">{svc.desc}</div>
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isChecked ? 'bg-indigo-200 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200' : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                                  {isChecked ? 'ACTIVE' : 'OFF'}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Paper sizes & types */}
                      <div className="space-y-2 text-xs">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Paper sizes &amp; types</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { name: 'A4', desc: 'Standard 210 x 297 mm document paper' },
                            { name: 'A3', desc: 'Large 297 x 420 mm engineering drawings & posters' },
                            { name: '4x6 photo', desc: 'Standard photographic prints' },
                            { name: '5x7 photo', desc: 'Medium photographic prints' },
                            { name: 'Glossy paper', desc: 'High-sheen photographic paper' },
                            { name: 'Plain paper', desc: '75-80 GSM bond copier paper' },
                          ].map((svc) => {
                            const isChecked = servicesOffered.includes(svc.name);
                            return (
                              <label
                                key={svc.name}
                                onClick={(e) => {
                                  e.preventDefault();
                                  toggleServiceOffered(svc.name);
                                }}
                                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                                  isChecked
                                    ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 font-bold dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-700 shadow-xs'
                                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="mt-0.5 rounded text-[#4D64E6] cursor-pointer"
                                />
                                <div className="flex-1">
                                  <div className="text-xs font-bold leading-none mb-1">{svc.name}</div>
                                  <div className="text-[10px] font-normal text-gray-500 dark:text-gray-400">{svc.desc}</div>
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isChecked ? 'bg-indigo-200 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200' : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                                  {isChecked ? 'ACTIVE' : 'OFF'}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Layout & finishing */}
                      <div className="space-y-2 text-xs">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Layout &amp; finishing</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { name: 'Auto orientation', desc: 'Auto-detect portrait vs landscape per page' },
                            { name: 'Portrait', desc: 'Vertical sheet orientation' },
                            { name: 'Landscape', desc: 'Horizontal sheet orientation' },
                            { name: 'Multiple copies', desc: 'Collate or uncollate duplicate copies' },
                            { name: 'Page selection', desc: 'Customer selects page ranges (e.g. 1-5, 8)' },
                            { name: 'Fit to page', desc: 'Scale oversized sheets down to printable margins' },
                            { name: 'Actual size', desc: '100% 1:1 scale reproduction' },
                            { name: 'Collated printing', desc: '1,2,3... 1,2,3 instead of 1,1, 2,2' },
                            { name: 'Pages per sheet', desc: '2-up or 4-up slides on a single page' },
                          ].map((svc) => {
                            const isChecked = servicesOffered.includes(svc.name);
                            return (
                              <label
                                key={svc.name}
                                onClick={(e) => {
                                  e.preventDefault();
                                  toggleServiceOffered(svc.name);
                                }}
                                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                                  isChecked
                                    ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 font-bold dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-700 shadow-xs'
                                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="mt-0.5 rounded text-[#4D64E6] cursor-pointer"
                                />
                                <div className="flex-1">
                                  <div className="text-xs font-bold leading-none mb-1">{svc.name}</div>
                                  <div className="text-[10px] font-normal text-gray-500 dark:text-gray-400">{svc.desc}</div>
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isChecked ? 'bg-indigo-200 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200' : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                                  {isChecked ? 'ACTIVE' : 'OFF'}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Advanced services Toggle Box */}
                      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-xs text-[#172031] dark:text-white">Advanced services</div>
                            <div className="text-[10px] text-gray-400">Enable only capabilities your shop can fulfill.</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setAdvancedServicesEnabled((v) => !v);
                              setGlobalToast(`Advanced services ${!advancedServicesEnabled ? 'enabled' : 'disabled'}`);
                            }}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                              advancedServicesEnabled ? 'bg-[#4F46E5]' : 'bg-gray-300 dark:bg-gray-700'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                advancedServicesEnabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                        {advancedServicesEnabled && (
                          <>
                            <div className="text-[10px] text-gray-400 italic">Advanced services - customer portal will offer these specialized formatting options</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {[
                                'Long-edge binding', 'Short-edge binding', 'A5', 'B4', 'B5', 'Letter', 'Legal',
                                'Draft quality', 'High quality', 'Print detail', 'Reverse order', 'Mirror'
                              ].map((adv) => {
                                const isChecked = servicesOffered.includes(adv);
                                return (
                                  <label
                                    key={adv}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      toggleServiceOffered(adv);
                                    }}
                                    className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                                      isChecked
                                        ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 font-bold dark:bg-indigo-950/40 dark:text-indigo-200'
                                        : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}}
                                      className="rounded text-[#4D64E6] cursor-pointer"
                                    />
                                    <span>{adv}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Physical services Toggle Box */}
                      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-xs text-[#172031] dark:text-white">Physical services</div>
                            <div className="text-[10px] text-gray-400">Media loading and post-print finishing performed by shop staff or hardware</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPhysicalServicesEnabled((v) => !v);
                              setGlobalToast(`Physical services ${!physicalServicesEnabled ? 'enabled' : 'disabled'}`);
                            }}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                              physicalServicesEnabled ? 'bg-[#4F46E5]' : 'bg-gray-300 dark:bg-gray-700'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                physicalServicesEnabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                        {physicalServicesEnabled && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                            {[
                              'Custom dimensions', 'Matte paper', 'Photo paper',
                              'Bond paper', 'Cardstock', 'Labels',
                              'Envelopes', 'Borderless printing', 'Stapling',
                              'Hole punching', 'Folding', 'Booklet finishing',
                              'Binding', 'Cutting', 'Output bin selection'
                            ].map((phy) => {
                              const isChecked = servicesOffered.includes(phy);
                              return (
                                <label
                                  key={phy}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    toggleServiceOffered(phy);
                                  }}
                                  className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                                    isChecked
                                      ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 font-bold dark:bg-indigo-950/40 dark:text-indigo-200'
                                      : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="rounded text-[#4D64E6] cursor-pointer"
                                  />
                                  <span>{phy}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Owner & Login Details */}
                    <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-base">🔐</span>
                        <div>
                          <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Owner & Login Details</h3>
                          <p className="text-[10px] text-gray-400">Edit the information entered during registration</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Owner Name</label>
                          <input type="text" defaultValue="Rahul S" className="w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900" />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Shop Name</label>
                          <input type="text" defaultValue="Printing Shopz" className="w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900" />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Login Email</label>
                          <input type="email" defaultValue="amh24cg017@gmail.com" className="w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900" />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Login / Business Phone</label>
                          <input type="text" defaultValue="+917349095267" className="w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Business Address</label>
                          <input type="text" defaultValue="Setup pending" className="w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900" />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">City</label>
                          <input type="text" defaultValue="Pending" className="w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900" />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">State</label>
                          <input type="text" defaultValue="Pending" className="w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900" />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">PIN Code</label>
                          <input type="text" defaultValue="000000" className="w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900" />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">GSTIN (optional)</label>
                          <input type="text" placeholder="GSTIN" className="w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900" />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Current Password (required for login changes)</label>
                          <input type="password" defaultValue="password123456" className="w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900" />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">New Password (leave blank to keep)</label>
                          <input type="password" placeholder="••••••••" className="w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900" />
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => triggerSaveNotification('Account details')}
                          className="px-5 py-2.5 bg-[#4F46E5] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#4338CA]"
                        >
                          Update account details
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Setup checklist */}
                  <div className="lg:col-span-4 bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-4 sticky top-6">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700">
                      <div>
                        <h3 className="font-extrabold text-sm text-[#172031] dark:text-white flex items-center gap-2">
                          <span>Setup checklist</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                            6 of 6 Ready
                          </span>
                        </h3>
                        <p className="text-[11px] text-gray-400">Click any section to inspect or update settings.</p>
                      </div>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      {[
                        { title: 'Profile', tab: 'profile', desc: 'Shop identity, hours & services', ready: true },
                        { title: 'Printers', tab: 'printers', desc: detectedPrinters.length > 0 ? `${detectedPrinters.length} Printers Ready (Default: ${selectedDefaultPrinter || 'Canon LBP2900'})` : 'Pair local Windows agent', ready: detectedPrinters.length > 0 },
                        { title: 'Pricing', tab: 'pricing', desc: 'A4 B&W ₹2.00, Color ₹10.00', ready: true },
                        { title: 'Discounts', tab: 'discounts', desc: `${bulkTiers.length} bulk tiers configured`, ready: true },
                        { title: 'Customer Portal', tab: 'portal', desc: 'Live QR portal & upload tools', ready: true },
                        { title: 'Automation & Payment', tab: 'automation', desc: acceptOnlinePayments ? 'UPI + Cash Enabled' : 'Cash on pickup', ready: true },
                      ].map((item) => (
                        <div
                          key={item.title}
                          onClick={() => {
                            setSetupTab(item.tab as any);
                            setGlobalToast(`Opened ${item.title} settings`);
                          }}
                          className="group flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 cursor-pointer transition-all"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 mt-0.5">
                              ✓
                            </span>
                            <div>
                              <div className="font-bold text-gray-900 dark:text-white group-hover:text-[#4F46E5] flex items-center gap-1.5">
                                <span>{item.title}</span>
                                <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                              </div>
                              <div className="text-[10px] text-gray-400 leading-tight mt-0.5">{item.desc}</div>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                            Ready
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setGlobalToast('Hardware scan: Canon LBP2900 is online and ready for production jobs');
                        }}
                        className="w-full py-2.5 bg-gray-50 dark:bg-gray-700/60 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center justify-center gap-2 transition-colors"
                      >
                        <span>🔄</span> Verify All Systems
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTourStep(0);
                          setTourOpen(true);
                        }}
                        className="w-full py-2.5 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-all"
                      >
                        <span>✨</span> Take Interactive Tour
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer Navigation */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-800 text-xs">
                  <span className="text-gray-400">Save shop settings above. Owner and login changes use Update account details.</span>
                  <button
                    type="button"
                    onClick={() => setSetupTab('printers')}
                    className="font-bold text-[#4D64E6] hover:underline flex items-center gap-1"
                  >
                    Next: Printers &gt;
                  </button>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                SUBTAB 2: PRINTERS & AGENT CONNECTION
            ═══════════════════════════════════════════════════════════════ */}
            {setupTab === 'printers' && (
              <div className="space-y-6">
                <div className="text-xs text-gray-400">
                  <span>Shop settings</span> &gt; <span className="text-gray-600 dark:text-gray-300 font-bold">Printers & Agent Connection</span>
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-[#172031] dark:text-white">Printers & Agent Connection</h2>
                  <p className="text-xs text-gray-400">Add printers, review detected capabilities, and control order routing</p>
                </div>

                {/* Card 1: Inklly Agent Download */}
                <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600">
                        ⚡
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Inklly Agent</h3>
                          <span className={`text-[10px] ${agentOnline ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950' : 'bg-blue-50 text-blue-600 dark:bg-blue-950'} px-2 py-0.5 rounded-full font-bold`}>
                            {agentOnline ? 'Connected' : 'Ready to download'}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400">Install Inklly on the computer connected to your printers.</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${agentOnline ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700'}`}>
                      ● {agentOnline ? 'ONLINE (Port 8765)' : 'Not connected'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
                    {/* Left Column: Download button & platform options */}
                    <div className="md:col-span-7 space-y-3">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">
                        DOWNLOAD · DETECTED WINDOWS 10/11 · X64
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDownloadAgent('win-x64-bundle', 'bundle')}
                        className="w-full p-4 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-2xl flex items-center justify-between shadow-md transition-all text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">💻</span>
                          <div>
                            <div className="font-extrabold text-sm">Download Inklly Print Agent Bundle</div>
                            <div className="text-[11px] text-blue-100">Standalone Executable &amp; Setup (No Node.js needed) · x64 ZIP</div>
                          </div>
                        </div>
                        <span className="text-xl">⬇</span>
                      </button>

                      {/* Download for another platform */}
                      <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between items-center text-xs font-bold text-gray-700 dark:text-gray-300">
                          <span>Installer &amp; Driver Packages</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <button
                            type="button"
                            onClick={() => handleDownloadAgent('win-x64-msi', 'msi')}
                            className="p-3 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between text-left cursor-pointer"
                          >
                            <div>
                              <div className="font-bold">Windows x64 MSI</div>
                              <div className="text-[10px] text-gray-400">Inklly-1.6.1-win-x64.msi</div>
                            </div>
                            <span>⬇</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadAgent('windows7-x64', 'msi')}
                            className="p-3 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between text-left cursor-pointer"
                          >
                            <div>
                              <div className="font-bold">Windows 7/8/10 x64</div>
                              <div className="text-[10px] text-gray-400">LegacyAgent-1.5.51-x64.msi</div>
                            </div>
                            <span>⬇</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadAgent('windows7-x86', 'msi')}
                            className="p-3 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between text-left cursor-pointer"
                          >
                            <div>
                              <div className="font-bold">Windows 32-bit (x86)</div>
                              <div className="text-[10px] text-gray-400">LegacyAgent-1.5.51-x86.msi</div>
                            </div>
                            <span>⬇</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadAgent('usb', 'exe')}
                            className="p-3 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between text-left cursor-pointer"
                          >
                            <div>
                              <div className="font-bold">USB Counter Autorun</div>
                              <div className="text-[10px] text-gray-400">usb-autorun-creator-2.exe</div>
                            </div>
                            <span>⬇</span>
                          </button>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl text-[10px] text-gray-400 leading-relaxed">
                          <strong className="text-gray-700 dark:text-gray-300 block mb-0.5">Supported production systems</strong>
                          The recommended download matches your Windows PC architecture. Works seamlessly with Canon LBP2900, HP LaserJet, Epson EcoTank, and all Windows spooler printers.
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Connection Steps */}
                    <div className="md:col-span-5 border border-blue-100 dark:border-blue-900 bg-blue-50/20 dark:bg-blue-950/20 rounded-2xl p-4 space-y-3 text-xs">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">
                        CONNECTION STEPS
                      </span>
                      <div className="space-y-3">
                        <div className="flex items-start gap-2.5">
                          <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                          <div>
                            <div className="font-bold">1. Download &amp; install the Inklly Agent</div>
                            <div className="text-[11px] text-gray-400">Windows x64 · automatically matched</div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                          <div className="w-full">
                            <div className="font-bold">2. Download a one-time setup script</div>
                            <div className="text-[11px] text-gray-400 mb-2">Generate it only when you are ready to pair the print computer.</div>
                            <div className="p-3 bg-white dark:bg-gray-800 border rounded-xl space-y-2">
                              <div className="font-bold text-[11px]">Agent pairing</div>
                              <p className="text-[10px] text-gray-400 leading-tight">
                                The setup code expires after 15 minutes and can be used once. Keep the downloaded script private.
                              </p>
                              <button type="button" onClick={handleDownloadAgentScript} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-[11px] font-bold">Generate setup script</button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <span className={`font-bold mt-0.5 ${agentOnline ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {agentOnline ? '✓' : '⊙'}
                          </span>
                          <div>
                            <div className={`font-bold ${agentOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}`}>
                            {agentOnline ? '3. Agent is reachable on this computer' : '3. Waiting for agent on port 8765'}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {agentOnline ? 'Local health check responded.' : 'Start the installed agent on the print computer.'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => checkAgentHealth(true)}
                        className="w-full py-2.5 bg-[#4F46E5] text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 mt-2 cursor-pointer hover:bg-[#4338CA] transition-colors"
                      >
                        <span>🔄</span> Re-check agent connection
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card 2: Your Printers */}
                <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-5">
                  <div>
                    <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Your printers</h3>
                    <p className="text-[11px] text-gray-400">Add a printer or change its print settings</p>
                  </div>

                  {/* Customer portal services - shop-wide */}
                  <div className="p-4 border rounded-2xl space-y-2">
                    <div className="font-bold text-xs text-[#172031] dark:text-white">Customer portal services - shop-wide</div>
                    <div className="flex items-center gap-6 text-xs pt-1">
                      <label className="flex items-center gap-2 cursor-pointer font-bold">
                        <input type="checkbox" defaultChecked className="rounded text-[#4D64E6]" />
                        <span>ID Card Printing</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-bold">
                        <input type="checkbox" defaultChecked className="rounded text-[#4D64E6]" />
                        <span>Photo Printing</span>
                      </label>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-relaxed pt-1">
                      Off by default. Photo Printing opens passport-photo layouts; ID Card is separate. Use Save Changes above, then reopen the customer link. Printing requires compatible paper settings and pricing.
                    </p>
                  </div>

                  {/* Agent connection details */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">▼ Agent connection details</span>
                      <span className="text-[10px] font-bold text-gray-400">INKLLY AGENT STATUS</span>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${agentOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                          <span className="font-bold text-xs">Inklly Agent</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${agentOnline ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-gray-200 text-gray-600'}`}>
                            {agentOnline ? 'ONLINE' : 'OFFLINE'}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {agentOnline ? 'Connected to local print spooler daemon · Live commands active' : 'Inklly Agent OFFLINE — Run Inklly-Agent-Setup.bat on this PC'}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          {agentOnline ? `Port 8765 · Host: ${agentInfo?.hostname || '127.0.0.1'} · v1.0.0` : 'Port 8765 · Computer unavailable · Agent version unavailable'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => triggerSaveNotification('SQLite cache inspected: 0 queued items')} className="px-3 py-1.5 border rounded-xl text-xs font-bold bg-white dark:bg-gray-800 flex items-center gap-1 cursor-pointer">
                          <span>🖶</span> SQLite cache
                        </button>
                        <button type="button" onClick={() => checkAgentHealth(true)} className="px-3 py-1.5 border rounded-xl text-xs font-bold bg-white dark:bg-gray-800 flex items-center gap-1 cursor-pointer hover:bg-gray-50">
                          <span>🔄</span> Reconnect
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Printers Listed / Added */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b pb-2 text-xs">
                      <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">
                        PRINTERS · {detectedPrinters.length} ADDED / {detectedPrinters.length} LISTED
                      </span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowAddPrinterModal(true)}
                          className="px-3 py-1.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs transition-all"
                        >
                          + Add Printer ˅
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
                      <span className="text-gray-600 dark:text-gray-300 font-medium">
                        {detectedPrinters.length > 0
                          ? `Active printer queue: ${selectedDefaultPrinter} is primary hardware device.`
                          : 'Click Add Printer to select a printer detected by your agent.'}
                      </span>
                      <div className="flex items-center gap-2">
                        {detectingPrinters ? (
                          <span className="text-[11px] font-bold text-[#4D64E6] flex items-center gap-1">
                            <span className="animate-spin inline-block">↻</span> Scanning Windows Spooler...
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleRefreshPrinters}
                            className="text-[11px] text-blue-600 dark:text-blue-400 underline font-bold cursor-pointer hover:text-blue-700"
                          >
                            Refresh detected printers
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Detected Printers Cards Table */}
                    <div className="space-y-2.5">
                      {detectedPrinters.map((prn) => (
                        <div
                          key={prn.name}
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-3 ${
                            selectedDefaultPrinter === prn.name
                              ? 'border-[#4D64E6] bg-blue-50/40 dark:bg-blue-950/20 shadow-xs'
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">🖨</span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-xs text-[#172031] dark:text-white">
                                  {prn.name}
                                </span>
                                {selectedDefaultPrinter === prn.name && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200">
                                    PRIMARY DEFAULT
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  ONLINE ({prn.status})
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-400 mt-0.5 font-mono">
                                Port: {prn.port} · {prn.isPhysical ? 'Physical Hardware' : 'Virtual Spooler'} · {prn.supportsColor ? 'Color' : 'Monochrome'} · {prn.supportsDuplex ? 'Duplex' : 'Simplex'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedDefaultPrinter !== prn.name && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDefaultPrinter(prn.name);
                                  triggerSaveNotification(`Set ${prn.name} as primary default printer.`);
                                }}
                                className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                              >
                                Set as Default
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleTestPrint(prn.name)}
                              className="px-3 py-1.5 bg-[#4D64E6] hover:bg-[#3D52D5] text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-all"
                            >
                              Test Print
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Default Printer</label>
                        <select
                          value={selectedDefaultPrinter}
                          onChange={(e) => {
                            setSelectedDefaultPrinter(e.target.value);
                            triggerSaveNotification(`Default printer set to ${e.target.value}`);
                          }}
                          className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 font-bold text-xs"
                        >
                          {detectedPrinters.map((p) => (
                            <option key={p.name} value={p.name}>
                              {p.name} {p.name === 'Canon LBP2900' ? '(Primary Physical Laser)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Paper Tray</label>
                        <select
                          value={selectedPaperTray}
                          onChange={(e) => {
                            setSelectedPaperTray(e.target.value);
                            triggerSaveNotification(`Paper tray set to ${e.target.value}`);
                          }}
                          className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 font-bold text-xs"
                        >
                          <option value="Auto-Select">Auto-Select (Recommended)</option>
                          <option value="Tray 1">Tray 1 (A4 Standard - 250 Sheets)</option>
                          <option value="Manual Feed">Manual Feed Slot (Envelopes / Heavy Paper)</option>
                        </select>
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] text-amber-900 dark:text-amber-300 flex items-center gap-2">
                      <span>⚠</span>
                      <span>Platform Resiliency Mode Active: All inbound print orders are being saved to your physical desktop SSD until connectivity returns.</span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleTestPrint()}
                        className="px-4 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-gray-800 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                      >
                        <span>🖶</span> Test All Printers
                      </button>
                      <button
                        type="button"
                        onClick={handleRefreshPrinters}
                        className="px-4 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-gray-800 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                      >
                        <span>🔄</span> Refresh Printer List
                      </button>
                    </div>

                    <div className="p-3 bg-blue-50/30 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-xl text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-2">
                      <span>ℹ</span>
                      <span>Keep Inklly running on your print computer to receive orders.</span>
                    </div>
                  </div>
                </div>

                {/* Footer Navigation */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-800 text-xs">
                  <span className="text-gray-400">Your edits are applied when you save changes.</span>
                  <button
                    type="button"
                    onClick={() => setSetupTab('pricing')}
                    className="font-bold text-[#4D64E6] hover:underline flex items-center gap-1"
                  >
                    Next: Pricing &gt;
                  </button>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                SUBTAB 3: PRICING
            ═══════════════════════════════════════════════════════════════ */}
            {setupTab === 'pricing' && (
              <div className="space-y-6">
                <div className="text-xs text-gray-400">
                  <span>Shop settings</span> &gt; <span className="text-gray-600 dark:text-gray-300 font-bold">Print pricing</span>
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-[#172031] dark:text-white">Print pricing</h2>
                  <p className="text-xs text-gray-400">Shop defaults and optional printer-specific rates</p>
                </div>

                {/* A4 Rates Card */}
                <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Edit rates for</label>
                    <select className="w-full px-3 py-2 border rounded-xl text-xs font-bold bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                      <option>All printers - shop default</option>
                    </select>
                    <span className="text-[10px] text-gray-400 block mt-1">
                      New printers inherit these rates. Existing custom printer rates stay unchanged.
                    </span>
                  </div>

                  {/* A4 Paper Table */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                      <h4 className="font-extrabold text-xs text-[#172031] dark:text-white">A4 Paper</h4>
                      <span className="text-[10px] text-gray-400 italic">₹ per printed side</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="font-bold text-gray-800 dark:text-gray-200 mb-0.5">Black &amp; White</div>
                        <div className="text-[10px] text-gray-400 mb-1">Single-sided</div>
                        <div className="flex items-center gap-2 border rounded-xl px-3 py-1.5 bg-gray-50 dark:bg-gray-900">
                          <span className="text-gray-400 font-bold">₹</span>
                          <input
                            type="text"
                            value={rateBwSingle}
                            onChange={(e) => setRateBwSingle(e.target.value)}
                            className="w-full font-bold outline-hidden bg-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="font-bold text-gray-800 dark:text-gray-200 mb-0.5">Black &amp; White</div>
                        <div className="text-[10px] text-gray-400 mb-1">Back-to-back</div>
                        <div className="flex items-center gap-2 border rounded-xl px-3 py-1.5 bg-gray-50 dark:bg-gray-900">
                          <span className="text-gray-400 font-bold">₹</span>
                          <input
                            type="text"
                            value={rateBwDuplex}
                            onChange={(e) => setRateBwDuplex(e.target.value)}
                            className="w-full font-bold outline-hidden bg-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="font-bold text-gray-800 dark:text-gray-200 mb-0.5">Color</div>
                        <div className="text-[10px] text-gray-400 mb-1">Single-sided</div>
                        <div className="flex items-center gap-2 border rounded-xl px-3 py-1.5 bg-gray-50 dark:bg-gray-900">
                          <span className="text-gray-400 font-bold">₹</span>
                          <input
                            type="text"
                            value={rateColorSingle}
                            onChange={(e) => setRateColorSingle(e.target.value)}
                            className="w-full font-bold outline-hidden bg-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="font-bold text-gray-800 dark:text-gray-200 mb-0.5">Color</div>
                        <div className="text-[10px] text-gray-400 mb-1">Back-to-back</div>
                        <div className="flex items-center gap-2 border rounded-xl px-3 py-1.5 bg-gray-50 dark:bg-gray-900">
                          <span className="text-gray-400 font-bold">₹</span>
                          <input
                            type="text"
                            value={rateColorDuplex}
                            onChange={(e) => setRateColorDuplex(e.target.value)}
                            className="w-full font-bold outline-hidden bg-transparent"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-gray-400 italic pt-1">
                      Example - Black &amp; White: 2 pages on 1 sheet × ₹1.20 = ₹2.40. Copies multiply this total.
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-[11px] text-blue-800 dark:text-blue-300">
                    ℹ 1-sided: one page per sheet. 2-sided: two pages share a sheet, but each printed side is charged. Total = printed pages × rate × copies. Discounts apply afterward.
                  </div>
                </div>

                {/* Collage, Merge & Photo Pricing */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                    COLLAGE, MERGE &amp; PHOTO PRICING
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { title: 'collage', subtitle: 'Merchant-defined price per output page' },
                      { title: 'merge', subtitle: 'Merchant-defined price per output page' },
                      { title: 'ID Card', subtitle: 'Merchant-defined price per composed sheet' },
                      { title: 'Passport Photo', subtitle: 'Merchant-defined price per composed sheet' },
                    ].map((box) => (
                      <div key={box.title} className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-5 shadow-xs space-y-3 text-xs">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-extrabold text-sm text-[#172031] dark:text-white capitalize">{box.title}</div>
                            <div className="text-[10px] text-gray-400">{box.subtitle}</div>
                          </div>
                          <input type="checkbox" defaultChecked className="toggle-checkbox w-4 h-4 text-[#4D64E6]" />
                        </div>

                        <div className="space-y-2 pt-1">
                          {['B&W - Single-Sided', 'B&W - Back-to-Back', 'Color - Single-Sided', 'Color - Back-to-Back'].map((row) => (
                            <div key={row} className="flex justify-between items-center p-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                              <span className="font-medium text-gray-700 dark:text-gray-300 text-[11px]">{row}</span>
                              <div className="flex items-center gap-1 border rounded-lg px-2 py-0.5 bg-white dark:bg-gray-800">
                                <span className="text-gray-400 font-bold text-[10px]">₹</span>
                                <input type="text" placeholder="" className="w-14 text-right outline-hidden text-xs bg-transparent" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Navigation */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-800 text-xs">
                  <span className="text-gray-400">Your edits are applied when you save changes.</span>
                  <button
                    type="button"
                    onClick={() => setSetupTab('discounts')}
                    className="font-bold text-[#4D64E6] hover:underline flex items-center gap-1"
                  >
                    Next: Discounts &gt;
                  </button>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                SUBTAB 4: BULK DISCOUNTS
            ═══════════════════════════════════════════════════════════════ */}
            {setupTab === 'discounts' && (
              <div className="space-y-6">
                <div className="text-xs text-gray-400">
                  <span>Shop settings</span> &gt; <span className="text-gray-600 dark:text-gray-300 font-bold">Bulk Discounts</span>
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-[#172031] dark:text-white">Bulk Discounts</h2>
                  <p className="text-xs text-gray-400">Reward high-value orders with selected lower page rates</p>
                </div>

                {/* Bulk Pricing Box */}
                <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Enable bulk pricing</h3>
                      <p className="text-[11px] text-gray-400">Normal prices remain active until the threshold is reached.</p>
                    </div>
                    <input type="checkbox" defaultChecked className="toggle-checkbox w-4 h-4 text-[#4D64E6]" />
                  </div>

                  <div className="space-y-1 text-xs">
                    <label className="block text-gray-700 dark:text-gray-300 font-bold">Apply when normal order value is at least</label>
                    <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-gray-50 dark:bg-gray-900 w-48">
                      <span className="text-gray-400 font-bold">₹</span>
                      <input type="text" defaultValue="100" className="w-full font-bold outline-hidden bg-transparent" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                    <div className="p-4 border rounded-xl bg-gray-50/50 dark:bg-gray-900/40 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-800 dark:text-gray-200">Black &amp; White · Single-Sided</span>
                        <input type="checkbox" className="rounded" />
                      </div>
                      <div className="flex justify-between items-center border rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800">
                        <span className="text-gray-400 font-bold">₹</span>
                        <input type="text" placeholder="Discounted rate" className="w-full px-2 outline-hidden text-xs bg-transparent" />
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">per page</span>
                      </div>
                    </div>

                    <div className="p-4 border-2 border-emerald-400 dark:border-emerald-600 rounded-xl bg-emerald-50/20 dark:bg-emerald-950/20 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-800 dark:text-gray-200">Black &amp; White · Back-to-Back</span>
                        <input type="checkbox" defaultChecked className="rounded text-emerald-600" />
                      </div>
                      <div className="flex justify-between items-center border rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800">
                        <span className="text-gray-400 font-bold">₹</span>
                        <input type="text" placeholder="Discounted rate" className="w-full px-2 outline-hidden text-xs bg-transparent" />
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">per page</span>
                      </div>
                    </div>

                    <div className="p-4 border rounded-xl bg-gray-50/50 dark:bg-gray-900/40 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-800 dark:text-gray-200">Color · Single-Sided</span>
                        <input type="checkbox" className="rounded" />
                      </div>
                      <div className="flex justify-between items-center border rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800">
                        <span className="text-gray-400 font-bold">₹</span>
                        <input type="text" placeholder="Discounted rate" className="w-full px-2 outline-hidden text-xs bg-transparent" />
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">per page</span>
                      </div>
                    </div>

                    <div className="p-4 border rounded-xl bg-gray-50/50 dark:bg-gray-900/40 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-800 dark:text-gray-200">Color · Back-to-Back</span>
                        <input type="checkbox" className="rounded" />
                      </div>
                      <div className="flex justify-between items-center border rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800">
                        <span className="text-gray-400 font-bold">₹</span>
                        <input type="text" placeholder="Discounted rate" className="w-full px-2 outline-hidden text-xs bg-transparent" />
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">per page</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-400 italic">
                    Each configuration is independent. Disabled configurations continue using your normal Pricing Grid rate.
                  </p>
                </div>

                {/* Additional Copy Discount Box */}
                <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Additional Copy Discount</h3>
                      <p className="text-[11px] text-gray-400">Copy 1 uses the normal price. Copies 2 onward use the paper-specific rate below.</p>
                    </div>
                    <input type="checkbox" defaultChecked className="toggle-checkbox w-4 h-4 text-[#4D64E6]" />
                  </div>

                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
                    <div>
                      <div className="font-extrabold text-xs text-[#172031] dark:text-white">A4 paper</div>
                      <p className="text-[10px] text-gray-400">Set only the additional-copy prices you want to discount.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="block font-medium text-gray-700 dark:text-gray-300 mb-1 text-[11px]">Black &amp; White · Single-Sided</span>
                        <div className="flex justify-between items-center border rounded-lg px-3 py-1.5 bg-gray-50 dark:bg-gray-900">
                          <span className="text-gray-400 font-bold">₹</span>
                          <input type="text" placeholder="Normal rate if blank" className="w-full px-2 outline-hidden text-xs bg-transparent" />
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">per page</span>
                        </div>
                      </div>

                      <div>
                        <span className="block font-medium text-gray-700 dark:text-gray-300 mb-1 text-[11px]">Black &amp; White · Back-to-Back</span>
                        <div className="flex justify-between items-center border rounded-lg px-3 py-1.5 bg-gray-50 dark:bg-gray-900">
                          <span className="text-gray-400 font-bold">₹</span>
                          <input type="text" placeholder="Normal rate if blank" className="w-full px-2 outline-hidden text-xs bg-transparent" />
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">per page</span>
                        </div>
                      </div>

                      <div>
                        <span className="block font-medium text-gray-700 dark:text-gray-300 mb-1 text-[11px]">Color · Single-Sided</span>
                        <div className="flex justify-between items-center border rounded-lg px-3 py-1.5 bg-gray-50 dark:bg-gray-900">
                          <span className="text-gray-400 font-bold">₹</span>
                          <input type="text" placeholder="Normal rate if blank" className="w-full px-2 outline-hidden text-xs bg-transparent" />
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">per page</span>
                        </div>
                      </div>

                      <div>
                        <span className="block font-medium text-gray-700 dark:text-gray-300 mb-1 text-[11px]">Color · Back-to-Back</span>
                        <div className="flex justify-between items-center border rounded-lg px-3 py-1.5 bg-gray-50 dark:bg-gray-900">
                          <span className="text-gray-400 font-bold">₹</span>
                          <input type="text" placeholder="Normal rate if blank" className="w-full px-2 outline-hidden text-xs bg-transparent" />
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">per page</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-400 italic">
                    Only paper sizes enabled in Pricing appear here. Blank or higher rates safely use the normal price.
                  </p>
                </div>

                {/* Footer Navigation */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-800 text-xs">
                  <span className="text-gray-400">Your edits are applied when you save changes.</span>
                  <button
                    type="button"
                    onClick={() => setSetupTab('portal')}
                    className="font-bold text-[#4D64E6] hover:underline flex items-center gap-1"
                  >
                    Next: Customer Portal &gt;
                  </button>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                SUBTAB 5: CUSTOMER PORTAL
            ═══════════════════════════════════════════════════════════════ */}
            {setupTab === 'portal' && (
              <div className="space-y-6">
                <div className="text-xs text-gray-400">
                  <span>Shop settings</span> &gt; <span className="text-gray-600 dark:text-gray-300 font-bold">Portal Customization</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-extrabold text-[#172031] dark:text-white">Customer Portal Customization</h2>
                    <p className="text-xs text-gray-400">Configure what customers see, select, and pay when they scan your shop's QR code.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        window.open('/portal/campus1', '_blank');
                        setGlobalToast('Opening live Customer QR Portal in new tab');
                      }}
                      className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-[#4F46E5] dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold hover:bg-indigo-100 flex items-center gap-1.5 transition-colors"
                    >
                      <span>🌐</span> Open Live Customer Portal
                    </button>
                    <button
                      type="button"
                      onClick={() => setGlobalToast('Portal configuration saved and published')}
                      className="px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                    >
                      Save Portal Settings
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Controls */}
                  <div className="lg:col-span-8 space-y-5">
                    {/* Customer details page */}
                    <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Customer Details Form</h3>
                          <p className="text-[11px] text-gray-400">When disabled, customers bypass the intake form and go directly to document upload.</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          Active
                        </span>
                      </div>

                      <div className="p-3 border border-gray-100 dark:border-gray-700 rounded-xl space-y-3 text-xs bg-gray-50/50 dark:bg-gray-900/40">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white">Full Name</div>
                            <div className="text-[10px] text-gray-400">Printed on the pickup slip and order invoice</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400">Required field</span>
                            <input
                              type="checkbox"
                              checked={true}
                              onChange={() => setGlobalToast('Customer name is required for order indexing')}
                              className="rounded text-[#4D64E6] cursor-pointer"
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-700 pt-2.5">
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white">Mobile Number</div>
                            <div className="text-[10px] text-gray-400">Receives WhatsApp notification when print is ready</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400">Required field</span>
                            <input
                              type="checkbox"
                              checked={true}
                              onChange={() => setGlobalToast('Mobile number is required for SMS/WhatsApp pickup PIN')}
                              className="rounded text-[#4D64E6] cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">🖨</span>
                        <div>
                          <span className="font-bold">Hardware Spooler: </span>
                          <span>{selectedDefaultPrinter || 'Canon LBP2900'} (Primary Laser)</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Spooler Linked
                      </span>
                    </div>

                    {/* Service Rows */}
                    <div className="space-y-3">
                      {[
                        {
                          key: 'Black & White',
                          badge: 'Supported on Canon LBP2900',
                          badgeColor: 'green',
                          desc: 'Economical high-speed monochrome laser printing',
                        },
                        {
                          key: 'Color',
                          badge: 'Multi-pass or Color Printer',
                          badgeColor: 'blue',
                          desc: 'Full-color document and vivid photographic reproduction',
                        },
                        {
                          key: 'Single-Sided',
                          badge: 'Standard Spooling',
                          badgeColor: 'green',
                          desc: 'Single printed face per physical sheet',
                        },
                        {
                          key: 'Back-to-Back (Auto)',
                          badge: 'Hardware Duplex Spooler',
                          badgeColor: 'amber',
                          desc: 'Hardware automatic two-sided page flips',
                        },
                        {
                          key: 'Back-to-Back (Manual)',
                          badge: 'Software Guided Two-Pass',
                          badgeColor: 'green',
                          desc: 'Shop agent prints odd sheets then prompts staff to re-insert tray',
                        },
                      ].map((item) => {
                        const isEnabled = portalServices[item.key] ?? true;
                        return (
                          <div
                            key={item.key}
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex justify-between items-center text-xs transition-shadow hover:shadow-xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-[#172031] dark:text-white text-sm">{item.key}</span>
                                <span
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                    item.badgeColor === 'green'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : item.badgeColor === 'blue'
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{item.desc}</div>
                            </div>
                            <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden text-[11px] font-bold shadow-2xs">
                              <button
                                type="button"
                                onClick={() => togglePortalService(item.key, false)}
                                className={`px-3 py-1.5 transition-colors ${
                                  !isEnabled
                                    ? 'bg-rose-600 text-white shadow-inner'
                                    : 'bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-rose-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                              >
                                Disable
                              </button>
                              <button
                                type="button"
                                onClick={() => togglePortalService(item.key, true)}
                                className={`px-3 py-1.5 transition-colors ${
                                  isEnabled
                                    ? 'bg-emerald-600 text-white shadow-inner'
                                    : 'bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-emerald-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                              >
                                Enable
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Paper formats */}
                    <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-5 shadow-xs space-y-3 text-xs">
                      <div>
                        <h4 className="font-extrabold text-sm text-[#172031] dark:text-white">Customer Paper Formats</h4>
                        <p className="text-[10px] text-gray-400">Choose which configured media sizes customers can select. Hidden formats remain available to staff on Merchant POS.</p>
                      </div>
                      {[
                        { key: 'A4 Plain Paper', desc: 'Standard 210 x 297 mm document sheets' },
                        { key: 'A3 Poster Sheet', desc: 'Large 297 x 420 mm engineering drawings' },
                        { key: 'Photo Glossy (4x6)', desc: 'Glossy postcard photo media' },
                      ].map((fmt) => {
                        const isEnabled = portalServices[fmt.key] ?? true;
                        return (
                          <div key={fmt.key} className="flex justify-between items-center p-3 border border-gray-100 dark:border-gray-700 rounded-xl">
                            <div>
                              <div className="font-bold text-gray-900 dark:text-white">{fmt.key}</div>
                              <div className="text-[10px] text-gray-400">{fmt.desc}</div>
                            </div>
                            <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden text-[10px] font-bold">
                              <button
                                type="button"
                                onClick={() => togglePortalService(fmt.key, false)}
                                className={`px-2.5 py-1 ${!isEnabled ? 'bg-rose-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
                              >
                                Disable
                              </button>
                              <button
                                type="button"
                                onClick={() => togglePortalService(fmt.key, true)}
                                className={`px-2.5 py-1 ${isEnabled ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
                              >
                                Enable
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Optional portal controls */}
                    <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-5 shadow-xs space-y-3 text-xs">
                      <div>
                        <h4 className="font-extrabold text-sm text-[#172031] dark:text-white">Optional Customer Controls</h4>
                        <p className="text-[10px] text-gray-400">Toggle customer-facing sliders and layout transformations.</p>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white block">Scaling &amp; Margins</span>
                          <span className="text-[10px] text-gray-400">Allow customers to fit-to-printable-area</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={portalServices['Scaling'] ?? true}
                          onChange={(e) => togglePortalService('Scaling', e.target.checked)}
                          className="rounded text-[#4D64E6] cursor-pointer"
                        />
                      </div>
                      <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-700 pt-2">
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white block">Photo Collage &amp; Passport Grid</span>
                          <span className="text-[10px] text-gray-400">Automatic 4x6 / 8-photo passport grid generation</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={portalServices['Photo Collage'] ?? true}
                          onChange={(e) => togglePortalService('Photo Collage', e.target.checked)}
                          className="rounded text-[#4D64E6] cursor-pointer"
                        />
                      </div>
                      <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-700 pt-2">
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white block">PDF Custom Page Selection</span>
                          <span className="text-[10px] text-gray-400">Allow customers to specify custom ranges (e.g. 1-5, 8, 12-18)</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={portalServices['PDF Page Selection'] ?? true}
                          onChange={(e) => togglePortalService('PDF Page Selection', e.target.checked)}
                          className="rounded text-[#4D64E6] cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Interactive Customer Preview Phone Frame */}
                  <div className="lg:col-span-4 bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-3xl p-5 shadow-xs sticky top-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live Customer Preview
                      </span>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                        Interactive Mockup
                      </span>
                    </div>

                    {/* Phone Frame */}
                    <div className="border-4 border-gray-800 dark:border-gray-700 rounded-3xl overflow-hidden shadow-2xl bg-white dark:bg-gray-900 text-xs">
                      {/* Notch / Speaker bar */}
                      <div className="bg-gray-800 dark:bg-gray-900 py-1 flex justify-center">
                        <div className="w-16 h-1.5 bg-gray-600 rounded-full" />
                      </div>

                      {/* Header */}
                      <div className="p-3.5 bg-linear-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🖶</span>
                          <div>
                            <div className="font-extrabold text-xs">{shopName || 'Printing Shopz'}</div>
                            <div className="text-[9px] text-indigo-200">Express QR Print Desk</div>
                          </div>
                        </div>
                        <span className="text-[9px] bg-indigo-500/80 px-2 py-0.5 rounded-full font-bold">
                          PIN Auth
                        </span>
                      </div>

                      <div className="p-4 space-y-4 max-h-[520px] overflow-y-auto">
                        {/* File preview placeholder */}
                        <div className="p-3.5 bg-gray-50 dark:bg-gray-800 border border-dashed border-indigo-200 dark:border-indigo-800 rounded-2xl flex items-center gap-3">
                          <span className="text-2xl">📄</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900 dark:text-white truncate text-[11px]">Final_Project_Report.pdf</div>
                            <div className="text-[10px] text-gray-500">18 pages · 2.4 MB</div>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                            Ready
                          </span>
                        </div>

                        {/* Color Mode Selection */}
                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Color Mode</span>
                            <span className="text-[9px] text-gray-400">
                              {previewColorMode === 'bw' ? '₹2.00 / pg' : '₹10.00 / pg'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {portalServices['Black & White'] !== false && (
                              <button
                                type="button"
                                onClick={() => setPreviewColorMode('bw')}
                                className={`py-2 rounded-xl font-bold text-[11px] border transition-all ${
                                  previewColorMode === 'bw'
                                    ? 'border-[#4F46E5] bg-indigo-50 text-[#4F46E5] dark:bg-indigo-950/60 dark:text-indigo-200 shadow-2xs'
                                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                                }`}
                              >
                                Black &amp; White
                              </button>
                            )}
                            {portalServices['Color'] !== false && (
                              <button
                                type="button"
                                onClick={() => setPreviewColorMode('color')}
                                className={`py-2 rounded-xl font-bold text-[11px] border transition-all ${
                                  previewColorMode === 'color'
                                    ? 'border-[#4F46E5] bg-indigo-50 text-[#4F46E5] dark:bg-indigo-950/60 dark:text-indigo-200 shadow-2xs'
                                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                                }`}
                              >
                                Vivid Color
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Print Style Selection */}
                        <div>
                          <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Print Style</span>
                          <div className="space-y-1.5">
                            {portalServices['Single-Sided'] !== false && (
                              <button
                                type="button"
                                onClick={() => setPreviewPrintStyle('single')}
                                className={`w-full py-2 px-3 rounded-xl font-bold text-[11px] border text-left flex justify-between items-center transition-all ${
                                  previewPrintStyle === 'single'
                                    ? 'border-[#4F46E5] bg-indigo-50 text-[#4F46E5] dark:bg-indigo-950/60 dark:text-indigo-200 shadow-2xs'
                                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                                }`}
                              >
                                <span>Single-Sided</span>
                                <span className="text-[10px] font-normal">18 sheets</span>
                              </button>
                            )}
                            {portalServices['Back-to-Back (Auto)'] !== false && (
                              <button
                                type="button"
                                onClick={() => setPreviewPrintStyle('duplex_auto')}
                                className={`w-full py-2 px-3 rounded-xl font-bold text-[11px] border text-left flex justify-between items-center transition-all ${
                                  previewPrintStyle === 'duplex_auto'
                                    ? 'border-[#4F46E5] bg-indigo-50 text-[#4F46E5] dark:bg-indigo-950/60 dark:text-indigo-200 shadow-2xs'
                                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                                }`}
                              >
                                <span>Back-to-Back (Auto Duplex)</span>
                                <span className="text-[10px] font-normal">9 sheets</span>
                              </button>
                            )}
                            {portalServices['Back-to-Back (Manual)'] !== false && (
                              <button
                                type="button"
                                onClick={() => setPreviewPrintStyle('duplex_manual')}
                                className={`w-full py-2 px-3 rounded-xl font-bold text-[11px] border text-left flex justify-between items-center transition-all ${
                                  previewPrintStyle === 'duplex_manual'
                                    ? 'border-[#4F46E5] bg-indigo-50 text-[#4F46E5] dark:bg-indigo-950/60 dark:text-indigo-200 shadow-2xs'
                                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                                }`}
                              >
                                <span>Back-to-Back (Manual Assisted)</span>
                                <span className="text-[10px] font-normal">9 sheets</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Paper Format */}
                        <div>
                          <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Paper Media</span>
                          <div className="grid grid-cols-2 gap-2">
                            {['A4 Plain Paper', 'A3 Poster Sheet'].map((paper) => {
                              if (portalServices[paper] === false) return null;
                              const isSelected = previewPaperSize === (paper.startsWith('A4') ? 'A4' : 'A3');
                              return (
                                <button
                                  key={paper}
                                  type="button"
                                  onClick={() => setPreviewPaperSize(paper.startsWith('A4') ? 'A4' : 'A3')}
                                  className={`py-1.5 px-2.5 rounded-xl text-[10px] font-bold border transition-all ${
                                    isSelected
                                      ? 'border-[#4F46E5] bg-indigo-50 text-[#4F46E5] dark:bg-indigo-950/60 dark:text-indigo-200'
                                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                                  }`}
                                >
                                  {paper}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Order Calculation & Pay Button */}
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-500 dark:text-gray-400">Total Calculation:</span>
                            <span className="font-extrabold text-sm text-gray-900 dark:text-white">
                              ₹{(18 * (previewColorMode === 'bw' ? 2 : 10)).toFixed(2)}
                            </span>
                          </div>
                          <div className="text-[9px] text-gray-400 text-center">
                            18 pages · {previewColorMode === 'bw' ? 'B&W' : 'Color'} · {previewPrintStyle === 'single' ? 'Single-Sided' : 'Duplex'}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const amount = (18 * (previewColorMode === 'bw' ? 2 : 10)).toFixed(2);
                              setGlobalToast(`Customer preview test: Order simulated for ₹${amount}`);
                            }}
                            className="w-full py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                          >
                            Pay &amp; Generate Pickup PIN
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                SUBTAB 6: AUTOMATION & PAYMENT
            ═══════════════════════════════════════════════════════════════ */}
            {setupTab === 'automation' && (
              <div className="space-y-6">
                <div className="text-xs text-gray-400">
                  <span>Shop settings</span> &gt; <span className="text-gray-600 dark:text-gray-300 font-bold">Automation &amp; Payment</span>
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-[#172031] dark:text-white">Automation &amp; Payment</h2>
                  <p className="text-xs text-gray-400">Order currency, payment accounts and print automation</p>
                </div>

                {/* Currency Box */}
                <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-3">
                  <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Currency</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs items-center">
                    <div>
                      <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">Customer payment currency</label>
                      <select disabled className="w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-bold">
                        <option>INR — Indian Rupee</option>
                      </select>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      New orders use this currency. Existing orders and payments keep their saved currency. This does not change your Inklly subscription. Save page settings to apply.
                    </p>
                  </div>
                </div>

                {/* Use Own Payment Gateway */}
                <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-4">
                  <div>
                    <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Use Own Payment Gateway</h3>
                    <p className="text-[11px] text-gray-400">Connect your account to receive customer payments directly. Bank and payout details are managed in your gateway dashboard.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Razorpay */}
                    <div className="p-4 border rounded-2xl space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-sm text-[#172031] dark:text-white">Razorpay</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${razorpayCredentialStatus.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {razorpayCredentialStatus.configured && razorpayCredentialStatus.webhookConfigured
                            ? `checkout ready · ${razorpayCredentialStatus.keyIdPreview}`
                            : razorpayCredentialStatus.configured ? 'webhook setup needed' : 'not configured'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Connect this shop’s Razorpay account and webhook. Customer payments go directly to this shop’s account; Inklly does not fall back to a platform account.
                      </p>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-300">
                          Razorpay Key ID
                          <input value={razorpayKeyId} onChange={(event) => setRazorpayKeyId(event.target.value)} autoComplete="off" spellCheck={false} placeholder={razorpayCredentialStatus.keyIdPreview || 'rzp_test_…'} className="mt-1 w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-normal" />
                        </label>
                        <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-300">
                          Razorpay Key Secret
                          <input type="password" value={razorpaySecret} onChange={(event) => setRazorpaySecret(event.target.value)} autoComplete="new-password" placeholder={razorpayCredentialStatus.configured ? 'Enter a new secret to rotate' : 'Paste your Key Secret'} className="mt-1 w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-normal" />
                        </label>
                        <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-300">
                          Razorpay Webhook Secret
                          <input type="password" value={razorpayWebhookSecret} onChange={(event) => setRazorpayWebhookSecret(event.target.value)} autoComplete="new-password" placeholder={razorpayCredentialStatus.webhookConfigured ? 'Enter a new webhook secret to rotate' : 'Create a webhook secret in Razorpay'} className="mt-1 w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-normal" />
                        </label>
                        <div className="flex gap-2">
                          <button type="button" disabled={!razorpayKeyId || !razorpaySecret || !razorpayWebhookSecret} onClick={saveRazorpayCredentials} className="px-4 py-2 bg-[#4F46E5] text-white rounded-xl text-xs font-bold disabled:opacity-50">
                            Save credentials
                          </button>
                          {razorpayCredentialStatus.configured && <button type="button" onClick={removeRazorpayCredentials} className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold">Disconnect</button>}
                        </div>
                      </div>
                      <div className="space-y-1 text-[10px] text-gray-400">
                        <p>Both secrets are encrypted before storage and are never shown again. Create the webhook in Razorpay with <code>payment.captured</code> enabled.</p>
                        {razorpayCredentialStatus.webhookUrl && <div className="flex items-center gap-2"><code className="break-all">{razorpayCredentialStatus.webhookUrl}</code><button type="button" onClick={() => navigator.clipboard?.writeText(razorpayCredentialStatus.webhookUrl)} className="shrink-0 underline">Copy URL</button></div>}
                        <p>Checkout becomes available after credentials are saved and the webhook secret is set.</p>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Customer Payment Options */}
                <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-4">
                  <div>
                    <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Customer payment options</h3>
                    <p className="text-[11px] text-gray-400">Choose how customers pay for QR and WhatsApp portal orders. These preferences apply when you save page settings.</p>
                  </div>

                  <div className="text-xs space-y-3">
                    <div>
                      <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">Customer payment gateway</label>
                      <select className="w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-bold">
                        <option>Razorpay</option>
                      </select>
                      <span className="text-[10px] text-gray-400 block mt-1">
                        Razorpay is the planned provider. Credentials are stored per shop; no platform account fallback is used.
                      </span>
                    </div>

                    <div className="p-3.5 border-2 border-emerald-400 dark:border-emerald-700 rounded-2xl flex justify-between items-center bg-emerald-50/20 dark:bg-emerald-950/20">
                      <div>
                        <div className="font-bold text-sm text-[#172031] dark:text-white">Online checkout</div>
                        <div className="text-[10px] text-gray-500">Not available yet. Saving Razorpay credentials does not turn on checkout or verify payments.</div>
                      </div>
                      <input type="checkbox" disabled checked={false} readOnly aria-label="Online checkout unavailable" className="toggle-checkbox w-4 h-4 text-emerald-600" />
                    </div>

                    <div className="p-3.5 border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl flex justify-between items-center bg-indigo-50/20 dark:bg-indigo-950/20">
                      <div>
                        <div className="font-bold text-sm text-[#172031] dark:text-white">Cash on collection</div>
                        <div className="text-[10px] text-gray-500">Available in the customer preview; staff record cash after collecting payment at the counter.</div>
                      </div>
                      <input type="checkbox" disabled checked readOnly aria-label="Cash on collection available" className="toggle-checkbox w-4 h-4 text-[#4D64E6]" />
                    </div>

                    <div className="pt-2 text-xs text-gray-500 dark:text-gray-400">
                      Checkout branding options will be available after payment integration is complete.
                    </div>
                  </div>
                </div>

                {/* Auto-Print Configuration */}
                <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">AUTO-PRINT CONFIGURATION</span>

                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs text-indigo-900 dark:text-indigo-300">
                    Current plan: Starter. Locked modes can be activated by upgrading or purchasing an eligible add-on.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="p-4 border rounded-2xl bg-gray-50/50 dark:bg-gray-900/40 opacity-75 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-300">
                        <span>⚡</span>
                        <span>🔒</span>
                        <span>Auto Print All Documents</span>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        After the customer confirms the order, every document is sent to the printer automatically. No merchant click is required.
                      </p>
                    </div>

                    <div className="p-4 border rounded-2xl bg-gray-50/50 dark:bg-gray-900/40 opacity-75 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-300">
                          <span>✓</span>
                          <span>🔒</span>
                          <span>Print Only After Payment</span>
                        </div>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Recommended</span>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        Documents download to the shop after confirmation, then print automatically only after online payment is verified.
                      </p>
                    </div>

                    <div className="p-4 border-2 border-indigo-500 dark:border-indigo-600 rounded-2xl bg-indigo-50/20 dark:bg-indigo-950/20 space-y-2">
                      <div className="flex items-center gap-1.5 font-extrabold text-[#4F46E5] dark:text-indigo-300">
                        <span>🔕</span>
                        <span>✓</span>
                        <span>Auto Print Off</span>
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                        Documents download to the shop, but printing starts only when the merchant uses One-Click Print on the order.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Order Separator */}
                <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">ORDER SEPARATOR</span>
                    <p className="text-[11px] text-gray-400">Prevent order mix-ups during busy auto-printing runs. Separator sheets print only when a real backlog exists — so you never waste paper in slow hours.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="p-4 border-2 border-blue-500 rounded-2xl bg-blue-50/20 space-y-1">
                      <div className="font-extrabold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                        <span>🚫</span> No Separator
                      </div>
                      <div className="text-[11px] text-gray-500">Orders print back-to-back</div>
                    </div>

                    <div className="p-4 border rounded-2xl space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <span>📄</span> B&amp;W Invoice
                      </div>
                      <div className="text-[11px] text-gray-500">Identified receipt sheet</div>
                    </div>

                    <div className="p-4 border rounded-2xl space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <span>📃</span> Blank Page
                      </div>
                      <div className="text-[11px] text-gray-500">Unmarked spacer sheet</div>
                    </div>
                  </div>
                </div>

                {/* Notifications & Receipts */}
                <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-4 text-xs">
                  <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Notifications &amp; receipts</h3>
                  <div className="flex justify-between items-center py-2 border-b">
                    <div>
                      <div className="font-bold">Push Notifications</div>
                      <div className="text-[10px] text-gray-400">New orders and printer updates</div>
                    </div>
                    <input type="checkbox" defaultChecked className="toggle-checkbox w-4 h-4 text-[#4D64E6]" />
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <div>
                      <div className="font-bold">Print Receipt</div>
                      <div className="text-[10px] text-gray-400">Print a paper receipt for each completed order</div>
                    </div>
                    <input type="checkbox" defaultChecked className="toggle-checkbox w-4 h-4 text-[#4D64E6]" />
                  </div>
                </div>

                {/* Footer Navigation */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-800 text-xs">
                  <span className="text-gray-400">Your edits are applied when you save changes.</span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'shop_qr' && (
          <div className="p-6 max-w-5xl w-full mx-auto space-y-6 animate-fadeIn">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#4D64E6] block">
                CUSTOMER INTAKE
              </span>
              <h2 className="text-xl font-extrabold text-[#172031] dark:text-white">Shop QR Code</h2>
              <p className="text-xs text-gray-400">Download, print and test the permanent QR displayed at your counter.</p>
            </div>

            {/* Custom Store Branding & Logo Studio (Pro & Scale Feature) */}
    {currentMerchant.customBrandingEnabled ? (
      <div className="bg-white dark:bg-gray-800 border-2 border-purple-200 dark:border-purple-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🎨</span>
              <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">
                Custom Store Branding & Counter QR Flyer Studio
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                PRO FEATURE UNLOCKED
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Customize the look, colors, and logo displayed on your shop QR standees and customer mobile portals.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setGlobalToast('Custom brand assets published to customer portal and QR print files')}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
          >
            Save Brand Style
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1.5">Brand Theme Color</label>
            <div className="flex items-center gap-2">
              {['#4D64E6', '#7C3AED', '#059669', '#DC2626', '#0284C7'].map((c) => (
                <button
                  key={c}
                  type="button"
                  style={{ backgroundColor: c }}
                  onClick={() => setGlobalToast(`Selected brand accent color: ${c}`)}
                  className="w-7 h-7 rounded-full border-2 border-white shadow-xs hover:scale-110 transition-transform cursor-pointer"
                />
              ))}
            </div>
          </div>
          <div>
            <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1.5">Custom Shop Logo</label>
            <button
              type="button"
              onClick={() => setGlobalToast('Logo uploaded: shop_logo_vector.svg')}
              className="px-3 py-1.5 border border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 rounded-xl text-gray-600 dark:text-gray-300 font-bold w-full text-center"
            >
              + Upload Logo (.PNG / .SVG)
            </button>
          </div>
          <div>
            <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1.5">Counter Standee Format</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGlobalToast('Downloading custom A4 Counter Standee with logo')}
                className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 font-bold rounded-lg text-center text-[11px]"
              >
                A4 Table Tent
              </button>
              <button
                type="button"
                onClick={() => setGlobalToast('Downloading custom Acrylic Standee Sticker')}
                className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 font-bold rounded-lg text-center text-[11px]"
              >
                Acrylic Sticker
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : (
      <div className="p-5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5">
          <span className="text-xl">🔒</span>
          <div>
            <span className="font-bold text-purple-950 dark:text-purple-200 block">
              Custom Store Branding is Locked on {currentMerchant.planBadge}
            </span>
            <span className="text-purple-700 dark:text-purple-300 text-[11px]">
              Replacing standard Inklly branding with your custom shop logo, brand colors, and tailored standees is included in <strong>Pro (₹499/mo)</strong> and <strong>Scale (₹899/mo)</strong>.
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleSwitchMerchant('merchant-pro-monthly')}
          className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
        >
          ⚡ Upgrade to Pro (₹499/mo)
        </button>
      </div>
    )}

    {/* Permanent Shop QR Card */}
            <div className="bg-white dark:bg-gray-800 border border-[#E8EAF3] dark:border-gray-800 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 pb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                  ⊞
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#172031] dark:text-white">Permanent Shop QR</h3>
                  <p className="text-xs text-gray-400">Print this QR and place it at your counter for walk-in customers</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                {/* Left: Physical Counter Standee Mockup */}
                <div className="md:col-span-5 flex justify-center">
                  <div className="w-64 bg-[#2563EB] text-white p-5 rounded-3xl shadow-2xl text-center space-y-3">
                    {/* Top White Brand Pill */}
                    <div className="bg-white text-gray-900 px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 shadow-sm">
                      <InkllyMark size={16} />
                      <span className="text-xs font-black tracking-wide text-gray-900">Inklly</span>
                    </div>

                    {/* White Placard */}
                    <div className="bg-white text-gray-900 p-4 rounded-2xl shadow-inner space-y-2">
                      <div className="text-base font-black text-[#2563EB]">
                        QR <span className="text-[#2563EB]">से</span> Print
                      </div>

                      {/* 3 Icons */}
                      <div className="flex items-center justify-center gap-4 text-[9px] text-gray-500 font-bold">
                        <div className="flex flex-col items-center">
                          <span>📷</span>
                          <span className="text-[7px] uppercase mt-0.5">Camera</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span>🔍</span>
                          <span className="text-[7px] uppercase mt-0.5">Google Lens</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span>📱</span>
                          <span className="text-[7px] uppercase mt-0.5">Any QR App</span>
                        </div>
                      </div>

                      {/* Crisp Inklly QR SVG */}
                      {/* Real Dynamic Scannable Inklly QR */}
                      <div className="w-36 h-36 bg-white mx-auto rounded-xl flex items-center justify-center p-1.5 border border-gray-100 overflow-hidden shadow-xs">
                        {qrDataUrl ? (
                          <img
                            src={qrDataUrl}
                            alt={`${currentMerchant.name} Counter QR Code`}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="text-[10px] text-gray-400 font-bold">Generating QR...</div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Shop Name on Blue Standee */}
                    <div className="text-xs font-black tracking-wide text-white truncate px-2">
                      {currentMerchant.name}
                    </div>
                  </div>
                </div>

                {/* Right: Info & Actions */}
                <div className="md:col-span-7 space-y-4">
                  <div>
                    <h3 className="font-black text-lg text-[#172031] dark:text-white">{currentMerchant.name}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed mt-1">
                      Customers scan this permanent QR and continue through your customised customer-details and secure document-upload flow.
                    </p>
                  </div>

                  <div>
                    <input
                      type="text"
                      readOnly
                      value={liveShopUrl}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs bg-gray-50 dark:bg-gray-900 font-mono text-gray-700 dark:text-gray-300"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleDownloadQrPng}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>📥</span> Download QR (PNG)
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyShopUrl}
                      className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <span>📋</span> Copy link
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate?.(`/p/${currentMerchant.shopCode || 'campus1'}`)}
                      className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <span>🚀</span> Open Customer Portal
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Offline Toast Notification matching screenshot */}
            <div className="fixed bottom-6 right-6 z-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-xl flex items-start gap-3 max-w-sm animate-fadeIn">
              <span className="text-amber-500 font-bold text-base mt-0.5">⚠</span>
              <div className="text-xs space-y-0.5">
                <div className="font-extrabold text-[#172031] dark:text-white">Print computer is offline</div>
                <div className="text-gray-500 dark:text-gray-400 text-[11px] leading-tight">
                  Open Inklly on your print computer, then refresh the printer list.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOfflineToast(false)}
                className="text-gray-400 hover:text-gray-600 text-xs ml-auto"
              >
                ✕
              </button>
            </div>
          </div>
        )}

      {/* ─────────────────────────────────────────────────────────────
          REVIEW YOUR PLAN MODAL (Upgrade Plan)
      ───────────────────────────────────────────────────────────── */}
      {false && upgradeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
          <div className="max-w-6xl w-full bg-white dark:bg-[#1E293B] rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[94vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/40">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#4D64E6] block">
                  PLANS BUILT FOR PROFITABLE PRINTING
                </span>
                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  Choose your Inklly plan
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  WhatsApp service conversations started by customers are not charged by Inklly. Paid Meta templates, if ever used, remain separate.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-bold hidden sm:inline">Billing currency</span>
                  <select className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                    <option>INR — Indian Rupee</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setUpgradeModalOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Billing Interval Pill Switcher */}
              <div className="flex items-center justify-center">
                <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl flex items-center gap-1 border border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setBillingCycleUpgrade('monthly')}
                    className={`px-5 py-2 rounded-xl font-bold transition-all ${
                      billingCycleUpgrade === 'monthly'
                        ? 'bg-[#4D64E6] text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycleUpgrade('yearly')}
                    className={`px-5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                      billingCycleUpgrade === 'yearly'
                        ? 'bg-[#4D64E6] text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <span>Yearly · save</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycleUpgrade('lifetime')}
                    className={`px-5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                      billingCycleUpgrade === 'lifetime'
                        ? 'bg-[#4D64E6] text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <span>Lifetime · 90% off</span>
                  </button>
                </div>
              </div>

              {/* 4 Plan Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
                {/* 1. Starter */}
                <div className="border border-emerald-300 dark:border-emerald-700 rounded-3xl p-5 bg-white dark:bg-gray-800 flex flex-col justify-between shadow-xs relative">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase mb-2">
                      CURRENT PLAN
                    </span>
                    <h4 className="text-base font-black text-gray-900 dark:text-white">Starter</h4>
                    <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                      QR and WhatsApp portal for a small single-printer shop.
                    </p>

                    <div className="my-3 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-gray-900 dark:text-white">
                        {billingCycleUpgrade === 'monthly' ? '₹99' : billingCycleUpgrade === 'yearly' ? '₹79' : '₹999'}
                      </span>
                      <span className="text-gray-400 text-[10px]">
                        {billingCycleUpgrade === 'lifetime' ? 'one-time' : '/month'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px] text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700 pt-3">
                      <div>✓ 25 orders/day</div>
                      <div>✓ 300 orders/month</div>
                      <div>✓ 600 files/month</div>
                      <div>✓ 10 MB/file</div>
                      <div>✓ 1 WhatsApp accounts</div>
                      <div>✓ 1 printers</div>
                      <div>✓ 1 dashboard users</div>
                      <div>✓ 50 conversions</div>
                      <div>✓ 25 editor exports</div>
                      <div>✓ 100 scanner pages</div>
                      <div>✓ 30 days analytics</div>
                      <div>✓ Manual print release</div>
                      <div>✓ QR + WhatsApp portals</div>
                      <div className="text-gray-400">✓ CSV export not included</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full py-2.5 mt-5 bg-emerald-600 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>⚡</span> Active now
                  </button>
                </div>

                {/* 2. Growth */}
                <div className="border-2 border-indigo-400 dark:border-indigo-600 rounded-3xl p-5 bg-indigo-50/20 dark:bg-indigo-950/20 flex flex-col justify-between shadow-md relative">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-600 text-white uppercase mb-2">
                      MOST POPULAR
                    </span>
                    <h4 className="text-base font-black text-gray-900 dark:text-white">Growth</h4>
                    <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                      Payment-triggered automation for growing shops.
                    </p>

                    <div className="my-3 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-gray-900 dark:text-white">
                        {billingCycleUpgrade === 'monthly' ? '₹199' : billingCycleUpgrade === 'yearly' ? '₹159' : '₹1,999'}
                      </span>
                      <span className="text-gray-400 text-[10px]">
                        {billingCycleUpgrade === 'lifetime' ? 'one-time' : '/month'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px] text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700 pt-3">
                      <div>✓ 100 orders/day</div>
                      <div>✓ 1,500 orders/month</div>
                      <div>✓ 3,000 files/month</div>
                      <div>✓ 25 MB/file</div>
                      <div>✓ 1 WhatsApp accounts</div>
                      <div>✓ 2 printers</div>
                      <div>✓ 2 dashboard users</div>
                      <div>✓ 500 conversions</div>
                      <div>✓ 250 editor exports</div>
                      <div>✓ 1,000 scanner pages</div>
                      <div>✓ 90 days analytics</div>
                      <div>✓ Payment-received auto print</div>
                      <div>✓ QR + WhatsApp portals</div>
                      <div>✓ CSV export</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlanTier('growth');
                      handleConfirmUpgrade();
                    }}
                    className="w-full py-2.5 mt-5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    <span>⚡</span> Upgrade plan
                  </button>
                </div>

                {/* 3. Pro */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-3xl p-5 bg-white dark:bg-gray-800 flex flex-col justify-between shadow-xs">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 uppercase mb-2">
                      PRO
                    </span>
                    <h4 className="text-base font-black text-gray-900 dark:text-white">Pro</h4>
                    <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                      Full automatic printing with multiple printers and staff.
                    </p>

                    <div className="my-3 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-gray-900 dark:text-white">
                        {billingCycleUpgrade === 'monthly' ? '₹499' : billingCycleUpgrade === 'yearly' ? '₹399' : '₹4,999'}
                      </span>
                      <span className="text-gray-400 text-[10px]">
                        {billingCycleUpgrade === 'lifetime' ? 'one-time' : '/month'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px] text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700 pt-3">
                      <div>✓ 300 orders/day</div>
                      <div>✓ 6,000 orders/month</div>
                      <div>✓ 12,000 files/month</div>
                      <div>✓ 50 MB/file</div>
                      <div>✓ 2 WhatsApp accounts</div>
                      <div>✓ 5 printers</div>
                      <div>✓ 5 dashboard users</div>
                      <div>✓ 2,500 conversions</div>
                      <div>✓ 1,500 editor exports</div>
                      <div>✓ 5,000 scanner pages</div>
                      <div>✓ 365 days analytics</div>
                      <div>✓ All-document auto print</div>
                      <div>✓ QR + WhatsApp portals</div>
                      <div>✓ CSV export</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlanTier('pro');
                      handleConfirmUpgrade();
                    }}
                    className="w-full py-2.5 mt-5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    <span>⚡</span> Upgrade plan
                  </button>
                </div>

                {/* 4. Scale */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-3xl p-5 bg-white dark:bg-gray-800 flex flex-col justify-between shadow-xs">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 uppercase mb-2">
                      ENTERPRISE
                    </span>
                    <h4 className="text-base font-black text-gray-900 dark:text-white">Scale</h4>
                    <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                      High-volume automation for busy shops and branches.
                    </p>

                    <div className="my-3 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-gray-900 dark:text-white">
                        {billingCycleUpgrade === 'monthly' ? '₹899' : billingCycleUpgrade === 'yearly' ? '₹719' : '₹8,999'}
                      </span>
                      <span className="text-gray-400 text-[10px]">
                        {billingCycleUpgrade === 'lifetime' ? 'one-time' : '/month'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px] text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700 pt-3">
                      <div>✓ 2,500 orders/day</div>
                      <div>✓ 50,000 orders/month</div>
                      <div>✓ 100,000 files/month</div>
                      <div>✓ 100 MB/file</div>
                      <div>✓ 5 WhatsApp accounts</div>
                      <div>✓ 10 printers</div>
                      <div>✓ 10 dashboard users</div>
                      <div>✓ 20,000 conversions</div>
                      <div>✓ 10,000 editor exports</div>
                      <div>✓ 25,000 scanner pages</div>
                      <div>✓ 730 days analytics</div>
                      <div>✓ All-document auto print</div>
                      <div>✓ QR + WhatsApp portals</div>
                      <div>✓ CSV export</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlanTier('scale');
                      handleConfirmUpgrade();
                    }}
                    className="w-full py-2.5 mt-5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    <span>⚡</span> Upgrade plan
                  </button>
                </div>
              </div>

              {/* Status Box */}
              <div className="p-4 border rounded-2xl bg-gray-50/50 dark:bg-gray-800/40 text-xs">
                <div className="font-extrabold text-gray-800 dark:text-gray-200">Automatic renewal cancelled</div>
                <div className="text-[11px] text-gray-400">Access remains available until the paid period ends.</div>
              </div>

              {/* Add-ons (INR) Card */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-3xl p-6 bg-white dark:bg-gray-800 space-y-4">
                <h4 className="text-sm font-extrabold text-center text-gray-900 dark:text-white">
                  Add-ons (INR)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  {[
                    'Additional printer · ₹99.00/month',
                    'Additional WhatsApp account · ₹199.00/month',
                    '1,000 additional files · ₹99.00/month',
                    '1,000 conversion credits · ₹299.00/month',
                    '1,000 editor exports · ₹299.00/month',
                    '1,000 scanner pages · ₹299.00/month',
                  ].map((addon) => (
                    <div key={addon} className="p-3 border rounded-xl bg-gray-50 dark:bg-gray-900 text-center font-medium text-gray-700 dark:text-gray-300">
                      {addon}
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-gray-400 text-center leading-relaxed pt-2">
                  Employee access adds separate dashboard logins under one business. Employees with Printer setup permission use their own agent credentials and connected printers; the owner's setup remains unchanged. Shop QR, pricing and business settings stay shared. Dashboard-user capacity includes the owner; printer connections remain subject to their separate plan/add-on limit.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setUpgradeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={upgradeProcessing}
                onClick={handleConfirmUpgrade}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#4D64E6] to-[#4338CA] hover:from-[#3F54D1] hover:to-[#3730A3] text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {upgradeProcessing ? (
                  <span>Authorizing AutoPay Mandate...</span>
                ) : (
                  <span>Authorize via Razorpay AutoPay →</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          INTERACTIVE GUIDED PRODUCT TOUR MODAL
      ───────────────────────────────────────────────────────────── */}
      {tourOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 relative">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950 text-[#4D64E6] dark:text-indigo-300">
                  {TOUR_STEPS[tourStep].badge}
                </span>
                <span className="text-xs text-gray-400">Inklly Guided Walkthrough</span>
              </div>
              <button
                type="button"
                onClick={() => setTourOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-[#172031] dark:text-white">
                {TOUR_STEPS[tourStep].title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-300 leading-relaxed">
                {TOUR_STEPS[tourStep].desc}
              </p>
            </div>

            {/* Visual Step Spotlight Card */}
            <div className="p-4 bg-gradient-to-br from-indigo-50/70 to-blue-50/50 dark:from-gray-900 dark:to-gray-800 rounded-2xl border border-indigo-100 dark:border-gray-700 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#4D64E6] dark:text-indigo-300">
                <span>💡 Pro Tip:</span>
                <span>{TOUR_STEPS[tourStep].tip}</span>
              </div>
            </div>

            {/* Step Indicators & Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-1.5">
                {TOUR_STEPS.map((sItem, idx) => (
                  <button
                    key={sItem.step}
                    type="button"
                    onClick={() => {
                      setTourStep(idx);
                      if (sItem.targetTab) {
                        setActiveView(sItem.targetTab as any);
                        if (sItem.targetSubtab) setSetupTab(sItem.targetSubtab as any);
                      }
                    }}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      idx === tourStep
                        ? 'w-8 bg-[#4D64E6]'
                        : 'w-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300'
                    }`}
                    title={sItem.title}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {tourStep > 0 && (
                  <button
                    type="button"
                    onClick={handlePrevTourStep}
                    className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 cursor-pointer"
                  >
                    Previous
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNextTourStep}
                  className="px-5 py-2 bg-[#4D64E6] hover:bg-[#3D52D5] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <span>{tourStep === TOUR_STEPS.length - 1 ? 'Finish Tour' : 'Next Step'}</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ADD PRINTER MODAL
      ───────────────────────────────────────────────────────────── */}
      {showAddPrinterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-extrabold text-sm text-[#172031] dark:text-white flex items-center gap-2">
                <span>🖨</span>
                <span>Add Detected or Network Printer</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPrinterModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Printer Device Name</label>
                <input
                  type="text"
                  value={newPrinterName}
                  onChange={(e) => setNewPrinterName(e.target.value)}
                  placeholder="e.g. Canon LBP2900, HP LaserJet M401"
                  className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Port / Connection</label>
                <select
                  value={newPrinterPort}
                  onChange={(e) => setNewPrinterPort(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-medium"
                >
                  <option value="USB001">USB001 (Local USB Spooler)</option>
                  <option value="USB002">USB002 (Local USB Spooler)</option>
                  <option value="TCP_IP">TCP/IP Network Port (192.168.1.150)</option>
                  <option value="PORTPROMPT">PORTPROMPT: (Virtual Spooler)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 p-3 border rounded-xl bg-gray-50 dark:bg-gray-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPrinterColor}
                    onChange={(e) => setNewPrinterColor(e.target.checked)}
                    className="rounded text-[#4D64E6]"
                  />
                  <span className="font-bold">Color Supported</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl bg-gray-50 dark:bg-gray-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPrinterDuplex}
                    onChange={(e) => setNewPrinterDuplex(e.target.checked)}
                    className="rounded text-[#4D64E6]"
                  />
                  <span className="font-bold">Duplex Auto</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end items-center gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowAddPrinterModal(false)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newPrinterName.trim()) {
                    triggerSaveNotification('⚠️ Please enter a valid printer name');
                    return;
                  }
                  const newDevice = {
                    name: newPrinterName.trim(),
                    driver: newPrinterName.trim() + ' Driver',
                    port: newPrinterPort,
                    status: 'Ready' as const,
                    isDefault: false,
                    isPhysical: !newPrinterPort.includes('PROMPT'),
                    supportsColor: newPrinterColor,
                    supportsDuplex: newPrinterDuplex,
                    tray: 'Auto-Select (Tray 1: A4 Standard)',
                  };
                  setDetectedPrinters((prev) => [...prev, newDevice]);
                  setShowAddPrinterModal(false);
                  setNewPrinterName('');
                  triggerSaveNotification(`✓ Printer ${newDevice.name} registered and ready for spooling!`);
                }}
                className="px-5 py-2 bg-[#4D64E6] hover:bg-[#3D52D5] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Save Printer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          GLOBAL OFFLINE TOAST (Bottom-Right)
      ───────────────────────────────────────────────────────────── */}
      {showOfflineToast && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-2xl p-4 shadow-xl z-50 max-w-sm flex items-start gap-3 animate-fade-in">
          <span className="text-xl">⚠️</span>
          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs text-gray-900 dark:text-white">Print computer is offline</h4>
              <button
                type="button"
                onClick={() => setShowOfflineToast(false)}
                className="text-gray-400 hover:text-black dark:hover:text-white text-xs ml-2"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              Open Inklly on your print computer, then refresh the printer list.
            </p>
          </div>
        </div>
      )}
      {/* Mobile Bottom Navigation Bar (Visible on phones & compact screens < md) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-30 flex items-center justify-around py-2 px-1 text-[10px] font-bold pb-safe shadow-lg">
        <button
          type="button"
          onClick={() => setActiveView('dashboard')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-colors ${
            activeView === 'dashboard' ? 'text-[#4D64E6] font-black' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <MonitorIcon size={18} />
          <span>Home</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveView('orders')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl relative transition-colors ${
            activeView === 'orders' ? 'text-[#4D64E6] font-black' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <InboxIcon size={18} />
          <span>Orders</span>
          {ordersList.filter((o) => o.tab === 'pending').length > 0 && (
            <span className="absolute top-0.5 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveView('live_print')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-colors ${
            activeView === 'live_print' ? 'text-[#4D64E6] font-black' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <PrinterIcon size={18} />
          <span>Spooler</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveView('business_setup')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-colors ${
            activeView === 'business_setup' ? 'text-[#4D64E6] font-black' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <SlidersIcon size={18} />
          <span>Setup</span>
        </button>
        <button
          type="button"
          onClick={() => setSidebarExpanded(true)}
          className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
        >
          <MenuIcon size={18} />
          <span>More</span>
        </button>
      </nav>
            </div>
    </div>
  );
};
