import { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import ModelSelector from './components/ModelSelector';
import TaskPanel from './components/TaskPanel';
import FileExplorer from './components/FileExplorer';
import FilePreview from './components/FilePreview';
import ReviewFeedback from './components/ReviewFeedback';
import Markdown from 'react-markdown';
import WorkspaceActions from './components/WorkspaceActions';
import LogViewer from './components/LogViewer';
import RagPanel from './components/RagPanel';
import ResizableColumns from './components/ResizableColumns';
import StatusBar from './components/StatusBar';
import Toast from './components/Toast';
import WelcomeModal from './components/WelcomeModal';
import { workspaceInit, workspaceApply, workspaceRevert, workspaceCleanup, generateCodeStream } from './api';
import type { ToastMessage, StreamEvent, GenerateRequest } from './types';

export default function App() {
  const [coderModel, setCoderModel] = useState('');
  const [reviewerModel, setReviewerModel] = useState('');
  const [generating, setGenerating] = useState(false);
  const [lastAction, setLastAction] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [appLogs, setAppLogs] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [workspaceFiles, setWorkspaceFiles] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [hasBackups, setHasBackups] = useState(false);
  const [applyBaseDir, setApplyBaseDir] = useState('');

  // Streaming state
  const [coderBuffer, setCoderBuffer] = useState('');
  const [thoughtsBuffer, setThoughtsBuffer] = useState('');
  const [judgeBuffer, setJudgeBuffer] = useState('');
  const [finalCode, setFinalCode] = useState('');
  const [finalFeedback, setFinalFeedback] = useState('');
  const [judgeEvaluation, setJudgeEvaluation] = useState('');
  const [finalIsValid, setFinalIsValid] = useState(false);
  const [currentNode, setCurrentNode] = useState<'coder' | 'reviewer' | 'judge' | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [totalIterations, setTotalIterations] = useState(0);
  const streamAbortRef = useRef<AbortController | null>(null);

  // Init workspace session on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('workspace_session_id');
    if (stored) {
      setSessionId(stored);
    } else {
      workspaceInit().then((res) => {
        setSessionId(res.session_id);
        sessionStorage.setItem('workspace_session_id', res.session_id);
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const dismissed = localStorage.getItem('welcomeModalDismissed');
    if (!dismissed) {
      setShowModal(true);
    }
  }, []);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setAppLogs((prev) => [...prev, `[${ts}] ${msg}`]);
  }, []);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleStreamEvent = useCallback((event: StreamEvent) => {
    switch (event.type) {
      case 'node_start': {
        setCurrentNode(event.node);
        if (event.node === 'coder') {
          setCoderBuffer('');
          setThoughtsBuffer('');
        } else if (event.node === 'reviewer') {
          setFinalFeedback('');
        } else if (event.node === 'judge') {
          setJudgeBuffer('');
        }
        addLog(`Iteration ${event.iteration}: ${event.node === 'coder' ? 'Coding' : event.node === 'reviewer' ? 'Reviewing' : 'Judging'}...`);
        break;
      }
      case 'thought_token': {
        setThoughtsBuffer((prev) => prev + event.text);
        break;
      }
      case 'coder_token': {
        setCoderBuffer((prev) => prev + event.text);
        break;
      }
      case 'reviewer_token': {
        setFinalFeedback((prev) => prev + event.text);
        break;
      }
      case 'judge_token': {
        setJudgeBuffer((prev) => prev + event.text);
        break;
      }
      case 'node_end': {
        if (event.node === 'coder' && event.draft_code !== undefined) {
          setFinalCode(event.draft_code);
          if (event.files && Object.keys(event.files).length > 0) {
            setWorkspaceFiles(event.files);
            const paths = Object.keys(event.files);
            setSelectedFile(paths[0]);
            addLog(`Generated ${paths.length} file(s): ${paths.join(', ')}`);
          }
        } else if (event.node === 'reviewer' && event.feedback !== undefined) {
          setFinalFeedback(event.feedback);
          if (event.is_valid !== undefined) {
            setFinalIsValid(event.is_valid);
          }
          addLog(`Review: ${event.is_valid ? 'PASS' : 'NEEDS FIXES'}`);
        } else if (event.node === 'judge' && event.evaluation !== undefined) {
          setJudgeEvaluation(event.evaluation);
          addLog('Judge evaluation complete');
        }
        break;
      }
      case 'error': {
        addLog(`[Error] ${event.message}`);
        addToast(event.message, 'error');
        break;
      }
      case 'done': {
        setTotalIterations(event.iterations);
        setFinalIsValid(event.is_valid);
        setFinalCode(event.draft_code);
        setFinalFeedback(event.review_feedback);
        if (event.judge_evaluation) {
          setJudgeEvaluation(event.judge_evaluation);
        }
        if (event.files && Object.keys(event.files).length > 0) {
          setWorkspaceFiles(event.files);
        }
        setCurrentNode(null);
        setLastAction(event.is_valid ? 'Code passed review' : 'Max iterations reached');
        addLog(`Done: ${event.iterations} iteration(s), ${event.is_valid ? 'VALID' : 'NOT VALID'}`);
        addToast(`Generation complete (${event.iterations} iterations)`, event.is_valid ? 'success' : 'info');
        setGenerating(false);
        break;
      }
    }
  }, [addLog, addToast]);

  const handleStreamDone = useCallback(() => {
    setCurrentNode(null);
    if (generating) {
      setGenerating(false);
      setLastAction('Stream ended');
    }
  }, [generating]);

  const handleStreamError = useCallback((err: Error) => {
    setGenerating(false);
    setCurrentNode(null);
    setStreamError(err.message);
    setLastAction('Generation failed');
    addToast(err.message || 'Stream failed', 'error');
    addLog(`[Error] ${err.message}`);
  }, [addLog, addToast]);

  const handleGenerate = useCallback(async (params: {
    task: string;
    coder_model?: string;
    reviewer_model?: string;
    max_iterations: number;
    ponytail_mode?: boolean;
  }) => {
    // Abort any existing stream
    streamAbortRef.current?.abort();

    const req: GenerateRequest = {
      task: params.task,
      language: '',
      coder_model: params.coder_model || coderModel || undefined,
      reviewer_model: params.reviewer_model || reviewerModel || undefined,
      judge_model: params.reviewer_model || reviewerModel || undefined,
      max_iterations: params.max_iterations,
      ponytail_mode: params.ponytail_mode,
      session_id: sessionId || undefined,
    };

    // Reset state
    setCoderBuffer('');
    setThoughtsBuffer('');
    setJudgeBuffer('');
    setFinalCode('');
    setFinalFeedback('');
    setJudgeEvaluation('');
    setWorkspaceFiles({});
    setFinalIsValid(false);
    setCurrentNode('coder');  // show live preview immediately, before first SSE event
    setStreamError(null);
    setTotalIterations(0);
    setApplied(false);
    setGenerating(true);
    setLastAction('Generating code...');
    addLog('Code generation started');

    const controller = generateCodeStream(
      req,
      handleStreamEvent,
      handleStreamDone,
      handleStreamError,
    );
    streamAbortRef.current = controller;
  }, [coderModel, reviewerModel, sessionId, handleStreamEvent, handleStreamDone, handleStreamError, addLog]);

  const handleApply = useCallback(async (_backup: boolean) => {
    if (!sessionId) return;
    try {
      const res = await workspaceApply(sessionId, applyBaseDir || undefined);
      if (res.ok) {
        setApplied(true);
        setHasBackups(true);
        addLog(`Applied ${res.applied.length} file(s) to disk`);
        addToast(`Applied ${res.applied.length} file(s)`, 'success');
      } else {
        addToast('Apply had errors: ' + (res.errors?.[0]?.error || 'unknown'), 'error');
      }
    } catch (err: any) {
      addToast('Apply failed: ' + (err.message || ''), 'error');
    }
  }, [sessionId, applyBaseDir, addLog, addToast]);

  const handleRevert = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await workspaceRevert(sessionId, applyBaseDir || undefined);
      if (res.ok) {
        setApplied(false);
        addLog(`Reverted ${res.reverted.length} file(s) from backup`);
        addToast(`Reverted ${res.reverted.length} file(s)`, 'info');
      } else {
        addToast('Revert had errors', 'error');
      }
    } catch (err: any) {
      addToast('Revert failed: ' + (err.message || ''), 'error');
    }
  }, [sessionId, applyBaseDir, addLog, addToast]);

  const handleCleanup = useCallback(async () => {
    try {
      const res = await workspaceCleanup();
      addToast(`Cleaned ${res.cleaned} stale session(s)`, 'info');
      addLog(`Cleanup: ${res.cleaned} stale sessions removed, ${res.skipped_active} active skipped`);
    } catch (err: any) {
      addToast('Cleanup failed', 'error');
    }
  }, [addLog, addToast]);

  const filePaths = Object.keys(workspaceFiles);
  const fileCount = filePaths.length;
  const hasResults = generating || currentNode !== null || streamError !== null || finalCode !== '' || fileCount > 0 || finalFeedback !== '' || judgeEvaluation !== '';
  const centerCode = currentNode === 'coder' ? coderBuffer : finalCode;
  const centerStreaming = currentNode === 'coder';
  const showThoughts = currentNode === 'coder' || thoughtsBuffer !== '';
  const showFiles = fileCount > 0;
  const showJudge = currentNode === 'judge' || judgeEvaluation !== '';
  const rightFeedback = currentNode === 'judge' ? judgeBuffer : finalFeedback;
  const rightStreaming = currentNode === 'reviewer' || currentNode === 'judge';

  return (
    <div className="h-screen flex flex-col">
      <WelcomeModal
        show={showModal}
        onClose={() => setShowModal(false)}
        onDontShowAgain={() => setShowModal(false)}
      />
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — ModelSelector + RagPanel */}
        <aside className="w-80 flex-shrink-0 overflow-y-auto border-r border-dark-600 bg-dark-900 p-3 space-y-3">
          <ModelSelector
            coderModel={coderModel}
            reviewerModel={reviewerModel}
            onCoderChange={setCoderModel}
            onReviewerChange={setReviewerModel}
            addToast={addToast}
          />
          <RagPanel addToast={addToast} addLog={addLog} />
        </aside>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Task input */}
            <TaskPanel
              coderModel={coderModel}
              reviewerModel={reviewerModel}
              onGenerate={handleGenerate}
              addToast={addToast}
              loading={generating}
              sessionId={sessionId}
            />

            {/* Three-column results area */}
            {hasResults && (
              <div className="space-y-3">
                {/* Error banner */}
                {streamError && (
                  <div className="flex items-start gap-2 bg-red-900/40 border border-red-700 rounded-lg px-4 py-3">
                    <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm text-red-300 font-medium">Generation failed</p>
                      <p className="text-xs text-red-400 mt-0.5">{streamError}</p>
                    </div>
                  </div>
                )}

                <ResizableColumns
                  initialWidths={[220, 220, 480, 260, 260]}
                  minWidths={[140, 140, 200, 140, 140]}
                  className="gap-0"
                >
                  {/* LEFT: File Explorer + Apply */}
                  <div className="space-y-2 h-full">
                    {showFiles && (
                      <FileExplorer
                        files={filePaths}
                        selectedFile={selectedFile}
                        onSelect={setSelectedFile}
                        applied={applied}
                      />
                    )}
                    {showFiles && (
                      <div>
                        <div className="mb-2">
                          <label className="block text-[10px] text-gray-500 mb-1">Apply base dir (optional)</label>
                          <input
                            type="text"
                            value={applyBaseDir}
                            onChange={(e) => setApplyBaseDir(e.target.value)}
                            placeholder="Leave empty for current dir"
                            className="w-full bg-dark-700 text-gray-300 text-xs rounded px-2 py-1 border border-dark-500 focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-600"
                          />
                        </div>
                        <WorkspaceActions
                          fileCount={fileCount}
                          hasBackups={hasBackups}
                          applied={applied}
                          onApply={handleApply}
                          onRevert={handleRevert}
                          onCleanup={handleCleanup}
                        />
                      </div>
                    )}
                    {/* Placeholder when generating but no files yet */}
                    {generating && !showFiles && (
                      <div className="bg-dark-800 rounded-lg border border-dark-600 p-4">
                        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Files</h2>
                        <p className="text-gray-500 text-sm italic">Waiting for code generation...</p>
                      </div>
                    )}
                  </div>

                  {/* THOUGHTS & PLANNING */}
                  <div className="h-full">
                    {showThoughts ? (
                      <div className="bg-dark-800 rounded-lg border border-dark-600 flex flex-col h-full">
                        <div className="px-4 pt-4 pb-2 flex-shrink-0">
                          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                            Thoughts & Planning
                            {currentNode === 'coder' && <span className="ml-2 text-yellow-400 text-[10px] animate-pulse">● LIVE</span>}
                          </h2>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 pb-4 text-sm text-gray-300 leading-relaxed prose prose-invert prose-sm max-w-none min-h-0">
                          <Markdown>{thoughtsBuffer}</Markdown>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-dark-800 rounded-lg border border-dark-600 flex flex-col h-full">
                        <div className="flex-1 flex items-center justify-center px-4 py-8">
                          <p className="text-gray-500 text-sm italic">Agent thoughts will appear here.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CENTER: Code Preview */}
                  <div className="min-w-0 h-full">
                    <FilePreview
                      files={workspaceFiles}
                      liveCode={centerCode}
                      streaming={centerStreaming}
                    />
                  </div>

                  {/* RIGHT: Review Feedback */}
                  <div className="space-y-2 h-full">
                    <ReviewFeedback
                      feedback={rightFeedback}
                      isValid={finalIsValid}
                      streaming={rightStreaming}
                      label="Review Feedback"
                    />
                  </div>

                  {/* FAR RIGHT: Judge Evaluation */}
                  <div className="space-y-2 h-full">
                    {currentNode === 'judge' ? (
                      <ReviewFeedback
                        feedback={judgeBuffer}
                        isValid={finalIsValid}
                        streaming
                        label="Judge Evaluation"
                      />
                    ) : showJudge ? (
                      <ReviewFeedback
                        feedback={judgeEvaluation}
                        isValid={finalIsValid}
                        label="Judge Evaluation"
                      />
                    ) : (
                      <div className="bg-dark-800 rounded-lg border border-dark-600 flex flex-col h-full">
                        <div className="flex-1 flex items-center justify-center px-4 py-8">
                          <p className="text-gray-500 text-sm italic">Judge evaluation will appear here.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </ResizableColumns>
              </div>
            )}
          </main>
          <LogViewer logs={appLogs} />
        </div>
      </div>
      <StatusBar
        coderModel={coderModel}
        reviewerModel={reviewerModel}
        lastAction={lastAction}
        iterations={totalIterations}
        onHelpClick={() => setShowModal(true)}
      />
      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
