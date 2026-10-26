import React from 'react';

interface WorkflowCardProps {
  stepNumber: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

export const WorkflowCard: React.FC<WorkflowCardProps> = ({
  stepNumber,
  icon,
  title,
  description,
  className = '',
}) => {
  return (
    <div
      className={`bg-white border border-[#E6E9F2] rounded-2xl p-6 shadow-2xs hover:shadow-md hover:border-[#4D64E6]/50 transition-all duration-200 flex flex-col justify-between group ${className}`}
    >
      <div>
        {/* Top Row: Icon chip and 01/02/03/04 */}
        <div className="flex items-center justify-between mb-5">
          <div className="w-12 h-12 rounded-xl bg-[#F3F5FF] text-[#4D64E6] flex items-center justify-center group-hover:bg-[#4D64E6] group-hover:text-white transition-colors duration-200">
            {icon}
          </div>
          <span className="text-xl font-mono font-extrabold text-[#98A2B3] group-hover:text-[#4D64E6] transition-colors">
            {stepNumber}
          </span>
        </div>

        {/* Title */}
        <h4 className="text-base sm:text-lg font-bold text-[#172031] mb-2 leading-tight tracking-tight">
          {title}
        </h4>

        {/* Description */}
        <p className="text-xs sm:text-sm text-[#5B6475] leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
};
