import { PrintOptions } from '@inklly/shared';

/**
 * Pure helpers that translate operating-system printer metadata and Inklly
 * print options into spooler commands. Kept free of I/O so every platform's
 * behaviour can be tested on any machine.
 */

export interface DetectedCapabilities {
  /** null means the driver did not say. */
  color: boolean | null;
  duplex: boolean | null;
  /** Inklly paper sizes the driver lists (only sizes the agent can request). */
  paperSizes: Array<'A4' | 'A3'>;
}

export interface CupsQueue {
  name: string;
  isOnline: boolean;
  isDefault: boolean;
}

/** Maps driver paper names (e.g. "A4", "A4 210 x 297 mm", "iso_a3_297x420mm") to Inklly sizes. */
export function mapPaperNames(names: readonly string[]): Array<'A4' | 'A3'> {
  const sizes = new Set<'A4' | 'A3'>();
  for (const raw of names) {
    const name = String(raw).toLowerCase();
    if (/(^|[^a-z0-9])(iso_)?a4([^0-9]|$)/.test(name)) sizes.add('A4');
    if (/(^|[^a-z0-9])(iso_)?a3([^0-9]|$)/.test(name)) sizes.add('A3');
  }
  return [...sizes].sort() as Array<'A4' | 'A3'>;
}

/** Parses `lpstat -p` and `lpstat -d` output into queues. */
export function parseCupsQueues(lpstatPrinters: string, lpstatDefault: string): CupsQueue[] {
  const defaultMatch = /system default destination:\s*(\S+)/i.exec(lpstatDefault);
  const defaultName = defaultMatch ? defaultMatch[1] : '';
  const queues: CupsQueue[] = [];
  for (const line of lpstatPrinters.split(/\r?\n/)) {
    const match = /^printer\s+(\S+)\s+(.*)$/i.exec(line.trim());
    if (!match) continue;
    const [, name, rest] = match;
    // "is idle." / "now printing ..." are usable; "disabled since" is not.
    const isOnline = !/disabled/i.test(rest);
    queues.push({ name, isOnline, isDefault: name === defaultName });
  }
  return queues;
}

// CUPS printer-type bit flags (cups/cups.h).
const CUPS_PRINTER_COLOR = 0x0004;
const CUPS_PRINTER_DUPLEX = 0x0010;

/**
 * Reads capabilities from `lpoptions -p NAME` (printer attributes) and
 * `lpoptions -p NAME -l` (driver options). printer-type is authoritative when
 * present; PPD options fill gaps.
 */
