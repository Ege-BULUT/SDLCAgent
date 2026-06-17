import { useEffect, useState } from 'react';

interface Props {
  show: boolean;
  onClose: () => void;
  onDontShowAgain: () => void;
  initialTab?: string;
}

const TABS = ['How to Use', 'Features, Tips & Tricks'];

export default function WelcomeModal({ show, onClose, onDontShowAgain, initialTab }: Props) {
  const [activeTab, setActiveTab] = useState(initialTab || 'How to Use');
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!show) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [show, onClose]);

  if (!show) return null;

  const handleDontShowChange = () => {
    const next = !dontShow;
    setDontShow(next);
    if (next) {
      localStorage.setItem('welcomeModalDismissed', 'true');
      onDontShowAgain();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="max-w-2xl w-full mx-4 bg-dark-800 border border-dark-600 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-dark-600">
          <h2 className="text-lg font-semibold text-gray-100">Welcome</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl leading-none">&times;</button>
        </div>

        <div className="flex border-b border-dark-600">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-sm font-medium py-2.5 transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-dark-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {activeTab === 'How to Use' && (
            <ol className="list-decimal list-inside space-y-3 text-sm text-gray-300">
              <li>Select a <strong>Coder Model</strong> and <strong>Reviewer Model</strong> from the sidebar dropdowns</li>
              <li>(Optional) Ingest a codebase using the RAG panel</li>
              <li>Enter your coding task in the text area</li>
              <li>Click <strong>"Generate Code"</strong> : the agent will write, review, and fix the code</li>
              <li>View results in the Code Display panel</li>
            </ol>
          )}

          {activeTab === 'Features, Tips & Tricks' && (
            <>
              <ul className="space-y-3 text-sm text-gray-300 list-disc list-inside">
                <li><strong>Multi-Agent Workflow</strong>: Code is written by one LLM, reviewed by another, and iteratively fixed</li>
                <li><strong>Code RAG</strong>: Ingest a codebase for context-aware code generation (AST-based chunking preserves function/class boundaries)</li>
                <li><strong>Model Flexibility</strong>: Swap between local (fast) and cloud (powerful) models on the fly</li>
                <li><strong>Auto-Debug Loop</strong>: Up to N iterations of write → review → fix</li>
                <li><strong>Tip</strong>: Use <code className="bg-dark-700 px-1 rounded">granite4.1:3b</code> for quick iterations, <code className="bg-dark-700 px-1 rounded">qwen3-coder:480b-cloud</code> for production code</li>
              </ul>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mt-4 mb-2">Supported Languages</h3>
              <p className="text-sm text-gray-400 mb-2">
                Code RAG uses AST-based chunking for these languages (function/class boundaries preserved):
              </p>
              <div className="grid grid-cols-3 gap-1 text-xs">
                {['Python', 'Java', 'C++', 'C', 'Kotlin', 'TypeScript', 'TSX', 'JavaScript',
                  'HTML', 'CSS', 'JSON', 'Markdown'].map((l) => (
                  <span key={l} className="bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded text-center">{l}</span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Rust, Go, Ruby, Swift &amp; PHP indexed as single chunks (tree-sitter grammars coming soon).
              </p>
            </>
          )}

        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-dark-600 bg-dark-700/50">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={handleDontShowChange}
              className="accent-blue-500"
            />
            Don't show this again
          </label>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


