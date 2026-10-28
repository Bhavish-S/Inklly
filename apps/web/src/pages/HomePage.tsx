import React from 'react';
import { PhoneMockup } from '../components/PhoneMockup';
import { BlueTile } from '../components/BlueTile';
import { StatTile } from '../components/StatTile';
import { StepPhoneCard } from '../components/StepPhoneCard';
import { Accordion, AccordionItemData } from '../components/Accordion';
import { EnquiryForm } from '../components/EnquiryForm';
import {
  QrCodeIcon,
  PrinterIcon,
  MonitorIcon,
  SlidersIcon,
  StoreIcon,
  CheckIcon,
} from '../components/icons';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const homeFaqs: AccordionItemData[] = [
    {
      question: 'Do my customers need to download an application to print?',
      answer:
        'No. Customers can open a shop order page in their mobile browser from a QR code. WhatsApp ordering is not available in the current product preview.',
    },
    {
      question: 'Will Inklly work with my existing printers and computers?',
      answer:
        'The desktop print agent is built for Windows and works with printers available to that computer. Printer discovery, drivers, and physical output should be confirmed on your specific setup before a shop relies on it.',
    },
    {
      question: 'How do customers pay, and when do I receive the money?',
      answer:
        'A shop can offer Razorpay checkout after its owner configures valid shop credentials and a webhook secret. Cash on collection remains available. Payment availability and settlement timing depend on the shop’s provider setup; the hosted payment flow still needs production verification.',
    },
    {
      question: 'Can I set custom pricing for single-sided, back-to-back, and color prints?',
      answer:
        'Yes. You have complete granular control over page rate slabs. Configure distinct prices for B&W vs Colour, Single-sided vs Duplex, A4 vs A3, Photo Glossy sheets, and volume discounts (e.g. 100+ pages at discounted rate).',
    },
    {
      question: 'What happens if a printer runs out of paper or jams mid-job?',
      answer:
        'The agent reports the print result it receives from the local printer workflow. It does not reliably detect every paper jam or confirm physical output, so staff should verify uncertain jobs before retrying.',
    },
    {
      question: 'How does Inklly handle document security and customer privacy?',
      answer:
        'Customer files use private storage in the application and are scheduled for deletion 24 hours after an order is completed. The live Render service is on an older backend and production bucket behavior has not been verified; use test files until deployment verification is complete.',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: HERO (Dark #172031, Dotted Grid, Pixel-Faithful)
      ───────────────────────────────────────────────────────────── */}
      <section className="relative bg-[#172031] text-white pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        {/* Subtle Background Dotted Pattern */}
        <div className="absolute inset-0 opacity-15 pointer-events-none">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="hero-dots" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="#A9B6FF" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-dots)" />
          </svg>
        </div>

        {/* Ambient Gradient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#4D64E6]/25 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Copy & Actions */}
            <div className="lg:col-span-7 text-center lg:text-left">
              {/* Eyebrow Chip */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-[#A9B6FF] text-xs font-semibold uppercase tracking-wider mb-6">
                <span className="w-2 h-2 rounded-full bg-[#4D64E6] animate-pulse" />
                Print Shop & Xerox Counter Automation
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[54px] font-extrabold tracking-tight leading-[1.12] mb-6 text-white">
                Move print orders from a{' '}
                <span className="text-[#A9B6FF]">shop QR page to your counter.</span>
              </h1>

              {/* Subhead */}
              <p className="text-base sm:text-lg text-gray-200 max-w-2xl mx-auto lg:mx-0 mb-8 leading-relaxed font-normal">
                Customers open your shop’s order page, upload a document, and choose print settings. Your team reviews each request in the merchant workspace and sends approved jobs to a Windows print agent.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-8">
                <button
                  type="button"
                  onClick={() => onNavigate('/register')}
                  className="w-full sm:w-auto min-h-[48px] px-8 py-3.5 rounded-xl bg-[#4D64E6] hover:bg-[#3B50D4] text-white font-bold text-sm sm:text-base shadow-lg shadow-[#4D64E6]/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  Create a shop account →
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/p/campus1')}
                  className="w-full sm:w-auto min-h-[48px] px-7 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm sm:text-base transition-all cursor-pointer flex items-center justify-center"
                >
                  See Customer QR Demo
                </button>
              </div>

              {/* Proof / Value Chips */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-xs text-gray-200">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">✓</span> Zero customer app download needed
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">✓</span> Staff review orders before printing
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">✓</span> Windows desktop print agent
                </div>
              </div>
            </div>

            {/* Right Column: Visual Mockup */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: 6 BLUE TILES GRID (Section 2)
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#FBFCFE]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs uppercase font-extrabold tracking-wider text-[#4D64E6] mb-2 block">
              The core workflow
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#172031] tracking-tight">
              One customer flow, connected to your shop counter
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <BlueTile
              icon={<QrCodeIcon size={22} />}
              title="Self-service QR ordering"
              description="Customers open a shop-specific order page and choose print settings."
              onClick={() => onNavigate('/qr-code-printing-system')}
            />
            <BlueTile
              icon={<SlidersIcon size={22} />}
              title="Print options and pricing"
              description="Set print options and rates for each shop’s customer order page."
              onClick={() => onNavigate('/pricing')}
            />
            <BlueTile
              icon={<PrinterIcon size={22} />}
              title="Windows print agent"
              description="Connect a Windows counter computer to the shop’s print workflow."
              onClick={() => onNavigate('/print-shop-automation-software')}
            />
            <BlueTile
              icon={<MonitorIcon size={22} />}
              title="Merchant order queue"
              description="Review submitted requests and update their order status from the shop workspace."
              onClick={() => onNavigate('/how-it-works')}
            />
            <BlueTile
              icon={<SlidersIcon size={22} />}
              title="Customer order tracking"
              description="Let customers check the status of an order after submitting it."
              onClick={() => onNavigate('/how-it-works')}
            />
            <BlueTile
              icon={<StoreIcon size={22} />}
              title="Shop-specific order page"
              description="Give customers a mobile page to upload a document and choose print settings."
              onClick={() => onNavigate('/qr-code-printing-system')}
            />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: CUSTOMER WORKFLOW
      ───────────────────────────────────────────────────────────── */}
      <section className="py-12 bg-white border-y border-[#E6E9F2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <StatTile icon={<QrCodeIcon size={20} />} stat="01" label="Customer opens the shop QR page" />
            <StatTile icon={<StoreIcon size={20} />} stat="02" label="Staff review the order" />
            <StatTile icon={<PrinterIcon size={20} />} stat="03" label="A Windows agent sends the job to print" />
            <StatTile icon={<MonitorIcon size={20} />} stat="04" label="Order status stays visible" />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: 4-STEP PROCESS (How It Works on Home)
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#F3F5FF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs uppercase font-extrabold tracking-wider text-[#4D64E6] mb-2 block">
              Simple 4-Step Flow
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#172031] tracking-tight">
              A clear path from request to pickup
            </h2>
            <p className="text-sm text-[#5B6475] mt-2">
              Customers submit a request; shop staff review it, take payment, and manage printing at the counter.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StepPhoneCard
              stepNumber={1}
              title="Open the shop page"
              description="The customer opens the shop’s order page in a mobile browser."
              fileName="Syllabus_Notes.pdf"
            />
            <StepPhoneCard
              stepNumber={2}
              title="Pick print options"
              description="Choose B&W vs Colour, Duplex, copies, and see exact total in Paise."
              fileName="Final_Project.pdf"
            />
            <StepPhoneCard
              stepNumber={3}
              title="Pay at the counter"
              description="Pay at the counter or use shop-configured Razorpay checkout when the shop has enabled it."
              price="₹36.00"
            />
            <StepPhoneCard
              stepNumber={4}
              title="Print and update status"
              description="Shop staff manage print release and update the order for customer pickup."
              price="₹36.00"
            />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 5: MERCHANT WORKFLOW
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#FBFCFE]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider text-[#4D64E6] mb-2 block">
                Merchant workspace
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#172031] tracking-tight mb-4">
                Review each request before it reaches the printer
              </h2>
              <p className="text-sm sm:text-base text-[#5B6475] leading-relaxed mb-6">
                Keep customer requests, selected print options, and order status together. Your staff can handle the counter workflow and decide when a job is ready to print.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('/login')}
                className="px-6 py-3 rounded-xl bg-[#4D64E6] hover:bg-[#3F54D1] text-white font-bold text-sm shadow-md transition-all cursor-pointer"
              >
                Open merchant sign in →
              </button>
            </div>

            <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#E6E9F2] pb-4 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#64748B]">Order queue</p>
                  <h3 className="text-lg font-bold text-[#172031]">Shop workspace</h3>
                </div>
                <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-[#4D64E6]">Staff view</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-[#E2E8F0] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-sm text-[#172031]">Document order</span>
                    <span className="rounded-full bg-[#FFF7E6] px-2.5 py-1 text-xs font-semibold text-[#9A6700]">Needs review</span>
                  </div>
                  <p className="text-xs text-[#64748B] mt-2">Review pages, copies, print settings, and the quote.</p>
                </div>
                <div className="rounded-xl border border-[#E2E8F0] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-sm text-[#172031]">Print release</span>
                    <span className="rounded-full bg-[#EAFBF0] px-2.5 py-1 text-xs font-semibold text-[#1F8A4C]">Staff controlled</span>
                  </div>
                  <p className="text-xs text-[#64748B] mt-2">Send the job to the shop’s connected Windows computer when ready.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 7: FEATURE DEEP DIVE: QR CODE ORDERING SYSTEM
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#F3F5FF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Content Details */}
            <div className="lg:col-span-6 order-2 lg:order-1">
              <span className="text-xs uppercase font-extrabold tracking-wider text-[#4D64E6] mb-2 block">
                Counter Self-Service
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#172031] tracking-tight mb-4">
                A customer order page that keeps requests organized
              </h2>
              <p className="text-sm sm:text-base text-[#5B6475] leading-relaxed mb-6">
                Share your shop’s order page or link it from a QR code. Customers can upload a document and choose print settings in their mobile browser.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#EAFBF0] text-[#1F8A4C] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckIcon size={12} />
                  </div>
                  <span className="text-sm text-[#172031]">
                    <strong>Customer upload:</strong> Collect a print request and its document through the shop page.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#EAFBF0] text-[#1F8A4C] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckIcon size={12} />
                  </div>
                  <span className="text-sm text-[#172031]">
                    <strong>Print options:</strong> Let customers choose from the options configured for the shop.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#EAFBF0] text-[#1F8A4C] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckIcon size={12} />
                  </div>
                  <span className="text-sm text-[#172031]">
                    <strong>Order status:</strong> Give customers a way to look up an order after they submit it.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('/qr-code-printing-system')}
                className="px-6 py-3 rounded-xl bg-[#4D64E6] hover:bg-[#3F54D1] text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <QrCodeIcon size={16} /> Explore QR Code Printing System →
              </button>
            </div>

            {/* Standee Visual */}
            <div className="lg:col-span-6 flex justify-center order-1 lg:order-2">
              <div className="bg-white border border-[#E6E9F2] rounded-3xl p-8 shadow-xl max-w-sm w-full text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#F3F5FF] text-[#4D64E6] flex items-center justify-center mx-auto mb-4 border border-[#E6E9F2]">
                  <QrCodeIcon size={36} />
                </div>
                  <h4 className="text-lg font-extrabold text-[#172031] mb-1">Campus Print Hub demo</h4>
                  <p className="text-xs text-[#5B6475] mb-5">Example customer order page</p>

                {/* QR Code Canvas Mockup */}
                <div className="p-4 bg-gray-50 rounded-2xl border-2 border-dashed border-[#CBD5E1] inline-block mb-5">
                  <div className="w-44 h-44 bg-white p-2 rounded-xl shadow-xs flex items-center justify-center">
                    <div className="w-full h-full bg-[#172031] rounded-lg flex flex-col items-center justify-center text-white font-mono text-xs p-3 text-center">
                      <span className="text-[#A9B6FF] uppercase tracking-widest text-[10px] mb-2">Demo link</span>
                      <span>inklly.in/p/campus1</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#1F8A4C] bg-[#EAFBF0] py-1.5 px-3 rounded-full">
                  <CheckIcon size={14} /> Opens in a mobile browser
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 8: STAFFED COUNTER WORKFLOW
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
              <span className="text-xs uppercase font-extrabold tracking-wider text-[#4D64E6] mb-2 block">
                Shop-controlled printing
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#172031] tracking-tight mb-4">
                Keep staff in control of every print job
              </h2>
              <p className="text-sm sm:text-base text-[#5B6475] leading-relaxed mb-8">
                Customers submit print requests online. Your team can review the settings, handle payment at the counter, and decide when a job is ready to send to the local printer.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <h4 className="font-bold text-sm text-[#172031] mb-1">Review the request</h4>
                  <p className="text-xs text-[#5B6475]">Check the document, print options, and quoted amount in the merchant workspace.</p>
                </div>
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <h4 className="font-bold text-sm text-[#172031] mb-1">Send when ready</h4>
                  <p className="text-xs text-[#5B6475]">Keep the print decision with staff at the counter and the connected Windows computer.</p>
                </div>
              </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 9: COUNTERTOP AUTOMATION BANNER (Royal Blue #2F5BE0)
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#1E2A44] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-[#2F5BE0] to-[#1E2A44] rounded-3xl p-8 md:p-14 shadow-2xl border border-white/10 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="max-w-2xl">
              <span className="inline-block px-3 py-1 bg-white/20 text-white rounded-full text-xs font-bold uppercase tracking-wider mb-4">
                Customer QR ordering • Merchant workspace • Windows agent
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
                Automate your shop counter with Inklly QR ordering
              </h2>
              <p className="text-sm sm:text-base text-blue-100 leading-relaxed mb-6">
                Give customers a clear way to submit print requests while your team manages the work from the counter. Payment-provider connections and automated printer confirmation are still being completed.
              </p>
              <div className="flex flex-wrap gap-4 text-xs font-semibold text-white/90">
                <span>✓ Customer order page</span>
                <span>✓ Staff-managed order queue</span>
                <span>✓ Local Windows print agent</span>
              </div>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <button
                type="button"
                onClick={() => onNavigate('/p/campus1')}
                className="px-8 py-4 rounded-xl bg-white text-[#2F5BE0] hover:bg-gray-100 font-extrabold text-sm sm:text-base shadow-lg transition-all text-center cursor-pointer"
              >
                Try Customer Demo Portal →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 10: FAQ SECTION (Accordion)
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#F3F5FF]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs uppercase font-extrabold tracking-wider text-[#4D64E6] mb-2 block">
              Frequently Asked Questions
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#172031] tracking-tight">
              Got questions? We've got answers
            </h2>
          </div>

          <Accordion items={homeFaqs} defaultOpenIndex={0} />
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 11: ENQUIRY FORM (Variant A)
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white border-t border-[#E6E9F2]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-xs uppercase font-extrabold tracking-wider text-[#4D64E6] mb-2 block">
              Get in Touch
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172031] tracking-tight mb-2">
              Have questions or want a personal demo?
            </h2>
            <p className="text-xs sm:text-sm text-[#5B6475]">
            Leave your details to request a product demo.
            </p>
          </div>

          <div className="bg-[#FBFCFE] border border-[#E6E9F2] rounded-3xl p-6 sm:p-8 shadow-sm">
            <EnquiryForm variant="A" />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 12: FINAL NAVY CALL TO ACTION BANNER
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 bg-[#172031] text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
            Ready to upgrade your print business?
          </h2>
          <p className="text-sm sm:text-base text-gray-300 max-w-xl mx-auto mb-8 font-normal">
            Explore the customer order page and merchant print workflow in the product preview.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('/register')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#4D64E6] hover:bg-[#3F54D1] text-white font-bold text-sm sm:text-base shadow-lg transition-all cursor-pointer"
            >
              Create a shop account →
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/pricing')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm sm:text-base transition-all cursor-pointer"
            >
              See pricing approach
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
