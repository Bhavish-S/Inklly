import test from 'node:test';
import assert from 'node:assert/strict';
import { isFinalCustomerOrderStatus, stopCustomerOrderPollingIfFinal } from '../src/order-tracker-polling.mjs';

test('customer order tracking stops polling only after an irreversible final outcome', () => {
  for (const status of ['COLLECTED', 'CANCELLED', 'REJECTED']) {
    assert.equal(isFinalCustomerOrderStatus(status), true, `${status} is final`);
  }
  for (const status of [
    'SUBMITTED', 'AWAITING_PAYMENT', 'AWAITING_REVIEW', 'READY_FOR_PRINT',
    'IN_PROGRESS', 'READY_FOR_COLLECTION', 'PRINT_FAILED', 'PRINT_UNCONFIRMED',
    'FAILED_REQUIRES_SUPPORT', 'ON_HOLD',
  ]) {
    assert.equal(isFinalCustomerOrderStatus(status), false, `${status} may still require status refreshes`);
  }
});

test('terminal order responses clear the recurring status poll and recoverable statuses keep it', () => {
  const cleared = [];
  const clearInterval = (intervalId) => cleared.push(intervalId);
  assert.equal(stopCustomerOrderPollingIfFinal('COLLECTED', 17, clearInterval), true);
  assert.deepEqual(cleared, [17]);
  assert.equal(stopCustomerOrderPollingIfFinal('ON_HOLD', 18, clearInterval), false);
  assert.deepEqual(cleared, [17]);
  assert.equal(stopCustomerOrderPollingIfFinal('CANCELLED', undefined, clearInterval), false);
  assert.deepEqual(cleared, [17]);
});
