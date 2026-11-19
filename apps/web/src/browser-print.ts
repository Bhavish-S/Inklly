/** 1-based pages from "1-3, 5" (or all pages when empty / "All"). */
export function parsePageRange(range: string | undefined, total: number): number[] {
  if (!range || !range.trim() || range.trim().toLowerCase() === 'all') return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>();
  for (const token of range.split(',').map((part) => part.trim()).filter(Boolean)) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(token);
    if (!match) throw new Error(`Invalid page range: ${token}`);
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    for (let page = Math.max(1, start); page <= Math.min(total, end); page++) pages.add(page);
  }
  if (!pages.size) throw new Error('The page range selects no pages.');
  return [...pages].sort((a, b) => a - b);
}

/**
 * Printing from the counter computer through the browser's print dialog.
 * Works with any printer the computer can already print to — no install.
 * Page ranges and copies are applied here; colour and sides are chosen in
 * the dialog, so B&W and colour files are printed as separate jobs.
 */

export interface BrowserPrintFile {
  fileName: string;
  mimeType?: string;
  pageCount: number;
  blob: Blob;
  options: {
    colorMode?: 'bw' | 'color' | 'mixed';
    duplexMode?: string;
    paperSize?: string;
    orientation?: string;
    copies?: number;
    pageRange?: string;
  };
}

export interface BrowserPrintJob {
  key: string;
  label: string;
  colour: boolean;
  duplex: boolean;
  paperSize: string;
  landscape: boolean;
  files: BrowserPrintFile[];
  sheets: number;
}

const A4 = { width: 595.28, height: 841.89 };
const A3 = { width: 841.89, height: 1190.55 };

/** Groups files so each print dialog needs one colour/sides/paper choice. */
export function planBrowserPrintJobs(files: BrowserPrintFile[]): BrowserPrintJob[] {
  const groups = new Map<string, BrowserPrintJob>();
  for (const file of files) {
    const colour = file.options.colorMode === 'color' || file.options.colorMode === 'mixed';
    const duplex = Boolean(file.options.duplexMode && file.options.duplexMode !== 'simplex');
    const paperSize = file.options.paperSize === 'A3' ? 'A3' : 'A4';
    const landscape = file.options.orientation === 'landscape';
    const key = `${colour}-${duplex}-${paperSize}-${landscape}`;
    const label = `${colour ? 'Colour' : 'Black & white'} · ${duplex ? 'both sides' : 'single side'} · ${paperSize}${landscape ? ' · landscape' : ''}`;
    const group = groups.get(key) || { key, label, colour, duplex, paperSize, landscape, files: [], sheets: 0 };
    group.files.push(file);
    let pages = file.pageCount;
    try { pages = parsePageRange(file.options.pageRange, file.pageCount).length; } catch { /* keep full count */ }
    group.sheets += pages * Math.max(1, file.options.copies || 1);
    groups.set(key, group);
  }
  // Black & white first: it is usually the bulk of the work.
  return [...groups.values()].sort((a, b) => Number(a.colour) - Number(b.colour));
}

/** Builds one PDF for a job: chosen pages, each file's copies collated. */
export async function buildJobPdf(job: BrowserPrintJob): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const output = await PDFDocument.create();
  const pageSize = job.paperSize === 'A3' ? A3 : A4;
  for (const file of job.files) {
    const copies = Math.max(1, Math.min(99, file.options.copies || 1));
    const bytes = new Uint8Array(await file.blob.arrayBuffer());
    const isPdf = (file.mimeType || '').includes('pdf') || file.fileName.toLowerCase().endsWith('.pdf') || String.fromCharCode(...bytes.slice(0, 4)) === '%PDF';
    if (isPdf) {
      const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
      let indices: number[];
      try { indices = parsePageRange(file.options.pageRange, source.getPageCount()).map((page) => page - 1); }
      catch { indices = source.getPageIndices(); }
      for (let copy = 0; copy < copies; copy++) {
        const pages = await output.copyPages(source, indices);
        pages.forEach((page) => output.addPage(page));
      }
    } else {
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      const image = isPng ? await output.embedPng(bytes) : await output.embedJpg(bytes);
      const width = job.landscape ? pageSize.height : pageSize.width;
      const height = job.landscape ? pageSize.width : pageSize.height;
      const margin = 18;
      const scale = Math.min((width - margin * 2) / image.width, (height - margin * 2) / image.height);
      for (let copy = 0; copy < copies; copy++) {
        const page = output.addPage([width, height]);
        page.drawImage(image, {
          x: (width - image.width * scale) / 2,
          y: (height - image.height * scale) / 2,
          width: image.width * scale,
          height: image.height * scale,
        });
      }
    }
  }
  return output.save();
}

/**
 * Opens the browser print dialog for a PDF. Uses a hidden frame so the page
 * stays put; if the browser blocks printing a PDF from a frame, the PDF opens
 * in a new tab where the print button is one click away.
 */
export function openPrintDialog(bytes: Uint8Array, title: string): Promise<void> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
    const frame = document.createElement('iframe');
    frame.title = title;
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '1px';
    frame.style.height = '1px';
    frame.style.border = '0';
    frame.style.opacity = '0';
    const cleanup = () => setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60_000);
    // Safari prints PDFs in frames as blank pages; open the PDF instead.
    if (/^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent)) {
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
      resolve();
      return;
    }
    frame.onload = () => {
      setTimeout(() => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          window.open(url, '_blank', 'noopener');
        }
        cleanup();
        resolve();
      }, 400);
    };
    frame.src = url;
    document.body.appendChild(frame);
  });
}
