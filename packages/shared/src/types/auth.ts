export type UserRole =
  | 'PLATFORM_OWNER'
  | 'PLATFORM_ADMIN'
  | 'MERCHANT_OWNER'
  | 'SHOP_MANAGER'
  | 'SHOP_STAFF'
  | 'DEVELOPER'
  | 'CUSTOMER';

export interface User {
  id: string;
  email: string;
  phone?: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionTokenPayload {
  sessionId: string;
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  shopId?: string;
  permissions: string[];
  exp: number;
  iat: number;
}

export const STAFF_PERMISSIONS = {
  ORDERS_VIEW: 'orders:view',
  ORDERS_PROCESS: 'orders:process',
  ORDERS_REJECT: 'orders:reject',
  LIVE_PRINT: 'live_print:manage',
  STORAGE_VIEW: 'storage:view',
  STORAGE_MANAGE: 'storage:manage',
  SHOP_QR_VIEW: 'shop_qr:view',
  PRINTERS_VIEW: 'printers:view',
  PRINTERS_MANAGE: 'printers:manage',
  BOT_TRAIN: 'bot:train',
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_MANAGE: 'settings:manage',
  FINANCE_VIEW: 'finance:view',
  FINANCE_MANAGE: 'finance:manage',
} as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[keyof typeof STAFF_PERMISSIONS];

export interface RolePreset {
  name: 'Order Handler' | 'Print Operator' | 'Manager' | 'Custom';
  permissions: StaffPermission[];
}

export const ROLE_PRESETS: Record<string, StaffPermission[]> = {
  'Order Handler': [
    STAFF_PERMISSIONS.ORDERS_VIEW,
    STAFF_PERMISSIONS.ORDERS_PROCESS,
    STAFF_PERMISSIONS.LIVE_PRINT,
    STAFF_PERMISSIONS.SHOP_QR_VIEW,
    STAFF_PERMISSIONS.STORAGE_VIEW,
  ],
  'Print Operator': [
    STAFF_PERMISSIONS.ORDERS_VIEW,
    STAFF_PERMISSIONS.ORDERS_PROCESS,
    STAFF_PERMISSIONS.LIVE_PRINT,
    STAFF_PERMISSIONS.PRINTERS_VIEW,
    STAFF_PERMISSIONS.PRINTERS_MANAGE,
    STAFF_PERMISSIONS.STORAGE_VIEW,
  ],
  Manager: [
    STAFF_PERMISSIONS.ORDERS_VIEW,
    STAFF_PERMISSIONS.ORDERS_PROCESS,
    STAFF_PERMISSIONS.ORDERS_REJECT,
    STAFF_PERMISSIONS.LIVE_PRINT,
    STAFF_PERMISSIONS.STORAGE_VIEW,
    STAFF_PERMISSIONS.STORAGE_MANAGE,
    STAFF_PERMISSIONS.SHOP_QR_VIEW,
    STAFF_PERMISSIONS.PRINTERS_VIEW,
    STAFF_PERMISSIONS.PRINTERS_MANAGE,
    STAFF_PERMISSIONS.BOT_TRAIN,
    STAFF_PERMISSIONS.SETTINGS_VIEW,
    STAFF_PERMISSIONS.SETTINGS_MANAGE,
  ],
};
