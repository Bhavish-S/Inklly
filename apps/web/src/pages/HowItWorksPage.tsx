import React from 'react';

interface HowItWorksPageProps {
  onNavigate: (path: string) => void;
}

const steps = [
  ['1', 'Set up a shop page', 'A shop owner creates an account and uses its shop page as the starting point for QR ordering.'],
  ['2', 'Customer sends an order', 'The customer uploads a document, chooses print options, sees a server-calculated quote, then pays at the counter or uses Razorpay when that shop has enabled it.'],
  ['3', 'Staff inspect and hand over', 'Staff review and release the order to a paired Windows agent. The agent reports spooler submission; staff physically inspect the pages before marking them ready for pickup.'],
];

export const HowItWorksPage: React.FC<HowItWorksPageProps> = ({ onNavigate }) => (
  <main className="min-h-screen bg-[#F8F9FC] text-[#172031]">
    <section className="bg-[#172031] px-5 py-20 text-center text-white md:py-28">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#B8C2FF]">The current preview</p>
      <h1 style={{ color: '#fff' }} className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">From a shop QR page to a reviewed print request.</h1>
      <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300">Inkly connects QR ordering, shop review, and desktop-agent dispatch. Razorpay is configured per shop; the hosted backend and live payment flow still require production verification.</p>
    </section>
    <section className="mx-auto grid max-w-6xl gap-5 px-5 py-14 md:grid-cols-3 md:py-20">
      {steps.map(([number, title, description]) => (
        <article key={number} className="rounded-2xl border border-[#E3E7F0] bg-white p-7 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF0FF] font-extrabold text-[#4D64E6]">{number}</span>
          <h2 className="mt-5 text-xl font-extrabold">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
        </article>
      ))}
    </section>
    <section className="mx-auto max-w-4xl px-5 pb-20">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-950">Order files are scheduled for deletion 24 hours after completion. Render has not yet been updated to the latest backend, so live storage and deletion have not been verified. Use test documents until that deployment is confirmed.</div>
      <button type="button" onClick={() => onNavigate('/register')} className="mt-7 min-h-12 rounded-xl bg-[#5867E8] px-6 py-3 text-sm font-bold text-white hover:bg-[#4857D8] focus:outline-none focus:ring-2 focus:ring-[#5867E8] focus:ring-offset-2">Create a shop account</button>
    </section>
  </main>
);
