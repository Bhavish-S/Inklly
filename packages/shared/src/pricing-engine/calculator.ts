import {
  BulkDiscountRule,
  CopyDiscountRule,
  PriceLineItem,
  PriceQuoteRequest,
  PriceQuoteResult,
  RateRule,
} from '../types/pricing';

/**
 * Parses a page range string (e.g. "1-3, 5, 7-9") into an array of 1-based page numbers.
 * Validates against the total pages of the document.
 */
export function parsePageRange(rangeStr: string | undefined, totalDocumentPages: number): number[] {
  if (!rangeStr || rangeStr.trim() === '' || rangeStr.toLowerCase() === 'all') {
    return Array.from({ length: totalDocumentPages }, (_, i) => i + 1);
  }

  const selectedPages = new Set<number>();
  const tokens = rangeStr.split(',').map((t) => t.trim());

  for (const token of tokens) {
    if (!token) continue;
    if (token.includes('-')) {
      const [startStr, endStr] = token.split('-').map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        throw new Error(`Invalid page range token: "${token}"`);
      }
      for (let p = start; p <= Math.min(end, totalDocumentPages); p++) {
        selectedPages.add(p);
      }
    } else {
      const page = parseInt(token, 10);
      if (isNaN(page) || page < 1 || page > totalDocumentPages) {
        throw new Error(`Invalid page number: "${token}" (doc has ${totalDocumentPages} pages)`);
      }
      selectedPages.add(page);
    }
  }

  return Array.from(selectedPages).sort((a, b) => a - b);
}

/**
 * Calculates physical sheets based on selected pages and duplex setting.
 */
export function calculatePhysicalSheets(selectedPages: number, isDuplex: boolean): number {
  if (selectedPages <= 0) return 0;
  return isDuplex ? Math.ceil(selectedPages / 2) : selectedPages;
}

/**
 * Deterministic Price Quotation Engine
 * Calculates exact line items, copy discounts, and bulk thresholds using integer minor units (Paise).
 */
export function calculateQuote(
  request: PriceQuoteRequest,
  rates: RateRule[],
  copyDiscountRules: CopyDiscountRule[] = [],
  bulkDiscountRule?: BulkDiscountRule,
  baseFeePaise: number = 0,
  currency: string = 'INR'
): PriceQuoteResult {
  const lineItems: PriceLineItem[] = [];
  let subtotalPaise = 0;

  for (const file of request.files) {
    const selectedPageList = parsePageRange(file.options.pageRange, file.pageCount);
    const selectedPages = selectedPageList.length;
    const isDuplex = file.options.duplexMode !== 'simplex';
    const physicalSheets = calculatePhysicalSheets(selectedPages, isDuplex);
    const printedSides = selectedPages; // Each selected page is a printed side
    const copies = Math.max(1, file.options.copies);

    // Resolve matching rate rule
    const matchingRate = rates.find(
      (r) =>
        r.paperSize === file.options.paperSize &&
        r.colorMode === file.options.colorMode &&
        (isDuplex ? r.duplexMode !== 'simplex' : r.duplexMode === 'simplex')
    );

    if (!matchingRate) {
      throw new Error(
        `No rate configured for ${file.options.paperSize} - ${file.options.colorMode} - ${file.options.duplexMode}`
      );
    }

    const standardUnitPricePaise = matchingRate.pricePerPrintedSidePaise;

    // Check for copy discount rule
    const copyRule = copyDiscountRules.find(
      (cr) =>
        cr.isEnabled &&
        cr.paperSize === file.options.paperSize &&
        cr.colorMode === file.options.colorMode &&
        (isDuplex ? cr.duplexMode !== 'simplex' : cr.duplexMode === 'simplex')
    );

    let lineSubtotalPaise = 0;
    let copyDiscountAppliedPaise = 0;

    if (copyRule && copyRule.isEnabled && copies > 1) {
      // Copy 1 uses copyOnePricePaise
      const copy1Amount = printedSides * copyRule.copyOnePricePaise;
      // Copies 2..N use additionalCopyPricePaise
      const additionalCopiesAmount = (copies - 1) * printedSides * copyRule.additionalCopyPricePaise;
      lineSubtotalPaise = copy1Amount + additionalCopiesAmount;

      const undiscountedAmount = copies * printedSides * standardUnitPricePaise;
      copyDiscountAppliedPaise = Math.max(0, undiscountedAmount - lineSubtotalPaise);
    } else {
      lineSubtotalPaise = copies * printedSides * standardUnitPricePaise;
    }

    subtotalPaise += lineSubtotalPaise;

    lineItems.push({
      fileName: file.fileName,
      pageCount: file.pageCount,
      selectedPages,
      physicalSheets,
      printedSides,
      copies,
      unitPricePaise: standardUnitPricePaise,
      subtotalPaise: lineSubtotalPaise,
      copyDiscountAppliedPaise,
    });
  }

  // Calculate bulk discount if applicable
  let bulkDiscountPaise = 0;
  if (
    bulkDiscountRule &&
    bulkDiscountRule.isEnabled &&
    subtotalPaise >= bulkDiscountRule.minOrderValuePaise
  ) {
    bulkDiscountPaise = Math.round(
      (subtotalPaise * bulkDiscountRule.discountPercentage) / 100
    );
  }

  const totalPaise = Math.max(0, subtotalPaise - bulkDiscountPaise + baseFeePaise);

  const quoteId = `QT-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .substring(2, 6)
    .toUpperCase()}`;

  const quoteVersion = `v1-${subtotalPaise}-${totalPaise}`;

  return {
    quoteId,
    shopId: request.shopId,
    currency,
    quoteVersion,
    lineItems,
    subtotalPaise,
    bulkDiscountPaise,
    baseFeePaise,
    totalPaise,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes TTL
  };
}
