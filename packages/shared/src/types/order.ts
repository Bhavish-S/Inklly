import { PrintOptions } from './printing';

export type OrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'AWAITING_PAYMENT'
  | 'AWAITING_REVIEW'
  | 'READY_FOR_PRINT'
  | 'IN_PROGRESS'
  | 'READY_FOR_COLLECTION'
  | 'COLLECTED'
  | 'CANCEL_REQUESTED'
  | 'CANCELLED'
  | 'ON_HOLD'
  | 'FAILED_REQUIRES_SUPPORT';

export type PaymentStatus =
  | 'NOT_REQUIRED'
  | 'NOT_STARTED'
  | 'PENDING'
  | 'VERIFIED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'REVERSED'
  | 'RECONCILIATION_REQUIRED';

export type PrintJobStatus =
  | 'RECEIVED'
  | 'VALIDATING'
  | 'CONFIGURED'
  | 'BLOCKED'
  | 'READY'
  | 'DISPATCHING'
  | 'SUBMITTED_TO_SPOOLER'
  | 'OUTPUT_PENDING_CONFIRMATION'
  | 'PRINT_CONFIRMED'
  | 'VALIDATION_FAILED'
  | 'DISPATCH_FAILED'
  | 'PRINTER_UNAVAILABLE'
  | 'PARTIAL_OUTPUT'
  | 'OUTPUT_UNCERTAIN'
  | 'CANCELLED_BEFORE_DISPATCH'
  | 'NEEDS_PHYSICAL_VERIFICATION';

export type PrintAttemptStatus =
  | 'CREATED'
  | 'SENT'
  | 'ACKNOWLEDGED'
  | 'REJECTED'
  | 'TIMED_OUT'
  | 'UNKNOWN';

export interface OrderFile {
  id: string;
  orderId: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  storageKey: string;
  pageCount: number;
  printOptions: PrintOptions;
  lineSubtotalPaise: number;
}

export interface Order {
  id: string;
  shopId: string;
  orderNumber: string; // e.g. "INK-20261025-001"
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  channel: 'QR_PORTAL' | 'WHATSAPP';
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: 'ONLINE_RAZORPAY' | 'ONLINE_STRIPE' | 'CASH_ON_COLLECTION';
  totalAmountPaise: number;
  currency: string;
  quoteVersion: string;
  files: OrderFile[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  collectedAt?: string;
}
