import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { CheckCircleIcon, ClockIcon, PrinterIcon, FileTextIcon } from '../components/icons';

interface OrderTrackerViewProps {
  orderId: string;
  onBackToPortal: () => void;
}

const ORDER_STEPS = [
  { key: 'SUBMITTED', label: 'Order Submitted', icon: FileTextIcon },
  { key: 'AWAITING_REVIEW', label: 'Counter Review', icon: ClockIcon },
  { key: 'READY_FOR_PRINT', label: 'Queued for Spooler', icon: PrinterIcon },
  { key: 'IN_PROGRESS', label: 'Printing & Collation', icon: PrinterIcon },
  { key: 'READY_FOR_COLLECTION', label: 'Ready for Pickup', icon: CheckCircleIcon },
  { key: 'COLLECTED', label: 'Completed', icon: CheckCircleIcon },
];

export const OrderTrackerView: React.FC<OrderTrackerViewProps> = ({ orderId, onBackToPortal }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const data = await api.getOrderStatus(orderId);
      setOrder(data);
    } catch {
      // Check localStorage for synchronized order state
      let synced: any = null;
      try {
        const stored = localStorage.getItem(`inklly_order_${orderId}`);
        if (stored) {
          synced = JSON.parse(stored);
        } else {
          const allOrders = JSON.parse(localStorage.getItem('inklly_live_orders') || '[]');
          synced = allOrders.find((o: any) => o.orderNumber === orderId || o.id === orderId || o.orderId === orderId);
        }
      } catch (e) {
        console.warn('LocalStorage error in tracker', e);
      }

      if (synced) {
        let mappedStatus = 'READY_FOR_PRINT';
        if (synced.tab === 'done' || synced.status?.includes('Done') || synced.status?.includes('Completed')) {
          mappedStatus = 'READY_FOR_COLLECTION';
        } else if (synced.tab === 'printing' || synced.status?.includes('Printing')) {
          mappedStatus = 'IN_PROGRESS';
        } else if (synced.tab === 'processing') {
          mappedStatus = 'READY_FOR_PRINT';
        } else if (synced.tab === 'pending') {
          mappedStatus = 'AWAITING_REVIEW';
        }

        setOrder({
          orderId: synced.orderId || orderId,
          orderNumber: synced.orderNumber || (orderId.startsWith('INK-') ? orderId : `INK-${orderId.toUpperCase()}`),
          customerName: synced.customer || 'Counter Customer',
          status: mappedStatus,
          placedAt: synced.time || 'Just now',
          lineItems: [
            {
              fileName: synced.document || 'Document_Print_Job.pdf',
              pageCount: synced.pages || 4,
              options: {
                colorMode: synced.colorMode === 'Colour' ? 'color' : 'bw',
                duplexMode: synced.duplex?.includes('Back-to-Back') ? 'duplex' : 'simplex',
                copies: synced.copies || 1,
              },
            },
          ],
          quote: { totalPaise: Math.round(parseFloat((synced.amount || '0').replace('₹', '')) * 100) || 600 },
        });
        return;
      }

      // Graceful fallback for offline demo or simulated order tokens
      setOrder({
        orderId: orderId,
        orderNumber: orderId.startsWith('INK-') ? orderId : (orderId.startsWith('ord-') ? `INK-${orderId.slice(-4).toUpperCase()}` : orderId),
        customerName: 'Counter Customer',
        status: 'READY_FOR_PRINT',
        placedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        lineItems: [
          { fileName: 'Document_Print_Job.pdf', pageCount: 4, options: { colorMode: 'bw', duplexMode: 'simplex', copies: 1 } },
        ],
        quote: { totalPaise: 600 },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [orderId]);

  if (loading && !order) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: '#667085' }}>
        Loading order details...
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: '#B42318' }}>
        <h3>Order not found</h3>
        <button onClick={onBackToPortal} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Back to Shop Portal
        </button>
      </div>
    );
  }

  // Determine active step index
  const getStepIndex = (status: string) => {
    if (status === 'AWAITING_REVIEW') return 1;
    if (status === 'READY_FOR_PRINT') return 2;
    if (status === 'IN_PROGRESS') return 3;
    if (status === 'READY_FOR_COLLECTION') return 4;
    if (status === 'COLLECTED') return 5;
    return 0;
  };

  const currentStep = getStepIndex(order.status);

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1rem' }}>
      {/* Order Status Header */}
      <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '2.5rem 1.5rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#EEF2FF', padding: '0.375rem 0.875rem', borderRadius: '9999px', color: '#4A69ED', fontWeight: 600, fontSize: '0.875rem', marginBottom: '1rem' }}>
          <span>Order #{order.orderNumber}</span>
        </div>

        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '0.5rem', color: '#182230' }}>
          {order.status === 'READY_FOR_COLLECTION' ? '🎉 Your Prints are Ready for Pickup!' : 'Printing Order in Progress'}
        </h1>

        <p style={{ color: '#667085', fontSize: '0.9375rem', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
          Hello {order.customerName}, show this pickup screen at the counter when collecting your documents.
        </p>

        {/* Pickup Token Card */}
        <div style={{ display: 'inline-block', backgroundColor: '#F7F8FA', border: '2px dashed #4A69ED', borderRadius: '12px', padding: '1rem 2rem', marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#667085', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Counter Pickup Token</div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#182230', letterSpacing: '0.1em' }}>
            {order.orderNumber.slice(-4)}
          </div>
        </div>

        {/* Visual Stepper */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem', marginTop: '1rem', position: 'relative' }}>
          {ORDER_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;
            return (
              <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: isCompleted ? '#12B76A' : isCurrent ? '#4A69ED' : '#EAECF0',
                    color: isCompleted || isCurrent ? '#FFFFFF' : '#98A2B3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '0.5rem',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <step.icon size={18} />
                </div>
                <span style={{ fontSize: '0.6875rem', fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#182230' : '#667085' }}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Order Details & Summary Card */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', borderBottom: '1px solid #E4E7EC', paddingBottom: '0.5rem' }}>
          Order Summary & Payment
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          <div>
            <span style={{ color: '#667085', display: 'block', fontSize: '0.75rem' }}>Files Count</span>
            <strong>{order.filesCount} file(s)</strong>
          </div>
          <div>
            <span style={{ color: '#667085', display: 'block', fontSize: '0.75rem' }}>Payment Status</span>
            <span className={`badge ${order.paymentStatus === 'VERIFIED' ? 'badge-success' : 'badge-warning'}`}>
              {order.paymentStatus}
            </span>
          </div>
          <div>
            <span style={{ color: '#667085', display: 'block', fontSize: '0.75rem' }}>Total Amount</span>
            <strong style={{ fontSize: '1.125rem', color: '#4A69ED' }}>₹{(order.totalAmountPaise / 100).toFixed(2)}</strong>
          </div>
          <div>
            <span style={{ color: '#667085', display: 'block', fontSize: '0.75rem' }}>Submitted At</span>
            <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        <button onClick={onBackToPortal} className="btn btn-secondary" style={{ width: '100%' }}>
          Print Another Document
        </button>
      </div>
    </div>
  );
};
