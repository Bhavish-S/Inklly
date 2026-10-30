import React from 'react';
import { PrinterIcon, CheckIcon, ShieldIcon, ArrowRightIcon } from '../components/icons';
import { RelatedLinks } from '../components/RelatedLinks';

interface PrintAutomationPageProps {
  onNavigate: (path: string) => void;
}

export const PrintAutomationPage: React.FC<PrintAutomationPageProps> = ({ onNavigate }) => (
  <main className="min-h-screen bg-ink-app dark:bg-ink-dark-app text-ink-text dark:text-ink-dark-text">
    {/* Hero Section */}
    <section className="relative overflow-hidden py-20 md:py-28 text-center text-white" style={{ background: 'linear-gradient(135deg, #0D1422 0%, #172033 50%, #19263A 100%)' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-[#8293FF] text-xs font-semibold tracking-wider mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-status-teal animate-pulse" />
          <span>PRINT SHOP AUTOMATION SOFTWARE</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-6 text-white">
          Review print requests before they reach the counter printer.
        </h1>

        <p className="text-base sm:text-lg text-[#A6B2C5] max-w-2xl mx-auto mb-8 leading-relaxed">
          Inklly connects your self-service customer queue with a local Windows print agent. Your team retains full control over approval, pricing verification, and print release.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <button
            type="button"
            onClick={() => onNavigate('/register')}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-sm shadow-brand transition-all duration-200 cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <span>Create a shop account</span>
            <ArrowRightIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/p/campus1')}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.15] text-white font-medium text-sm transition-all duration-200 cursor-pointer"
          >
            Explore Customer Demo
          </button>
        </div>
      </div>
    </section>

    {/* Feature Narrative Grid */}
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="rounded-2xl border border-ink-border dark:border-ink-dark-border bg-ink-surface dark:bg-ink-dark-surface p-7 sm:p-8 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-brand-soft dark:bg-brand-dark-soft text-brand dark:text-brand-dark flex items-center justify-center mb-5">
            <ShieldIcon size={20} />
          </div>
          <h2 className="text-xl font-bold text-ink-text dark:text-ink-dark-text mb-2">Merchant Counter Review</h2>
          <p className="text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary leading-relaxed mb-4">
            Staff can inspect document pages, customer configuration (B&W vs color, simplex vs duplex, orientation, paper size), and verified integer-Paise quotes before dispatching jobs to local hardware.
          </p>
          <div className="space-y-2 text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">
            <div className="flex items-center gap-2"><CheckIcon size={13} className="text-status-success" /> Live queue filtering & fast status changes</div>
            <div className="flex items-center gap-2"><CheckIcon size={13} className="text-status-success" /> Rejection with customer reason notes</div>
            <div className="flex items-center gap-2"><CheckIcon size={13} className="text-status-success" /> Cash-on-collection reconciliation</div>
          </div>
        </div>

        <div className="rounded-2xl border border-ink-border dark:border-ink-dark-border bg-ink-surface dark:bg-ink-dark-surface p-7 sm:p-8 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-status-teal-bg dark:bg-status-dark-teal-bg text-status-teal dark:text-status-dark-teal flex items-center justify-center mb-5">
            <PrinterIcon size={20} />
          </div>
          <h2 className="text-xl font-bold text-ink-text dark:text-ink-dark-text mb-2">Windows Spooler Agent</h2>
          <p className="text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary leading-relaxed mb-4">
            A native Windows background agent polls assigned print jobs, downloads files over private authenticated storage, and dispatches them directly to the operating system print spooler.
          </p>
          <div className="space-y-2 text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">
            <div className="flex items-center gap-2"><CheckIcon size={13} className="text-status-success" /> Local heartbeat & queue inventory discovery</div>
            <div className="flex items-center gap-2"><CheckIcon size={13} className="text-status-success" /> Hardware-safe OUTPUT_UNCERTAIN error handling</div>
            <div className="flex items-center gap-2"><CheckIcon size={13} className="text-status-success" /> Zero customer access to counter printers</div>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <RelatedLinks
          heading="Explore Related Operations"
          links={[
            { label: 'QR Code Printing System', href: '/qr-code-printing-system' },
            { label: 'How Inklly Works', href: '/how-it-works' },
            { label: 'Subscription Pricing Plans', href: '/pricing' },
          ]}
          onNavigate={onNavigate}
        />
      </div>
    </section>
  </main>
);
