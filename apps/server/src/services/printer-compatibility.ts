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
    } else if (options.colorMode === 'mixed') {
      issues.add(`${label} requests mixed-color pages, which the current agent cannot apply safely.`);
    } else if (options.colorMode === 'color' && !printer.supportsColor) {
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