export function parseCupsCapabilities(attributes: string, driverOptions: string): DetectedCapabilities & { makeAndModel: string | null } {
  let color: boolean | null = null;
  let duplex: boolean | null = null;

  const typeMatch = /(?:^|\s)printer-type=(\d+)/.exec(attributes);
  if (typeMatch) {
    const type = Number(typeMatch[1]);
    color = (type & CUPS_PRINTER_COLOR) !== 0;
    duplex = (type & CUPS_PRINTER_DUPLEX) !== 0;
  }

  const optionValues = (pattern: RegExp): string[] | null => {
    const line = driverOptions.split(/\r?\n/).find((entry) => pattern.test(entry));
    if (!line) return null;
    const values = line.slice(line.indexOf(':') + 1).trim().split(/\s+/).map((value) => value.replace(/^\*/, ''));
    return values.filter(Boolean);
  };

  if (color === null) {
    const colorModel = optionValues(/^(ColorModel|print-color-mode|ColorMode)\//i);
    if (colorModel) color = colorModel.some((value) => /rgb|cmy|color|colour/i.test(value) && !/^gray|^grey|^mono/i.test(value));
  }
  if (duplex === null) {
    const duplexValues = optionValues(/^(Duplex|sides)\//i);
    if (duplexValues) duplex = duplexValues.some((value) => /duplex(no)?tumble|two-sided/i.test(value));
  }

  const pageSizes = optionValues(/^(PageSize|media)\//i) || [];
  const makeMatch = /printer-make-and-model='([^']*)'|printer-make-and-model=(\S+)/.exec(attributes);
  return {
    color,
    duplex,
    paperSizes: mapPaperNames(pageSizes),
    makeAndModel: makeMatch ? (makeMatch[1] ?? makeMatch[2] ?? null) : null,
  };
}

/** Win32_Printer.CapabilityDescriptions / PrinterPaperNames → capabilities. */
export function parseWindowsCapabilities(capabilityDescriptions: unknown, paperNames: unknown): DetectedCapabilities {
  const caps = Array.isArray(capabilityDescriptions) ? capabilityDescriptions.map(String) : [];
  const papers = Array.isArray(paperNames) ? paperNames.map(String) : [];
  return {
    color: caps.length ? caps.some((cap) => /^colou?r$/i.test(cap.trim())) : null,
    duplex: caps.length ? caps.some((cap) => /^duplex$/i.test(cap.trim())) : null,
    paperSizes: mapPaperNames(papers),
  };
}

/**
 * Mixed-colour documents go to the printer as one colour job so pages stay in
 * order. Pages without colour content print with black toner only; the
 * customer is still charged the mixed rate the quote showed.
 */
export function effectiveColorMode(options: Pick<PrintOptions, 'colorMode'>): 'bw' | 'color' {
  return options.colorMode === 'bw' ? 'bw' : 'color';
}

export type PrintSupportIssue = string | null;

/** Settings every executor refuses before touching the printer. */
export function unsupportedPrintOptions(options: PrintOptions): PrintSupportIssue {
  const pagesPerSheet = options.pagesPerSheet ?? 1;
  if (options.duplexMode === 'duplex_manual') return 'Manual duplex needs an operator at the printer; no document was submitted.';
  if (pagesPerSheet !== 1) return 'Multiple pages per sheet is not supported by this agent; no document was submitted.';
  if (!['A4', 'A3', 'PLAIN'].includes(String(options.paperSize))) return 'This agent cannot verify the requested paper size/type; no document was submitted.';
  const copies = Number(options.copies);
  if (!Number.isInteger(copies) || copies < 1 || copies > 99) return 'Invalid copy count; no document was submitted.';
  if (options.pageRange && options.pageRange !== 'All' && !/^\s*\d+(\s*-\s*\d+)?(\s*,\s*\d+(\s*-\s*\d+)?)*\s*$/.test(options.pageRange)) {
    return 'Invalid page range; no document was submitted.';
  }
  return null;
}

/** SumatraPDF `-print-settings` value for Windows. */
export function buildSumatraSettings(options: PrintOptions): string {
  const parts: string[] = [`${Number(options.copies)}x`, effectiveColorMode(options) === 'bw' ? 'monochrome' : 'color'];
  if (options.pageRange && options.pageRange !== 'All') parts.push(options.pageRange.replace(/\s+/g, ''));
  if (options.fitMode === 'fit') parts.push('fit');
  if (options.orientation === 'portrait' || options.orientation === 'landscape') parts.push(options.orientation);
  if (options.duplexMode === 'duplex_auto') parts.push(options.orientation === 'landscape' ? 'duplexshort' : 'duplexlong');
  else parts.push('simplex');
  parts.push(options.collation ? 'collate' : 'nocollate');
  if (options.paperSize === 'A4' || options.paperSize === 'A3') parts.push(`paper=${options.paperSize}`);
  return parts.join(',');
}

/** `lp` arguments for CUPS (macOS and Linux). Uses IPP standard options so any driver can honour them. */
export function buildLpArgs(queueName: string, filePath: string, options: PrintOptions, title: string): string[] {
  const color = effectiveColorMode(options);
  const args = ['-d', queueName, '-n', String(Number(options.copies)), '-t', title.replace(/[^\w .()-]/g, '_').slice(0, 120) || 'Inklly print'];
  const opt = (value: string) => { args.push('-o', value); };
  opt(`print-color-mode=${color === 'bw' ? 'monochrome' : 'color'}`);
  // PPD-based drivers often ignore print-color-mode; ColorModel=Gray is the common equivalent.
  if (color === 'bw') opt('ColorModel=Gray');
  if (options.duplexMode === 'duplex_auto') opt(options.orientation === 'landscape' ? 'sides=two-sided-short-edge' : 'sides=two-sided-long-edge');
  else opt('sides=one-sided');
  if (options.paperSize === 'A4' || options.paperSize === 'A3') opt(`media=${options.paperSize}`);
  if (options.pageRange && options.pageRange !== 'All') opt(`page-ranges=${options.pageRange.replace(/\s+/g, '')}`);
  if (options.orientation === 'landscape') opt('orientation-requested=4');
  else if (options.orientation === 'portrait') opt('orientation-requested=3');
  if (options.fitMode === 'fit') opt('fit-to-page');
  opt(`collate=${options.collation ? 'true' : 'false'}`);
  args.push('--', filePath);
  return args;
}

/** Extracts the CUPS job id from `lp` output ("request id is Office-42 (1 file(s))"). */
export function parseLpJobId(stdout: string): number | undefined {
  const match = /request id is \S+-(\d+)/i.exec(stdout);
  return match ? Number(match[1]) : undefined;
}
