import React from 'react';
import { StepPhoneCard } from '../components/StepPhoneCard';
import { IncludedPanel } from '../components/IncludedPanel';
import { Accordion, AccordionItemData } from '../components/Accordion';
import { RelatedLinks } from '../components/RelatedLinks';
import { QrCodeIcon, WhatsAppIcon, PrinterIcon, DollarSignIcon, CheckIcon } from '../components/icons';

interface HowItWorksPageProps {
  onNavigate: (path: string) => void;
}

export const HowItWorksPage: React.FC<HowItWorksPageProps> = ({ onNavigate }) => {
  const faqs: AccordionItemData[] = [
    {
      question: 'How fast is the process from scan to print output?',
      answer:
        'For typical student print jobs (1 to 20 pages), the customer scans, pays via UPI, and the printer starts spooling in under 25 seconds total. There is zero waiting in queue for the clerk to open a computer or click through printer dialogues.',
    },
    {
      question: 'What happens if a customer sends a corrupted file?',
      answer:
        'Our intake validator inspects files before processing. If a corrupted PDF, password-protected file, or unsupported format is uploaded, the customer is immediately prompted with a clear, helpful error message asking for an unencrypted file.',
    },
    {
      question: 'Can the shop operator cancel or refund a job if paper runs out?',
      answer:
        'Yes. The merchant operating dashboard gives the operator one-click controls to pause, reprint specific pages, refund an order to customer balance or UPI, or re-route the print job to an alternate printer on the floor.',
    },
    {
      question: 'Does the customer need to stay in the shop while large documents print?',
      answer:
        'No. Each order generates a unique live tracking URL and digital token. Customers can monitor their order progress on their phone while having coffee or walking across campus, and receive a WhatsApp notification when their pages are ready for collection.',
    },
  ];

  const includedItems = [
    {
      title: 'Zero-Install Web App',
      description: 'Customers never download any app from Google Play or App Store; it runs instantly inside mobile browser.',
    },
    {
      title: 'Windows Background Daemon',
      description: 'The edge agent monitors the Windows spooler directly for hardware events and status changes without eating CPU.',
    },
    {
      title: 'Bi-Directional WebSockets',
      description: 'Live sync between customer phone, merchant terminal, and desktop spooler with sub-50ms latency.',
    },
    {
      title: 'Deterministic Pricing Logic',
      description: 'All calculations are computed in integer Paise (₹1 = 100 paise) to ensure absolute zero rounding disputes.',
    },
    {
      title: 'Operator Counter Workspace',
      description: 'Real-time order queue view with instant filters, reprint controls, manual cash marks, and token callouts.',
    },
    {
      title: 'Tamper-Proof Financial Ledger',
      description: 'Every payment, refund, and printed sheet is recorded in an immutable audit ledger for complete peace of mind.',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#FBFCFE]">
      {/* ─────────────────────────────────────────────────────────────
          HERO: How It Works
      ───────────────────────────────────────────────────────────── */}
      <section className="bg-[#172031] text-white pt-16 pb-20 md:pt-20 md:pb-24 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[300px] bg-[#4D64E6]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-3 py-1 bg-white/10 text-[#A9B6FF] rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-white/15">
            HOW IT WORKS
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.15] mb-6">
            From customer upload to printed paper in 30 seconds
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-300 max-w-2xl mx-auto mb-8 leading-relaxed">
            A clear step-by-step walkthrough of how Inklly connects customers, counter clerks, and printers without confusion, paper waste, or lost payments.
          </p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('/register')}
              className="px-7 py-3.5 bg-[#4D64E6] hover:bg-[#3F54D1] text-white font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-[#4D64E6]/30 transition-all cursor-pointer"
            >
              Start printing in 5 minutes →
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: VERTICAL NUMBERED STEPS
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="space-y-12">
          {/* Step 1 */}
          <div className="flex flex-col md:flex-row items-start gap-6 p-6 rounded-2xl bg-white border border-[#E6E9F2] shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-[#4D64E6] text-white font-mono font-extrabold text-2xl flex items-center justify-center shrink-0 shadow-md">
              01
            </div>
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider text-[#4D64E6] mb-1 block">
                STEP 1: INTAKE
              </span>
              <h3 className="text-xl font-bold text-[#172031] mb-2">
                Customer Scans QR Standee or Texts WhatsApp
              </h3>
              <p className="text-sm text-[#5B6475] leading-relaxed">
                The customer points their smartphone camera at your counter QR standee or texts your official WhatsApp number. The web portal loads in under 2 seconds without requiring any app install or account creation.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col md:flex-row items-start gap-6 p-6 rounded-2xl bg-white border border-[#E6E9F2] shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-[#4D64E6] text-white font-mono font-extrabold text-2xl flex items-center justify-center shrink-0 shadow-md">
              02
            </div>
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider text-[#4D64E6] mb-1 block">
                STEP 2: PARSING & QUOTE
              </span>
              <h3 className="text-xl font-bold text-[#172031] mb-2">
                Instant Page Geometry Parsing & Deterministic Quotation
              </h3>
              <p className="text-sm text-[#5B6475] leading-relaxed">
                Our parser reads total pages, detect duplex savings, and color coverage. The customer selects single vs double-sided, B&W vs Colour, number of copies, and sees their exact price in Paise with zero guesswork.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col md:flex-row items-start gap-6 p-6 rounded-2xl bg-white border border-[#E6E9F2] shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-[#4D64E6] text-white font-mono font-extrabold text-2xl flex items-center justify-center shrink-0 shadow-md">
              03
            </div>
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider text-[#4D64E6] mb-1 block">
                STEP 3: PAYMENT
              </span>
              <h3 className="text-xl font-bold text-[#172031] mb-2">
                Dynamic UPI Payment or Counter Cash Collection
              </h3>
              <p className="text-sm text-[#5B6475] leading-relaxed">
                The customer pays directly via GPay, PhonePe, Paytm, or BHIM. The transaction is verified in milliseconds via webhook. Alternatively, shops can enable "Pay Cash at Counter" for walk-in regulars.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex flex-col md:flex-row items-start gap-6 p-6 rounded-2xl bg-white border border-[#E6E9F2] shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-[#4D64E6] text-white font-mono font-extrabold text-2xl flex items-center justify-center shrink-0 shadow-md">
              04
            </div>
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider text-[#4D64E6] mb-1 block">
                STEP 4: ZERO-CLICK PRINT
              </span>
              <h3 className="text-xl font-bold text-[#172031] mb-2">
                Hardware-Safe Print Spooling to the Correct Printer Tray
              </h3>
              <p className="text-sm text-[#5B6475] leading-relaxed">
                The Inklly Edge Agent receives the verified job and spools it directly to the designated counter printer. Token numbers appear on the customer phone and shop TV display for pickup.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: 4 PHONE SCREEN CARDS ROW
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#F3F5FF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs uppercase font-extrabold tracking-wider text-[#4D64E6] mb-2 block">
              Customer Mobile Experience
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172031] tracking-tight">
              Intuitive mobile workflow designed for students & professionals
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StepPhoneCard
              stepNumber={1}
              title="Scan or Text"
              description="Point camera at counter acrylic standee or text WhatsApp bot."
            />
            <StepPhoneCard
              stepNumber={2}
              title="Pick Settings"
              description="Select B&W vs Colour, Duplex, copies, and review price."
            />
            <StepPhoneCard
              stepNumber={3}
              title="Pay via UPI"
              description="One-tap payment via PhonePe, Google Pay, or Paytm."
            />
            <StepPhoneCard
              stepNumber={4}
              title="Pickup Printout"
              description="Collect neatly printed sheets from the counter output tray."
            />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: WHAT'S INCLUDED (Light Panel Variant)
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <IncludedPanel
          variant="light"
          title="What's included in the Inklly platform"
          subtitle="A complete turnkey system connecting mobile ordering to your counter printers."
          items={includedItems}
        />
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 5: FAQS & RELATED
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
              { label: 'View Pricing & Plans', href: '/pricing' },
              { label: 'Explore Kiosk Franchise', href: '/franchise' },
              { label: 'Print Shop Automation Software', href: '/print-shop-automation-software' },
            ]}
            onNavigate={onNavigate}
          />
        </div>
      </section>
    </div>
  );
};
