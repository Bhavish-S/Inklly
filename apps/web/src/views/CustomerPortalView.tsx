import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { UploadCloudIcon, FileTextIcon, DollarSignIcon } from '../components/icons';

interface CustomerPortalViewProps {
  shopCode: string;
  onOrderSubmitted: (orderId: string) => void;
}

interface UploadedFileItem {
  id: string;
  file: File;
  fileName: string;
  pageCount: number;
  options: {
    colorMode: 'bw' | 'color';
    duplexMode: 'simplex' | 'duplex_auto';
    paperSize: 'A4' | 'A3' | 'PHOTO_4X6';
    copies: number;
    pageRange?: string;
  };
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({ shopCode, onOrderSubmitted }) => {
  const [shop, setShop] = useState<any>(null);
  const [loadingShop, setLoadingShop] = useState(true);
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [quote, setQuote] = useState<any>(null);
  const [calculatingQuote, setCalculatingQuote] = useState(false);

  // Customer form details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH_ON_COLLECTION' | 'ONLINE_RAZORPAY'>('CASH_ON_COLLECTION');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadShop();
  }, [shopCode]);

  const loadShop = async () => {
    try {
      setLoadingShop(true);
      const data = await api.getShop(shopCode);
      setShop(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load shop');
    } finally {
      setLoadingShop(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newItems: UploadedFileItem[] = [];

    Array.from(e.target.files).forEach((file) => {
      // Approximate pages or default to 5 for simulation
      const estimatedPages = Math.max(1, Math.round(file.size / (100 * 1024)));
      newItems.push({
        id: `f-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        file,
        fileName: file.name,
        pageCount: estimatedPages,
        options: {
          colorMode: 'bw',
          duplexMode: 'simplex',
          paperSize: 'A4',
          copies: 1,
        },
      });
    });

    setFiles((prev) => [...prev, ...newItems]);
  };

  const updateFileOption = (fileId: string, updates: Partial<UploadedFileItem['options']>) => {
    setFiles((prev) =>
      prev.map((item) => {
        if (item.id === fileId) {
          return { ...item, options: { ...item.options, ...updates } };
        }
        return item;
      })
    );
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // Recalculate quote whenever files or options change
  useEffect(() => {
    if (files.length === 0) {
      setQuote(null);
      return;
    }

    const fetchQuote = async () => {
      setCalculatingQuote(true);
      try {
        const payload = {
          shopId: 'shop-campus-1',
          files: files.map((f) => ({
            fileId: f.id,
            fileName: f.fileName,
            pageCount: f.pageCount,
            options: {
              ...f.options,
              orientation: 'portrait',
              fitMode: 'fit',
              pagesPerSheet: 1,
              collation: true,
            },
          })),
        };
        const result = await api.getQuote(payload);
        setQuote(result);
      } catch (err: any) {
        console.error('Quote error:', err);
      } finally {
        setCalculatingQuote(false);
      }
    };

    const timer = setTimeout(fetchQuote, 250);
    return () => clearTimeout(timer);
  }, [files]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0 || !quote) return;

    try {
      setSubmitting(true);
      setError(null);

      const orderPayload = {
        shopId: 'shop-campus-1',
        customerName: customerName || 'Counter Guest',
        customerPhone,
        customerEmail,
        paymentMethod,
        quote,
        files: files.map((f, idx) => ({
          fileName: f.fileName,
          pageCount: f.pageCount,
          options: f.options,
          subtotalPaise: quote.lineItems?.[idx]?.subtotalPaise || 200,
        })),
      };

      const res = await api.submitOrder(orderPayload);
      onOrderSubmitted(res.orderId);
    } catch (err: any) {
      setError(err.message || 'Order submission failed');
      setSubmitting(false);
    }
  };

  if (loadingShop) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: '#667085' }}>
        Loading shop portal...
      </div>
    );
  }

  if (error && !shop) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: '#B42318' }}>
        <h3>Shop not available</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '0 1rem' }}>
      {/* Shop Header Banner */}
      <div className="card" style={{ marginBottom: '1.5rem', backgroundColor: '#FFFFFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#182230' }}>{shop.name}</h1>
              <span className="badge badge-success">Online & Accepting Prints</span>
            </div>
            <p style={{ color: '#667085', fontSize: '0.875rem' }}>{shop.tagline}</p>
            <p style={{ color: '#98A2B3', fontSize: '0.8125rem', marginTop: '0.25rem' }}>📍 {shop.address} | 📞 {shop.phone}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: '#667085', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shop QR Code</span>
            <div style={{ fontWeight: 700, fontSize: '1.125rem', color: '#4A69ED' }}>/{shop.shopCode}</div>
          </div>
        </div>
      </div>

      {/* Main Upload & Configuration Flow */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Left Column: Upload & Document Studio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* File Upload Dropzone */}
          <div className="card" style={{ textAlign: 'center', borderStyle: 'dashed', borderWidth: '2px', borderColor: '#D0D5DD', padding: '2rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#EEF2FF', color: '#4A69ED', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <UploadCloudIcon size={24} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Upload Documents to Print</h3>
            <p style={{ color: '#667085', fontSize: '0.8125rem', marginBottom: '1.25rem' }}>
              PDF, Word (.docx), PPTX, JPG, PNG (up to 10 MB each)
            </p>
            <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
              Select Files
              <input type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleFileUpload} />
            </label>
          </div>

          {/* Configured Files List */}
          {files.map((fileItem, idx) => (
            <div key={fileItem.id} className="card" style={{ borderLeft: '4px solid #4A69ED' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileTextIcon size={20} color="#4A69ED" />
                  <div>
                    <strong style={{ fontSize: '0.9375rem' }}>{fileItem.fileName}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#667085' }}>{fileItem.pageCount} pages detected</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(fileItem.id)}
                  style={{ background: 'none', border: 'none', color: '#F04438', fontSize: '0.8125rem', fontWeight: 600 }}
                >
                  Remove
                </button>
              </div>

              {/* Print Options Form */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8125rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', color: '#344054' }}>Color</label>
                  <select
                    className="input-field"
                    value={fileItem.options.colorMode}
                    onChange={(e) => updateFileOption(fileItem.id, { colorMode: e.target.value as any })}
                  >
                    <option value="bw">Black & White (B&W)</option>
                    <option value="color">Full Color</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', color: '#344054' }}>Sides</label>
                  <select
                    className="input-field"
                    value={fileItem.options.duplexMode}
                    onChange={(e) => updateFileOption(fileItem.id, { duplexMode: e.target.value as any })}
                  >
                    <option value="simplex">Single Sided</option>
                    <option value="duplex_auto">Double Sided (Duplex)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', color: '#344054' }}>Paper Size</label>
                  <select
                    className="input-field"
                    value={fileItem.options.paperSize}
                    onChange={(e) => updateFileOption(fileItem.id, { paperSize: e.target.value as any })}
                  >
                    <option value="A4">A4 (Standard)</option>
                    <option value="A3">A3 (Large)</option>
                    <option value="PHOTO_4X6">Photo 4x6 Glossy</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', color: '#344054' }}>Copies</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="input-field"
                    value={fileItem.options.copies}
                    onChange={(e) => updateFileOption(fileItem.id, { copies: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  />
                </div>
              </div>

              {/* Itemized Line Cost */}
              {quote?.lineItems?.[idx] && (
                <div style={{ marginTop: '0.875rem', paddingTop: '0.75rem', borderTop: '1px solid #F2F4F7', display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span style={{ color: '#667085' }}>
                    {quote.lineItems[idx].printedSides} sides × ₹{(quote.lineItems[idx].unitPricePaise / 100).toFixed(2)}
                  </span>
                  <strong style={{ color: '#182230' }}>
                    ₹{(quote.lineItems[idx].subtotalPaise / 100).toFixed(2)}
                  </strong>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right Column: Quotation Breakdown & Checkout */}
        <div>
          <div className="card" style={{ position: 'sticky', top: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSignIcon size={18} color="#4A69ED" />
              Transparent Price Quotation
            </h3>

            {files.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#98A2B3', fontSize: '0.875rem' }}>
                Upload a document to view real-time itemized pricing
              </div>
            ) : (
              <form onSubmit={handleSubmitOrder}>
                {/* Quotation Itemization */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#667085' }}>
                    <span>Subtotal</span>
                    <span>₹{((quote?.subtotalPaise || 0) / 100).toFixed(2)}</span>
                  </div>

                  {quote?.bulkDiscountPaise > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#12B76A' }}>
                      <span>Bulk Order Discount</span>
                      <span>-₹{(quote.bulkDiscountPaise / 100).toFixed(2)}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.125rem', color: '#182230', paddingTop: '0.5rem', borderTop: '1px solid #E4E7EC' }}>
                    <span>Total Amount</span>
                    <span style={{ color: '#4A69ED' }}>₹{((quote?.totalPaise || 0) / 100).toFixed(2)}</span>
                  </div>
                </div>

                {/* Customer Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Your Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      className="input-field"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Mobile Phone (for Pickup SMS)</label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      className="input-field"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </div>

                  {/* Payment Method Selection */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>Payment Method</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="payment"
                          checked={paymentMethod === 'CASH_ON_COLLECTION'}
                          onChange={() => setPaymentMethod('CASH_ON_COLLECTION')}
                        />
                        <span>Pay Cash at Counter on Collection</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="payment"
                          checked={paymentMethod === 'ONLINE_RAZORPAY'}
                          onChange={() => setPaymentMethod('ONLINE_RAZORPAY')}
                        />
                        <span>Instant UPI / Razorpay (Priority Dispatch)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {error && (
                  <div style={{ color: '#B42318', backgroundColor: '#FEF3F2', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || calculatingQuote || !quote}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.875rem', fontSize: '1rem' }}
                >
                  {submitting ? 'Submitting Order...' : `Submit Order • ₹${((quote?.totalPaise || 0) / 100).toFixed(2)}`}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
