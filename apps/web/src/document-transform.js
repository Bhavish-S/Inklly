const FULL_FRAME = Object.freeze({ x: 0, y: 0, width: 100, height: 100 });

function clampCrop(crop) {
  const values = [crop?.x, crop?.y, crop?.width, crop?.height].map(Number);
  if (values.some((value) => !Number.isFinite(value)) || values.some((value) => value < 0 || value > 100)) {
    throw new Error('Choose a valid crop area before saving.');
  }
  const [x, y, width, height] = values;
  if (width <= 0 || height <= 0 || x + width > 100 || y + height > 100) {
    throw new Error('The crop area must remain within the document.');
  }
  return { x, y, width, height };
}

function normalizeRotation(rotation) {
  const value = Number(rotation);
  if (!Number.isInteger(value) || value % 90 !== 0) throw new Error('Rotation must use 90 degree steps.');
  return ((value % 360) + 360) % 360;
}

export function mapDisplayCropToPage(crop, rotation) {
  const angle = normalizeRotation(rotation);
  if (angle === 90) return { x: crop.y, y: 100 - crop.x - crop.width, width: crop.height, height: crop.width };
  if (angle === 180) return { x: 100 - crop.x - crop.width, y: 100 - crop.y - crop.height, width: crop.width, height: crop.height };
  if (angle === 270) return { x: 100 - crop.y - crop.height, y: crop.x, width: crop.height, height: crop.width };
  return crop;
}

export function hasDocumentEdits(edits) {
  const crop = clampCrop(edits.cropBox || FULL_FRAME);
  return normalizeRotation(edits.rotation || 0) !== 0 ||
    crop.x !== 0 || crop.y !== 0 || crop.width !== 100 || crop.height !== 100 ||
    (edits.filter || 'natural') !== 'natural' || Number(edits.brightness ?? 100) !== 100 || Number(edits.contrast ?? 100) !== 100;
}

/** Applies rotation and a normalized crop to every PDF page while preserving vector content. */
export async function transformPdfBytes(inputBytes, edits) {
  const { PDFDocument, degrees } = await import('pdf-lib');
  const rotation = normalizeRotation(edits.rotation || 0);
  const crop = clampCrop(edits.cropBox || FULL_FRAME);
  if (rotation === 0 && crop.x === 0 && crop.y === 0 && crop.width === 100 && crop.height === 100) {
    return inputBytes;
  }

  const document = await PDFDocument.load(inputBytes);
  for (const page of document.getPages()) {
    const current = page.getCropBox();
    const nextRotation = ((page.getRotation().angle + rotation) % 360 + 360) % 360;
    const pageCrop = mapDisplayCropToPage(crop, nextRotation);
    const x = current.x + current.width * pageCrop.x / 100;
    const y = current.y + current.height * (100 - pageCrop.y - pageCrop.height) / 100;
    page.setCropBox(x, y, current.width * pageCrop.width / 100, current.height * pageCrop.height / 100);
    page.setRotation(degrees(nextRotation));
  }
  return document.save({ useObjectStreams: true });
}

function toBlob(canvas, type) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The edited image could not be encoded.')), type);
  });
}

/** Applies saved image edits to actual pixels; only PNG and JPEG uploads are supported. */
export async function transformImageFile(file, edits) {
  const crop = clampCrop(edits.cropBox || FULL_FRAME);
  const rotation = normalizeRotation(edits.rotation || 0);
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000) {
      throw new Error('This image is too large to edit safely in your browser.');
    }
    const swapsDimensions = rotation === 90 || rotation === 270;
    const oriented = document.createElement('canvas');
    oriented.width = swapsDimensions ? bitmap.height : bitmap.width;
    oriented.height = swapsDimensions ? bitmap.width : bitmap.height;
    const orientedContext = oriented.getContext('2d');
    if (!orientedContext) throw new Error('Your browser could not prepare the edited image.');
    orientedContext.translate(oriented.width / 2, oriented.height / 2);
    orientedContext.rotate(rotation * Math.PI / 180);
    orientedContext.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

    const sx = oriented.width * crop.x / 100;
    const sy = oriented.height * crop.y / 100;
    const sw = oriented.width * crop.width / 100;
    const sh = oriented.height * crop.height / 100;
    const output = document.createElement('canvas');
    output.width = Math.max(1, Math.round(sw));
    output.height = Math.max(1, Math.round(sh));
    const context = output.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare the edited image.');
    const brightness = Number(edits.brightness ?? 100);
    const contrast = Number(edits.contrast ?? 100);
    if (!Number.isFinite(brightness) || brightness < 50 || brightness > 150 ||
        !Number.isFinite(contrast) || contrast < 50 || contrast > 150) {
      throw new Error('Brightness and contrast must be between 50 and 150 percent.');
    }
    const filters = [`brightness(${brightness}%)`, `contrast(${contrast}%)`];
    if (edits.filter === 'bw_doc') filters.push('grayscale(100%)', 'contrast(220%)', 'brightness(110%)');
    else if (edits.filter === 'enhanced') filters.push('contrast(130%)', 'brightness(105%)');
    else if (edits.filter === 'grayscale') filters.push('grayscale(100%)');
    else if (edits.filter && edits.filter !== 'natural') throw new Error('Choose a supported image filter.');
    context.filter = filters.join(' ');
    context.drawImage(oriented, sx, sy, sw, sh, 0, 0, output.width, output.height);
    const outputType = file.type === 'image/png' || /\.png$/i.test(file.name) ? 'image/png' : 'image/jpeg';
    const blob = await toBlob(output, outputType);
    const outputName = outputType === 'image/png'
      ? file.name.replace(/\.(jpe?g)$/i, '.png')
      : file.name.replace(/\.png$/i, '.jpg');
    return new File([blob], outputName, { type: outputType, lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

/** Dispatches supported pixel edits to images and lossless page-box edits to PDFs. */
export async function transformDocumentFile(file, edits) {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    if ((edits.filter || 'natural') !== 'natural' || Number(edits.brightness ?? 100) !== 100 || Number(edits.contrast ?? 100) !== 100) {
      throw new Error('Filters, brightness, and contrast are available for images only.');
    }
    const bytes = await transformPdfBytes(new Uint8Array(await file.arrayBuffer()), edits);
    return new File([bytes], file.name, { type: 'application/pdf', lastModified: Date.now() });
  }
  if (file.type === 'image/png' || file.type === 'image/jpeg' || /\.(png|jpe?g)$/i.test(file.name)) {
    return transformImageFile(file, edits);
  }
  throw new Error('Editing is supported for PDF, PNG, and JPEG files.');
}

/** Resolve only after the transformed file has verified private-storage metadata. */
export async function transformAndConfirmUpload(file, edits, uploadTransformedFile) {
  const transformedFile = await transformDocumentFile(file, edits);
  const upload = await uploadTransformedFile(transformedFile);
  if (typeof upload?.storageKey !== 'string' || !upload.storageKey || !Number.isInteger(upload.pageCount) || upload.pageCount < 1 ||
      !Number.isSafeInteger(upload.fileSizeBytes) || upload.fileSizeBytes < 1) {
    throw new Error('The server did not confirm inspection and private storage for the edited file.');
  }
  return { file: transformedFile, upload };
}
