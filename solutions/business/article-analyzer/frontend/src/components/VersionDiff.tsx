import { useState, useMemo } from 'react';
import type { IterationResponse } from '../api';
import Card from './ui/Card';
import { wordDiff, type DiffSegment } from '../utils/diff';

interface VersionDiffProps {
  iterations: IterationResponse[];
}

function DiffDisplay({ segments }: { segments: DiffSegment[] }) {
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
      {segments.map((seg, i) => {
        switch (seg.type) {
          case 'added':
            return (
              <span
                key={i}
                className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
              >
                {seg.text}
              </span>
            );
          case 'removed':
            return (
              <span
                key={i}
                className="bg-red-100 text-red-800 line-through dark:bg-red-900/40 dark:text-red-300"
              >
                {seg.text}
              </span>
            );
          default:
            return (
              <span key={i} className="text-slate-700 dark:text-slate-300">
                {seg.text}
              </span>
            );
        }
      })}
    </div>
  );
}

export default function VersionDiff({ iterations }: VersionDiffProps) {
  const withText = iterations.filter((i) => i.articleText);
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(
    Math.min(1, withText.length - 1),
  );

  if (withText.length < 2) {
    return (
      <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-4">
        Need at least 2 versions for diff
      </p>
    );
  }

  const leftText = withText[leftIdx]?.articleText || '';
  const rightText = withText[rightIdx]?.articleText || '';
  const diffSegments = useMemo(
    () => wordDiff(leftText, rightText),
    [leftText, rightText],
  );

  return (
    <Card padding="md">
      <div className="flex items-center gap-4 mb-3">
        <select
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          value={leftIdx}
          onChange={(e) => setLeftIdx(Number(e.target.value))}
        >
          {withText.map((iter, i) => (
            <option key={iter.id} value={i}>
              Iteration {iter.iteration}
            </option>
          ))}
        </select>
        <span className="text-slate-400 dark:text-slate-500 text-sm">vs</span>
        <select
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          value={rightIdx}
          onChange={(e) => setRightIdx(Number(e.target.value))}
        >
          {withText.map((iter, i) => (
            <option key={iter.id} value={i}>
              Iteration {iter.iteration}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: original text */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Iteration {withText[leftIdx]?.iteration}
          </p>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto text-slate-700 dark:text-slate-300">
            {leftText}
          </div>
        </div>

        {/* Right: diff view */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Iteration {withText[rightIdx]?.iteration}{' '}
            <span className="text-slate-400 dark:text-slate-500 normal-case font-normal">(diff)</span>
          </p>
          <DiffDisplay segments={diffSegments} />
        </div>
      </div>
    </Card>
  );
}
