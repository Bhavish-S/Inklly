import React, { useState } from 'react';
import { ChevronDownIcon } from './icons';

export interface AccordionItemData {
  question: string;
  answer: string | React.ReactNode;
}

interface AccordionProps {
  items: AccordionItemData[];
  defaultOpenIndex?: number | null;
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({
  items,
  defaultOpenIndex = 0,
  className = '',
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpenIndex);

  const toggleItem = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={idx}
            className={`border rounded-xl transition-all duration-200 bg-white overflow-hidden ${
              isOpen ? 'border-[#4D64E6]/50 shadow-xs ring-1 ring-[#4D64E6]/20' : 'border-[#E6E9F2]'
            }`}
          >
            <button
              type="button"
              onClick={() => toggleItem(idx)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleItem(idx);
                }
              }}
              aria-expanded={isOpen}
              className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-[#172031] hover:text-[#4D64E6] focus:outline-hidden transition-colors"
            >
              <span>{item.question}</span>
              <span
                className={`text-[#5B6475] shrink-0 transition-transform duration-200 ${
                  isOpen ? 'rotate-180 text-[#4D64E6]' : ''
                }`}
              >
                <ChevronDownIcon size={18} />
              </span>
            </button>
            {isOpen && (
              <div className="px-5 pb-4 text-xs sm:text-sm text-[#5B6475] leading-relaxed border-t border-[#F1F3F9] pt-3">
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
