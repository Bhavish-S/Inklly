import { PaymentStatus } from '../types/order';

export const VALID_PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  NOT_REQUIRED: ['VERIFIED'],
  NOT_STARTED: ['PENDING', 'CANCELLED'],
  PENDING: ['VERIFIED', 'FAILED', 'EXPIRED', 'CANCELLED', 'RECONCILIATION_REQUIRED'],
  VERIFIED: ['REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'REVERSED', 'RECONCILIATION_REQUIRED'],
  FAILED: ['PENDING', 'CANCELLED'],
  EXPIRED: ['PENDING', 'CANCELLED'],
  CANCELLED: [],
  REFUND_PENDING: ['PARTIALLY_REFUNDED', 'REFUNDED', 'VERIFIED', 'RECONCILIATION_REQUIRED'],
  PARTIALLY_REFUNDED: ['REFUND_PENDING', 'REFUNDED', 'RECONCILIATION_REQUIRED'],
  REFUNDED: [],
  REVERSED: ['RECONCILIATION_REQUIRED'],
  RECONCILIATION_REQUIRED: ['VERIFIED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'REVERSED'],
};

export function canTransitionPayment(current: PaymentStatus, next: PaymentStatus): boolean {
  return VALID_PAYMENT_TRANSITIONS[current]?.includes(next) ?? false;
}

export function validatePaymentTransition(current: PaymentStatus, next: PaymentStatus): void {
  if (!canTransitionPayment(current, next)) {
    throw new Error(`Illegal payment transition from ${current} to ${next}`);
  }
}
