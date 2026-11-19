import React, { useState } from 'react';

interface QrPosterButtonProps {
  shopName: string;
  shopUrl: string;
  rates?: Array<{ label: string; paise: number | null | undefined }>;
  className?: string;
}

const hexToRgb = (hex: string) => {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return { r: ((value >> 16) & 255) / 255, g: ((value >> 8) & 255) / 255, b: (value & 255) / 255 };
};

/** Builds an A4 counter poster PDF: big QR, shop name, three steps and prices. */
export async function buildQrPosterPdf(shopName: string, shopUrl: string, rates: QrPosterButtonProps['rates'] = []): Promise<Uint8Array> {
  const [{ PDFDocument, StandardFonts, rgb }, QRCode] = await Promise.all([import('pdf-lib'), import('qrcode')]);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${shopName} — scan to print`);
  const page = pdf.addPage([595.28, 841.89]); // A4 portrait in points
  const { width, height } = page.getSize();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const brand = hexToRgb('#4F46E5');
  const ink = rgb(0.09, 0.12, 0.19);
  const muted = rgb(0.38, 0.42, 0.5);
  // Standard PDF fonts cannot draw the rupee sign; "Rs" reads naturally on a poster.
  const safe = (text: string) => text.replace(/₹/g, 'Rs ').replace(/[^\x20-\x7E]/g, '');

  const centered = (text: string, y: number, size: number, font = regular, color = ink) => {
    const clean = safe(text);
    page.drawText(clean, { x: (width - font.widthOfTextAtSize(clean, size)) / 2, y, size, font, color });
  };
  const fitSize = (text: string, font: typeof bold, max: number, maxWidth: number) => {
    let size = max;
    while (size > 14 && font.widthOfTextAtSize(safe(text), size) > maxWidth) size -= 1;
    return size;
  };

  page.drawRectangle({ x: 0, y: height - 150, width, height: 150, color: rgb(brand.r, brand.g, brand.b) });
  centered('SCAN TO PRINT', height - 70, 34, bold, rgb(1, 1, 1));
  centered('No app, no pen drive, no WhatsApp forwards', height - 104, 14, regular, rgb(0.88, 0.9, 1));

  centered(shopName, height - 205, fitSize(shopName, bold, 30, width - 80), bold);

  const qrPng = await QRCode.toDataURL(shopUrl, { errorCorrectionLevel: 'H', margin: 1, width: 1024, color: { dark: '#111827', light: '#FFFFFF' } });
  const qrImage = await pdf.embedPng(qrPng);
  const qrSize = 300;
  const qrY = height - 235 - qrSize;
  page.drawRectangle({ x: (width - qrSize) / 2 - 14, y: qrY - 14, width: qrSize + 28, height: qrSize + 28, borderColor: rgb(brand.r, brand.g, brand.b), borderWidth: 3, color: rgb(1, 1, 1) });
  page.drawImage(qrImage, { x: (width - qrSize) / 2, y: qrY, width: qrSize, height: qrSize });

  const steps = ['Scan with your phone camera', 'Upload & choose B&W / colour', 'Collect with your token'];
  const stepTop = qrY - 70;
  const colWidth = (width - 80) / 3;
  steps.forEach((step, index) => {
    const cx = 40 + colWidth * index + colWidth / 2;
    page.drawCircle({ x: cx, y: stepTop, size: 16, color: rgb(brand.r, brand.g, brand.b) });
    const num = String(index + 1);
    page.drawText(num, { x: cx - bold.widthOfTextAtSize(num, 16) / 2, y: stepTop - 6, size: 16, font: bold, color: rgb(1, 1, 1) });
    const words = safe(step).split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (regular.widthOfTextAtSize(next, 12) > colWidth - 16) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    lines.forEach((text, lineIndex) => {
      page.drawText(text, { x: cx - regular.widthOfTextAtSize(text, 12) / 2, y: stepTop - 36 - lineIndex * 15, size: 12, font: regular, color: ink });
    });
  });

  const priced = (rates || []).filter((rate) => typeof rate.paise === 'number');
  if (priced.length) {
    const text = priced.map((rate) => `${rate.label}: Rs ${((rate.paise as number) / 100).toFixed((rate.paise as number) % 100 ? 2 : 0)} per page`).join('     |     ');
    centered(text, stepTop - 100, fitSize(text, bold, 15, width - 60), bold, ink);
  }

  centered('Or open this link:', 78, 11, regular, muted);
  centered(shopUrl.replace(/^https?:\/\//, ''), 60, fitSize(shopUrl, bold, 13, width - 60), bold, rgb(brand.r, brand.g, brand.b));
  centered('Powered by Inklly', 28, 9, regular, muted);
  return pdf.save();
}

/** Downloads the counter poster. */
export const QrPosterButton: React.FC<QrPosterButtonProps> = ({ shopName, shopUrl, rates, className }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const download = async () => {
    setBusy(true);
    setError('');
    try {
      const bytes = await buildQrPosterPdf(shopName, shopUrl, rates);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${shopName.replace(/[^\w-]+/g, '-').toLowerCase() || 'shop'}-qr-poster.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the poster.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={() => void download()} disabled={busy} className={className || 'min-h-[44px] px-4 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-60'}>
        {busy ? 'Preparing poster…' : 'Download A4 counter poster (PDF)'}
      </button>
      {error && <span role="alert" className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
};
