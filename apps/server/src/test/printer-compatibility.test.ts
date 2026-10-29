import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PrintOptions, PrinterDevice } from '@inklly/shared';
import { getPrinterCompatibilityIssues } from '../services/printer-compatibility';

const options = (overrides: Partial<PrintOptions> = {}): PrintOptions => ({
  colorMode: 'bw',
  duplexMode: 'simplex',
  paperSize: 'A4',
  orientation: 'portrait',
  copies: 1,
  fitMode: 'fit',
  pagesPerSheet: 1,
  collation: true,
  ...overrides,
});

const profile: Pick<PrinterDevice, 'supportsColor' | 'supportsDuplex' | 'trays'> = {
  supportsColor: false,
  supportsDuplex: false,
  trays: [{ id: 'tray-a4', name: 'A4 tray', supportedSizes: ['A4'], isDefault: true }],
};

test('printer compatibility checks every saved order file against verified capabilities', () => {
  assert.deepEqual(getPrinterCompatibilityIssues([{ fileName: 'notes.pdf', printOptions: options() }], profile), []);

  assert.match(
    getPrinterCompatibilityIssues([{ fileName: 'photo.pdf', printOptions: options({ colorMode: 'color' }) }], profile).join(' '),
    /color capable printer/i,
  );
  assert.match(
    getPrinterCompatibilityIssues([{ fileName: 'book.pdf', printOptions: options({ duplexMode: 'duplex_auto' }) }], profile).join(' '),
    /requires duplex printing/i,
  );
  assert.match(
    getPrinterCompatibilityIssues([{ fileName: 'poster.pdf', printOptions: options({ paperSize: 'A3' }) }], profile).join(' '),
    /A3 paper/i,
  );
});

test('mixed color and manual duplex are rejected until supported by the agent', () => {
  const issues = getPrinterCompatibilityIssues([
    { fileName: 'mixed.pdf', printOptions: options({ colorMode: 'mixed', colorPages: '2,4' }) },
    { fileName: 'manual.pdf', printOptions: options({ duplexMode: 'duplex_manual' }) },
  ], profile);
  assert.match(issues.join(' '), /mixed-color pages, which the current agent cannot apply/i);
  assert.match(issues.join(' '), /manual duplex, which the current agent cannot apply/i);
});

test('rejects multi-page layouts and paper types that the current agent cannot apply', () => {
  const issues = getPrinterCompatibilityIssues([
    { fileName: 'handout.pdf', printOptions: options({ pagesPerSheet: 2 }) },
    { fileName: 'photo.pdf', printOptions: options({ paperSize: 'PHOTO_4X6' }) },
  ], { ...profile, supportsColor: true, supportsDuplex: true });
  assert.match(issues.join(' '), /multiple pages per sheet/i);
  assert.match(issues.join(' '), /current agent cannot verify/i);
});

test('unknown and malformed profiles fail closed', () => {
  const unknownProfile = { ...profile, trays: [] };
  assert.match(getPrinterCompatibilityIssues([{ printOptions: options() }], unknownProfile).join(' '), /no verified paper tray/i);
  assert.match(getPrinterCompatibilityIssues([{ fileName: 'legacy.pdf', printOptions: null }], profile).join(' '), /no saved print settings/i);
  assert.match(getPrinterCompatibilityIssues([], profile).join(' '), /no print files/i);
  const legacyOptions = options();
  delete (legacyOptions as Partial<PrintOptions>).pagesPerSheet;
  assert.deepEqual(getPrinterCompatibilityIssues([{ fileName: 'legacy-layout.pdf', printOptions: legacyOptions }], profile), []);
});
