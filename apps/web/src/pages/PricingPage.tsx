import React, { useState } from 'react';
import { Accordion, AccordionItemData } from '../components/Accordion';
import { RelatedLinks } from '../components/RelatedLinks';
import { ChevronDownIcon, CheckIcon } from '../components/icons';

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
    <div className="flex flex-col min-h-screen bg-ink-app dark:bg-ink-dark-app">
      {/* ─────────────────────────────────────────────────────────────
          HERO & BILLING TOGGLE
      ───────────────────────────────────────────────────────────── */}
      <section className="pt-16 pb-10 px-4 sm:px-6 lg:px-8 text-center max-w-4xl mx-auto">
        <span className="eyebrow">
          Transparent Subscriptions
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-ink-text dark:text-ink-dark-text mb-4">
          Plans built for high-volume print counters
        </h1>
        <p className="text-sm sm:text-base text-ink-text-secondary dark:text-ink-dark-text-secondary max-w-2xl mx-auto mb-8">
          Simple subscription plans designed to automate student queues, self-service ordering, and local counter printing.
        </p>

        {/* Cycle Toggle Pill */}
        <div className="inline-flex p-1 bg-ink-surface dark:bg-ink-dark-surface border border-ink-border dark:border-ink-dark-border rounded-2xl shadow-xs">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`min-w-[96px] py-2 px-5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              billingCycle === 'monthly'
                ? 'bg-brand text-white shadow-xs'
                : 'text-ink-text-secondary dark:text-ink-dark-text-secondary hover:text-ink-text dark:hover:text-ink-dark-text'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('yearly')}
            className={`min-w-[96px] py-2 px-5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              billingCycle === 'yearly'
                ? 'bg-brand text-white shadow-xs'
                : 'text-ink-text-secondary dark:text-ink-dark-text-secondary hover:text-ink-text dark:hover:text-ink-dark-text'
            }`}
          >
            Yearly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('lifetime')}
            className={`min-w-[96px] py-2 px-5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              billingCycle === 'lifetime'
                ? 'bg-brand text-white shadow-xs'
                : 'text-ink-text-secondary dark:text-ink-dark-text-secondary hover:text-ink-text dark:hover:text-ink-dark-text'
            }`}
          >
            Lifetime
          </button>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          PLANS CARDS
      ───────────────────────────────────────────────────────────── */}
      <section className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* LIFETIME VIEW */}
        {isLifetime ? (
          <div className="max-w-md mx-auto">
            <div className="bg-ink-surface dark:bg-ink-dark-surface rounded-3xl p-8 border-2 border-brand shadow-lg flex flex-col justify-between relative">
              {/* Badge */}
              <div className="absolute -top-3 left-6 bg-brand text-white px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm">
                90% OFF
              </div>

              <div>
                <h3 className="text-2xl font-bold text-ink-text dark:text-ink-dark-text mb-1">Lifetime</h3>
                <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary leading-relaxed mb-6">
                  One payment. Permanent access to every Inklly feature.
                </p>

                {/* Strikethrough + Big Price */}
                <div className="mb-1 text-ink-text-muted dark:text-ink-dark-text-muted font-bold text-sm line-through">
                  ₹14,999
                </div>
                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className="text-4xl sm:text-5xl font-black text-ink-text dark:text-ink-dark-text">₹1,499</span>
                  <span className="text-xs font-medium text-ink-text-secondary dark:text-ink-dark-text-secondary">one time</span>
                </div>
                <div className="text-xs font-bold text-status-success mb-6">
                  You save ₹13,500 • 90% discount
                </div>

                {/* Features */}
                <div className="space-y-3 pb-6 border-t border-ink-border dark:border-ink-dark-border pt-6 text-xs text-ink-text dark:text-ink-dark-text font-medium">
                  <div className="flex items-center gap-2">
                    <CheckIcon size={14} className="text-status-success shrink-0" />
                    <span>Unlimited orders/month</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckIcon size={14} className="text-status-success shrink-0" />
                    <span>Unlimited printers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckIcon size={14} className="text-status-success shrink-0" />
                    <span>All-document auto print</span>
                  </div>
                </div>

                {/* All plan limits dropdown */}
                <button
                  type="button"
                  onClick={() => toggleLimits('lifetime')}
                  className="flex items-center gap-1 text-xs font-bold text-brand hover:underline mb-6 cursor-pointer"
                >
                  <span>All plan limits</span>
                  <span className={`text-[10px] transform transition-transform ${expandedCard === 'lifetime' ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {expandedCard === 'lifetime' && (
                  <div className="bg-ink-surface-subtle dark:bg-ink-dark-elevated p-4 rounded-2xl mb-6 text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary space-y-2 border border-ink-border dark:border-ink-dark-border">
                    <div className="flex justify-between"><span>Multi-Branch Kiosk Mode:</span><strong className="text-ink-text dark:text-ink-dark-text">Included</strong></div>
                    <div className="flex justify-between"><span>WhatsApp Bot:</span><strong className="text-ink-text dark:text-ink-dark-text">Included</strong></div>
                    <div className="flex justify-between"><span>Developer API & Webhooks:</span><strong className="text-ink-text dark:text-ink-dark-text">Included</strong></div>
                    <div className="flex justify-between"><span>Updates & Maintenance:</span><strong className="text-ink-text dark:text-ink-dark-text">Lifetime Free</strong></div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleGetStarted('plan-lifetime')}
                className="w-full py-3.5 bg-brand hover:bg-brand-hover text-white font-bold text-sm rounded-xl shadow-brand transition-all cursor-pointer"
              >
                Get started
              </button>
            </div>
          </div>
        ) : (
          /* MONTHLY & YEARLY 4-COLUMN GRID */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {/* 1. STARTER */}
            <div className="bg-ink-surface dark:bg-ink-dark-surface rounded-3xl p-7 border border-ink-border dark:border-ink-dark-border shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold text-ink-text dark:text-ink-dark-text mb-1">Starter</h3>
                <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary leading-relaxed mb-6 min-h-[32px]">
                  QR and WhatsApp portal for a small single-printer shop.
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black text-ink-text dark:text-ink-dark-text">
                    {isYearly ? '₹999' : '₹99'}
                  </span>
                  <span className="text-xs font-medium text-ink-text-secondary dark:text-ink-dark-text-secondary">
                    {isYearly ? '/year' : '/month'}
                  </span>
                </div>

                <div className="space-y-3 pb-6 border-t border-ink-border dark:border-ink-dark-border pt-6 text-xs text-ink-text dark:text-ink-dark-text font-medium">
                  <div>300 orders/month</div>
                  <div>1 printer</div>
                  <div>Manual print release</div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleLimits('starter')}
                  className="flex items-center gap-1 text-xs font-bold text-brand hover:underline mb-6 cursor-pointer"
                >
                  <span>All plan limits</span>
                  <span className={`text-[10px] transform transition-transform ${expandedCard === 'starter' ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {expandedCard === 'starter' && (
                  <div className="bg-ink-surface-subtle dark:bg-ink-dark-elevated p-3.5 rounded-2xl mb-6 text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary space-y-1.5 border border-ink-border dark:border-ink-dark-border">
                    <div className="flex justify-between"><span>Max document size:</span><strong className="text-ink-text dark:text-ink-dark-text">25 MB</strong></div>
                    <div className="flex justify-between"><span>Storage retention:</span><strong className="text-ink-text dark:text-ink-dark-text">24 Hours</strong></div>
                    <div className="flex justify-between"><span>Staff accounts:</span><strong className="text-ink-text dark:text-ink-dark-text">1 Operator</strong></div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleGetStarted('plan-starter')}
                className="w-full py-3.5 bg-brand hover:bg-brand-hover text-white font-bold text-sm rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Get started
              </button>
            </div>

            {/* 2. GROWTH (MOST POPULAR) */}
            <div className="bg-ink-surface dark:bg-ink-dark-surface rounded-3xl p-7 border-2 border-brand shadow-lg flex flex-col justify-between relative">
              {/* Badge */}
              <div className="absolute -top-3 left-6 bg-brand text-white px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm">
                MOST POPULAR
              </div>

              <div>
                <h3 className="text-2xl font-bold text-ink-text dark:text-ink-dark-text mb-2">Growth</h3>

                {/* Free trial green chip */}
                <div className="inline-block bg-status-success-bg text-status-success text-xs font-bold px-3 py-1.5 rounded-xl mb-3">
                  7-day free trial available
                </div>

                <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary leading-relaxed mb-6 min-h-[32px]">
                  Payment-triggered automation for growing shops.
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black text-ink-text dark:text-ink-dark-text">
                    {isYearly ? '₹1,999' : '₹199'}
                  </span>
                  <span className="text-xs font-medium text-ink-text-secondary dark:text-ink-dark-text-secondary">
                    {isYearly ? '/year' : '/month'}
                  </span>
                </div>

                <div className="space-y-3 pb-6 border-t border-ink-border dark:border-ink-dark-border pt-6 text-xs text-ink-text dark:text-ink-dark-text font-medium">
                  <div>1,500 orders/month</div>
                  <div>2 printers</div>
                  <div>Payment-received auto print</div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleLimits('growth')}
                  className="flex items-center gap-1 text-xs font-bold text-brand hover:underline mb-6 cursor-pointer"
                >
                  <span>All plan limits</span>
                  <span className={`text-[10px] transform transition-transform ${expandedCard === 'growth' ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {expandedCard === 'growth' && (
                  <div className="bg-ink-surface-subtle dark:bg-ink-dark-elevated p-3.5 rounded-2xl mb-6 text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary space-y-1.5 border border-ink-border dark:border-ink-dark-border">
                    <div className="flex justify-between"><span>Max document size:</span><strong className="text-ink-text dark:text-ink-dark-text">50 MB</strong></div>
                    <div className="flex justify-between"><span>Storage retention:</span><strong className="text-ink-text dark:text-ink-dark-text">7 Days</strong></div>
                    <div className="flex justify-between"><span>Staff accounts:</span><strong className="text-ink-text dark:text-ink-dark-text">Up to 3</strong></div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleGetStarted('plan-growth')}
                className="w-full py-3.5 bg-brand hover:bg-brand-hover text-white font-bold text-sm rounded-xl shadow-brand transition-all cursor-pointer"
              >
                Get started
              </button>
            </div>

            {/* 3. PRO */}
            <div className="bg-ink-surface dark:bg-ink-dark-surface rounded-3xl p-7 border border-ink-border dark:border-ink-dark-border shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold text-ink-text dark:text-ink-dark-text mb-1">Pro</h3>
                <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary leading-relaxed mb-6 min-h-[32px]">
                  Full automatic printing with multiple printers and staff.
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black text-ink-text dark:text-ink-dark-text">
                    {isYearly ? '₹4,999' : '₹499'}
                  </span>
                  <span className="text-xs font-medium text-ink-text-secondary dark:text-ink-dark-text-secondary">
                    {isYearly ? '/year' : '/month'}
                  </span>
                </div>

                <div className="space-y-3 pb-6 border-t border-ink-border dark:border-ink-dark-border pt-6 text-xs text-ink-text dark:text-ink-dark-text font-medium">
                  <div>6,000 orders/month</div>
                  <div>5 printers</div>
                  <div>All-document auto print</div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleLimits('pro')}
                  className="flex items-center gap-1 text-xs font-bold text-brand hover:underline mb-6 cursor-pointer"
                >
                  <span>All plan limits</span>
                  <span className={`text-[10px] transform transition-transform ${expandedCard === 'pro' ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {expandedCard === 'pro' && (
                  <div className="bg-ink-surface-subtle dark:bg-ink-dark-elevated p-3.5 rounded-2xl mb-6 text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary space-y-1.5 border border-ink-border dark:border-ink-dark-border">
                    <div className="flex justify-between"><span>Fast Spooler Agent:</span><strong className="text-ink-text dark:text-ink-dark-text">Included</strong></div>
                    <div className="flex justify-between"><span>Staff Permissions:</span><strong className="text-ink-text dark:text-ink-dark-text">Included</strong></div>
                    <div className="flex justify-between"><span>Cash Reconciliation:</span><strong className="text-ink-text dark:text-ink-dark-text">Included</strong></div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleGetStarted('plan-pro')}
                className="w-full py-3.5 bg-brand hover:bg-brand-hover text-white font-bold text-sm rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Get started
              </button>
            </div>

            {/* 4. SCALE */}
            <div className="bg-ink-surface dark:bg-ink-dark-surface rounded-3xl p-7 border border-ink-border dark:border-ink-dark-border shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold text-ink-text dark:text-ink-dark-text mb-1">Scale</h3>
                <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary leading-relaxed mb-6 min-h-[32px]">
                  High-volume automation for busy shops and branches.
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black text-ink-text dark:text-ink-dark-text">
                    {isYearly ? '₹8,999' : '₹899'}
                  </span>
                  <span className="text-xs font-medium text-ink-text-secondary dark:text-ink-dark-text-secondary">
                    {isYearly ? '/year' : '/month'}
                  </span>
                </div>

                <div className="space-y-3 pb-6 border-t border-ink-border dark:border-ink-dark-border pt-6 text-xs text-ink-text dark:text-ink-dark-text font-medium">
                  <div>50,000 orders/month</div>
                  <div>10 printers</div>
                  <div>All-document auto print</div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleLimits('scale')}
                  className="flex items-center gap-1 text-xs font-bold text-brand hover:underline mb-6 cursor-pointer"
                >
                  <span>All plan limits</span>
                  <span className={`text-[10px] transform transition-transform ${expandedCard === 'scale' ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {expandedCard === 'scale' && (
                  <div className="bg-ink-surface-subtle dark:bg-ink-dark-elevated p-3.5 rounded-2xl mb-6 text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary space-y-1.5 border border-ink-border dark:border-ink-dark-border">
                    <div className="flex justify-between"><span>Kiosk Integration:</span><strong className="text-ink-text dark:text-ink-dark-text">Included</strong></div>
                    <div className="flex justify-between"><span>Hardware Spool Queue:</span><strong className="text-ink-text dark:text-ink-dark-text">Dedicated</strong></div>
                    <div className="flex justify-between"><span>Developer Webhooks:</span><strong className="text-ink-text dark:text-ink-dark-text">Full API</strong></div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleGetStarted('plan-scale')}
                className="w-full py-3.5 bg-brand hover:bg-brand-hover text-white font-bold text-sm rounded-xl shadow-xs transition-all cursor-pointer"
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
          <span className="eyebrow">Frequently Asked Questions</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-ink-text dark:text-ink-dark-text tracking-tight">
            Got questions? We've got answers
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
