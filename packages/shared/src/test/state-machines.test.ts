import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransitionOrder,
  validateOrderTransition,
} from '../state-machines/order-state';
import {
  canTransitionPayment,
  validatePaymentTransition,
} from '../state-machines/payment-state';
import {
  canTransitionPrintJob,
  isBlindRetryForbidden,
  validatePrintJobTransition,
} from '../state-machines/print-job-state';

describe('Decoupled State Machines & Safety Invariants', () => {
  describe('Order State Machine', () => {
    it('allows valid order progression', () => {
      assert.ok(canTransitionOrder('DRAFT', 'SUBMITTED'));
      assert.ok(canTransitionOrder('SUBMITTED', 'AWAITING_PAYMENT'));
      assert.ok(canTransitionOrder('AWAITING_PAYMENT', 'READY_FOR_PRINT'));
      assert.ok(canTransitionOrder('READY_FOR_PRINT', 'IN_PROGRESS'));
      assert.ok(canTransitionOrder('IN_PROGRESS', 'READY_FOR_COLLECTION'));
      assert.ok(canTransitionOrder('READY_FOR_COLLECTION', 'COLLECTED'));
    });

    it('rejects illegal order progression', () => {
      assert.equal(canTransitionOrder('DRAFT', 'COLLECTED'), false);
      assert.equal(canTransitionOrder('COLLECTED', 'DRAFT'), false);
      assert.throws(() => validateOrderTransition('DRAFT', 'COLLECTED'), /Illegal order transition/);
    });
  });

  describe('Payment State Machine', () => {
    it('allows normal payment capture and verified state', () => {
      assert.ok(canTransitionPayment('NOT_STARTED', 'PENDING'));
      assert.ok(canTransitionPayment('PENDING', 'VERIFIED'));
      assert.ok(canTransitionPayment('VERIFIED', 'REFUNDED'));
    });

    it('allows partial refunds to proceed, complete, or return to a verified balance', () => {
      assert.ok(canTransitionPayment('VERIFIED', 'PARTIALLY_REFUNDED'));
      assert.ok(canTransitionPayment('PARTIALLY_REFUNDED', 'REFUND_PENDING'));
      assert.ok(canTransitionPayment('REFUND_PENDING', 'PARTIALLY_REFUNDED'));
      assert.ok(canTransitionPayment('PARTIALLY_REFUNDED', 'REFUNDED'));
      assert.ok(canTransitionPayment('PARTIALLY_REFUNDED', 'RECONCILIATION_REQUIRED'));
      assert.equal(canTransitionPayment('PARTIALLY_REFUNDED', 'NOT_STARTED'), false);
    });

    it('rejects unauthorized payment jumps', () => {
      assert.equal(canTransitionPayment('NOT_STARTED', 'REFUNDED'), false);
      assert.throws(() => validatePaymentTransition('NOT_STARTED', 'REFUNDED'), /Illegal payment transition/);
    });
  });

  describe('Print Job State Machine & Hardware Safety', () => {
    it('allows clean dispatch and confirmation', () => {
      assert.ok(canTransitionPrintJob('RECEIVED', 'VALIDATING'));
      assert.ok(canTransitionPrintJob('VALIDATING', 'CONFIGURED'));
      assert.ok(canTransitionPrintJob('CONFIGURED', 'READY'));
      assert.ok(canTransitionPrintJob('READY', 'DISPATCHING'));
      assert.ok(canTransitionPrintJob('DISPATCHED', 'PRINT_CONFIRMED'));
      assert.ok(canTransitionPrintJob('DISPATCHING', 'SUBMITTED_TO_SPOOLER'));
      assert.ok(canTransitionPrintJob('SUBMITTED_TO_SPOOLER', 'PRINT_CONFIRMED'));
    });

    it('handles uncertain output by requiring operator intervention', () => {
      assert.ok(canTransitionPrintJob('DISPATCHING', 'OUTPUT_UNCERTAIN'));
      assert.ok(canTransitionPrintJob('SUBMITTED_TO_SPOOLER', 'OUTPUT_UNCERTAIN'));
      assert.ok(canTransitionPrintJob('OUTPUT_UNCERTAIN', 'NEEDS_PHYSICAL_VERIFICATION'));
      assert.ok(canTransitionPrintJob('NEEDS_PHYSICAL_VERIFICATION', 'PRINT_CONFIRMED'));
      // DIRECT RETRY FROM UNCERTAIN IS FORBIDDEN:
      assert.equal(canTransitionPrintJob('OUTPUT_UNCERTAIN', 'READY'), false);
      assert.equal(canTransitionPrintJob('OUTPUT_UNCERTAIN', 'PRINT_CONFIRMED'), false);
      assert.ok(isBlindRetryForbidden('OUTPUT_UNCERTAIN'));
      assert.ok(isBlindRetryForbidden('NEEDS_PHYSICAL_VERIFICATION'));
    });
  });
});
