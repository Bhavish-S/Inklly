import React, { useState } from 'react';
import { useAutoStep } from './motion';
import { CheckIcon, CropIcon, FileTextIcon, PrinterIcon, QrCodeIcon, RotateCwIcon, UploadCloudIcon } from './icons';

const SCENES = [
  { key: 'upload', label: 'Scan & upload' },
  { key: 'options', label: 'Edit & choose' },
  { key: 'pay', label: 'Pay & get token' },
  { key: 'print', label: 'Shop prints' },
] as const;

const Chip: React.FC<{ active?: boolean; children: React.ReactNode }> = ({ active, children }) => (
  <span
    className={`flex-1 text-center rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-colors ${
      active ? 'border-[#4D64E6] bg-[#EEF1FF] text-[#3046C2]' : 'border-[#E5E9F1] bg-white text-[#667085]'
    }`}
  >
    {children}
  </span>
);

const PhoneScreen: React.FC<{ scene: number }> = ({ scene }) => {
  if (scene === 0) {
    return (
      <div key="s0" className="scene-enter flex flex-col h-full">
        <div className="relative mx-auto mt-1 mb-3 w-[104px] h-[104px] rounded-2xl bg-[#0D1422] flex items-center justify-center text-white overflow-hidden">
          <QrCodeIcon size={64} />
          <span className="scan-line absolute left-2 right-2 h-[2px] rounded-full bg-[#2DD4BF] shadow-[0_0_12px_2px_rgba(45,212,191,0.8)]" />
        </div>
        <p className="text-center text-[11px] font-bold text-[#172033]">Campus Print Hub</p>
        <p className="text-center text-[9px] text-[#667085] mb-3">Scanned at the counter · no app needed</p>
        <div className="rounded-xl border-2 border-dashed border-[#B8C4FA] bg-[#F8FAFD] p-3 text-center mb-3">
          <UploadCloudIcon size={20} className="mx-auto text-[#4D64E6] mb-1" />
          <p className="text-[10px] font-semibold text-[#172033]">Upload a PDF or photos</p>
        </div>
        <div className="rounded-xl border border-[#E5E9F1] bg-white p-2.5">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <FileTextIcon size={14} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[#172033] truncate">Project_Report.pdf</p>
              <p className="text-[9px] text-[#667085]">Counting pages…</p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-[#EEF1FF] overflow-hidden">
            <div className="progress-fill h-full rounded-full bg-[#4D64E6]" />
          </div>
        </div>
      </div>
    );
  }

  if (scene === 1) {
    return (
      <div key="s1" className="scene-enter flex flex-col h-full">
        <div className="rounded-xl border border-[#E5E9F1] bg-white p-2.5 mb-2.5">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <FileTextIcon size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-[#172033] truncate">Project_Report.pdf</p>
              <p className="text-[9px] text-[#667085]">24 pages · printing 1–24</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <span className="flex items-center gap-1 rounded-md bg-[#F0F3F8] px-1.5 py-1 text-[9px] font-semibold text-[#172033]">
              <CropIcon size={10} /> Trim
            </span>
            <span className="flex items-center gap-1 rounded-md bg-[#F0F3F8] px-1.5 py-1 text-[9px] font-semibold text-[#172033]">
              <RotateCwIcon size={10} /> Rotate
            </span>
            <span className="rounded-md bg-[#F0F3F8] px-1.5 py-1 text-[9px] font-semibold text-[#172033]">Pages</span>
          </div>
        </div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-[#98A2B3] mb-1">Colour</p>
        <div className="flex gap-1.5 mb-2">
          <Chip active>B&amp;W</Chip>
          <Chip>Colour</Chip>
        </div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-[#98A2B3] mb-1">Sides</p>
        <div className="flex gap-1.5 mb-2">
          <Chip>Single</Chip>
          <Chip active>Both sides</Chip>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-[#F8FAFD] border border-[#E5E9F1] px-2.5 py-2 text-[10px] text-[#667085]">
          <span>Copies</span>
          <span className="font-bold text-[#172033]">− 2 +</span>
        </div>
        <div className="mt-auto pt-2 border-t border-[#E5E9F1]">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[10px] text-[#667085]">Total · 48 sides</span>
            <span className="text-base font-extrabold text-[#172033]">₹72.00</span>
          </div>
          <div className="rounded-lg bg-[#4D64E6] py-2 text-center text-[11px] font-bold text-white">Continue to pay</div>
        </div>
      </div>
    );
  }

  if (scene === 2) {
    return (
      <div key="s2" className="scene-enter flex flex-col h-full items-center text-center">
        <span className="mt-3 w-12 h-12 rounded-full bg-[#E9F8F0] text-[#16845B] flex items-center justify-center pulse-indicator">
          <CheckIcon size={24} />
        </span>
        <p className="mt-2 text-[12px] font-extrabold text-[#172033]">Payment received</p>
        <p className="text-[10px] text-[#667085] mb-3">₹72.00 · UPI</p>
        <div className="w-full rounded-2xl bg-[#0D1422] text-white p-4">
          <p className="text-[9px] uppercase tracking-[0.2em] text-[#8293FF] mb-1">Your pickup token</p>
          <p className="font-mono text-[34px] leading-none font-black tracking-[0.12em]">4821</p>
          <p className="mt-2 text-[9px] text-[#A6B2C5]">Show this number at the counter</p>
        </div>
        <div className="mt-auto w-full rounded-lg border border-[#E5E9F1] bg-[#F8FAFD] px-2.5 py-2 text-[10px] text-[#667085] flex justify-between">
          <span>Status</span>
          <span className="font-bold text-[#B76B14]">In the shop queue</span>
        </div>
      </div>
    );
  }

  return (
    <div key="s3" className="scene-enter flex flex-col h-full">
      <div className="rounded-2xl bg-[#0D1422] text-white p-3 mb-3 flex items-center justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-[0.2em] text-[#8293FF]">Token</p>
          <p className="font-mono text-xl font-black tracking-[0.1em]">4821</p>
        </div>
        <span className="rounded-full bg-[#0B3322] text-[#2BD998] px-2 py-1 text-[9px] font-bold">Printing now</span>
      </div>
      {['Order received', 'Payment confirmed', 'Printing at the counter', 'Ready for pickup'].map((label, index) => (
        <div key={label} className="flex items-center gap-2.5 py-1.5">
          <span
            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
              index < 2 ? 'bg-[#16845B] text-white' : index === 2 ? 'bg-[#4D64E6] text-white pulse-indicator' : 'bg-[#E5E9F1]'
            }`}
          >
            {index < 2 && <CheckIcon size={9} />}
          </span>
          <span className={`text-[10px] ${index <= 2 ? 'font-bold text-[#172033]' : 'text-[#98A2B3]'}`}>{label}</span>
        </div>
      ))}
      <div className="mt-auto rounded-lg bg-[#EEF1FF] px-2.5 py-2 text-[10px] font-semibold text-[#3046C2] text-center">
        This page updates on its own
      </div>
    </div>
  );
};

const QUEUE_ROWS = [
  { token: '4821', file: 'Project_Report.pdf', meta: '48 sides · B&W · duplex' },
  { token: '4820', file: 'ID_Proof.jpg', meta: '2 sides · Colour' },
] as const;

/**
 * The hero illustration: a customer phone, the shop's queue and the printer,
 * stepping together through the real order loop.
 */
export const HeroFlow: React.FC = () => {
  const [hovered, setHovered] = useState(false);
  const [scene, setScene] = useAutoStep(SCENES.length, 3600, hovered);

  const firstRowStatus =
    scene === 0
      ? null
      : scene === 1
        ? { text: 'Customer editing', tone: 'bg-white/10 text-[#A6B2C5]' }
        : scene === 2
          ? { text: 'Paid · ready', tone: 'bg-[#0B3322] text-[#2BD998]' }
          : { text: 'Printing', tone: 'bg-[#4D64E6] text-white' };

  return (
    <div
      className="relative w-full max-w-[560px] mx-auto"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative h-[560px] sm:h-[580px]">
        {/* Phone */}
        <div className="absolute left-1/2 sm:left-[4%] top-0 -translate-x-1/2 sm:translate-x-0 z-20">
          <div className="float-slow relative w-[252px] h-[520px] rounded-[40px] bg-[#0B101C] p-[9px] border border-white/10 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.75),0_0_0_1px_rgba(130,147,255,0.18)]">
            <div className="absolute top-[14px] left-1/2 -translate-x-1/2 w-[78px] h-[20px] rounded-full bg-[#0B101C] z-10" />
            <div className="w-full h-full rounded-[32px] bg-[#FBFCFE] overflow-hidden flex flex-col pt-10 px-3.5 pb-3.5">
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#E5E9F1]">
                <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#172033]">
                  <span className="w-5 h-5 rounded-md bg-[#4D64E6] text-white flex items-center justify-center">
                    <PrinterIcon size={11} />
                  </span>
                  Inklly
                </span>
                <span className="flex items-center gap-1 rounded-full bg-[#E9F8F0] px-2 py-0.5 text-[9px] font-bold text-[#16845B]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16845B]" /> Shop open
                </span>
              </div>
              <div className="flex-1 min-h-0">
                <PhoneScreen scene={scene} />
              </div>
            </div>
          </div>
        </div>

        {/* Merchant queue */}
        <div className="float-slower hidden sm:block absolute right-0 top-[40px] w-[290px] z-30 rounded-2xl border border-white/10 bg-[#111A2B]/90 backdrop-blur-xl p-4 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#7E8DA3] font-semibold">Counter queue</p>
              <p className="text-[13px] font-bold text-white">Shop dashboard</p>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#2BD998]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2BD998] animate-pulse" /> Live
            </span>
          </div>
          <div className="space-y-2">
            {QUEUE_ROWS.map((row, index) => {
              const status = index === 0 ? firstRowStatus : { text: 'Collected', tone: 'bg-white/10 text-[#A6B2C5]' };
              const hidden = index === 0 && !status;
              return (
                <div
                  key={row.token}
                  className={`rounded-xl border px-3 py-2.5 transition-all duration-500 ${
                    hidden ? 'opacity-0 -translate-y-1' : 'opacity-100'
                  } ${index === 0 && scene >= 2 ? 'border-[#4D64E6]/60 bg-[#4D64E6]/10' : 'border-white/[0.08] bg-white/[0.03]'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[13px] font-black text-white">#{row.token}</span>
                    {status && (
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${status.tone}`}>{status.text}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#A6B2C5] truncate mt-0.5">{row.file}</p>
                  <p className="text-[10px] text-[#7E8DA3]">{row.meta}</p>
                </div>
              );
            })}
          </div>
          <div
            className={`mt-3 rounded-lg py-2 text-center text-[11px] font-bold transition-colors duration-500 ${
              scene === 2 ? 'bg-[#4D64E6] text-white' : scene === 3 ? 'bg-[#0B3322] text-[#2BD998]' : 'bg-white/[0.06] text-[#7E8DA3]'
            }`}
          >
            {scene === 3 ? 'Sent to HP LaserJet' : 'Print #4821'}
          </div>
        </div>

        {/* Printer */}
        <div className="hidden sm:block absolute right-[6%] bottom-[6px] w-[220px] z-30">
          <div className="rounded-2xl border border-white/10 bg-[#111A2B]/90 backdrop-blur-xl p-4 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg bg-white/[0.08] text-[#A9B6FF] flex items-center justify-center">
                <PrinterIcon size={16} />
              </span>
              <div>
                <p className="text-[11px] font-bold text-white leading-tight">B&amp;W laser</p>
                <p className={`text-[10px] font-semibold ${scene === 3 ? 'text-[#2BD998]' : 'text-[#7E8DA3]'}`}>
                  {scene === 3 ? 'Printing 48 sides' : 'Online · idle'}
                </p>
              </div>
            </div>
            <div className="relative h-[54px] rounded-lg bg-[#0B101C] border border-white/[0.06] overflow-hidden">
              <div className="absolute inset-x-3 top-0 h-[3px] bg-[#27364C] rounded-b" />
              {scene === 3 && (
                <div className="paper-feed absolute left-1/2 -translate-x-1/2 top-[6px] w-[62%] h-[42px] rounded-sm bg-white p-1.5 space-y-1">
                  <span className="block h-[3px] w-4/5 rounded bg-[#D7DDE8]" />
                  <span className="block h-[3px] w-full rounded bg-[#E5E9F1]" />
                  <span className="block h-[3px] w-3/5 rounded bg-[#E5E9F1]" />
                  <span className="block h-[3px] w-full rounded bg-[#E5E9F1]" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Connector between queue and printer */}
        <svg className="hidden sm:block absolute right-[24%] top-[300px] z-10" width="40" height="150" viewBox="0 0 40 150" fill="none" aria-hidden="true">
          <path d="M20 0 V150" stroke={scene === 3 ? '#2BD998' : '#384B66'} strokeWidth="2" strokeLinecap="round" className={scene === 3 ? 'flow-dash' : ''} />
        </svg>
      </div>

      {/* Scene selector */}
      <div className="mt-5 grid grid-cols-4 gap-2" role="tablist" aria-label="Order flow steps">
        {SCENES.map((item, index) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={scene === index}
            onClick={() => setScene(index)}
            className="group text-left cursor-pointer"
          >
            <span className="block h-[3px] rounded-full bg-white/10 overflow-hidden">
              <span
                className={`block h-full rounded-full bg-gradient-to-r from-[#8293FF] to-[#2DD4BF] transition-all duration-500 ${
                  scene === index ? 'w-full' : scene > index ? 'w-full opacity-40' : 'w-0'
                }`}
              />
            </span>
            <span
              className={`mt-2 block text-[11px] sm:text-xs font-semibold transition-colors ${
                scene === index ? 'text-white' : 'text-[#7E8DA3] group-hover:text-[#A6B2C5]'
              }`}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
