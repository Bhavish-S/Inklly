import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePhysicalSheets,
  calculateQuote,
  parsePageRange,
} from '../pricing-engine/calculator';
import {
  BulkDiscountRule,
  CopyDiscountRule,
  PriceQuoteRequest,
  RateRule,
} from '../types/pricing';

describe('Pricing Engine & Math Invariants', () => {
  it('correctly parses complex page ranges', () => {
    const pages = parsePageRange('1-3, 5, 8-10', 10);
    assert.deepEqual(pages, [1, 2, 3, 5, 8, 9, 10]);
    assert.equal(pages.length, 7);
  });

  it('handles "all" or undefined as complete document pages', () => {
    assert.equal(parsePageRange('all', 12).length, 12);
    assert.equal(parsePageRange(undefined, 5).length, 5);
  });

  it('calculates physical sheets for simplex and duplex correctly', () => {
    assert.equal(calculatePhysicalSheets(10, false), 10); // Simplex = 10 sheets
    assert.equal(calculatePhysicalSheets(10, true), 5); // Duplex = 5 sheets
    assert.equal(calculatePhysicalSheets(9, true), 5); // Odd pages duplex = 5 sheets
  });

  it('calculates deterministic quote in integer minor units (Paise)', () => {
    const rates: RateRule[] = [
      {
        id: 'r1',
        shopId: 'shop1',
        paperSize: 'A4',
        colorMode: 'bw',
        duplexMode: 'simplex',
        pricePerPrintedSidePaise: 200, // ₹2.00
      },
      {
        id: 'r2',
        shopId: 'shop1',
        paperSize: 'A4',
        colorMode: 'bw',
        duplexMode: 'duplex_auto',
        pricePerPrintedSidePaise: 150, // ₹1.50 per side for duplex
      },
      {
        id: 'r3',
        shopId: 'shop1',
        paperSize: 'A4',
        colorMode: 'color',
        duplexMode: 'simplex',
        pricePerPrintedSidePaise: 1000, // ₹10.00
      },
    ];

    const request: PriceQuoteRequest = {
      shopId: 'shop1',
      files: [
        {
          fileName: 'assignment.pdf',
          pageCount: 10,
          options: {
            colorMode: 'bw',
            duplexMode: 'simplex',
            paperSize: 'A4',
            orientation: 'portrait',
            copies: 1,
            fitMode: 'fit',
            pagesPerSheet: 1,
            collation: true,
          },
        },
      ],
    };

    const quote = calculateQuote(request, rates);
    assert.equal(quote.subtotalPaise, 2000); // 10 pages * 200 = 2000 paise (₹20.00)
    assert.equal(quote.totalPaise, 2000);
    assert.equal(quote.lineItems[0].physicalSheets, 10);
    assert.equal(quote.lineItems[0].printedSides, 10);
  });

  it('applies copy discounts for additional copies correctly', () => {
    const rates: RateRule[] = [
      {
        id: 'r1',
        shopId: 'shop1',
        paperSize: 'A4',
        colorMode: 'bw',
        duplexMode: 'simplex',
        pricePerPrintedSidePaise: 200,
      },
    ];

    const copyDiscountRules: CopyDiscountRule[] = [
      {
        id: 'cd1',
        shopId: 'shop1',
        paperSize: 'A4',
        colorMode: 'bw',
        duplexMode: 'simplex',
        copyOnePricePaise: 200, // Copy 1 @ ₹2.00
        additionalCopyPricePaise: 100, // Copies 2+ @ ₹1.00
        isEnabled: true,
      },
    ];

    const request: PriceQuoteRequest = {
      shopId: 'shop1',
      files: [
        {
          fileName: 'flyer.pdf',
          pageCount: 1,
          options: {
            colorMode: 'bw',
            duplexMode: 'simplex',
            paperSize: 'A4',
            orientation: 'portrait',
            copies: 5, // 5 copies: 1 @ 200 + 4 @ 100 = 600 paise
            fitMode: 'fit',
            pagesPerSheet: 1,
            collation: true,
          },
        },
      ],
    };

    const quote = calculateQuote(request, rates, copyDiscountRules);
    assert.equal(quote.subtotalPaise, 600); // ₹6.00
    assert.equal(quote.lineItems[0].copyDiscountAppliedPaise, 400); // standard was 5 * 200 = 1000, discount is 400
  });

  it('applies bulk order discount percentage when threshold is reached', () => {
    const rates: RateRule[] = [
      {
        id: 'r1',
        shopId: 'shop1',
        paperSize: 'A4',
        colorMode: 'bw',
        duplexMode: 'simplex',
        pricePerPrintedSidePaise: 200,
      },
    ];

    const bulkRule: BulkDiscountRule = {
      id: 'b1',
      shopId: 'shop1',
      minOrderValuePaise: 10000, // ₹100.00
      discountPercentage: 10, // 10%
      isEnabled: true,
    };

    const request: PriceQuoteRequest = {
      shopId: 'shop1',
      files: [
        {
          fileName: 'book.pdf',
          pageCount: 100, // 100 pages * 200 = 20000 paise (₹200.00)
          options: {
            colorMode: 'bw',
            duplexMode: 'simplex',
            paperSize: 'A4',
            orientation: 'portrait',
            copies: 1,
            fitMode: 'fit',
            pagesPerSheet: 1,
            collation: true,
          },
        },
      ],
    };

    const quote = calculateQuote(request, rates, [], bulkRule);
    assert.equal(quote.subtotalPaise, 20000);
    assert.equal(quote.bulkDiscountPaise, 2000); // 10% of 20000 = 2000 paise
    assert.equal(quote.totalPaise, 18000); // ₹180.00
  });
});
