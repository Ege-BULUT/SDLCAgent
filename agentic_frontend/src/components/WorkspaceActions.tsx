import { useState } from 'react';

interface Props {
  fileCount: number;
  hasBackups: boolean;
  applied: boolean;
  onApply: (backupFirst: boolean) => void;
  onRevert: () => void;
  onCleanup: () => void;
}

export default function WorkspaceActions({ fileCount, hasBackups, applied, onApply, onRevert, onCleanup }: Props) {
  const [applying, setApplying] = useState(false);
  const [reverting, setReverting] = useState(false);

  if (fileCount === 0) return null;

  return (
    <div className="bg-dark-800 rounded-lg border border-dark-600 p-3">
      <div className="flex flex-wrap gap-2">
        {/* Apply (with backup) */}
        <button
          onClick={async () => { setApplying(true); try { await onApply(true); } finally { setApplying(false); } }}
          disabled={applying || applied}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-dark-600 disabled:text-gray-500 text-white text-xs font-medium rounded transition-colors"
        >
          {applying ? (
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {applied ? 'Applied' : 'Backup & Apply'}
        </button>

        {/* Quick Apply (no backup) */}
        <button
          onClick={async () => { setApplying(true); try { await onApply(false); } finally { setApplying(false); } }}
          disabled={applying || applied}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/60 hover:bg-emerald-700 disabled:bg-dark-600 disabled:text-gray-500 text-emerald-300 text-xs font-medium rounded transition-colors"
        >
          Apply (no backup)
        </button>

        {/* Revert */}
        {hasBackups && (
          <button
            onClick={async () => { setReverting(true); try { await onRevert(); } finally { setReverting(false); } }}
            disabled={reverting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-700 hover:bg-orange-600 disabled:bg-dark-600 disabled:text-gray-500 text-white text-xs font-medium rounded transition-colors"
          >
            {reverting ? (
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
              </svg>
            )}
            Revert Last Apply
          </button>
        )}

        {/* Cleanup */}
        <div className="flex-1" />
        <button
          onClick={onCleanup}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-600 hover:bg-dark-500 text-gray-400 hover:text-gray-200 text-xs rounded transition-colors"
          title="Clean up stale session workspaces"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Cleanup
        </button>
      </div>

      {applied && (
        <p className="text-[11px] text-green-500 mt-2">
          Files applied to disk. Use Revert to restore originals from backup.
        </p>
      )}
    </div>
  );
}
