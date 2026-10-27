import React, { useState } from 'react';
import { Logo, EyeIcon, EyeOffIcon, CheckIcon, PrinterIcon } from '../components/icons';
import { api } from '../api/client';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
  onRegisterSuccess?: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate, onRegisterSuccess }) => {
  const [ownerName, setOwnerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [shopCode, setShopCode] = useState('');
  const [isCustomSlug, setIsCustomSlug] = useState(false);
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Pune');
  const [state, setState] = useState('Maharashtra');
  const [pinCode, setPinCode] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBusinessNameChange = (name: string) => {
    setBusinessName(name);
    if (!isCustomSlug) {
      const slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setShopCode(slug);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const cleanSlug = shopCode.toLowerCase().trim() || businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const res = await api.register({
        ownerName,
        businessName,
        shopName: businessName,
        shopCode: cleanSlug,
        email,
        password,
        phone: mobile,
        address: address || 'Main Market Road',
        city: city || 'Pune',
        state: state || 'Maharashtra',
        pinCode: pinCode || '411001',
      });

      if (res.token) {
        localStorage.setItem('inklly_token', res.token);
      }
      if (res.user) {
        localStorage.setItem('inklly_user', JSON.stringify(res.user));
      }
      if (res.shop) {
        localStorage.setItem('inklly_shop', JSON.stringify(res.shop));
      }
      if (res.organization) {
        localStorage.setItem('inklly_organization', JSON.stringify(res.organization));
      }
      if (res.subscription) {
        localStorage.setItem('inklly_subscription', JSON.stringify(res.subscription));
      }

      if (onRegisterSuccess) {
        onRegisterSuccess();
      } else {
        onNavigate('/merchant');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFCFE] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl w-full bg-white border border-[#E6E9F2] rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Column: Benefits & Trust */}
        <div className="lg:col-span-5 bg-[#172031] text-white p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-[#4D64E6]/25 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="mb-6 cursor-pointer" onClick={() => onNavigate('/')}>
              <Logo size={22} variant="white" />
            </div>

            <span className="inline-block px-3 py-1 bg-white/10 text-[#A9B6FF] rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-white/15">
              7-Day Free Trial
            </span>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-4">
              Start automating your print counter today
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-8">
              Join hundreds of print shops across India replacing manual calculations and paper jams with automated QR and WhatsApp printing.
            </p>

            <div className="space-y-3.5 text-xs text-gray-200">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#EAFBF0] text-[#1F8A4C] flex items-center justify-center shrink-0 mt-0.5">
                  <CheckIcon size={12} />
                </div>
                <span><strong>Full 7-day trial:</strong> Growth tier features unlocked with zero credit card required.</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#EAFBF0] text-[#1F8A4C] flex items-center justify-center shrink-0 mt-0.5">
                  <CheckIcon size={12} />
                </div>
                <span><strong>Instant QR Standee PDF:</strong> Download and print your counter acrylic standee right away.</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#EAFBF0] text-[#1F8A4C] flex items-center justify-center shrink-0 mt-0.5">
                  <CheckIcon size={12} />
                </div>
                <span><strong>Connect your printers:</strong> Windows 10/11 agent hooks into USB/LAN printers in 5 mins.</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#EAFBF0] text-[#1F8A4C] flex items-center justify-center shrink-0 mt-0.5">
                  <CheckIcon size={12} />
                </div>
                <span><strong>Payment setup:</strong> Each shop can enter its own Razorpay credentials. Online checkout and payment verification are not active in this preview.</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-10 pt-6 border-t border-white/15 text-xs text-gray-400">
            🔒 Bank-grade encryption • 100% data privacy • No long-term lock-in.
          </div>
        </div>

        {/* Right Column: 6-Field Registration Form */}
        <div className="lg:col-span-7 p-8 md:p-12 flex flex-col justify-center">
          <div className="mb-6">
            <h3 className="text-2xl font-extrabold text-[#172031] tracking-tight mb-1">
              Create your merchant account
            </h3>
            <p className="text-xs text-[#5B6475]">
              Start your 7-day trial. No payment details required.
            </p>
          </div>

          {error && (
            <div role="alert" aria-live="polite" className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
              <span className="font-bold">⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#172031] mb-1.5">
                  Owner / Manager Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Ramesh Patil"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-sm outline-hidden transition-all bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172031] mb-1.5">
                  Business / Shop Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => handleBusinessNameChange(e.target.value)}
                  placeholder="e.g. Metro Xerox & Digital Prints"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-sm outline-hidden transition-all bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#172031] mb-1.5">
                Counter QR Portal URL Slug <span className="text-red-500">*</span>
              </label>
              <div className="flex rounded-xl shadow-xs overflow-hidden border border-[#E6E9F2] focus-within:border-[#4D64E6] focus-within:ring-2 focus-within:ring-[#4D64E6]/20">
                <span className="inline-flex items-center px-3 bg-slate-100 text-slate-500 text-xs font-medium border-r border-[#E6E9F2]">
                  inklly.vercel.app/p/
                </span>
                <input
                  type="text"
                  required
                  value={shopCode}
                  onChange={(e) => {
                    setIsCustomSlug(true);
                    setShopCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                  }}
                  placeholder="metro-prints"
                  className="flex-1 px-3 py-2 text-xs font-mono font-semibold text-slate-800 outline-hidden bg-white"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">This will be printed on your counter standee QR code for customers to scan.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#172031] mb-1.5">
                  Shop Address / Landmark
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Shop 4, FC Road Complex"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-sm outline-hidden transition-all bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172031] mb-1.5">
                  City & State
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] text-xs outline-hidden bg-white"
                  />
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] text-xs outline-hidden bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#172031] mb-1.5">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    pattern="[0-9]{10}"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98765 43210"
                    className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-sm outline-hidden transition-all bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172031] mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ramesh@campusprint.in"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-sm outline-hidden transition-all bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#172031] mb-1.5">
                  Create Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={12}
                    maxLength={1024}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 12 characters"
                    className="w-full min-h-[44px] pr-12 pl-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-sm outline-hidden transition-all bg-white"
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

              <div>
                <label className="block text-xs font-bold text-[#172031] mb-1.5">
                  Referral Code <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="e.g. PUNE2026"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] text-sm outline-hidden transition-all bg-white uppercase font-mono"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#5B6475]">
                <input
                  type="checkbox"
                  checked={whatsappOptIn}
                  onChange={(e) => setWhatsappOptIn(e.target.checked)}
                  className="rounded text-[#4D64E6] mt-0.5"
                />
                <span>
                  Receive setup instructions, printer connection guide, and daily order alerts via WhatsApp.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#4D64E6] hover:bg-[#3F54D1] text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {loading ? 'Creating Account...' : 'Create Free Account & Start Trial →'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#E6E9F2] text-center text-xs text-[#5B6475]">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="text-[#4D64E6] font-bold hover:underline cursor-pointer"
            >
              Sign in to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
