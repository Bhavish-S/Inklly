import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';

import { ProtectedRoute } from './components/ProtectedRoute';
import { QrCodeIcon, PrinterIcon, Logo, ShieldIcon, CodeIcon } from './components/icons';

// Keep each route's code out of the initial marketing bundle. The customer
// portal includes PDF rendering, so loading it only on /p/:shopCode materially
// reduces the first download for public-site visitors.
const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));
const PrintAutomationPage = lazy(() => import('./pages/PrintAutomationPage').then((module) => ({ default: module.PrintAutomationPage })));
const WhatsAppPrintingPage = lazy(() => import('./pages/WhatsAppPrintingPage').then((module) => ({ default: module.WhatsAppPrintingPage })));
const QrOrderingPage = lazy(() => import('./pages/QrOrderingPage').then((module) => ({ default: module.QrOrderingPage })));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage').then((module) => ({ default: module.HowItWorksPage })));
const PricingPage = lazy(() => import('./pages/PricingPage').then((module) => ({ default: module.PricingPage })));
const ContactPage = lazy(() => import('./pages/ContactPage').then((module) => ({ default: module.ContactPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((module) => ({ default: module.RegisterPage })));
const AcceptInvitationPage = lazy(() => import('./pages/AcceptInvitationPage').then((module) => ({ default: module.AcceptInvitationPage })));
const LegalPage = lazy(() => import('./pages/LegalPage').then((module) => ({ default: module.LegalPage })));
const CustomerPortalOrderView = lazy(() => import('./views/CustomerPortalOrderView').then((module) => ({ default: module.CustomerPortalOrderView })));
const OrderTrackerView = lazy(() => import('./views/OrderTrackerView').then((module) => ({ default: module.OrderTrackerView })));
const MerchantAppView = lazy(() => import('./views/MerchantAppView').then((module) => ({ default: module.MerchantAppView })));
const PlatformAdminView = lazy(() => import('./views/PlatformAdminView').then((module) => ({ default: module.PlatformAdminView })));
const DeveloperPortalView = lazy(() => import('./views/DeveloperPortalView').then((module) => ({ default: module.DeveloperPortalView })));

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });
  const [trackedOrderId, setTrackedOrderId] = useState<string>(() => new URLSearchParams(window.location.search).get('order') || '');
  const [trackedShopCode, setTrackedShopCode] = useState<string>(() => new URLSearchParams(window.location.search).get('shop') || 'campus1');

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
      if (window.location.pathname === '/track') {
        const params = new URLSearchParams(window.location.search);
        setTrackedOrderId(params.get('order') || '');
        setTrackedShopCode(params.get('shop') || 'campus1');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    const destination = new URL(path, window.location.origin);
    if (`${window.location.pathname}${window.location.search}` !== `${destination.pathname}${destination.search}`) {
      window.history.pushState({}, '', destination.href);
    }
    setCurrentPath(destination.pathname);
    if (destination.pathname === '/track') {
      setTrackedOrderId(destination.searchParams.get('order') || '');
      setTrackedShopCode(destination.searchParams.get('shop') || 'campus1');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOrderSubmitted = (orderId: string, shopCode = 'campus1') => {
    setTrackedOrderId(orderId);
    setTrackedShopCode(shopCode);
    navigate(`/track?order=${encodeURIComponent(orderId)}&shop=${encodeURIComponent(shopCode)}`);
  };

  const isStandaloneApp =
    currentPath === '/merchant' ||
    currentPath === '/dashboard' ||
    currentPath === '/customer' ||
    currentPath.startsWith('/p/') ||
    currentPath === '/track' ||
    currentPath === '/platform' ||
    currentPath === '/admin' ||
    currentPath === '/developer';

  // Normalize common typo redirects
  useEffect(() => {
    const lower = currentPath.toLowerCase().replace(/\/$/, '');
    if (lower === '/merchat' || lower === '/merchants') {
      navigate('/merchant');
    } else if (lower === '/admins' || lower === '/platform-admin') {
      navigate('/admin');
    } else if (lower === '/dev' || lower === '/devs' || lower === '/developers') {
      navigate('/developer');
    }
  }, [currentPath]);

  const knownRoutes = [
    '/',
    '/print-shop-automation-software',
    '/whatsapp-printing-software',
    '/qr-code-printing-system',
    '/kiosk-software',
    '/franchise',
    '/how-it-works',
    '/pricing',
    '/contact',
    '/login',
    '/register',
    '/activate-owner',
    '/accept-invitation',
    '/legal',
    '/legal/privacy-policy',
    '/legal/terms',
    '/legal/refund-policy',
    '/legal/delivery-policy',
    '/customer',
    '/track',
    '/merchant',
    '/dashboard',
    '/platform',
    '/admin',
    '/developer',
  ];

  const isKnown =
    knownRoutes.includes(currentPath) ||
    currentPath.startsWith('/p/') ||
    ['/merchat', '/merchants', '/admins', '/platform-admin', '/dev', '/devs', '/developers'].includes(currentPath.toLowerCase().replace(/\/$/, ''));

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#FBFCFE' }}>
      {/* Primary Sticky Website Navbar (Hidden in Standalone Workspace/Portal mode) */}
      {!isStandaloneApp && <Navbar currentPath={currentPath} onNavigate={navigate} />}

      {/* Main Content Router */}
      <main style={{ flex: 1 }}>
        <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-sm text-slate-500" role="status">Loading page…</div>}>
        {/* Route 1: Home */}
        {currentPath === '/' && <HomePage onNavigate={navigate} />}

        {/* Route 2: Print Shop Automation Software */}
        {currentPath === '/print-shop-automation-software' && (
          <PrintAutomationPage onNavigate={navigate} />
        )}

        {/* Route 3: WhatsApp Printing Software */}
        {currentPath === '/whatsapp-printing-software' && (
          <WhatsAppPrintingPage onNavigate={navigate} />
        )}

        {/* Route 4: QR Code Printing System */}
        {currentPath === '/qr-code-printing-system' && (
          <QrOrderingPage onNavigate={navigate} />
        )}

        {/* Redirects for excluded reference concepts */}
        {currentPath === '/kiosk-software' && (
          <PrintAutomationPage onNavigate={navigate} />
        )}
        {currentPath === '/franchise' && (
          <PricingPage onNavigate={navigate} />
        )}

        {/* Route 5: How It Works */}
        {currentPath === '/how-it-works' && (
          <HowItWorksPage onNavigate={navigate} />
        )}

        {/* Route 6: Pricing */}
        {currentPath === '/pricing' && (
          <PricingPage onNavigate={navigate} />
        )}

        {/* Route 7: Contact */}
        {currentPath === '/contact' && (
          <ContactPage onNavigate={navigate} />
        )}

        {/* Route 8: Login */}
        {currentPath === '/login' && (
          <LoginPage onNavigate={navigate} onLoginSuccess={() => navigate('/merchant')} />
        )}

        {/* Route 9: Register */}
        {currentPath === '/register' && (
          <RegisterPage onNavigate={navigate} onRegisterSuccess={() => navigate('/merchant')} />
        )}
        {(currentPath === '/activate-owner' || currentPath === '/accept-invitation') && <AcceptInvitationPage onNavigate={navigate} />}

        {/* Legal Policies */}
        {currentPath === '/legal/privacy-policy' && (
          <LegalPage initialTab="privacy" onNavigate={navigate} />
        )}
        {currentPath === '/legal/terms' && (
          <LegalPage initialTab="terms" onNavigate={navigate} />
        )}
        {currentPath === '/legal/refund-policy' && (
          <LegalPage initialTab="refund" onNavigate={navigate} />
        )}
        {currentPath === '/legal/delivery-policy' && (
          <LegalPage initialTab="delivery" onNavigate={navigate} />
        )}

        {/* Fallback for general /legal path */}
        {currentPath === '/legal' && (
          <LegalPage initialTab="privacy" onNavigate={navigate} />
        )}

        {/* Live Working Views */}
        {(currentPath === '/customer' || currentPath.startsWith('/p/')) && (
          <CustomerPortalOrderView
            shopCode={currentPath.startsWith('/p/') ? currentPath.replace('/p/', '').split('/')[0] || 'campus1' : 'campus1'}
            onNavigateHome={() => navigate('/')}
            onOrderSubmitted={handleOrderSubmitted}
          />
        )}
        {currentPath === '/track' && (
          <OrderTrackerView
            orderId={trackedOrderId}
            onBackToPortal={() => navigate(`/p/${encodeURIComponent(trackedShopCode)}`)}
          />
        )}
        {(currentPath === '/merchant' || currentPath === '/dashboard') && (
          <ProtectedRoute
            allowedRoles={['MERCHANT_OWNER', 'SHOP_MANAGER', 'SHOP_STAFF']}
            fallbackPath="/login"
            onNavigate={navigate}
            requiredRoleName="Merchant"
          >
            <MerchantAppView onNavigate={navigate} />
          </ProtectedRoute>
        )}
        {(currentPath === '/platform' || currentPath === '/admin' || currentPath === '/developer') && (
          <ProtectedRoute
            allowedRoles={
              currentPath === '/developer'
                ? ['DEVELOPER', 'PLATFORM_OWNER', 'PLATFORM_ADMIN']
                : ['PLATFORM_OWNER', 'PLATFORM_ADMIN']
            }
            fallbackPath="/login"
            onNavigate={navigate}
            requiredRoleName={currentPath === '/developer' ? 'Developer' : 'Platform Owner'}
          >
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
              {/* Top Privileged Console Bar */}
              <header className="bg-slate-900 border-b border-slate-800 text-white px-4 sm:px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 sticky top-0 z-40">
                <div className="flex items-center gap-3">
                  <Logo size={20} variant="white" onClick={() => navigate('/')} />
                  <span className="hidden sm:inline text-slate-600">|</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                      {currentPath === '/developer' ? 'Developer Hub' : 'Platform Owner Console'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Authenticated Console
                    </span>
                  </div>
                </div>

                {/* Console Switcher Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold scrollbar-none">
                  <button
                    type="button"
                    onClick={() => navigate('/platform')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      currentPath === '/platform' || currentPath === '/admin'
                        ? 'bg-[#4D64E6] text-white shadow-xs'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <ShieldIcon size={14} />
                    <span>Platform Owner</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/developer')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      currentPath === '/developer'
                        ? 'bg-[#4D64E6] text-white shadow-xs'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <CodeIcon size={14} />
                    <span>Developer Hub</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/merchant')}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                    title="Open Merchant POS Workspace"
                  >
                    <span>🏪 Merchant POS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const storedShop = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('inklly_shop') || 'null') : null;
                      navigate(`/p/${storedShop?.shopCode || 'campus1'}`);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                    title="Open Customer Counter QR Portal"
                  >
                    <QrCodeIcon size={13} />
                    <span>Shop QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('inklly_token');
                      localStorage.removeItem('inklly_user');
                      localStorage.removeItem('inklly_shop');
                      navigate('/login');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-rose-300 hover:text-white hover:bg-rose-950/60 rounded-lg transition-all cursor-pointer border border-rose-800/40"
                    title="Sign Out of Session"
                  >
                    <span>Sign Out</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer border border-slate-700/60"
                  >
                    <span>← Website</span>
                  </button>
                </div>
              </header>

              {/* Active Console View */}
              <div className="flex-1">
                {(currentPath === '/platform' || currentPath === '/admin') && (
                  <PlatformAdminView onNavigate={navigate} />
                )}
                {currentPath === '/developer' && (
                  <DeveloperPortalView onNavigate={navigate} />
                )}
              </div>
            </div>
          </ProtectedRoute>
        )}

        {/* 404 Fallback for Unmatched Routes */}
        {!isKnown && (
          <div className="min-h-[70vh] flex items-center justify-center p-6 text-center">
            <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto text-2xl font-black">
                404
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Page Not Found</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  The page <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-mono text-[11px]">{currentPath}</code> does not exist or has been relocated.
                </p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  Return to Home
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/merchant')}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Merchant Portal
                </button>
              </div>
            </div>
          </div>
        )}
        </Suspense>
      </main>

      {/* Global Footer & Floating WhatsApp (Only on public website) */}
      {!isStandaloneApp && <Footer onNavigate={navigate} />}
      {!isStandaloneApp && <FloatingWhatsApp />}
    </div>
  );
};
