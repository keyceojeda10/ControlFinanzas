// components/ui/Skeleton.jsx

export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={['skeleton-shimmer rounded-[10px]', className].join(' ')}
      {...props}
    />
  )
}

export function SkeletonCard() {
  return (
    <div
      className="rounded-[16px] p-5 space-y-3"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-[12px]" />
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
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
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

export function SkeletonPrestamoDetalle() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Skeleton className="h-4 w-20" />
      <div className="rounded-[20px] p-5 space-y-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-14 rounded-[12px]" />
          <Skeleton className="h-14 rounded-[12px]" />
        </div>
      </div>
      <div className="rounded-[16px] p-4 space-y-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <Skeleton className="h-3 w-24" />
        <div className="grid grid-cols-3 gap-2">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-10 rounded-[8px]" />)}
        </div>
      </div>
      <div className="rounded-[16px] p-4 space-y-2" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <Skeleton className="h-3 w-32" />
        {[1,2,3].map(i => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-2.5 w-16" /></div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonRutaDetalle() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-20" />
      <div className="rounded-[20px] p-5 space-y-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between">
          <div className="space-y-1.5"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-20" /></div>
          <Skeleton className="w-14 h-14 rounded-full" />
        </div>
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-24 rounded-[12px] shrink-0" />)}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        {[1,2,3,4,5].map(i => (
          <div key={i} className="rounded-[16px] p-3.5 flex items-center gap-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <Skeleton className="w-7 h-7 rounded-full" />
            <div className="flex-1 space-y-1"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-2.5 w-20" /></div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonClienteList({ count = 6 }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 flex-1 rounded-[12px]" />
        <Skeleton className="h-9 w-9 rounded-[10px]" />
      </div>
      <div className="flex gap-2">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-16 rounded-full" />)}
      </div>
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-[16px] p-3.5 flex items-center gap-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <Skeleton className="w-7 h-7 rounded-full" />
            <div className="flex-1 space-y-1"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-2.5 w-20" /></div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
