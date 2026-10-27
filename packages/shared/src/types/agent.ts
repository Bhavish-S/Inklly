import { PaperSize, PrintOptions } from './printing';

export interface AgentRegistration {
  agentId: string;
  shopId: string;
  secretKey: string;
  hostname: string;
  osPlatform: string;
  osVersion: string;
  agentVersion: string;
}

export interface AgentHeartbeat {
  agentId: string;
  shopId: string;
  timestamp: string;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  activePrintersCount: number;
  localQueueDepth: number;
  sqliteCacheHealthy: boolean;
}

export interface PrintCommandTicket {
  commandId: string;
  jobId: string;
  attemptId: string;
  shopId: string;
  printerId: string;
  documentUrl: string;
  storageKey?: string;
  fileName: string;
  options: PrintOptions;
  expiresAt: string;
  correlationId: string;
}

export interface SpoolerResult {
  attemptId: string;
  jobId: string;
  status: 'SUBMITTED_TO_SPOOLER' | 'PRINT_CONFIRMED' | 'OUTPUT_UNCERTAIN' | 'FAILED';
  driverJobId?: number;
  pagesPrinted?: number;
  errorMessage?: string;
  timestamp: string;
}
