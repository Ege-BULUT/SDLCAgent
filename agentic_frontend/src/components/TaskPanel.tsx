import { useState } from 'react';

interface Props {
  coderModel: string;
  reviewerModel: string;
  onGenerate: (params: {
    task: string;
    coder_model?: string;
    reviewer_model?: string;
    max_iterations: number;
    ponytail_mode?: boolean;
  }) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  loading: boolean;
  sessionId?: string;
}

export default function TaskPanel({ coderModel, reviewerModel, onGenerate, addToast, loading }: Props) {
  const [task, setTask] = useState('');
  const [maxIterations, setMaxIterations] = useState(3);
  const [ponytail, setPonytail] = useState(false);

  const handleGenerate = () => {
    if (!task.trim()) {
      addToast('Please enter a task description', 'error');
      return;
    }
    onGenerate({
      task: task.trim(),
      coder_model: coderModel || undefined,
      reviewer_model: reviewerModel || undefined,
      max_iterations: maxIterations,
      ponytail_mode: ponytail,
    });
  };

  return (
    <div className="bg-dark-800 rounded-lg border border-dark-600 p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Task</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={4}
              placeholder="Describe the code you want to generate..."
              className="w-full bg-dark-700 text-gray-200 text-sm rounded px-3 py-2 border border-dark-500 resize-none focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Max Iterations: <span className="text-blue-400 font-medium">{maxIterations}</span>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={maxIterations}
              onChange={(e) => setMaxIterations(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={ponytail}
              onChange={(e) => setPonytail(e.target.checked)}
              className="accent-blue-500 w-4 h-4 rounded"
            />
            <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
              Enable PonyTail Mode
            </span>
          </label>
          <a
            href="https://github.com/DietrichGebert/ponytail"
            target="_blank"
            rel="noopener noreferrer"
            title="PonyTail: YAGNI-first minimal code. 80-94% less code."
            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-dark-600 text-gray-400 hover:bg-blue-600 hover:text-white text-[10px] font-bold transition-colors"
          >
            ?
          </a>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading || !task.trim()}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-dark-600 disabled:text-gray-500 text-white text-sm font-medium rounded px-4 py-2.5 transition-colors"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Generating...
            </>
          ) : (
            'Generate Code'
          )}
        </button>
      </div>
    </div>
  );
}
