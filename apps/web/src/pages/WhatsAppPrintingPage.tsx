import React from 'react';

interface WhatsAppPrintingPageProps {
  onNavigate: (path: string) => void;
}

export const WhatsAppPrintingPage: React.FC<WhatsAppPrintingPageProps> = ({ onNavigate }) => (
  <main className="min-h-screen bg-[#F8F9FC] text-[#172031]">
    <section className="bg-[#172031] px-5 py-20 text-center text-white md:py-28">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#B8C2FF]">In development</p>
      <h1 style={{ color: '#fff' }} className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">WhatsApp order intake is not available yet.</h1>
      <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300">
        The current customer flow uses a shop QR page in a mobile browser. WhatsApp messaging, payment collection, and order notifications are planned integrations, not active features.
      </p>
      <button type="button" onClick={() => onNavigate('/p/campus1')} className="mt-8 min-h-12 rounded-xl bg-[#5867E8] px-6 py-3 text-sm font-bold text-white hover:bg-[#4857D8] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#172031]">
        Open sample customer page
      </button>
    </section>
    <section className="mx-auto max-w-4xl px-5 py-14 md:py-20">
      <div className="rounded-2xl border border-[#E3E7F0] bg-white p-7 shadow-sm md:p-9">
        <h2 className="text-xl font-extrabold">What works in the preview</h2>
        <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
          <li>Customers can submit a print request from a shop’s QR page.</li>
          <li>Staff can review orders in the merchant workspace.</li>
          <li>A local Windows print agent is part of the project, but its production security and delivery guarantees are still being completed.</li>
        </ul>
        <p className="mt-6 border-t border-slate-100 pt-5 text-sm leading-6 text-slate-600">
          Online payment verification is also not active. Shops can enter Razorpay credentials in settings, but connecting credentials alone does not enable checkout.
        </p>
      </div>
    </section>
  </main>
);
