import React from 'react';
import { PhoneMockup } from '../components/PhoneMockup';
import { WorkflowCard } from '../components/WorkflowCard';
import { IncludedPanel } from '../components/IncludedPanel';
import { Accordion, AccordionItemData } from '../components/Accordion';
import { RelatedLinks } from '../components/RelatedLinks';
import {
  QrCodeIcon,
  CheckIcon,
  PrinterIcon,
  StoreIcon,
  FileTextIcon,
  DollarSignIcon,
} from '../components/icons';

interface QrOrderingPageProps {
  onNavigate: (path: string) => void;
}

export const QrOrderingPage: React.FC<QrOrderingPageProps> = ({ onNavigate }) => {
  const faqs: AccordionItemData[] = [
    {
      question: 'Do customers need to create an account or sign up to print via QR?',
      answer:
        'No signup is required for guest printing. Customers simply scan the QR code, select their file, and enter their name/mobile number for order tracking and token identification. Repeat customers can save preferences if they wish.',
    },
    {
      question: 'How do I get my physical QR standee for the counter?',
      answer:
        'Upon signing up, you can immediately download your high-resolution printable PDF acrylic standee template from your merchant dashboard. Inklly also provides customizable counter standee templates for download and printing.',
    },
    {
      question: 'Can I have multiple QR standees for different counters or floors?',
      answer:
        'Yes. You can generate distinct QR codes for Counter 1, Counter 2, Fast Track Photocopy, or Express Self-Service. Each QR routes directly to the designated physical printer and cashier queue.',
    },
    {
      question: 'Can customers upload files while walking to the shop from their college hostel?',
      answer:
        'Absolutely. Your shop has a permanent dedicated web URL (e.g. inklly.in/p/yourshop). Students can bookmark the link, upload their assignments from their hostel room, and walk in right as the pages finish printing.',
    },
  ];

  const includedItems = [
    {
      title: 'Branded Acrylic Standee Design',
      description: 'Receive print-ready vector PDF templates customized with your shop logo, shop code, and colors for your counter.',
    },
    {
      title: 'Zero App Friction Intake',
      description: 'Opens natively inside Safari, Chrome, and Google Lens on iOS and Android with sub-second page load times.',
    },
    {
      title: 'Mobile File Picker & Previews',
      description: 'Supports PDF, Word, PowerPoint, and high-res camera scans with client-side thumbnail previews before printing.',
    },
    {
      title: 'Digital Token Display Screen',
      description: 'Project a live token board onto your shop TV monitor showing "Now Printing" and "Ready for Collection" tokens.',
    },
    {
      title: 'Flexible Dual Payment Modes',
      description: 'Accept instant dynamic UPI QR payments directly to your bank, or allow trusted students to pay cash at the counter.',
    },
    {
      title: 'Multi-Station & Counter Routing',
      description: 'Deploy unique QR codes for separate counter stations, B&W photocopy areas, or color plotters with separate queues.',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#FBFCFE]">
      {/* ─────────────────────────────────────────────────────────────
          HERO: QR Code Printing System
      ───────────────────────────────────────────────────────────── */}
      <section className="bg-[#172031] text-white pt-16 pb-20 md:pt-20 md:pb-24 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[300px] bg-[#4D64E6]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <span className="inline-block px-3 py-1 bg-white/10 text-[#A9B6FF] rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-white/15">
                QR CODE PRINTING SYSTEM
              </span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.15] mb-6">
                Turn your counter standee into a 24/7 self-ordering terminal
              </h1>
              <p className="text-sm sm:text-base md:text-lg text-gray-300 mb-8 leading-relaxed">
                Customers scan your shop QR standee, open an instant mobile web portal, upload documents, select color and duplex options, and pay via UPI. No mobile app download required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => onNavigate('/register')}
                  className="px-7 py-3.5 bg-[#4D64E6] hover:bg-[#3F54D1] text-white font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-[#4D64E6]/30 transition-all cursor-pointer text-center"
                >
                  Get your free QR standee →
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/contact')}
                  className="px-7 py-3.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm sm:text-base rounded-xl transition-all cursor-pointer text-center"
                >
                  Request physical kit
                </button>
              </div>
            </div>

            {/* Standee & Phone Mockup */}
            <div className="lg:col-span-5 flex justify-center items-center gap-4">
              {/* Standee */}
              <div className="hidden sm:block w-36 bg-white text-gray-900 rounded-2xl p-4 shadow-xl border-2 border-gray-200 text-center">
                <div className="w-8 h-8 rounded-lg bg-[#4D64E6] text-white flex items-center justify-center mx-auto mb-2">
                  <QrCodeIcon size={18} />
                </div>
                <div className="text-[10px] font-bold text-gray-800 leading-tight mb-2">
                  Scan to Print
                </div>
                <div className="w-24 h-24 bg-gray-900 mx-auto rounded-lg flex items-center justify-center text-white text-[9px] font-mono p-1">
                  [QR STAND]
                </div>
                <div className="text-[8px] text-gray-500 mt-2 font-medium">
                  Zero App • UPI
                </div>
              </div>

              {/* Phone Mockup */}
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: 4 WORKFLOW CARDS
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs uppercase font-extrabold tracking-wider text-[#4D64E6] mb-2 block">
            Self-Service Journey
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172031] tracking-tight">
            How customers order in 4 effortless steps
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <WorkflowCard
            stepNumber="01"
            icon={<QrCodeIcon size={22} />}
            title="Scan QR Standee"
            description="Point any phone camera or Google Lens at the counter acrylic standee. The portal opens instantly."
          />
          <WorkflowCard
            stepNumber="02"
            icon={<FileTextIcon size={22} />}
            title="Select & Upload Files"
            description="Drag and drop or select PDFs from phone storage, WhatsApp downloads, or Google Drive."
          />
          <WorkflowCard
            stepNumber="03"
            icon={<DollarSignIcon size={22} />}
            title="Pick Options & Pay"
            description="Toggle B&W vs Colour, single vs duplex, copies, and pay directly via any installed UPI app."
          />
          <WorkflowCard
            stepNumber="04"
            icon={<PrinterIcon size={22} />}
            title="Collect at Counter"
            description="Show token number on phone screen or pick up as your sheets automatically print into the output tray."
          />
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: WHAT'S INCLUDED (Dark Panel)
      ───────────────────────────────────────────────────────────── */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <IncludedPanel
          variant="dark"
          title="What's included in QR Code Printing System"
          subtitle="Everything you need to launch contactless self-service ordering on your counter."
          items={includedItems}
        />
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: FAQS
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172031] tracking-tight">
            Frequently Asked Questions
          </h2>
        </div>
        <Accordion items={faqs} defaultOpenIndex={0} />

        {/* Section 5: Related Links */}
        <div className="mt-16">
          <RelatedLinks
            heading="Explore related solutions"
            links={[
              { label: 'Print Shop Automation Software', href: '/print-shop-automation-software' },
              { label: 'WhatsApp Printing Software', href: '/whatsapp-printing-software' },
              { label: 'View Pricing & Plans', href: '/pricing' },
            ]}
            onNavigate={onNavigate}
          />
        </div>
      </section>
    </div>
  );
};
