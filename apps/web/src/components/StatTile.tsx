import React from 'react';

interface StatTileProps {
  icon?: React.ReactNode;
  stat: string;
  label: string;
  className?: string;
}

export const StatTile: React.FC<StatTileProps> = ({
  icon,
  stat,
  label,
  className = '',
}) => {
  return (
    <div className={`bg-ink-surface dark:bg-ink-dark-surface border border-ink-border dark:border-ink-dark-border rounded-2xl p-6 shadow-xs hover:border-brand/40 dark:hover:border-brand-dark/40 transition-colors flex flex-col justify-between ${className}`}>
      {icon && (
        <div className="w-10 h-10 rounded-xl bg-brand-soft dark:bg-brand-dark-soft border border-ink-border dark:border-ink-dark-border text-brand dark:text-brand-dark flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <div>
        <div className="text-3xl lg:text-4xl font-black font-mono text-ink-text dark:text-ink-dark-text tracking-tight mb-1">
          {stat}
        </div>
        <div className="text-xs sm:text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary font-medium leading-snug">
          {label}
        </div>
      </div>
    </div>
  );
};
