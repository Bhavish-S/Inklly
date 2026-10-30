import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { CheckCircleIcon, ClockIcon, PrinterIcon, FileTextIcon, ArrowRightIcon } from '../components/icons';
import { stopCustomerOrderPollingIfFinal } from '../order-tracker-polling.mjs';

interface OrderTrackerViewProps {
  orderId: string;
  onBackToPortal: () => void;
}

const ORDER_STEPS = [
  { key: 'SUBMITTED', label: 'Submitted', description: 'Order received by system', icon: FileTextIcon },
  { key: 'AWAITING_PAYMENT', label: 'Payment', description: 'Counter or UPI checkout', icon: ClockIcon },
  { key: 'AWAITING_REVIEW', label: 'Review', description: 'Counter staff verification', icon: ClockIcon },
  { key: 'READY_FOR_PRINT', label: 'Queued', description: 'Assigned to spooler', icon: PrinterIcon },
  { key: 'IN_PROGRESS', label: 'Printing', description: 'Hardware spooling active', icon: PrinterIcon },
  { key: 'READY_FOR_COLLECTION', label: 'Ready', description: 'Available at pickup counter', icon: CheckCircleIcon },
  { key: 'COLLECTED', label: 'Completed', description: 'Handed over to customer', icon: CheckCircleIcon },
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
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-2 border-brand/20 border-t-brand rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-ink-text-secondary dark:text-ink-dark-text-secondary">Loading live order status…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 rounded-2xl bg-ink-surface dark:bg-ink-dark-surface border border-ink-border dark:border-ink-dark-border text-center shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-status-danger-bg text-status-danger flex items-center justify-center mx-auto mb-4 font-bold text-lg">
          !
        </div>
        <h3 className="text-lg font-bold text-ink-text dark:text-ink-dark-text">
          {error ? 'Order details unavailable' : 'Order not found'}
        </h3>
        <p className="mt-2 text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary leading-relaxed">
          {error || 'Check the order link and try again.'}
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={() => { setLoading(true); setRetryCount((count) => count + 1); }}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
            disabled={loading || !orderId}
          >
            {loading ? 'Checking…' : 'Try again'}
          </button>
          <button
            onClick={onBackToPortal}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-ink-surface-subtle dark:bg-ink-dark-elevated text-ink-text dark:text-ink-dark-text hover:bg-ink-surface-muted border border-ink-border dark:border-ink-dark-border text-sm font-medium transition-all cursor-pointer"
          >
            Back to Shop Portal
          </button>
        </div>
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
        ? 'This order needs shop attention'
        : order.status === 'COLLECTED'
          ? 'Order collected'
          : order.status === 'READY_FOR_COLLECTION'
            ? 'Ready for pickup'
            : 'Processing print job';

  const statusDescription = order.status === 'AWAITING_PAYMENT'
    ? 'Complete payment at counter or online to send this order to the printer.'
    : order.status === 'CANCELLED' || order.status === 'REJECTED'
      ? 'Contact the shop counter if you need assistance with this order.'
      : ['PRINT_FAILED', 'PRINT_UNCONFIRMED', 'FAILED_REQUIRES_SUPPORT', 'ON_HOLD'].includes(order.status)
        ? 'Please contact counter staff before collecting or re-submitting this print job.'
        : order.status === 'COLLECTED'
          ? 'This order has been verified and marked as collected.'
          : order.status === 'READY_FOR_COLLECTION'
            ? 'Show your pickup token at the counter to collect your printed documents.'
            : `Hello ${order.customerName || 'there'}, this page will automatically update as your documents are printed.`;

  return (
    <div className="max-w-2xl mx-auto my-8 sm:my-12 px-4">
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

      {/* Main Order Card */}
      <div className="rounded-2xl border border-ink-border dark:border-ink-dark-border bg-ink-surface dark:bg-ink-dark-surface p-6 sm:p-8 shadow-xs mb-6 text-center">
        {error && (
          <div role="status" className="mb-4 p-3 rounded-xl bg-status-warning-bg text-status-warning text-xs font-medium border border-status-warning/20">
            {error} Showing last known status.
          </div>
        )}

        {/* Order Identifier Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-soft dark:bg-brand-dark-soft text-brand dark:text-brand-dark text-xs font-semibold mb-4">
          <span className="font-mono">Order #{order.orderNumber}</span>
          {order.status === 'IN_PROGRESS' && (
            <span className="w-1.5 h-1.5 rounded-full bg-status-teal animate-pulse" />
          )}
        </div>

        {/* Status Headline */}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-text dark:text-ink-dark-text mb-2">
          {statusTitle}
        </h1>

        <p className="text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary max-w-md mx-auto mb-6 leading-relaxed">
          {statusDescription}
        </p>

        {/* Counter Pickup Token Card */}
        {order.tokenNumber && !terminalIssue && (
          <div className="inline-block bg-ink-surface-subtle dark:bg-ink-dark-elevated border-2 border-dashed border-brand/50 rounded-3xl px-8 py-5 mb-8 shadow-xs">
            <span className="text-[11px] font-bold text-ink-text-muted dark:text-ink-dark-text-muted uppercase tracking-wider block mb-1">
              Counter Pickup Token
            </span>
            <div className="text-4xl sm:text-5xl font-black font-mono text-brand dark:text-brand-dark tracking-widest my-1">
              {order.tokenNumber.startsWith('T-') ? `#${order.tokenNumber.slice(2)}` : order.tokenNumber}
            </div>
            <p className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary mt-1 font-medium">
              Tell counter staff: <strong className="text-brand dark:text-brand-dark font-bold font-mono">Token {order.tokenNumber.replace(/^T-/, '')}</strong>
            </p>
          </div>
        )}

        {/* Linear Stepper Progress Bar */}
        {!terminalIssue && (
          <div className="mt-2 pt-6 border-t border-ink-border dark:border-ink-dark-border">
            <div className="hidden sm:grid grid-cols-7 gap-2">
              {ORDER_STEPS.map((step, idx) => {
                const isCompleted = idx < currentStep;
                const isCurrent = idx === currentStep;
                const IconComponent = step.icon;

                return (
                  <div key={step.key} className="flex flex-col items-center text-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center mb-2 transition-all duration-200 ${
                        isCompleted
                          ? 'bg-status-success text-white'
                          : isCurrent
                          ? 'bg-brand text-white shadow-brand ring-4 ring-brand/15'
                          : 'bg-ink-surface-muted dark:bg-ink-dark-hover text-ink-text-muted dark:text-ink-dark-text-muted'
                      }`}
                    >
                      <IconComponent size={16} />
                    </div>
                    <span
                      className={`text-[11px] font-medium leading-tight ${
                        isCurrent
                          ? 'font-bold text-ink-text dark:text-ink-dark-text'
                          : isCompleted
                          ? 'text-status-success font-semibold'
                          : 'text-ink-text-muted dark:text-ink-dark-text-muted'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Mobile Vertical Stepper View */}
            <div className="sm:hidden text-left space-y-3">
              {ORDER_STEPS.map((step, idx) => {
                const isCompleted = idx < currentStep;
                const isCurrent = idx === currentStep;
                const IconComponent = step.icon;

                // Show past, current, and next immediate step on mobile
                if (Math.abs(idx - currentStep) > 1 && !isCurrent) return null;

                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isCompleted
                          ? 'bg-status-success text-white'
                          : isCurrent
                          ? 'bg-brand text-white ring-2 ring-brand/20'
                          : 'bg-ink-surface-muted dark:bg-ink-dark-hover text-ink-text-muted'
                      }`}
                    >
                      <IconComponent size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${isCurrent ? 'text-brand' : 'text-ink-text dark:text-ink-dark-text'}`}>
                        {step.label}
                      </p>
                      <p className="text-[11px] text-ink-text-muted dark:text-ink-dark-text-muted truncate">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Order Details & Summary Card */}
      <div className="rounded-2xl border border-ink-border dark:border-ink-dark-border bg-ink-surface dark:bg-ink-dark-surface p-6 sm:p-7 shadow-xs">
        <h3 className="text-sm font-bold uppercase tracking-wider text-ink-text-muted dark:text-ink-dark-text-muted mb-4 pb-3 border-b border-ink-border dark:border-ink-dark-border">
          Order Summary & Payment
        </h3>

        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div className="p-3 rounded-xl bg-ink-surface-subtle dark:bg-ink-dark-elevated">
            <span className="text-[11px] font-medium text-ink-text-muted dark:text-ink-dark-text-muted block mb-1">
              Documents
            </span>
            <strong className="text-ink-text dark:text-ink-dark-text font-semibold">
              {order.filesCount ?? 0} file(s)
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-ink-surface-subtle dark:bg-ink-dark-elevated">
            <span className="text-[11px] font-medium text-ink-text-muted dark:text-ink-dark-text-muted block mb-1">
              Payment State
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                order.paymentStatus === 'VERIFIED'
                  ? 'bg-status-success-bg text-status-success'
                  : 'bg-status-warning-bg text-status-warning'
              }`}
            >
              {order.paymentStatus}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-ink-surface-subtle dark:bg-ink-dark-elevated">
            <span className="text-[11px] font-medium text-ink-text-muted dark:text-ink-dark-text-muted block mb-1">
              Total Amount
            </span>
            <strong className="text-base text-brand dark:text-brand-dark font-mono font-bold">
              ₹{(order.totalAmountPaise / 100).toFixed(2)}
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-ink-surface-subtle dark:bg-ink-dark-elevated">
            <span className="text-[11px] font-medium text-ink-text-muted dark:text-ink-dark-text-muted block mb-1">
              Submitted Time
            </span>
            <span className="text-xs text-ink-text-secondary dark:text-ink-dark-text-secondary font-mono">
              {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        <button
          onClick={onBackToPortal}
          className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-ink-surface-subtle dark:bg-ink-dark-elevated text-ink-text dark:text-ink-dark-text hover:bg-ink-surface-muted border border-ink-border dark:border-ink-dark-border text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <span>Print Another Document</span>
          <ArrowRightIcon size={14} />
        </button>
      </div>
    </div>
  );
};
