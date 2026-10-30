import React, { useState } from 'react';
import { Accordion, AccordionItemData } from '../components/Accordion';
import { RelatedLinks } from '../components/RelatedLinks';
import { CheckIcon } from '../components/icons';

interface PricingPageProps {
  onNavigate: (path: string) => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ onNavigate }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly' | 'lifetime'>('monthly');
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [showAllLimits, setShowAllLimits] = useState<boolean>(false);

  const isYearly = billingCycle === 'yearly';
  const isLifetime = billingCycle === 'lifetime';

  const currencySymbol = currency === 'INR' ? '₹' : '$';
  const currencyMultiplier = currency === 'INR' ? 1 : 0.012;

  const formatPrice = (inrPrice: number) => {
    if (currency === 'INR') {
      return `₹${inrPrice.toLocaleString('en-IN')}`;
    }
    const usd = Math.round(inrPrice * currencyMultiplier);
    return `$${usd}`;
  };

  const handlePlanSelect = (planId: string) => {
    onNavigate(`/register?plan=${encodeURIComponent(planId)}&cycle=${encodeURIComponent(isYearly ? 'yearly' : 'monthly')}`);
  };

  const faqs: AccordionItemData[] = [
    {
      question: 'Is there a free trial, and do I need to enter credit card details?',
      answer:
        'Yes! The Growth plan includes a 7-day trial with full feature access. You can test your counter and workflow immediately, or pay upfront using Razorpay Sandbox/Test Mode to activate a production subscription.',
    },
    {
      question: 'Do you charge any per-page commission or transaction percentage?',
      answer:
        'No. Inklly charges 0% commission on your customer print orders. You keep 100% of your counter revenue. Payments settle directly into your own bank account via your connected payment gateway or cash at collection.',
    },
    {
      question: 'Can I upgrade, downgrade or cancel my plan at any time?',
      answer:
        'Yes, you can upgrade, downgrade, or cancel your subscription at any time directly from your merchant account dashboard without penalty or hidden cancellation fees.',
    },
    {
      question: 'What happens if my shop exceeds the monthly order limit on Starter or Growth?',
      answer:
        'Your printing service will never be abruptly cut off during busy student exam times. If you exceed your limit, you will receive a notification and a 48-hour grace period to upgrade to the next tier.',
    },
    {
      question: 'Are there any hardware costs involved?',
      answer:
        'No additional hardware is required for standard counter automation. Inklly runs on any existing Windows 10/11 PC and connects directly to your existing USB or LAN printers.',
    },
    {
      question: 'Do you offer custom pricing for university chains or large franchises?',
      answer:
        'Yes. If you operate more than 5 shop branches or manage an entire university campus print infrastructure, contact our sales team for tailored volume licensing and dedicated SLA agreements.',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#FBFCFE]">
      {/* ─────────────────────────────────────────────────────────────
          HERO: Pricing
      ───────────────────────────────────────────────────────────── */}
      <section className="bg-[#172031] text-white pt-16 pb-20 md:pt-20 md:pb-24 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[300px] bg-[#4D64E6]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-3 py-1 bg-white/10 text-[#A9B6FF] rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-white/15">
            TRANSPARENT PRICING
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.15] mb-6">
            Simple, predictable pricing for every size of print shop
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-300 max-w-2xl mx-auto mb-8 leading-relaxed">
            No hidden fees, no per-page commissions. Pick a plan that fits your counter volume, set up your credentials, and pay securely via Razorpay.
          </p>

          {/* Controls: Billing Cycle & Currency Switchers */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            {/* Cycle Toggle */}
            <div className="bg-white/10 p-1 rounded-xl flex items-center border border-white/15 w-full sm:w-auto" role="tablist" aria-label="Subscription billing cycle">
              <button
                type="button"
                role="tab"
                aria-selected={billingCycle === 'monthly'}
                onClick={() => setBillingCycle('monthly')}
                className={`flex-1 sm:flex-initial min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-[#4D64E6] text-white shadow-xs'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={billingCycle === 'yearly'}
                onClick={() => setBillingCycle('yearly')}
                className={`flex-1 sm:flex-initial min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  billingCycle === 'yearly'
                    ? 'bg-[#4D64E6] text-white shadow-xs'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Yearly
                <span className="px-1.5 py-0.5 rounded-full bg-[#1F8A4C] text-white text-[9px]">
                  -17%
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={billingCycle === 'lifetime'}
                onClick={() => setBillingCycle('lifetime')}
                className={`flex-1 sm:flex-initial min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                  billingCycle === 'lifetime'
                    ? 'bg-[#4D64E6] text-white shadow-xs'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Lifetime
              </button>
            </div>

            {/* Currency Selector */}
            <div className="bg-white/10 p-1 rounded-xl flex items-center border border-white/15" role="tablist" aria-label="Currency selection">
              <button
                type="button"
                role="tab"
                aria-selected={currency === 'INR'}
                onClick={() => setCurrency('INR')}
                className={`min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer ${
                  currency === 'INR' ? 'bg-white text-[#172031]' : 'text-gray-300 hover:text-white'
                }`}
              >
                INR (₹)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={currency === 'USD'}
                onClick={() => setCurrency('USD')}
                className={`min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer ${
                  currency === 'USD' ? 'bg-white text-[#172031]' : 'text-gray-300 hover:text-white'
                }`}
              >
                USD ($)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: 4 PLAN CARDS GRID
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full -mt-10 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {/* Plan 1: Starter */}
          <div className="bg-white rounded-3xl p-6 border border-[#E6E9F2] shadow-sm flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#5B6475] mb-2">
                Starter
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-[#172031]">
                  {isLifetime ? formatPrice(4999) : isYearly ? formatPrice(4990) : formatPrice(499)}
                </span>
                <span className="text-xs text-[#5B6475]">
                  {isLifetime ? 'one-time' : isYearly ? '/year' : '/month'}
                </span>
              </div>
              <p className="text-xs text-[#5B6475] mb-6">
                For small stationery shops & single-printer counters.
              </p>

              <div className="space-y-3 pb-6 border-t border-[#E6E9F2] pt-6 text-xs text-[#172031]">
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span><strong>1-2 Printers</strong> connected</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Up to <strong>500 orders/mo</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>QR code self-service portal</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Basic queue & Cash on collection</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Standard email support</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handlePlanSelect('plan-starter')}
              className="w-full py-3 bg-[#F3F5FF] hover:bg-[#E6EBFD] text-[#4D64E6] font-bold text-xs rounded-xl transition-all cursor-pointer mt-4"
            >
              Start Sign Up →
            </button>
          </div>

          {/* Plan 2: Growth (MOST POPULAR) */}
          <div className="bg-white rounded-3xl p-6 border-2 border-[#4D64E6] shadow-xl flex flex-col justify-between relative transform lg:-translate-y-2">
            {/* Badges */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#4D64E6] text-white px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-md">
              MOST POPULAR
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#4D64E6]">
                  Growth
                </span>
                <span className="bg-[#EAFBF0] text-[#1F8A4C] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  7-Day Free Trial
                </span>
              </div>

              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-[#172031]">
                  {isLifetime ? formatPrice(11990) : isYearly ? formatPrice(11990) : formatPrice(1199)}
                </span>
                <span className="text-xs text-[#5B6475]">
                  {isLifetime ? 'one-time' : isYearly ? '/year' : '/month'}
                </span>
              </div>
              <p className="text-xs text-[#5B6475] mb-6">
                For busy photocopy shops near colleges & campuses.
              </p>

              <div className="space-y-3 pb-6 border-t border-[#E6E9F2] pt-6 text-xs text-[#172031]">
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Up to <strong>5 Printers</strong> connected</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Up to <strong>2,000 orders/mo</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span><strong>Dedicated WhatsApp Bot</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Multi-printer smart routing</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Custom rates & bulk discounts</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Digital counter token display</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Priority WhatsApp support</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handlePlanSelect('plan-growth')}
              className="w-full py-3.5 bg-[#4D64E6] hover:bg-[#3F54D1] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer mt-4"
            >
              Start Sign Up (Growth) →
            </button>
          </div>

          {/* Plan 3: Pro */}
          <div className="bg-white rounded-3xl p-6 border border-[#E6E9F2] shadow-sm flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#5B6475] mb-2">
                Pro
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-[#172031]">
                  {isLifetime ? formatPrice(24990) : isYearly ? formatPrice(24990) : formatPrice(2499)}
                </span>
                <span className="text-xs text-[#5B6475]">
                  {isLifetime ? 'one-time' : isYearly ? '/year' : '/month'}
                </span>
              </div>
              <p className="text-xs text-[#5B6475] mb-6">
                For high-volume multi-counter photocopy centers.
              </p>

              <div className="space-y-3 pb-6 border-t border-[#E6E9F2] pt-6 text-xs text-[#172031]">
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Up to <strong>15 Printers</strong> connected</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Up to <strong>10,000 monthly orders</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Desktop Agent Fast Spooling</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Staff Role & Operator Management</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Developer API & Webhooks Access</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Shift cash reconciliation reports</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Priority SLA assistance</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handlePlanSelect('plan-pro')}
              className="w-full py-3 bg-[#F3F5FF] hover:bg-[#E6EBFD] text-[#4D64E6] font-bold text-xs rounded-xl transition-all cursor-pointer mt-4"
            >
              Start Sign Up (Pro) →
            </button>
          </div>

          {/* Plan 4: Scale */}
          <div className="bg-white rounded-3xl p-6 border border-[#E6E9F2] shadow-sm flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#5B6475] mb-2">
                Scale
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-[#172031]">
                  {isLifetime ? formatPrice(69990) : isYearly ? formatPrice(69990) : formatPrice(6999)}
                </span>
                <span className="text-xs text-[#5B6475]">
                  {isLifetime ? 'one-time' : isYearly ? '/year' : '/month'}
                </span>
              </div>
              <p className="text-xs text-[#5B6475] mb-6">
                For commercial digital printers, chains & campuses.
              </p>

              <div className="space-y-3 pb-6 border-t border-[#E6E9F2] pt-6 text-xs text-[#172031]">
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span><strong>100+ printers</strong> & multiple branches</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span><strong>Unlimited orders</strong> monthly</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Dedicated hardware spooler queue</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Unmanned Kiosk integration</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Custom domain branding</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#1F8A4C] shrink-0" />
                  <span>Dedicated account manager</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handlePlanSelect('plan-scale')}
              className="w-full py-3 bg-[#172031] hover:bg-[#1E2A44] text-white font-bold text-xs rounded-xl transition-all cursor-pointer mt-4"
            >
              Start Sign Up (Scale) →
            </button>
          </div>
        </div>

        {/* Expandable Comparison Details */}
        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={() => setShowAllLimits(!showAllLimits)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-[#E6E9F2] bg-white text-xs font-bold text-[#172031] hover:bg-gray-50 shadow-2xs cursor-pointer"
          >
            <span>{showAllLimits ? 'Hide feature breakdown' : 'Compare all plan limits & features'}</span>
            <span>{showAllLimits ? '▲' : '⌄'}</span>
          </button>

          {showAllLimits && (
            <div className="mt-8 bg-white border border-[#E6E9F2] rounded-3xl p-6 sm:p-8 overflow-x-auto text-left shadow-sm">
              <table className="w-full text-xs text-[#172031]">
                <thead>
                  <tr className="border-b border-[#E6E9F2] text-[#5B6475] uppercase tracking-wider text-[11px]">
                    <th className="pb-3 text-left">Feature / Capability</th>
                    <th className="pb-3 text-center">Starter</th>
                    <th className="pb-3 text-center text-[#4D64E6] font-bold">Growth</th>
                    <th className="pb-3 text-center">Pro</th>
                    <th className="pb-3 text-center">Scale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-3 font-semibold">Monthly Order Allowance</td>
                    <td className="py-3 text-center text-[#5B6475]">500</td>
                    <td className="py-3 text-center font-bold text-[#4D64E6]">2,000</td>
                    <td className="py-3 text-center text-[#5B6475]">10,000</td>
                    <td className="py-3 text-center font-bold">Unlimited (100k)</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-semibold">Max Connected Printers</td>
                    <td className="py-3 text-center text-[#5B6475]">2</td>
                    <td className="py-3 text-center font-bold text-[#4D64E6]">5</td>
                    <td className="py-3 text-center text-[#5B6475]">15</td>
                    <td className="py-3 text-center font-bold">100</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-semibold">WhatsApp Bot Ordering</td>
                    <td className="py-3 text-center text-gray-400">✕</td>
                    <td className="py-3 text-center text-[#1F8A4C] font-bold">✓ Included</td>
                    <td className="py-3 text-center text-[#1F8A4C] font-bold">✓ Included</td>
                    <td className="py-3 text-center text-[#1F8A4C] font-bold">✓ Included</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-semibold">Desktop Fast Spooler Agent</td>
                    <td className="py-3 text-center text-gray-400">✕</td>
                    <td className="py-3 text-center text-[#1F8A4C] font-bold">✓ Included</td>
                    <td className="py-3 text-center text-[#1F8A4C] font-bold">✓ Included</td>
                    <td className="py-3 text-center text-[#1F8A4C] font-bold">✓ Included</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-semibold">Multi-Counter Staff Accounts</td>
                    <td className="py-3 text-center text-gray-400">✕</td>
                    <td className="py-3 text-center text-gray-400">✕</td>
                    <td className="py-3 text-center text-[#1F8A4C] font-bold">✓ Included</td>
                    <td className="py-3 text-center text-[#1F8A4C] font-bold">✓ Included</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-semibold">Developer API & Webhooks Access</td>
                    <td className="py-3 text-center text-gray-400">✕</td>
                    <td className="py-3 text-center text-gray-400">✕</td>
                    <td className="py-3 text-center text-[#1F8A4C] font-bold">✓ Included</td>
                    <td className="py-3 text-center text-[#1F8A4C] font-bold">✓ Included</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-semibold">Deterministic Paise Pricing & Quotes</td>
                    <td className="py-3 text-center text-[#1F8A4C]">✓</td>
                    <td className="py-3 text-center text-[#1F8A4C]">✓</td>
                    <td className="py-3 text-center text-[#1F8A4C]">✓</td>
                    <td className="py-3 text-center text-[#1F8A4C]">✓</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-semibold">Razorpay Online Customer Checkout</td>
                    <td className="py-3 text-center text-[#1F8A4C]">✓</td>
                    <td className="py-3 text-center text-[#1F8A4C]">✓</td>
                    <td className="py-3 text-center text-[#1F8A4C]">✓</td>
                    <td className="py-3 text-center text-[#1F8A4C]">✓</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: FAQS & RELATED
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172031] tracking-tight">
            Frequently Asked Questions
          </h2>
        </div>
        <Accordion items={faqs} defaultOpenIndex={0} />

        <div className="mt-16">
          <RelatedLinks
            heading="Explore related pages"
            links={[
              { label: 'Explore Kiosk Franchise Model', href: '/franchise' },
              { label: 'Print Shop Automation Software', href: '/print-shop-automation-software' },
              { label: 'WhatsApp Printing Software', href: '/whatsapp-printing-software' },
            ]}
            onNavigate={onNavigate}
          />
        </div>
      </section>
    </div>
  );
};
