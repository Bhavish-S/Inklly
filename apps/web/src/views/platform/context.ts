export type ConsoleTab =
  | 'overview' | 'shops' | 'orders' | 'customers' | 'payments' | 'agents'
  | 'support' | 'settings' | 'audit' | 'team';

export interface ConsoleContext {
  /** True when the signed-in account holds the platform permission (owners hold all). */
  can: (permission: string) => boolean;
  isOwner: boolean;
  notify: (message: string, tone?: 'success' | 'error') => void;
  goTo: (tab: ConsoleTab, filter?: Record<string, string>) => void;
  openShop: (shopId: string) => void;
  openOrder: (orderId: string) => void;
  /** Increments whenever the user presses Refresh, so sections reload. */
  refreshKey: number;
}

export const PLAN_TIERS = ['STARTER', 'GROWTH', 'PRO', 'SCALE'] as const;
export const PLAN_STATUSES = ['TRIAL', 'ACTIVE', 'GRACE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'PENDING_PAYMENT'] as const;
export const PLATFORM_PERMISSION_OPTIONS = [
  { id: 'platform:view', label: 'View platform', description: 'Overview, shops, orders, customers, printers and settings.' },
  { id: 'platform:manage', label: 'Manage platform', description: 'Edit shops, cancel or mark orders paid, change settings.' },
  { id: 'support:view', label: 'View support', description: 'Website enquiries and incidents.' },
  { id: 'support:manage', label: 'Manage support', description: 'Create and resolve incidents.' },
  { id: 'finance:view', label: 'View finance', description: 'The platform money ledger.' },
  { id: 'billing:view', label: 'View billing', description: 'Plans, pilot rates and invoices.' },
  { id: 'billing:manage', label: 'Manage billing', description: 'Add pilot rates and issue invoices.' },
  { id: 'security:audit', label: 'Audit log', description: 'Read the full audit trail.' },
] as const;
