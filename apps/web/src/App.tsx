import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';

// Core Pages
import { HomePage } from './pages/HomePage';
import { PrintAutomationPage } from './pages/PrintAutomationPage';
import { WhatsAppPrintingPage } from './pages/WhatsAppPrintingPage';
import { QrOrderingPage } from './pages/QrOrderingPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { PricingPage } from './pages/PricingPage';
import { ContactPage } from './pages/ContactPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { LegalPage } from './pages/LegalPage';

// Embedded Live Working Applications & Portals
import { CustomerPortalOrderView } from './views/CustomerPortalOrderView';
import { OrderTrackerView } from './views/OrderTrackerView';
import { MerchantAppView } from './views/MerchantAppView';
import { PlatformAdminView } from './views/PlatformAdminView';
import { DeveloperPortalView } from './views/DeveloperPortalView';
import { ProtectedRoute } from './components/ProtectedRoute';
import { QrCodeIcon, PrinterIcon, Logo, ShieldIcon, CodeIcon } from './components/icons';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });
  const [trackedOrderId, setTrackedOrderId] = useState<string>('order-demo-001');

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOrderSubmitted = (orderId: string) => {
    setTrackedOrderId(orderId);
    navigate('/track');
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
            onBackToPortal={() => navigate('/p/campus1')}
          />
        )}
        {(currentPath === '/merchant' || currentPath === '/dashboard') && (
          <ProtectedRoute
            allowedRoles={['MERCHANT_OWNER', 'SHOP_MANAGER', 'SHOP_STAFF', 'PLATFORM_OWNER', 'PLATFORM_ADMIN']}
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
                      MFA Privileged Session
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
      </main>

      {/* Global Footer & Floating WhatsApp (Only on public website) */}
      {!isStandaloneApp && <Footer onNavigate={navigate} />}
      {!isStandaloneApp && <FloatingWhatsApp />}
    </div>
  );
};
