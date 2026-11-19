/** Prints a receipt through the browser on any printer, sized for 80 mm thermal rolls (works on A4 too). */

export interface ReceiptLine {
  label: string;
  detail?: string;
  amountPaise: number;
}

export interface ReceiptData {
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  title: string;
  reference: string;
  token?: string;
  customer?: string | null;
  createdAt: string;
  lines: ReceiptLine[];
  totalPaise: number;
  paymentLabel: string;
  footer?: string;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));

export const formatInr = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function receiptHtml(data: ReceiptData): string {
  const when = new Date(data.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const rows = data.lines.map((line) => `
    <tr><td>${escapeHtml(line.label)}${line.detail ? `<div class="muted">${escapeHtml(line.detail)}</div>` : ''}</td>
    <td class="amt">${formatInr(line.amountPaise)}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(data.reference)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; color: #000; width: 72mm; margin: 0 auto; }
  h1 { font-size: 15px; margin: 0; text-align: center; }
  .center { text-align: center; }
  .muted { color: #444; font-size: 10px; }
  .token { font-size: 26px; font-weight: 800; text-align: center; letter-spacing: 2px; margin: 6px 0; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 0; vertical-align: top; }
  .amt { text-align: right; white-space: nowrap; padding-left: 8px; }
  .total td { font-weight: 800; font-size: 14px; border-top: 1px solid #000; padding-top: 5px; }
</style></head><body>
  <h1>${escapeHtml(data.shopName)}</h1>
  ${data.shopAddress ? `<div class="center muted">${escapeHtml(data.shopAddress)}</div>` : ''}
  ${data.shopPhone ? `<div class="center muted">${escapeHtml(data.shopPhone)}</div>` : ''}
  <hr>
  <div class="center"><strong>${escapeHtml(data.title)}</strong></div>
  ${data.token ? `<div class="token">${escapeHtml(data.token)}</div>` : ''}
  <div class="muted">Ref: ${escapeHtml(data.reference)}<br>${escapeHtml(when)}${data.customer ? `<br>Customer: ${escapeHtml(data.customer)}` : ''}</div>
  <hr>
  <table>${rows}<tr class="total"><td>Total</td><td class="amt">${formatInr(data.totalPaise)}</td></tr></table>
  <div class="muted" style="margin-top:4px">Paid by: ${escapeHtml(data.paymentLabel)}</div>
  <hr>
  <div class="center muted">${escapeHtml(data.footer || 'Thank you! Printed with Inklly')}</div>
</body></html>`;
}

/** Prints without leaving the page by using a hidden frame. */
export function printReceipt(data: ReceiptData): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) { frame.remove(); return; }
  doc.open();
  doc.write(receiptHtml(data));
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 2000);
  }, 250);
}
