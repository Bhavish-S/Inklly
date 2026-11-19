import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';
import { PrintCommandTicket, PrintOptions } from '@inklly/shared';
import {
  buildLpArgs, buildSumatraSettings, effectiveColorMode, mapPaperNames, parseCupsCapabilities,
  parseCupsQueues, parseLpJobId, parseWindowsCapabilities, unsupportedPrintOptions,
} from '../print-commands';
import { PrinterDiscoveryService } from '../printer-discovery';
import { SpoolerExecutor } from '../spooler-executor';

const baseOptions = (overrides: Partial<PrintOptions> = {}): PrintOptions => ({
  colorMode: 'bw', duplexMode: 'simplex', paperSize: 'A4', orientation: 'portrait',
  copies: 1, fitMode: 'fit', pagesPerSheet: 1, collation: true, ...overrides,
});

describe('printer metadata parsing', () => {
  it('maps driver paper names from Windows and CUPS to A4/A3', () => {
    assert.deepEqual(mapPaperNames(['Letter', 'A4', 'A3', 'A5', 'Legal']), ['A3', 'A4']);
    assert.deepEqual(mapPaperNames(['iso_a4_210x297mm', 'na_letter_8.5x11in']), ['A4']);
    assert.deepEqual(mapPaperNames(['A4 210 x 297 mm']), ['A4']);
    assert.deepEqual(mapPaperNames(['A40', 'Letter']), []);
  });

  it('reads Windows capability descriptions', () => {
    assert.deepEqual(parseWindowsCapabilities(['Copies', 'Color', 'Duplex', 'Collate'], ['A4', 'Letter']), { color: true, duplex: true, paperSizes: ['A4'] });
    assert.deepEqual(parseWindowsCapabilities(['Copies', 'Collate'], ['A4', 'A3']), { color: false, duplex: false, paperSizes: ['A3', 'A4'] });
    assert.deepEqual(parseWindowsCapabilities(null, null), { color: null, duplex: null, paperSizes: [] });
  });

  it('parses CUPS queues, offline state and the default queue', () => {
    const queues = parseCupsQueues(
      'printer Office_Laser is idle.  enabled since Tue 10 Nov\nprinter Colour_MFP now printing Colour_MFP-12.  enabled since Tue\nprinter Old_Inkjet disabled since Mon -\n\treason unknown',
      'system default destination: Colour_MFP'
    );
    assert.deepEqual(queues, [
      { name: 'Office_Laser', isOnline: true, isDefault: false },
      { name: 'Colour_MFP', isOnline: true, isDefault: true },
      { name: 'Old_Inkjet', isOnline: false, isDefault: false },
    ]);
  });

  it('reads CUPS capabilities from printer-type flags and driver options', () => {
    // 0x4 colour + 0x10 duplex present
    const colourDuplex = parseCupsCapabilities(
      "copies=1 printer-make-and-model='HP Color LaserJet MFP M479fdw' printer-type=8425500",
      'PageSize/Media Size: Letter *A4 A3 Legal\nColorModel/Color Mode: Gray *RGB\nDuplex/2-Sided Printing: *None DuplexNoTumble DuplexTumble'
    );
    assert.equal(colourDuplex.makeAndModel, 'HP Color LaserJet MFP M479fdw');
    assert.equal(colourDuplex.color, (8425500 & 0x4) !== 0);
    assert.equal(colourDuplex.duplex, (8425500 & 0x10) !== 0);
    assert.deepEqual(colourDuplex.paperSizes, ['A3', 'A4']);

    const ppdOnly = parseCupsCapabilities('', 'PageSize/Media Size: *A4\nColorModel/Color Mode: *Gray\nDuplex/2-Sided: *None');
    assert.deepEqual({ color: ppdOnly.color, duplex: ppdOnly.duplex, paperSizes: ppdOnly.paperSizes }, { color: false, duplex: false, paperSizes: ['A4'] });

    const unknown = parseCupsCapabilities('', '');
    assert.equal(unknown.color, null);
    assert.equal(unknown.duplex, null);
  });
});

describe('spooler command building', () => {
  it('prints mixed-colour documents as one colour job', () => {
    assert.equal(effectiveColorMode({ colorMode: 'mixed' }), 'color');
    assert.equal(effectiveColorMode({ colorMode: 'bw' }), 'bw');
  });

  it('refuses settings the agent cannot apply', () => {
    assert.match(unsupportedPrintOptions(baseOptions({ duplexMode: 'duplex_manual' })) || '', /manual duplex/i);
    assert.match(unsupportedPrintOptions(baseOptions({ pagesPerSheet: 2 })) || '', /pages per sheet/i);
    assert.match(unsupportedPrintOptions(baseOptions({ paperSize: 'PHOTO_4X6' })) || '', /paper size/i);
    assert.match(unsupportedPrintOptions(baseOptions({ copies: 100 })) || '', /copy count/i);
    assert.match(unsupportedPrintOptions(baseOptions({ pageRange: '1-3; rm -rf /' })) || '', /page range/i);
    assert.equal(unsupportedPrintOptions(baseOptions({ colorMode: 'mixed', pageRange: '1-3, 5' })), null);
  });

  it('builds SumatraPDF settings for Windows', () => {
    assert.equal(
      buildSumatraSettings(baseOptions({ copies: 3, colorMode: 'color', duplexMode: 'duplex_auto', orientation: 'landscape', pageRange: '1-3, 5', paperSize: 'A3' })),
      '3x,color,1-3,5,fit,landscape,duplexshort,collate,paper=A3'
    );
    assert.equal(buildSumatraSettings(baseOptions()), '1x,monochrome,fit,portrait,simplex,collate,paper=A4');
  });

  it('builds IPP-standard lp arguments for CUPS', () => {
    const args = buildLpArgs('Office_Laser', '/tmp/x/document.pdf', baseOptions({ copies: 2, duplexMode: 'duplex_auto', pageRange: '2-4', collation: false }), 'Thesis "final".pdf');
    assert.deepEqual(args, [
      '-d', 'Office_Laser', '-n', '2', '-t', 'Thesis _final_.pdf',
      '-o', 'print-color-mode=monochrome', '-o', 'ColorModel=Gray', '-o', 'sides=two-sided-long-edge',
      '-o', 'media=A4', '-o', 'page-ranges=2-4', '-o', 'orientation-requested=3', '-o', 'fit-to-page',
      '-o', 'collate=false', '--', '/tmp/x/document.pdf',
    ]);
    assert.ok(buildLpArgs('Q', '/f.pdf', baseOptions({ colorMode: 'color', orientation: 'landscape', duplexMode: 'duplex_auto' }), 't').includes('sides=two-sided-short-edge'));
    assert.equal(parseLpJobId('request id is Office_Laser-42 (1 file(s))\n'), 42);
  });
});

