import React from 'react';

interface PrintAutomationPageProps {
  onNavigate: (path: string) => void;
}

export const PrintAutomationPage: React.FC<PrintAutomationPageProps> = ({ onNavigate }) => (
  <main className="min-h-screen bg-[#F8F9FC] text-[#172031]">
    <section className="bg-[#172031] px-5 py-20 text-center text-white md:py-28">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#B8C2FF]">Print workflow prototype</p>
      <h1 style={{ color: '#fff' }} className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">Review print requests before they reach the counter printer.</h1>
      <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300">The prototype includes a merchant order queue and a Windows print agent. Hardware delivery guarantees, safe retries, offline recovery, and production agent security still need validation.</p>
      <button type="button" onClick={() => onNavigate('/register')} className="mt-8 min-h-12 rounded-xl bg-[#5867E8] px-6 py-3 text-sm font-bold text-white hover:bg-[#4857D8] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#172031]">Create a shop account</button>
    </section>
    <section className="mx-auto grid max-w-5xl gap-5 px-5 py-14 md:grid-cols-2 md:py-20">
      <article className="rounded-2xl border border-[#E3E7F0] bg-white p-7 shadow-sm">
        <h2 className="text-xl font-extrabold">Merchant review</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">Staff can review incoming customer requests and update the order workflow from the merchant workspace.</p>
      </article>
      <article className="rounded-2xl border border-[#E3E7F0] bg-white p-7 shadow-sm">
        <h2 className="text-xl font-extrabold">Local print agent</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">The repository includes a desktop agent and local spooler interface. Do not connect it to live customer jobs until pairing, command authorization, and output-state handling have been secured and validated.</p>
      </article>
    </section>
  </main>
);
