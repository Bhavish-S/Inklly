import React, { useState, useEffect } from 'react';
import { Logo, ChevronDownIcon, ArrowRightIcon } from './icons';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileProductOpen, setMobileProductOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: isScrolled ? 'rgba(255, 255, 255, 0.94)' : '#FFFFFF',
        backdropFilter: isScrolled ? 'blur(16px)' : 'none',
        WebkitBackdropFilter: isScrolled ? 'blur(16px)' : 'none',
        borderBottom: isScrolled ? '1px solid rgba(230, 233, 242, 0.9)' : '1px solid rgba(230, 233, 242, 0.45)',
        boxShadow: isScrolled ? '0 4px 20px -2px rgba(23, 32, 49, 0.06)' : 'none',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        height: '66px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1180px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* Left: Logo */}
        <div onClick={() => handleNav('/')}>
          <Logo size={24} />
        </div>

        {/* Desktop Navigation Links */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.75rem',
          }}
          className="desktop-nav"
        >
          {/* Product Dropdown */}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setDropdownOpen(true)}
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: isProductActive ? 'var(--brand)' : 'var(--text)',
                background: 'none',
                border: 'none',
                padding: '0.5rem 0',
              }}
            >
              Product
              <span
                style={{
                  display: 'inline-flex',
                  transform: dropdownOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                }}
              >
                <ChevronDownIcon size={16} />
              </span>
            </button>

            {dropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '-12px',
                  width: '270px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  boxShadow: '0 14px 34px -4px rgba(23, 32, 49, 0.14), 0 4px 12px rgba(0, 0, 0, 0.05)',
                  border: '1px solid var(--border)',
                  padding: '0.625rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  zIndex: 60,
                }}
              >
                {[
                  { name: 'Print automation', desc: 'Auto spooler & job routing', path: '/print-shop-automation-software' },
                  { name: 'WhatsApp printing', desc: 'No-app mobile intake', path: '/whatsapp-printing-software' },
                  { name: 'QR ordering system', desc: 'Self-serve counter standees', path: '/qr-code-printing-system' },
                  { name: 'Customer demo portal', desc: 'Interactive live demo (/p/campus1)', path: '/p/campus1' },
                ].map((item) => (
                  <button
                    key={item.path}
                    onClick={() => handleNav(item.path)}
                    style={{
                      textAlign: 'left',
                      padding: '0.625rem 0.875rem',
                      borderRadius: '10px',
                      background: currentPath === item.path ? 'var(--tint)' : 'transparent',
                      border: 'none',
                      transition: 'all 0.15s ease',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--tint)';
                    }}
                    onMouseLeave={(e) => {
                      if (currentPath !== item.path) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: currentPath === item.path ? 'var(--brand)' : 'var(--text)' }}>
                      {item.name}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {item.desc}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => handleNav('/how-it-works')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: currentPath === '/how-it-works' ? 'var(--brand)' : 'var(--text)',
            }}
          >
            How it works
          </button>

          <button
            onClick={() => handleNav('/pricing')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: currentPath === '/pricing' ? 'var(--brand)' : 'var(--text)',
            }}
          >
            Pricing
          </button>

          <button
            onClick={() => handleNav('/contact')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: currentPath === '/contact' ? 'var(--brand)' : 'var(--text)',
            }}
          >
            Contact
          </button>

          <button
            onClick={() => handleNav('/login')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: currentPath === '/login' ? 'var(--brand)' : 'var(--text)',
              marginLeft: '0.5rem',
            }}
          >
            Sign in
          </button>

          <button
            onClick={() => handleNav('/register')}
            className="btn btn-primary"
            style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}
          >
            Get started
            <ArrowRightIcon size={16} />
          </button>
        </nav>

        {/* Mobile Hamburger Toggle Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            display: 'none',
            background: 'none',
            border: 'none',
            padding: '0.5rem',
            cursor: 'pointer',
          }}
          className="mobile-toggle"
          aria-label="Toggle navigation menu"
        >
          <div style={{ width: '22px', height: '2px', backgroundColor: 'var(--text)', marginBottom: '5px' }} />
          <div style={{ width: '22px', height: '2px', backgroundColor: 'var(--text)', marginBottom: '5px' }} />
          <div style={{ width: '22px', height: '2px', backgroundColor: 'var(--text)' }} />
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: '64px',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#FFFFFF',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            padding: '1.5rem',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
            {/* Mobile Product Accordion */}
            <div>
              <button
                onClick={() => setMobileProductOpen(!mobileProductOpen)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  padding: '0.5rem 0',
                }}
              >
                Product
                <span style={{ transform: mobileProductOpen ? 'rotate(180deg)' : 'none' }}>
                  <ChevronDownIcon size={18} />
                </span>
              </button>
              {mobileProductOpen && (
                <div style={{ paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button onClick={() => handleNav('/print-shop-automation-software')} style={{ textAlign: 'left', background: 'none', border: 'none', fontSize: '1rem' }}>Print automation</button>
                  <button onClick={() => handleNav('/whatsapp-printing-software')} style={{ textAlign: 'left', background: 'none', border: 'none', fontSize: '1rem' }}>WhatsApp printing</button>
                  <button onClick={() => handleNav('/qr-code-printing-system')} style={{ textAlign: 'left', background: 'none', border: 'none', fontSize: '1rem' }}>QR ordering</button>
                  <button onClick={() => handleNav('/p/campus1')} style={{ textAlign: 'left', background: 'none', border: 'none', fontSize: '1rem' }}>Customer demo portal</button>
                </div>
              )}
            </div>

            <button onClick={() => handleNav('/how-it-works')} style={{ textAlign: 'left', background: 'none', border: 'none', fontSize: '1.125rem', fontWeight: 700, padding: '0.5rem 0' }}>How it works</button>
            <button onClick={() => handleNav('/pricing')} style={{ textAlign: 'left', background: 'none', border: 'none', fontSize: '1.125rem', fontWeight: 700, padding: '0.5rem 0' }}>Pricing</button>
            <button onClick={() => handleNav('/contact')} style={{ textAlign: 'left', background: 'none', border: 'none', fontSize: '1.125rem', fontWeight: 700, padding: '0.5rem 0' }}>Contact</button>
            <button onClick={() => handleNav('/platform')} style={{ textAlign: 'left', background: 'none', border: 'none', fontSize: '1.125rem', fontWeight: 700, padding: '0.5rem 0' }}>Platform admin</button>
            <button onClick={() => handleNav('/developer')} style={{ textAlign: 'left', background: 'none', border: 'none', fontSize: '1.125rem', fontWeight: 700, padding: '0.5rem 0' }}>Developer portal</button>
            <button onClick={() => handleNav('/login')} style={{ textAlign: 'left', background: 'none', border: 'none', fontSize: '1.125rem', fontWeight: 700, padding: '0.5rem 0' }}>Sign in</button>
          </div>

          <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => handleNav('/register')}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.875rem' }}
            >
              Get started
              <ArrowRightIcon size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Responsive Styles Injection */}
      <style>{`
        @media (max-width: 900px) {
          .desktop-nav { display: none !important; }
          .mobile-toggle { display: block !important; }
        }
      `}</style>
    </header>
  );
};
