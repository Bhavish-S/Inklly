/** A printer is dispatchable only while its authenticated agent evidence is fresh. */
export const PRINTER_HEARTBEAT_STALE_AFTER_MS = 45_000;

export type PrinterHealthStatus = 'ONLINE' | 'STALE' | 'OFFLINE' | 'UNKNOWN';

export function getPrinterHealthStatus(
  isOnline: boolean,
  lastHeartbeat: string | null | undefined,
  nowMs = Date.now()
): PrinterHealthStatus {
  if (!lastHeartbeat) return 'UNKNOWN';
  const heartbeatMs = Date.parse(lastHeartbeat);
  if (!Number.isFinite(heartbeatMs) || heartbeatMs > nowMs) return 'UNKNOWN';
  if (nowMs - heartbeatMs > PRINTER_HEARTBEAT_STALE_AFTER_MS) return 'STALE';
  return isOnline ? 'ONLINE' : 'OFFLINE';
}

export function hasFreshOnlinePrinterEvidence(
  isOnline: boolean,
  lastHeartbeat: string | null | undefined,
  nowMs = Date.now()
): boolean {
  return getPrinterHealthStatus(isOnline, lastHeartbeat, nowMs) === 'ONLINE';
}
