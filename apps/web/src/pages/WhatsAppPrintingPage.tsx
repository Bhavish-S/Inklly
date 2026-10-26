import React from 'react';
import { WorkflowCard } from '../components/WorkflowCard';
import { IncludedPanel } from '../components/IncludedPanel';
import { Accordion, AccordionItemData } from '../components/Accordion';
import { RelatedLinks } from '../components/RelatedLinks';
import {
  WhatsAppIcon,
  CheckIcon,
  ShieldIcon,
  DollarSignIcon,
  FileTextIcon,
  PrinterIcon,
} from '../components/icons';

interface WhatsAppPrintingPageProps {
  onNavigate: (path: string) => void;
}

export const WhatsAppPrintingPage: React.FC<WhatsAppPrintingPageProps> = ({ onNavigate }) => {
  const faqs: AccordionItemData[] = [
    {
      question: 'Do I have to buy a new SIM card or can I use my existing shop number?',
      answer:
        'You can use your existing shop mobile number via the official WhatsApp Business Cloud API, or connect a dedicated virtual number configured in Inklly. Your personal chats remain private while customer print orders are handled by the automated bot.',
    },
    {
      question: 'What file formats can customers send through WhatsApp?',
      answer:
        'The bot parses standard PDF documents, Word documents (.doc/.docx), PowerPoint presentations (.ppt/.pptx), and high-resolution images (.jpg, .jpeg, .png). If a customer sends a Google Drive or cloud link, the bot instructs them how to download or share the direct PDF.',
    },
    {
      question: 'How does payment collection work via WhatsApp?',
      answer:
        'Once the customer selects their print options (e.g. Duplex B&W), the bot generates a dynamic UPI Intent link and QR. When the customer completes payment in Google Pay, PhonePe, or Paytm, the payment webhook verifies the transaction instantly and routes the job to your counter printer.',
    },
    {
      question: 'Can the bot notify the customer when their prints are ready?',
      answer:
        'Yes! The moment your physical printer finishes outputting the pages, the Inklly Edge Agent notifies our cloud, and the WhatsApp bot sends an automated ping: "Your order #T-42 is ready for pickup at Counter 1".',
    },
  ];

  const includedItems = [
    {
      title: 'Official WhatsApp Business API',
      description: 'Fully compliant Meta WhatsApp Cloud API integration with verified green tick support and high messaging throughput.',
    },
    {
      title: 'Automated Multi-Format Parser',
      description: 'Instantly counts pages in PDFs, checks dimensions, and detects color pages without human operator intervention.',
    },
    {
      title: 'Interactive Choice Buttons',
      description: 'Customers choose options (B&W vs Colour, Single-sided vs Duplex) via native WhatsApp interactive buttons.',
    },
    {
      title: '100% Virus-Free Counter',
      description: 'Completely eliminate infected USB flash drives and corrupt pen drives from ever touching your counter PC.',
    },
    {
      title: 'Real-Time Pickup Notifications',
      description: 'Sends automated WhatsApp messages with token numbers and notifications the moment sheets exit the printer tray.',
    },
    {
      title: 'Spam Protection & File Size Caps',
      description: 'Protects your system with automated rate limiting, malware scanning, and customizable maximum file size thresholds.',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#FBFCFE]">
      {/* ─────────────────────────────────────────────────────────────
          HERO: WhatsApp Printing Software
      ───────────────────────────────────────────────────────────── */}
      <section className="bg-[#172031] text-white pt-16 pb-20 md:pt-20 md:pb-24 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[300px] bg-[#25D366]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <span className="inline-block px-3 py-1 bg-[#25D366]/20 text-[#25D366] rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-[#25D366]/30">
                WHATSAPP PRINTING SOFTWARE
              </span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.15] mb-6">
                Turn WhatsApp into your most productive printing counter
              </h1>
              <p className="text-sm sm:text-base md:text-lg text-gray-300 mb-8 leading-relaxed">
                Customers send files to your official WhatsApp number. The automated bot reads page counts, gives instant quotes in Paise, collects UPI payments, and sends jobs straight to your print queue.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => onNavigate('/register')}
                  className="px-7 py-3.5 bg-[#25D366] hover:bg-[#20BA5A] text-white font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-[#25D366]/30 transition-all cursor-pointer text-center"
                >
                  Connect your WhatsApp →
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/contact')}
                  className="px-7 py-3.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm sm:text-base rounded-xl transition-all cursor-pointer text-center"
                >
                  Watch WhatsApp bot demo
                </button>
              </div>
            </div>

            {/* Visual Chat Mockup */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-sm bg-white text-gray-900 rounded-3xl p-5 shadow-2xl border-4 border-[#1E2A44]">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center font-bold">
                    <WhatsAppIcon size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#172031]">Inklly Bot</h4>
                    <span className="text-[10px] text-green-600 font-semibold">Official Business Account</span>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="bg-[#E7FFDB] p-2.5 rounded-xl rounded-tr-none ml-auto max-w-[85%] text-gray-800">
                    <p className="font-semibold text-[11px]">Lab_Manual_Final.pdf</p>
                    <span className="text-[9px] text-gray-400 block text-right mt-0.5">10:45 AM ✓✓</span>
                  </div>

                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-xl rounded-tl-none max-w-[95%]">
                    <p className="font-bold text-[11px] text-[#172031]">Detected 32 pages in PDF:</p>
                    <p className="text-[10px] text-gray-600 mb-2">Select print preference below:</p>
                    <div className="grid grid-cols-2 gap-1.5 mb-2">
                      <div className="p-1.5 bg-[#4D64E6] text-white text-center rounded text-[10px] font-bold">
                        B&W Duplex (₹32)
                      </div>
                      <div className="p-1.5 bg-gray-100 text-gray-700 text-center rounded text-[10px] font-bold">
                        Colour Single (₹160)
                      </div>
                    </div>
                    <div className="p-1.5 bg-white border border-gray-200 rounded text-center text-[10px] font-bold text-green-700">
                      Tap to Pay ₹32.00 via UPI
                    </div>
                  </div>

                  <div className="bg-[#EAFBF0] p-2 rounded-lg text-center text-green-800 font-bold text-[10px] border border-green-200">
                    ✓ Paid! Spooling on Tray 1 • Token #28
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: 4 WORKFLOW CARDS
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs uppercase font-extrabold tracking-wider text-[#25D366] mb-2 block">
            End-To-End Automation
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172031] tracking-tight">
            How the WhatsApp bot works for your shop
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <WorkflowCard
            stepNumber="01"
            icon={<FileTextIcon size={22} />}
            title="Automated Intake"
            description="Customers text their document. The bot instantly parses total page count and detects orientation and color coverage."
          />
          <WorkflowCard
            stepNumber="02"
            icon={<DollarSignIcon size={22} />}
            title="Instant Quotation"
            description="Bot presents interactive buttons for B&W vs Colour and Duplex vs Single-sided with exact pricing in Paise."
          />
          <WorkflowCard
            stepNumber="03"
            icon={<CheckIcon size={22} />}
            title="Zero-Touch UPI Payment"
            description="Customer taps to pay using any UPI app. Our webhook automatically confirms payment within 1.5 seconds."
          />
          <WorkflowCard
            stepNumber="04"
            icon={<PrinterIcon size={22} />}
            title="Auto-Routed Spool"
            description="Job prints silently on your counter machine. Bot sends customer a pickup token and notification when done."
          />
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: WHAT'S INCLUDED (Dark Panel)
      ───────────────────────────────────────────────────────────── */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <IncludedPanel
          variant="dark"
          title="What's included in WhatsApp Printing Software"
          subtitle="Everything you need to automate customer conversations and payments on India's #1 messaging platform."
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
              { label: 'QR Code Printing System', href: '/qr-code-printing-system' },
              { label: 'View Pricing & Plans', href: '/pricing' },
            ]}
            onNavigate={onNavigate}
          />
        </div>
      </section>
    </div>
  );
};
