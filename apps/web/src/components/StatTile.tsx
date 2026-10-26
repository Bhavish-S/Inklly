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
    <div className={`bg-white border border-[#E6E9F2] rounded-2xl p-6 shadow-2xs hover:border-[#4D64E6]/40 transition-colors flex flex-col justify-between ${className}`}>
      {icon && (
        <div className="w-10 h-10 rounded-xl bg-[#F3F5FF] border border-[#E6E9F2] text-[#4D64E6] flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <div>
        <div className="text-3xl lg:text-4xl font-extrabold text-[#172031] tracking-tight mb-1">
          {stat}
        </div>
        <div className="text-xs sm:text-sm text-[#5B6475] font-medium leading-snug">
          {label}
        </div>
      </div>
    </div>
  );
};
