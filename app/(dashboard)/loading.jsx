// app/(dashboard)/loading.jsx - Skeleton de carga entre páginas del dashboard

export default function DashboardLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
      {/* Header skeleton */}
      <div className="h-7 w-40 bg-[#2a2a2a] rounded-[10px]" />

      {/* Cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px]" />
        ))}
      </div>

      {/* Main card */}
      <div className="h-48 bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px]" />

      {/* Secondary card */}
      <div className="h-32 bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px]" />
    </div>
  )
}
