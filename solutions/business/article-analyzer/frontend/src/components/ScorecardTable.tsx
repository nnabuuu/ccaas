import { useState, useMemo } from 'react';
import type { IterationResponse } from '../api';
import Card from './ui/Card';
import { formatTokens, formatDuration, formatScore } from '../utils/formatters';
import { scoreColor } from '../utils/colors';

interface ScorecardTableProps {
  iterations: IterationResponse[];
}

type SortKey = 'iteration' | 'score' | 'tokensUsed' | 'durationMs' | 'createdAt';
type SortDir = 'asc' | 'desc';

export default function ScorecardTable({ iterations }: ScorecardTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('iteration');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    const arr = [...iterations];
    arr.sort((a, b) => {
      let av: number;
      let bv: number;
      switch (sortKey) {
        case 'score':
          av = a.score ?? -1;
          bv = b.score ?? -1;
          break;
        case 'tokensUsed':
          av = a.tokensUsed;
          bv = b.tokensUsed;
          break;
        case 'durationMs':
          av = a.durationMs;
          bv = b.durationMs;
          break;
        case 'createdAt':
          av = new Date(a.createdAt).getTime();
          bv = new Date(b.createdAt).getTime();
          break;
        default:
          av = a.iteration;
          bv = b.iteration;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return arr;
  }, [iterations, sortKey, sortDir]);

  if (iterations.length === 0) {
    return (
      <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-4">
        No iterations yet
      </p>
    );
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return (
      <span className="ml-1 text-primary-500">
        {sortDir === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  const thClass =
    'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 transition-colors';

  return (
    <Card padding="sm" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className={thClass} onClick={() => handleSort('iteration')}>
                #{sortIndicator('iteration')}
              </th>
              <th className={thClass} onClick={() => handleSort('score')}>
                Score{sortIndicator('score')}
              </th>
              <th className={thClass} onClick={() => handleSort('tokensUsed')}>
                Tokens{sortIndicator('tokensUsed')}
              </th>
              <th className={thClass} onClick={() => handleSort('durationMs')}>
                Duration{sortIndicator('durationMs')}
              </th>
              <th className={thClass} onClick={() => handleSort('createdAt')}>
                Time{sortIndicator('createdAt')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((iter) => (
              <tr
                key={iter.id}
                className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                  {iter.iteration}
                </td>
                <td className={`px-4 py-2.5 font-medium ${scoreColor(iter.score)}`}>
                  {formatScore(iter.score)}
                </td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                  {formatTokens(iter.tokensUsed)}
                </td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                  {formatDuration(iter.durationMs)}
                </td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                  {new Date(iter.createdAt).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
