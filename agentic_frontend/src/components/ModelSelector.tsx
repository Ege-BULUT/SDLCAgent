import { useState, useEffect } from 'react';
import { getModels } from '../api';
import type { ModelInfo } from '../types';

interface Props {
  coderModel: string;
  reviewerModel: string;
  onCoderChange: (v: string) => void;
  onReviewerChange: (v: string) => void;
  addToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function ModelSelector({ coderModel, reviewerModel, onCoderChange, onReviewerChange, addToast }: Props) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getModels()
      .then((m) => {
        if (!mounted) return;
        setModels(Array.isArray(m) ? m : []);
        if (m.length > 0) {
          const coderDefault = m.find((x) => x.role === 'coder');
          const reviewerDefault = m.find((x) => x.role === 'reviewer');
          if (!coderModel && coderDefault) onCoderChange(coderDefault.name);
          if (!reviewerModel && reviewerDefault) onReviewerChange(reviewerDefault.name);
        }
      })
      .catch(() => { if (mounted) addToast?.('Failed to fetch model list', 'error'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="bg-dark-800 rounded-lg border border-dark-600 p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Models</h2>
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Spinner />
          Loading models...
        </div>
      ) : models.length === 0 ? (
        <p className="text-gray-500 text-sm">No models available</p>
      ) : (
        <div className="space-y-3">
          <ModelDropdown
            label="Coder Model"
            value={coderModel}
            onChange={onCoderChange}
            models={models.filter((m) => m.role === 'coder' || m.role === 'general')}
          />
          <ModelDropdown
            label="Reviewer Model"
            value={reviewerModel}
            onChange={onReviewerChange}
            models={models.filter((m) => m.role === 'reviewer' || m.role === 'general')}
          />
        </div>
      )}
    </div>
  );
}

function ModelDropdown({
  label,
  value,
  onChange,
  models,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  models: ModelInfo[];
}) {
  const selected = models.find((m) => m.name === value);
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div className="relative group">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-dark-700 text-gray-200 text-sm rounded px-3 py-2 border border-dark-500 appearance-none cursor-pointer focus:outline-none focus:border-blue-500 transition-colors"
        >
          {models.length === 0 && <option value="">No models</option>}
          {models.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name} ({m.size})
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {selected?.description && (
          <div className="absolute z-10 bottom-full left-0 right-0 mb-1 px-3 py-2 bg-dark-700 border border-dark-500 rounded text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
            {selected.description}
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
