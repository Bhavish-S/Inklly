import React from 'react';
import { QrCodeIcon, CheckIcon, ArrowRightIcon, ShieldIcon } from '../components/icons';
import { RelatedLinks } from '../components/RelatedLinks';

interface QrOrderingPageProps {
  onNavigate: (path: string) => void;
}

export const QrOrderingPage: React.FC<QrOrderingPageProps> = ({ onNavigate }) => (
  <main className="min-h-screen bg-ink-app dark:bg-ink-dark-app text-ink-text dark:text-ink-dark-text">
    {/* Hero Section */}
    <section className="relative overflow-hidden py-20 md:py-28 text-center text-white" style={{ background: 'linear-gradient(135deg, #0D1422 0%, #172033 50%, #19263A 100%)' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-[#8293FF] text-xs font-semibold tracking-wider mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-status-teal animate-pulse" />
          <span>SELF-SERVICE COUNTER QR SYSTEM</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-6 text-white">
          A mobile shop page that streamlines student print queues.
        </h1>

        <p className="text-base sm:text-lg text-[#A6B2C5] max-w-2xl mx-auto mb-8 leading-relaxed">
          Students scan your counter QR code with any mobile camera, choose B&W or color, select copies, and see the exact price before you print a single page.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <button
            type="button"
            onClick={() => onNavigate('/p/campus1')}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-sm shadow-brand transition-all duration-200 cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <span>Open Sample QR Portal</span>
            <ArrowRightIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/register')}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.15] text-white font-medium text-sm transition-all duration-200 cursor-pointer"
          >
            Create Your Standee
          </button>
        </div>
      </div>
    </section>

    {/* Details Section */}
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <article className="rounded-2xl border border-ink-border dark:border-ink-dark-border bg-ink-surface dark:bg-ink-dark-surface p-7 sm:p-8 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-brand-soft dark:bg-brand-dark-soft text-brand dark:text-brand-dark flex items-center justify-center mb-5">
            <QrCodeIcon size={20} />
          </div>
          <h2 className="text-xl font-bold text-ink-text dark:text-ink-dark-text mb-2">Zero-App Friction</h2>
          <p className="text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary leading-relaxed mb-4">
            Runs instantly in Safari, Chrome, Samsung Internet or any mobile browser without forced account creation or native app downloads.
          </p>
          <ul className="space-y-2 text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">
            <li className="flex items-center gap-2"><CheckIcon size={13} className="text-status-success" /> Auto-detects PDF page counts via client PDF parser</li>
            <li className="flex items-center gap-2"><CheckIcon size={13} className="text-status-success" /> Interactive crop & rotation preview</li>
            <li className="flex items-center gap-2"><CheckIcon size={13} className="text-status-success" /> Live integer-Paise total calculation</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-ink-border dark:border-ink-dark-border bg-ink-surface dark:bg-ink-dark-surface p-7 sm:p-8 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-status-success-bg text-status-success flex items-center justify-center mb-5">
            <ShieldIcon size={20} />
          </div>
          <h2 className="text-xl font-bold text-ink-text dark:text-ink-dark-text mb-2">Automated Privacy & Retention</h2>
          <p className="text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary leading-relaxed mb-4">
            Customer documents are stored privately in encrypted cloud object storage and automatically scheduled for permanent deletion 24 hours after completion.
          </p>
          <ul className="space-y-2 text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary">
            <li className="flex items-center gap-2"><CheckIcon size={13} className="text-status-success" /> No public bucket access URLs</li>
            <li className="flex items-center gap-2"><CheckIcon size={13} className="text-status-success" /> Secure token-based counter pickup</li>
            <li className="flex items-center gap-2"><CheckIcon size={13} className="text-status-success" /> Automatic 24h document purging</li>
          </ul>
        </article>
      </div>

      <div className="mt-8">
        <RelatedLinks
          heading="Explore Related Topics"
          links={[
            { label: 'Print Shop Automation Software', href: '/print-shop-automation-software' },
            { label: 'How Inklly Works', href: '/how-it-works' },
            { label: 'Subscription Pricing Plans', href: '/pricing' },
          ]}
          onNavigate={onNavigate}
        />
      </div>
    </section>
  </main>
);
