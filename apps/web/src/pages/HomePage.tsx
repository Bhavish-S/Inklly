import React from 'react';
import { PhoneMockup } from '../components/PhoneMockup';
import { BlueTile } from '../components/BlueTile';
import { StatTile } from '../components/StatTile';
import { StepPhoneCard } from '../components/StepPhoneCard';
import { PrinterLogoCarousel } from '../components/PrinterLogoCarousel';
import { DeliveryCycler } from '../components/DeliveryCycler';
import { Accordion, AccordionItemData } from '../components/Accordion';
import { EnquiryForm } from '../components/EnquiryForm';
import {
  QrCodeIcon,
  WhatsAppIcon,
  PrinterIcon,
  MonitorIcon,
  SlidersIcon,
  StoreIcon,
  CheckIcon,
  MapPinIcon,
  UsersIcon,
  LifebuoyIcon,
} from '../components/icons';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const homeFaqs: AccordionItemData[] = [
    {
      question: 'Do my customers need to download an application to print?',
      answer:
        'No, absolutely not. Customers simply scan the QR standee on your shop counter using their phone camera or Google Lens, or send their document to your dedicated WhatsApp bot number. The web portal loads instantly in under 2 seconds without requiring any app install.',
    },
    {
      question: 'Will Inklly work with my existing printers and computers?',
      answer:
        'Yes. Inklly supports all Windows 10/11 PCs and connects seamlessly to any printer installed via USB, LAN network, or Wi-Fi. Our lightweight Edge Agent (under 15MB) discovers your existing Windows printer drivers automatically with zero hardware upgrades.',
    },
    {
      question: 'How do customers pay, and when do I receive the money?',
      answer:
        'Customers can pay via dynamic instant UPI (GPay, PhonePe, Paytm, BHIM) where funds settle directly into your merchant bank account, or choose "Pay Cash at Counter" before the document is released. You retain 100% control over collection.',
    },
    {
      question: 'Can I set custom pricing for single-sided, back-to-back, and color prints?',
      answer:
        'Yes. You have complete granular control over page rate slabs. Configure distinct prices for B&W vs Colour, Single-sided vs Duplex, A4 vs A3, Photo Glossy sheets, and volume discounts (e.g. 100+ pages at discounted rate).',
    },
    {
      question: 'What happens if a printer runs out of paper or jams mid-job?',
      answer:
        'Our smart agent features Hardware-Safe Spooling. If a jam or offline status is detected, the job is flagged as "OUTPUT_UNCERTAIN" to prevent blind double-charging and paper wastage. The merchant can reprint selected pages with a single click from the queue.',
    },
    {
      question: 'How does Inklly handle document security and customer privacy?',
      answer:
        'Inklly enforces private, short-lived storage with zero public URLs. Uploads are encrypted in transit, dispatched directly to your local printer spooler, and purged according to your shop retention policy to guarantee complete privacy.',
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
                Modern Print Shop Automation & Self-Service Document OS
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[54px] font-extrabold tracking-tight leading-[1.12] mb-6">
                Print automation, WhatsApp ordering & countertop QR for{' '}
                <span className="text-[#A9B6FF]">modern print shops.</span>
              </h1>

              {/* Subhead */}
              <p className="text-base sm:text-lg text-gray-300 max-w-2xl mx-auto lg:mx-0 mb-8 leading-relaxed font-normal">
                Stop managing USB drives, WhatsApp chaos and manual print calculations. Let customers upload via QR or WhatsApp, pay instantly via UPI or cash, and auto-route jobs directly to your counter printers.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-8">
                <button
                  type="button"
                  onClick={() => onNavigate('/register')}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#4D64E6] hover:bg-[#3F54D1] text-white font-bold text-sm sm:text-base shadow-lg shadow-[#4D64E6]/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  Get started free →
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/p/campus1')}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm sm:text-base transition-all cursor-pointer"
                >
                  Try Customer QR Demo
                </button>
              </div>

              {/* Proof / Value Chips */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-xs text-gray-300">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#1F8A4C] font-bold">✓</span> Zero app download required
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[#1F8A4C] font-bold">✓</span> Works with existing printers
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[#1F8A4C] font-bold">✓</span> Instant UPI & Cash collection
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
              Complete Feature Suite
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#172031] tracking-tight">
              Everything your print business needs to run smoothly
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <BlueTile
              icon={<QrCodeIcon size={22} />}
              title="Self-service QR ordering"
              description="Customers scan counter QR standees and configure their print jobs instantly."
              onClick={() => onNavigate('/qr-code-printing-system')}
            />
            <BlueTile
              icon={<WhatsAppIcon size={22} />}
              title="WhatsApp bot intake"
              description="Automated document processing, page counting and instant UPI quotes via WhatsApp."
              onClick={() => onNavigate('/whatsapp-printing-software')}
            />
            <BlueTile
              icon={<PrinterIcon size={22} />}
              title="Smart print spooler"
              description="Zero-click auto-spooling directly to your USB and network printers."
              onClick={() => onNavigate('/print-shop-automation-software')}
            />
            <BlueTile
              icon={<MonitorIcon size={22} />}
              title="Live queue display"
              description="Real-time order statuses, token callouts, and customer tracking boards."
              onClick={() => onNavigate('/how-it-works')}
            />
            <BlueTile
              icon={<SlidersIcon size={22} />}
              title="Automated accounting & ledger"
              description="Tamper-proof financial ledgers, operator shifts, and daily reconciliation reports."
              onClick={() => onNavigate('/pricing')}
            />
            <BlueTile
              icon={<StoreIcon size={22} />}
              title="Countertop QR standees & studio"
              description="Branded countertop standees with built-in cropping, page selection and instant quotes."
              onClick={() => onNavigate('/qr-code-printing-system')}
            />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: STAT TILES (Section 3)
      ───────────────────────────────────────────────────────────── */}
      <section className="py-12 bg-white border-y border-[#E6E9F2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <StatTile
              icon={<MapPinIcon size={20} />}
              stat="10+"
              label="States with active Inklly partner print shops"
            />
            <StatTile
              icon={<UsersIcon size={20} />}
              stat="15+"
              label="University & education hubs automated"
            />
            <StatTile
              icon={<StoreIcon size={20} />}
              stat="2,500+"
              label="Daily student & professional print orders"
            />
            <StatTile
              icon={<PrinterIcon size={20} />}
              stat="800+"
              label="Supported printer models and drivers"
            />
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
              Zero friction from upload to printed paper
            </h2>
            <p className="text-sm text-[#5B6475] mt-2">
              How students and office professionals print in under 30 seconds without standing in queues.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StepPhoneCard
              stepNumber={1}
              title="Scan QR or WhatsApp"
              description="Customer scans shop counter QR or sends PDF to your WhatsApp number."
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
              title="Pay via UPI or Cash"
              description="Instant QR payment with zero transaction disputes and instant receipts."
              price="₹36.00"
            />
            <StepPhoneCard
              stepNumber={4}
              title="Collect printed sheets"
              description="Order auto-prints on the designated tray and notifies the customer."
              price="₹36.00"
            />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 5: UNIVERSAL PRINTER COMPATIBILITY (Logo Strip)
      ───────────────────────────────────────────────────────────── */}
      <section className="py-12 bg-white border-b border-[#E6E9F2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <PrinterLogoCarousel />
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 6: FEATURE DEEP DIVE: WHATSAPP BOT PRINTING
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#FBFCFE]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Visual Chat Mockup */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="w-full max-w-md bg-white border border-[#E6E9F2] rounded-3xl p-6 shadow-xl">
                {/* Chat Top Bar */}
                <div className="flex items-center gap-3 pb-3 border-b border-[#E6E9F2] mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center font-bold">
                    <WhatsAppIcon size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#172031]">Inklly Print Bot</h4>
                    <span className="text-[11px] text-[#1F8A4C] font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1F8A4C]" /> Official Business Account
                    </span>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="space-y-3 text-xs">
                  {/* User Message */}
                  <div className="bg-[#E7FFDB] p-3 rounded-2xl rounded-tr-none ml-auto max-w-[85%] text-gray-800 shadow-2xs">
                    <p className="font-semibold text-gray-900 mb-1">📄 Project_Proposal.pdf (18 pages)</p>
                    <p className="text-[11px] text-gray-600">Please print 1 copy, double-sided B&W.</p>
                    <span className="text-[9px] text-gray-400 block text-right mt-1">11:02 AM ✓✓</span>
                  </div>

                  {/* Bot Response */}
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 rounded-2xl rounded-tl-none max-w-[90%] text-gray-800 shadow-2xs">
                    <p className="font-bold text-[#172031] mb-1">Print Estimate Calculated:</p>
                    <ul className="text-[11px] text-[#5B6475] space-y-0.5 mb-2">
                      <li>• Document: 18 pages (9 sheets duplex)</li>
                      <li>• Mode: B&W @ ₹2.00/sheet</li>
                      <li>• Total Amount: <span className="font-bold text-[#172031]">₹18.00</span></li>
                    </ul>
                    <div className="p-2 bg-white rounded-lg border border-dashed border-[#4D64E6] flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#4D64E6]">Pay via UPI: ₹18.00</span>
                      <span className="text-[10px] font-semibold bg-[#4D64E6] text-white px-2 py-0.5 rounded">
                        Tap to Pay
                      </span>
                    </div>
                  </div>

                  {/* User Payment Confirmed */}
                  <div className="bg-[#EAFBF0] border border-[#1F8A4C]/30 p-2.5 rounded-xl text-center text-[#1F8A4C] font-bold text-[11px]">
                    ✓ Payment Verified! Spooling on Tray 2 (Token #42)
                  </div>
                </div>
              </div>
            </div>

            {/* Content Details */}
            <div className="lg:col-span-6">
              <span className="text-xs uppercase font-extrabold tracking-wider text-[#25D366] mb-2 block">
                Instant Messaging Workflow
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#172031] tracking-tight mb-4">
                Let customers print directly through WhatsApp
              </h2>
              <p className="text-sm sm:text-base text-[#5B6475] leading-relaxed mb-6">
                No more downloading files from individual personal WhatsApp chats or copying viruses via USB sticks. Our dedicated WhatsApp bot answers customer messages, extracts PDF page counts, calculates exact prices, and collects payments 24/7.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#EAFBF0] text-[#1F8A4C] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckIcon size={12} />
                  </div>
                  <span className="text-sm text-[#172031]">
                    <strong>Instant Page Counting:</strong> Reads PDF and DOCX files to give instantaneous price breakdowns.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#EAFBF0] text-[#1F8A4C] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckIcon size={12} />
                  </div>
                  <span className="text-sm text-[#172031]">
                    <strong>Dynamic UPI QR Links:</strong> Integrated automated payment confirmation with zero merchant intervention.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#EAFBF0] text-[#1F8A4C] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckIcon size={12} />
                  </div>
                  <span className="text-sm text-[#172031]">
                    <strong>Zero Pen-Drive Contamination:</strong> Keeps your shop counter computers safe from malware.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('/whatsapp-printing-software')}
                className="px-6 py-3 rounded-xl bg-[#25D366] hover:bg-[#20BA5A] text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <WhatsAppIcon size={16} /> Explore WhatsApp Printing Software →
              </button>
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
                Self-service QR standees that eliminate counter queues
              </h2>
              <p className="text-sm sm:text-base text-[#5B6475] leading-relaxed mb-6">
                Place our laminated QR standees on your counter or outside your shop window. Customers scan the QR code to open your branded mobile order intake portal with zero app downloads.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#EAFBF0] text-[#1F8A4C] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckIcon size={12} />
                  </div>
                  <span className="text-sm text-[#172031]">
                    <strong>Branded Store Portal:</strong> Customize your shop logo, operating hours, and banner announcements.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#EAFBF0] text-[#1F8A4C] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckIcon size={12} />
                  </div>
                  <span className="text-sm text-[#172031]">
                    <strong>Live Queue Numbers:</strong> Digital token numbers display estimated waiting time for collections.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#EAFBF0] text-[#1F8A4C] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckIcon size={12} />
                  </div>
                  <span className="text-sm text-[#172031]">
                    <strong>After-Hours Dropoff:</strong> Accept night-time student orders for morning priority pickup.
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
                <h4 className="text-lg font-extrabold text-[#172031] mb-1">Campus Print Hub #1</h4>
                <p className="text-xs text-[#5B6475] mb-5">Scan to upload & print instantly</p>

                {/* QR Code Canvas Mockup */}
                <div className="p-4 bg-gray-50 rounded-2xl border-2 border-dashed border-[#CBD5E1] inline-block mb-5">
                  <div className="w-44 h-44 bg-white p-2 rounded-xl shadow-xs flex items-center justify-center">
                    <div className="w-full h-full bg-[#172031] rounded-lg flex items-center justify-center text-white font-mono text-xs p-3 text-center">
                      [QR: inklly.in/p/campus1]
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#1F8A4C] bg-[#EAFBF0] py-1.5 px-3 rounded-full">
                  <CheckIcon size={14} /> Zero App Required • Chrome & Safari
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 8: LOCAL FULFILMENT & DELIVERY WITH DELIVERY CYCLER
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6">
              <DeliveryCycler />
            </div>

            <div className="lg:col-span-6">
              <span className="text-xs uppercase font-extrabold tracking-wider text-[#4D64E6] mb-2 block">
                Local Delivery & Campus Dispatch
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#172031] tracking-tight mb-4">
                Campus delivery & hostel drop-offs that increase your volume
              </h2>
              <p className="text-sm sm:text-base text-[#5B6475] leading-relaxed mb-6">
                Expand your customer reach beyond foot traffic. Enable hostel delivery, office tower drops, and scheduled curbside pickup with automated OTP confirmation and live order status tracker.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <h4 className="font-bold text-sm text-[#172031] mb-1">Hostel Delivery</h4>
                  <p className="text-xs text-[#5B6475]">Bulk batch delivery to college hostel warden desks and common rooms.</p>
                </div>
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <h4 className="font-bold text-sm text-[#172031] mb-1">OTP Handover</h4>
                  <p className="text-xs text-[#5B6475]">Secure 4-digit code verification prevents wrong document pickup.</p>
                </div>
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
                Countertop Self-Service OS • 5-Minute Setup
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
                Automate your shop counter with Inklly QR ordering
              </h2>
              <p className="text-sm sm:text-base text-blue-100 leading-relaxed mb-6">
                Eliminate long customer queues, WhatsApp file confusion, and manual rate calculations. Customers scan your counter standee, choose settings, pay via UPI, and your printers spool automatically.
              </p>
              <div className="flex flex-wrap gap-4 text-xs font-semibold text-white/90">
                <span>✓ Works with your existing Windows PC & printers</span>
                <span>✓ Instant UPI settlement to your bank</span>
                <span>✓ Safe spooling with jam detection</span>
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
              Leave your details and our team will get back to you within 2 business hours.
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
            Join hundreds of print shops across India automating their counters, eliminating WhatsApp bottlenecks, and boosting daily revenues.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('/register')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#4D64E6] hover:bg-[#3F54D1] text-white font-bold text-sm sm:text-base shadow-lg transition-all cursor-pointer"
            >
              Get started for free →
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/pricing')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm sm:text-base transition-all cursor-pointer"
            >
              View pricing plans
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
