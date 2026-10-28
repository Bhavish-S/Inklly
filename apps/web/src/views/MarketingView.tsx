import React, { useState } from 'react';
import { PrinterIcon, QrCodeIcon, ShieldIcon, DollarSignIcon, MessageSquareIcon, FileTextIcon, CheckCircleIcon } from '../components/icons';

interface MarketingViewProps {
  onNavigate: (view: string) => void;
}

export const MarketingView: React.FC<MarketingViewProps> = ({ onNavigate }) => {
  const [activeFeatureTab, setActiveFeatureTab] = useState<'qr' | 'whatsapp' | 'routing' | 'queue'>('qr');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setExpandedFaq(expandedFaq === idx ? null : idx);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero Section */}
      <section style={{ backgroundColor: '#182230', color: '#FFFFFF', padding: '5.5rem 1.5rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(74, 105, 237, 0.2)', border: '1px solid #4A69ED', padding: '0.375rem 0.875rem', borderRadius: '9999px', fontSize: '0.8125rem', color: '#8EA7FF', marginBottom: '1.5rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4A69ED' }} />
            The Operating System for Modern Print Shops & Photocopy Centers
          </div>

          <h1 style={{ fontSize: '3.25rem', fontWeight: 800, lineHeight: 1.15, marginBottom: '1.5rem', letterSpacing: '-0.025em' }}>
            Transform Counter Chaos into <span style={{ color: '#4A69ED' }}>Instant QR Self-Service</span> & Zero-Click Printing
          </h1>

          <p style={{ fontSize: '1.1875rem', color: '#98A2B3', maxWidth: '760px', margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
            Eliminate long student lines, messy WhatsApp groups, and pen-drive viruses. Inklly gives your shop a dedicated QR ordering portal, real-time deterministic quotation in Paise, and intelligent edge spooler routing directly to your existing USB/network printers.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => onNavigate('customer_portal')}
              className="btn btn-primary"
              style={{ fontSize: '1rem', padding: '0.875rem 1.75rem' }}
            >
              <QrCodeIcon size={20} />
              Open Customer QR Portal Demo (/p/campus1)
            </button>
            <button
              onClick={() => onNavigate('merchant_dashboard')}
              className="btn btn-secondary"
              style={{ fontSize: '1rem', padding: '0.875rem 1.75rem' }}
            >
              <PrinterIcon size={20} />
              Launch Merchant Operating Workspace
            </button>
          </div>

          {/* Quick Counter Trust Metrics */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', marginTop: '3.5rem', paddingTop: '2.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '1.875rem', fontWeight: 800, color: '#FFFFFF' }}>0 App Downloads</div>
              <div style={{ fontSize: '0.8125rem', color: '#98A2B3' }}>Instant browser-based mobile intake</div>
            </div>
            <div>
              <div style={{ fontSize: '1.875rem', fontWeight: 800, color: '#4A69ED' }}>100% Deterministic</div>
              <div style={{ fontSize: '0.8125rem', color: '#98A2B3' }}>Integer Paise pricing calculations</div>
            </div>
            <div>
              <div style={{ fontSize: '1.875rem', fontWeight: 800, color: '#12B76A' }}>Dual Payment</div>
              <div style={{ fontSize: '0.8125rem', color: '#98A2B3' }}>Shop-configured Razorpay or cash at collection</div>
            </div>
            <div>
              <div style={{ fontSize: '1.875rem', fontWeight: 800, color: '#F79009' }}>Hardware Safe</div>
              <div style={{ fontSize: '0.8125rem', color: '#98A2B3' }}>No blind retry when output is uncertain</div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison: The Old Way vs The Inklly Way */}
      <section style={{ padding: '4.5rem 1.5rem', backgroundColor: '#FFFFFF', borderBottom: '1px solid #E4E7EC' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#182230', marginBottom: '0.5rem' }}>
              Why Modern Print Shops Are Upgrading to Inklly
            </h2>
            <p style={{ color: '#667085', fontSize: '1rem' }}>
              Say goodbye to counter bottlenecks, manual calculations, and uncollected paper piles.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
            {/* The Old Way */}
            <div className="card" style={{ backgroundColor: '#FEF3F2', borderColor: '#FECDCA', padding: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: '#B42318' }}>
                <span style={{ fontSize: '1.25rem' }}>✕</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>The Traditional Counter Chaos</h3>
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.875rem', fontSize: '0.9375rem', color: '#7A271A' }}>
                <li>❌ Customers pass infected USB pen drives or crowded Bluetooth connections.</li>
                <li>❌ WhatsApp messages pile up with lost documents and missing print instructions.</li>
                <li>❌ Manual page counting causes frequent math disputes and pricing mistakes.</li>
                <li>❌ Uncollected printouts clutter the counter with unpaid merchant costs.</li>
                <li>❌ Paper jams cause costly accidental double-printing and wasted toner.</li>
              </ul>
            </div>

            {/* The Inklly Way */}
            <div className="card" style={{ backgroundColor: '#ECFDF3', borderColor: '#A6F4C5', padding: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: '#027A48' }}>
                <CheckCircleIcon size={22} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>The Automated Inklly Way</h3>
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.875rem', fontSize: '0.9375rem', color: '#05603A' }}>
                <li>✓ Customers scan your counter QR code and configure their prints on mobile.</li>
                <li>✓ Real-time transparent quotes in Paise before anything is printed.</li>
                <li>✓ Automated 1-click desktop spooling with automatic paper tray detection.</li>
                <li>✓ Customers receive real-time status updates and 4-digit pickup tokens.</li>
                <li>✓ Strict safety guard halts uncertain print jobs until counter verification.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Step Interactive Workflow */}
      <section style={{ padding: '5rem 1.5rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#182230', marginBottom: '0.5rem' }}>
            How Inklly Works in 4 Simple Steps
          </h2>
          <p style={{ color: '#667085', fontSize: '1rem' }}>
              A shop QR page sends customer requests into the merchant review queue.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
          <div className="card" style={{ position: 'relative' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#EEF2FF', color: '#4A69ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.125rem', marginBottom: '1rem' }}>
              1
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Customer Opens Shop QR Page</h3>
            <p style={{ color: '#667085', fontSize: '0.875rem', lineHeight: 1.5 }}>
              Customers open the shop page from its link or QR code in a mobile browser.
            </p>
          </div>

          <div className="card">
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#EEF2FF', color: '#4A69ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.125rem', marginBottom: '1rem' }}>
              2
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Upload & Customize</h3>
            <p style={{ color: '#667085', fontSize: '0.875rem', lineHeight: 1.5 }}>
              Customer drops PDF or Word files, chooses B&W or Color, Simplex or Duplex, Copies, and specific page ranges.
            </p>
          </div>

          <div className="card">
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#EEF2FF', color: '#4A69ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.125rem', marginBottom: '1rem' }}>
              3
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Review Quote & Submit</h3>
            <p style={{ color: '#667085', fontSize: '0.875rem', lineHeight: 1.5 }}>
              The portal calculates a quote from shop rates. Customers can pay cash or use shop-configured Razorpay checkout when available.
            </p>
          </div>

          <div className="card">
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#ECFDF3', color: '#12B76A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.125rem', marginBottom: '1rem' }}>
              4
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>1-Click Spool & Pickup</h3>
            <p style={{ color: '#667085', fontSize: '0.875rem', lineHeight: 1.5 }}>
              Your counter operator clicks "Dispatch Print" or enables auto-printing. Customer shows their 4-digit token and collects.
            </p>
          </div>
        </div>
      </section>

      {/* Feature Deep Dive Showcase */}
      <section style={{ backgroundColor: '#F7F8FA', padding: '5rem 1.5rem', borderTop: '1px solid #E4E7EC', borderBottom: '1px solid #E4E7EC' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#182230', marginBottom: '0.5rem' }}>
              Complete Solutions Suite
            </h2>
            <p style={{ color: '#667085', fontSize: '1rem' }}>
              Explore how each module works together seamlessly in your shop.
            </p>

            {/* Feature Tabs */}
            <div style={{ display: 'inline-flex', gap: '0.5rem', backgroundColor: '#EDF0F7', padding: '0.375rem', borderRadius: '10px', marginTop: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { key: 'qr', label: 'QR Ordering System' },
                { key: 'whatsapp', label: 'WhatsApp Automation' },
                { key: 'routing', label: 'Printer Spooler Routing' },
                { key: 'queue', label: 'Order Queue & Ledger' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveFeatureTab(t.key as any)}
                  className={`btn ${activeFeatureTab === t.key ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ border: 'none', fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content Display */}
          <div className="card" style={{ padding: '2.5rem' }}>
            {activeFeatureTab === 'qr' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'center' }}>
                <div>
                  <span className="badge badge-info" style={{ marginBottom: '0.75rem' }}>Self-Service QR Standee</span>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>Dedicated Counter QR Intake Portal</h3>
                  <p style={{ color: '#667085', fontSize: '0.9375rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                    Display a printable acrylic counter standee with your shop's permanent URL (`/p/your_shop`). Customers scan with Google Lens, Paytm, or standard iPhone/Android camera to upload their files in seconds.
                  </p>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: '#344054' }}>
                    <li>✓ No customer registration required for quick counter printing</li>
                    <li>✓ Up to 10 MB per file (PDF, Word, Excel, PowerPoint, Images)</li>
                    <li>✓ Automatic page count detection and page range filtering</li>
                    <li>✓ Live status tracking screen with 4-digit token</li>
                  </ul>
                </div>
                <div style={{ backgroundColor: '#182230', borderRadius: '12px', padding: '2rem', color: '#FFFFFF', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#8EA7FF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Countertop Standee Preview</div>
                  <div style={{ width: '120px', height: '120px', backgroundColor: '#FFFFFF', borderRadius: '10px', margin: '1rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#182230' }}>
                    <QrCodeIcon size={80} />
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1.125rem' }}>Campus Print Express</div>
                  <div style={{ color: '#98A2B3', fontSize: '0.8125rem', marginTop: '0.25rem' }}>Open shop order page • inklly.com/p/campus1</div>
                </div>
              </div>
            )}

            {activeFeatureTab === 'whatsapp' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'center' }}>
                <div>
                  <span className="badge badge-warning" style={{ marginBottom: '0.75rem' }}>Planned integration</span>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>WhatsApp ordering is not active</h3>
                  <p style={{ color: '#667085', fontSize: '0.9375rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                    The current preview accepts requests through the shop QR page. WhatsApp intake, replies, and status notifications are planned and are not available yet.
                  </p>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: '#344054' }}>
                    <li>WhatsApp Business connection is not configured.</li>
                    <li>Automated order notifications are not active.</li>
                  </ul>
                </div>
                <div style={{ backgroundColor: '#F0F9FF', border: '1px solid #B9E6FE', borderRadius: '12px', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#026AA2', marginBottom: '0.75rem' }}>Future integration preview</div>
                  <div style={{ backgroundColor: '#FFFFFF', padding: '1rem', borderRadius: '8px', border: '1px solid #D0D5DD', fontSize: '0.875rem', color: '#182230' }}>
                    {"Hello "}<span style={{ color: '#4A69ED' }}>{"{{customer_name}}"}</span>{"! Your print order "}<span style={{ color: '#4A69ED' }}>{"#{{order_number}}"}</span>{" has been printed and verified. Please collect it from Counter 1."}
                  </div>
                </div>
              </div>
            )}

            {activeFeatureTab === 'routing' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'center' }}>
                <div>
                  <span className="badge badge-info" style={{ marginBottom: '0.75rem' }}>Desktop Edge Spooler</span>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>Multi-Printer Routing & Tray Discovery</h3>
                  <p style={{ color: '#667085', fontSize: '0.9375rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                    The paired Windows agent reports its locally discovered printer queues. Driver features and physical output vary by setup and must be verified on the shop's actual hardware.
                  </p>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: '#344054' }}>
                    <li>Queue inventory comes from the paired agent, not a sample device list.</li>
                    <li>Driver capabilities are not verified by this preview.</li>
                    <li>The local queue persists work across agent restarts.</li>
                    <li>Ambiguous output is held for staff review and is never retried automatically.</li>
                  </ul>
                </div>
                <div style={{ backgroundColor: '#182230', borderRadius: '12px', padding: '1.5rem', color: '#FFFFFF', fontFamily: 'JetBrains Mono', fontSize: '0.75rem' }}>
                  <div style={{ color: '#8EA7FF', marginBottom: '0.5rem' }}>Illustrative agent view · no live hardware data</div>
                  <div style={{ color: '#98A2B3' }}>A connected shop sees queues reported by its paired agent.</div>
                  <div style={{ margin: '0.75rem 0', padding: '0.75rem', border: '1px solid #344054', borderRadius: '8px' }}>Capabilities and online state appear only when reported by the actual agent.</div>
                  <div style={{ color: '#98A2B3', marginTop: '0.5rem' }}>Spooler submission does not confirm physical pages.</div>
                </div>
              </div>
            )}

            {activeFeatureTab === 'queue' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'center' }}>
                <div>
                  <span className="badge badge-warning" style={{ marginBottom: '0.75rem' }}>Queue & Finance</span>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>7-Status Queue & Dual Financial Ledgers</h3>
                  <p style={{ color: '#667085', fontSize: '0.9375rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                    Review shop orders, release eligible work, inspect physical output, and record cash through the ledger-backed payment workflow. Shops can enable Razorpay with their own account and webhook credentials.
                  </p>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: '#344054' }}>
                    <li>Cash collection can be recorded by shop staff.</li>
                    <li>Uncertain print output requires staff inspection; retries are not automatic.</li>
                    <li>Staff access is scoped by shop membership and permissions.</li>
                    <li>Revenue uses payment records rather than order status.</li>
                  </ul>
                </div>
                <div aria-label="Illustrative sample order, not live merchant data" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E4E7EC', borderRadius: '12px', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#667085', marginBottom: '0.75rem' }}>ILLUSTRATIVE SAMPLE · NOT LIVE DATA</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.8125rem' }}>
                    <strong>Order #INK-20261025-001</strong>
                    <span className="badge badge-success">READY FOR PICKUP</span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#344054', marginBottom: '0.5rem' }}>Aarav Sharma • 10 pages B&W Simplex</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid #F2F4F7' }}>
                    <span style={{ fontWeight: 700, color: '#4A69ED' }}>₹20.00 (Cash at counter)</span>
                    <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>Mark Collected</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section style={{ backgroundColor: '#EDF0F7', padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Pilot pricing, agreed with each shop</h2>
          <p style={{ color: '#667085', marginBottom: '2.5rem' }}>
            Inklly plans a monthly subscription plus a configurable fee per successfully printed side. Rates and limits are not published or charged from this preview.
          </p>
          <div className="card" style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem', textAlign: 'left' }}>
            <span className="badge badge-info" style={{ marginBottom: '0.75rem' }}>Configurable pilot</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>No fixed tiers or usage charges yet</h3>
            <p style={{ color: '#667085', fontSize: '0.9375rem', lineHeight: 1.6, marginTop: '0.5rem' }}>
              The subscription checkout, per-side usage meter, and quota enforcement are not active. A shop-specific pilot agreement will state the monthly base price, per-successful-side rate, and included limits before billing begins.
            </p>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section style={{ padding: '5rem 1.5rem', maxWidth: '840px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#182230', marginBottom: '0.5rem' }}>
            Frequently Asked Questions
          </h2>
          <p style={{ color: '#667085', fontSize: '1rem' }}>
            Everything you need to know about setting up Inklly in your shop.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            {
              q: 'Do customers need to download an app or create an account?',
              a: 'No. Customers open the shop link or scan its QR code in a mobile browser. The preview does not provide a physical standee.',
            },
            {
              q: 'Does Inklly work with my existing printers and computers?',
              a: 'Inklly is designed for existing photocopy and print shops. The current desktop agent targets Windows. Printer discovery reports local queues, but compatibility, capabilities, and physical output must be verified on each shop’s hardware.',
            },
            {
              q: 'Can customers still pay cash at my counter?',
              a: 'Customers can pay cash on collection. A shop may also enable Razorpay checkout after its owner saves valid shop credentials and a webhook secret. Cash is recorded through the ledger-backed collection action; online availability depends on that shop’s setup.',
            },
            {
              q: 'What happens if a printer runs out of paper or jams?',
              a: 'The agent does not reliably detect every paper jam or confirm physical pages. If output is uncertain, the order stays under review for staff inspection; the system does not automatically retry it.',
            },
            {
              q: 'Can I set my own custom rates for B&W, Color, and duplex printing?',
              a: 'Yes. You have complete control over your shop rates. You can configure per-side pricing for A4, A3, and Photo sizes, set duplex discounts, and enable bulk volume discounts for large orders.',
            },
          ].map((faq, idx) => (
            <div key={idx} className="card" style={{ padding: '1.25rem 1.5rem', cursor: 'pointer' }} onClick={() => toggleFaq(idx)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '1rem', color: '#182230' }}>{faq.q}</strong>
                <span style={{ fontSize: '1.25rem', color: '#4A69ED' }}>{expandedFaq === idx ? '−' : '+'}</span>
              </div>
              {expandedFaq === idx && (
                <p style={{ color: '#667085', fontSize: '0.875rem', marginTop: '0.75rem', lineHeight: 1.6, borderTop: '1px solid #F2F4F7', paddingTop: '0.75rem' }}>
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ backgroundColor: '#182230', color: '#98A2B3', padding: '3.5rem 1.5rem', marginTop: 'auto', fontSize: '0.875rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#FFFFFF', fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.25rem' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#4A69ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem' }}>I</div>
              Inklly
            </div>
            <p>Smart Print-Shop Automation & Self-Service Document OS</p>
            <p style={{ fontSize: '0.75rem', color: '#667085', marginTop: '0.5rem' }}>© 2026 Inklly Inc. All rights reserved.</p>
          </div>
          <div style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap' }}>
            <span style={{ cursor: 'pointer', color: '#FFFFFF' }} onClick={() => onNavigate('customer_portal')}>Customer QR Portal</span>
            <span style={{ cursor: 'pointer', color: '#FFFFFF' }} onClick={() => onNavigate('merchant_dashboard')}>Merchant Workspace</span>
            <span style={{ cursor: 'pointer', color: '#FFFFFF' }} onClick={() => onNavigate('platform_admin')}>Platform Owner</span>
            <span style={{ cursor: 'pointer', color: '#FFFFFF' }} onClick={() => onNavigate('developer_portal')}>Developer API</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
