export function scoreColor(score: number | null): string {
  if (score == null) return 'text-slate-500 dark:text-slate-400';
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

export function barColor(score: number): string {
  if (score >= 80) return 'bg-green-500 dark:bg-green-400';
  if (score >= 60) return 'bg-yellow-500 dark:bg-yellow-400';
  return 'bg-red-500 dark:bg-red-400';
}
