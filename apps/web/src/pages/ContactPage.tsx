import React from 'react';
import { EnquiryForm } from '../components/EnquiryForm';
import { RelatedLinks } from '../components/RelatedLinks';
import {
  MapPinIcon,
  WhatsAppIcon,
  MailIcon,
  LifebuoyIcon,
  ArrowRightIcon,
} from '../components/icons';

interface ContactPageProps {
  onNavigate: (path: string) => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({ onNavigate }) => {
  return (
    <div className="flex flex-col min-h-screen bg-ink-app dark:bg-ink-dark-app text-ink-text dark:text-ink-dark-text">
      {/* ─────────────────────────────────────────────────────────────
          HERO & CONTACT CARD
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="bg-ink-surface dark:bg-ink-dark-surface border border-ink-border dark:border-ink-dark-border rounded-3xl shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column: Solid Indigo Card */}
          <div className="lg:col-span-5 bg-brand text-white p-8 md:p-12 flex flex-col justify-between">
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider text-blue-200 mb-2 block">
                CONTACT INKLLY
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight mb-4 text-white">
                Get in touch with our team
              </h1>
              <p className="text-sm text-blue-100 leading-relaxed mb-8">
                Whether you run a single photocopy counter, manage a high-volume campus shop, or oversee multiple branches, Inklly is built to automate your operations.
              </p>

              {/* Contact Info List */}
              <div className="space-y-6 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPinIcon size={16} />
                  </div>
                  <div>
                    <span className="font-bold block text-white">Headquarters</span>
                    <span className="text-blue-100 text-xs">Pune, Maharashtra, India</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
                    <WhatsAppIcon size={16} />
                  </div>
                  <div>
                    <span className="font-bold block text-white">Direct WhatsApp / Phone</span>
                    <a
                      href="https://wa.me/918999829418"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-100 text-xs hover:underline block"
                    >
                      +91 89998 29418
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
                    <MailIcon size={16} />
                  </div>
                  <div>
                    <span className="font-bold block text-white">Email Address</span>
                    <a
                      href="mailto:support@inklly.in"
                      className="text-blue-100 text-xs hover:underline block"
                    >
                      support@inklly.in
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
                    <LifebuoyIcon size={16} />
                  </div>
                  <div>
                    <span className="font-bold block text-white">Merchant Support Hours</span>
                    <span className="text-blue-100 text-xs">Monday – Saturday: 9:00 AM – 8:00 PM IST</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/15 text-xs text-blue-200">
              ⚡ Typical response time on WhatsApp: under 15 minutes.
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="lg:col-span-7 p-8 md:p-12 bg-ink-surface dark:bg-ink-dark-surface flex flex-col justify-center">
            <h2 className="text-2xl font-bold text-ink-text dark:text-ink-dark-text mb-2 tracking-tight">
              Send us a message
            </h2>
            <p className="text-xs sm:text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary mb-8">
              Fill in your details and our team will get in touch directly via call or WhatsApp.
            </p>
            <EnquiryForm variant="B" />
          </div>
        </div>

        {/* Support Sub-Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="bg-ink-surface dark:bg-ink-dark-surface border border-ink-border dark:border-ink-dark-border rounded-2xl p-6 shadow-xs">
            <h4 className="font-bold text-sm text-ink-text dark:text-ink-dark-text mb-1">Existing Merchant Support</h4>
            <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary mb-3">Trouble with printer spooling, edge agent or queue?</p>
            <a
              href="https://wa.me/918999829418?text=Hi%20Inklly%20Support,%20I%20need%20help%20with%20my%20printer%20agent"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-brand dark:text-brand-dark hover:underline inline-flex items-center gap-1"
            >
              <span>Open support chat</span>
              <ArrowRightIcon size={12} />
            </a>
          </div>

          <div className="bg-ink-surface dark:bg-ink-dark-surface border border-ink-border dark:border-ink-dark-border rounded-2xl p-6 shadow-xs">
            <h4 className="font-bold text-sm text-ink-text dark:text-ink-dark-text mb-1">Campus & Fleet Automation</h4>
            <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary mb-3">Countertop QR rollouts for college bookstores and hubs.</p>
            <button
              type="button"
              onClick={() => onNavigate('/p/campus1')}
              className="text-xs font-semibold text-brand dark:text-brand-dark hover:underline text-left cursor-pointer inline-flex items-center gap-1"
            >
              <span>Try customer demo portal</span>
              <ArrowRightIcon size={12} />
            </button>
          </div>

          <div className="bg-ink-surface dark:bg-ink-dark-surface border border-ink-border dark:border-ink-dark-border rounded-2xl p-6 shadow-xs">
            <h4 className="font-bold text-sm text-ink-text dark:text-ink-dark-text mb-1">Developer API & Integration</h4>
            <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary mb-3">Integrate Inklly spooling engine into your ERP or apps.</p>
            <button
              type="button"
              onClick={() => onNavigate('/developer')}
              className="text-xs font-semibold text-brand dark:text-brand-dark hover:underline text-left cursor-pointer inline-flex items-center gap-1"
            >
              <span>View API documentation</span>
              <ArrowRightIcon size={12} />
            </button>
          </div>
        </div>

        <div className="mt-16">
          <RelatedLinks
            heading="Explore other pages"
            links={[
              { label: 'View Pricing & Plans', href: '/pricing' },
              { label: 'How It Works', href: '/how-it-works' },
              { label: 'Print Shop Automation', href: '/print-shop-automation-software' },
            ]}
            onNavigate={onNavigate}
          />
        </div>
      </section>
    </div>
  );
};
