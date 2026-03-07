'use client'
// app/(dashboard)/cobradores/page.jsx - Lista de cobradores

import { useState, useEffect } from 'react'
import Link                    from 'next/link'
import { useAuth }             from '@/hooks/useAuth'
import { Badge }               from '@/components/ui/Badge'
import { Button }              from '@/components/ui/Button'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'

export default function CobradoresPage() {
  const { session, esOwner, loading: authLoading } = useAuth()
  const [cobradores, setCobradores] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [toggling,   setToggling]   = useState(null)

  const plan = session?.user?.plan ?? 'basic'

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

  // Plan basic — bloquear
  if (!authLoading && plan === 'basic') {
    return (
      <div className="max-w-xl mx-auto">
        <h1 className="text-xl font-bold text-[white] mb-6">Cobradores</h1>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-[rgba(245,158,11,0.12)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#f59e0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-base font-bold text-[white] mb-2">Función de plan premium</p>
          <p className="text-sm text-[#888888] mb-5">
            Actualiza tu plan para agregar cobradores y gestionar rutas de cobro.
          </p>
          <div className="inline-flex flex-col gap-2 text-xs text-[#888888]">
            <span>✓ Standard: hasta 2 cobradores</span>
            <span>✓ Professional: cobradores ilimitados</span>
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
          <p className="text-sm text-[#888888] mt-0.5">
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
        <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3 mb-4">
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
          <div className="w-14 h-14 rounded-full bg-[rgba(59,130,246,0.1)] flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[white]">Sin cobradores aún</p>
          <p className="text-xs text-[#888888] mt-1">Crea el primer cobrador para asignarle una ruta</p>
          <Link href="/cobradores/nuevo" className="mt-4">
            <Button size="sm">Crear cobrador</Button>
          </Link>
        </div>
      )}

      {!loading && cobradores.length > 0 && (
        <div className="space-y-3">
          {cobradores.map((c) => (
            <Link
              key={c.id}
              href={`/cobradores/${c.id}`}
              className="block bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] p-4 hover:border-[#3a3a3a] hover:bg-[#1e1e1e] transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[rgba(139,92,246,0.15)] flex items-center justify-center shrink-0">
                    <span className="text-[#a855f7] font-bold text-sm">{c.nombre?.[0]?.toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[white]">{c.nombre}</p>
                    <p className="text-xs text-[#888888]">{c.email}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); toggleCobrador(c) }}
                  disabled={toggling === c.id}
                  className="shrink-0"
                  title={c.activo ? 'Desactivar cobrador' : 'Activar cobrador'}
                >
                  <Badge variant={c.activo ? 'green' : 'gray'}>{c.activo ? 'Activo' : 'Inactivo'}</Badge>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#2a2a2a] text-center">
                <div>
                  <p className="text-[10px] text-[#888888]">Ruta</p>
                  <p className="text-xs font-medium text-[white] truncate">
                    {c.ruta?.nombre ?? <span className="text-[#888888]">Sin ruta</span>}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#888888]">Clientes</p>
                  <p className="text-xs font-bold text-[white]">{c.cantidadClientes}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#888888]">Recaudado hoy</p>
                  <p className="text-xs font-bold text-[#22c55e]">{formatCOP(c.recaudadoHoy)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
