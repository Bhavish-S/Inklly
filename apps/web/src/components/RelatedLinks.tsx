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
    <div className={`pt-8 border-t border-ink-border dark:border-ink-dark-border ${className}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-text-muted dark:text-ink-dark-text-muted mb-3">
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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-ink-border dark:border-ink-dark-border bg-ink-surface dark:bg-ink-dark-surface text-xs font-semibold text-ink-text dark:text-ink-dark-text hover:text-brand dark:hover:text-brand-dark hover:border-brand/50 hover:bg-brand-soft dark:hover:bg-brand-dark-soft transition-all shadow-2xs"
          >
            <span>{link.label}</span>
            <span className="text-brand dark:text-brand-dark">→</span>
          </a>
        ))}
      </div>
    </div>
  );
};
