interface ProgressBarProps {
  current: number;
  max: number;
  status?: 'running' | 'completed' | 'failed';
}

export default function ProgressBar({ current, max, status = 'running' }: ProgressBarProps) {
  const isDone = status === 'completed' || status === 'failed';

  if (max > 20) {
    const pct = Math.min((current / max) * 100, 100);
    return (
      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-primary-600 dark:bg-primary-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  }

  const segments = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <div className="flex items-center gap-0.5">
      {segments.map((seg) => (
        <div
          key={seg}
          className={`h-2 flex-1 rounded-full transition-colors ${
            seg <= current
              ? isDone
                ? 'bg-primary-600 dark:bg-primary-500'
                : seg === current
                  ? 'bg-primary-500 dark:bg-primary-400 animate-pulse'
                  : 'bg-primary-600 dark:bg-primary-500'
              : 'bg-slate-200 dark:bg-slate-700'
          }`}
        />
      ))}
    </div>
  );
}
