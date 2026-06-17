import { useState, useEffect } from 'react';
import type { RepoItem, UpdateBlacklistResponse } from '../types';

interface Props {
  repoPath: string;
  initialItems: RepoItem[];
  initialPatterns: string[];
  onSaved: (res: UpdateBlacklistResponse) => void;
  onClose: () => void;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

function itemToPattern(item: RepoItem): string {
  return item.is_dir ? `${item.path}/` : item.path;
}

export default function BlacklistModal({ repoPath, initialItems, initialPatterns, onSaved, onClose, addToast }: Props) {
  const [patterns, setPatterns] = useState<Set<string>>(new Set(initialPatterns));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPatterns(new Set(initialPatterns));
  }, [initialPatterns]);

  const toggle = (item: RepoItem) => {
    const pat = itemToPattern(item);
    setPatterns((prev) => {
      const next = new Set(prev);
      if (next.has(pat)) next.delete(pat);
      else next.add(pat);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { updateBlacklist } = await import('../api');
      const res = await updateBlacklist({ repo_path: repoPath, patterns: Array.from(patterns) });
      onSaved(res);
      addToast('.agentignore updated', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to save blacklist', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-w-lg w-full mx-4 bg-dark-800 border border-dark-600 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-dark-600">
          <h2 className="text-lg font-semibold text-gray-100">Edit Blacklist</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl leading-none">×</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <p className="text-xs text-gray-400 mb-3">
            Tick items to exclude from RAG/code context. Choices are saved to<span className="text-blue-300"> .agentignore</span> in the repo root.
          </p>
          <div className="space-y-1">
            {initialItems.map((item) => {
              const pat = itemToPattern(item);
              const checked = patterns.has(pat);
              return (
                <label
                  key={pat}
                  className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${checked ? 'bg-red-900/20' : 'hover:bg-dark-700'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(item)}
                    className="accent-blue-500 w-4 h-4"
                  />
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {item.is_dir ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    )}
                  </svg>
                  <span className={`text-sm ${checked ? 'text-red-300 line-through' : 'text-gray-300'}`}>
                    {item.path}
                    {item.is_dir && <span className="text-gray-500">/</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-dark-600 bg-dark-700/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-300 hover:text-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-dark-600 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Save .agentignore'}
          </button>
        </div>
      </div>
    </div>
  );
}
