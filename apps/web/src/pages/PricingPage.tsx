import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Reveal } from '../components/motion';

interface PricingPageProps {
  onNavigate: (path: string) => void;
}

interface Plan {
  id: string;
  name: string;
  monthlyPricePaise: number;
  annualPricePaise: number;
  features: string[];
}

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const INCLUDED = [
  'Counter screen: find token, choose printer, print',
  'QR ordering with exact prices for customers',
  'Cash and UPI at the counter',
  'Walk-in quick sale and receipts',
  'Pause orders when you’re busy',
  'Files deleted 24 hours after pickup',
  'Works with your existing printers',
  'Free updates and WhatsApp support',
];

const FAQ = [
  ['Is there a commission on prints?', 'No. Customers pay you directly — cash, UPI, or online through your own Razorpay account. Inklly only charges the plan fee.'],
  ['Do I need new hardware?', 'No. Use the computer and printers you already have. The Inklly print app runs on Windows, Mac and Linux.'],
  ['What happens after the free trial?', 'Choose a plan to keep going. If you don’t, the shop simply stops taking new QR orders; nothing is charged automatically.'],
  ['Can I change plans later?', 'Yes, at any time from Billing in your dashboard.'],
];

export const PricingPage: React.FC<PricingPageProps> = ({ onNavigate }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    api.getSubscriptionPlans().then((list: Plan[]) => setPlans(Array.isArray(list) ? list : [])).catch(() => setPlans([]));
  }, []);

  const recurring = plans.filter((plan) => plan.id !== 'plan-lifetime');
  const lifetime = plans.find((plan) => plan.id === 'plan-lifetime');
  const popular = 'plan-growth';
  const choose = (planId: string, billing: string) => onNavigate(`/register?plan=${encodeURIComponent(planId)}&cycle=${encodeURIComponent(billing)}`);

  return (
    <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      <section className="max-w-6xl mx-auto px-5 pt-16 pb-10 text-center animate-slide-up">
        <p className="text-sm font-bold uppercase tracking-widest text-indigo-600">Pricing</p>
        <h1 className="mt-2 text-4xl sm:text-5xl font-black tracking-tight">Simple plans. Zero commission.</h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">Every plan includes the full counter workflow. Start with a 7-day free trial — no card needed.</p>
        <div className="mt-8 inline-flex rounded-2xl bg-slate-100 dark:bg-slate-900 p-1 text-sm font-bold">
          {(['monthly', 'yearly'] as const).map((value) => (
            <button key={value} type="button" onClick={() => setCycle(value)} className={`px-5 py-2 rounded-xl transition ${cycle === value ? 'bg-white dark:bg-slate-800 shadow-sm' : 'text-slate-500'}`}>
              {value === 'monthly' ? 'Monthly' : 'Yearly'}{value === 'yearly' && <span className="ml-1.5 text-emerald-600">2 months free</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 pb-12">
        {recurring.length === 0 && <p className="text-center text-sm text-slate-500">Loading plans…</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recurring.map((plan, index) => {
            const featured = plan.id === popular;
            const price = cycle === 'monthly' ? plan.monthlyPricePaise : plan.annualPricePaise;
            return (
              <Reveal key={plan.id} delay={index * 70}>
                <div className={`relative h-full rounded-3xl p-6 flex flex-col ${featured ? 'bg-slate-950 text-white ring-2 ring-indigo-500 shadow-2xl shadow-indigo-500/20' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'}`}>
                  {featured && <span className="absolute -top-3 left-6 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">Most popular</span>}
                  <h2 className="text-lg font-extrabold">{plan.name}</h2>
                  <p className="mt-4"><span className="text-4xl font-black">{rupees(price)}</span><span className={`text-sm ${featured ? 'text-slate-400' : 'text-slate-500'}`}>/{cycle === 'monthly' ? 'month' : 'year'}</span></p>
                  <ul className="mt-6 space-y-2.5 text-sm flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2"><span className="text-emerald-500">✓</span><span className={featured ? 'text-slate-200' : 'text-slate-600 dark:text-slate-300'}>{feature}</span></li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => choose(plan.id, cycle)} className={`mt-6 min-h-[48px] rounded-2xl font-bold transition ${featured ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    Start free trial
                  </button>
                </div>
              </Reveal>
            );
          })}
        </div>
        {lifetime && (
          <Reveal>
            <div className="mt-6 rounded-3xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-900 p-6 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <h2 className="text-lg font-extrabold">Lifetime — pay once</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">{lifetime.features.join(' · ')}</p>
              </div>
              <p className="text-3xl font-black">{rupees(lifetime.monthlyPricePaise)}</p>
              <button type="button" onClick={() => choose(lifetime.id, 'lifetime')} className="min-h-[48px] px-6 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold">Get lifetime access</button>
            </div>
          </Reveal>
        )}
      </section>

      <section className="bg-slate-50 dark:bg-slate-900/60 border-y border-slate-200/70 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-5 py-14">
          <h2 className="text-2xl font-black tracking-tight text-center">Included in every plan</h2>
          <ul className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {INCLUDED.map((item) => (
              <li key={item} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 text-sm flex gap-2"><span className="text-emerald-500">✓</span>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-5 py-16">
        <h2 className="text-2xl font-black tracking-tight text-center">Pricing questions</h2>
        <dl className="mt-8 space-y-4">
          {FAQ.map(([q, a]) => (
            <div key={q} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <dt className="font-bold">{q}</dt>
              <dd className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
};
