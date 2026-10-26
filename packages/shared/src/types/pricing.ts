import { ColorMode, DuplexMode, PaperSize, PrintOptions } from './printing';

export interface RateRule {
  id: string;
  shopId: string;
  printerId?: string; // Optional printer-specific override
  paperSize: PaperSize;
  colorMode: ColorMode;
  duplexMode: DuplexMode;
  pricePerPrintedSidePaise: number; // In minor units (e.g. 200 = ₹2.00)
}

export interface BulkDiscountRule {
  id: string;
  shopId: string;
  minOrderValuePaise: number;
  discountPercentage: number; // e.g. 10 for 10%
  isEnabled: boolean;
}

export interface CopyDiscountRule {
  id: string;
  shopId: string;
  paperSize: PaperSize;
  colorMode: ColorMode;
  duplexMode: DuplexMode;
  copyOnePricePaise: number; // Normal rate
  additionalCopyPricePaise: number; // Discount rate for copy 2+
  isEnabled: boolean;
}

export interface PriceQuoteRequest {
  shopId: string;
  files: {
    fileName: string;
    pageCount: number;
    options: PrintOptions;
  }[];
}

export interface PriceLineItem {
  fileName: string;
  pageCount: number;
  selectedPages: number;
  physicalSheets: number;
  printedSides: number;
  copies: number;
  unitPricePaise: number;
  subtotalPaise: number;
  copyDiscountAppliedPaise: number;
}

export interface PriceQuoteResult {
  quoteId: string;
  shopId: string;
  currency: string;
  quoteVersion: string;
  lineItems: PriceLineItem[];
  subtotalPaise: number;
  bulkDiscountPaise: number;
  baseFeePaise: number;
  totalPaise: number;
  expiresAt: string;
}
