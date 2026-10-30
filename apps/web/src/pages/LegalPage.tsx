import React, { useState } from 'react';

interface LegalPageProps {
  initialTab?: 'privacy' | 'terms' | 'refund' | 'delivery';
  onNavigate: (path: string) => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({ initialTab = 'privacy', onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'refund' | 'delivery'>(initialTab);

  return (
    <div className="flex flex-col min-h-screen bg-ink-app dark:bg-ink-dark-app text-ink-text dark:text-ink-dark-text py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-border dark:border-ink-dark-border pb-4 mb-8">
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-brand text-white shadow-xs'
                : 'bg-ink-surface dark:bg-ink-dark-surface border border-ink-border dark:border-ink-dark-border text-ink-text-secondary dark:text-ink-dark-text-secondary hover:text-ink-text dark:hover:text-ink-dark-text'
            }`}
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'terms'
                ? 'bg-brand text-white shadow-xs'
                : 'bg-ink-surface dark:bg-ink-dark-surface border border-ink-border dark:border-ink-dark-border text-ink-text-secondary dark:text-ink-dark-text-secondary hover:text-ink-text dark:hover:text-ink-dark-text'
            }`}
          >
            Terms of Service
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('refund')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'refund'
                ? 'bg-brand text-white shadow-xs'
                : 'bg-ink-surface dark:bg-ink-dark-surface border border-ink-border dark:border-ink-dark-border text-ink-text-secondary dark:text-ink-dark-text-secondary hover:text-ink-text dark:hover:text-ink-dark-text'
            }`}
          >
            Refund Policy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('delivery')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'delivery'
                ? 'bg-brand text-white shadow-xs'
                : 'bg-ink-surface dark:bg-ink-dark-surface border border-ink-border dark:border-ink-dark-border text-ink-text-secondary dark:text-ink-dark-text-secondary hover:text-ink-text dark:hover:text-ink-dark-text'
            }`}
          >
            Delivery Policy
          </button>
        </div>

        {/* Content Card */}
        <div className="bg-ink-surface dark:bg-ink-dark-surface border border-ink-border dark:border-ink-dark-border rounded-3xl p-8 sm:p-12 shadow-sm text-sm text-ink-text dark:text-ink-dark-text leading-relaxed">
          {activeTab === 'privacy' && (
            <div>
              <h1 className="text-2xl font-bold mb-4">Privacy Policy</h1>
              <p className="text-xs text-ink-text-muted dark:text-ink-dark-text-muted mb-6">Last updated: October 2026</p>

              <h3 className="text-base font-semibold mb-2">1. Information We Collect</h3>
              <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary mb-4 leading-relaxed">
                The platform collects merchant account details, shop profile information, order details, and print workflow data. Shops may also enter Razorpay API credentials in settings; these credentials are encrypted by the server and are not returned to the browser after saving. Customer files are used solely for the requested print workflow.
              </p>

              <h3 className="text-base font-semibold mb-2">2. Ephemeral Document Retention & Shredding</h3>
              <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary mb-4 leading-relaxed">
                Customer print files are scheduled for automatic deletion 24 hours after an order is marked as completed or cancelled. Customer files are stored in private storage buckets with pre-signed ephemeral URLs only accessible to authorized shop agents.
              </p>

              <h3 className="text-base font-semibold mb-2">3. Security Standards</h3>
              <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary mb-4 leading-relaxed">
                All transit data is protected with TLS 1.3 encryption. Tenant isolation is enforced cryptographically and relationally through strict shop boundaries, scoped authentication tokens, and append-only audit ledgers.
              </p>
            </div>
          )}

          {activeTab === 'terms' && (
            <div>
              <h1 className="text-2xl font-bold mb-4">Terms of Service</h1>
              <p className="text-xs text-ink-text-muted dark:text-ink-dark-text-muted mb-6">Last updated: October 2026</p>

              <h3 className="text-base font-semibold mb-2">1. Acceptance of Terms</h3>
              <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary mb-4 leading-relaxed">
                By registering an Inklly account or using the self-service print ordering portal, you agree to comply with and be bound by these Terms of Service.
              </p>

              <h3 className="text-base font-semibold mb-2">2. Service Scope</h3>
              <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary mb-4 leading-relaxed">
                Inklly provides software enabling print shops to accept, price, manage, and dispatch print jobs. Merchants maintain complete ownership of their physical printers, paper stock, ink supplies, and counter customer relations.
              </p>

              <h3 className="text-base font-semibold mb-2">3. Platform Fees & Subscriptions</h3>
              <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary mb-4 leading-relaxed">
                Subscriptions are billed on a recurring monthly, annual, or one-time lifetime basis as selected during registration. Zero per-order transaction fees are levied on standard print jobs.
              </p>
            </div>
          )}

          {activeTab === 'refund' && (
            <div>
              <h1 className="text-2xl font-bold mb-4">Refund Policy</h1>
              <p className="text-xs text-ink-text-muted dark:text-ink-dark-text-muted mb-6">Last updated: October 2026</p>

              <h3 className="text-base font-semibold mb-2">1. Merchant Subscriptions</h3>
              <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary mb-4 leading-relaxed">
                Growth plan trials include 7 days of full feature access with no payment obligation. If you cancel during the trial, you will not be charged. Paid subscriptions may be cancelled at any time before the next billing cycle.
              </p>

              <h3 className="text-base font-semibold mb-2">2. Customer Print Orders</h3>
              <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary mb-4 leading-relaxed">
                If a print order fails due to local hardware jam or unreadable output, the merchant may re-spool the job or issue a cash or online refund through their merchant console.
              </p>
            </div>
          )}

          {activeTab === 'delivery' && (
            <div>
              <h1 className="text-2xl font-bold mb-4">Delivery Policy</h1>
              <p className="text-xs text-ink-text-muted dark:text-ink-dark-text-muted mb-6">Last updated: October 2026</p>

              <h3 className="text-base font-semibold mb-2">1. Local Counter Pickup</h3>
              <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary mb-4 leading-relaxed">
                All printed documents are delivered via self-service or staffed counter pickup at the specific physical shop location where the customer placed the order.
              </p>

              <h3 className="text-base font-semibold mb-2">2. Pickup Verification</h3>
              <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary mb-4 leading-relaxed">
                Customers present their digital Pickup Token (generated on their order tracker page) to the counter operator to collect their completed documents.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
