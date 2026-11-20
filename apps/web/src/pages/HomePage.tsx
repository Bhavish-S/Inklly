import React, { useState } from 'react';
import { usePlatformConfig } from '../platform-config';
import { Reveal } from '../components/motion';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

/* ── Illustrations (inline SVG so they stay sharp, light and theme-aware) ── */

const HeroScene: React.FC = () => (
  <div className="relative mx-auto w-full max-w-[520px] aspect-[5/4]" aria-hidden="true">
    <div className="absolute inset-6 rounded-[40px] bg-gradient-to-br from-indigo-500/25 via-violet-500/15 to-emerald-400/20 blur-2xl" />
    {/* Phone */}
    <div className="absolute left-[4%] top-[8%] w-[38%] animate-float">
      <div className="rounded-[28px] bg-slate-900 p-2 shadow-2xl ring-1 ring-white/10">
        <div className="rounded-[22px] bg-white overflow-hidden">
          <div className="bg-indigo-600 px-3 py-2.5">
            <div className="h-2 w-16 rounded bg-white/80" />
            <div className="mt-1.5 h-1.5 w-24 rounded bg-white/40" />
          </div>
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-2">
              <div className="h-8 w-6 rounded bg-red-100 text-[6px] font-black text-red-600 flex items-end justify-center pb-0.5">PDF</div>
              <div className="flex-1 space-y-1"><div className="h-1.5 w-3/4 rounded bg-slate-300" /><div className="h-1.5 w-1/2 rounded bg-slate-200" /></div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-lg bg-slate-900 py-1 text-center text-[7px] font-bold text-white">B&W</div>
              <div className="rounded-lg bg-slate-100 py-1 text-center text-[7px] font-bold text-slate-500">Colour</div>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2 text-center">
              <div className="text-[7px] font-bold uppercase tracking-widest text-emerald-700">Your token</div>
              <div className="font-mono text-lg font-black text-emerald-700 leading-tight">#4821</div>
            </div>
            <div className="rounded-xl bg-indigo-600 py-1.5 text-center text-[8px] font-bold text-white">Order placed ✓</div>
          </div>
        </div>
      </div>
    </div>
    {/* Flow line */}
    <svg className="absolute left-[36%] top-[34%] w-[30%]" viewBox="0 0 160 60" fill="none">
      <path d="M2 50 C50 0 110 0 158 30" stroke="url(#flow)" strokeWidth="3" strokeDasharray="6 7" strokeLinecap="round">
        <animate attributeName="stroke-dashoffset" from="26" to="0" dur="1s" repeatCount="indefinite" />
      </path>
      <defs><linearGradient id="flow" x1="0" x2="1"><stop stopColor="#818CF8" /><stop offset="1" stopColor="#34D399" /></linearGradient></defs>
    </svg>
    {/* Counter PC */}
    <div className="absolute right-[2%] top-[4%] w-[52%] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5 overflow-hidden animate-slide-up delay-200">
      <div className="flex items-center gap-1 bg-slate-100 px-3 py-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /></div>
      <div className="p-3 space-y-2">
        <div className="rounded-lg border-2 border-indigo-400 px-2 py-1 font-mono text-[10px] font-bold text-slate-700">4821<span className="animate-blink">|</span></div>
        <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-2">
          <div className="flex items-center justify-between"><span className="font-mono text-sm font-black text-indigo-700">#4821</span><span className="text-[8px] font-bold text-slate-500">Priya · 12 pages</span></div>
          <div className="mt-1.5 rounded-md bg-white border border-slate-200 px-2 py-1 text-[8px] font-semibold text-slate-600">Printer: <span className="text-slate-900">Laser B&W — Counter 1</span></div>
          <div className="mt-1.5 rounded-lg bg-indigo-600 py-1 text-center text-[9px] font-bold text-white">🖨 Print</div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[8px] font-bold">
          <div className="rounded-lg bg-emerald-600 py-1 text-center text-white">Cash ₹24</div>
          <div className="rounded-lg bg-slate-900 py-1 text-center text-white">UPI</div>
        </div>
      </div>
    </div>
    {/* Printer */}
    <div className="absolute right-[10%] bottom-[4%] w-[40%]">
      <div className="relative">
        <div className="mx-auto w-[70%] h-6 rounded-t-md bg-white border border-slate-200 overflow-hidden">
          <div className="h-full w-full animate-paper bg-[repeating-linear-gradient(180deg,#fff,#fff_5px,#E2E8F0_5px,#E2E8F0_6px)]" />
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 h-20 shadow-xl flex items-center justify-between px-4">
          <div className="h-2 w-16 rounded bg-slate-600" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-blink" />
        </div>
      </div>
    </div>
  </div>
);

