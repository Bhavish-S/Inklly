import React, { useState } from 'react';
import { Logo, EyeIcon, EyeOffIcon, LockIcon, UserIcon, PrinterIcon } from '../components/icons';

interface LoginPageProps {
  onNavigate: (path: string) => void;
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate, onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Simulate login or call API
    setTimeout(() => {
      setLoading(false);
      if (onLoginSuccess) {
        onLoginSuccess();
      } else {
        onNavigate('/merchant');
      }
    }, 600);
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
              Merchant Operating Workspace
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed mb-6">
              Access your real-time counter queue, manage connected printers, review daily cash collections, and download customer ledgers.
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white/10 border border-white/10 flex items-center gap-2">
                <span className="text-green-400 font-bold">✓</span> Direct UPI settlements
              </div>
              <div className="p-2.5 rounded-xl bg-white/10 border border-white/10 flex items-center gap-2">
                <span className="text-green-400 font-bold">✓</span> Zero pen-drive viruses
              </div>
              <div className="p-2.5 rounded-xl bg-white/10 border border-white/10 flex items-center gap-2">
                <span className="text-green-400 font-bold">✓</span> Hardware-safe printer spooler
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-8 pt-6 border-t border-white/15">
            <p className="text-xs italic text-gray-300 mb-1">
              "Saved us 2 hours every morning during peak submission rush."
            </p>
            <span className="text-[11px] text-[#A9B6FF] font-semibold block">
              — Rajesh Print Solutions, Pune
            </span>
          </div>
        </div>

        {/* Right Panel: Sign In Form */}
        <div className="md:col-span-7 p-8 md:p-12 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-[#172031] tracking-tight mb-1">
              Sign in to your shop
            </h2>
            <p className="text-xs text-[#5B6475]">
              Enter your registered mobile number or email address to access your merchant console.
            </p>
          </div>

          {error && (
            <div className="p-3 mb-4 rounded-xl bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#172031] mb-1.5">
                Email or 10-digit Mobile
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
                  placeholder="e.g. 9876543210 or shop@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-sm outline-hidden transition-all bg-white"
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
                  placeholder="Enter your account password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-sm outline-hidden transition-all bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-hidden"
                >
                  {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-[#5B6475]">
                <input type="checkbox" defaultChecked className="rounded text-[#4D64E6]" />
                Remember this device
              </label>
              <a
                href="#forgot"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Password reset link sent to registered WhatsApp / Email.');
                }}
                className="text-[#4D64E6] font-semibold hover:underline"
              >
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#4D64E6] hover:bg-[#3F54D1] text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? 'Authenticating...' : 'Sign in to Dashboard →'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#E6E9F2] text-center text-xs text-[#5B6475]">
            Don't have a merchant account?{' '}
            <button
              type="button"
              onClick={() => onNavigate('/register')}
              className="text-[#4D64E6] font-bold hover:underline cursor-pointer"
            >
              Sign up for 7-day free trial
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
