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
            className={`border rounded-xl transition-all duration-200 bg-ink-surface dark:bg-ink-dark-surface overflow-hidden ${
              isOpen ? 'border-brand/50 shadow-xs ring-1 ring-brand/20' : 'border-ink-border dark:border-ink-dark-border'
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
              className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-ink-text dark:text-ink-dark-text hover:text-brand dark:hover:text-brand-dark focus:outline-hidden transition-colors cursor-pointer"
            >
              <span>{item.question}</span>
              <span
                className={`text-ink-text-muted dark:text-ink-dark-text-muted shrink-0 transition-transform duration-200 ${
                  isOpen ? 'rotate-180 text-brand dark:text-brand-dark' : ''
                }`}
              >
                <ChevronDownIcon size={18} />
              </span>
            </button>
            {isOpen && (
              <div className="px-5 pb-4 text-xs sm:text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary leading-relaxed border-t border-ink-border dark:border-ink-dark-border pt-3">
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
