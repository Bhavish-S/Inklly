import React from 'react';
import { Accordion, AccordionItemData } from '../components/Accordion';
import { EnquiryForm } from '../components/EnquiryForm';
import { HeroFlow } from '../components/HeroFlow';
import { PriceCalculator } from '../components/PriceCalculator';
import { Reveal, Spotlight } from '../components/motion';
import {
  ArrowRightIcon,
  CameraIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  CropIcon,
  FileTextIcon,
  IdCardIcon,
  IndianRupeeIcon,
  LockIcon,
  MonitorIcon,
  PrinterIcon,
  QrCodeIcon,
  RotateCwIcon,
  ShieldIcon,
  SlidersIcon,
  TrashIcon,
  UsersIcon,
} from '../components/icons';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

const MARQUEE_ITEMS = [
  'College photocopy counters',
  'Stationery & xerox shops',
  'Cyber cafés',
  'Office reprographics',
  'Hostel print rooms',
  'Library print desks',
  'Co-working spaces',
  'Document centres',
];

const BEFORE = [
  'Files forwarded on WhatsApp to the shop owner’s personal number',
  'Pen drives passed across the counter',
  '“How many pages? Colour or black and white?” asked for every customer',
  'Prices worked out by hand, with a crowd waiting',
  'No record of who paid for what at the end of the day',
];

const AFTER = [
  'Customers upload from their own phone after scanning your QR',
  'Files arrive in one private queue, with no shared drives or chats',
  'Every order already carries its pages, copies, colour and sides',
  'The price is calculated for you, down to the paisa',
  'Each order has a token, a payment status and a ledger entry',
];

const STEPS = [
  {
    icon: QrCodeIcon,
    title: 'Scan the counter QR',
    body: 'Each shop gets its own QR code and link. It opens in the phone browser, with nothing to install and no account to create.',
  },
  {
    icon: SlidersIcon,
    title: 'Upload, edit and choose',
    body: 'Add PDFs or photos, trim and rotate pages, pick the page range, copies, colour and sides, then see the exact price.',
  },
  {
    icon: IndianRupeeIcon,
    title: 'Pay and get a token',
    body: 'Pay online through the shop’s own Razorpay account or choose cash at the counter. A 4-digit token identifies the order.',
  },
  {
    icon: PrinterIcon,
    title: 'The shop prints it',
    body: 'Staff see the order in their queue, pick the printer and send it. The customer watches the status change and collects the pages.',
  },
];

const TOOLS = [
  { icon: CropIcon, title: 'Trim margins', body: 'Cut the empty border so the content prints larger.' },
  { icon: RotateCwIcon, title: 'Rotate', body: 'Fix sideways scans before they waste a sheet.' },
  { icon: FileTextIcon, title: 'Page ranges', body: 'Print pages 1–5, 8 and 12–18 without splitting the file.' },
  { icon: CopyIcon, title: 'Several files, one order', body: 'Each file keeps its own copies, colour and sides.' },
  { icon: IdCardIcon, title: 'ID card layout', body: 'Front and back on one sheet, when the shop offers it.' },
  { icon: CameraIcon, title: 'Passport photos', body: 'A photo sheet built from one picture, when the shop offers it.' },
];

const TRUST = [
  {
    icon: TrashIcon,
    title: 'Files are deleted after pickup',
    body: 'Customer documents live in private storage and are removed 24 hours after the order is finished.',
  },
  {
    icon: IndianRupeeIcon,
    title: 'Prices cannot drift',
    body: 'Quotes are computed on the server in whole paise from the shop’s rate card, and the order keeps a snapshot of the rates used.',
  },
  {
    icon: ShieldIcon,
    title: 'No accidental double prints',
    body: 'If the printer result is unclear, the job is flagged for staff to check instead of being sent again automatically.',
  },
  {
    icon: LockIcon,
    title: 'Money goes to the shop',
    body: 'Online payments settle to the shop’s own Razorpay account. Inklly does not hold customer payments.',
  },
  {
    icon: UsersIcon,
    title: 'Staff roles and an audit trail',
    body: 'Give counter staff only the access they need. Sensitive changes are recorded against the person who made them.',
  },
  {
    icon: ClockIcon,
    title: 'A ledger you can trust',
    body: 'Payments, cash collections and refunds are written to an append-only ledger that cannot be quietly edited.',
  },
];

