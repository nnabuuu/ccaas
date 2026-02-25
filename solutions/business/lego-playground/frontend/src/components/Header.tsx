import React from 'react';
import { Plus } from '@phosphor-icons/react';
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
    idle: 'bg-zinc-400',
    analyzing: 'bg-blue-500 animate-pulse',
    generating: 'bg-yellow-500 animate-pulse',
    assessing: 'bg-purple-500 animate-pulse',
    complete: 'bg-green-500',
    error: 'bg-red-500',
  };

  return (
    <header className="h-12 flex items-center px-4 bg-white border-b border-zinc-200 shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-lego-red rounded flex items-center justify-center">
          <span className="text-white text-xs font-bold">L</span>
        </div>
        <h1 className="text-sm font-semibold text-zinc-800">LEGO Playground</h1>
      </div>

      <div className="flex-1 flex items-center justify-center gap-4 text-xs text-zinc-500">
        {sessionId && (
          <span className="px-2 py-0.5 bg-zinc-100 rounded font-mono">
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
            <span className={`w-2 h-2 rounded-full ${statusColors[status.phase] || 'bg-zinc-400'}`} />
            {status.message || status.phase}
          </span>
        )}
      </div>

      <button
        onClick={onNewSession}
        className="text-xs px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 rounded text-zinc-700 transition-colors inline-flex items-center gap-1"
      >
        <Plus size={14} weight="regular" />
        New
      </button>
    </header>
  );
}
