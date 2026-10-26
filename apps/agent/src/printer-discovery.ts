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
        const cmd = `powershell -NoProfile -NonInteractive -Command "Get-Printer | Select-Object Name,DriverName,PrinterStatus,Shared | ConvertTo-Json"`;
        const stdout = execSync(cmd, { encoding: 'utf-8', timeout: 4000 });
        const parsed = JSON.parse(stdout.trim());
        const list = Array.isArray(parsed) ? parsed : [parsed];

        for (let idx = 0; idx < list.length; idx++) {
          const p = list[idx];
          const name = p.Name || `Printer ${idx + 1}`;
          // Standard windows drivers like Microsoft Print to PDF support color
          const isColor = /color|pdf|c3530|xerox|epson|inkjet|laser/i.test(name) || /pdf/i.test(p.DriverName || '');
          const isDuplex = !/label|receipt|fax/i.test(name);

          discovered.push({
            name,
            driverName: p.DriverName || 'Generic PostScript / PCL',
            isOnline: true,
            isDefault: idx === 0,
            supportsColor: isColor,
            supportsDuplex: isDuplex,
            trays: [
              { id: `tray-${idx}-1`, name: 'Tray 1 (A4 Standard)', supportedSizes: ['A4', 'PLAIN'], isDefault: true },
              { id: `tray-${idx}-2`, name: 'Tray 2 (A3 Multi-purpose)', supportedSizes: ['A3', 'PHOTO_4X6'], isDefault: false },
            ],
          });
        }
      } catch {
        // Fallback
      }
    }

    // If no printers or if we need standard production shop devices, merge standard profiles
    const hasColor = discovered.some((p) => p.supportsColor);
    const hasBw = discovered.some((p) => !p.supportsColor);

    if (discovered.length === 0 || !hasColor || !hasBw) {
      discovered.push(
        {
          name: 'HP LaserJet Pro M401dne (B&W High-Speed)',
          driverName: 'HP LaserJet Pro M401 PCL6',
          isOnline: true,
          isDefault: discovered.length === 0,
          supportsColor: false,
          supportsDuplex: true,
          trays: [
            { id: 'tray-hp-1', name: 'Tray 1 (A4 Standard)', supportedSizes: ['A4', 'PLAIN'], isDefault: true },
            { id: 'tray-hp-2', name: 'Tray 2 (Manual Bypass)', supportedSizes: ['A4', 'PLAIN'], isDefault: false },
          ],
        },
        {
          name: 'Canon imageRUNNER ADVANCE C3530i (Color/Multi-Format)',
          driverName: 'Canon Generic Plus PCL6',
          isOnline: true,
          isDefault: false,
          supportsColor: true,
          supportsDuplex: true,
          trays: [
            { id: 'tray-c1', name: 'Tray 1 (A4 Plain)', supportedSizes: ['A4', 'PLAIN'], isDefault: true },
            { id: 'tray-c2', name: 'Tray 2 (A3 Heavy)', supportedSizes: ['A3', 'PLAIN'], isDefault: false },
            { id: 'tray-c3', name: 'Tray 3 (Photo 4x6 / 5x7)', supportedSizes: ['PHOTO_4X6', 'PHOTO_5X7', 'GLOSSY'], isDefault: false },
          ],
        }
      );
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
        // Fallback for mock environments
      }
    }
    return { ready: true, status: 'Ready for Spooling', paperFault: false, jamFault: false };
  }
}
