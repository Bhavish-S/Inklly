export interface DocumentEdits {
  rotation: number;
  filter: 'natural' | 'bw_doc' | 'enhanced' | 'grayscale';
  brightness: number;
  contrast: number;
  cropBox: { x: number; y: number; width: number; height: number };
}

export function hasDocumentEdits(edits: DocumentEdits): boolean;
export function mapDisplayCropToPage(crop: DocumentEdits['cropBox'], rotation: number): DocumentEdits['cropBox'];
export function transformPdfBytes(inputBytes: Uint8Array, edits: DocumentEdits): Promise<Uint8Array>;
export function transformDocumentFile(file: File, edits: DocumentEdits): Promise<File>;
export function transformAndConfirmUpload<T extends { storageKey: string; pageCount: number; fileSizeBytes: number }>(
  file: File,
  edits: DocumentEdits,
  uploadTransformedFile: (file: File) => Promise<T>,
): Promise<{ file: File; upload: T }>;
