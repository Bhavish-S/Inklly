import React, { useState } from 'react';
import { Logo, ChevronUpIcon } from './icons';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  const toggleColumn = (col: string) => {
    setOpenAccordion(openAccordion === col ? null : col);
  };

  const handleLink = (path: string) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onNavigate(path);
  };

  const linkClasses =
    'bg-transparent border-none text-left cursor-pointer text-[#7E8DA3] hover:text-white transition-colors duration-200 text-sm leading-relaxed font-normal p-0';

  const columnHeadingClasses =
    'flex justify-between items-center font-semibold text-sm tracking-wide uppercase text-[#A6B2C5] mb-5 cursor-pointer sm:cursor-default select-none';

  return (
    <footer className="bg-[#0D1422] text-white border-t border-[#1E2D42]">
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-10">
        {/* Main grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12 mb-14">

          {/* Left Block — Brand */}
          <div className="max-w-xs">
            <div className="inline-flex items-center bg-white px-3 py-1.5 rounded-[10px] mb-5">
              <Logo size={22} />
            </div>
            <p className="text-[#7E8DA3] text-sm leading-relaxed">
              Streamline your print shop operations — from customer orders and pricing to production tracking, all in one platform.
            </p>
          </div>

          {/* Column 1: Product */}
          <div>
            <div
              onClick={() => toggleColumn('product')}
              className={columnHeadingClasses}
            >
              <span>Product</span>
              <span className="sm:hidden">
                <ChevronUpIcon size={14} />
              </span>
            </div>
            <ul className="list-none flex flex-col gap-3">
              <li><button onClick={() => handleLink('/print-shop-automation-software')} className={linkClasses}>Print automation</button></li>
              <li><button onClick={() => handleLink('/whatsapp-printing-software')} className={linkClasses}>WhatsApp printing</button></li>
              <li><button onClick={() => handleLink('/qr-code-printing-system')} className={linkClasses}>QR ordering system</button></li>
              <li><button onClick={() => handleLink('/p/campus1')} className={linkClasses}>Customer portal demo</button></li>
              <li><button onClick={() => handleLink('/developer')} className={linkClasses}>Developer portal &amp; API</button></li>
              <li><button onClick={() => handleLink('/platform')} className={linkClasses}>Platform owner console</button></li>
              <li><button onClick={() => handleLink('/')} className={linkClasses}>Small print shops</button></li>
            </ul>
          </div>

          {/* Column 2: Help */}
          <div>
            <div
              onClick={() => toggleColumn('help')}
              className={columnHeadingClasses}
            >
              <span>Company</span>
              <span className="sm:hidden">
                <ChevronUpIcon size={14} />
              </span>
            </div>
            <ul className="list-none flex flex-col gap-3">
              <li><button onClick={() => handleLink('/how-it-works')} className={linkClasses}>How it works</button></li>
              <li><button onClick={() => handleLink('/pricing')} className={linkClasses}>Pricing</button></li>
              <li><button onClick={() => handleLink('/merchant')} className={linkClasses}>Merchant workspace</button></li>
              <li><button onClick={() => handleLink('/contact')} className={linkClasses}>Contact &amp; support</button></li>
              <li><button onClick={() => handleLink('/#faq')} className={linkClasses}>FAQ</button></li>
              <li><button onClick={() => handleLink('/register')} className={linkClasses}>Join as a Merchant</button></li>
              <li><button onClick={() => handleLink('/login')} className={linkClasses}>Merchant sign in</button></li>
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div>
            <div
              onClick={() => toggleColumn('legal')}
              className={columnHeadingClasses}
            >
              <span>Legal</span>
              <span className="sm:hidden">
                <ChevronUpIcon size={14} />
              </span>
            </div>
            <ul className="list-none flex flex-col gap-3">
              <li><button onClick={() => handleLink('/legal/privacy-policy')} className={linkClasses}>Privacy policy</button></li>
              <li><button onClick={() => handleLink('/legal/terms')} className={linkClasses}>Terms</button></li>
              <li><button onClick={() => handleLink('/legal/refund-policy')} className={linkClasses}>Refund policy</button></li>
              <li><button onClick={() => handleLink('/legal/delivery-policy')} className={linkClasses}>Delivery policy</button></li>
            </ul>
          </div>
        </div>

        {/* Thin Divider & Centered Copyright */}
        <div className="border-t border-[#1E2D42] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#667085]">
            © {new Date().getFullYear()} Inklly Technologies. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            {/* Social: X / Twitter */}
            <a
              href="https://x.com/inklly"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow us on X"
              className="text-[#667085] hover:text-white transition-colors duration-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            {/* Social: LinkedIn */}
            <a
              href="https://linkedin.com/company/inklly"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow us on LinkedIn"
              className="text-[#667085] hover:text-white transition-colors duration-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            {/* Social: Instagram */}
            <a
              href="https://instagram.com/inklly"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow us on Instagram"
              className="text-[#667085] hover:text-white transition-colors duration-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
