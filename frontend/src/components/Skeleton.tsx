// Legacy skeleton placeholders — kept in place and API-compatible for the
// ~6 admin/storefront files that already import from here (POD-UI.md §A6:
// "upgrade it in place ... keep its current API additive"). Visuals are
// reskinned onto the new tokens (shimmer animation, surface-2 base) but no
// export was renamed or removed. For new code, prefer the richer
// `components/ui/Skeleton.tsx` primitive (text/rect/circle shapes).
interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer rounded bg-surface-2 bg-[length:200%_100%] bg-gradient-to-r from-surface-2 via-line to-surface-2 ${className}`}
    />
  )
}

interface SkeletonTableProps {
  rows?: number
  cols?: number
}

export function SkeletonTable({ rows = 5, cols = 4 }: SkeletonTableProps) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex gap-4 border-b border-line bg-surface-2 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 border-b border-line px-4 py-3 last:border-0">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton
              key={colIdx}
              className={`h-4 flex-1${colIdx === 0 ? ' max-w-[120px]' : ''}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

interface SkeletonCardsProps {
  count?: number
}

export function SkeletonCards({ count = 4 }: SkeletonCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-card border border-line bg-surface p-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

interface SkeletonStatCardsProps {
  count?: number
}

export function SkeletonStatCards({ count = 4 }: SkeletonStatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-card border border-line bg-surface p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  )
}
