import React, { useMemo, useState } from 'react';

/**
 * Illustrative quote calculator for the public site. The rates below are
 * examples only: real quotes are computed on the server from each shop's own
 * rate card. Amounts are integer paise throughout, as in the product.
 */
const EXAMPLE_RATES_PAISE = {
  bw: { single: 200, duplex: 150 },
  colour: { single: 1000, duplex: 900 },
} as const;
const BULK_THRESHOLD_SIDES = 100;
const BULK_DISCOUNT_PERCENT = 10;

const formatRupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Segmented = <T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (next: T) => void;
}) => (
  <div>
    <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">{label}</p>
    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--bg-surface-muted)]" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-[40px] rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            value === option.value
              ? 'bg-[var(--bg-surface)] text-[var(--brand)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

const Slider: React.FC<{ label: string; value: number; min: number; max: number; unit: string; onChange: (next: number) => void }> = ({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}) => (
  <div>
    <div className="flex items-baseline justify-between mb-2">
      <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</label>
      <span className="text-sm font-bold text-[var(--text-primary)]">
        {value} {unit}
      </span>
    </div>
    <input
      type="range"
      className="ink-range"
      aria-label={label}
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      style={{ ['--fill' as string]: `${((value - min) / (max - min)) * 100}%` }}
    />
  </div>
);

export const PriceCalculator: React.FC = () => {
  const [pages, setPages] = useState(24);
  const [copies, setCopies] = useState(2);
  const [colour, setColour] = useState<'bw' | 'colour'>('bw');
  const [sides, setSides] = useState<'single' | 'duplex'>('duplex');

  const quote = useMemo(() => {
    const printedSides = pages * copies;
    const sheets = (sides === 'duplex' ? Math.ceil(pages / 2) : pages) * copies;
    const ratePaise = EXAMPLE_RATES_PAISE[colour][sides];
    const subtotalPaise = printedSides * ratePaise;
    const discountPaise =
      printedSides >= BULK_THRESHOLD_SIDES ? Math.floor((subtotalPaise * BULK_DISCOUNT_PERCENT) / 100) : 0;
    return { printedSides, sheets, ratePaise, subtotalPaise, discountPaise, totalPaise: subtotalPaise - discountPaise };
  }, [pages, copies, colour, sides]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 rounded-3xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xl overflow-hidden">
      <div className="lg:col-span-3 p-6 sm:p-8 space-y-6">
        <Slider label="Pages in the document" value={pages} min={1} max={200} unit={pages === 1 ? 'page' : 'pages'} onChange={setPages} />
        <Slider label="Copies" value={copies} min={1} max={20} unit={copies === 1 ? 'copy' : 'copies'} onChange={setCopies} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Segmented
            label="Colour"
            value={colour}
            onChange={setColour}
            options={[
              { value: 'bw', label: 'Black & white' },
              { value: 'colour', label: 'Colour' },
            ]}
          />
          <Segmented
            label="Sides"
            value={sides}
            onChange={setSides}
            options={[
              { value: 'single', label: 'Single' },
              { value: 'duplex', label: 'Both sides' },
            ]}
          />
        </div>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Example rates for illustration. Every shop sets its own rate card, and the real quote is always calculated on the
          server, so the price the customer sees is the price the shop charges.
        </p>
      </div>

      <div className="lg:col-span-2 p-6 sm:p-8 text-white flex flex-col" style={{ background: 'linear-gradient(160deg, #111A2B 0%, #0B101C 100%)' }}>
        <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[#8293FF] mb-4">What the customer sees</p>
        <dl className="space-y-2.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-[#A6B2C5]">Printed sides</dt>
            <dd className="font-semibold">{quote.printedSides}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#A6B2C5]">Sheets of paper</dt>
            <dd className="font-semibold">{quote.sheets}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#A6B2C5]">Rate per side</dt>
            <dd className="font-semibold">{formatRupees(quote.ratePaise)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#A6B2C5]">Subtotal</dt>
            <dd className="font-semibold">{formatRupees(quote.subtotalPaise)}</dd>
          </div>
          <div className={`flex justify-between transition-opacity ${quote.discountPaise ? 'opacity-100' : 'opacity-40'}`}>
            <dt className="text-[#2BD998]">Bulk discount ({BULK_THRESHOLD_SIDES}+ sides)</dt>
            <dd className="font-semibold text-[#2BD998]">−{formatRupees(quote.discountPaise)}</dd>
          </div>
        </dl>
        <div className="mt-auto pt-6">
          <div className="border-t border-white/10 pt-4 flex items-end justify-between">
            <span className="text-sm text-[#A6B2C5]">Total to pay</span>
            <span className="text-4xl font-black tracking-tight tabular-nums" aria-live="polite">
              {formatRupees(quote.totalPaise)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
