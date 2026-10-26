import React from 'react';

export interface RelatedLinkItem {
  label: string;
  href: string;
}

interface RelatedLinksProps {
  heading?: string;
  links: RelatedLinkItem[];
  onNavigate?: (path: string) => void;
  className?: string;
}

export const RelatedLinks: React.FC<RelatedLinksProps> = ({
  heading = 'Related solutions & features',
  links,
  onNavigate,
  className = '',
}) => {
  return (
    <div className={`pt-8 border-t border-[#E6E9F2] ${className}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-[#5B6475] mb-3">
        {heading}
      </p>
      <div className="flex flex-wrap gap-2.5">
        {links.map((link, idx) => (
          <a
            key={idx}
            href={link.href}
            onClick={(e) => {
              if (onNavigate) {
                e.preventDefault();
                onNavigate(link.href);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#E6E9F2] bg-white text-xs font-semibold text-[#172031] hover:text-[#4D64E6] hover:border-[#4D64E6]/50 hover:bg-[#F3F5FF] transition-all shadow-2xs"
          >
            <span>{link.label}</span>
            <span className="text-[#4D64E6]">→</span>
          </a>
        ))}
      </div>
    </div>
  );
};
