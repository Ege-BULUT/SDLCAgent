import { useState, useMemo } from 'react';

interface Props {
  files: string[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
  applied: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  isFile: boolean;
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const p of paths) {
    const parts = p.replace(/\\/g, '/').split('/');
    let level = root;
    let acc = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      acc = acc ? acc + '/' + part : part;
      let existing = level.find((n) => n.name === part);
      if (!existing) {
        existing = { name: part, path: acc, children: [], isFile: isLast };
        level.push(existing);
      }
      level = existing.children;
    }
  }
  return root;
}

export default function FileExplorer({ files, selectedFile, onSelect, applied }: Props) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(files.length > 0 ? [tree[0]?.path].filter(Boolean) : []));

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderNode = (node: TreeNode, depth: number) => {
    const isExpanded = expanded.has(node.path);
    const isSelected = node.path === selectedFile;
    const paddingLeft = depth * 16;

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1 py-0.5 px-2 cursor-pointer text-xs transition-colors ${
            isSelected ? 'bg-blue-800/50 text-blue-200' : 'text-gray-400 hover:text-gray-200 hover:bg-dark-600'
          }`}
          style={{ paddingLeft: `${12 + paddingLeft}px` }}
          onClick={() => (node.isFile ? onSelect(node.path) : toggle(node.path))}
        >
          {node.isFile ? (
            <svg className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg
              className={`w-3.5 h-3.5 flex-shrink-0 text-yellow-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="currentColor" viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          )}
          <span className="truncate">{node.name}</span>
        </div>
        {!node.isFile && isExpanded && node.children.map((ch) => renderNode(ch, depth + 1))}
      </div>
    );
  };

  return (
    <div className="bg-dark-800 rounded-lg border border-dark-600 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-dark-600 bg-dark-700">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Files ({files.length})
        </span>
        {applied && <span className="text-[10px] text-green-400 font-medium px-1.5 py-0.5 bg-green-900/40 rounded">APPLIED</span>}
      </div>
      <div className="max-h-64 overflow-y-auto py-1">
        {files.length === 0 ? (
          <p className="text-xs text-gray-600 italic px-3 py-4 text-center">No files generated yet.</p>
        ) : (
          tree.map((n) => renderNode(n, 0))
        )}
      </div>
    </div>
  );
}
