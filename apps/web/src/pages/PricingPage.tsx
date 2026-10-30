import React, { useState } from 'react';
import { Accordion, AccordionItemData } from '../components/Accordion';
import { RelatedLinks } from '../components/RelatedLinks';
import { ChevronDownIcon } from '../components/icons';

interface PricingPageProps {
  onNavigate: (path: string) => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ onNavigate }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly' | 'lifetime'>('monthly');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const isYearly = billingCycle === 'yearly';
  const isLifetime = billingCycle === 'lifetime';

  const toggleLimits = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  const handleGetStarted = (planId: string) => {
    onNavigate(`/register?plan=${encodeURIComponent(planId)}&cycle=${encodeURIComponent(isLifetime ? 'lifetime' : isYearly ? 'yearly' : 'monthly')}`);
  };

  const faqs: AccordionItemData[] = [
    {
      question: 'Is there a free trial, and do I need to enter credit card details?',
      answer:
        'Yes! The Growth plan includes a completely free 7-day trial with full feature access. You can test customer QR ordering, WhatsApp automation, and counter printing with zero risk.',
    },
    {
      question: 'Do you charge any per-page commission or transaction percentage?',
      answer:
        'No. Inklly charges 0% commission on your print orders. You keep 100% of your revenue. UPI payments settle directly into your own bank account via your connected payment gateway or cash at collection.',
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
          HERO & BILLING TOGGLE
      ───────────────────────────────────────────────────────────── */}
      <section className="pt-12 pb-8 px-4 sm:px-6 lg:px-8 text-center max-w-4xl mx-auto">
        {/* Cycle Toggle Pill */}
        <div className="inline-flex p-1 bg-white border border-[#E6E9F2] rounded-2xl shadow-xs">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`min-w-[90px] py-2 px-5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              billingCycle === 'monthly'
                ? 'bg-[#3B5BFE] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('yearly')}
            className={`min-w-[90px] py-2 px-5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              billingCycle === 'yearly'
                ? 'bg-[#3B5BFE] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Yearly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('lifetime')}
            className={`min-w-[90px] py-2 px-5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              billingCycle === 'lifetime'
                ? 'bg-[#3B5BFE] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lifetime
          </button>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          PLANS CARDS
      ───────────────────────────────────────────────────────────── */}
      <section className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* LIFETIME VIEW */}
        {isLifetime ? (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-3xl p-8 border-2 border-[#3B5BFE] shadow-xl flex flex-col justify-between relative">
              {/* Badge */}
              <div className="absolute -top-3 left-6 bg-[#3B5BFE] text-white px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm">
                90% OFF
              </div>

              <div>
                <h3 className="text-2xl font-extrabold text-[#172031] mb-1">Lifetime</h3>
                <p className="text-xs text-[#5B6475] leading-relaxed mb-6">
                  One payment. Permanent access to every Inklly feature.
                </p>

                {/* Strikethrough + Big Price */}
                <div className="mb-1 text-slate-400 font-bold text-sm line-through">
                  ₹14,999
                </div>
                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className="text-4xl sm:text-5xl font-black text-[#172031]">₹1,499</span>
                  <span className="text-xs font-medium text-[#5B6475]">one time</span>
                </div>
                <div className="text-xs font-bold text-[#10B981] mb-6">
                  You save ₹13,500 • 90% discount
                </div>

                {/* Features */}
                <div className="space-y-3 pb-6 border-t border-[#F0F2F7] pt-6 text-xs text-[#172031] font-medium">
                  <div>Unlimited orders/month</div>
                  <div>Unlimited printers</div>
                  <div>All-document auto print</div>
                </div>

                {/* All plan limits dropdown */}
                <button
                  type="button"
                  onClick={() => toggleLimits('lifetime')}
                  className="flex items-center gap-1 text-xs font-bold text-[#3B5BFE] hover:underline mb-6 cursor-pointer"
                >
                  <span>All plan limits</span>
                  <span className={`text-[10px] transform transition-transform ${expandedCard === 'lifetime' ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {expandedCard === 'lifetime' && (
                  <div className="bg-[#F8F9FD] p-4 rounded-2xl mb-6 text-xs text-slate-600 space-y-2 border border-[#E6E9F2]">
                    <div className="flex justify-between"><span>Multi-Branch Kiosk Mode:</span><strong className="text-slate-800">Included</strong></div>
                    <div className="flex justify-between"><span>WhatsApp Bot:</span><strong className="text-slate-800">Included</strong></div>
                    <div className="flex justify-between"><span>Developer API & Webhooks:</span><strong className="text-slate-800">Included</strong></div>
                    <div className="flex justify-between"><span>Updates & Maintenance:</span><strong className="text-slate-800">Lifetime Free</strong></div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleGetStarted('plan-lifetime')}
                className="w-full py-3.5 bg-[#3B5BFE] hover:bg-[#2C4AEE] text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer"
              >
                Get started
              </button>
            </div>
          </div>
        ) : (
          /* MONTHLY / YEARLY 4-GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {/* 1. STARTER */}
            <div className="bg-white rounded-3xl p-7 border border-[#E6E9F2] shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-extrabold text-[#172031] mb-1">Starter</h3>
                <p className="text-xs text-[#5B6475] leading-relaxed mb-6 min-h-[32px]">
                  QR and WhatsApp portal for a small single-printer shop.
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black text-[#172031]">
                    {isYearly ? '₹999' : '₹99'}
                  </span>
                  <span className="text-xs font-medium text-[#5B6475]">
                    {isYearly ? '/year' : '/month'}
                  </span>
                </div>

                <div className="space-y-3 pb-6 border-t border-[#F0F2F7] pt-6 text-xs text-[#172031] font-medium">
                  <div>300 orders/month</div>
                  <div>1 printer</div>
                  <div>Manual print release</div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleLimits('starter')}
                  className="flex items-center gap-1 text-xs font-bold text-[#3B5BFE] hover:underline mb-6 cursor-pointer"
                >
                  <span>All plan limits</span>
                  <span className={`text-[10px] transform transition-transform ${expandedCard === 'starter' ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {expandedCard === 'starter' && (
                  <div className="bg-[#F8F9FD] p-3.5 rounded-2xl mb-6 text-xs text-slate-600 space-y-1.5 border border-[#E6E9F2]">
                    <div className="flex justify-between"><span>Portal QR:</span><strong className="text-slate-800">Yes</strong></div>
                    <div className="flex justify-between"><span>Cash Collection:</span><strong className="text-slate-800">Yes</strong></div>
                    <div className="flex justify-between"><span>WhatsApp Orders:</span><strong className="text-slate-800">Basic</strong></div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleGetStarted('plan-starter')}
                className="w-full py-3.5 bg-[#3B5BFE] hover:bg-[#2C4AEE] text-white font-bold text-sm rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Get started
              </button>
            </div>

            {/* 2. GROWTH (MOST POPULAR) */}
            <div className="bg-white rounded-3xl p-7 border-2 border-[#3B5BFE] shadow-xl flex flex-col justify-between relative">
              {/* Badge */}
              <div className="absolute -top-3 left-6 bg-[#3B5BFE] text-white px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
                MOST POPULAR
              </div>

              <div>
                <div className="mb-2">
                  <h3 className="text-2xl font-extrabold text-[#172031]">Growth</h3>
                </div>

                <div className="mb-3">
                  <span className="inline-block bg-[#EAFBF0] text-[#10B981] text-[11px] font-bold px-3 py-1 rounded-full">
                    7-day free trial available
                  </span>
                </div>

                <p className="text-xs text-[#5B6475] leading-relaxed mb-6 min-h-[32px]">
                  Payment-triggered automation for growing shops.
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black text-[#172031]">
                    {isYearly ? '₹1,999' : '₹199'}
                  </span>
                  <span className="text-xs font-medium text-[#5B6475]">
                    {isYearly ? '/year' : '/month'}
                  </span>
                </div>

                <div className="space-y-3 pb-6 border-t border-[#F0F2F7] pt-6 text-xs text-[#172031] font-medium">
                  <div>1,500 orders/month</div>
                  <div>2 printers</div>
                  <div>Payment-received auto print</div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleLimits('growth')}
                  className="flex items-center gap-1 text-xs font-bold text-[#3B5BFE] hover:underline mb-6 cursor-pointer"
                >
                  <span>All plan limits</span>
                  <span className={`text-[10px] transform transition-transform ${expandedCard === 'growth' ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {expandedCard === 'growth' && (
                  <div className="bg-[#F8F9FD] p-3.5 rounded-2xl mb-6 text-xs text-slate-600 space-y-1.5 border border-[#E6E9F2]">
                    <div className="flex justify-between"><span>WhatsApp Bot:</span><strong className="text-slate-800">Included</strong></div>
                    <div className="flex justify-between"><span>Multi-Printer Routing:</span><strong className="text-slate-800">Included</strong></div>
                    <div className="flex justify-between"><span>Digital Token Display:</span><strong className="text-slate-800">Included</strong></div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleGetStarted('plan-growth')}
                className="w-full py-3.5 bg-[#3B5BFE] hover:bg-[#2C4AEE] text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer"
              >
                Get started
              </button>
            </div>

            {/* 3. PRO */}
            <div className="bg-white rounded-3xl p-7 border border-[#E6E9F2] shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-extrabold text-[#172031] mb-1">Pro</h3>
                <p className="text-xs text-[#5B6475] leading-relaxed mb-6 min-h-[32px]">
                  Full automatic printing with multiple printers and staff.
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black text-[#172031]">
                    {isYearly ? '₹4,999' : '₹499'}
                  </span>
                  <span className="text-xs font-medium text-[#5B6475]">
                    {isYearly ? '/year' : '/month'}
                  </span>
                </div>

                <div className="space-y-3 pb-6 border-t border-[#F0F2F7] pt-6 text-xs text-[#172031] font-medium">
                  <div>6,000 orders/month</div>
                  <div>5 printers</div>
                  <div>All-document auto print</div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleLimits('pro')}
                  className="flex items-center gap-1 text-xs font-bold text-[#3B5BFE] hover:underline mb-6 cursor-pointer"
                >
                  <span>All plan limits</span>
                  <span className={`text-[10px] transform transition-transform ${expandedCard === 'pro' ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {expandedCard === 'pro' && (
                  <div className="bg-[#F8F9FD] p-3.5 rounded-2xl mb-6 text-xs text-slate-600 space-y-1.5 border border-[#E6E9F2]">
                    <div className="flex justify-between"><span>Fast Spooler Agent:</span><strong className="text-slate-800">Included</strong></div>
                    <div className="flex justify-between"><span>Staff Permissions:</span><strong className="text-slate-800">Included</strong></div>
                    <div className="flex justify-between"><span>Cash Reconciliation:</span><strong className="text-slate-800">Included</strong></div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleGetStarted('plan-pro')}
                className="w-full py-3.5 bg-[#3B5BFE] hover:bg-[#2C4AEE] text-white font-bold text-sm rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Get started
              </button>
            </div>

            {/* 4. SCALE */}
            <div className="bg-white rounded-3xl p-7 border border-[#E6E9F2] shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-extrabold text-[#172031] mb-1">Scale</h3>
                <p className="text-xs text-[#5B6475] leading-relaxed mb-6 min-h-[32px]">
                  High-volume automation for busy shops and branches.
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black text-[#172031]">
                    {isYearly ? '₹8,999' : '₹899'}
                  </span>
                  <span className="text-xs font-medium text-[#5B6475]">
                    {isYearly ? '/year' : '/month'}
                  </span>
                </div>

                <div className="space-y-3 pb-6 border-t border-[#F0F2F7] pt-6 text-xs text-[#172031] font-medium">
                  <div>50,000 orders/month</div>
                  <div>10 printers</div>
                  <div>All-document auto print</div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleLimits('scale')}
                  className="flex items-center gap-1 text-xs font-bold text-[#3B5BFE] hover:underline mb-6 cursor-pointer"
                >
                  <span>All plan limits</span>
                  <span className={`text-[10px] transform transition-transform ${expandedCard === 'scale' ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {expandedCard === 'scale' && (
                  <div className="bg-[#F8F9FD] p-3.5 rounded-2xl mb-6 text-xs text-slate-600 space-y-1.5 border border-[#E6E9F2]">
                    <div className="flex justify-between"><span>Kiosk Integration:</span><strong className="text-slate-800">Included</strong></div>
                    <div className="flex justify-between"><span>Hardware Spool Queue:</span><strong className="text-slate-800">Dedicated</strong></div>
                    <div className="flex justify-between"><span>Developer Webhooks:</span><strong className="text-slate-800">Full API</strong></div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleGetStarted('plan-scale')}
                className="w-full py-3.5 bg-[#3B5BFE] hover:bg-[#2C4AEE] text-white font-bold text-sm rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Get started
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION: FAQS & RELATED
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172031] tracking-tight">
            Frequently Asked Questions
          </h2>
        </div>
        <Accordion items={faqs} defaultOpenIndex={0} />

        <div className="mt-14">
          <RelatedLinks
            heading="Explore related pages"
            links={[
              { label: 'Print Shop Automation Software', href: '/print-shop-automation-software' },
              { label: 'WhatsApp Printing Software', href: '/whatsapp-printing-software' },
              { label: 'QR Code Printing System', href: '/qr-code-printing-system' },
            ]}
            onNavigate={onNavigate}
          />
        </div>
      </section>
    </div>
  );
};
