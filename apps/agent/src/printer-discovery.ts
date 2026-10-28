import { execSync } from 'node:child_process';
import { PaperTray, PrinterDevice } from '@inklly/shared';

export interface DiscoveredPrinter {
  name: string;
  driverName: string;
  isOnline: boolean;
  isDefault: boolean;
  supportsColor: boolean;
  supportsDuplex: boolean;
  trays: PaperTray[];
}

export class PrinterDiscoveryService {
  public static async discoverPrinters(): Promise<DiscoveredPrinter[]> {
    const discovered: DiscoveredPrinter[] = [];

    if (process.platform === 'win32') {
      try {
        const cmd = `powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Printer | Select-Object Name,DriverName,PrinterStatus,DetectedErrorState,WorkOffline,Default | ConvertTo-Json"`;
        const stdout = execSync(cmd, { encoding: 'utf-8', timeout: 4000 });
        const parsed = JSON.parse(stdout.trim());
        const list = Array.isArray(parsed) ? parsed : [parsed];

        for (let idx = 0; idx < list.length; idx++) {
          const p = list[idx];
          const name = p.Name || `Printer ${idx + 1}`;
          // Standard windows drivers like Microsoft Print to PDF support color
          // Do not infer device capabilities from marketing names. Windows printer
          // metadata does not reliably expose color/duplex support; report unknown
          // conservatively until the driver capability query is implemented.
          const isColor = false;
          const isDuplex = false;

          discovered.push({
            name,
            driverName: p.DriverName || 'Generic PostScript / PCL',
            isOnline: !Boolean(p.WorkOffline) && ![6, 7].includes(Number(p.PrinterStatus))
              && ![3, 4, 5, 6].includes(Number(p.DetectedErrorState)),
            isDefault: Boolean(p.Default),
            supportsColor: isColor,
            supportsDuplex: isDuplex,
            trays: [],
          });
        }
      } catch {
        // Fallback
      }
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
        const stdout = execSync(`powershell -NoProfile -NonInteractive -Command "${script}"`, {
          encoding: 'utf-8',
          timeout: 4000,
        });
        const row = JSON.parse(stdout.trim());
        const status = String(row.printStatus || '');
        const paperFault = [3, 4, 5, 6].includes(Number(row.detectedErrorState)) || /paper\s*out|no\s*paper/i.test(status);
        const jamFault = [4, 6, 7, 8, 9, 10, 11].includes(Number(row.detectedErrorState)) || /jam|door\s*open/i.test(status);
        const hardFault = !row.exists || row.workOffline || [6, 7].includes(Number(row.printerStatus)) || jamFault || paperFault;
        return {
          ready: !hardFault,
          status: status || `PrinterStatus=${row.printerStatus}`,
          paperFault,
          jamFault,
        };
      } catch {
        return { ready: false, status: 'Printer health could not be verified', paperFault: false, jamFault: false };
      }
    }
    return { ready: false, status: 'Printer health checks are unavailable on this operating system', paperFault: false, jamFault: false };
  }
}
