import React from 'react';
import type { GenerationStatus } from '../types';

interface HeaderProps {
  sessionId: string | null;
  currentIteration: number;
  maxIterations: number;
  status: GenerationStatus;
  onNewSession: () => void;
}

export default function Header({
  sessionId,
  currentIteration,
  maxIterations,
  status,
  onNewSession,
}: HeaderProps) {
  const statusColors: Record<string, string> = {
    idle: 'bg-gray-400',
    analyzing: 'bg-blue-500 animate-pulse',
    generating: 'bg-yellow-500 animate-pulse',
    assessing: 'bg-purple-500 animate-pulse',
    complete: 'bg-green-500',
    error: 'bg-red-500',
  };

  return (
    <header className="h-12 flex items-center px-4 bg-white border-b border-gray-200 shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-lego-red rounded flex items-center justify-center">
          <span className="text-white text-xs font-bold">L</span>
        </div>
        <h1 className="text-sm font-semibold text-gray-800">LEGO Playground</h1>
      </div>

      <div className="flex-1 flex items-center justify-center gap-4 text-xs text-gray-500">
        {sessionId && (
          <span className="px-2 py-0.5 bg-gray-100 rounded font-mono">
            {sessionId.slice(0, 12)}
          </span>
        )}
        {currentIteration > 0 && (
          <span>
            Iter {currentIteration}/{maxIterations}
          </span>
        )}
        {status.phase !== 'idle' && (
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${statusColors[status.phase] || 'bg-gray-400'}`} />
            {status.message || status.phase}
          </span>
        )}
      </div>

      <button
        onClick={onNewSession}
        className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
      >
        New
      </button>
    </header>
  );
}
