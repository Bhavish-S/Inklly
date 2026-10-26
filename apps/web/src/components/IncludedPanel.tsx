import React from 'react';
import { CheckIcon } from './icons';

export interface IncludedItem {
  title: string;
  description: string;
}

interface IncludedPanelProps {
  title?: string;
  subtitle?: string;
  items: IncludedItem[];
  variant?: 'dark' | 'light';
  className?: string;
}

export const IncludedPanel: React.FC<IncludedPanelProps> = ({
  title = "What's included",
  subtitle = 'Everything you need to launch, automate, and scale your counter printing operations.',
  items,
  variant = 'dark',
  className = '',
}) => {
  const isDark = variant === 'dark';

  return (
    <div
      className={`rounded-2xl p-6 md:p-10 transition-all ${
        isDark
          ? 'bg-[#1E2A44] text-white shadow-xl border border-white/10'
          : 'bg-[#F3F5FF] text-[#172031] border border-[#E6E9F2]'
      } ${className}`}
    >
      <div className="max-w-2xl mb-8">
        <h3
          className={`text-xl md:text-2xl font-extrabold tracking-tight mb-2 ${
            isDark ? 'text-white' : 'text-[#172031]'
          }`}
        >
          {title}
        </h3>
        <p className={`text-xs md:text-sm ${isDark ? 'text-gray-300' : 'text-[#5B6475]'}`}>
          {subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-3.5">
            <div className="w-5 h-5 rounded-full bg-[#EAFBF0] text-[#1F8A4C] flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <CheckIcon size={12} />
            </div>
            <div>
              <h4
                className={`text-sm font-bold mb-1 leading-snug ${
                  isDark ? 'text-white' : 'text-[#172031]'
                }`}
              >
                {item.title}
              </h4>
              <p
                className={`text-xs leading-relaxed ${
                  isDark ? 'text-gray-300/80' : 'text-[#5B6475]'
                }`}
              >
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
