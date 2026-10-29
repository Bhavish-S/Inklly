import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure standard worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();
}

interface PdfPageRendererProps {
  fileUrl: string;
  currentPage?: number;
  onPageCountDetected?: (pages: number) => void;
  rotation?: number;
  cropBox?: { x: number; y: number; width: number; height: number };
}

export const PdfPageRenderer: React.FC<PdfPageRendererProps> = ({
  fileUrl,
  currentPage = 1,
  onPageCountDetected,
  rotation = 0,
  cropBox,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const renderPdf = async () => {
      try {
        setLoading(true);
        setError(null);
        const loadingTask = pdfjsLib.getDocument({ url: fileUrl });
        const pdf = await loadingTask.promise;

        if (isCancelled) return;

        if (onPageCountDetected) {
          onPageCountDetected(pdf.numPages);
        }

        const pageNum = Math.min(Math.max(1, currentPage), pdf.numPages);
        const page = await pdf.getPage(pageNum);

        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const effectiveRotation = ((page.rotate + rotation) % 360 + 360) % 360;
        const viewport = page.getViewport({ scale: 1.2, rotation: effectiveRotation });
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        };

        await page.render(renderContext).promise;
        if (cropBox) {
          const x = canvas.width * cropBox.x / 100;
          const y = canvas.height * cropBox.y / 100;
          const width = canvas.width * cropBox.width / 100;
          const height = canvas.height * cropBox.height / 100;
          context.fillStyle = 'rgba(0, 0, 0, 0.45)';
          context.fillRect(0, 0, canvas.width, y);
          context.fillRect(0, y + height, canvas.width, canvas.height - y - height);
          context.fillRect(0, y, x, height);
          context.fillRect(x + width, y, canvas.width - x - width, height);
          context.strokeStyle = '#10B981';
          context.lineWidth = Math.max(2, viewport.scale * 2);
          context.strokeRect(x, y, width, height);
        }
        if (!isCancelled) {
          setLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn('PDF canvas render fallback to iframe:', err);
          setError(err.message || 'Failed to render PDF canvas');
          setLoading(false);
        }
      }
    };

    renderPdf();

    return () => {
      isCancelled = true;
    };
  }, [fileUrl, currentPage, rotation, onPageCountDetected, cropBox]);

  if (error) {
    return (
      <iframe
        src={`${fileUrl}#page=${currentPage}&toolbar=0&navpanes=0`}
        className="w-full h-full rounded-xl border border-slate-200"
        title="PDF Preview"
      />
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-auto p-2">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs text-white text-xs font-bold rounded-xl z-10">
          Loading Document Page...
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="max-h-full max-w-full rounded shadow-md object-contain bg-white"
      />
    </div>
  );
};
