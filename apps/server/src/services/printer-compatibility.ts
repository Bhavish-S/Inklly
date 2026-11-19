import { PrinterDevice, PrintOptions } from '@inklly/shared';

const SUPPORTED_PAPER_SIZES = new Set(['A4', 'A3', 'PHOTO_4X6', 'PHOTO_5X7', 'GLOSSY', 'PLAIN']);

export interface RequestedPrintFile {
  fileName?: string;
  printOptions?: Partial<PrintOptions> | null;
}

/**
 * Fail closed when the selected queue cannot be proven to support every
 * customer-requested print mode. Registration and live inventory are not
 * evidence of capability unless the queue has a saved profile.
 */
export function getPrinterCompatibilityIssues(
  files: readonly RequestedPrintFile[],
  printer: Pick<PrinterDevice, 'supportsColor' | 'supportsDuplex' | 'trays'>
): string[] {
  const issues = new Set<string>();

  if (!files.length) issues.add('The order has no print files.');
  if (!printer.trays.length) issues.add('The printer has no verified paper tray profile.');

  for (const file of files) {
    const label = typeof file.fileName === 'string' && file.fileName.trim()
      ? `File “${file.fileName.trim().slice(0, 100)}”`
      : 'A print file';
    const options = file.printOptions;

    if (!options || typeof options !== 'object') {
      issues.add(`${label} has no saved print settings.`);
      continue;
    }

    if (!['bw', 'color', 'mixed'].includes(String(options.colorMode))) {
      issues.add(`${label} has an unsupported color mode.`);
    } else if ((options.colorMode === 'color' || options.colorMode === 'mixed') && !printer.supportsColor) {
      // Mixed documents print as one colour job so pages stay in order.
      issues.add(`${label} requires a color capable printer.`);
    }

    if (!['simplex', 'duplex_auto', 'duplex_manual'].includes(String(options.duplexMode))) {
      issues.add(`${label} has an unsupported print-side mode.`);
    } else if (options.duplexMode === 'duplex_manual') {
      issues.add(`${label} requests manual duplex, which the current agent cannot apply safely.`);
    } else if (options.duplexMode !== 'simplex' && !printer.supportsDuplex) {
      issues.add(`${label} requires duplex printing.`);
    }

    if (options.pagesPerSheet !== undefined && options.pagesPerSheet !== 1) {
      issues.add(`${label} requests multiple pages per sheet, which the current agent cannot apply safely.`);
    }

    const paperSize = options.paperSize;
    if (!paperSize || !SUPPORTED_PAPER_SIZES.has(String(paperSize))) {
      issues.add(`${label} has an unsupported paper size.`);
      continue;
    }
    if (!['A4', 'A3', 'PLAIN'].includes(String(paperSize))) {
      issues.add(`${label} requests a paper size or type the current agent cannot verify.`);
      continue;
    }
    if (!printer.trays.some((tray) => tray.supportedSizes.includes(paperSize as PrinterDevice['trays'][number]['supportedSizes'][number]))) {
      issues.add(`${label} requires ${String(paperSize)} paper, which is not supported by a configured tray.`);
    }
  }

  return [...issues];
}

/**
 * One-click routing: picks the printer for an order when staff did not choose
 * one. Only printers that pass every compatibility check are considered. The
 * shop's default wins when it qualifies; otherwise all-black-and-white orders
 * go to a mono printer (cheaper per page) and colour orders to a colour one.
 */
export function chooseAutomaticPrinter<P extends Pick<PrinterDevice, 'id' | 'name' | 'isDefault' | 'supportsColor' | 'supportsDuplex' | 'trays'>>(
  files: readonly RequestedPrintFile[],
  candidates: readonly P[],
): { printer: P | null; reasons: Record<string, string[]> } {
  const reasons: Record<string, string[]> = {};
  const compatible = candidates.filter((candidate) => {
    const issues = getPrinterCompatibilityIssues(files, candidate);
    if (issues.length) reasons[candidate.name] = issues;
    return issues.length === 0;
  });
  if (!compatible.length) return { printer: null, reasons };
  const preferred = compatible.find((candidate) => candidate.isDefault);
  if (preferred) return { printer: preferred, reasons };
  const needsColor = files.some((file) => file.printOptions?.colorMode === 'color' || file.printOptions?.colorMode === 'mixed');
  const ranked = [...compatible].sort((a, b) => {
    if (!needsColor && a.supportsColor !== b.supportsColor) return a.supportsColor ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  return { printer: ranked[0], reasons };
}
