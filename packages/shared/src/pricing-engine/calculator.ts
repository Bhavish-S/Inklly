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

    const usesRate = (mode: 'bw' | 'color') => rates.find(
      (r) => r.paperSize === file.options.paperSize && r.colorMode === mode &&
        (isDuplex ? r.duplexMode !== 'simplex' : r.duplexMode === 'simplex')
    );
    const selected = new Set(selectedPageList);
    const colorPageList = file.options.colorMode === 'mixed' && file.options.colorPages?.trim()
      ? parsePageRange(file.options.colorPages, file.pageCount).filter((page) => selected.has(page))
      : file.options.colorMode === 'color' ? selectedPageList : [];
    const colorCount = colorPageList.length;
    const bwCount = selectedPages - colorCount;
    const bwRate = bwCount > 0 ? usesRate('bw') : undefined;
    const colorRate = colorCount > 0 ? usesRate('color') : undefined;
    if ((bwCount > 0 && !bwRate) || (colorCount > 0 && !colorRate)) {
      throw new Error(`No rate configured for ${file.options.paperSize} - ${file.options.colorMode} - ${file.options.duplexMode}`);
    }

    const findCopyRule = (mode: 'bw' | 'color') => copyDiscountRules.find(
      (rule) => rule.isEnabled && rule.paperSize === file.options.paperSize && rule.colorMode === mode &&
        (isDuplex ? rule.duplexMode !== 'simplex' : rule.duplexMode === 'simplex')
    );
    const lineForMode = (pageCount: number, mode: 'bw' | 'color', unitPrice: number) => {
      if (!pageCount) return { total: 0, undiscounted: 0 };
      const copyRule = findCopyRule(mode);
      const undiscounted = copies * pageCount * unitPrice;
      if (copyRule && copies > 1) {
        return {
          total: pageCount * (copyRule.copyOnePricePaise + (copies - 1) * copyRule.additionalCopyPricePaise),
          undiscounted,
        };
      }
      return { total: undiscounted, undiscounted };
    };
    const bwLine = lineForMode(bwCount, 'bw', bwRate?.pricePerPrintedSidePaise || 0);
    const colorLine = lineForMode(colorCount, 'color', colorRate?.pricePerPrintedSidePaise || 0);
    const lineSubtotalPaise = bwLine.total + colorLine.total;
    const copyDiscountAppliedPaise = Math.max(0, bwLine.undiscounted + colorLine.undiscounted - lineSubtotalPaise);
    const standardUnitPricePaise = file.options.colorMode === 'color'
      ? (colorRate?.pricePerPrintedSidePaise || 0)
      : (bwRate?.pricePerPrintedSidePaise || 0);

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
