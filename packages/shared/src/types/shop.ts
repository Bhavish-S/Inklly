export interface Organization {
  id: string;
  name: string;
  ownerUserId: string;
  planTier: 'STARTER' | 'GROWTH' | 'PRO' | 'SCALE';
  planStatus: 'TRIAL' | 'ACTIVE' | 'GRACE' | 'PAST_DUE' | 'CANCELLED' | 'SUSPENDED' | 'PENDING_PAYMENT';
  billingCurrency: string;
  createdAt: string;
  updatedAt: string;
}

export interface Shop {
  id: string;
  organizationId: string;
  shopCode: string; // Unique URL slug e.g. "campus1" for /p/campus1
  name: string;
  tagline?: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  gstin?: string;
  currency: string; // e.g. "INR"
  paymentGateway: 'RAZORPAY' | 'STRIPE' | 'CASH_ONLY';
  acceptCashOnCollection: boolean;
  autoPrintMode: 'AUTO_ALL' | 'PRINT_AFTER_PAYMENT' | 'MANUAL_OFF';
  orderSeparator: 'NONE' | 'BW_INVOICE' | 'BLANK_PAGE';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceCatalogue {
  colorBw: boolean;
  colorFull: boolean;
  duplexAuto: boolean;
  duplexManual: boolean;
  paperA4: boolean;
  paperA3: boolean;
  paperPhoto4x6: boolean;
  paperPhoto5x7: boolean;
  paperGlossy: boolean;
  paperPlain: boolean;
  scalingFit: boolean;
  scalingActual: boolean;
  pagesPerSheet: boolean;
  idCardMode: boolean;
  passportPhoto: boolean;
}

export interface CustomerPortalSettings {
  showCustomerDetailsStep: boolean;
  enabledColorModes: ('bw' | 'color')[];
  enabledSides: ('simplex' | 'duplex_auto' | 'duplex_manual')[];
  enabledPaperFormats: ('A4' | 'A3' | 'PHOTO_4X6' | 'PHOTO_5X7' | 'GLOSSY' | 'PLAIN')[];
  allowPageSelection: boolean;
  allowPagesPerSheet: boolean;
  maxFilesPerOrder: number;
  maxFileSizeMB: number;
}
