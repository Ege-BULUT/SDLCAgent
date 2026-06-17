import { useState, useEffect, useCallback } from 'react';
import { ingestRepo, getRagStats, clearRag, launchProject, detectRepoLanguages, detectRepoStructure } from '../api';
import BlacklistModal from './BlacklistModal';
import type { RagStatsResponse, LaunchResponse, RepoItem, UpdateBlacklistResponse } from '../types';

interface Props {
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  addLog: (msg: string) => void;
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

const ALL_LANGUAGES = ['python', 'typescript', 'javascript', 'java', 'go', 'rust', 'cpp', 'csharp', 'ruby', 'php', 'html', 'css', 'json', 'markdown'];

export default function RagPanel({ addToast, addLog }: Props) {
  const [repoPath, setRepoPath] = useState('');
  const [selectedExample, setSelectedExample] = useState(EXAMPLE_PROJECTS[0].name);
  const [useExample, setUseExample] = useState(false);
  const [languages, setLanguages] = useState<string[]>([]);
  const [ingesting, setIngesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [stats, setStats] = useState<RagStatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<LaunchResponse | null>(null);
  const [structure, setStructure] = useState<RepoItem[]>([]);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [detectingStructure, setDetectingStructure] = useState(false);
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('recent_projects');
      if (stored) setRecentProjects(JSON.parse(stored));
    } catch {
      /* empty */
    }
  }, []);

  const saveRecent = (path: string) => {
    if (!path.trim()) return;
    setRecentProjects((prev) => {
      const next = [path, ...prev.filter((p) => p !== path)].slice(0, 10);
      localStorage.setItem('recent_projects', JSON.stringify(next));
      return next;
    });
  };

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

  const handleDetect = async () => {
    if (!repoPath.trim()) {
      addToast('Enter a repository path first', 'error');
      return;
    }
    saveRecent(repoPath.trim());
    setDetecting(true);
    try {
      const detected = await detectRepoLanguages(repoPath.trim());
      setLanguages(detected);
      if (detected.length === 0) {
        addToast('No supported languages found', 'info');
      } else {
        addToast(`Detected ${detected.length} language(s): ${detected.join(', ')}`, 'success');
      }
      addLog(`Detected ${detected.length} language(s) in ${repoPath.trim()}: ${detected.join(', ')}`);
    } catch (err: any) {
      addToast(err.message || 'Detection failed', 'error');
      addLog(`Detection failed: ${err.message || 'Unknown error'}`);
    } finally {
      setDetecting(false);
    }
  };

  const handleDetectStructure = async () => {
    if (!repoPath.trim()) {
      addToast('Enter a repository path first', 'error');
      return;
    }
    saveRecent(repoPath.trim());
    setDetectingStructure(true);
    try {
      const res = await detectRepoStructure(repoPath.trim());
      setStructure(res.items);
      setPatterns(res.patterns);
      setShowBlacklistModal(true);
      addLog(`Detected ${res.items.length} top-level items in ${res.repo_path}`);
    } catch (err: any) {
      addToast(err.message || 'Structure detection failed', 'error');
      addLog(`Structure detection failed: ${err.message || 'Unknown error'}`);
    } finally {
      setDetectingStructure(false);
    }
  };

  const handleBlacklistSaved = (res: UpdateBlacklistResponse) => {
    setPatterns(res.patterns);
    setShowBlacklistModal(false);
    addLog(`Updated .agentignore with ${res.patterns.length} pattern(s)`);
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
    saveRecent(repoPath.trim());
    setIngesting(true);
    try {
      const res = await ingestRepo({ repo_path: repoPath.trim(), languages });
      const detail = `${res.files_processed} files, ${res.chunks_created} chunks`;
      addToast(`Ingested: ${detail}`, 'success');
      addLog(`Ingested ${repoPath.trim()} — ${detail}`);
      if (res.logs) {
        res.logs.forEach((l) => addLog(l));
      }
      fetchStats();
    } catch (err: any) {
      addToast(err.message || 'Ingestion failed', 'error');
      addLog(`Ingest failed: ${err.message || 'Unknown error'}`);
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
      addLog(`Launched ${repoPath.trim()} (${res.launch_type})`);
      if (res.url) {
        addToast('Launching ' + res.launch_type + ' app at ' + res.url, 'info');
        setTimeout(() => window.open(res.url!, '_blank'), 500);
      } else if (res.info) {
        addToast(res.info.slice(0, 60) + '...', 'info');
      }
    } catch (err: any) {
      addToast(err.message || 'Launch failed', 'error');
      addLog(`Launch failed: ${err.message || 'Unknown error'}`);
    } finally {
      setLaunching(false);
    }
  }, [repoPath, addToast]);

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearRag();
      addToast('RAG data cleared', 'info');
      addLog('Cleared RAG collection');
      setStats(null);
    } catch (err: any) {
      addToast(err.message || 'Clear failed', 'error');
      addLog(`Clear failed: ${err.message || 'Unknown error'}`);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="bg-dark-800 rounded-lg border border-dark-600 p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">RAG Management</h2>
      <div className="space-y-3">
        {/* Repository path (always visible) */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Repository Path</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="/path/to/your/repo"
              className="flex-1 bg-dark-700 text-gray-200 text-sm rounded px-3 py-2 border border-dark-500 focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-500"
            />
            <button
              onClick={() => setShowRecent((v) => !v)}
              disabled={recentProjects.length === 0}
              title="Recent projects"
              className="px-2 py-1 bg-dark-700 border border-dark-500 rounded text-gray-400 hover:text-gray-200 disabled:opacity-30 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
          {showRecent && recentProjects.length > 0 && (
            <div className="mt-1 bg-dark-700 border border-dark-500 rounded max-h-32 overflow-y-auto">
              {recentProjects.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setRepoPath(p);
                    setShowRecent(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-dark-600 truncate"
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Use example project toggle */}
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={useExample}
            onChange={(e) => {
              setUseExample(e.target.checked);
              if (e.target.checked) {
                const ex = EXAMPLE_PROJECTS.find((x) => x.name === selectedExample) || EXAMPLE_PROJECTS[0];
                setRepoPath(ex.path);
              }
            }}
            className="accent-blue-500 w-4 h-4 rounded"
          />
          <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
            Use example project
          </span>
        </label>

        {/* Example project selector (visible only when toggle enabled) */}
        {useExample && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Example Project</label>
            <select
              value={selectedExample}
              onChange={(e) => handleExampleChange(e.target.value)}
              className="w-full bg-dark-700 text-gray-200 text-sm rounded px-3 py-2 border border-dark-500 focus:outline-none focus:border-blue-500 transition-colors"
            >
              {EXAMPLE_PROJECTS.map((ex) => (
                <option key={ex.name} value={ex.name}>{ex.name}</option>
              ))}
            </select>
            {selectedExample && (
              <p className="text-xs text-gray-500 mt-1">
                {EXAMPLE_PROJECTS.find((e) => e.name === selectedExample)?.description}
              </p>
            )}
          </div>
        )}

        {/* Detect Languages button */}
        <button
          onClick={handleDetect}
          disabled={detecting || !repoPath.trim()}
          className="w-full flex items-center justify-center gap-2 bg-cyan-700 hover:bg-cyan-600 disabled:bg-dark-600 disabled:text-gray-500 text-white text-sm font-medium rounded px-4 py-2 transition-colors"
        >
          {detecting ? <Spinner /> : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          )}
          {detecting ? 'Detecting...' : 'Detect Languages'}
        </button>

        {/* Detect Structure / Edit Blacklist button */}
        <button
          onClick={handleDetectStructure}
          disabled={detectingStructure || !repoPath.trim()}
          className="w-full flex items-center justify-center gap-2 bg-indigo-700 hover:bg-indigo-600 disabled:bg-dark-600 disabled:text-gray-500 text-white text-sm font-medium rounded px-4 py-2 transition-colors"
        >
          {detectingStructure ? <Spinner /> : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          )}
          {detectingStructure ? 'Scanning...' : 'Detect Structure / Edit Blacklist'}
        </button>

        {showBlacklistModal && (
          <BlacklistModal
            repoPath={repoPath.trim()}
            initialItems={structure}
            initialPatterns={patterns}
            onSaved={handleBlacklistSaved}
            onClose={() => setShowBlacklistModal(false)}
            addToast={addToast}
          />
        )}

        {/* Languages */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs text-gray-400">Languages</label>
            {languages.length > 0 && (
              <span className="text-[10px] text-cyan-400">{languages.length} selected</span>
            )}
          </div>
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

        {/* Launch Example — at the bottom of the column */}
        {useExample && (
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
