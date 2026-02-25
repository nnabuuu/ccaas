import React from 'react';
import { useMosaicStore } from '../../hooks/useStore';
import { scoreToPercent, scoreColor } from '../../utils/colors';

export default function IterationTimeline() {
  const iterationHistory = useMosaicStore((s) => s.iterationHistory);
  const currentIteration = useMosaicStore((s) => s.currentIteration);

  if (iterationHistory.length === 0) return null;

  return (
    <div className="h-16 flex items-center px-4 gap-3 bg-white border-t border-zinc-200 shrink-0 overflow-x-auto">
      {iterationHistory.map((iter) => {
        const isCurrent = iter.iterationNumber === currentIteration;
        const percent = scoreToPercent(iter.overallScore);
        const color = scoreColor(iter.overallScore);

        const decisionIcon: Record<string, string> = {
          approve: '\u2713',
          reject: '\u2717',
          refine: '\u21BB',
          pending: '\u2026',
        };

        return (
          <div
            key={iter.iterationNumber}
            className={`flex flex-col items-center shrink-0 cursor-pointer transition-transform ${
              isCurrent ? 'scale-110' : 'opacity-60 hover:opacity-80'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xs font-bold ${
                isCurrent ? 'border-blue-500 shadow-md' : 'border-zinc-200'
              }`}
              style={{ backgroundColor: `${color}20`, color }}
            >
              {percent}%
            </div>
            <div className="flex items-center gap-0.5 mt-0.5">
              <span className="text-[9px] text-zinc-400">#{iter.iterationNumber}</span>
              <span className="text-[10px]">{decisionIcon[iter.decision] || ''}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
