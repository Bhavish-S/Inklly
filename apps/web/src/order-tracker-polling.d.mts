export function isFinalCustomerOrderStatus(status: string): boolean;
export function stopCustomerOrderPollingIfFinal(status: string, intervalId: number | undefined, clearInterval: (intervalId: number) => void): boolean;
