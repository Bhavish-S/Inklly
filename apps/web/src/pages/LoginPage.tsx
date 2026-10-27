import React, { useState } from 'react';
import { Logo, EyeIcon, EyeOffIcon, LockIcon, UserIcon, PrinterIcon, ShieldIcon, CodeIcon } from '../components/icons';
import { api } from '../api/client';

interface LoginPageProps {
  onNavigate: (path: string) => void;
  onLoginSuccess?: () => void;
  initialRole?: 'merchant' | 'owner' | 'developer';
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate, onLoginSuccess, initialRole = 'merchant' }) => {
  const [selectedRole, setSelectedRole] = useState<'merchant' | 'owner' | 'developer'>(initialRole);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-[#FBFCFE] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full bg-white border border-[#E6E9F2] rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
        {/* Left Panel: Brand & Testimonial Graphic */}
        <div className="md:col-span-5 bg-[#172031] text-white p-8 md:p-10 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-[#4D64E6]/25 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="mb-6 cursor-pointer" onClick={() => onNavigate('/')}>
              <Logo size={22} variant="white" />
            </div>

            <h3 className="text-xl font-extrabold tracking-tight mb-3">
              {selectedRole === 'owner' ? 'Platform Owner Console' : selectedRole === 'developer' ? 'Developer API Portal' : 'Merchant POS Workspace'}
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed mb-6">
              {selectedRole === 'owner'
                ? 'High-privilege console to audit active Indian print shops, GMV, fee collection, and hardware telemetry.'
                : selectedRole === 'developer'
                ? 'Create API credentials, test OpenAPI endpoints, and simulate webhook callbacks.'
                : 'Access your counter queue, manage connected Canon/HP printers, review daily cash, and print QR standees.'}
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white/10 border border-white/10 flex items-center gap-2">
                <span className="text-green-400 font-bold">✓</span> Real-time Counter Print Spooler
              </div>
              <div className="p-2.5 rounded-xl bg-white/10 border border-white/10 flex items-center gap-2">
                <span className="text-green-400 font-bold">✓</span> Direct UPI & Cash Reconciliation
              </div>
              <div className="p-2.5 rounded-xl bg-white/10 border border-white/10 flex items-center gap-2">
                <span className="text-green-400 font-bold">✓</span> Multi-Tenant Isolation
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-8 pt-6 border-t border-white/15">
            <p className="text-xs italic text-gray-300 mb-1">
              "Replaced pen drives and messy WhatsApp queues across our shop in 10 minutes."
            </p>
            <span className="text-[11px] text-[#A9B6FF] font-semibold block">
              — Metro Xerox & Digital Prints, Pune
            </span>
          </div>
        </div>

        {/* Right Panel: Sign In Form */}
        <div className="md:col-span-7 p-8 md:p-12 flex flex-col justify-center">
          {/* Role Switcher Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-2xl mb-6" role="tablist" aria-label="Select login role">
            <button
              type="button"
              role="tab"
              aria-selected={selectedRole === 'merchant'}
              onClick={() => setSelectedRole('merchant')}
              className={`flex-1 min-h-[44px] py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedRole === 'merchant' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
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
              className={`flex-1 min-h-[44px] py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedRole === 'owner' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
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
              className={`flex-1 min-h-[44px] py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedRole === 'developer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CodeIcon size={14} />
              <span>Developer</span>
            </button>
          </div>

          <div className="mb-4">
            <h2 className="text-2xl font-extrabold text-[#172031] tracking-tight mb-1">
              {selectedRole === 'owner' ? 'Sign in as Platform Admin' : selectedRole === 'developer' ? 'Sign in to Developer Hub' : 'Sign in to your shop'}
            </h2>
            <p className="text-xs text-[#475467]">
              Enter the email address on your Inklly account.
            </p>
          </div>

          {error && (
            <div role="alert" aria-live="polite" className="p-3 mb-4 rounded-xl bg-red-50 text-red-700 text-xs font-semibold border border-red-200 flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#172031] mb-1.5">
                Email address
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <UserIcon size={16} />
                </span>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={selectedRole === 'owner' ? 'admin@example.com' : selectedRole === 'developer' ? 'developer@example.com' : 'you@yourprintshop.in'}
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-sm outline-hidden transition-all bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#172031] mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <LockIcon size={16} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter account password"
                  className="w-full min-h-[44px] pl-10 pr-12 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-sm outline-hidden transition-all bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg"
                >
                  {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] py-3 bg-[#4D64E6] hover:bg-[#3B50D4] text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? 'Authenticating...' : `Sign in to ${selectedRole === 'owner' ? 'Platform Console' : selectedRole === 'developer' ? 'Developer Hub' : 'Merchant Dashboard'} →`}
            </button>
          </form>


          <div className="mt-6 pt-4 border-t border-[#E6E9F2] text-center text-xs text-[#5B6475]">
            Want to register a new print shop?{' '}
            <button
              type="button"
              onClick={() => onNavigate('/register')}
              className="text-[#4D64E6] font-bold hover:underline cursor-pointer"
            >
              Sign up for free
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
