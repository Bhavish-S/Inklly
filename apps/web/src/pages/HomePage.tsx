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
  ArrowRightIcon,
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
        "A shop can offer Razorpay checkout after its owner configures valid shop credentials and a webhook secret. Cash on collection remains available. Payment availability and settlement timing depend on the shop's provider setup; the hosted payment flow still needs production verification.",
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
          SECTION 1: HERO
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0D1422 0%, #172033 50%, #19263A 100%)' }}>
        {/* Subtle Background Dotted Pattern */}
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="hero-dots" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#8293FF" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-dots)" />
          </svg>
        </div>

        {/* Ambient Gradient Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[#4D64E6]/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[250px] bg-[#20A6A8]/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Column: Copy & Actions */}
            <div className="lg:col-span-7 text-center lg:text-left">
              {/* Eyebrow Chip */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.07] border border-white/[0.12] text-[#8293FF] text-xs font-semibold tracking-wider mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8293FF] animate-pulse" />
                INTELLIGENT PRINT OPERATIONS
              </div>

              {/* Main Headline */}
              <h1 className="text-[2.25rem] sm:text-[2.75rem] md:text-[3.25rem] lg:text-[3.5rem] font-extrabold tracking-[-0.03em] leading-[1.1] mb-6 text-white">
                Your print shop.{' '}
                <span className="bg-gradient-to-r from-[#8293FF] to-[#20A6A8] bg-clip-text text-transparent">Connected. Organised. Automated.</span>
              </h1>

              {/* Subhead */}
              <p className="text-base sm:text-lg text-[#A6B2C5] max-w-2xl mx-auto lg:mx-0 mb-9 leading-relaxed">
                Give customers a simple way to submit print orders, receive clear pricing and track their jobs, while your shop manages the workflow from one connected workspace.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 mb-10">
                <button
                  type="button"
                  onClick={() => onNavigate('/register')}
                  className="w-full sm:w-auto min-h-[48px] px-7 py-3.5 rounded-xl bg-[#4D64E6] hover:bg-[#3B50D4] text-white font-semibold text-[15px] shadow-[0_4px_20px_rgba(77,100,230,0.35)] hover:shadow-[0_6px_28px_rgba(77,100,230,0.45)] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  Get started
                  <ArrowRightIcon size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/p/campus1')}
                  className="w-full sm:w-auto min-h-[48px] px-7 py-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.15] text-white font-medium text-[15px] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  Explore customer ordering
                </button>
              </div>

              {/* Proof / Value Chips */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-[13px] text-[#A6B2C5]">
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#2BD998]" />
                  <span>No app download needed</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#2BD998]" />
                  <span>Staff review before printing</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-[#2BD998]" />
                  <span>Windows desktop agent</span>
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
          SECTION 2: CORE WORKFLOW TILES
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-[var(--bg-app)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="eyebrow">
              The core workflow
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-[2.25rem] font-bold tracking-tight text-[var(--text-primary)]">
              One customer flow, connected to your shop counter
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <BlueTile
              icon={<QrCodeIcon size={22} />}
              title="Self-service QR ordering"
              description="Customers open a shop-specific order page and choose print settings."
              onClick={() => onNavigate('/qr-code-printing-system')}
            />
            <BlueTile
              icon={<SlidersIcon size={22} />}
              title="Print options and pricing"
              description="Set print options and rates for each shop's customer order page."
              onClick={() => onNavigate('/pricing')}
            />
            <BlueTile
              icon={<PrinterIcon size={22} />}
              title="Windows print agent"
              description="Connect a Windows counter computer to the shop's print workflow."
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
          SECTION 3: CUSTOMER WORKFLOW STEPS
      ───────────────────────────────────────────────────────────── */}
      <section className="py-14 bg-[var(--bg-surface)] border-y border-[var(--border-default)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <StatTile icon={<QrCodeIcon size={20} />} stat="01" label="Customer opens the shop QR page" />
            <StatTile icon={<StoreIcon size={20} />} stat="02" label="Staff review the order" />
            <StatTile icon={<PrinterIcon size={20} />} stat="03" label="A Windows agent sends the job to print" />
            <StatTile icon={<MonitorIcon size={20} />} stat="04" label="Order status stays visible" />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: 4-STEP PROCESS
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-[var(--brand-soft)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="eyebrow">
              Simple 4-Step Flow
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-[2.25rem] font-bold tracking-tight text-[var(--text-primary)]">
              A clear path from request to pickup
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-3">
              Customers submit a request; shop staff review it, take payment, and manage printing at the counter.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StepPhoneCard
              stepNumber={1}
              title="Open the shop page"
              description="The customer opens the shop's order page in a mobile browser."
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
          SECTION 5: MERCHANT WORKSPACE
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-[var(--bg-app)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <span className="eyebrow">
                Merchant workspace
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-[2.25rem] font-bold tracking-tight text-[var(--text-primary)] mb-4">
                Review each request before it reaches the printer
              </h2>
              <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed mb-8">
                Keep customer requests, selected print options, and order status together. Your staff can handle the counter workflow and decide when a job is ready to print.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('/login')}
                className="px-6 py-3 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white font-semibold text-sm shadow-brand transition-all duration-200 cursor-pointer inline-flex items-center gap-2"
              >
                Open merchant sign in
                <ArrowRightIcon size={15} />
              </button>
            </div>

            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-lg">
              <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-4 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-0.5">Order queue</p>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">Shop workspace</h3>
                </div>
                <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">Staff view</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-[var(--border-default)] p-4 hover:border-[var(--border-strong)] transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-sm text-[var(--text-primary)]">Document order</span>
                    <span className="pill-warning rounded-full px-2.5 py-1 text-xs font-semibold">Needs review</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-2">Review pages, copies, print settings, and the quote.</p>
                </div>
                <div className="rounded-xl border border-[var(--border-default)] p-4 hover:border-[var(--border-strong)] transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-sm text-[var(--text-primary)]">Print release</span>
                    <span className="pill-success rounded-full px-2.5 py-1 text-xs font-semibold">Staff controlled</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-2">Send the job to the shop's connected Windows computer when ready.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 6: QR CODE ORDERING DEEP-DIVE
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-[var(--brand-soft)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Content Details */}
            <div className="lg:col-span-6 order-2 lg:order-1">
              <span className="eyebrow">
                Counter Self-Service
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-[2.25rem] font-bold tracking-tight text-[var(--text-primary)] mb-4">
                A customer order page that keeps requests organized
              </h2>
              <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed mb-8">
                Share your shop's order page or link it from a QR code. Customers can upload a document and choose print settings in their mobile browser.
              </p>

              <div className="space-y-3.5 mb-8">
                {[
                  { bold: 'Customer upload:', text: 'Collect a print request and its document through the shop page.' },
                  { bold: 'Print options:', text: 'Let customers choose from the options configured for the shop.' },
                  { bold: 'Order status:', text: 'Give customers a way to look up an order after they submit it.' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[var(--status-success-bg)] text-[var(--status-success)] flex items-center justify-center shrink-0 mt-0.5">
                      <CheckIcon size={12} />
                    </div>
                    <span className="text-sm text-[var(--text-primary)]">
                      <strong>{item.bold}</strong> {item.text}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onNavigate('/qr-code-printing-system')}
                className="px-6 py-3 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white font-semibold text-sm shadow-brand transition-all duration-200 cursor-pointer inline-flex items-center gap-2"
              >
                <QrCodeIcon size={16} /> Explore QR Code Printing System
                <ArrowRightIcon size={14} />
              </button>
            </div>

            {/* Standee Visual */}
            <div className="lg:col-span-6 flex justify-center order-1 lg:order-2">
              <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl p-8 shadow-lg max-w-sm w-full text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center mx-auto mb-4 border border-[var(--border-selected)]">
                  <QrCodeIcon size={32} />
                </div>
                  <h4 className="text-lg font-bold text-[var(--text-primary)] mb-1">Campus Print Hub demo</h4>
                  <p className="text-xs text-[var(--text-secondary)] mb-5">Example customer order page</p>

                {/* QR Code Canvas Mockup */}
                <div className="p-4 bg-[var(--bg-surface-subtle)] rounded-2xl border-2 border-dashed border-[var(--border-strong)] inline-block mb-5">
                  <div className="w-44 h-44 bg-[var(--bg-surface)] p-2 rounded-xl shadow-sm flex items-center justify-center">
                    <div className="w-full h-full rounded-lg flex flex-col items-center justify-center font-mono text-xs p-3 text-center" style={{ background: '#0D1422', color: 'white' }}>
                      <span className="text-[#8293FF] uppercase tracking-widest text-[10px] mb-2">Demo link</span>
                      <span>inklly.in/p/campus1</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[var(--status-success)] bg-[var(--status-success-bg)] py-1.5 px-3 rounded-full">
                  <CheckIcon size={14} /> Opens in a mobile browser
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 7: STAFFED COUNTER WORKFLOW
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-[var(--bg-surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
              <span className="eyebrow">
                Shop-controlled printing
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-[2.25rem] font-bold tracking-tight text-[var(--text-primary)] mb-4">
                Keep staff in control of every print job
              </h2>
              <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed mb-10">
                Customers submit print requests online. Your team can review the settings, handle payment at the counter, and decide when a job is ready to send to the local printer.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div className="p-5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-colors">
                  <h4 className="font-semibold text-sm text-[var(--text-primary)] mb-1.5">Review the request</h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Check the document, print options, and quoted amount in the merchant workspace.</p>
                </div>
                <div className="p-5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-colors">
                  <h4 className="font-semibold text-sm text-[var(--text-primary)] mb-1.5">Send when ready</h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Keep the print decision with staff at the counter and the connected Windows computer.</p>
                </div>
              </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 8: AUTOMATION CTA BANNER
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24" style={{ background: 'linear-gradient(135deg, #0D1422 0%, #19263A 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-[#4D64E6]/20 to-transparent rounded-2xl p-8 md:p-12 border border-white/[0.08] flex flex-col lg:flex-row items-center justify-between gap-10">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/[0.08] text-[#A6B2C5] rounded-full text-xs font-medium tracking-wide mb-5">
                Customer QR ordering · Merchant workspace · Windows agent
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-[2.25rem] font-bold tracking-tight mb-4 text-white">
                Automate your shop counter with Inklly QR ordering
              </h2>
              <p className="text-[15px] text-[#A6B2C5] leading-relaxed mb-6">
                Give customers a clear way to submit print requests while your team manages the work from the counter. Payment-provider connections and automated printer confirmation are still being completed.
              </p>
              <div className="flex flex-wrap gap-5 text-[13px] font-medium text-[#A6B2C5]">
                <span className="flex items-center gap-1.5"><CheckIcon size={13} className="text-[#2BD998]" /> Customer order page</span>
                <span className="flex items-center gap-1.5"><CheckIcon size={13} className="text-[#2BD998]" /> Staff-managed order queue</span>
                <span className="flex items-center gap-1.5"><CheckIcon size={13} className="text-[#2BD998]" /> Local Windows print agent</span>
              </div>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <button
                type="button"
                onClick={() => onNavigate('/p/campus1')}
                className="px-7 py-3.5 rounded-xl bg-white text-[#172033] hover:bg-gray-50 font-semibold text-sm shadow-lg transition-all duration-200 text-center cursor-pointer inline-flex items-center justify-center gap-2"
              >
                Try Customer Demo Portal
                <ArrowRightIcon size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 9: FAQ SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-[var(--bg-app)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="eyebrow">
              Frequently Asked Questions
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-[2.25rem] font-bold tracking-tight text-[var(--text-primary)]">
              Got questions? We've got answers
            </h2>
          </div>

          <Accordion items={homeFaqs} defaultOpenIndex={0} />
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 10: ENQUIRY FORM
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-[var(--bg-surface)] border-t border-[var(--border-default)]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="eyebrow">
              Get in Touch
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-2">
              Have questions or want a personal demo?
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
            Leave your details to request a product demo.
            </p>
          </div>

          <div className="bg-[var(--bg-surface-subtle)] border border-[var(--border-default)] rounded-2xl p-6 sm:p-8 shadow-sm">
            <EnquiryForm variant="A" />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 11: FINAL CTA BANNER
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-20 text-center" style={{ background: 'linear-gradient(135deg, #0D1422 0%, #172033 100%)' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl md:text-[2.25rem] font-bold tracking-tight mb-4 text-white">
            Ready to upgrade your print business?
          </h2>
          <p className="text-[15px] text-[#A6B2C5] max-w-xl mx-auto mb-9">
            Explore the customer order page and merchant print workflow in the product preview.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              type="button"
              onClick={() => onNavigate('/register')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#4D64E6] hover:bg-[#3B50D4] text-white font-semibold text-[15px] shadow-[0_4px_20px_rgba(77,100,230,0.35)] transition-all duration-200 cursor-pointer inline-flex items-center justify-center gap-2"
            >
              Get started
              <ArrowRightIcon size={15} />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/pricing')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.15] text-white font-medium text-[15px] transition-all duration-200 cursor-pointer inline-flex items-center justify-center"
            >
              See pricing
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
