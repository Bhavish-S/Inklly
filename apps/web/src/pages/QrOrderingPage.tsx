import React from 'react';

interface QrOrderingPageProps {
  onNavigate: (path: string) => void;
}

export const QrOrderingPage: React.FC<QrOrderingPageProps> = ({ onNavigate }) => (
  <main className="min-h-screen bg-[#F8F9FC] text-[#172031]">
    <section className="bg-[#172031] px-5 py-20 text-center text-white md:py-28">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#B8C2FF]">Customer ordering</p>
      <h1 style={{ color: '#fff' }} className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">A mobile shop page for sending print requests.</h1>
      <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300">Customers can use the shop link or QR page to upload a file, choose print options, and send an order for staff review. They do not need to install an app.</p>
      <button type="button" onClick={() => onNavigate('/p/campus1')} className="mt-8 min-h-12 rounded-xl bg-[#5867E8] px-6 py-3 text-sm font-bold text-white hover:bg-[#4857D8] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#172031]">Open sample shop page</button>
    </section>
    <section className="mx-auto grid max-w-5xl gap-5 px-5 py-14 md:grid-cols-2 md:py-20">
      <article className="rounded-2xl border border-[#E3E7F0] bg-white p-7 shadow-sm">
        <h2 className="text-xl font-extrabold">Available in the preview</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>Shop-specific customer page</li>
          <li>File upload and print option selection</li>
          <li>Order submission for staff review</li>
          <li>Cash on collection, or shop-configured Razorpay checkout when enabled</li>
        </ul>
      </article>
      <article className="rounded-2xl border border-amber-200 bg-amber-50 p-7 shadow-sm">
        <h2 className="text-xl font-extrabold text-amber-950">Before using real customer files</h2>
        <p className="mt-4 text-sm leading-6 text-amber-950">Files are stored privately and scheduled for deletion 24 hours after an order is completed. The latest backend is not yet live on Render, so production storage, deletion, and payment verification need deployment checks. Use test documents until those checks are complete.</p>
      </article>
    </section>
  </main>
);
