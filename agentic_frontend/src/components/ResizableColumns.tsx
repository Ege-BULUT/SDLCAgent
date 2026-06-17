import { useState, useRef, useCallback, useEffect } from 'react';

interface Props {
  initialWidths: number[];
  minWidths?: number[];
  children: React.ReactNode[];
  className?: string;
}

export default function ResizableColumns({ initialWidths, minWidths, children, className = '' }: Props) {
  const [widths, setWidths] = useState(initialWidths);
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const draggingRef = useRef<{ index: number; startX: number; startWidths: number[] } | null>(null);

  const handleMouseDown = useCallback((index: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = { index, startX: e.clientX, startWidths: [...widths] };
  }, [widths]);

  useEffect(() => {
    const mins = minWidths || initialWidths.map(() => 120);
    const handleMouseMove = (e: MouseEvent) => {
      const d = draggingRef.current;
      if (!d) return;
      const delta = e.clientX - d.startX;
      const leftNew = Math.max(mins[d.index], d.startWidths[d.index] + delta);
      const rightNew = Math.max(mins[d.index + 1], d.startWidths[d.index + 1] - delta);
      // DOM-direct: no React re-render during drag
      const leftEl = colRefs.current[d.index];
      const rightEl = colRefs.current[d.index + 1];
      if (leftEl) leftEl.style.width = `${leftNew}px`;
      if (rightEl) rightEl.style.width = `${rightNew}px`;
    };
    const handleMouseUp = () => {
      const d = draggingRef.current;
      if (!d) return;
      const leftEl = colRefs.current[d.index];
      const rightEl = colRefs.current[d.index + 1];
      if (leftEl && rightEl) {
        const leftW = parseFloat(leftEl.style.width) || d.startWidths[d.index];
        const rightW = parseFloat(rightEl.style.width) || d.startWidths[d.index + 1];
        setWidths((prev) => {
          const next = [...prev];
          next[d.index] = leftW;
          next[d.index + 1] = rightW;
          return next;
        });
      }
      draggingRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minWidths, initialWidths]);

  return (
    <div className={`flex min-h-0 ${className}`}>
      {children.map((child, i) => (
        <div key={i} className="flex flex-row min-w-0">
          <div
            ref={(el) => { colRefs.current[i] = el; }}
            className="flex-1 min-w-0 overflow-hidden"
            style={{ width: widths[i], flex: '0 0 auto' }}
          >
            {child}
          </div>
          {i < children.length - 1 && (
            <div
              onMouseDown={handleMouseDown(i)}
              className="w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500 bg-dark-600/50 flex-shrink-0 transition-colors"
              title="Drag to resize"
            />
          )}
        </div>
      ))}
    </div>
  );
}
