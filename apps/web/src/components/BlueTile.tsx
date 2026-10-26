import React from 'react';

interface BlueTileProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export const BlueTile: React.FC<BlueTileProps> = ({
  icon,
  title,
  description,
  href,
  onClick,
  className = '',
}) => {
  const content = (
    <div
      onClick={onClick}
      className={`group relative bg-[#4D64E6] hover:bg-[#3F54D1] text-white p-6 rounded-[20px] shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between cursor-pointer min-h-[170px] ${className}`}
    >
      {/* Top Header: Icon & Top-Right Arrow */}
      <div className="flex items-center justify-between mb-4">
        <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center text-white backdrop-blur-xs group-hover:bg-white/20 transition-colors">
          {icon}
        </div>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 group-hover:text-white transition-colors">
          <span className="text-lg font-bold group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
        </div>
      </div>

      {/* Title & Description */}
      <div>
        <h3 className="text-lg font-bold text-white mb-1 tracking-tight group-hover:text-white">{title}</h3>
        <p className="text-xs text-white/85 leading-relaxed font-normal">{description}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block no-underline">
        {content}
      </a>
    );
  }

  return content;
};
