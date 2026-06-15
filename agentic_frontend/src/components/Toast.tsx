import { useEffect } from 'react';
import type { ToastMessage } from '../types';

interface Props {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

const iconMap = {
  success: '✓',
  error: '✗',
  info: 'ℹ',
};

const colorMap = {
  success: 'border-green-500 bg-green-900/80 text-green-200',
  error: 'border-red-500 bg-red-900/80 text-red-200',
  info: 'border-blue-500 bg-blue-900/80 text-blue-200',
};

export default function Toast({ toasts, removeToast }: Props) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDone={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDone }: { toast: ToastMessage; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 4000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className={`flex items-start gap-2 px-4 py-3 rounded border shadow-lg backdrop-blur-sm animate-slide-up ${colorMap[toast.type]}`}
    >
      <span className="font-bold text-sm leading-5">{iconMap[toast.type]}</span>
      <span className="text-sm leading-5 flex-1">{toast.message}</span>
      <button onClick={onDone} className="text-current opacity-60 hover:opacity-100 text-sm leading-5 ml-2">
        ×
      </button>
    </div>
  );
}
