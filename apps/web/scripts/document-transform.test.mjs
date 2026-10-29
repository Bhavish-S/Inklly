import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, degrees } from 'pdf-lib';
import { hasDocumentEdits, transformAndConfirmUpload, transformPdfBytes } from '../src/document-transform.js';

test('PDF transform applies crop and rotation to every page without rasterizing content', async () => {
  const source = await PDFDocument.create();
  const first = source.addPage([200, 100]);
  first.drawText('vector page one', { x: 20, y: 40 });
  const second = source.addPage([400, 200]);
  second.drawText('vector page two', { x: 40, y: 80 });
  second.setCropBox(40, 20, 320, 160);
  second.setRotation(degrees(180));
  const originalBytes = await source.save();

  const outputBytes = await transformPdfBytes(originalBytes, {
    rotation: 90,
    filter: 'natural',
    brightness: 100,
    contrast: 100,
    cropBox: { x: 10, y: 20, width: 70, height: 60 },
  });
  const output = await PDFDocument.load(outputBytes);
  assert.equal(output.getPageCount(), 2);
  for (const [index, page] of output.getPages().entries()) {
    assert.equal(page.getRotation().angle, index === 0 ? 90 : 270);
    const crop = page.getCropBox();
    assert.equal(Math.round(crop.width), index === 0 ? 120 : 192);
    assert.equal(Math.round(crop.height), index === 0 ? 70 : 112);
    assert.ok(page.node.Contents(), 'original PDF page content remains present as vector content');
  }
});

test('PDF transform composes with existing page rotation and crop box', async () => {
  const source = await PDFDocument.create();
  const page = source.addPage([300, 200]);
  page.setCropBox(30, 20, 240, 160);
  page.setRotation(degrees(90));
  const outputBytes = await transformPdfBytes(await source.save(), {
    rotation: 270,
    filter: 'natural',
    brightness: 100,
    contrast: 100,
    cropBox: { x: 25, y: 25, width: 50, height: 50 },
  });
  const outputPage = (await PDFDocument.load(outputBytes)).getPage(0);
  assert.equal(outputPage.getRotation().angle, 0);
  const crop = outputPage.getCropBox();
  assert.deepEqual([Math.round(crop.x), Math.round(crop.y), Math.round(crop.width), Math.round(crop.height)], [90, 60, 120, 80]);
});

test('crop selected on a rotated PDF preview maps back to the matching source rectangle', async () => {
  const source = await PDFDocument.create();
  const page = source.addPage([300, 200]);
  page.setCropBox(30, 20, 240, 160);
  page.setRotation(degrees(90));
  const outputBytes = await transformPdfBytes(await source.save(), {
    rotation: 0,
    filter: 'natural',
    brightness: 100,
    contrast: 100,
    cropBox: { x: 10, y: 20, width: 30, height: 40 },
  });
  const outputPage = (await PDFDocument.load(outputBytes)).getPage(0);
  assert.equal(outputPage.getRotation().angle, 90);
  const crop = outputPage.getCropBox();
  assert.deepEqual([Math.round(crop.x), Math.round(crop.y), Math.round(crop.width), Math.round(crop.height)], [78, 36, 96, 48]);
  // After the 90 degree page rotation, the output crop is 48x96 points, which is
  // exactly 30% of the rotated 160pt width by 40% of the rotated 240pt height.
  assert.deepEqual([Math.round(crop.height), Math.round(crop.width)], [48, 96]);
});

test('edit detection distinguishes untouched defaults and altered print output', () => {
  const defaults = { rotation: 0, filter: 'natural', brightness: 100, contrast: 100, cropBox: { x: 0, y: 0, width: 100, height: 100 } };
  assert.equal(hasDocumentEdits(defaults), false);
  assert.equal(hasDocumentEdits({ ...defaults, rotation: 180 }), true);
  assert.equal(hasDocumentEdits({ ...defaults, cropBox: { x: 5, y: 5, width: 90, height: 90 } }), true);
});

test('invalid rotation and crop inputs are rejected before modifying a PDF', async () => {
  const source = await PDFDocument.create();
  source.addPage([200, 100]);
  const bytes = await source.save();
  await assert.rejects(transformPdfBytes(bytes, {
    rotation: 45, filter: 'natural', brightness: 100, contrast: 100,
    cropBox: { x: 0, y: 0, width: 100, height: 100 },
  }), /90 degree steps/);
  await assert.rejects(transformPdfBytes(bytes, {
    rotation: 0, filter: 'natural', brightness: 100, contrast: 100,
    cropBox: { x: 80, y: 0, width: 30, height: 100 },
  }), /within the document/);
});

test('failed private upload leaves the original file bytes untouched and returns no replacement', async () => {
  const source = await PDFDocument.create();
  const page = source.addPage([300, 200]);
  page.drawText('keep original until upload confirmation', { x: 20, y: 40 });
  const originalBytes = await source.save();
  const originalFile = new File([originalBytes], 'customer.pdf', { type: 'application/pdf' });
  const edits = {
    rotation: 90,
    filter: 'natural',
    brightness: 100,
    contrast: 100,
    cropBox: { x: 10, y: 10, width: 80, height: 80 },
  };
  await assert.rejects(transformAndConfirmUpload(originalFile, edits, async (transformed) => {
    const checkedPdf = await PDFDocument.load(await transformed.arrayBuffer());
    assert.equal(checkedPdf.getPage(0).getRotation().angle, 90);
    throw new Error('private storage unavailable');
  }), /private storage unavailable/);
  assert.deepEqual(new Uint8Array(await originalFile.arrayBuffer()), originalBytes);
  const originalAgain = await PDFDocument.load(await originalFile.arrayBuffer());
  assert.equal(originalAgain.getPage(0).getRotation().angle, 0);
});
