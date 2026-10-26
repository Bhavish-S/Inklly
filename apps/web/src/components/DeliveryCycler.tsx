import React, { useState, useEffect } from 'react';
import { StoreIcon, CheckIcon, MapPinIcon } from './icons';

export const DeliveryCycler: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);

  const steps = [
    {
      id: 'ready',
      label: 'Order ready',
      sublabel: 'Print completed, verified & sealed in envelope',
      badge: 'Counter Spooler OK',
      location: 'Inklly Print Hub #12',
      progress: 30,
    },
    {
      id: 'on_way',
      label: 'On the way',
      sublabel: 'Campus rider dispatched with live GPS tracking',
      badge: 'In Transit',
      location: 'Main Quadrangle Road',
      progress: 70,
    },
    {
      id: 'delivered',
      label: 'Delivered',
      sublabel: 'Handed over securely with OTP verification',
      badge: 'Handed Over',
      location: 'Hostel Block B Gate',
      progress: 100,
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [steps.length]);

  const current = steps[activeStep];

  return (
    <div className="bg-white border border-[#E6E9F2] rounded-3xl p-6 shadow-xl overflow-hidden max-w-md w-full mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E6E9F2] mb-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#4D64E6] block">
            Live Order Fulfilment
          </span>
          <h4 className="text-sm font-extrabold text-[#172031]">Tracking #PC-84920</h4>
        </div>
        <span className="px-2.5 py-1 bg-[#EAFBF0] text-[#1F8A4C] rounded-full text-[11px] font-bold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1F8A4C] animate-ping" />
          {current.badge}
        </span>
      </div>

      {/* Map / Route Visual Canvas */}
      <div className="relative bg-[#F9FAFB] rounded-2xl h-48 border border-[#EDF2F7] overflow-hidden p-4 flex flex-col justify-between mb-5">
        {/* Subtle Map Grid Lines */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="delivery-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#64748B" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#delivery-grid)" />
          </svg>
        </div>

        {/* SVG Route Line */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 360 180">
          <path
            d="M 50 130 C 120 130, 160 50, 310 50"
            fill="none"
            stroke="#CBD5E1"
            strokeWidth="3"
            strokeDasharray="6 6"
          />
          <path
            d="M 50 130 C 120 130, 160 50, 310 50"
            fill="none"
            stroke="#4D64E6"
            strokeWidth="3"
            strokeDasharray="400"
            strokeDashoffset={400 - (400 * current.progress) / 100}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>

        {/* Origin Shop Pin */}
        <div className="relative z-10 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#172031] text-white flex items-center justify-center shadow-md">
            <StoreIcon size={14} />
          </div>
          <div className="bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded-md border border-gray-200 text-[10px] font-bold text-gray-800">
            Print Shop
          </div>
        </div>

        {/* Dynamic Moving Rider / Package Icon */}
        <div
          className="absolute z-20 transition-all duration-700 ease-out"
          style={{
            left: `${15 + (current.progress * 0.7)}%`,
            top: `${75 - (current.progress * 0.45)}%`,
          }}
        >
          <div className="w-9 h-9 rounded-full bg-[#4D64E6] text-white flex items-center justify-center shadow-lg border-2 border-white animate-bounce">
            {activeStep === 0 ? (
              <CheckIcon size={16} />
            ) : activeStep === 1 ? (
              <span className="text-xs">🛵</span>
            ) : (
              <MapPinIcon size={16} />
            )}
          </div>
        </div>

        {/* Destination Customer Pin */}
        <div className="relative z-10 self-end flex items-center gap-2">
          <div className="bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded-md border border-gray-200 text-[10px] font-bold text-gray-800">
            Customer
          </div>
          <div className="w-8 h-8 rounded-full bg-[#1F8A4C] text-white flex items-center justify-center shadow-md">
            <MapPinIcon size={14} />
          </div>
        </div>
      </div>

      {/* Status Details */}
      <div className="bg-[#F8FAFC] rounded-xl p-3.5 border border-[#E2E8F0] mb-5">
        <div className="flex items-center justify-between text-xs font-bold text-[#172031] mb-1">
          <span>{current.label}</span>
          <span className="text-[#4D64E6] font-mono text-[11px]">{current.location}</span>
        </div>
        <p className="text-xs text-[#5B6475]">{current.sublabel}</p>
      </div>

      {/* Interactive Step Buttons */}
      <div className="grid grid-cols-3 gap-2">
        {steps.map((s, idx) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveStep(idx)}
            className={`py-2 px-1 text-center rounded-lg text-xs font-bold border transition-all ${
              activeStep === idx
                ? 'bg-[#4D64E6] border-[#4D64E6] text-white shadow-xs'
                : 'bg-white border-[#E6E9F2] text-[#5B6475] hover:bg-gray-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
};
