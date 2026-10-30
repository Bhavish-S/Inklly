const FINAL_CUSTOMER_ORDER_STATUSES = new Set(['COLLECTED', 'CANCELLED', 'REJECTED']);

export function isFinalCustomerOrderStatus(status) {
  return FINAL_CUSTOMER_ORDER_STATUSES.has(status);
}

export function stopCustomerOrderPollingIfFinal(status, intervalId, clearInterval) {
  if (intervalId === undefined || !isFinalCustomerOrderStatus(status)) return false;
  clearInterval(intervalId);
  return true;
}
