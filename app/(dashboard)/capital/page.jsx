'use client'
import CapitalTab from '@/components/capital/CapitalTab'
import { useAuth } from '@/hooks/useAuth'

export default function CapitalPage() {
  const { esOwner, loading: authLoading } = useAuth()

  if (authLoading) return null
  if (!esOwner) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center">
        <p className="text-[var(--color-text-muted)]">No tienes acceso a esta seccion.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Mi fondo</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Tu fondo de préstamos — dinero disponible para prestar</p>
      </div>
      {/* Banner explicativo */}
      <div className="mb-4 rounded-[12px] px-3.5 py-2.5 flex items-start gap-2.5" style={{ background: 'color-mix(in srgb, #06b6d4 8%, var(--color-bg-card))', border: '1px solid color-mix(in srgb, #06b6d4 20%, var(--color-border))' }}>
        <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: '#06b6d4' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
        </svg>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          Este es tu fondo de préstamos — el dinero que pusiste en el negocio. Agrega dinero cuando metes más plata, retira cuando sacas. El saldo disponible refleja lo que puedes prestar ahora mismo.
        </p>
      </div>
      <CapitalTab />
    </div>
  )
}
