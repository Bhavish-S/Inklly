import React, { useEffect, useState } from 'react';
import { usePlatformConfig } from '../platform-config';
import { Logo } from './icons';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

const navLinks = [
  { label: 'Find a print shop', path: '/shops' },
  { label: 'How it works', path: '/how-it-works' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'Contact', path: '/contact' },
] as const;

/** Site header: three links, sign in, and one primary action. */
export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const platform = usePlatformConfig();
  const links = navLinks.filter((link) => link.path !== '/shops' || platform?.featureFlags.map_discovery !== false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileMenuOpen(false); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('keydown', onKey); };
  }, []);

  useEffect(() => { setMobileMenuOpen(false); }, [currentPath]);

  const go = (path: string) => { setMobileMenuOpen(false); onNavigate(path); };

  return (
    <header className={`sticky top-0 z-50 transition-all ${isScrolled ? 'bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800' : 'bg-white dark:bg-slate-950 border-b border-transparent'}`}>
      <nav className="max-w-6xl mx-auto h-16 px-5 flex items-center justify-between" aria-label="Main">
        <button type="button" onClick={() => go('/')} className="flex items-center cursor-pointer" aria-label="Inklly home">
          <Logo size={26} />
        </button>

        <div className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <button
              key={link.path}
              type="button"
              onClick={() => go(link.path)}
              aria-current={currentPath === link.path ? 'page' : undefined}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors ${currentPath === link.path ? 'text-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <button type="button" onClick={() => go('/login')} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900">Sign in</button>
          <button type="button" onClick={() => go('/register')} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-600/20 transition">Start free</button>
        </div>

        <button
          type="button"
          className="md:hidden w-11 h-11 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {mobileMenuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-5 py-4 space-y-1 animate-fadeIn">
          {links.map((link) => (
            <button key={link.path} type="button" onClick={() => go(link.path)} className="w-full text-left min-h-[48px] px-3 rounded-xl text-base font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900">
              {link.label}
            </button>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-3">
            <button type="button" onClick={() => go('/login')} className="min-h-[48px] rounded-xl border border-slate-300 dark:border-slate-700 font-bold">Sign in</button>
            <button type="button" onClick={() => go('/register')} className="min-h-[48px] rounded-xl bg-indigo-600 text-white font-bold">Start free</button>
          </div>
        </div>
      )}
    </header>
  );
};
