import clsx from 'clsx';

interface SkeletonProps {
  variant?: 'line' | 'card' | 'chart';
  lines?: number;
  className?: string;
}

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'h-4 rounded skeleton-shimmer',
        className,
      )}
    />
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
      <SkeletonLine className="w-2/3 h-5" />
      <SkeletonLine className="w-1/3 h-3" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <SkeletonLine className="w-1/4 h-4 mb-4" />
      <div className="h-[200px] skeleton-shimmer rounded" />
    </div>
  );
}

export default function Skeleton({
  variant = 'line',
  lines = 3,
  className,
}: SkeletonProps) {
  if (variant === 'card') {
    return (
      <div className={clsx('space-y-4', className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (variant === 'chart') {
    return <SkeletonChart />;
  }

  return (
    <div className={clsx('space-y-3', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          className={i === lines - 1 ? 'w-2/3' : 'w-full'}
        />
      ))}
    </div>
  );
}
