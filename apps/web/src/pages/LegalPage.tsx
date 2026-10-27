import React, { useState } from 'react';

interface LegalPageProps {
  initialTab?: 'privacy' | 'terms' | 'refund' | 'delivery';
  onNavigate: (path: string) => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({ initialTab = 'privacy', onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'refund' | 'delivery'>(initialTab);

  return (
    <div className="flex flex-col min-h-screen bg-[#FBFCFE] py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E6E9F2] pb-4 mb-8">
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-[#4D64E6] text-white shadow-xs'
                : 'bg-white border border-[#E6E9F2] text-[#5B6475] hover:text-[#172031]'
            }`}
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'terms'
                ? 'bg-[#4D64E6] text-white shadow-xs'
                : 'bg-white border border-[#E6E9F2] text-[#5B6475] hover:text-[#172031]'
            }`}
          >
            Terms of Service
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('refund')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'refund'
                ? 'bg-[#4D64E6] text-white shadow-xs'
                : 'bg-white border border-[#E6E9F2] text-[#5B6475] hover:text-[#172031]'
            }`}
          >
            Refund Policy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('delivery')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'delivery'
                ? 'bg-[#4D64E6] text-white shadow-xs'
                : 'bg-white border border-[#E6E9F2] text-[#5B6475] hover:text-[#172031]'
            }`}
          >
            Delivery Policy
          </button>
        </div>

        {/* Content Card */}
        <div className="bg-white border border-[#E6E9F2] rounded-3xl p-8 sm:p-12 shadow-sm text-sm text-[#172031] leading-relaxed">
          {activeTab === 'privacy' && (
            <div>
              <h1 className="text-2xl font-extrabold mb-4">Privacy Policy</h1>
              <p className="text-xs text-[#5B6475] mb-6">Last updated: October 2026</p>

              <h3 className="text-base font-bold mb-2">1. Information We Collect</h3>
              <p className="text-xs text-[#5B6475] mb-4">
                The preview collects merchant account details, shop profile information, order details, and print workflow data. Shops may also enter Razorpay API credentials in settings; these credentials are encrypted by the server and are not returned to the browser after saving. Customer files are used for the requested print workflow.
              </p>

              <h3 className="text-base font-bold mb-2">2. Ephemeral Document Retention & Shredding</h3>
              <p className="text-xs text-[#5B6475] mb-4">
                The 24-hour deletion period after order completion is the planned retention policy, but automated deletion and private file storage are not yet deployed in this preview. Use test documents only and do not upload sensitive files. We do not currently offer WhatsApp document intake.
              </p>

              <h3 className="text-base font-bold mb-2">3. Security Standards</h3>
              <p className="text-xs text-[#5B6475] mb-4">
                Production security controls are still being implemented. Use the hosted preview only with test data; do not use it for sensitive documents or live payment processing.
              </p>

              <h3 className="text-base font-bold mb-2">4. Contact Information</h3>
              <p className="text-xs text-[#5B6475]">
                For privacy compliance inquiries, contact our Data Protection Officer at privacy@inklly.in.
              </p>
            </div>
          )}

          {activeTab === 'terms' && (
            <div>
              <h1 className="text-2xl font-extrabold mb-4">Terms of Service</h1>
              <p className="text-xs text-[#5B6475] mb-6">Last updated: October 2026</p>

              <h3 className="text-base font-bold mb-2">1. Use of Service</h3>
              <p className="text-xs text-[#5B6475] mb-4">
                Inklly provides software tools to facilitate counter and self-service print ordering. Merchants agree not to use the platform for unlawful duplication, copyright infringement, or dissemination of prohibited content.
              </p>

              <h3 className="text-base font-bold mb-2">2. Merchant Responsibilities</h3>
              <p className="text-xs text-[#5B6475] mb-4">
                Merchants are responsible for maintaining their local printer hardware, paper stock, ink/toner cartridges, and physical security. Inklly does not warrant that physical printer hardware will remain jam-free or free from mechanical defects.
              </p>

              <h3 className="text-base font-bold mb-2">3. Subscription & Termination</h3>
              <p className="text-xs text-[#5B6475] mb-4">
                Subscriptions renew on a monthly or annual basis. You may cancel at any time through your dashboard. Termination takes effect at the conclusion of the current prepaid billing period.
              </p>
            </div>
          )}

          {activeTab === 'refund' && (
            <div>
              <h1 className="text-2xl font-extrabold mb-4">Refund Policy</h1>
              <p className="text-xs text-[#5B6475] mb-6">Last updated: October 2026</p>

              <h3 className="text-base font-bold mb-2">1. SaaS Subscriptions</h3>
              <p className="text-xs text-[#5B6475] mb-4">
                We offer a full 7-day risk-free trial on our Growth plan. If you are dissatisfied with our software within 14 days of your initial paid subscription charge, contact support@inklly.in for a full, hassle-free refund.
              </p>

              <h3 className="text-base font-bold mb-2">2. Failed Customer Print Jobs</h3>
              <p className="text-xs text-[#5B6475] mb-4">
                If an end-customer pays via dynamic UPI but their pages fail to print due to a mechanical jam or printer power interruption (flagged as OUTPUT_UNCERTAIN or FAILED), the shop operator can either reprint the pages at zero cost or issue an instant UPI refund through the merchant operating queue.
              </p>
            </div>
          )}

          {activeTab === 'delivery' && (
            <div>
              <h1 className="text-2xl font-extrabold mb-4">Delivery Policy</h1>
              <p className="text-xs text-[#5B6475] mb-6">Last updated: October 2026</p>

              <h3 className="text-base font-bold mb-2">1. Digital SaaS Delivery</h3>
              <p className="text-xs text-[#5B6475] mb-4">
                Access to the web preview is provided after account creation. Some screens and integrations are prototypes and are not available as production services.
              </p>

              <h3 className="text-base font-bold mb-2">2. Physical products and customer delivery</h3>
              <p className="text-xs text-[#5B6475] mb-4">
                The current preview does not sell kiosk hardware or standees and does not arrange delivery of printed orders. Print pickup and payment are handled by the participating shop.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
