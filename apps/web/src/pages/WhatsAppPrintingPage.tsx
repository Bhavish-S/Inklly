import React from 'react';
import { WhatsAppIcon, QrCodeIcon, ArrowRightIcon, CheckIcon } from '../components/icons';
import { RelatedLinks } from '../components/RelatedLinks';

interface WhatsAppPrintingPageProps {
  onNavigate: (path: string) => void;
}

export const WhatsAppPrintingPage: React.FC<WhatsAppPrintingPageProps> = ({ onNavigate }) => (
  <main className="min-h-screen bg-ink-app dark:bg-ink-dark-app text-ink-text dark:text-ink-dark-text">
    {/* Hero Section */}
    <section className="relative overflow-hidden py-20 md:py-28 text-center text-white" style={{ background: 'linear-gradient(135deg, #0D1422 0%, #172033 50%, #19263A 100%)' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-[#8293FF] text-xs font-semibold tracking-wider mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-whatsapp animate-pulse" />
          <span>WHATSAPP INTEGRATION STATUS</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-6 text-white">
          Self-service QR ordering is live; WhatsApp intake is in roadmap development.
        </h1>

        <p className="text-base sm:text-lg text-[#A6B2C5] max-w-2xl mx-auto mb-8 leading-relaxed">
          The primary counter flow uses shop-specific QR links in mobile browsers. WhatsApp messaging and automated chat bot ordering are in active engineering development.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <button
            type="button"
            onClick={() => onNavigate('/p/campus1')}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-sm shadow-brand transition-all duration-200 cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <span>Open Sample Customer Portal</span>
            <ArrowRightIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/qr-code-printing-system')}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.15] text-white font-medium text-sm transition-all duration-200 cursor-pointer"
          >
            Explore QR Code Printing
          </button>
        </div>
      </div>
    </section>

    {/* Current Live Architecture */}
    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
      <div className="rounded-2xl border border-ink-border dark:border-ink-dark-border bg-ink-surface dark:bg-ink-dark-surface p-7 sm:p-9 shadow-xs mb-8">
        <h2 className="text-xl font-bold text-ink-text dark:text-ink-dark-text mb-4">
          What works right now in Inklly
        </h2>

        <div className="space-y-3.5 text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-status-success-bg text-status-success flex items-center justify-center shrink-0 mt-0.5">
              <CheckIcon size={12} />
            </div>
            <span><strong>Instant Mobile Web Ordering:</strong> Customers scan your standee QR and upload documents without downloading any third-party app.</span>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-status-success-bg text-status-success flex items-center justify-center shrink-0 mt-0.5">
              <CheckIcon size={12} />
            </div>
            <span><strong>Staff-Controlled Merchant Workspace:</strong> Your counter staff review pages, verify quotes, and release jobs.</span>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-status-success-bg text-status-success flex items-center justify-center shrink-0 mt-0.5">
              <CheckIcon size={12} />
            </div>
            <span><strong>Flexible Checkout:</strong> Cash on collection is enabled by default, or shop owners can connect Razorpay checkout for UPI and online payments.</span>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-ink-border dark:border-ink-dark-border text-xs text-ink-text-muted dark:text-ink-dark-text-muted">
          Note: WhatsApp Business API integration will be made available as an optional add-on module following official Meta Cloud API compliance verification.
        </div>
      </div>

      <RelatedLinks
        heading="Explore More Solutions"
        links={[
          { label: 'Print Shop Automation Software', href: '/print-shop-automation-software' },
          { label: 'QR Code Printing System', href: '/qr-code-printing-system' },
          { label: 'Pricing & Plans', href: '/pricing' },
        ]}
        onNavigate={onNavigate}
      />
    </section>
  </main>
);
