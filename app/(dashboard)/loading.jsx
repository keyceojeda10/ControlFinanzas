// app/(dashboard)/loading.jsx - Skeleton de carga entre páginas del dashboard

export default function DashboardLoading() {
  return (
    <div className="max-w-3xl lg:max-w-6xl mx-auto space-y-4" role="status" aria-live="polite">
      {/* Header skeleton */}
      <div className="h-7 w-40 bg-[var(--cf-border)] rounded-[12px]" />

      {/* Cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 border border-[var(--cf-border)] rounded-[20px]" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--cf-gold) 2%, transparent) 0%, var(--cf-card) 50%, var(--cf-surface) 100%)' }} />
        ))}
      </div>

      {/* Main card */}
      <div className="h-48 border border-[var(--cf-border)] rounded-[20px]" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--cf-gold) 2%, transparent) 0%, var(--cf-card) 50%, var(--cf-surface) 100%)' }} />

      {/* Secondary card */}
      <div className="h-32 border border-[var(--cf-border)] rounded-[20px]" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--cf-gold) 2%, transparent) 0%, var(--cf-card) 50%, var(--cf-surface) 100%)' }} />
    </div>
  )
}
