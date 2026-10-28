import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PrintCommandTicket, SpoolerResult } from '@inklly/shared';
import { PrinterDiscoveryService, DiscoveredPrinter } from './printer-discovery';

const execFileAsync = promisify(execFile);

export interface SpoolerExecutionOptions {
  simulateFailure?: 'TIMEOUT' | 'PAPER_JAM_UNCERTAIN' | 'SPOOLER_CRASH';
  targetPrinterOverride?: string;
  downloadHeaders?: Record<string, string>;
}

export class SpoolerExecutor {
  public static async executeTicket(
    ticket: PrintCommandTicket,
    options?: SpoolerExecutionOptions
  ): Promise<SpoolerResult> {
    const timestamp = new Date().toISOString();

    // 1. Check for intentional test simulations
    if (options?.simulateFailure === 'PAPER_JAM_UNCERTAIN') {
      return {
        attemptId: ticket.attemptId,
        jobId: ticket.jobId,
        status: 'OUTPUT_UNCERTAIN',
        errorMessage: 'Hardware alert: Paper jam reported during duplex feed. Physical sheets uncertain.',
        timestamp,
      };
    }

    if (options?.simulateFailure === 'TIMEOUT') {
      return {
        attemptId: ticket.attemptId,
        jobId: ticket.jobId,
        status: 'OUTPUT_UNCERTAIN',
        errorMessage: 'Spooler connection timed out while sending raw PCL stream. Verification required.',
        timestamp,
      };
    }

    if (options?.simulateFailure === 'SPOOLER_CRASH') {
      return {
        attemptId: ticket.attemptId,
        jobId: ticket.jobId,
        status: 'FAILED',
        errorMessage: 'Print spooler subsystem RPC failed.',
        timestamp,
      };
    }

    // Pilot mode must never send customer documents to a physical printer.
    // Enabling real printer execution is a separate rollout decision after
    // hardware, page-count, and output-reconciliation behavior is validated.
    if (process.env.INKLLY_ENABLE_PHYSICAL_PRINTING !== 'true') {
      return {
        attemptId: ticket.attemptId,
        jobId: ticket.jobId,
        status: 'FAILED',
        errorMessage: 'Physical printing is disabled for this pilot; no document was downloaded or submitted.',
        timestamp,
      };
    }

    // 2. Physical Hardware Spooling (if on Windows and not in pure unit test mock mode)
    if (process.platform === 'win32' && process.env.NODE_ENV !== 'test') {
      try {
        const result = await this.spoolToWindowsPrinter(ticket, options?.targetPrinterOverride, options?.downloadHeaders);
        if (result) return result;
      } catch (err: any) {
        console.error('[SpoolerExecutor] Windows physical spool error:', err);
        return {
          attemptId: ticket.attemptId,
          jobId: ticket.jobId,
          status: 'OUTPUT_UNCERTAIN',
          errorMessage: `Hardware Spooler Alert: ${err.message || 'Driver error during paper feed'}`,
          timestamp,
        };
      }
    }

    // Never report success unless a real printer spooler accepted the document.
    // A missing platform driver or unsupported OS must not create billable output.
    return {
      attemptId: ticket.attemptId,
      jobId: ticket.jobId,
      status: 'FAILED',
      errorMessage: process.platform === 'win32'
        ? 'No supported print spooler executable is installed; no print was submitted.'
        : 'Physical printing is supported only by the Windows desktop agent; no print was submitted.',
      timestamp,
    };
  }

