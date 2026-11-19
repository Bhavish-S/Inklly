import React, { useRef } from 'react';

export interface CropRect { x: number; y: number; width: number; height: number }

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const MIN_SIZE = 5; // percent of the page

export function clampCropRect(rect: CropRect): CropRect {
  const width = Math.min(100, Math.max(MIN_SIZE, rect.width));
  const height = Math.min(100, Math.max(MIN_SIZE, rect.height));
  const x = Math.min(100 - width, Math.max(0, rect.x));
  const y = Math.min(100 - height, Math.max(0, rect.y));
  const round = (value: number) => Math.round(value * 100) / 100;
  return { x: round(x), y: round(y), width: round(width), height: round(height) };
}

/** Applies a pointer drag (in percent of the frame) to one handle of the crop rectangle. */
export function dragCropRect(start: CropRect, handle: Handle, dxPercent: number, dyPercent: number): CropRect {
  if (handle === 'move') return clampCropRect({ ...start, x: start.x + dxPercent, y: start.y + dyPercent });
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  if (handle.includes('w')) left = Math.min(right - MIN_SIZE, Math.max(0, left + dxPercent));
  if (handle.includes('e')) right = Math.max(left + MIN_SIZE, Math.min(100, right + dxPercent));
  if (handle.includes('n')) top = Math.min(bottom - MIN_SIZE, Math.max(0, top + dyPercent));
  if (handle.includes('s')) bottom = Math.max(top + MIN_SIZE, Math.min(100, bottom + dyPercent));
  return clampCropRect({ x: left, y: top, width: right - left, height: bottom - top });
}

/**
 * Finds the printed content on a rendered page: the bounding box of pixels
 * that are not near-white, plus a small margin. Returns null for a blank page.
 */
export function detectContentBounds(canvas: HTMLCanvasElement, marginPercent = 1.5): CropRect | null {
  const context = canvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings);
  if (!context || !canvas.width || !canvas.height) return null;
  // Sample on a reduced grid; enough to find margins on any phone.
  const step = Math.max(1, Math.floor(Math.max(canvas.width, canvas.height) / 600));
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];
      const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (alpha > 16 && luminance < 235) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const toPercentX = (value: number) => (value / width) * 100;
  const toPercentY = (value: number) => (value / height) * 100;
  const left = Math.max(0, toPercentX(minX) - marginPercent);
  const top = Math.max(0, toPercentY(minY) - marginPercent);
  const right = Math.min(100, toPercentX(maxX + step) + marginPercent);
  const bottom = Math.min(100, toPercentY(maxY + step) + marginPercent);
  return clampCropRect({ x: left, y: top, width: right - left, height: bottom - top });
}

interface CropFrameProps {
  crop: CropRect;
  onChange: (crop: CropRect) => void;
  disabled?: boolean;
  children: React.ReactNode;
  frameRef?: React.Ref<HTMLDivElement>;
}

const HANDLES: Array<{ handle: Handle; style: React.CSSProperties; cursor: string }> = [
  { handle: 'nw', style: { left: 0, top: 0 }, cursor: 'nwse-resize' },
  { handle: 'n', style: { left: '50%', top: 0 }, cursor: 'ns-resize' },
  { handle: 'ne', style: { left: '100%', top: 0 }, cursor: 'nesw-resize' },
  { handle: 'e', style: { left: '100%', top: '50%' }, cursor: 'ew-resize' },
  { handle: 'se', style: { left: '100%', top: '100%' }, cursor: 'nwse-resize' },
  { handle: 's', style: { left: '50%', top: '100%' }, cursor: 'ns-resize' },
  { handle: 'sw', style: { left: 0, top: '100%' }, cursor: 'nesw-resize' },
  { handle: 'w', style: { left: 0, top: '50%' }, cursor: 'ew-resize' },
];

/** Wraps a rendered page and lets the user drag a crop rectangle over it (mouse or touch). */
export const CropFrame: React.FC<CropFrameProps> = ({ crop, onChange, disabled, children, frameRef }) => {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ handle: Handle; startX: number; startY: number; start: CropRect; width: number; height: number } | null>(null);

  const beginDrag = (handle: Handle) => (event: React.PointerEvent) => {
    if (disabled || !boxRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = boxRef.current.getBoundingClientRect();
    dragRef.current = { handle, startX: event.clientX, startY: event.clientY, start: crop, width: rect.width || 1, height: rect.height || 1 };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = ((event.clientX - drag.startX) / drag.width) * 100;
    const dy = ((event.clientY - drag.startY) / drag.height) * 100;
    onChange(dragCropRect(drag.start, drag.handle, dx, dy));
  };
  const endDrag = () => { dragRef.current = null; };

  return (
    <div
      ref={(node) => {
        boxRef.current = node;
        if (typeof frameRef === 'function') frameRef(node);
        else if (frameRef) (frameRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className="relative inline-block select-none"
      style={{ lineHeight: 0, touchAction: 'none' }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {children}
      {/* Shade everything outside the crop; clipped so the shadow stays on the page. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute"
          style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%`, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}
        />
      </div>
      <div
        role="group"
        aria-label="Crop area. Drag the box or its handles to choose what prints."
        onPointerDown={beginDrag('move')}
        className="absolute border-2 border-emerald-400"
        style={{
          left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%`,
          cursor: disabled ? 'default' : 'move',
        }}
      >
        {!disabled && HANDLES.map(({ handle, style, cursor }) => (
          <span
            key={handle}
            onPointerDown={beginDrag(handle)}
            className="absolute block w-5 h-5 -ml-2.5 -mt-2.5 rounded-sm bg-emerald-400 border-2 border-white shadow"
            style={{ ...style, cursor }}
          />
        ))}
      </div>
    </div>
  );
};
