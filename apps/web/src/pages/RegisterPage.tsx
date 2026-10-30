import React, { useState, useEffect } from 'react';
import { Logo, EyeIcon, EyeOffIcon, CheckIcon, ShieldIcon } from '../components/icons';
import { api } from '../api/client';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
  onRegisterSuccess?: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: any) => any;
  }
}

function loadRazorpayCheckout(): Promise<void> {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Razorpay Checkout could not be loaded.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay Checkout could not be loaded.'));
    document.head.appendChild(script);
  });
}

interface PlanInfo {
  id: string;
  name: string;
  tier: 'STARTER' | 'GROWTH' | 'PRO' | 'SCALE';
  monthlyPrice: number;
  annualPrice: number;
  orderLimit: number;
  printers: number;
  tagline: string;
  features: string[];
  popular?: boolean;
}

const PLANS: Record<string, PlanInfo> = {
  'plan-starter': {
    id: 'plan-starter',
    name: 'Starter',
    tier: 'STARTER',
    monthlyPrice: 99,
    annualPrice: 999,
    orderLimit: 300,
    printers: 1,
    tagline: 'QR and WhatsApp portal for a small single-printer shop',
    features: ['300 orders/month', '1 printer', 'Manual print release'],
  },
  'plan-growth': {
    id: 'plan-growth',
    name: 'Growth',
    tier: 'GROWTH',
    monthlyPrice: 199,
    annualPrice: 1999,
    orderLimit: 1500,
    printers: 2,
    tagline: 'Payment-triggered automation for growing shops',
    features: ['1,500 orders/month', '2 printers', 'Payment-received auto print', '7-day trial available'],
    popular: true,
  },
  'plan-pro': {
    id: 'plan-pro',
    name: 'Pro',
    tier: 'PRO',
    monthlyPrice: 499,
    annualPrice: 4999,
    orderLimit: 6000,
    printers: 5,
    tagline: 'Full automatic printing with multiple printers and staff',
    features: ['6,000 orders/month', '5 printers', 'All-document auto print'],
  },
  'plan-scale': {
    id: 'plan-scale',
    name: 'Scale',
    tier: 'SCALE',
    monthlyPrice: 899,
    annualPrice: 8999,
    orderLimit: 50000,
    printers: 10,
    tagline: 'High-volume automation for busy shops and branches',
    features: ['50,000 orders/month', '10 printers', 'All-document auto print'],
  },
  'plan-lifetime': {
    id: 'plan-lifetime',
    name: 'Lifetime',
    tier: 'SCALE',
    monthlyPrice: 1499,
    annualPrice: 1499,
    orderLimit: 100000,
    printers: 100,
    tagline: 'One payment. Permanent access to every Inklly feature.',
    features: ['Unlimited orders/month', 'Unlimited printers', 'All-document auto print', 'Permanent lifetime access'],
  },
};

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate, onRegisterSuccess }) => {
  // Read plan & cycle from URL if present
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const urlPlan = searchParams.get('plan') || 'plan-growth';
  const urlCycle = searchParams.get('cycle');

  const initialPlanId = PLANS[urlPlan] ? urlPlan : 'plan-growth';
  const initialCycle: 'monthly' | 'yearly' | 'lifetime' =
    initialPlanId === 'plan-lifetime' || urlCycle === 'lifetime'
      ? 'lifetime'
      : urlCycle === 'yearly'
      ? 'yearly'
      : 'monthly';

  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialPlanId);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly' | 'lifetime'>(initialCycle);

  // Form Fields
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

  // Status & payment states
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Success view state with credentials
  const [registeredSuccess, setRegisteredSuccess] = useState<{
    email: string;
    planName: string;
    billingCycle: string;
    shopCode: string;
    paymentId?: string;
  } | null>(null);

  const isLifetime = selectedPlanId === 'plan-lifetime' || billingCycle === 'lifetime';
  const selectedPlan = PLANS[selectedPlanId] || PLANS['plan-growth'];
  const priceInr = isLifetime
    ? 1499
    : billingCycle === 'yearly'
    ? selectedPlan.annualPrice
    : selectedPlan.monthlyPrice;

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

  const validateForm = (): boolean => {
    if (!ownerName.trim()) {
      setError('Please enter the owner / manager name.');
      return false;
    }
    if (!businessName.trim()) {
      setError('Please enter your business or shop name.');
      return false;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address for your login credentials.');
      return false;
    }
    if (!password || password.length < 12) {
      setError('Password must be at least 12 characters long.');
      return false;
    }
    if (!mobile || mobile.replace(/\D/g, '').length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return false;
    }
    setError(null);
    return true;
  };

  const executeRegistration = async (paymentDetails?: {
    provider: 'RAZORPAY' | 'SANDBOX_TEST_KIT';
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    testSimulated?: boolean;
  }) => {
    setLoading(true);
    setStatusMessage(paymentDetails ? 'Verifying payment and provisioning credentials…' : 'Creating your account…');

    try {
      const cleanSlug = shopCode.toLowerCase().trim() || businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const res = await api.register({
        ownerName: ownerName.trim(),
        businessName: businessName.trim(),
        shopName: businessName.trim(),
        shopCode: cleanSlug,
        email: email.toLowerCase().trim(),
        password,
        phone: mobile.replace(/\D/g, ''),
        address: address.trim() || 'Main Market Road',
        city: city.trim() || 'Pune',
        state: state.trim() || 'Maharashtra',
        pinCode: pinCode.trim() || '411001',
        planId: selectedPlan.id,
        billingCycle: isLifetime ? 'lifetime' : billingCycle,
        paymentDetails,
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

      setRegisteredSuccess({
        email: email.toLowerCase().trim(),
        planName: isLifetime ? 'Lifetime Deal' : selectedPlan.name,
        billingCycle: isLifetime ? 'One-time Payment' : billingCycle === 'yearly' ? 'Yearly' : 'Monthly',
        shopCode: cleanSlug,
        paymentId: paymentDetails?.razorpay_payment_id || (paymentDetails ? 'Verified Payment' : 'Free Trial Activated'),
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please review your details and try again.');
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  // Pay via Razorpay Checkout
  const handlePayViaRazorpay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setStatusMessage('Preparing Razorpay sandbox checkout…');

    try {
      await loadRazorpayCheckout();

      const checkout = await api.createSignupCheckout({
        planId: selectedPlan.id,
        billingCycle: isLifetime ? 'lifetime' : billingCycle,
        email: email.trim(),
      });

      // If window.Razorpay is available, launch the official checkout
      if (window.Razorpay) {
        const options = {
          key: checkout.keyId,
          amount: checkout.amount,
          currency: checkout.currency,
          name: 'Inklly Cloud Print',
          description: isLifetime
            ? 'Inklly Lifetime License (Permanent Access)'
            : `${checkout.plan.name} (${billingCycle})`,
          order_id: checkout.razorpayOrderId,
          prefill: {
            name: ownerName,
            email: email.trim(),
            contact: mobile ? `+91${mobile}` : undefined,
          },
          theme: {
            color: '#4D64E6',
          },
          handler: async (response: any) => {
            await executeRegistration({
              provider: 'RAZORPAY',
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
          },
          modal: {
            ondismiss: () => {
              setLoading(false);
              setStatusMessage(null);
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (resp: any) => {
          setError(resp.error?.description || 'Payment was cancelled or unsuccessful in Razorpay.');
          setLoading(false);
          setStatusMessage(null);
        });
        rzp.open();
      } else {
        // Fallback to simulated test payment if Razorpay script is blocked
        await executeRegistration({
          provider: 'SANDBOX_TEST_KIT',
          razorpay_order_id: checkout.razorpayOrderId,
          razorpay_payment_id: `pay_test_${Date.now().toString(36)}`,
          testSimulated: true,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Could not initiate Razorpay payment. You can try the 1-Click Sandbox Test Payment.');
      setLoading(false);
      setStatusMessage(null);
    }
  };

  // 1-Click Sandbox Test Payment
  const handleSimulateSandboxPayment = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setStatusMessage('Simulating Razorpay Sandbox payment & activating account…');

    try {
      const checkout = await api.createSignupCheckout({
        planId: selectedPlan.id,
        billingCycle: isLifetime ? 'lifetime' : billingCycle,
        email: email.trim(),
      });

      await executeRegistration({
        provider: 'SANDBOX_TEST_KIT',
        razorpay_order_id: checkout.razorpayOrderId,
        razorpay_payment_id: `pay_test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        testSimulated: true,
      });
    } catch (err: any) {
      setError(err.message || 'Sandbox simulation failed.');
      setLoading(false);
      setStatusMessage(null);
    }
  };

  // 7-Day Trial Option
  const handleStartFreeTrial = async () => {
    if (!validateForm()) return;
    await executeRegistration(undefined);
  };

  // SUCCESS VIEW: Shows Credentials & Dashboard CTA
  if (registeredSuccess) {
    return (
      <div className="min-h-screen bg-[#FBFCFE] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl w-full bg-white border border-[#E6E9F2] rounded-3xl shadow-2xl p-8 sm:p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-[#EAFBF0] text-[#1F8A4C] flex items-center justify-center mx-auto mb-6 text-2xl font-bold shadow-sm">
            ✓
          </div>

          <span className="inline-block px-3 py-1 bg-[#EAFBF0] text-[#1F8A4C] rounded-full text-xs font-bold uppercase tracking-wider mb-3">
            Account Activated
          </span>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172031] tracking-tight mb-2">
            Welcome to Inklly, {ownerName || 'Merchant'}!
          </h2>
          <p className="text-sm text-[#5B6475] mb-8">
            Your subscription to <strong className="text-[#172031]">{registeredSuccess.planName} ({registeredSuccess.billingCycle})</strong> is active.
          </p>

          {/* Credentials Display Card */}
          <div className="bg-[#F8F9FD] border border-[#E6E9F2] rounded-2xl p-6 text-left mb-8 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E6E9F2]">
              <ShieldIcon size={18} className="text-[#4D64E6]" />
              <h3 className="text-sm font-extrabold text-[#172031]">Your Login Credentials & Shop Access</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[#5B6475] block font-medium">Login Email:</span>
                <span className="font-mono font-bold text-sm text-[#172031] bg-white px-2.5 py-1.5 rounded-lg border border-[#E6E9F2] block mt-1">
                  {registeredSuccess.email}
                </span>
              </div>

              <div>
                <span className="text-[#5B6475] block font-medium">Password:</span>
                <span className="font-mono font-bold text-sm text-[#172031] bg-white px-2.5 py-1.5 rounded-lg border border-[#E6E9F2] block mt-1">
                  •••••••••••• (Saved)
                </span>
              </div>
            </div>

            <div className="pt-2 text-xs">
              <span className="text-[#5B6475] block font-medium">Your Public Customer QR Portal:</span>
              <a
                href={`/p/${registeredSuccess.shopCode}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono font-bold text-sm text-[#4D64E6] hover:underline block mt-1"
              >
                inklly.vercel.app/p/{registeredSuccess.shopCode}
              </a>
            </div>

            <div className="text-[11px] text-slate-500 pt-1">
              Payment Reference: <code className="font-mono text-slate-700">{registeredSuccess.paymentId}</code>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                if (onRegisterSuccess) onRegisterSuccess();
                else onNavigate('/merchant');
              }}
              className="w-full py-4 bg-[#4D64E6] hover:bg-[#3F54D1] text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Launch Merchant POS Dashboard →</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFCFE] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl w-full bg-white border border-[#E6E9F2] rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Column: Plan Summary & Razorpay Test Kit */}
        <div className="lg:col-span-5 bg-[#172031] text-white p-8 md:p-10 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-[#4D64E6]/25 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="mb-6 cursor-pointer flex items-center justify-between" onClick={() => onNavigate('/pricing')}>
              <Logo size={22} variant="white" />
              <span className="text-xs text-indigo-300 hover:underline">← Change Plan</span>
            </div>

            {/* Plan Switcher Pills */}
            <div className="mb-6">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Selected Subscription Plan
              </label>
              <div className="space-y-1.5 p-1.5 bg-white/10 rounded-xl border border-white/15">
                {/* 4 Standard Plans */}
                <div className="grid grid-cols-2 gap-1.5">
                  {['plan-starter', 'plan-growth', 'plan-pro', 'plan-scale'].map((id) => {
                    const p = PLANS[id];
                    const isSelected = selectedPlanId === id && !isLifetime;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPlanId(p.id);
                          if (billingCycle === 'lifetime') setBillingCycle('monthly');
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                          isSelected
                            ? 'bg-[#4D64E6] text-white shadow-xs'
                            : 'text-gray-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>

                {/* Lifetime Deal Banner Pill */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlanId('plan-lifetime');
                    setBillingCycle('lifetime');
                  }}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between cursor-pointer border ${
                    isLifetime
                      ? 'bg-[#4D64E6] border-[#4D64E6] text-white shadow-xs ring-1 ring-white/30'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span>⚡ Lifetime Plan</span>
                    <span className="text-[10px] text-indigo-200 font-normal hidden sm:inline">• Permanent access</span>
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white uppercase tracking-wider shadow-xs">
                    90% OFF • ₹1,499
                  </span>
                </button>
              </div>
            </div>

            {/* Plan Details Card */}
            <div className="bg-white/5 border border-white/15 rounded-2xl p-5 mb-6 relative">
              {isLifetime ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#A9B6FF]">
                      Lifetime
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
                      90% OFF
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    One payment. Permanent access to every Inklly feature.
                  </p>

                  {/* Strikethrough & Big Price */}
                  <div className="text-slate-400 font-bold text-xs line-through mb-0.5">
                    ₹14,999
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-1.5">
                    <span className="text-3xl font-extrabold text-white">
                      ₹1,499
                    </span>
                    <span className="text-xs text-slate-300 font-medium">
                      one time
                    </span>
                  </div>

                  {/* Discount callout */}
                  <div className="text-xs font-bold text-emerald-400 mb-4 flex items-center gap-1">
                    <span>✓</span>
                    <span>You save ₹13,500 • 90% discount</span>
                  </div>

                  {/* Lifetime Info Box replacing Monthly/Yearly Toggle */}
                  <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-[11px] font-medium text-indigo-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Permanent access • No monthly or yearly renewal charges</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#A9B6FF]">
                      {selectedPlan.name}
                    </span>
                    {selectedPlan.popular && (
                      <span className="px-2 py-0.5 rounded-full bg-[#4D64E6] text-white text-[10px] font-extrabold uppercase">
                        Popular
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    {selectedPlan.tagline}
                  </p>

                  {/* Price & Billing Cycle Toggle */}
                  <div className="flex items-baseline gap-1.5 my-2">
                    <span className="text-3xl font-extrabold text-white">
                      ₹{priceInr.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-gray-300">
                      {billingCycle === 'yearly' ? '/year' : '/month'}
                    </span>
                  </div>

                  {/* Billing Cycle Picker */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10 text-xs">
                    <button
                      type="button"
                      onClick={() => setBillingCycle('monthly')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                        billingCycle === 'monthly' ? 'bg-white text-[#172031]' : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle('yearly')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        billingCycle === 'yearly' ? 'bg-white text-[#172031]' : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      <span>Yearly</span>
                      <span className="text-[9px] px-1 py-0.2 bg-[#1F8A4C] text-white rounded">Save 17%</span>
                    </button>
                  </div>
                </>
              )}

              {/* Feature Inclusions */}
              <div className="space-y-2 mt-4 pt-3 border-t border-white/10 text-xs text-gray-200">
                {selectedPlan.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckIcon size={13} className="text-[#1F8A4C] shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Razorpay Sandbox / Test Kit Guide Box */}
            <div className="bg-amber-400/10 border border-amber-300/20 rounded-2xl p-4 text-xs">
              <div className="flex items-center gap-2 text-amber-300 font-bold mb-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Razorpay Sandbox Test Kit</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed mb-2">
                Test mode is enabled for development and sandbox validation. You can use standard Razorpay test credentials or click 1-click test payment.
              </p>
              <div className="bg-slate-900/60 rounded-xl p-2.5 font-mono text-[10px] text-slate-300 space-y-1 border border-white/10">
                <div><span className="text-slate-400">Test Card:</span> 4111 1111 1111 1111</div>
                <div><span className="text-slate-400">Expiry/CVV:</span> Any Future / 123</div>
                <div><span className="text-slate-400">Test UPI:</span> success@razorpay</div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-6 pt-4 border-t border-white/15 text-[11px] text-gray-400">
            Secure checkout powered by Razorpay. Zero transaction commission on customer prints.
          </div>
        </div>

        {/* Right Column: User Details, Credential Setup & Payment */}
        <div className="lg:col-span-7 p-8 md:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4D64E6]">
              Step 1 of 1: Account & Credentials Setup
            </span>
            <h3 className="text-2xl font-extrabold text-[#172031] tracking-tight mt-1">
              Create credentials & activate plan
            </h3>
            <p className="text-xs text-[#5B6475] mt-1">
              Set your login email and password below. You will use these credentials to access your merchant dashboard immediately after payment.
            </p>
          </div>

          {error && (
            <div role="alert" aria-live="polite" className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
              <span className="font-bold">⚠️</span> {error}
            </div>
          )}

          {statusMessage && (
            <div role="status" aria-live="polite" className="mb-4 p-3.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-xl flex items-center gap-2">
              <span className="animate-spin">⏳</span> {statusMessage}
            </div>
          )}

          <form onSubmit={handlePayViaRazorpay} className="space-y-4">
            {/* Credentials Section Banner */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-bold text-[#172031] mb-2 flex items-center gap-1.5">
                <ShieldIcon size={14} className="text-[#4D64E6]" />
                <span>Your Sign-In Credentials</span>
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#172031] mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ramesh@campusprint.in"
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-xs outline-hidden transition-all bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Used to log in to your dashboard</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#172031] mb-1">
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
                      className="w-full min-h-[38px] pr-9 pl-3 py-2 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-xs outline-hidden transition-all bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-hidden min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg cursor-pointer"
                    >
                      {showPassword ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Must be at least 12 characters</p>
                </div>
              </div>
            </div>

            {/* Profile & Shop Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#172031] mb-1">
                  Owner / Manager Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Ramesh Patil"
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-xs outline-hidden transition-all bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172031] mb-1">
                  Business / Shop Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => handleBusinessNameChange(e.target.value)}
                  placeholder="e.g. Metro Xerox & Digital Prints"
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-xs outline-hidden transition-all bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#172031] mb-1">
                Counter QR Portal URL Slug <span className="text-red-500">*</span>
              </label>
              <div className="flex rounded-xl shadow-2xs overflow-hidden border border-[#E6E9F2] focus-within:border-[#4D64E6] focus-within:ring-2 focus-within:ring-[#4D64E6]/20">
                <span className="inline-flex items-center px-2.5 bg-slate-100 text-slate-500 text-xs font-medium border-r border-[#E6E9F2]">
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
              <p className="text-[11px] text-slate-400 mt-1">Customers scan this QR code at your counter to upload and order prints.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#172031] mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    pattern="[0-9]{10}"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98765 43210"
                    className="w-full pl-11 pr-3 py-2 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-xs outline-hidden transition-all bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172031] mb-1">
                  Shop Address / Landmark
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Shop 4, FC Road Complex"
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-xs outline-hidden transition-all bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-[#172031] mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] text-xs outline-hidden bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#172031] mb-1">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] text-xs outline-hidden bg-white"
                />
              </div>
            </div>

            <div className="pt-1">
              <label className="flex items-start gap-2 cursor-pointer text-xs text-[#5B6475]">
                <input
                  type="checkbox"
                  checked={whatsappOptIn}
                  onChange={(e) => setWhatsappOptIn(e.target.checked)}
                  className="rounded text-[#4D64E6] mt-0.5"
                />
                <span>
                  Receive counter setup alerts, daily order summaries, and printer pairing instructions via WhatsApp.
                </span>
              </label>
            </div>

            {/* Action Buttons: Razorpay Checkout & Sandbox Test Kit */}
            <div className="pt-2 space-y-2.5">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#4D64E6] hover:bg-[#3F54D1] text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>
                  {isLifetime
                    ? 'Pay ₹1,499 via Razorpay & Activate Lifetime Access →'
                    : `Pay ₹${priceInr.toLocaleString('en-IN')} via Razorpay & Activate Account →`}
                </span>
              </button>

              <div className={`flex flex-col ${isLifetime ? '' : 'sm:flex-row'} gap-2`}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSimulateSandboxPayment}
                  className="flex-1 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                  title="Simulates an instant verified Razorpay Sandbox payment for automated testing"
                >
                  <span>⚡ 1-Click Sandbox Test Payment ({isLifetime ? '₹1,499 Lifetime' : `₹${priceInr.toLocaleString('en-IN')}`})</span>
                </button>

                {!isLifetime && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleStartFreeTrial}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center"
                  >
                    <span>Or Start 7-Day Free Trial (₹0 today)</span>
                  </button>
                )}
              </div>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-[#E6E9F2] text-center text-xs text-[#5B6475]">
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
