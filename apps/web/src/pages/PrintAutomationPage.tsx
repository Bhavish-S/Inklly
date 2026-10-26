import React from 'react';
import { WorkflowCard } from '../components/WorkflowCard';
import { IncludedPanel } from '../components/IncludedPanel';
import { Accordion, AccordionItemData } from '../components/Accordion';
import { RelatedLinks } from '../components/RelatedLinks';
import {
  PrinterIcon,
  SlidersIcon,
  CheckIcon,
  LifebuoyIcon,
} from '../components/icons';

interface PrintAutomationPageProps {
  onNavigate: (path: string) => void;
}

export const PrintAutomationPage: React.FC<PrintAutomationPageProps> = ({ onNavigate }) => {
  const faqs: AccordionItemData[] = [
    {
      question: 'How does the Windows Edge Agent communicate with my printers?',
      answer:
        'The Inklly agent runs as a lightweight Windows daemon on your counter computer. It hooks directly into the Windows Spooler Subsystem using standard print APIs. Any printer already recognized by Windows (via USB cable, Ethernet LAN, or Wi-Fi) is automatically detected without extra drivers.',
    },
    {
      question: 'What happens if a customer uploads a large file (e.g. 200MB thesis)?',
      answer:
        'Large files are chunk-uploaded directly to secure temporary cloud storage and processed with fast server-side page counting. The agent streams the print job efficiently to the local printer without locking up your counter computer or freezing your desktop.',
    },
    {
      question: 'Can I route black & white pages to one printer and color covers to another?',
      answer:
        'Yes. Our intelligent tray and device router allows you to designate default printers by print type. For example, route monochrome text runs to your heavy-duty Ricoh/Kyocera production engine, and color photo sheets to your Epson EcoTank, with zero manual printer switching.',
    },
    {
      question: 'What if our internet connection disconnects during busy hours?',
      answer:
        'The Edge Agent maintains an ACID-compliant local SQLite queue. Already downloaded and verified jobs continue printing uninterrupted. Once internet restores, all audit logs and ledger entries sync back seamlessly.',
    },
  ];

  const includedItems = [
    {
      title: 'Lightweight Desktop Edge Agent',
      description: 'Under 15MB Windows 10/11 background service that runs silently in your system tray without slowing down your PC.',
    },
    {
      title: 'Automatic Server & Client Page Counting',
      description: 'Accurate parsing engine that reads PDF, DOCX, and PPTX page geometries in milliseconds, including color-detection.',
    },
    {
      title: 'Deterministic Integer Pricing',
      description: 'Calculates every single quotation strictly in integer Paise (₹1 = 100 paise) ensuring zero rounding errors or disputes.',
    },
    {
      title: 'Hardware-Safe Spooling & Recovery',
      description: 'Monitors printer status codes. On jams or paper-out, marks status as OUTPUT_UNCERTAIN to prevent accidental duplicate prints.',
    },
    {
      title: 'Multi-Printer Load Balancing',
      description: 'Distribute large student print volumes across multiple USB and network printers simultaneously to slash queue wait times.',
    },
    {
      title: 'Shift & Cash Reconciliation',
      description: 'Track counter cash collected per operator shift, generate end-of-day Z-reports, and reconcile with digital UPI settlements.',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#FBFCFE]">
      {/* ─────────────────────────────────────────────────────────────
          HERO SECTION: Print Automation Software
      ───────────────────────────────────────────────────────────── */}
      <section className="bg-[#172031] text-white pt-16 pb-20 md:pt-20 md:pb-24 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-[#4D64E6]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <span className="inline-block px-3 py-1 bg-white/10 text-[#A9B6FF] rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-white/15">
                PRINT SHOP AUTOMATION SOFTWARE
              </span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.15] mb-6">
                Automate your print counter from file intake to final print
              </h1>
              <p className="text-sm sm:text-base md:text-lg text-gray-300 mb-8 leading-relaxed">
                A single lightweight Windows agent that connects your counter PC, automatically counts pages, calculates prices in integer Paise, routes to the right printer tray, and manages your live queue.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => onNavigate('/register')}
                  className="px-7 py-3.5 bg-[#4D64E6] hover:bg-[#3F54D1] text-white font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-[#4D64E6]/30 transition-all cursor-pointer text-center"
                >
                  Start free trial →
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/contact')}
                  className="px-7 py-3.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm sm:text-base rounded-xl transition-all cursor-pointer text-center"
                >
                  Book desktop demo
                </button>
              </div>
            </div>

            {/* Desktop Queue Window Mockup */}
            <div className="lg:col-span-5">
              <div className="bg-[#1E2A44] border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
                {/* Window Chrome */}
                <div className="bg-[#172031] px-4 py-2.5 flex items-center justify-between border-b border-white/10">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span className="ml-2 text-[11px] font-mono text-gray-400">Inklly Edge Agent v1.0.0</span>
                  </div>
                  <span className="text-[10px] text-green-400 font-bold bg-green-950/60 px-2 py-0.5 rounded border border-green-800">
                    Agent Online
                  </span>
                </div>

                {/* Queue Table */}
                <div className="p-4 text-xs font-mono">
                  <div className="text-[11px] text-gray-400 uppercase tracking-wider pb-2 border-b border-white/10 grid grid-cols-12 gap-1 font-bold">
                    <span className="col-span-2">Token</span>
                    <span className="col-span-4">File</span>
                    <span className="col-span-2">Pages</span>
                    <span className="col-span-2">Tray</span>
                    <span className="col-span-2">Status</span>
                  </div>

                  <div className="space-y-2.5 mt-3">
                    <div className="grid grid-cols-12 gap-1 items-center text-white py-1.5 px-2 bg-white/5 rounded-lg border border-white/5">
                      <span className="col-span-2 font-bold text-[#A9B6FF]">#T-101</span>
                      <span className="col-span-4 truncate text-gray-200">Thesis_Ch3.pdf</span>
                      <span className="col-span-2">24 (Duplex)</span>
                      <span className="col-span-2 text-xs text-gray-300">Tray 1 (B&W)</span>
                      <span className="col-span-2 text-green-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" /> Printing
                      </span>
                    </div>

                    <div className="grid grid-cols-12 gap-1 items-center text-white py-1.5 px-2 bg-white/5 rounded-lg border border-white/5">
                      <span className="col-span-2 font-bold text-[#A9B6FF]">#T-102</span>
                      <span className="col-span-4 truncate text-gray-200">Lab_Cover.pdf</span>
                      <span className="col-span-2">2 (Color)</span>
                      <span className="col-span-2 text-xs text-gray-300">Tray 2 (Color)</span>
                      <span className="col-span-2 text-yellow-400 font-bold">Queued</span>
                    </div>

                    <div className="grid grid-cols-12 gap-1 items-center text-white py-1.5 px-2 bg-white/5 rounded-lg border border-white/5">
                      <span className="col-span-2 font-bold text-[#A9B6FF]">#T-103</span>
                      <span className="col-span-4 truncate text-gray-200">Notes_Unit4.pdf</span>
                      <span className="col-span-2">48 (Duplex)</span>
                      <span className="col-span-2 text-xs text-gray-300">Tray 1 (B&W)</span>
                      <span className="col-span-2 text-blue-400 font-bold">Paid UPI</span>
                    </div>
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
          <span className="text-xs uppercase font-extrabold tracking-wider text-[#4D64E6] mb-2 block">
            Edge Spooling Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172031] tracking-tight">
            Built for extreme counter reliability
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <WorkflowCard
            stepNumber="01"
            icon={<PrinterIcon size={22} />}
            title="Zero-Click Spooling"
            description="Jobs send automatically to your printer upon verified payment without the operator opening PDF reader or configuring dialogs."
          />
          <WorkflowCard
            stepNumber="02"
            icon={<LifebuoyIcon size={22} />}
            title="Hardware-Safe Recovery"
            description="If a paper jam or out-of-paper event occurs, the job state changes to OUTPUT_UNCERTAIN to prevent accidental duplicate customer prints."
          />
          <WorkflowCard
            stepNumber="03"
            icon={<SlidersIcon size={22} />}
            title="Multi-Tray Routing"
            description="Assign B&W jobs to high-speed mono engines and color photo sheets to dedicated inkjet tanks automatically."
          />
          <WorkflowCard
            stepNumber="04"
            icon={<CheckIcon size={22} />}
            title="Real-Time Queue Sync"
            description="Live bidirectional WebSockets notify customer mobile screens the exact moment their pages exit the output tray."
          />
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: WHAT'S INCLUDED (Dark Panel)
      ───────────────────────────────────────────────────────────── */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <IncludedPanel
          variant="dark"
          title="What's included in Print Shop Automation"
          subtitle="Enterprise-grade print shop management features packaged into an easy-to-use desktop agent."
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
              { label: 'WhatsApp Printing Software', href: '/whatsapp-printing-software' },
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
