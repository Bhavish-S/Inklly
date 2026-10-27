import React from 'react';

interface PricingPageProps {
  onNavigate: (path: string) => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ onNavigate }) => (
  <main className="min-h-screen bg-[#F8F9FC] text-[#172031]">
    <section className="bg-[#172031] px-5 py-20 text-center text-white md:py-28">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#B8C2FF]">Pilot pricing</p>
      <h1 style={{ color: '#fff' }} className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">
        One clear plan for your print counter.
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300">
        Inklly is moving to a hybrid model: a monthly subscription plus a fee for each successfully printed side. Pilot rates are being configured with participating shops and are not published yet.
      </p>
      <button
        type="button"
        onClick={() => onNavigate('/register')}
        className="mt-8 min-h-12 rounded-xl bg-[#5867E8] px-6 py-3 text-sm font-bold text-white hover:bg-[#4857D8] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#172031]"
      >
        Join the pilot
      </button>
    </section>

    <section className="mx-auto grid max-w-5xl gap-5 px-5 py-14 md:grid-cols-2 md:py-20">
      <article className="rounded-2xl border border-[#E3E7F0] bg-white p-7 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-[#5867E8]">Monthly subscription</p>
        <h2 className="mt-3 text-2xl font-extrabold">Shop workspace</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">The subscription covers access to the merchant workspace and the shop’s QR order page. The pilot price and included limits will be agreed before a shop starts a paid plan.</p>
      </article>
      <article className="rounded-2xl border border-[#E3E7F0] bg-white p-7 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-[#5867E8]">Usage fee</p>
        <h2 className="mt-3 text-2xl font-extrabold">Per printed side</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">Usage is measured per successfully printed side, not per submitted order. The pilot rate is still configurable. Jobs with uncertain or failed output must not be billed as successful prints.</p>
      </article>
    </section>

    <section className="mx-auto max-w-3xl px-5 pb-20">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-950">
        Online customer payments are not available in this preview. Shops can configure their own Razorpay account, but checkout and payment verification are still being completed. No trial, subscription charge, or per-side charge is activated from this page.
      </div>
    </section>
  </main>
);
