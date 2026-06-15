import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Props {
  code: string;
  language: string;
}

export default function CodeDisplay({ code, language }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const langMap: Record<string, string> = {
    python: 'python',
    typescript: 'typescript',
    javascript: 'javascript',
    java: 'java',
    go: 'go',
    rust: 'rust',
    cpp: 'cpp',
    csharp: 'csharp',
    ruby: 'ruby',
    php: 'php',
  };

  if (!code) {
    return (
      <div className="bg-dark-800 rounded-lg border border-dark-600 p-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Generated Code</h2>
        <p className="text-gray-500 text-sm italic">No code generated yet. Submit a task to see results here.</p>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 rounded-lg border border-dark-600 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-dark-600 bg-dark-700">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Generated Code</h2>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <div className="max-h-96 overflow-auto">
        <SyntaxHighlighter
          language={langMap[language] || language}
          style={oneDark}
          customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.8rem', background: '#1a1a2e' }}
          showLineNumbers
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
