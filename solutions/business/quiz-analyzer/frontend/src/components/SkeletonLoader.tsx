export function SkeletonLoader({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse ${className}`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
      <SkeletonLoader className="h-5 w-2/3" />
      <SkeletonLoader className="h-4 w-full" />
      <SkeletonLoader className="h-4 w-4/5" />
      <SkeletonLoader className="h-4 w-3/5" />
    </div>
  );
}
