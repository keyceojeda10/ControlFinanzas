'use client'
// app/(dashboard)/cobradores/page.jsx - Lista de cobradores

import { useState, useEffect } from 'react'
import Link                    from 'next/link'
import { useAuth }             from '@/hooks/useAuth'
import { Badge }               from '@/components/ui/Badge'
import { Button }              from '@/components/ui/Button'
import { Card }                from '@/components/ui/Card'
import CobradorCard            from '@/components/cobradores/CobradorCard'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'
import { useOnline }           from '@/hooks/useOnline'
import OfflineFallback         from '@/components/offline/OfflineFallback'

export default function CobradoresPage() {
  const online = useOnline()
  if (!online) return <OfflineFallback titulo="La gestion de cobradores requiere conexion" />
  return <CobradoresPageInner />
}

function CobradoresPageInner() {
  const { session, esOwner, loading: authLoading } = useAuth()
  const [cobradores, setCobradores] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [toggling,   setToggling]   = useState(null)

  const plan = session?.user?.plan ?? 'starter'

  const toggleCobrador = async (cobrador) => {
    setToggling(cobrador.id)
    try {
      const res = await fetch(`/api/cobradores/${cobrador.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !cobrador.activo }),
      })
      if (!res.ok) throw new Error()
      setCobradores((prev) =>
        prev.map((c) => c.id === cobrador.id ? { ...c, activo: !c.activo } : c)
      )
    } catch {
      setError('No se pudo cambiar el estado del cobrador.')
    } finally {
      setToggling(null)
    }
  }

  useEffect(() => {
    if (authLoading || !esOwner) { setLoading(false); return }
    fetch('/api/cobradores')
      .then((r) => r.json())
      .then((d) => setCobradores(Array.isArray(d) ? d : []))
      .catch(() => setError('No se pudieron cargar los cobradores.'))
      .finally(() => setLoading(false))
  }, [authLoading, esOwner])

  // Planes de entrada — bloquear
  if (!authLoading && ['starter', 'basic'].includes(plan)) {
    return (
      <div className="max-w-xl mx-auto">
        <h1 className="text-xl font-bold text-[white] mb-6">Cobradores</h1>
        <div
          className="border border-[var(--color-border)] rounded-[16px] p-8 text-center"
          style={{
            background: 'linear-gradient(135deg, #f59e0b0A 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, #f59e0b05 100%)',
            boxShadow: '0 0 30px #f59e0b08, 0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          <div className="w-14 h-14 rounded-full bg-[rgba(245,158,11,0.12)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[var(--color-warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-base font-bold text-[white] mb-2">Función de plan premium</p>
          <p className="text-sm text-[var(--color-text-muted)] mb-5">
            Actualiza tu plan para agregar cobradores y gestionar rutas de cobro.
          </p>
          <div className="inline-flex flex-col gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-[var(--color-success)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> Crecimiento: hasta 2 usuarios</span>
            <span className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-[var(--color-success)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> Profesional: hasta 5 usuarios</span>
            <span className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-[var(--color-success)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> Empresarial: hasta 10 usuarios</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[white]">Cobradores</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {loading ? '…' : `${cobradores.length} cobrador${cobradores.length !== 1 ? 'es' : ''}`}
          </p>
        </div>
        {!authLoading && esOwner && (
          <Link href="/cobradores/nuevo">
            <Button
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Nuevo cobrador
            </Button>
          </Link>
        )}
      </div>

      {error && (
        <div className="bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[12px] px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!loading && cobradores.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-[rgba(245,197,24,0.1)] flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[white]">Sin cobradores aún</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Crea el primer cobrador para asignarle una ruta</p>
          <Link href="/cobradores/nuevo" className="mt-4">
            <Button size="sm">Crear cobrador</Button>
          </Link>
        </div>
      )}

      {!loading && cobradores.length > 0 && (
        <div className="space-y-3">
          {cobradores.map((c) => (
            <CobradorCard
              key={c.id}
              cobrador={c}
              onToggleActivo={toggleCobrador}
              toggling={toggling === c.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
