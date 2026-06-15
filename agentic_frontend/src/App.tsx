import { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import ModelSelector from './components/ModelSelector';
import TaskPanel from './components/TaskPanel';
import CodeDisplay from './components/CodeDisplay';
import ReviewFeedback from './components/ReviewFeedback';
import LogViewer from './components/LogViewer';
import RagPanel from './components/RagPanel';
import StatusBar from './components/StatusBar';
import Toast from './components/Toast';
import WelcomeModal from './components/WelcomeModal';
import type { GenerateResponse, ToastMessage } from './types';

export default function App() {
  const [coderModel, setCoderModel] = useState('');
  const [reviewerModel, setReviewerModel] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState('python');
  const [lastAction, setLastAction] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('welcomeModalDismissed');
    if (!dismissed) {
      setShowModal(true);
    }
  }, []);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleResult = useCallback((res: GenerateResponse) => {
    setResult(res);
    setLastAction('Code generation completed');
  }, []);

  const handleGenerating = useCallback((v: boolean) => {
    setGenerating(v);
    setLastAction(v ? 'Generating code...' : 'Idle');
  }, []);

  return (
    <div className="h-screen flex flex-col">
      <WelcomeModal
        show={showModal}
        onClose={() => setShowModal(false)}
        onDontShowAgain={() => setShowModal(false)}
      />
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 flex-shrink-0 overflow-y-auto border-r border-dark-600 bg-dark-900 p-3 space-y-3">
          <ModelSelector
            coderModel={coderModel}
            reviewerModel={reviewerModel}
            onCoderChange={setCoderModel}
            onReviewerChange={setReviewerModel}
            addToast={addToast}
          />
          <RagPanel addToast={addToast} />
        </aside>
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto p-4 space-y-4">
            <TaskPanel
              coderModel={coderModel}
              reviewerModel={reviewerModel}
              onResult={handleResult}
              setLoading={handleGenerating}
              addToast={addToast}
              loading={generating}
              onLanguageChange={setCurrentLanguage}
            />
            {result && (
              <>
                <CodeDisplay code={result.draft_code} language={currentLanguage} />
                <ReviewFeedback feedback={result.review_feedback} isValid={result.is_valid} />
              </>
            )}
          </main>
          <LogViewer logs={result?.logs ?? []} />
        </div>
      </div>
      <StatusBar
        coderModel={coderModel}
        reviewerModel={reviewerModel}
        lastAction={lastAction}
        iterations={result?.iterations ?? 0}
        onHelpClick={() => setShowModal(true)}
      />
      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
