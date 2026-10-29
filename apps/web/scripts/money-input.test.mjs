import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRupeesToPaise } from '../src/money-input.mjs';

test('parses rupees into integer paise without floating point rounding', () => {
  assert.equal(parseRupeesToPaise('0'), 0);
  assert.equal(parseRupeesToPaise('1'), 100);
  assert.equal(parseRupeesToPaise('1.2'), 120);
  assert.equal(parseRupeesToPaise('1.29'), 129);
  assert.equal(parseRupeesToPaise('1000000.01'), 100000001);
});

test('rejects invalid rupee input instead of rounding or coercing it', () => {
  for (const value of ['', '  ', '-1', '1.234', '1e2', '01.00', '.50', '₹1', '9007199254740992']) {
    assert.equal(parseRupeesToPaise(value), null, `expected ${JSON.stringify(value)} to be invalid`);
  }
});
