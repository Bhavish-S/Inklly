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

  return (
    <footer style={{ backgroundColor: 'var(--navy)', color: '#FFFFFF', padding: '4.5rem 1.5rem 2.5rem' }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '3rem', marginBottom: '3.5rem' }}>
          {/* Left Block */}
          <div style={{ maxWidth: '320px' }}>
            <div style={{ backgroundColor: '#FFFFFF', display: 'inline-block', padding: '0.5rem 1rem', borderRadius: '10px', marginBottom: '1.25rem' }}>
              <Logo size={22} />
            </div>
            <p style={{ color: '#98A2B3', fontSize: '0.9375rem', lineHeight: 1.6, fontStyle: 'italic' }}>
              "Customer orders. Shop pricing. Printing, organised."
            </p>
          </div>

          {/* Column 1: Product */}
          <div>
            <div
              onClick={() => toggleColumn('product')}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem', cursor: 'pointer' }}
            >
              <span>Product</span>
              <ChevronUpIcon size={16} />
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', color: '#98A2B3' }}>
              <li><button onClick={() => handleLink('/print-shop-automation-software')} style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>Print automation</button></li>
              <li><button onClick={() => handleLink('/whatsapp-printing-software')} style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>WhatsApp printing</button></li>
              <li><button onClick={() => handleLink('/qr-code-printing-system')} style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>QR ordering system</button></li>
              <li><button onClick={() => handleLink('/p/campus1')} style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>Customer portal demo</button></li>
              <li><button onClick={() => handleLink('/developer')} style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>Developer portal & API</button></li>
              <li><button onClick={() => handleLink('/platform')} style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>Platform owner console</button></li>
              <li><button onClick={() => handleLink('/')} style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>Small print shops</button></li>
            </ul>
          </div>

          {/* Column 2: Help */}
          <div>
            <div
              onClick={() => toggleColumn('help')}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem', cursor: 'pointer' }}
            >
              <span>Help</span>
              <ChevronUpIcon size={16} />
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', color: '#98A2B3' }}>
              <li><button onClick={() => handleLink('/how-it-works')} style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>How it works</button></li>
              <li><button onClick={() => handleLink('/pricing')} style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>Pricing</button></li>
              <li><button onClick={() => handleLink('/merchant')} style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>Merchant workspace</button></li>
              <li><button onClick={() => handleLink('/contact')} style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>Contact & support</button></li>
              <li><button onClick={() => handleLink('/#faq')} style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>FAQ</button></li>
              <li><button onClick={() => handleLink('/register')} style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>Join as a Merchant</button></li>
              <li><button onClick={() => handleLink('/login')} style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>Merchant sign in</button></li>
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div>
            <div
              onClick={() => toggleColumn('legal')}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem', cursor: 'pointer' }}
            >
              <span>Legal</span>
              <ChevronUpIcon size={16} />
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', color: '#98A2B3' }}>
              <li><button onClick={() => handleLink('/legal/privacy-policy')} style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>Privacy policy</button></li>
              <li><button onClick={() => handleLink('/legal/terms')} style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>Terms</button></li>
              <li><button onClick={() => handleLink('/legal/refund-policy')} style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>Refund policy</button></li>
              <li><button onClick={() => handleLink('/legal/delivery-policy')} style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>Delivery policy</button></li>
            </ul>
          </div>
        </div>

        {/* Thin Divider & Centered Copyright */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '2rem', textAlign: 'center', color: '#667085', fontSize: '0.8125rem' }}>
          © 2026 Inklly Technologies. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
