const MAX_PDF_PAGES = 50_000;

export type DetectedDocument = { mimeType: 'application/pdf' | 'image/jpeg' | 'image/png'; pageCount: number };

function detectMimeType(data: Buffer): DetectedDocument['mimeType'] | null {
  if (data.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}

/** Derive billable document pages from stored bytes; never trust browser metadata. */
export async function inspectDocument(data: Buffer): Promise<DetectedDocument> {
  const mimeType = detectMimeType(data);
  if (!mimeType) throw new Error('Upload a valid PDF, JPEG, or PNG file.');
  if (mimeType !== 'application/pdf') return { mimeType, pageCount: 1 };

  try {
    // Keep the backend CommonJS while loading PDF.js's ESM Node build.
    const loadModule = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;
    const pdfjs = await loadModule('pdfjs-dist/legacy/build/pdf.mjs');
    const task = pdfjs.getDocument({
      data: new Uint8Array(data),
      isEvalSupported: false,
      stopAtErrors: true,
      useSystemFonts: false,
    });
    const document = await task.promise;
    const pageCount = document.numPages;
    await task.destroy();
    if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > MAX_PDF_PAGES) {
      throw new Error(`PDF page count must be between 1 and ${MAX_PDF_PAGES}.`);
    }
    return { mimeType, pageCount };
  } catch (error: any) {
    if (error?.message?.startsWith('PDF page count')) throw error;
    throw new Error('The PDF is invalid or could not be safely inspected.');
  }
}