const homeFaqs: AccordionItemData[] = [
  {
    question: 'Do my customers need to install an app?',
    answer:
      'No. The QR code opens your shop’s order page in the phone’s browser. Customers upload, choose their print options and pay from there.',
  },
  {
    question: 'Will Inklly work with the printers and computer I already have?',
    answer:
      'Inklly prints through a small agent program installed on the Windows computer at your counter, and uses the printers that computer can already print to. Test it with your own printer models before relying on it during rush hours.',
  },
  {
    question: 'How do customers pay, and where does the money go?',
    answer:
      'You connect your own Razorpay account, so UPI and card payments settle directly to you. Cash at the counter is always available, and staff mark it as collected in one tap.',
  },
  {
    question: 'Can I set my own prices?',
    answer:
      'Yes. You set per-side rates for black and white and colour, single and double sided, plus a bulk discount and reduced rates for additional copies. Customers always see the price your rate card produces.',
  },
  {
    question: 'What happens if the printer jams or runs out of paper?',
    answer:
      'Inklly never assumes a page printed. Staff confirm the output for each file. If the result is uncertain, the job is held for a person to check instead of being reprinted automatically.',
  },
  {
    question: 'What happens to my customers’ documents?',
    answer:
      'Files are kept in private storage, shown only to your signed-in staff, and deleted 24 hours after the order is completed.',
  },
  {
    question: 'Does Inklly take a commission on my prints?',
    answer: 'No. You pay a flat monthly plan. There is no per-page fee and no percentage of your sales.',
  },
];