  private static async spoolToWindowsPrinter(
    ticket: PrintCommandTicket,
    printerOverride?: string,
    downloadHeaders?: Record<string, string>
  ): Promise<SpoolerResult | null> {
    if (process.env.NODE_ENV === 'test') {
      return null;
    }
    const timestamp = new Date().toISOString();
    const possibleBinPaths = [
      path.join(__dirname, '..', 'bin', 'SumatraPDF.exe'),
      path.join(process.cwd(), 'bin', 'SumatraPDF.exe'),
      path.join(process.cwd(), 'apps', 'agent', 'bin', 'SumatraPDF.exe'),
    ];

    const sumatraExe = possibleBinPaths.find((p) => fs.existsSync(p));
    if (!sumatraExe) throw new Error('SumatraPDF.exe is not installed with the agent.');

    // Resolve only the explicitly assigned Windows queue. Guessing another
    // printer risks sending a customer's document to the wrong device.
    const requestedPrinter = printerOverride || ticket.printerId;
    let targetPrinter = '';
    try {
      const detected: DiscoveredPrinter[] = await PrinterDiscoveryService.discoverPrinters();
      const match = detected.find((p: DiscoveredPrinter) => p.name === requestedPrinter);
      if (match?.isOnline) targetPrinter = match.name;
    } catch {
      // Discovery failure means no safe target is known.
    }
    if (!targetPrinter) {
      return {
        attemptId: ticket.attemptId,
        jobId: ticket.jobId,
        status: 'FAILED',
        errorMessage: 'The assigned printer queue is not present and online on this agent; no document was submitted.',
        timestamp,
      };
    }

    const printOptions = ticket.options;
    if (printOptions.colorMode === 'mixed' || printOptions.duplexMode === 'duplex_manual' || printOptions.pagesPerSheet !== 1) {
      return {
        attemptId: ticket.attemptId,
        jobId: ticket.jobId,
        status: 'FAILED',
        errorMessage: 'This agent cannot safely apply mixed-color, manual-duplex, or multi-page-per-sheet settings; no document was submitted.',
        timestamp,
      };
    }

    // Prepare printable PDF document
    let filePath = ticket.documentUrl;
    let isTempFile = false;

    // Check if authentic uploaded document exists on disk via storageKey or uploads folder
    const customKey = (ticket as any).storageKey as string | undefined;
    const candidatePaths = [
      customKey ? path.join(process.cwd(), customKey) : '',
    ].filter(Boolean);

    for (const cp of candidatePaths) {
      if (fs.existsSync(cp)) {
        filePath = cp;
        console.log(`[Inklly Spooler] Located authentic uploaded document on disk: ${filePath}`);
        break;
      }
    }

    // Download remote document if URL provided
    if ((!filePath || !fs.existsSync(filePath)) && ticket.documentUrl && (ticket.documentUrl.startsWith('http://') || ticket.documentUrl.startsWith('https://'))) {
      try {
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const localPath = path.join(tempDir, `${ticket.jobId}-${ticket.fileName || 'job.pdf'}`);
        const res = await fetch(ticket.documentUrl, { headers: downloadHeaders });
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(localPath, buffer);
          filePath = localPath;
          isTempFile = true;
          console.log(`[Inklly Spooler] Successfully downloaded customer document: ${localPath}`);
        }
      } catch (err) {
        console.warn('[Inklly Spooler] Could not download remote document, fallback to receipt:', err);
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return {
        attemptId: ticket.attemptId,
        jobId: ticket.jobId,
        status: 'FAILED',
        errorMessage: 'The customer document is unavailable; no substitute document was printed.',
        timestamp: new Date().toISOString(),
      };
    }

    const copies = Number(printOptions.copies);
    if (!Number.isInteger(copies) || copies < 1 || copies > 99) {
      return { attemptId: ticket.attemptId, jobId: ticket.jobId, status: 'FAILED', errorMessage: 'Invalid copy count; no document was submitted.', timestamp };
    }
    const settingsParts: string[] = [`${copies}x`, printOptions.colorMode === 'bw' ? 'monochrome' : 'color'];
    if (printOptions.pageRange && printOptions.pageRange !== 'All') settingsParts.push(printOptions.pageRange);
    if (printOptions.fitMode === 'fit') settingsParts.push('fit');
    if (printOptions.orientation === 'portrait' || printOptions.orientation === 'landscape') settingsParts.push(printOptions.orientation);
    if (printOptions.duplexMode === 'duplex_auto') settingsParts.push('duplex');
    else settingsParts.push('simplex');
    settingsParts.push(printOptions.collation ? 'collate' : 'nocollate');
    if (printOptions.paperSize === 'A4' || printOptions.paperSize === 'A3') settingsParts.push(`paper=${printOptions.paperSize}`);
    else if (printOptions.paperSize !== 'PLAIN') {
      return { attemptId: ticket.attemptId, jobId: ticket.jobId, status: 'FAILED', errorMessage: 'This agent cannot verify the requested paper size/type; no document was submitted.', timestamp };
    }
    const settings = settingsParts.join(',');

    console.log(`[Inklly Spooler] Spooling ${filePath} to physical printer "${targetPrinter}" via ${sumatraExe}...`);

    try {
      await execFileAsync(sumatraExe, [
        '-print-to',
        targetPrinter,
        '-silent',
        '-print-settings',
        settings,
        filePath,
      ]);

      console.log(`[Inklly Spooler] Physical spool successfully dispatched for Job ${ticket.jobId} to "${targetPrinter}".`);

      return {
        attemptId: ticket.attemptId,
        jobId: ticket.jobId,
        status: 'SUBMITTED_TO_SPOOLER',
        timestamp,
      };
    } finally {
      if (isTempFile && fs.existsSync(filePath)) {
        setTimeout(() => {
          try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          } catch {}
        }, 15000);
      }
    }
  }

  private static generateOrderPdf(ticket: PrintCommandTicket, printerName: string): string {
    const tmpPath = path.join(os.tmpdir(), `inklly_${ticket.jobId}_${Date.now()}.pdf`);
    const lines = [
      `Order Ticket: #${ticket.jobId}`,
      `File Name: ${ticket.fileName || 'Customer_Document.pdf'}`,
      `Target Hardware: ${printerName}`,
      `Copies: ${ticket.options?.copies || 1} | Color: ${(ticket.options as any)?.color || ticket.options?.colorMode === 'color' ? 'Yes' : 'B&W'}`,
      `Duplex Mode: ${(ticket.options as any)?.duplex || ticket.options?.duplexMode?.includes('duplex') ? 'Duplex' : 'Simplex'}`,
      `Merchant Shop ID: ${ticket.shopId}`,
      `Dispatched by Inklly Desktop Edge Spooler`,
      `Status: Spooled to Windows Print Spooler -> ${printerName}`,
    ];

    let streamText = 'BT\n/F1 18 Tf\n50 780 Td\n(INKLLY AUTONOMOUS PRINT SYSTEM) Tj\n/F1 11 Tf\n';
    for (const line of lines) {
      streamText += `0 -24 Td\n(${line.replace(/[()\\\\]/g, '')}) Tj\n`;
    }
    streamText += 'ET\n';

    const streamLength = Buffer.byteLength(streamText, 'utf8');
    const pdf =
      '%PDF-1.4\n' +
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n' +
      `4 0 obj\n<< /Length ${streamLength} >>\nstream\n` +
      streamText +
      'endstream\nendobj\n' +
      '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
      'xref\n0 6\n' +
      '0000000000 65535 f \n' +
      '0000000009 00000 n \n' +
      '0000000058 00000 n \n' +
      '0000000115 00000 n \n' +
      '0000000244 00000 n \n' +
      '0000000350 00000 n \n' +
      'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n450\n%%EOF\n';

    fs.writeFileSync(tmpPath, Buffer.from(pdf, 'utf8'));
    return tmpPath;
  }
}
