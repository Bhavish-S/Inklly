import { PrintJobStatus } from '../types/order';

export const VALID_PRINT_JOB_TRANSITIONS: Record<PrintJobStatus, PrintJobStatus[]> = {
  RECEIVED: ['VALIDATING', 'VALIDATION_FAILED'],
  VALIDATING: ['CONFIGURED', 'VALIDATION_FAILED'],
  CONFIGURED: ['READY', 'BLOCKED'],
  BLOCKED: ['READY', 'CANCELLED_BEFORE_DISPATCH'],
  READY: ['DISPATCHING', 'CANCELLED_BEFORE_DISPATCH', 'PRINTER_UNAVAILABLE'],
  DISPATCHING: ['SUBMITTED_TO_SPOOLER', 'DISPATCH_FAILED', 'OUTPUT_UNCERTAIN'],
  DISPATCHED: ['SUBMITTED_TO_SPOOLER', 'OUTPUT_PENDING_CONFIRMATION', 'PRINT_CONFIRMED', 'OUTPUT_UNCERTAIN', 'NEEDS_PHYSICAL_VERIFICATION'],
  SUBMITTED_TO_SPOOLER: [
    'OUTPUT_PENDING_CONFIRMATION',
    'PRINT_CONFIRMED',
    'PARTIAL_OUTPUT',
    'OUTPUT_UNCERTAIN',
    'NEEDS_PHYSICAL_VERIFICATION',
  ],
  OUTPUT_PENDING_CONFIRMATION: [
    'PRINT_CONFIRMED',
    'PARTIAL_OUTPUT',
    'OUTPUT_UNCERTAIN',
    'NEEDS_PHYSICAL_VERIFICATION',
  ],
  PRINT_CONFIRMED: [], // Terminal success
  VALIDATION_FAILED: ['VALIDATING', 'CANCELLED_BEFORE_DISPATCH'],
  DISPATCH_FAILED: ['READY', 'PRINTER_UNAVAILABLE', 'CANCELLED_BEFORE_DISPATCH'],
  PRINTER_UNAVAILABLE: ['READY', 'CANCELLED_BEFORE_DISPATCH'],
  PARTIAL_OUTPUT: ['NEEDS_PHYSICAL_VERIFICATION', 'PRINT_CONFIRMED'],
  OUTPUT_UNCERTAIN: ['NEEDS_PHYSICAL_VERIFICATION'], // MUST stop for operator reconciliation!
  CANCELLED_BEFORE_DISPATCH: [],
  NEEDS_PHYSICAL_VERIFICATION: ['READY', 'PRINT_CONFIRMED', 'CANCELLED_BEFORE_DISPATCH'],
};

export function canTransitionPrintJob(current: PrintJobStatus, next: PrintJobStatus): boolean {
  return VALID_PRINT_JOB_TRANSITIONS[current]?.includes(next) ?? false;
}

export function validatePrintJobTransition(current: PrintJobStatus, next: PrintJobStatus): void {
  if (!canTransitionPrintJob(current, next)) {
    throw new Error(`Illegal print job transition from ${current} to ${next}`);
  }
}

/**
 * Safety Invariant Check:
 * Enforces that an uncertain print outcome NEVER automatically retries without physical verification.
 */
export function isBlindRetryForbidden(current: PrintJobStatus): boolean {
  return current === 'OUTPUT_UNCERTAIN' || current === 'NEEDS_PHYSICAL_VERIFICATION';
}
