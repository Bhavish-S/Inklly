import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PrintCommandTicket, SpoolerResult } from '@inklly/shared';
import { PrinterDiscoveryService, DiscoveredPrinter } from './printer-discovery';
import { buildLpArgs, buildSumatraSettings, parseLpJobId, unsupportedPrintOptions } from './print-commands';

const execFileAsync = promisify(execFile);

export interface SpoolerExecutionOptions {
  simulateFailure?: 'TIMEOUT' | 'PAPER_JAM_UNCERTAIN' | 'SPOOLER_CRASH';
  targetPrinterOverride?: string;
  downloadServerUrl?: string;
  downloadHeaders?: Record<string, string>;
  /** Lets tests exercise the real spool path with a stub spooler command. */
  allowSpoolInTests?: boolean;
}

const MAX_PRINT_FILE_BYTES = 35 * 1024 * 1024;
const ALLOWED_DOWNLOAD_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/tiff']);

/** Download only an agent-file route on the paired API origin. The ticket URL is untrusted input. */
export async function downloadTicketDocument(
  documentUrl: string,
  serverUrl: string,
  headers: Record<string, string> = {}
): Promise<string> {
  const expectedBase = new URL(serverUrl);
  const target = new URL(documentUrl);
  const expectedPath = `${expectedBase.pathname.replace(/\/$/, '')}/agent/files/`;
  const fileId = target.pathname.startsWith(expectedPath) ? target.pathname.slice(expectedPath.length) : '';
  if (target.origin !== expectedBase.origin || target.username || target.password || target.search || target.hash ||
      target.pathname !== `${expectedPath}${fileId}` || !/^[A-Za-z0-9_-]{1,128}$/.test(fileId) ||
      (target.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))) {
    throw new Error('Print document URL does not match the paired Inklly server.');
  }

  const response = await fetch(target, { headers, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
  if (response.status >= 300 && response.status < 400) throw new Error('Print document server redirects are not allowed.');
  if (!response.ok) throw new Error(`Print document download failed (HTTP ${response.status}).`);
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_PRINT_FILE_BYTES) throw new Error('Print document exceeds the 35 MiB download limit.');
  const contentType = (response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
  if (!ALLOWED_DOWNLOAD_TYPES.has(contentType)) throw new Error('Print document has an unsupported content type.');
  if (!response.body) throw new Error('Print document response is empty.');

  const chunks: Buffer[] = [];
  let total = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PRINT_FILE_BYTES) {
        await reader.cancel();
        throw new Error('Print document exceeds the 35 MiB download limit.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  const body = Buffer.concat(chunks, total);
  const isPdf = body.subarray(0, 5).toString('ascii') === '%PDF-';
  const isJpeg = body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  const isPng = body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isTiff = body.subarray(0, 4).toString('ascii') === 'II*\\0' || body.subarray(0, 4).toString('ascii') === 'MM\\0*';
  if (!body.length || !((contentType === 'application/pdf' && isPdf) || (contentType === 'image/jpeg' && isJpeg) ||
      (contentType === 'image/png' && isPng) || (contentType === 'image/tiff' && isTiff))) {
    throw new Error('Print document content does not match its declared type.');
  }

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'inklly-print-'));
  // Spoolers and viewers pick a document handler by extension, so name the
  // file after its verified content type (never the customer's file name).
  const extension = contentType === 'application/pdf' ? '.pdf' : contentType === 'image/jpeg' ? '.jpg' : contentType === 'image/png' ? '.png' : '.tif';
  const filePath = path.join(tempDir, `document${extension}`);
  try {
    await fs.promises.writeFile(filePath, body, { flag: 'wx', mode: 0o600 });
    return filePath;
  } catch (error) {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
    throw error;
  }
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

    // 2. Physical spooling through the operating system's own print system:
    //    Windows spooler (SumatraPDF) or CUPS (macOS/Linux, via lp).
    const supported = process.platform === 'win32' || process.platform === 'darwin' || process.platform === 'linux' || process.platform === 'freebsd';
    if (!supported) {
      return {
        attemptId: ticket.attemptId,
        jobId: ticket.jobId,
        status: 'FAILED',
        errorMessage: `Printing is not supported on ${process.platform}; no print was submitted.`,
        timestamp,
      };
    }
    if (process.env.NODE_ENV === 'test' && !options?.allowSpoolInTests) {
      return { attemptId: ticket.attemptId, jobId: ticket.jobId, status: 'FAILED', errorMessage: 'Spooling is disabled in tests; no print was submitted.', timestamp };
    }
    try {
      return await this.spoolToSystemPrinter(ticket, options);
    } catch (err: any) {
      // Anything that fails after the spooler command may have started is
      // ambiguous: never retry automatically.
      console.error('[SpoolerExecutor] Physical spool error:', err);
      return {
        attemptId: ticket.attemptId,
        jobId: ticket.jobId,
        status: 'OUTPUT_UNCERTAIN',
        errorMessage: `Printer spooler alert: ${err?.message || 'driver error'}. Check the printer before retrying.`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private static async spoolToSystemPrinter(ticket: PrintCommandTicket, options?: SpoolerExecutionOptions): Promise<SpoolerResult> {
    const timestamp = new Date().toISOString();
    const fail = (errorMessage: string): SpoolerResult => ({ attemptId: ticket.attemptId, jobId: ticket.jobId, status: 'FAILED', errorMessage, timestamp: new Date().toISOString() });

    const printOptions = ticket.options;
    const unsupported = unsupportedPrintOptions(printOptions);
    if (unsupported) return fail(unsupported);

    // Resolve only the explicitly assigned queue. Guessing another printer
    // risks sending a customer's document to the wrong device.
    const requestedPrinter = options?.targetPrinterOverride || ticket.printerId;
    let targetPrinter = '';
    try {
      const detected: DiscoveredPrinter[] = await PrinterDiscoveryService.discoverPrinters();
      const match = detected.find((p: DiscoveredPrinter) => p.name === requestedPrinter);
      if (match?.isOnline) targetPrinter = match.name;
    } catch {
      // Discovery failure means no safe target is known.
    }
    if (!targetPrinter) return fail('The assigned printer queue is not present and online on this computer; no document was submitted.');

    const windows = process.platform === 'win32';
    let sumatraExe = '';
    if (windows) {
      const possibleBinPaths = [
        path.join(__dirname, '..', 'bin', 'SumatraPDF.exe'),
        path.join(process.cwd(), 'bin', 'SumatraPDF.exe'),
        path.join(process.cwd(), 'apps', 'agent', 'bin', 'SumatraPDF.exe'),
      ];
      sumatraExe = possibleBinPaths.find((p) => fs.existsSync(p)) || '';
      if (!sumatraExe) return fail('SumatraPDF.exe is not installed with the agent; no print was submitted.');
    }

    // The ticket may contain a customer filename or a hostile URL. Never use either
    // as a filesystem path or send paired credentials outside the configured API origin.
    if (!ticket.documentUrl || !options?.downloadServerUrl) return fail('The customer document is unavailable; no substitute document was printed.');
    let filePath: string;
    try {
      filePath = await downloadTicketDocument(ticket.documentUrl, options.downloadServerUrl, options.downloadHeaders);
    } catch (err: any) {
      return fail(`The customer document could not be validated or downloaded; no print was submitted. ${err?.message || 'Download failed.'}`);
    }

    try {
      let driverJobId: number | undefined;
      if (windows) {
        console.log(`[Inklly Spooler] Sending job ${ticket.jobId} to "${targetPrinter}" via SumatraPDF`);
        await execFileAsync(sumatraExe, ['-print-to', targetPrinter, '-silent', '-print-settings', buildSumatraSettings(printOptions), filePath], { timeout: 120_000, windowsHide: true });
      } else {
        console.log(`[Inklly Spooler] Sending job ${ticket.jobId} to CUPS queue "${targetPrinter}"`);
        const { stdout } = await execFileAsync('lp', buildLpArgs(targetPrinter, filePath, printOptions, ticket.fileName || 'Inklly print'), { timeout: 60_000 });
        driverJobId = parseLpJobId(String(stdout));
      }
      return { attemptId: ticket.attemptId, jobId: ticket.jobId, status: 'SUBMITTED_TO_SPOOLER', driverJobId, timestamp };
    } finally {
      const tempDir = path.dirname(filePath);
      // Give the spooler time to read the file before removing it.
      setTimeout(() => { void fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined); }, 60_000).unref();
    }
  }
}
