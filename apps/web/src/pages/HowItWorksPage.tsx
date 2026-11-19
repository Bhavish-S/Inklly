import React from 'react';
import { Reveal } from '../components/motion';

interface HowItWorksPageProps {
  onNavigate: (path: string) => void;
}

const JOURNEY = [
  { who: 'Customer', title: 'Scans your QR code', body: 'The poster at your counter opens your shop page in the phone browser — no app, no login.', tone: 'bg-indigo-600' },
  { who: 'Customer', title: 'Uploads and chooses', body: 'PDFs, photos or a camera scan of a paper. B&W or colour, pages, copies, both sides, paper size. Crop and clean up scans.', tone: 'bg-indigo-600' },
  { who: 'Customer', title: 'Sees the exact price and orders', body: 'Pay online, or choose to pay at the counter. They get a short token and a live page with their place in the queue.', tone: 'bg-indigo-600' },
  { who: 'You', title: 'Hear the chime, find the order', body: 'New orders appear on your Counter screen. When the customer arrives, type their token or name.', tone: 'bg-emerald-600' },
  { who: 'You', title: 'Choose the printer, press Print', body: 'Inklly suggests the right printer for each file — colour to colour, the rest to your laser. Change it if you like. Nothing prints until you press Print.', tone: 'bg-emerald-600' },
  { who: 'You', title: 'Check the pages, collect, hand over', body: 'Confirm the pages, take cash or show a UPI QR with the exact amount, and hand over. The customer’s phone says “Ready”.', tone: 'bg-emerald-600' },
];

const SETUP = [
  ['Create your shop', 'Sign up with your shop name and prices. Your QR page is ready immediately.'],
  ['Connect your printers', 'Install the Inklly print app on the computer attached to your printers and enter the pairing code. Every printer appears with its colour, double-sided and paper sizes.'],
  ['Print your poster', 'Download the A4 counter poster with your QR code and prices, and stick it at the counter.'],
];

export const HowItWorksPage: React.FC<HowItWorksPageProps> = ({ onNavigate }) => (
  <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
    <section className="max-w-4xl mx-auto px-5 pt-16 pb-12 text-center animate-slide-up">
      <p className="text-sm font-bold uppercase tracking-widest text-indigo-600">How it works</p>
      <h1 className="mt-2 text-4xl sm:text-5xl font-black tracking-tight">From the customer’s phone to your printer — on your terms.</h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">Customers do the typing, choosing and counting. You stay in control of every print.</p>
    </section>

    <section className="max-w-4xl mx-auto px-5 pb-16">
      <ol className="relative border-l-2 border-dashed border-slate-200 dark:border-slate-800 ml-5 space-y-8">
        {JOURNEY.map((step, index) => (
          <Reveal as="li" key={step.title} delay={index * 60} className="relative pl-10">
            <span className={`absolute -left-[21px] top-0 w-10 h-10 rounded-2xl ${step.tone} text-white font-black flex items-center justify-center shadow-md`}>{index + 1}</span>
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${step.who === 'You' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'}`}>{step.who}</span>
            <h2 className="mt-1.5 text-xl font-extrabold">{step.title}</h2>
            <p className="mt-1 text-slate-600 dark:text-slate-300 leading-relaxed">{step.body}</p>
          </Reveal>
        ))}
      </ol>
    </section>

    <section className="bg-slate-50 dark:bg-slate-900/60 border-y border-slate-200/70 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-5 py-16">
        <h2 className="text-3xl font-black tracking-tight text-center">Set up in about 10 minutes</h2>
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {SETUP.map(([title, body], index) => (
            <Reveal key={title} delay={index * 80}>
              <div className="h-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
                <span className="text-sm font-black text-indigo-600">Step {index + 1}</span>
                <h3 className="mt-2 text-lg font-extrabold">{title}</h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

    <section className="max-w-4xl mx-auto px-5 py-16 text-center">
      <h2 className="text-3xl font-black tracking-tight">Ready to try it at your counter?</h2>
      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
        <button type="button" onClick={() => onNavigate('/register')} className="min-h-[52px] px-7 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-600/25">Start free — 7 days</button>
        <button type="button" onClick={() => onNavigate('/pricing')} className="min-h-[52px] px-7 rounded-2xl border border-slate-300 dark:border-slate-700 font-bold">See plans</button>
      </div>
    </section>
  </div>
);
