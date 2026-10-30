import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { CheckCircleIcon, ClockIcon, PrinterIcon, FileTextIcon } from '../components/icons';
import { stopCustomerOrderPollingIfFinal } from '../order-tracker-polling.mjs';

interface OrderTrackerViewProps {
  orderId: string;
  onBackToPortal: () => void;
}

const ORDER_STEPS = [
  { key: 'SUBMITTED', label: 'Order Submitted', icon: FileTextIcon },
  { key: 'AWAITING_PAYMENT', label: 'Payment', icon: ClockIcon },
  { key: 'AWAITING_REVIEW', label: 'Counter Review', icon: ClockIcon },
  { key: 'READY_FOR_PRINT', label: 'Queued for Spooler', icon: PrinterIcon },
  { key: 'IN_PROGRESS', label: 'Printing & Collation', icon: PrinterIcon },
  { key: 'READY_FOR_COLLECTION', label: 'Ready for Pickup', icon: CheckCircleIcon },
  { key: 'COLLECTED', label: 'Completed', icon: CheckCircleIcon },
];

export const OrderTrackerView: React.FC<OrderTrackerViewProps> = ({ orderId, onBackToPortal }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let interval: number | undefined;
    setLoading(true);
    setError(null);
    if (!orderId) {
      setOrder(null);
      setError('This tracking link is missing its order reference. Open the link from your order confirmation.');
      setLoading(false);
      return;
    }
    const fetchStatus = async () => {
      if (inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const data = await api.getOrderStatus(orderId);
        if (active) {
          setOrder(data);
          setError(null);
          if (stopCustomerOrderPollingIfFinal(data.status, interval, window.clearInterval)) interval = undefined;
        }
      } catch {
        if (active) setError('We could not refresh this order right now. Check your connection and try again.');
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    };
    interval = window.setInterval(() => void fetchStatus(), 10000);
    void fetchStatus();
    return () => {
      active = false;
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [orderId, retryCount]);

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
        <h3>{error ? 'Order details unavailable' : 'Order not found'}</h3>
        <p style={{ marginTop: '0.5rem' }}>{error || 'Check the order link and try again.'}</p>
        <button onClick={() => { setLoading(true); setRetryCount((count) => count + 1); }} className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={loading || !orderId}>
          {loading ? 'Checking…' : 'Try again'}
        </button>
        <button onClick={onBackToPortal} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Back to Shop Portal
        </button>
      </div>
    );
  }

  // Determine active step index
  const getStepIndex = (status: string) => {
    if (status === 'AWAITING_PAYMENT') return 1;
    if (status === 'AWAITING_REVIEW') return 2;
    if (status === 'READY_FOR_PRINT') return 3;
    if (status === 'IN_PROGRESS') return 4;
    if (status === 'READY_FOR_COLLECTION') return 5;
    if (status === 'COLLECTED') return 6;
    return 0;
  };

  const currentStep = getStepIndex(order.status);
  const terminalIssue = ['CANCELLED', 'REJECTED', 'PRINT_FAILED', 'PRINT_UNCONFIRMED', 'FAILED_REQUIRES_SUPPORT', 'ON_HOLD'].includes(order.status);
  const statusTitle = order.status === 'AWAITING_PAYMENT'
    ? 'Payment required to continue'
    : order.status === 'CANCELLED' || order.status === 'REJECTED'
      ? 'This order was cancelled'
      : ['PRINT_FAILED', 'PRINT_UNCONFIRMED', 'FAILED_REQUIRES_SUPPORT', 'ON_HOLD'].includes(order.status)
        ? 'This order needs the shop’s attention'
        : order.status === 'COLLECTED'
          ? 'Your order has been collected'
          : order.status === 'READY_FOR_COLLECTION'
            ? 'Your order is ready for pickup'
            : 'Your order is being processed';
  const statusDescription = order.status === 'AWAITING_PAYMENT'
    ? 'Complete payment to send this order to the shop. The shop has not started processing it yet.'
    : order.status === 'CANCELLED' || order.status === 'REJECTED'
      ? 'Contact the shop if you need help with this order.'
      : ['PRINT_FAILED', 'PRINT_UNCONFIRMED', 'FAILED_REQUIRES_SUPPORT', 'ON_HOLD'].includes(order.status)
        ? 'Please contact the shop before collecting or placing this order again.'
        : order.status === 'COLLECTED'
          ? 'This order has been marked as collected.'
          : order.status === 'READY_FOR_COLLECTION'
            ? 'Show your pickup token at the counter to collect your order.'
            : `Hello ${order.customerName || 'there'}, we’ll update this page as the shop processes your order.`;

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1rem' }}>
      {/* Screen Reader Live Region for Order Transitions (WCAG 2.2 SC 4.1.3) */}
      <div 
        role="status" 
        aria-live="polite" 
        className="sr-only"
        style={{ position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: 0, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}
      >
        {order.status === 'READY_FOR_COLLECTION' 
          ? 'Your order is ready for pickup at the counter' 
          : order.status === 'IN_PROGRESS' 
          ? 'Your documents are currently printing on the spooler' 
          : `Order status: ${ORDER_STEPS[currentStep]?.label || order.status}`}
      </div>

      {/* Order Status Header */}
      <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '2.5rem 1.5rem' }}>
        {error && <p role="status" className="mb-3 text-sm text-amber-700">{error} Showing the last status we received.</p>}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#EEF2FF', padding: '0.375rem 0.875rem', borderRadius: '9999px', color: '#4A69ED', fontWeight: 600, fontSize: '0.875rem', marginBottom: '1rem' }}>
          <span>Order #{order.orderNumber}</span>
        </div>

        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '0.5rem', color: '#182230' }}>
          {statusTitle}
        </h1>

        <p style={{ color: '#667085', fontSize: '0.9375rem', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
          {statusDescription}
        </p>

        {/* Pickup Token Card */}
        {order.tokenNumber && !terminalIssue && <div style={{ display: 'inline-block', backgroundColor: '#F7F8FA', border: '2px dashed #4A69ED', borderRadius: '12px', padding: '1rem 2rem', marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#667085', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Counter Pickup Token</div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#182230', letterSpacing: '0.1em' }}>
            {order.tokenNumber || '—'}
          </div>
        </div>}

        {/* Visual Stepper */}
        {!terminalIssue && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginTop: '1rem', position: 'relative' }}>
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
        </div>}
      </div>

      {/* Order Details & Summary Card */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', borderBottom: '1px solid #E4E7EC', paddingBottom: '0.5rem' }}>
          Order Summary & Payment
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          <div>
            <span style={{ color: '#667085', display: 'block', fontSize: '0.75rem' }}>Files Count</span>
            <strong>{order.filesCount ?? 0} file(s)</strong>
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