describe('CUPS end to end with a stub print system', { skip: process.platform === 'win32' }, () => {
  let binDir = '';
  let spoolDir = '';
  let server: http.Server;
  let serverUrl = '';
  const previousPath = process.env.PATH;
  const previousFlag = process.env.INKLLY_ENABLE_PHYSICAL_PRINTING;
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');

  before(async () => {
    binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inklly-stub-bin-'));
    spoolDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inklly-stub-spool-'));
    const write = (name: string, body: string) => {
      fs.writeFileSync(path.join(binDir, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
    };
    write('lpstat', `case "$1" in -d) echo "system default destination: Shop_Laser";; *) echo "printer Shop_Laser is idle.  enabled since today";; esac`);
    write('lpoptions', `if [ "$3" = "-l" ]; then printf 'PageSize/Media Size: *A4 A3\\nDuplex/2-Sided: *None DuplexNoTumble\\n'; else echo "printer-make-and-model='Stub Laser' printer-type=16"; fi`);
    // Records its arguments and the file it was given, like a spooler accepting a job.
    write('lp', `printf '%s\\n' "$@" > "${spoolDir}/args.txt"; for last; do :; done; cp "$last" "${spoolDir}/job.pdf"; echo "request id is Shop_Laser-7 (1 file(s))"`);
    process.env.PATH = `${binDir}${path.delimiter}${previousPath}`;
    process.env.INKLLY_ENABLE_PHYSICAL_PRINTING = 'true';

    server = http.createServer((req, res) => {
      if (req.url === '/api/v1/agent/files/file-123') {
        res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': pdf.length });
        res.end(pdf);
        return;
      }
      res.writeHead(404); res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    serverUrl = `http://127.0.0.1:${(server.address() as any).port}/api/v1`;
  });

  after(async () => {
    process.env.PATH = previousPath;
    if (previousFlag === undefined) delete process.env.INKLLY_ENABLE_PHYSICAL_PRINTING;
    else process.env.INKLLY_ENABLE_PHYSICAL_PRINTING = previousFlag;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(binDir, { recursive: true, force: true });
    fs.rmSync(spoolDir, { recursive: true, force: true });
  });

  it('discovers the queue with driver-reported capabilities', async () => {
    const printers = await PrinterDiscoveryService.discoverPrinters();
    assert.equal(printers.length, 1);
    assert.equal(printers[0].name, 'Shop_Laser');
    assert.equal(printers[0].driverName, 'Stub Laser');
    assert.equal(printers[0].isDefault, true);
    assert.deepEqual(printers[0].capabilities, { color: false, duplex: true, paperSizes: ['A3', 'A4'] });
  });

  it('downloads the customer file and submits it to the CUPS queue with the requested settings', async () => {
    const ticket: PrintCommandTicket = {
      commandId: 'cmd-cups', jobId: 'job-cups', attemptId: 'att-cups', shopId: 'shop-1', printerId: 'Shop_Laser',
      documentUrl: `${serverUrl}/agent/files/file-123`, fileName: 'notes.pdf',
      options: baseOptions({ copies: 2, duplexMode: 'duplex_auto', pageRange: '1-2' }),
      expiresAt: new Date(Date.now() + 60_000).toISOString(), correlationId: 'corr-cups',
    };
    const result = await SpoolerExecutor.executeTicket(ticket, { downloadServerUrl: serverUrl, allowSpoolInTests: true });
    assert.equal(result.status, 'SUBMITTED_TO_SPOOLER', result.errorMessage ?? '');
    assert.equal(result.driverJobId, 7);
    assert.deepEqual(fs.readFileSync(path.join(spoolDir, 'job.pdf')), pdf);
    const args = fs.readFileSync(path.join(spoolDir, 'args.txt'), 'utf8');
    assert.match(args, /-d\nShop_Laser\n-n\n2\n/);
    assert.match(args, /sides=two-sided-long-edge/);
    assert.match(args, /page-ranges=1-2/);
  });

  it('refuses a queue that is not installed on this computer', async () => {
    const result = await SpoolerExecutor.executeTicket({
      commandId: 'cmd-x', jobId: 'job-x', attemptId: 'att-x', shopId: 'shop-1', printerId: 'Some_Other_Printer',
      documentUrl: `${serverUrl}/agent/files/file-123`, fileName: 'x.pdf', options: baseOptions(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(), correlationId: 'c',
    }, { downloadServerUrl: serverUrl, allowSpoolInTests: true });
    assert.equal(result.status, 'FAILED');
    assert.match(result.errorMessage || '', /not present and online/i);
  });
});
