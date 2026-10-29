export type ColorMode = 'bw' | 'color';
export type DuplexMode = 'simplex' | 'duplex_auto' | 'duplex_manual';
export type PaperSize = 'A4' | 'A3' | 'PHOTO_4X6' | 'PHOTO_5X7' | 'GLOSSY' | 'PLAIN';
export type Orientation = 'auto' | 'portrait' | 'landscape';
export type FitMode = 'fit' | 'actual';

export interface PrintOptions {
  colorMode: ColorMode | 'mixed';
  /** Required when colorMode is mixed; 1-based page range charged at the color rate. */
  colorPages?: string;
  duplexMode: DuplexMode;
  paperSize: PaperSize;
  orientation: Orientation;
  pageRange?: string; // e.g. "1-5, 8, 11-14" or undefined for all
  copies: number;
  fitMode: FitMode;
  pagesPerSheet: 1 | 2 | 4 | 6 | 9;
  collation: boolean;
}

export interface PaperTray {
  id: string;
  name: string; // e.g. "Tray 1 (A4)", "Tray 2 (A3)", "Bypass Tray"
  supportedSizes: PaperSize[];
  isDefault: boolean;
}

export interface PrinterDevice {
  id: string;
  shopId: string;
  /** Paired desktop agent that last reported this queue, when connected. */
  agentId?: string;
  name: string;
  systemDriverName: string;
  isOnline: boolean;
  isDefault: boolean;
  supportsColor: boolean;
  supportsDuplex: boolean;
  trays: PaperTray[];
  lastHeartbeat: string;
}
