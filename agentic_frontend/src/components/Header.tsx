import { useEffect, useState } from 'react';
import { getHealth } from '../api';

export default function Header() {
  const [connected, setConnected] = useState(false);
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const h = await getHealth();
        if (!mounted) return;
        setConnected(true);
        setProjectName(h.project_name);
      } catch {
        if (!mounted) return;
        setConnected(false);
        setProjectName('');
      }
    };
    check();
    const interval = setInterval(check, 10_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="flex items-center justify-between px-5 py-3 bg-dark-800 border-b border-dark-600">
      <div className="flex items-center gap-3">
        <span className="text-xl">🤖</span>
        <h1 className="text-lg font-semibold text-gray-100">Agentic AI Code Assistant</h1>
        {projectName && (
          <span className="text-xs text-gray-400 bg-dark-700 px-2 py-0.5 rounded">{projectName}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${
            connected ? 'bg-green-500 shadow-[0_0_6px_#22c55e]' : 'bg-red-500 shadow-[0_0_6px_#ef4444]'
          }`}
        />
        <span className={`text-xs font-medium ${connected ? 'text-green-400' : 'text-red-400'}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </header>
  );
}
