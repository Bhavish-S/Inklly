import React from 'react';
import { PhoneMockup } from './PhoneMockup';

interface StepPhoneCardProps {
  stepNumber: number;
  title: string;
  description: string;
  fileName?: string;
  price?: string;
}

export const StepPhoneCard: React.FC<StepPhoneCardProps> = ({
  stepNumber,
  title,
  description,
  fileName,
  price,
}) => {
  return (
    <div className="bg-[#4D64E6] rounded-[22px] p-5 md:p-6 text-white flex flex-col items-center text-center shadow-lg transition-transform hover:-translate-y-1 duration-200">
      {/* Top Numbered Black Badge */}
      <div className="self-start w-8 h-8 rounded-full bg-[#111625] text-white font-extrabold text-sm flex items-center justify-center mb-4 shadow-xs">
        {stepNumber}
      </div>

      {/* Middle Scaled-down Phone Preview */}
      <div className="w-full flex justify-center py-2 overflow-hidden my-auto">
        <div style={{ transform: 'scale(0.82)', transformOrigin: 'top center', marginBottom: '-55px' }}>
          <PhoneMockup
            fileName={fileName}
            price={price}
            statusText={`Step ${stepNumber} • Ready`}
          />
        </div>
      </div>

      {/* Bottom Step Title and Description */}
      <div className="mt-4 pt-4 border-t border-white/15 w-full text-left">
        <h3 className="text-lg font-bold text-white mb-1 tracking-tight">{title}</h3>
        <p className="text-xs text-blue-100 leading-relaxed font-normal">{description}</p>
      </div>
    </div>
  );
};
