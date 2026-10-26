import React from 'react';
import { PrinterIcon, CheckIcon, FileTextIcon } from './icons';

interface PhoneMockupProps {
  fileName?: string;
  fileDetails?: string;
  bwPrice?: string;
  colorPrice?: string;
  price?: string;
  statusText?: string;
  className?: string;
}

export const PhoneMockup: React.FC<PhoneMockupProps> = ({
  fileName = 'Assignment.pdf',
  fileDetails = '12 pages • 2.4 MB',
  bwPrice = '₹2/pg',
  colorPrice = '₹10/pg',
  price = '₹24.00',
  statusText = 'Ready to print • ₹24.00',
  className = '',
}) => {
  const [colorMode, setColorMode] = React.useState<'bw' | 'color'>('bw');
  const [sides, setSides] = React.useState<'single' | 'double'>('double');

  return (
    <div className={`relative inline-block select-none ${className}`} style={{ width: '280px' }}>
      {/* Phone Outer Bezel */}
      <div
        className="relative bg-[#111625] rounded-[38px] p-[10px] shadow-2xl border-4 border-[#1F293D]"
        style={{ width: '280px', height: '540px' }}
      >
        {/* Notch */}
        <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[90px] h-[18px] bg-[#111625] rounded-b-xl z-30 flex items-center justify-center">
          <div className="w-10 h-1 bg-[#232F46] rounded-full" />
          <div className="w-2.5 h-2.5 ml-2 bg-[#1B2436] rounded-full border border-[#2B3954]" />
        </div>

        {/* Screen Container */}
        <div className="relative w-full h-full bg-[#FBFCFE] rounded-[28px] overflow-hidden flex flex-col pt-7 px-3.5 pb-3">
          {/* Status Bar */}
          <div className="flex justify-between items-center text-[10px] font-semibold text-gray-500 px-2 mb-2">
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
              <span>5G</span>
              <div className="w-4 h-2 border border-gray-400 rounded-sm p-[1px]">
                <div className="w-full h-full bg-gray-500 rounded-2xs" />
              </div>
            </div>
          </div>

          {/* Screen In-App Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-[#E6E9F2] mb-3">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-[#4D64E6] flex items-center justify-center text-white">
                <PrinterIcon size={12} />
              </div>
              <span className="font-bold text-xs text-[#172031] tracking-tight">Inklly</span>
            </div>
            <div className="flex items-center gap-1 bg-[#EAFBF0] text-[#1F8A4C] px-2 py-0.5 rounded-full text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1F8A4C] animate-pulse" />
              Online
            </div>
          </div>

          {/* Document Card */}
          <div className="bg-white border border-[#E6E9F2] rounded-xl p-2.5 shadow-xs mb-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <FileTextIcon size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[#172031] truncate">{fileName}</p>
                <p className="text-[9px] text-[#5B6475]">{fileDetails}</p>
              </div>
            </div>

            {/* Color Mode Toggle */}
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => setColorMode('bw')}
                className={`py-1 px-1.5 rounded-md text-[10px] font-semibold border text-center transition-all ${
                  colorMode === 'bw'
                    ? 'bg-[#F3F5FF] border-[#4D64E6] text-[#4D64E6] ring-1 ring-[#4D64E6]'
                    : 'bg-white border-[#E6E9F2] text-[#5B6475]'
                }`}
              >
                B&W ({bwPrice})
              </button>
              <button
                type="button"
                onClick={() => setColorMode('color')}
                className={`py-1 px-1.5 rounded-md text-[10px] font-semibold border text-center transition-all ${
                  colorMode === 'color'
                    ? 'bg-[#F3F5FF] border-[#4D64E6] text-[#4D64E6] ring-1 ring-[#4D64E6]'
                    : 'bg-white border-[#E6E9F2] text-[#5B6475]'
                }`}
              >
                Colour ({colorPrice})
              </button>
            </div>

            {/* Print Style Toggle */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setSides('single')}
                className={`py-1 px-1.5 rounded-md text-[10px] font-medium border text-center ${
                  sides === 'single'
                    ? 'bg-[#F3F5FF] border-[#4D64E6] text-[#4D64E6]'
                    : 'bg-white border-[#E6E9F2] text-[#5B6475]'
                }`}
              >
                Single-sided
              </button>
              <button
                type="button"
                onClick={() => setSides('double')}
                className={`py-1 px-1.5 rounded-md text-[10px] font-medium border text-center ${
                  sides === 'double'
                    ? 'bg-[#F3F5FF] border-[#4D64E6] text-[#4D64E6]'
                    : 'bg-white border-[#E6E9F2] text-[#5B6475]'
                }`}
              >
                Two-sided (Duplex)
              </button>
            </div>
          </div>

          {/* Quick Config Specs */}
          <div className="bg-[#F8FAFC] rounded-lg p-2 mb-3 text-[10px] text-[#5B6475] flex justify-between items-center border border-[#EDF2F7]">
            <span>Paper & copies:</span>
            <span className="font-semibold text-[#172031]">A4 • 1 copy</span>
          </div>

          {/* Total & Review */}
          <div className="mt-auto pt-2 border-t border-[#E6E9F2]">
            <div className="flex justify-between items-baseline mb-2 px-1">
              <span className="text-[11px] text-[#5B6475] font-medium">Estimated total:</span>
              <span className="text-sm font-extrabold text-[#172031]">{price}</span>
            </div>
            <button
              type="button"
              className="w-full py-2 bg-[#4D64E6] hover:bg-[#3F54D1] text-white rounded-lg text-xs font-bold shadow-sm flex items-center justify-center gap-1 transition-all"
            >
              Review order →
            </button>
          </div>
        </div>
      </div>

      {/* Floating Pill Overlapping Bottom Right */}
      <div className="absolute -bottom-3 -right-4 bg-white border border-[#E6E9F2] rounded-full px-3 py-1.5 shadow-xl flex items-center gap-2 z-40 animate-bounce duration-1000">
        <div className="w-5 h-5 rounded-full bg-[#EAFBF0] text-[#1F8A4C] flex items-center justify-center">
          <CheckIcon size={12} />
        </div>
        <span className="text-[11px] font-bold text-[#172031] whitespace-nowrap">{statusText}</span>
      </div>
    </div>
  );
};
