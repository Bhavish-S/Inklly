import React, { useState } from 'react';
import { Logo, EyeIcon, EyeOffIcon, LockIcon, UserIcon, PrinterIcon, ShieldIcon, CodeIcon } from '../components/icons';
import { api } from '../api/client';

interface LoginPageProps {
  onNavigate: (path: string) => void;
  onLoginSuccess?: () => void;
  initialRole?: 'merchant' | 'owner' | 'developer';
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate, onLoginSuccess, initialRole = 'merchant' }) => {
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const urlEmail = searchParams.get('email') || '';
  const urlRole = searchParams.get('role');

  const [selectedRole, setSelectedRole] = useState<'merchant' | 'owner' | 'developer'>(
    urlRole === 'owner' ? 'owner' : urlRole === 'developer' ? 'developer' : initialRole
  );
  const [identifier, setIdentifier] = useState(urlEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fillCredentials = (role: 'merchant' | 'owner' | 'developer', userEmail: string, pass: string) => {
    setSelectedRole(role);
    setIdentifier(userEmail);
    setPassword(pass);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.login(identifier, password);

      const expectedRoles = selectedRole === 'owner'
        ? ['PLATFORM_OWNER', 'PLATFORM_ADMIN']
        : selectedRole === 'developer'
          ? ['DEVELOPER', 'PLATFORM_OWNER', 'PLATFORM_ADMIN']
          : ['MERCHANT_OWNER', 'SHOP_MANAGER', 'SHOP_STAFF'];
      if (!res.user || !expectedRoles.includes(res.user.role)) {
        throw new Error(`This account cannot sign in to the ${selectedRole === 'owner' ? 'platform admin' : selectedRole} workspace.`);
      }

      if (res.token) {
        localStorage.setItem('inklly_token', res.token);
      }
      if (res.user) {
        localStorage.setItem('inklly_user', JSON.stringify(res.user));
      }
      if (res.shop) {
        localStorage.setItem('inklly_shop', JSON.stringify(res.shop));
      }

      if (selectedRole === 'owner') {
        onNavigate('/platform');
      } else if (selectedRole === 'developer') {
        onNavigate('/developer');
      } else {
        if (onLoginSuccess) {
          onLoginSuccess();
        } else {
          onNavigate('/merchant');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-ink-app dark:bg-ink-dark-app flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 motion-safe:transition-colors motion-safe:duration-200">
      <div className="max-w-4xl w-full bg-ink-surface dark:bg-ink-dark-surface border border-ink-border dark:border-ink-dark-border rounded-2xl shadow-lg overflow-hidden grid grid-cols-1 md:grid-cols-12">
        {/* Left Panel: Brand & Testimonial Graphic */}
        <div className="md:col-span-5 bg-[#172033] dark:bg-[#0D1422] text-white p-8 md:p-10 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-brand/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="mb-6 cursor-pointer" onClick={() => onNavigate('/')}>
              <Logo size={22} variant="white" />
            </div>

            <h3 className="text-xl font-bold tracking-tight mb-3">
              {selectedRole === 'owner' ? 'Platform Owner Console' : selectedRole === 'developer' ? 'Developer API Portal' : 'Merchant POS Workspace'}
            </h3>
            <p className="text-xs text-gray-300/90 leading-relaxed mb-6">
              {selectedRole === 'owner'
                ? 'High-privilege console to audit active Indian print shops, GMV, fee collection, and hardware telemetry.'
                : selectedRole === 'developer'
                ? 'Create API credentials, test OpenAPI endpoints, and simulate webhook callbacks.'
                : 'Review the shop order queue, connect a paired desktop agent, and manage QR ordering and shop payment settings.'}
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white/[0.07] border border-white/[0.08] flex items-center gap-2.5">
                <span className="text-status-success font-bold flex-shrink-0">✓</span>
                <span className="text-gray-200/90">Paired agent dispatch with audited output review</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.07] border border-white/[0.08] flex items-center gap-2.5">
                <span className="text-status-success font-bold flex-shrink-0">✓</span>
                <span className="text-gray-200/90">Shop Razorpay checkout and ledger-backed cash collection</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.07] border border-white/[0.08] flex items-center gap-2.5">
                <span className="text-status-success font-bold flex-shrink-0">✓</span>
                <span className="text-gray-200/90">Multi-Tenant Isolation</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-8 pt-6 border-t border-white/10">
            <p className="text-xs italic text-gray-300/80 mb-1.5 leading-relaxed">
              "Replaced pen drives and messy WhatsApp queues across our shop in 10 minutes."
            </p>
            <span className="text-[11px] text-brand-soft/70 font-semibold block">
              — Metro Xerox & Digital Prints, Pune
            </span>
          </div>
        </div>

        {/* Right Panel: Sign In Form */}
        <div className="md:col-span-7 p-8 md:p-12 flex flex-col justify-center">
          {/* Role Switcher Tabs */}
          <div className="flex bg-ink-muted dark:bg-ink-dark-elevated p-1 rounded-2xl mb-6" role="tablist" aria-label="Select login role">
            <button
              type="button"
              role="tab"
              aria-selected={selectedRole === 'merchant'}
              onClick={() => setSelectedRole('merchant')}
              className={`flex-1 min-h-[44px] py-2 text-xs font-semibold rounded-xl motion-safe:transition-all motion-safe:duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedRole === 'merchant'
                  ? 'bg-ink-surface dark:bg-ink-dark-surface text-ink-text dark:text-ink-dark-text shadow-xs'
                  : 'text-ink-text-secondary dark:text-ink-dark-text-secondary hover:text-ink-text dark:hover:text-ink-dark-text'
              }`}
            >
              <PrinterIcon size={14} />
              <span>Merchant</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedRole === 'owner'}
              onClick={() => setSelectedRole('owner')}
              className={`flex-1 min-h-[44px] py-2 text-xs font-semibold rounded-xl motion-safe:transition-all motion-safe:duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedRole === 'owner'
                  ? 'bg-ink-surface dark:bg-ink-dark-surface text-ink-text dark:text-ink-dark-text shadow-xs'
                  : 'text-ink-text-secondary dark:text-ink-dark-text-secondary hover:text-ink-text dark:hover:text-ink-dark-text'
              }`}
            >
              <ShieldIcon size={14} />
              <span>Platform Owner</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedRole === 'developer'}
              onClick={() => setSelectedRole('developer')}
              className={`flex-1 min-h-[44px] py-2 text-xs font-semibold rounded-xl motion-safe:transition-all motion-safe:duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedRole === 'developer'
                  ? 'bg-ink-surface dark:bg-ink-dark-surface text-ink-text dark:text-ink-dark-text shadow-xs'
                  : 'text-ink-text-secondary dark:text-ink-dark-text-secondary hover:text-ink-text dark:hover:text-ink-dark-text'
              }`}
            >
              <CodeIcon size={14} />
              <span>Developer</span>
            </button>
          </div>

          <div className="mb-5">
            <h2 className="text-2xl font-bold text-ink-text dark:text-ink-dark-text tracking-tight mb-1">
              {selectedRole === 'owner' ? 'Sign in as Platform Admin' : selectedRole === 'developer' ? 'Sign in to Developer Hub' : 'Sign in to your shop'}
            </h2>
            <p className="text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary">
              Enter the email address on your Inklly account.
            </p>
          </div>

          {error && (
            <div role="alert" aria-live="polite" className="p-3 mb-4 rounded-[10px] bg-status-danger-bg dark:bg-status-danger/10 text-status-danger text-xs font-medium border border-status-danger/20 flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Quick Demo Credentials Assistant */}
          <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">
                ⚡ 1-Click Demo Credentials
              </span>
              <span className="text-[10px] text-slate-500">Click to autofill</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => fillCredentials('merchant', 'owner@campusprint.in', 'DemoOwnerPassword123!')}
                className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:border-brand font-medium text-[11px] text-center transition-all cursor-pointer shadow-2xs"
              >
                🏪 Merchant
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('owner', 'admin@inklly.com', 'InkllyAdmin2026!PlatformOwner')}
                className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:border-brand font-medium text-[11px] text-center transition-all cursor-pointer shadow-2xs"
              >
                🛡️ Admin
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('developer', 'dev@inklly.com', 'DemoDeveloperPassword123!')}
                className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:border-brand font-medium text-[11px] text-center transition-all cursor-pointer shadow-2xs"
              >
                💻 Dev API
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-text dark:text-ink-dark-text mb-1.5">
                Email address
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-text-muted dark:text-ink-dark-text-muted">
                  <UserIcon size={16} />
                </span>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={selectedRole === 'owner' ? 'admin@example.com' : selectedRole === 'developer' ? 'developer@example.com' : 'you@yourprintshop.in'}
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded-[10px] border border-ink-border dark:border-ink-dark-border focus:border-brand focus:ring-2 focus:ring-brand/20 text-sm text-ink-text dark:text-ink-dark-text placeholder:text-ink-text-muted dark:placeholder:text-ink-dark-text-muted outline-hidden motion-safe:transition-all motion-safe:duration-150 bg-ink-surface dark:bg-ink-dark-elevated"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-text dark:text-ink-dark-text mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-text-muted dark:text-ink-dark-text-muted">
                  <LockIcon size={16} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter account password"
                  className="w-full min-h-[44px] pl-10 pr-12 py-2.5 rounded-[10px] border border-ink-border dark:border-ink-dark-border focus:border-brand focus:ring-2 focus:ring-brand/20 text-sm text-ink-text dark:text-ink-dark-text placeholder:text-ink-text-muted dark:placeholder:text-ink-dark-text-muted outline-hidden motion-safe:transition-all motion-safe:duration-150 bg-ink-surface dark:bg-ink-dark-elevated"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-text-muted dark:text-ink-dark-text-muted hover:text-ink-text-secondary dark:hover:text-ink-dark-text-secondary focus:outline-hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg motion-safe:transition-colors motion-safe:duration-150"
                >
                  {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] py-3 bg-brand hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-[10px] font-semibold text-sm shadow-brand motion-safe:transition-all motion-safe:duration-200 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4 text-white/80" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {loading ? 'Authenticating...' : `Sign in to ${selectedRole === 'owner' ? 'Platform Console' : selectedRole === 'developer' ? 'Developer Hub' : 'Merchant Dashboard'} →`}
            </button>
          </form>


          <div className="mt-6 pt-5 border-t border-ink-border dark:border-ink-dark-border text-center text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary">
            Want to register a new print shop?{' '}
            <button
              type="button"
              onClick={() => onNavigate('/register')}
              className="text-brand hover:text-brand-hover dark:text-[#8293FF] dark:hover:text-brand font-semibold hover:underline cursor-pointer motion-safe:transition-colors motion-safe:duration-150"
            >
              Sign up for free
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
