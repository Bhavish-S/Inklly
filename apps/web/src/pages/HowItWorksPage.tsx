import React from 'react';

interface HowItWorksPageProps {
  onNavigate: (path: string) => void;
}

const steps = [
  ['1', 'Set up a shop page', 'A shop owner creates an account and uses its shop page as the starting point for QR ordering.'],
  ['2', 'Customer submits a print request', 'The customer opens the shop page, uploads a document, chooses print options, and sends the request. Cash on collection is the available preview payment path.'],
  ['3', 'Staff review and print', 'Shop staff review the order in the merchant workspace. A Windows print agent is included in the prototype, but production security and reliability work remains.'],
];

export const HowItWorksPage: React.FC<HowItWorksPageProps> = ({ onNavigate }) => (
  <main className="min-h-screen bg-[#F8F9FC] text-[#172031]">
    <section className="bg-[#172031] px-5 py-20 text-center text-white md:py-28">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#B8C2FF]">The current preview</p>
      <h1 style={{ color: '#fff' }} className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">From a shop QR page to a reviewed print request.</h1>
      <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300">Inkly brings customer intake and shop order review into one workflow. The preview does not yet offer online payment verification or automatic print dispatch.</p>
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
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-950">Private file storage and the planned 24-hour post-completion deletion policy are not deployed yet. Use test documents only in this preview.</div>
      <button type="button" onClick={() => onNavigate('/register')} className="mt-7 min-h-12 rounded-xl bg-[#5867E8] px-6 py-3 text-sm font-bold text-white hover:bg-[#4857D8] focus:outline-none focus:ring-2 focus:ring-[#5867E8] focus:ring-offset-2">Create a shop account</button>
    </section>
  </main>
);
