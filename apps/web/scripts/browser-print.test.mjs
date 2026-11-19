import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';

// The module is TypeScript; load it through a tiny on-the-fly transpile.
import { transformSync } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Write next to the app's node_modules so 'pdf-lib' resolves.
const dir = fileURLToPath(new URL('../node_modules/.cache/inklly-tests/', import.meta.url));
mkdirSync(dir, { recursive: true });
const out = join(dir, 'browser-print.mjs');
writeFileSync(out, transformSync(readFileSync(new URL('../src/browser-print.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'esm' }).code);
const { parsePageRange, planBrowserPrintJobs, buildJobPdf } = await import(out);

const pdfBlob = async (pages) => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([595, 842]);
  return new Blob([await doc.save()], { type: 'application/pdf' });
};

test('parses page ranges', () => {
  assert.deepEqual(parsePageRange('1-3, 5', 10), [1, 2, 3, 5]);
  assert.deepEqual(parsePageRange('All', 3), [1, 2, 3]);
  assert.deepEqual(parsePageRange('8-20', 10), [8, 9, 10]);
  assert.throws(() => parsePageRange('a-b', 4));
});

test('splits B&W and colour into separate jobs, B&W first', async () => {
  const blob = await pdfBlob(2);
  const jobs = planBrowserPrintJobs([
    { fileName: 'cover.pdf', pageCount: 2, blob, options: { colorMode: 'color', copies: 1 } },
    { fileName: 'notes.pdf', pageCount: 2, blob, options: { colorMode: 'bw', copies: 2, duplexMode: 'duplex_auto' } },
  ]);
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].colour, false);
  assert.equal(jobs[0].duplex, true);
  assert.equal(jobs[0].sheets, 4);
  assert.match(jobs[1].label, /^Colour/);
});

test('builds a job PDF with the chosen pages and collated copies', async () => {
  const blob = await pdfBlob(5);
  const [job] = planBrowserPrintJobs([{ fileName: 'a.pdf', pageCount: 5, blob, options: { colorMode: 'bw', copies: 3, pageRange: '2-3' } }]);
  const bytes = await buildJobPdf(job);
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 6);
});
