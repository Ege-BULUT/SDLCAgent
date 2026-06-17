import { useState, useMemo, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Props {
  files: Record<string, string>;
  liveCode?: string;
  streaming?: boolean;
}

const EXT_LANG: Record<string, string> = {
  py: 'python', ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  java: 'java', cpp: 'cpp', c: 'c', h: 'c', hpp: 'cpp', cs: 'csharp',
  go: 'go', rs: 'rust', rb: 'ruby', php: 'php', kt: 'kotlin', kts: 'kotlin',
  html: 'html', htm: 'html', css: 'css', scss: 'scss', json: 'json',
  md: 'markdown', mdx: 'markdown', yaml: 'yaml', yml: 'yaml',
  toml: 'toml', xml: 'xml', sql: 'sql', sh: 'bash', bash: 'bash',
  txt: 'text', env: 'text', gitignore: 'text', dockerfile: 'dockerfile',
};

function detectLang(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const base = filename.toLowerCase();
  if (base === 'dockerfile' || base.endsWith('/dockerfile')) return 'dockerfile';
  if (base === 'makefile') return 'makefile';
  return EXT_LANG[ext] || 'text';
}

function stripFileTags(text: string): string {
  return text.replace(/\[FILE:\s*[^\]]+\]/g, '').replace(/\[\/FILE\]/g, '');
}

export default function FilePreview({ files, liveCode, streaming }: Props) {
  const fileList = Object.keys(files);
  const hasLiveTab = streaming || (liveCode != null && liveCode.length > 0);
  const [activeFile, setActiveFile] = useState(hasLiveTab ? '__live__' : (fileList[0] || ''));
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeContent = activeFile === '__live__' ? (liveCode || '') : (files[activeFile] || '');
  const displayContent = activeFile === '__live__' ? stripFileTags(activeContent) : activeContent;

  const fileTabs = useMemo(() => {
    const tabs = fileList.map((path) => {
      const name = path.split('/').pop() || path;
      return { path, name };
    });
    if (hasLiveTab) {
      tabs.unshift({ path: '__live__', name: '● Live' });
    }
    return tabs;
  }, [fileList, hasLiveTab]);

  useEffect(() => {
    if (streaming && activeFile !== '__live__') {
      setActiveFile('__live__');
    }
  }, [streaming, activeFile]);

  useEffect(() => {
    if (!streaming || activeFile !== '__live__') return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [displayContent, streaming, activeFile]);

  if (fileList.length === 0 && !hasLiveTab) {
    return (
      <div className="bg-dark-800 rounded-lg border border-dark-600 p-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Generated Files</h2>
        <p className="text-gray-500 text-sm italic">No files generated yet. Submit a task to see results here.</p>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 rounded-lg border border-dark-600 overflow-hidden flex flex-col h-full">
      {/* File tabs */}
      <div className="flex items-center border-b border-dark-600 bg-dark-700 overflow-x-auto flex-shrink-0">
        {fileTabs.map((tab) => (
          <button
            key={tab.path}
            onClick={() => setActiveFile(tab.path)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs border-r border-dark-600 whitespace-nowrap transition-colors ${
              activeFile === tab.path
                ? 'bg-dark-800 text-blue-300 border-b-2 border-b-blue-500'
                : 'text-gray-400 hover:text-gray-200 hover:bg-dark-600'
            }`}
          >
            <svg className="w-3 h-3 flex-shrink-0 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
            {tab.name}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-dark-600 bg-dark-750 flex-shrink-0">
        <span className="text-[11px] text-gray-500 font-mono">{activeFile}</span>
        <CopyButton content={displayContent} />
      </div>

      {/* Code - fills remaining height */}
      <div ref={scrollRef} className="flex-1 overflow-auto relative min-h-0">
        {streaming && activeFile === '__live__' ? (
          <pre className="m-0 p-3 text-sm font-mono text-gray-200 whitespace-pre-wrap break-words min-h-full" style={{ background: '#1a1a2e' }}>
            {displayContent}
          </pre>
        ) : (
          <SyntaxHighlighter
            language={detectLang(activeFile)}
            style={oneDark}
            customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.8rem', background: '#1a1a2e', minHeight: '100%' }}
            showLineNumbers
            wrapLongLines
          >
            {displayContent}
          </SyntaxHighlighter>
        )}
        {streaming && activeFile === '__live__' && (
          <div className="sticky bottom-0 left-0 right-0 flex items-center gap-2 px-3 py-1.5 bg-blue-900/60 border-t border-blue-700 text-blue-200 text-[11px]">
            <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            Generating...
          </div>
        )}
      </div>
    </div>
  );
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = content;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button onClick={handleCopy} className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-200 transition-colors">
      {copied ? (
        <><svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Copied</>
      ) : (
        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Copy</>
      )}
    </button>
  );
}
