export function SkeletonLoader({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-ck bg-ck-bg2 animate-pulse ${className}`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="p-4 rounded-ck-lg border border-ck-b2 space-y-3">
      <SkeletonLoader className="h-5 w-2/3" />
      <SkeletonLoader className="h-4 w-full" />
      <SkeletonLoader className="h-4 w-4/5" />
      <SkeletonLoader className="h-4 w-3/5" />
    </div>
  );
}
