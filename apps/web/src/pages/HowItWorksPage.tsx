import React from 'react';
import { ArrowRightIcon, CheckIcon, QrCodeIcon, MonitorIcon, PrinterIcon } from '../components/icons';
import { RelatedLinks } from '../components/RelatedLinks';

interface HowItWorksPageProps {
  onNavigate: (path: string) => void;
}

const steps = [
  {
    number: '01',
    title: 'Customer Scans & Configures',
    description: 'The student opens your shop QR link in any mobile browser, uploads their PDF or document, selects B&W or color, duplex or simplex, and reviews the exact quote in rupees.',
    icon: QrCodeIcon,
  },
  {
    number: '02',
    title: 'Staff Review in Counter POS',
    description: 'Your shop team sees the incoming request in the merchant workspace, confirms the print parameters, collects cash or verifies Razorpay UPI checkout.',
    icon: MonitorIcon,
  },
  {
    number: '03',
    title: 'Automated Print & Handover',
    description: 'Approved jobs are sent to your local Windows agent and spooled to the printer. Staff verify physical sheets and mark the order ready for counter pickup.',
    icon: PrinterIcon,
  },
];

export const HowItWorksPage: React.FC<HowItWorksPageProps> = ({ onNavigate }) => (
  <main className="min-h-screen bg-ink-app dark:bg-ink-dark-app text-ink-text dark:text-ink-dark-text">
    {/* Hero Section */}
    <section className="relative overflow-hidden py-20 md:py-28 text-center text-white" style={{ background: 'linear-gradient(135deg, #0D1422 0%, #172033 50%, #19263A 100%)' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-[#8293FF] text-xs font-semibold tracking-wider mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-dark animate-pulse" />
          <span>WORKFLOW ARCHITECTURE</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-6 text-white">
          A clear, reliable path from customer request to counter pickup.
        </h1>

        <p className="text-base sm:text-lg text-[#A6B2C5] max-w-2xl mx-auto mb-8 leading-relaxed">
          See how Inklly bridges student self-service ordering, shop staff review, and physical Windows printer automation into one synchronized workflow.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <button
            type="button"
            onClick={() => onNavigate('/register')}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-sm shadow-brand transition-all duration-200 cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <span>Start Free 7-Day Trial</span>
            <ArrowRightIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/p/campus1')}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.15] text-white font-medium text-sm transition-all duration-200 cursor-pointer"
          >
            Try Customer Demo
          </button>
        </div>
      </div>
    </section>

    {/* Steps Grid */}
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {steps.map((step) => {
          const StepIcon = step.icon;
          return (
            <article
              key={step.number}
              className="rounded-2xl border border-ink-border dark:border-ink-dark-border bg-ink-surface dark:bg-ink-dark-surface p-7 sm:p-8 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="text-2xl font-black font-mono text-brand dark:text-brand-dark">
                    {step.number}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-brand-soft dark:bg-brand-dark-soft text-brand dark:text-brand-dark flex items-center justify-center">
                    <StepIcon size={20} />
                  </div>
                </div>
                <h2 className="text-lg font-bold text-ink-text dark:text-ink-dark-text mb-3">
                  {step.title}
                </h2>
                <p className="text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary leading-relaxed">
                  {step.description}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-8">
        <RelatedLinks
          heading="Explore Related Resources"
          links={[
            { label: 'Print Shop Automation Software', href: '/print-shop-automation-software' },
            { label: 'QR Code Printing System', href: '/qr-code-printing-system' },
            { label: 'Subscription Pricing Plans', href: '/pricing' },
          ]}
          onNavigate={onNavigate}
        />
      </div>
    </section>
  </main>
);
