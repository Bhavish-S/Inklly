import React, { useState, useEffect, useRef } from 'react';
import { Logo, ChevronDownIcon, ArrowRightIcon } from './icons';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

const productItems = [
  { name: 'Print automation', desc: 'Auto spooler & job routing', path: '/print-shop-automation-software' },
  { name: 'WhatsApp printing', desc: 'No-app mobile intake', path: '/whatsapp-printing-software' },
  { name: 'QR ordering system', desc: 'Self-serve counter standees', path: '/qr-code-printing-system' },
  { name: 'Customer demo portal', desc: 'Interactive live demo (/p/campus1)', path: '/p/campus1' },
] as const;

const navLinks = [
  { label: 'How it works', path: '/how-it-works' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'Contact', path: '/contact' },
] as const;

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileProductOpen, setMobileProductOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleNav = (path: string) => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    onNavigate(path);
  };

  const isProductActive = [
    '/print-shop-automation-software',
    '/whatsapp-printing-software',
    '/qr-code-printing-system',
  ].includes(currentPath);

  return (
    <header
      className={`
        sticky top-0 z-50 flex items-center h-[64px]
        transition-all duration-[250ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]
        ${isScrolled
          ? 'bg-white/[0.92] dark:bg-[#0D1422]/[0.92] backdrop-blur-xl border-b border-ink-border/90 dark:border-ink-dark-border/90 shadow-xs'
          : 'bg-white dark:bg-[#0D1422] border-b border-ink-border/40 dark:border-ink-dark-border/40'
        }
      `}
    >
      <div className="w-full max-w-[1180px] mx-auto px-5 sm:px-6 flex justify-between items-center">

        {/* Left: Logo */}
        <div
          onClick={() => handleNav('/')}
          className="cursor-pointer flex-shrink-0 transition-opacity duration-200 hover:opacity-80"
        >
          <Logo size={24} />
        </div>

        {/* Centre: Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {/* Product Dropdown */}
          <div
            ref={dropdownRef}
            className="relative"
            onMouseEnter={() => setDropdownOpen(true)}
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`
                inline-flex items-center gap-1 px-3 py-2 text-[0.875rem] font-medium rounded-lg
                transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]
                ${isProductActive
                  ? 'text-brand dark:text-[#8293FF]'
                  : 'text-ink-text dark:text-ink-dark-text hover:text-brand dark:hover:text-[#8293FF] hover:bg-brand-soft/50 dark:hover:bg-[#202C52]/50'
                }
              `}
              style={{ background: 'none', border: 'none' }}
            >
              Product
              <span
                className={`
                  inline-flex transition-transform duration-150
                  ${dropdownOpen ? 'rotate-180' : ''}
                `}
              >
                <ChevronDownIcon size={15} />
              </span>
            </button>

            {/* Dropdown Panel */}
            <div
              className={`
                absolute top-full left-0 pt-2 w-[280px] z-60
                transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]
                ${dropdownOpen
                  ? 'opacity-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 -translate-y-1 pointer-events-none'
                }
              `}
            >
              <div
                className="
                  bg-white dark:bg-ink-dark-surface
                  rounded-2xl
                  shadow-lg dark:shadow-[0_14px_34px_-4px_rgba(0,0,0,0.4)]
                  border border-ink-border dark:border-ink-dark-border
                  p-2
                  flex flex-col gap-0.5
                "
              >
                {productItems.map((item) => {
                  const isActive = currentPath === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleNav(item.path)}
                      className={`
                        w-full text-left px-3 py-2.5 rounded-xl
                        flex flex-col gap-0.5
                        transition-all duration-150 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]
                        ${isActive
                          ? 'bg-brand-soft dark:bg-[#202C52]'
                          : 'hover:bg-ink-surface-subtle dark:hover:bg-ink-dark-elevated bg-transparent'
                        }
                      `}
                      style={{ border: 'none' }}
                    >
                      <span
                        className={`
                          text-[0.8125rem] font-semibold
                          ${isActive
                            ? 'text-brand dark:text-[#8293FF]'
                            : 'text-ink-text dark:text-ink-dark-text'
                          }
                        `}
                      >
                        {item.name}
                      </span>
                      <span className="text-[0.75rem] text-ink-text-muted dark:text-ink-dark-text-secondary">
                        {item.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {navLinks.map((link) => {
            const isActive = currentPath === link.path;
            return (
              <button
                key={link.path}
                onClick={() => handleNav(link.path)}
                className={`
                  relative px-3 py-2 text-[0.875rem] font-medium rounded-lg
                  transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]
                  ${isActive
                    ? 'text-brand dark:text-[#8293FF]'
                    : 'text-ink-text dark:text-ink-dark-text hover:text-brand dark:hover:text-[#8293FF] hover:bg-brand-soft/50 dark:hover:bg-[#202C52]/50'
                  }
                `}
                style={{ background: 'none', border: 'none' }}
              >
                {link.label}
                {/* Active indicator underline */}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-brand dark:bg-[#8293FF]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Auth Buttons */}
        <div className="hidden lg:flex items-center gap-2">
          <button
            onClick={() => handleNav('/login')}
            className={`
              px-3.5 py-2 text-[0.875rem] font-medium rounded-[10px]
              transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]
              ${currentPath === '/login'
                ? 'text-brand dark:text-[#8293FF] bg-brand-soft/60 dark:bg-[#202C52]/60'
                : 'text-ink-text-secondary dark:text-ink-dark-text-secondary hover:text-ink-text dark:hover:text-ink-dark-text hover:bg-ink-surface-muted dark:hover:bg-ink-dark-elevated'
              }
            `}
            style={{ background: 'none', border: 'none' }}
          >
            Sign in
          </button>

          <button
            onClick={() => handleNav('/register')}
            className="btn btn-primary !px-4 !py-2 !text-[0.8125rem] !rounded-[10px] !gap-1.5"
          >
            Get started
            <ArrowRightIcon size={15} />
          </button>
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="
            lg:hidden flex items-center justify-center
            w-10 h-10 rounded-lg
            transition-colors duration-200
            hover:bg-ink-surface-muted dark:hover:bg-ink-dark-elevated
          "
          style={{ background: 'none', border: 'none' }}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-drawer"
        >
          <div className="flex flex-col gap-[5px]">
            <div
              className="w-[20px] h-[2px] rounded-full bg-ink-text dark:bg-ink-dark-text transition-all duration-200"
              style={{ transform: mobileMenuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }}
            />
            <div
              className="w-[20px] h-[2px] rounded-full bg-ink-text dark:bg-ink-dark-text transition-all duration-200"
              style={{ opacity: mobileMenuOpen ? 0 : 1 }}
            />
            <div
              className="w-[20px] h-[2px] rounded-full bg-ink-text dark:bg-ink-dark-text transition-all duration-200"
              style={{ transform: mobileMenuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }}
            />
          </div>
        </button>
      </div>

      {/* Mobile Drawer — Slide-down overlay */}
      <div
        id="mobile-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile Navigation Menu"
        className={`
          lg:hidden fixed top-[64px] left-0 right-0 bottom-0 z-[100]
          bg-white dark:bg-[#0D1422]
          flex flex-col
          transition-all duration-[280ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]
          ${mobileMenuOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-3 pointer-events-none'
          }
        `}
      >
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-1">
          {/* Mobile Product Accordion */}
          <div>
            <button
              onClick={() => setMobileProductOpen(!mobileProductOpen)}
              aria-expanded={mobileProductOpen}
              className={`
                w-full min-h-[48px] flex justify-between items-center
                px-3 py-3 rounded-xl
                text-[1rem] font-semibold
                transition-all duration-200
                ${isProductActive
                  ? 'text-brand dark:text-[#8293FF] bg-brand-soft/50 dark:bg-[#202C52]/50'
                  : 'text-ink-text dark:text-ink-dark-text hover:bg-ink-surface-muted dark:hover:bg-ink-dark-elevated'
                }
              `}
              style={{ border: 'none', background: 'none' }}
            >
              <span>Product</span>
              <span
                className={`
                  inline-flex transition-transform duration-200
                  ${mobileProductOpen ? 'rotate-180' : ''}
                `}
              >
                <ChevronDownIcon size={18} />
              </span>
            </button>

            <div
              className={`
                overflow-hidden transition-all duration-[250ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]
                ${mobileProductOpen ? 'max-h-[400px] opacity-100 mt-1' : 'max-h-0 opacity-0'}
              `}
            >
              <div className="pl-3 flex flex-col gap-1">
                {productItems.map((item) => {
                  const isActive = currentPath === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleNav(item.path)}
                      className={`
                        min-h-[44px] text-left
                        px-3.5 py-2.5 rounded-xl
                        text-[0.875rem] font-medium
                        transition-all duration-150
                        ${isActive
                          ? 'bg-brand-soft dark:bg-[#202C52] text-brand dark:text-[#8293FF]'
                          : 'bg-ink-surface-subtle dark:bg-ink-dark-elevated text-ink-text dark:text-ink-dark-text hover:bg-ink-surface-muted dark:hover:bg-ink-dark-hover'
                        }
                      `}
                      style={{ border: 'none' }}
                    >
                      <span className="block font-semibold">{item.name}</span>
                      <span className="block text-[0.75rem] text-ink-text-muted dark:text-ink-dark-text-secondary mt-0.5">
                        {item.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Nav links */}
          {navLinks.map((link) => {
            const isActive = currentPath === link.path;
            return (
              <button
                key={link.path}
                onClick={() => handleNav(link.path)}
                className={`
                  min-h-[48px] text-left
                  px-3 py-3 rounded-xl
                  text-[1rem] font-semibold
                  transition-all duration-200
                  ${isActive
                    ? 'text-brand dark:text-[#8293FF] bg-brand-soft/50 dark:bg-[#202C52]/50'
                    : 'text-ink-text dark:text-ink-dark-text hover:bg-ink-surface-muted dark:hover:bg-ink-dark-elevated'
                  }
                `}
                style={{ border: 'none', background: 'none' }}
              >
                {link.label}
              </button>
            );
          })}

          {/* Sign in link in mobile */}
          <button
            onClick={() => handleNav('/login')}
            className={`
              min-h-[48px] text-left
              px-3 py-3 rounded-xl
              text-[1rem] font-semibold
              transition-all duration-200
              ${currentPath === '/login'
                ? 'text-brand dark:text-[#8293FF] bg-brand-soft/50 dark:bg-[#202C52]/50'
                : 'text-ink-text dark:text-ink-dark-text hover:bg-ink-surface-muted dark:hover:bg-ink-dark-elevated'
              }
            `}
            style={{ border: 'none', background: 'none' }}
          >
            Sign in to counter
          </button>
        </div>

        {/* Bottom CTA */}
        <div className="px-5 pb-6 pt-3 border-t border-ink-border dark:border-ink-dark-border">
          <button
            onClick={() => handleNav('/register')}
            className="btn btn-primary w-full !min-h-[48px] !text-[0.9375rem] !rounded-xl justify-center"
          >
            Start Free Shop Trial
            <ArrowRightIcon size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
