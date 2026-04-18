// app/(dashboard)/loading.jsx - Skeleton de carga entre páginas del dashboard

export default function DashboardLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-4" role="status" aria-live="polite">
      {/* Header skeleton */}
      <div className="h-7 w-40 bg-[#2a2a2a] rounded-[10px]" />

      {/* Cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 border border-[#2a2a2a] rounded-[16px]" style={{ background: 'linear-gradient(135deg, #f5c51805 0%, var(--color-bg-card) 50%, #1a1a1a 100%)' }} />
        ))}
      </div>

      {/* Main card */}
      <div className="h-48 border border-[#2a2a2a] rounded-[16px]" style={{ background: 'linear-gradient(135deg, #f5c51805 0%, var(--color-bg-card) 50%, #1a1a1a 100%)' }} />

      {/* Secondary card */}
      <div className="h-32 border border-[#2a2a2a] rounded-[16px]" style={{ background: 'linear-gradient(135deg, #f5c51805 0%, var(--color-bg-card) 50%, #1a1a1a 100%)' }} />
    </div>
  )
}
