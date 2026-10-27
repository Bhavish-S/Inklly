import React, { useState } from 'react';
import { PdfPageRenderer } from './PdfPageRenderer';
import { FileTextIcon, CropIcon, RotateCwIcon } from './icons';

interface DocumentViewerProps {
  fileName: string;
  fileUrl: string;
  pageCount: number;
  rotation?: number;
  onPageCountDetected?: (pages: number) => void;
  onOpenEditor?: () => void;
  onRotate?: () => void;
  options: {
    colorMode: 'bw' | 'color';
    duplexMode: 'simplex' | 'duplex_auto';
    paperSize: string;
    orientation: string;
  };
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  fileName,
  fileUrl,
  pageCount,
  rotation = 0,
  onPageCountDetected,
  onOpenEditor,
  onRotate,
  options,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const isPdf = fileName.toLowerCase().endsWith('.pdf') || fileUrl.includes('application/pdf');
  const isImage = /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(fileName);

  const totalPages = Math.max(1, pageCount);

  return (
    <div className="relative bg-slate-950 rounded-2xl overflow-hidden min-h-[340px] flex flex-col items-center justify-between border border-slate-800 shadow-inner group">
      {/* Top Bar: File Details & Edit Shortcut */}
      <div className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800 backdrop-blur-sm z-20">
        <div className="flex items-center gap-2 truncate max-w-[50%]">
          <FileTextIcon size={14} className="text-[#A9B6FF] shrink-0" />
          <span className="text-xs font-bold text-slate-200 truncate">{fileName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {onRotate && (
            <button
              type="button"
              onClick={onRotate}
              className="text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              title="Rotate document 90 degrees clockwise"
            >
              <RotateCwIcon size={12} />
              <span>Rotate 90°</span>
            </button>
          )}
          {onOpenEditor && (
            <button
              type="button"
              onClick={onOpenEditor}
              className="text-[11px] font-bold text-indigo-300 hover:text-white bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/30 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
            >
              <CropIcon size={12} />
              <span>Edit / Crop</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="flex-1 w-full flex items-center justify-center p-3 overflow-hidden relative">
        {isPdf ? (
          <div className="w-full h-full max-h-[300px] flex items-center justify-center">
            <PdfPageRenderer
              fileUrl={fileUrl}
              currentPage={currentPage}
              rotation={rotation}
              onPageCountDetected={onPageCountDetected}
            />
          </div>
        ) : isImage ? (
          <div className="w-full h-full max-h-[300px] flex items-center justify-center p-2">
            <img
              src={fileUrl}
              alt={fileName}
              style={{
                transform: `rotate(${rotation}deg)`,
              }}
              className="max-h-[280px] max-w-full rounded-lg shadow-md object-contain transition-transform"
            />
          </div>
        ) : (
          <div className="w-48 h-64 bg-white rounded-xl shadow-lg p-4 flex flex-col items-center justify-center text-center border border-slate-200">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <FileTextIcon size={28} />
            </div>
            <div className="text-xs font-bold text-slate-900 truncate w-full mb-1">{fileName}</div>
            <div className="text-[11px] text-slate-500 mb-2">{pageCount} page(s) ready to print</div>
            <div className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
              Verified Spool Format
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls: Page Stepper (if multi-page PDF) & Format Pills */}
      <div className="w-full flex flex-col items-center gap-2 p-2 bg-slate-900/90 border-t border-slate-800 backdrop-blur-sm z-20">
        {isPdf && totalPages > 1 && (
          <div className="flex items-center gap-2 text-xs text-slate-200">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              className="min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold cursor-pointer text-xs"
              title="Previous Page"
            >
              ◀ Prev
            </button>
            <span className="font-semibold text-xs text-indigo-200">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              className="min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold cursor-pointer text-xs"
              title="Next Page"
            >
              Next ▶
            </button>
          </div>
        )}

        {/* Live print configuration tags */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          <span className="bg-black/80 text-indigo-200 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-white/10">
            {options.colorMode === 'bw' ? 'Black & White' : 'Full Colour'}
          </span>
          <span className="bg-black/80 text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-white/10">
            {options.duplexMode === 'simplex' ? 'Single Sided' : 'Back-to-Back'}
          </span>
          <span className="bg-black/80 text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-white/10">
            {options.paperSize}
          </span>
          <span className="bg-black/80 text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-white/10">
            {options.orientation}
          </span>
        </div>
      </div>
    </div>
  );
};
