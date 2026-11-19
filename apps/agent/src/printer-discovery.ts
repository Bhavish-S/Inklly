import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PaperTray } from '@inklly/shared';
import { DetectedCapabilities, parseCupsCapabilities, parseCupsQueues, parseWindowsCapabilities } from './print-commands';

const execFileAsync = promisify(execFile);

export interface DiscoveredPrinter {
  name: string;
  driverName: string;
  isOnline: boolean;
  isDefault: boolean;
  /** Retained for callers that predate capability detection; mirrors capabilities. */
  supportsColor: boolean;
  supportsDuplex: boolean;
  trays: PaperTray[];
  capabilities: DetectedCapabilities;
}

const run = async (file: string, args: string[], timeout = 5000): Promise<string> => {
  const { stdout } = await execFileAsync(file, args, { encoding: 'utf-8', timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  return String(stdout);
};

/**
 * Finds the printer queues the operating system already knows about. Any
 * printer with a working OS driver (USB, network, shared, IPP Everywhere /
 * AirPrint, vendor drivers) appears here, which is what makes the agent
 * brand-independent.
 */
export class PrinterDiscoveryService {
  public static async discoverPrinters(): Promise<DiscoveredPrinter[]> {
    try {
      if (process.platform === 'win32') return await this.discoverWindows();
      if (process.platform === 'darwin' || process.platform === 'linux' || process.platform === 'freebsd') return await this.discoverCups();
    } catch (error) {
      console.warn('[Inklly Agent] Printer discovery failed:', error instanceof Error ? error.message : error);
    }
    return [];
  }

  private static async discoverWindows(): Promise<DiscoveredPrinter[]> {
    const script = 'Get-CimInstance Win32_Printer | Select-Object Name,DriverName,PrinterStatus,DetectedErrorState,WorkOffline,Default,CapabilityDescriptions,PrinterPaperNames | ConvertTo-Json -Depth 3';
    const stdout = await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], 8000);
    if (!stdout.trim()) return [];
    const parsed = JSON.parse(stdout.trim());
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.filter((p: any) => p && typeof p.Name === 'string').map((p: any) => {
      const capabilities = parseWindowsCapabilities(p.CapabilityDescriptions, p.PrinterPaperNames);
      return {
        name: p.Name,
        driverName: p.DriverName || 'Unknown driver',
        isOnline: !Boolean(p.WorkOffline) && ![6, 7].includes(Number(p.PrinterStatus))
          && ![3, 4, 5, 6].includes(Number(p.DetectedErrorState)),
        isDefault: Boolean(p.Default),
        supportsColor: capabilities.color === true,
        supportsDuplex: capabilities.duplex === true,
        trays: [],
        capabilities,
      };
    });
  }

  private static async discoverCups(): Promise<DiscoveredPrinter[]> {
    let printersOut = '';
    try {
      printersOut = await run('lpstat', ['-p']);
    } catch (error: any) {
      // lpstat exits non-zero when no queues are installed.
      printersOut = String(error?.stdout || '');
    }
    let defaultOut = '';
    try { defaultOut = await run('lpstat', ['-d']); } catch (error: any) { defaultOut = String(error?.stdout || ''); }

    const queues = parseCupsQueues(printersOut, defaultOut);
    const discovered: DiscoveredPrinter[] = [];
    for (const queue of queues) {
      let attributes = '';
      let driverOptions = '';
      try { attributes = await run('lpoptions', ['-p', queue.name]); } catch { /* capability unknown */ }
      try { driverOptions = await run('lpoptions', ['-p', queue.name, '-l']); } catch { /* capability unknown */ }
      const { makeAndModel, ...capabilities } = parseCupsCapabilities(attributes, driverOptions);
      discovered.push({
        name: queue.name,
        driverName: makeAndModel || 'CUPS queue',
        isOnline: queue.isOnline,
        isDefault: queue.isDefault,
        supportsColor: capabilities.color === true,
        supportsDuplex: capabilities.duplex === true,
        trays: [],
        capabilities,
      });
    }
    return discovered;
  }

  public static async checkPrinterHealth(printerName: string): Promise<{
    ready: boolean;
    status: string;
    paperFault: boolean;
    jamFault: boolean;
  }> {
    if (process.platform === 'win32') {
      try {
        const escapedName = printerName.replace(/'/g, "''");
        const script = `$ErrorActionPreference='Stop'; $p=Get-CimInstance Win32_Printer | Where-Object {$_.Name -eq '${escapedName}'} | Select-Object -First 1; if($null -eq $p){[pscustomobject]@{exists=$false;workOffline=$true;printerStatus=7;detectedErrorState=9;printStatus='NotAvailable'}|ConvertTo-Json -Compress;exit}; $gp=$null; try{$gp=Get-Printer -Name '${escapedName}' -ErrorAction Stop}catch{}; [pscustomobject]@{exists=$true;workOffline=[bool]$p.WorkOffline;printerStatus=[int]$p.PrinterStatus;detectedErrorState=[int]$p.DetectedErrorState;printStatus=if($gp){[string]$gp.PrinterStatus}else{''}}|ConvertTo-Json -Compress`;
        const stdout = await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], 4000);
        const row = JSON.parse(stdout.trim());
        const status = String(row.printStatus || '');
        const paperFault = [3, 4, 5, 6].includes(Number(row.detectedErrorState)) || /paper\s*out|no\s*paper/i.test(status);
        const jamFault = [4, 6, 7, 8, 9, 10, 11].includes(Number(row.detectedErrorState)) || /jam|door\s*open/i.test(status);
        const hardFault = !row.exists || row.workOffline || [6, 7].includes(Number(row.printerStatus)) || jamFault || paperFault;
        return { ready: !hardFault, status: status || `PrinterStatus=${row.printerStatus}`, paperFault, jamFault };
      } catch {
        return { ready: false, status: 'Printer health could not be verified', paperFault: false, jamFault: false };
      }
    }
    if (process.platform === 'darwin' || process.platform === 'linux' || process.platform === 'freebsd') {
      try {
        const out = await run('lpstat', ['-p', printerName]);
        const queue = parseCupsQueues(out, '').find((entry) => entry.name === printerName);
        const paperFault = /media-empty|paper out|out of paper/i.test(out);
        const jamFault = /jam|door-open|cover open/i.test(out);
        return { ready: Boolean(queue?.isOnline) && !paperFault && !jamFault, status: out.trim().slice(0, 200), paperFault, jamFault };
      } catch {
        return { ready: false, status: 'Printer queue not found', paperFault: false, jamFault: false };
      }
    }
    return { ready: false, status: 'Printer health checks are unavailable on this operating system', paperFault: false, jamFault: false };
  }
}
