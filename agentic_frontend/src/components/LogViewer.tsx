import { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  logs: string[];
}

const MIN_HEIGHT = 60;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 220;

export default function LogViewer({ logs }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const bottomRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const startY = e.clientY;
    const startH = panelRef.current?.offsetHeight ?? DEFAULT_HEIGHT;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const newH = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startH - (ev.clientY - startY)));
      setHeight(newH);
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  return (
    <div
      ref={panelRef}
      className="bg-dark-900 border-t border-dark-600 flex flex-col"
      style={{ height: collapsed ? `${MIN_HEIGHT}px` : `${height}px`, minHeight: `${MIN_HEIGHT}px` }}
    >
      {/* Drag handle + header */}
      <div
        onMouseDown={handleMouseDown}
        className="flex-shrink-0 h-2 cursor-ns-resize hover:bg-blue-500/30 bg-dark-700 transition-colors relative group"
      >
        <div className="absolute inset-x-0 top-0 h-0.5 bg-dark-500 group-hover:bg-blue-500 transition-colors" />
      </div>

      <div className="flex items-center justify-between px-4 py-1.5 bg-dark-800 border-b border-dark-600 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Logs {logs.length > 0 && <span className="text-gray-500">({logs.length} lines)</span>}
        </span>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-gray-500 hover:text-gray-200 text-xs px-2 py-0.5 rounded transition-colors"
        >
          {collapsed ? '▴ Expand' : '▾ Collapse'}
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed bg-black/40">
          {logs.length === 0 ? (
            <div className="text-gray-600 italic">No logs yet. Ingest a codebase or run a generation task to see output here.</div>
          ) : (
            logs.map((line, i) => <LogLine key={i} line={line} index={i} />)
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

function LogLine({ line, index }: { line: string; index: number }) {
  let colorClass = 'text-gray-400';
  if (/ERROR|error/.test(line)) colorClass = 'text-red-400';
  else if (/WARN|warning/.test(line)) colorClass = 'text-orange-400';
  else if (/DEBUG|debug/.test(line)) colorClass = 'text-yellow-400';
  else if (/Node:|Routing:|Reviewer:|Generating/i.test(line)) colorClass = 'text-blue-300';
  return (
    <div className={colorClass}>
      <span className="text-gray-600 mr-2 select-none inline-block w-8 text-right">{index + 1}</span>
      {line}
    </div>
  );
}
