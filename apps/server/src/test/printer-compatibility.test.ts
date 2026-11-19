import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PrintOptions, PrinterDevice } from '@inklly/shared';
import { chooseAutomaticPrinter, getPrinterCompatibilityIssues } from '../services/printer-compatibility';

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

test('mixed color needs a color printer; manual duplex is rejected', () => {
  const issues = getPrinterCompatibilityIssues([
    { fileName: 'mixed.pdf', printOptions: options({ colorMode: 'mixed', colorPages: '2,4' }) },
    { fileName: 'manual.pdf', printOptions: options({ duplexMode: 'duplex_manual' }) },
  ], profile);
  assert.match(issues.join(' '), /mixed\.pdf.*requires a color capable printer/i);
  assert.match(issues.join(' '), /manual duplex, which the current agent cannot apply/i);
  assert.deepEqual(
    getPrinterCompatibilityIssues([{ fileName: 'mixed.pdf', printOptions: options({ colorMode: 'mixed', colorPages: '2,4' }) }], { ...profile, supportsColor: true }),
    [],
  );
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

test('one-click print routes each order to a compatible printer', () => {
  const tray = (sizes: Array<'A4' | 'A3'>) => [{ id: `t-${sizes.join()}`, name: 'Tray', supportedSizes: sizes, isDefault: true }];
  const mono = { id: 'p-mono', name: 'Brother Laser', isDefault: false, supportsColor: false, supportsDuplex: true, trays: tray(['A4', 'A3']) };
  const colour = { id: 'p-colour', name: 'Epson Colour', isDefault: false, supportsColor: true, supportsDuplex: false, trays: tray(['A4']) };

  // Black & white goes to the mono laser even though the colour printer could print it.
  assert.equal(chooseAutomaticPrinter([{ printOptions: options() }], [colour, mono]).printer?.id, 'p-mono');
  // Colour and mixed documents need the colour printer.
  assert.equal(chooseAutomaticPrinter([{ printOptions: options({ colorMode: 'color' }) }], [mono, colour]).printer?.id, 'p-colour');
  assert.equal(chooseAutomaticPrinter([{ printOptions: options({ colorMode: 'mixed', colorPages: '1' }) }], [mono, colour]).printer?.id, 'p-colour');
  // A compatible shop default wins.
  assert.equal(chooseAutomaticPrinter([{ printOptions: options() }], [mono, { ...colour, isDefault: true }]).printer?.id, 'p-colour');
  // Colour + duplex: neither printer can do both, so nothing is released and reasons are given per printer.
  const none = chooseAutomaticPrinter([{ fileName: 'brochure.pdf', printOptions: options({ colorMode: 'color', duplexMode: 'duplex_auto' }) }], [mono, colour]);
  assert.equal(none.printer, null);
  assert.deepEqual(Object.keys(none.reasons).sort(), ['Brother Laser', 'Epson Colour']);
});
