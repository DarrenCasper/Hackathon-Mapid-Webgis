export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

export function RecommendationCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex gap-3">
        <Skeleton className="h-16 w-16 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}
