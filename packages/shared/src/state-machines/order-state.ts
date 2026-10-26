import { OrderStatus } from '../types/order';

export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['AWAITING_PAYMENT', 'AWAITING_REVIEW', 'CANCELLED', 'ON_HOLD'],
  AWAITING_PAYMENT: ['READY_FOR_PRINT', 'AWAITING_REVIEW', 'CANCELLED', 'ON_HOLD', 'FAILED_REQUIRES_SUPPORT'],
  AWAITING_REVIEW: ['READY_FOR_PRINT', 'CANCELLED', 'ON_HOLD', 'FAILED_REQUIRES_SUPPORT'],
  READY_FOR_PRINT: ['IN_PROGRESS', 'ON_HOLD', 'CANCEL_REQUESTED', 'CANCELLED'],
  IN_PROGRESS: ['READY_FOR_COLLECTION', 'ON_HOLD', 'FAILED_REQUIRES_SUPPORT'],
  READY_FOR_COLLECTION: ['COLLECTED', 'ON_HOLD'],
  COLLECTED: [], // Terminal success
  CANCEL_REQUESTED: ['CANCELLED', 'IN_PROGRESS', 'ON_HOLD'],
  CANCELLED: [], // Terminal cancellation
  ON_HOLD: ['READY_FOR_PRINT', 'IN_PROGRESS', 'AWAITING_REVIEW', 'CANCELLED'],
  FAILED_REQUIRES_SUPPORT: ['AWAITING_REVIEW', 'CANCELLED', 'ON_HOLD'],
};

export function canTransitionOrder(current: OrderStatus, next: OrderStatus): boolean {
  return VALID_ORDER_TRANSITIONS[current]?.includes(next) ?? false;
}

export function validateOrderTransition(current: OrderStatus, next: OrderStatus): void {
  if (!canTransitionOrder(current, next)) {
    throw new Error(`Illegal order transition from ${current} to ${next}`);
  }
}