const SectionHeading: React.FC<{ eyebrow: string; title: React.ReactNode; lead?: string; align?: 'center' | 'left' }> = ({
  eyebrow,
  title,
  lead,
  align = 'center',
}) => (
  <Reveal className={`max-w-2xl ${align === 'center' ? 'mx-auto text-center' : ''} mb-12 md:mb-16`}>
    <span className="eyebrow">{eyebrow}</span>
    <h2 className="section-title">{title}</h2>
    {lead && <p className="section-lead mt-4">{lead}</p>}
  </Reveal>
);

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  return (
    <div className="flex flex-col">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="hero-stage text-white">
        <span className="aurora aurora-a" />
        <span className="aurora aurora-b" />
        <span className="aurora aurora-c" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 lg:gap-10 items-center">
            <div className="lg:col-span-6 text-center lg:text-left">
              <Reveal>
                <button
                  type="button"
                  onClick={() => onNavigate('/how-it-works')}
                  className="inline-flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.12] text-xs font-semibold text-[#C5CEFF] hover:bg-white/[0.1] transition-colors cursor-pointer mb-7"
                >
                  <span className="px-2 py-0.5 rounded-full bg-[#4D64E6] text-white text-[10px] font-bold tracking-wide">QR</span>
                  Scan. Upload. Pay. Collect.
                  <ArrowRightIcon size={12} />
                </button>
              </Reveal>

              <Reveal delay={80}>
                <h1 className="!text-white text-[2.5rem] sm:text-[3.25rem] lg:text-[4rem] font-extrabold tracking-[-0.04em] leading-[1.03] mb-6">
                  The print counter
                  <br />
                  <span className="text-shine">without the queue.</span>
                </h1>
              </Reveal>

              <Reveal delay={160}>
                <p className="text-base sm:text-lg text-[#A6B2C5] max-w-xl mx-auto lg:mx-0 mb-9 leading-relaxed">
                  Customers scan your shop’s QR code, upload and adjust their documents, and pay from their phone. You pick
                  the printer and press print. No pen drives, no WhatsApp forwards, no mental maths.
                </p>
              </Reveal>

              <Reveal delay={240}>
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-9">
                  <button
                    type="button"
                    onClick={() => onNavigate('/register')}
                    className="btn-glow w-full sm:w-auto min-h-[52px] px-7 rounded-2xl text-white font-semibold text-[15px] cursor-pointer inline-flex items-center justify-center gap-2"
                  >
                    Set up your shop
                    <ArrowRightIcon size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/customer')}
                    className="w-full sm:w-auto min-h-[52px] px-7 rounded-2xl bg-white/[0.06] hover:bg-white/[0.11] border border-white/[0.14] text-white font-medium text-[15px] transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
                  >
                    <QrCodeIcon size={16} />
                    Try it as a customer
                  </button>
                </div>
              </Reveal>

              <Reveal delay={320}>
                <ul className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-[13px] text-[#A6B2C5]">
                  {['No app for customers', '0% commission on prints', 'Works with your existing printers'].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckIcon size={14} className="text-[#2BD998]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            <Reveal from="scale" delay={200} className="lg:col-span-6">
              <HeroFlow />
            </Reveal>
          </div>
        </div>

        {/* Who it is for */}
        <div className="relative border-t border-white/[0.07] py-5">
          <div className="marquee" aria-hidden="true">
            {[0, 1].map((copy) => (
              <div key={copy} className="marquee-track">
                {MARQUEE_ITEMS.map((item) => (
                  <span
                    key={`${copy}-${item}`}
                    className="whitespace-nowrap rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[13px] font-medium text-[#A6B2C5]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <p className="sr-only">Built for {MARQUEE_ITEMS.join(', ')}.</p>
        </div>
      </section>

      {/* ── Before / after ───────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[var(--bg-app)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Why shops switch"
            title="The rush hour is the same every day. The chaos is optional."
            lead="A print counter loses most of its time before the printer even starts. Inklly moves that work to the customer’s phone."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Reveal from="left" className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-7 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--status-danger)] mb-5">The counter today</p>
              <ul className="space-y-4">
                {BEFORE.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] text-[var(--text-secondary)]">
                    <span className="mt-1 w-5 h-5 shrink-0 rounded-full bg-[var(--status-danger-bg)] text-[var(--status-danger)] flex items-center justify-center text-xs font-black">
                      ×
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal
              from="right"
              delay={100}
              className="relative isolate rounded-3xl p-7 sm:p-8 text-white overflow-hidden"
            >
              <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(150deg, #4D64E6 0%, #3046C2 55%, #1E2A6E 100%)' }} />
              <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-3xl -z-10" />
              <p className="text-xs font-bold uppercase tracking-wider text-[#C5CEFF] mb-5">The counter with Inklly</p>
              <ul className="space-y-4">
                {AFTER.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] text-white/95">
                    <span className="mt-1 w-5 h-5 shrink-0 rounded-full bg-white text-[#3046C2] flex items-center justify-center">
                      <CheckIcon size={12} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[var(--bg-surface)] border-y border-[var(--border-default)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="How it works"
            title="Four steps from phone to paper"
            lead="The customer does the first three on their own phone. Your staff only do the last one."
          />
          <ol className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <span
              aria-hidden="true"
              className="hidden lg:block absolute top-[46px] left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-[var(--border-selected)] to-transparent"
            />
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <Reveal as="li" key={step.title} delay={index * 110} className="list-none">
                  <Spotlight className="h-full p-6">
                    <div className="flex items-center justify-between mb-5">
                      <span className="w-12 h-12 rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center border border-[var(--border-selected)]">
                        <StepIcon size={22} />
                      </span>
                      <span className="font-mono text-sm font-bold text-[var(--text-muted)]">0{index + 1}</span>
                    </div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{step.body}</p>
                  </Spotlight>
                </Reveal>
              );
            })}
          </ol>
          <Reveal className="mt-10 text-center">
            <button type="button" onClick={() => onNavigate('/how-it-works')} className="btn-link text-sm cursor-pointer">
              See the full workflow <ArrowRightIcon size={14} />
            </button>
          </Reveal>
        </div>
      </section>

      {/* ── Document tools ───────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[var(--bg-app)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-4 lg:sticky lg:top-28">
              <Reveal>
                <span className="eyebrow">For your customers</span>
                <h2 className="section-title">Fix the document before it reaches the printer</h2>
                <p className="section-lead mt-4">
                  Most reprints happen because a page was sideways, the wrong pages were printed, or the settings were
                  misheard. Customers sort that out themselves, on their own screen.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('/customer')}
                  className="mt-7 btn btn-primary !rounded-xl cursor-pointer"
                >
                  Open the demo order page <ArrowRightIcon size={15} />
                </button>
              </Reveal>
            </div>
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {TOOLS.map((tool, index) => {
                const ToolIcon = tool.icon;
                return (
                  <Reveal key={tool.title} delay={(index % 2) * 90}>
                    <Spotlight className="h-full p-5 flex items-start gap-4">
                      <span className="w-11 h-11 shrink-0 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center">
                        <ToolIcon size={20} />
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">{tool.title}</h3>
                        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{tool.body}</p>
                      </div>
                    </Spotlight>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing clarity ──────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[var(--brand-soft)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="No more mental maths"
            title="The price is worked out before they reach the counter"
            lead="Move the sliders. This is the calculation your customer sees while choosing their options."
          />
          <Reveal from="scale">
            <PriceCalculator />
          </Reveal>
        </div>
      </section>

      {/* ── Merchant dashboard ───────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[var(--bg-surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <Reveal from="left">
              <span className="eyebrow">For the shop</span>
              <h2 className="section-title">One screen for the whole counter</h2>
              <p className="section-lead mt-4 mb-8">
                Every order arrives with its files, settings, price and payment status. Call the token, check the
                document, choose the printer, print.
              </p>
              <ul className="space-y-4 mb-9">
                {[
                  ['Live queue by token', 'New orders appear on their own, sorted by what needs doing next.'],
                  ['Peek before you print', 'Open the customer’s file and settings without downloading anything.'],
                  ['Route to the right printer', 'Send black and white to the laser and colour to the colour unit.'],
                  ['Cash or online, both tracked', 'Mark cash as collected in one tap. Online payments are verified for you.'],
                ].map(([title, body]) => (
                  <li key={title} className="flex items-start gap-3.5">
                    <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-[var(--status-success-bg)] text-[var(--status-success)] flex items-center justify-center">
                      <CheckIcon size={13} />
                    </span>
                    <p className="text-[15px] text-[var(--text-secondary)]">
                      <strong className="text-[var(--text-primary)] font-semibold">{title}.</strong> {body}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => onNavigate('/register')} className="btn btn-primary !rounded-xl cursor-pointer">
                  Set up your shop <ArrowRightIcon size={15} />
                </button>
                <button type="button" onClick={() => onNavigate('/login')} className="btn btn-secondary !rounded-xl cursor-pointer">
                  Merchant sign in
                </button>
              </div>
            </Reveal>

            <Reveal from="right" delay={120}>
              <div className="relative">
                <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-[#4D64E6]/25 via-transparent to-[#20A6A8]/20 blur-2xl" />
                <div className="relative rounded-3xl border border-[var(--border-default)] bg-[var(--bg-app)] shadow-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F87171]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FDBA74]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2BD998]" />
                    <span className="ml-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                      <MonitorIcon size={13} /> Counter queue
                    </span>
                    <span className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-[var(--status-success)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)] animate-pulse" /> 2 printers online
                    </span>
                  </div>
                  <div className="p-4 space-y-3">
                    {[
                      { token: '4821', name: 'Project_Report.pdf', meta: '48 sides · B&W · both sides · 2 copies', amount: '₹72.00', pill: 'Paid online', tone: 'pill-success', action: 'Print', primary: true },
                      { token: '4822', name: 'Resume_Final.docx', meta: '2 sides · Colour · single', amount: '₹20.00', pill: 'Cash at counter', tone: 'pill-warning', action: 'Collect ₹20', primary: false },
                      { token: '4819', name: 'Lab_Manual.pdf', meta: '120 sides · B&W · both sides', amount: '₹162.00', pill: 'Printing', tone: 'pill-info', action: 'Confirm output', primary: false },
                    ].map((order) => (
                      <div key={order.token} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 flex items-center gap-4">
                        <div className="w-14 h-14 shrink-0 rounded-xl bg-[var(--bg-surface-muted)] flex flex-col items-center justify-center">
                          <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Token</span>
                          <span className="font-mono text-base font-black text-[var(--text-primary)] leading-none">{order.token}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-[var(--text-primary)] truncate">{order.name}</p>
                            <span className={`status-pill ${order.tone}`}>{order.pill}</span>
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{order.meta}</p>
                        </div>
                        <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0">
                          <span className="text-sm font-extrabold text-[var(--text-primary)] tabular-nums">{order.amount}</span>
                          <span
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                              order.primary
                                ? 'bg-[var(--brand)] text-white'
                                : 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)]'
                            }`}
                          >
                            {order.action}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Trust ────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[var(--bg-app)] border-t border-[var(--border-default)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Built to be trusted with documents and money"
            title="Careful where it counts"
            lead="People hand a print shop their ID cards, mark sheets and bank statements. The product is designed around that."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TRUST.map((item, index) => {
              const TrustIcon = item.icon;
              return (
                <Reveal key={item.title} delay={(index % 3) * 90}>
                  <Spotlight className="h-full p-6">
                    <span className="w-11 h-11 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center mb-4">
                      <TrustIcon size={20} />
                    </span>
                    <h3 className="text-base font-bold text-[var(--text-primary)] mb-1.5">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{item.body}</p>
                  </Spotlight>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Plans teaser ─────────────────────────────────────────── */}
      <section className="hero-stage text-white py-20 md:py-24">
        <span className="aurora aurora-a" />
        <span className="aurora aurora-b" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="rounded-[2rem] border border-white/10 bg-white/[0.04] backdrop-blur-xl p-8 md:p-12 grid grid-cols-1 md:grid-cols-5 gap-10 items-center">
            <div className="md:col-span-3">
              <span className="inline-block text-xs font-bold uppercase tracking-[0.14em] text-[#8293FF] mb-3">Simple plans</span>
              <h2 className="!text-white section-title mb-4">A flat monthly price. You keep every rupee you print.</h2>
              <p className="text-[#A6B2C5] text-[15px] leading-relaxed">
                No per-page fee and no cut of your sales. Start with one printer and move up when the counter gets busier.
              </p>
            </div>
            <div className="md:col-span-2 md:text-right">
              <p className="text-sm text-[#A6B2C5]">Plans from</p>
              <p className="text-6xl font-black tracking-tight leading-none my-2">
                ₹99<span className="text-xl font-semibold text-[#A6B2C5]">/month</span>
              </p>
              <button
                type="button"
                onClick={() => onNavigate('/pricing')}
                className="btn-glow mt-5 min-h-[48px] px-6 rounded-xl text-white font-semibold text-sm cursor-pointer inline-flex items-center gap-2"
              >
                Compare plans <ArrowRightIcon size={15} />
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 md:py-28 bg-[var(--bg-app)] scroll-mt-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Questions shop owners ask" title="Before you put a QR on the counter" />
          <Reveal>
            <Accordion items={homeFaqs} defaultOpenIndex={0} />
          </Reveal>
        </div>
      </section>

      {/* ── Enquiry ──────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[var(--bg-surface)] border-t border-[var(--border-default)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <Reveal from="left">
            <span className="eyebrow">Talk to us</span>
            <h2 className="section-title">Want to see it running on your counter?</h2>
            <p className="section-lead mt-4 mb-8">
              Tell us about your shop and we will walk you through setup: your QR code, your rate card, and the print
              agent on your counter computer.
            </p>
            <ul className="space-y-3 text-[15px] text-[var(--text-secondary)]">
              {['A walkthrough with your own printers', 'Help setting your rate card', 'Your shop QR, ready to print and stick'].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <CheckIcon size={16} className="text-[var(--status-success)]" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal from="right" delay={100} className="bg-[var(--bg-surface-subtle)] border border-[var(--border-default)] rounded-3xl p-6 sm:p-8 shadow-sm">
            <EnquiryForm variant="A" />
          </Reveal>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <section className="hero-stage text-white text-center py-20 md:py-28">
        <span className="aurora aurora-a" />
        <span className="aurora aurora-c" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="!text-white text-[2rem] sm:text-5xl font-extrabold tracking-[-0.03em] leading-[1.08] mb-5">
              Put a QR code on the counter.
              <br />
              <span className="text-shine">Let the queue sort itself out.</span>
            </h2>
            <p className="text-[#A6B2C5] text-base sm:text-lg max-w-xl mx-auto mb-9">
              Create your shop, set your rates and print your QR. Your next customer can order from their phone.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/register')}
                className="btn-glow w-full sm:w-auto min-h-[52px] px-8 rounded-2xl text-white font-semibold text-[15px] cursor-pointer inline-flex items-center justify-center gap-2"
              >
                Set up your shop <ArrowRightIcon size={16} />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/pricing')}
                className="w-full sm:w-auto min-h-[52px] px-8 rounded-2xl bg-white/[0.06] hover:bg-white/[0.11] border border-white/[0.14] text-white font-medium text-[15px] transition-colors cursor-pointer inline-flex items-center justify-center"
              >
                See pricing
              </button>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
};
