import { useState, useEffect, useCallback } from 'react';
import { ingestRepo, getRagStats, clearRag, launchProject } from '../api';
import type { RagStatsResponse, LaunchResponse } from '../types';

interface Props {
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

interface ExampleProject {
  name: string;
  path: string;
  description: string;
}

const EXAMPLE_PROJECTS: ExampleProject[] = [
  {
    name: 'Streamlit Dashboard (Plotly)',
    path: '../examples/streamlit_dashboard',
    description: 'Interactive Plotly charts with Streamlit — ask AI to convert to TypeScript/CSS/HTML',
  },
  {
    name: 'Todo List CLI',
    path: '../examples/todo_app',
    description: 'Simple Python CLI todo app — ask AI to add a calendar/due-date feature',
  },
];

const ALL_LANGUAGES = ['python', 'typescript', 'javascript', 'java', 'go', 'rust', 'cpp', 'csharp', 'ruby', 'php'];

export default function RagPanel({ addToast }: Props) {
  const [repoPath, setRepoPath] = useState(EXAMPLE_PROJECTS[0].path);
  const [selectedExample, setSelectedExample] = useState(EXAMPLE_PROJECTS[0].name);
  const [useCustom, setUseCustom] = useState(false);
  const [languages, setLanguages] = useState<string[]>(['python', 'typescript']);
  const [ingesting, setIngesting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [stats, setStats] = useState<RagStatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<LaunchResponse | null>(null);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const s = await getRagStats();
      setStats(s);
    } catch {
      // ignore
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleExampleChange = (name: string) => {
    setSelectedExample(name);
    const ex = EXAMPLE_PROJECTS.find((e) => e.name === name);
    if (ex) {
      setRepoPath(ex.path);
    }
  };

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const handleIngest = async () => {
    if (!repoPath.trim()) {
      addToast('Please enter a repository path', 'error');
      return;
    }
    if (languages.length === 0) {
      addToast('Select at least one language', 'error');
      return;
    }
    setIngesting(true);
    try {
      await ingestRepo({ repo_path: repoPath.trim(), languages });
      addToast('Repository ingested successfully', 'success');
      fetchStats();
    } catch (err: any) {
      addToast(err.message || 'Ingestion failed', 'error');
    } finally {
      setIngesting(false);
    }
  };

  const handleLaunch = useCallback(async () => {
    if (!repoPath.trim()) return;
    setLaunching(true);
    setLaunchResult(null);
    try {
      const res = await launchProject(repoPath.trim());
      setLaunchResult(res);
      if (res.url) {
        addToast('Launching ' + res.launch_type + ' app...', 'info');
        setTimeout(() => window.open(res.url!, '_blank'), 500);
      } else if (res.info) {
        addToast(res.info.slice(0, 60) + '...', 'info');
      }
    } catch (err: any) {
      addToast(err.message || 'Launch failed', 'error');
    } finally {
      setLaunching(false);
    }
  }, [repoPath, addToast]);

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearRag();
      addToast('RAG data cleared', 'info');
      setStats(null);
    } catch (err: any) {
      addToast(err.message || 'Clear failed', 'error');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="bg-dark-800 rounded-lg border border-dark-600 p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">RAG Management</h2>
      <div className="space-y-3">
        {/* Example project selector */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Example Project</label>
          <select
            value={selectedExample}
            onChange={(e) => handleExampleChange(e.target.value)}
            disabled={useCustom}
            className="w-full bg-dark-700 text-gray-200 text-sm rounded px-3 py-2 border border-dark-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-40"
          >
            {EXAMPLE_PROJECTS.map((ex) => (
              <option key={ex.name} value={ex.name}>{ex.name}</option>
            ))}
          </select>
          {!useCustom && selectedExample && (
            <p className="text-xs text-gray-500 mt-1">
              {EXAMPLE_PROJECTS.find((e) => e.name === selectedExample)?.description}
            </p>
          )}
        </div>

        {/* Launch button */}
        {!useCustom && (
          <div>
            <button
              onClick={handleLaunch}
              disabled={launching}
              className="w-full flex items-center justify-center gap-2 bg-purple-700 hover:bg-purple-600 disabled:bg-dark-600 disabled:text-gray-500 text-white text-sm font-medium rounded px-4 py-2 transition-colors"
            >
              {launching ? <Spinner /> : null}
              {launching ? 'Launching...' : 'Launch Example'}
            </button>
            {launchResult?.info && (
              <pre className="mt-2 bg-black/40 rounded p-2 text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">
                {launchResult.info}
              </pre>
            )}
          </div>
        )}

        {/* Custom codebase toggle */}
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={useCustom}
            onChange={(e) => {
              setUseCustom(e.target.checked);
              if (e.target.checked) setRepoPath('');
              else {
                setRepoPath(EXAMPLE_PROJECTS[0].path);
                setSelectedExample(EXAMPLE_PROJECTS[0].name);
              }
            }}
            className="accent-blue-500 w-4 h-4 rounded"
          />
          <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
            Use custom codebase path
          </span>
        </label>

        {/* Path input (visible only in custom mode) */}
        {useCustom && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Repository Path</label>
            <input
              type="text"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="/path/to/your/repo"
              className="w-full bg-dark-700 text-gray-200 text-sm rounded px-3 py-2 border border-dark-500 focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-500"
            />
          </div>
        )}

        {/* Languages */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Languages</label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => toggleLanguage(lang)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  languages.includes(lang)
                    ? 'bg-blue-900/60 border-blue-500 text-blue-200'
                    : 'bg-dark-700 border-dark-500 text-gray-400 hover:border-gray-400'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleIngest}
            disabled={ingesting || !repoPath.trim() || languages.length === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-dark-600 disabled:text-gray-500 text-white text-sm font-medium rounded px-4 py-2 transition-colors"
          >
            {ingesting ? <Spinner /> : null}
            {ingesting ? 'Ingesting...' : 'Ingest'}
          </button>
          <button
            onClick={handleClear}
            disabled={clearing}
            className="flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 disabled:bg-dark-600 disabled:text-gray-500 text-white text-sm font-medium rounded px-4 py-2 transition-colors"
          >
            {clearing ? <Spinner /> : null}
            {clearing ? '...' : 'Clear'}
          </button>
        </div>

        {/* Stats */}
        <div className="bg-dark-700 rounded p-3">
          <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">Stats</h3>
          {loadingStats ? (
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              <Spinner /> Loading...
            </div>
          ) : stats ? (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Chunks</span>
                <span className="text-gray-200 font-medium">{stats.total_chunks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Files</span>
                <span className="text-gray-200 font-medium">{stats.total_files}</span>
              </div>
              {stats.files && stats.files.length > 0 && (
                <div>
                  <span className="text-gray-400 block mb-1">Files:</span>
                  <div className="max-h-20 overflow-y-auto space-y-0.5">
                    {stats.files.slice(0, 20).map((f, i) => (
                      <div key={i} className="text-gray-500 truncate">{f}</div>
                    ))}
                    {stats.files.length > 20 && (
                      <div className="text-gray-500">...and {stats.files.length - 20} more</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-xs">No data ingested yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