const Icon: React.FC<{ d: string; className?: string }> = ({ d, className = '' }) => (
  <svg viewBox="0 0 24 24" className={`w-6 h-6 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

const ICONS = {
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4',
  printer: 'M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z',
  token: 'M4 7h16M4 12h16M4 17h10M18 15l2 2-2 2',
  rupee: 'M6 3h12M6 8h12M14 21 6 13h3a5 5 0 0 0 0-10',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z M9 12l2 2 4-4',
  chart: 'M3 21h18M6 17V10M11 17V5M16 17v-7M21 17v-4',
  tv: 'M3 5h18v12H3zM8 21h8M12 17v4',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  phone: 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2',
  crop: 'M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
};

const PAINS = [
  { title: 'WhatsApp forwards to your personal number', body: 'Hundreds of chats, blurry compressed files, and customers’ Aadhaar and marksheets sitting on your phone forever.' },
  { title: 'Pen drives and viruses', body: 'Every pen drive is a risk to the counter PC — and it takes minutes to find the right file.' },
  { title: 'Counting pages and arguing prices', body: 'Colour or B&W? Both sides? How many copies? Mistakes cost money and patience.' },
  { title: 'A crowd at the counter', body: 'Exam week, admissions, results day — everyone asks “is mine ready?” at once.' },
];

const CUSTOMER_STEPS = [
  { icon: ICONS.qr, title: 'Scan the shop’s QR', body: 'Phone camera, no app. Upload PDFs or take a photo of a paper.' },
  { icon: ICONS.crop, title: 'Choose & see the price', body: 'B&W or colour, pages, copies, both sides. Crop and clean scans. Exact price before ordering.' },
  { icon: ICONS.token, title: 'Get a token', body: 'A short pickup token and a live page that says how many are ahead — and alerts when ready.' },
];

const SHOP_STEPS = [
  { icon: ICONS.keyboard, title: 'Type the token or name', body: 'The order opens instantly with every file, page and setting.' },
  { icon: ICONS.printer, title: 'Pick the printer, press Print', body: 'B&W on the laser, colour on the inkjet — per file. Nothing prints until you press Print.' },
  { icon: ICONS.rupee, title: 'Collect cash or UPI, hand over', body: 'One tap records the payment. Show a UPI QR with the exact amount.' },
];

const FEATURES = [
  { icon: ICONS.printer, title: 'Works with your printers', body: 'Any printer your Windows, Mac or Linux PC can already print to. Multiple B&W and colour printers.' },
  { icon: ICONS.keyboard, title: 'Built for a busy counter', body: 'Search by token, name or phone. Keyboard shortcuts for print, pages OK, cash and UPI.' },
  { icon: ICONS.rupee, title: 'Walk-in billing', body: 'Bill xerox, lamination, binding and scans in seconds with your own price list.' },
  { icon: ICONS.tv, title: '“Now serving” TV screen', body: 'Show ready tokens on any TV. The crowd stops asking.' },
  { icon: ICONS.chart, title: 'Daily reports', body: 'Cash, UPI and online takings, pages printed, busy hours, top customers. Export to Excel.' },
  { icon: ICONS.shield, title: 'Private by design', body: 'Files are deleted 24 hours after pickup. No customer files on your phone or WhatsApp.' },
  { icon: ICONS.bell, title: 'Never miss an order', body: 'A chime and notification for every new order. Pause orders when you’re busy or closed.' },
  { icon: ICONS.phone, title: 'Phone, tablet or PC', body: 'Run the counter on your PC and check orders from your phone. Installs like an app.' },
];

const FAQS = [
  { q: 'Does it print automatically?', a: 'No. Orders wait in your counter queue. You choose the printer and press Print when the customer is in front of you — you stay in control of paper and toner.' },
  { q: 'Do my customers need to install an app?', a: 'No. They scan your QR code with the phone camera, upload in the browser and get a token. It works on any Android or iPhone.' },
  { q: 'Which printers work?', a: 'Any printer your shop computer can already print to — USB, network or shared, any brand. Install the free Inklly print app on that computer and your printers appear automatically.' },
  { q: 'How do I get paid?', a: 'Cash or UPI at the counter as usual, or online payment through your own Razorpay account. Money goes straight to you — Inklly never holds it.' },
  { q: 'What happens to customer files?', a: 'They are stored privately and deleted 24 hours after the order is collected. They never sit in your WhatsApp or phone gallery.' },
  { q: 'Can I try it first?', a: 'Yes. Start a 7-day free trial without a card. Print your shop’s QR poster and take your first order in about 10 minutes.' },
];

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const platform = usePlatformConfig();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden">
      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 -z-0 bg-[radial-gradient(60%_60%_at_80%_10%,rgba(99,102,241,0.18),transparent),radial-gradient(40%_50%_at_10%_80%,rgba(16,185,129,0.14),transparent)]" />
        <div className="relative max-w-6xl mx-auto px-5 pt-14 pb-16 lg:pt-20 lg:pb-24 grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
          <div className="animate-slide-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-900 bg-white/80 dark:bg-slate-900/80 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-blink" /> For xerox &amp; print shops in India
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05]">
              Your print counter,<br />
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-500 bg-clip-text text-transparent bg-animated-gradient">without the chaos.</span>
            </h1>
            <p className="mt-5 text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
              Customers scan your QR code, upload and pay from their phone, and get a token. You type the token, pick the printer and press <strong className="text-slate-900 dark:text-white">Print</strong>. No WhatsApp forwards, no pen drives, no counting pages.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button type="button" onClick={() => onNavigate('/register')} className="min-h-[52px] px-7 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-600/25 transition active:scale-[0.99]">
                Start free — 7 days
              </button>
              <button type="button" onClick={() => onNavigate('/how-it-works')} className="min-h-[52px] px-7 rounded-2xl border border-slate-300 dark:border-slate-700 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition">
                See how it works
              </button>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
              {['No card needed', 'Works with your printers', 'Cash, UPI or online'].map((item) => (
                <li key={item} className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span>{item}</li>
              ))}
            </ul>
            {platform?.featureFlags.map_discovery !== false && <button
              type="button"
              onClick={() => onNavigate('/shops')}
              className="group mt-8 w-full sm:w-auto flex items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/80 dark:bg-emerald-950/30 px-4 py-3 text-left hover:border-emerald-400 hover:shadow-md transition"
            >
              <span className="shrink-0 w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
              </span>
              <span className="min-w-0">
                <span className="block font-extrabold text-slate-900 dark:text-white">Find a print shop near you</span>
                <span className="block text-xs text-slate-600 dark:text-slate-400">Need prints? See nearby shops on the map, upload and pay from your phone.</span>
              </span>
              <span className="ml-auto text-emerald-600 dark:text-emerald-400 font-black transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
            </button>}
          </div>
          <HeroScene />
        </div>
      </section>

      {/* Pain */}
      <section className="bg-slate-50 dark:bg-slate-900/60 border-y border-slate-200/70 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-5 py-16">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-widest text-rose-600">Sound familiar?</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight max-w-2xl">The way most print counters run today wastes hours every day.</h2>
          </Reveal>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PAINS.map((pain, index) => (
              <Reveal key={pain.title} delay={index * 80}>
                <div className="h-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center font-black">!</div>
                  <h3 className="mt-4 font-bold leading-snug">{pain.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{pain.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-5 py-20" id="how">
        <Reveal className="text-center max-w-2xl mx-auto">
          <p className="text-sm font-bold uppercase tracking-widest text-indigo-600">How Inklly works</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">Three steps for the customer. Three for you.</h2>
        </Reveal>
        <div className="mt-12 grid lg:grid-cols-2 gap-6">
          {[
            { title: 'Customer · on their phone', tone: 'from-indigo-600 to-violet-600', steps: CUSTOMER_STEPS },
            { title: 'You · at the counter', tone: 'from-emerald-600 to-teal-600', steps: SHOP_STEPS },
          ].map((column, columnIndex) => (
            <Reveal key={column.title} delay={columnIndex * 120} className="rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
              <span className={`inline-block rounded-full bg-gradient-to-r ${column.tone} px-3 py-1 text-xs font-bold text-white`}>{column.title}</span>
              <ol className="mt-6 space-y-6">
                {column.steps.map((step, index) => (
                  <li key={step.title} className="flex gap-4">
                    <div className="relative shrink-0">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${column.tone} text-white flex items-center justify-center shadow-md`}><Icon d={step.icon} /></div>
                      {index < column.steps.length - 1 && <div className="absolute left-1/2 top-12 h-6 w-px bg-slate-200 dark:bg-slate-700" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{index + 1}. {step.title}</h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Counter showcase */}
      <section className="bg-slate-950 text-white">
        <div className="max-w-6xl mx-auto px-5 py-20 grid lg:grid-cols-[1fr_1.15fr] gap-12 items-center">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-400">The Counter screen</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">Find the order. Choose the printer. Print.</h2>
            <p className="mt-4 text-slate-300 leading-relaxed">Every order shows its files, pages, colour, sides, copies and the customer’s note. Inklly suggests the right printer for each file — colour pages to the colour printer, the rest to the laser — and you can change it with one click.</p>
            <ul className="mt-6 space-y-2 text-sm text-slate-300">
              {['Each file on the printer you choose', 'Confirm the pages before charging', 'Cash or UPI QR with the exact amount', 'Receipt on any printer, including 80 mm thermal'].map((item) => (
                <li key={item} className="flex gap-2"><span className="text-emerald-400">✓</span>{item}</li>
              ))}
            </ul>
          </Reveal>
          <Reveal from="right">
            <div className="rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden ring-1 ring-white/10">
              <div className="flex items-center gap-1.5 bg-slate-100 px-4 py-2.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /><span className="ml-3 text-xs font-semibold text-slate-500">Counter</span></div>
              <div className="grid grid-cols-[0.9fr_1.4fr]">
                <div className="border-r border-slate-100 p-3 space-y-2">
                  <div className="rounded-xl border-2 border-indigo-400 px-3 py-2 text-sm font-mono font-bold">Priya<span className="animate-blink">|</span></div>
                  {[['#4821', 'Priya S.', 'To print', 'bg-indigo-100 text-indigo-700'], ['#4820', 'Rahul', 'Printing', 'bg-sky-100 text-sky-700'], ['#4817', 'Anita', 'Pickup', 'bg-emerald-100 text-emerald-700']].map(([t, n, s, c], i) => (
                    <div key={t} className={`rounded-xl border p-2 ${i === 0 ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}>
                      <div className="flex items-center justify-between"><span className="font-mono font-black">{t}</span><span className={`text-[9px] font-bold rounded-full px-1.5 ${c}`}>{s}</span></div>
                      <div className="text-[10px] text-slate-500">{n}</div>
                    </div>
                  ))}
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-indigo-600 px-3 py-1.5 text-white font-mono font-black text-xl">#4821</div>
                    <div><div className="font-bold text-sm">Priya S.</div><div className="text-[10px] text-slate-500">2 files · 14 pages · ₹38</div></div>
                  </div>
                  {[['Notes_Unit3.pdf', 'B&W · both sides · ×1', 'Laser B&W — Counter 1'], ['Cover_page.pdf', 'Colour · single · ×1', 'Epson Colour']].map(([f, o, p]) => (
                    <div key={f} className="rounded-xl border border-slate-200 p-2.5">
                      <div className="text-xs font-bold">{f}</div>
                      <div className="text-[10px] text-slate-500">{o}</div>
                      <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold">🖨 {p} ▾</div>
                    </div>
                  ))}
                  <div className="rounded-xl bg-indigo-600 py-2.5 text-center text-sm font-bold text-white">🖨 Print</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-5 py-20">
        <Reveal className="text-center max-w-2xl mx-auto">
          <p className="text-sm font-bold uppercase tracking-widest text-indigo-600">Everything the counter needs</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">Made for real Indian print shops</h2>
        </Reveal>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} delay={(index % 4) * 70}>
              <div className="group h-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center transition group-hover:bg-indigo-600 group-hover:text-white"><Icon d={feature.icon} /></div>
                <h3 className="mt-4 font-bold">{feature.title}</h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{feature.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Privacy band */}
      <section className="max-w-6xl mx-auto px-5 pb-20">
        <Reveal>
          <div className="rounded-[32px] bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-8 sm:p-12 grid md:grid-cols-[auto_1fr] gap-8 items-center overflow-hidden relative">
            <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10" />
            <div className="w-20 h-20 rounded-3xl bg-white/15 flex items-center justify-center"><Icon d={ICONS.shield} className="w-10 h-10" /></div>
            <div className="relative">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Your customers’ Aadhaar and marksheets don’t belong in your WhatsApp.</h2>
              <p className="mt-3 text-emerald-50 max-w-2xl">Files are uploaded privately, never saved on your phone, and deleted automatically 24 hours after the order is collected. Customers trust shops that look after their documents.</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Pricing teaser */}
      <section className="bg-slate-50 dark:bg-slate-900/60 border-y border-slate-200/70 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-5 py-16 grid md:grid-cols-[1fr_auto] gap-8 items-center">
          <Reveal>
            <h2 className="text-3xl font-black tracking-tight">Plans from ₹99 a month. No commission on your prints.</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">Start with a 7-day free trial. Every rupee your customers pay goes to you.</p>
          </Reveal>
          <div className="flex gap-3">
            <button type="button" onClick={() => onNavigate('/pricing')} className="min-h-[52px] px-6 rounded-2xl border border-slate-300 dark:border-slate-700 font-bold hover:bg-white dark:hover:bg-slate-900 transition">See plans</button>
            <button type="button" onClick={() => onNavigate('/register')} className="min-h-[52px] px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-600/25 transition">Start free</button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-5 py-20" id="faq">
        <Reveal className="text-center">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Questions shop owners ask</h2>
        </Reveal>
        <div className="mt-10 space-y-3">
          {FAQS.map((faq, index) => {
            const open = openFaq === index;
            return (
              <div key={faq.q} className={`rounded-2xl border transition ${open ? 'border-indigo-300 bg-indigo-50/40 dark:bg-indigo-950/20 dark:border-indigo-800' : 'border-slate-200 dark:border-slate-800'}`}>
                <button type="button" aria-expanded={open} onClick={() => setOpenFaq(open ? null : index)} className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 font-bold">
                  {faq.q}
                  <span className={`shrink-0 w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
                </button>
                {open && <p className="px-5 pb-5 -mt-1 text-slate-600 dark:text-slate-300 leading-relaxed animate-fadeIn">{faq.a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 pb-20">
        <Reveal>
          <div className="max-w-6xl mx-auto rounded-[36px] bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-700 bg-animated-gradient text-white text-center px-6 py-14 sm:py-16 shadow-2xl shadow-indigo-600/20">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight">Take your first QR order today.</h2>
            <p className="mt-4 text-indigo-100 text-lg">Sign up, print your counter poster, and you’re ready in about 10 minutes.</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <button type="button" onClick={() => onNavigate('/register')} className="min-h-[52px] px-8 rounded-2xl bg-white text-indigo-700 font-black hover:bg-indigo-50 transition">Start free — 7 days</button>
              <button type="button" onClick={() => onNavigate('/contact')} className="min-h-[52px] px-8 rounded-2xl border border-white/40 font-bold hover:bg-white/10 transition">Talk to us</button>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
};
