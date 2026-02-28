// components/ui/Skeleton.jsx

export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={['animate-pulse rounded-[6px] bg-[#2a3245]', className].join(' ')}
      {...props}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-[#1c2333] border border-[#2a3245] rounded-[14px] p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-[10px]" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#2a3245]">
      <Skeleton className="w-8 h-8 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
}
