'use client'
// app/(dashboard)/prestamos/page.jsx - Lista de préstamos

import { useState, useEffect, useCallback } from 'react'
import Link                                   from 'next/link'
import { useAuth }                            from '@/hooks/useAuth'
import { Button }                             from '@/components/ui/Button'
import { SkeletonCard }                       from '@/components/ui/Skeleton'
import PrestamoCard                           from '@/components/prestamos/PrestamoCard'

const ESTADOS = [
  { value: '',           label: 'Todos'     },
  { value: 'activo',     label: 'Activos'   },
  { value: 'mora',       label: 'En mora',  color: '#ef4444' },
  { value: 'completado', label: 'Completados' },
  { value: 'cancelado',  label: 'Cancelados' },
]

export default function PrestamosPage() {
  const { esOwner, loading: authLoading } = useAuth()
  const [prestamos, setPrestamos] = useState([])
  const [buscar,    setBuscar]    = useState('')
  const [estado,    setEstado]    = useState('activo')
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  const fetchPrestamos = useCallback(async (q, est) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (q) params.set('buscar', q)
      // "mora" no es un estado en BD — pedimos activos y filtramos client-side
      const apiEstado = est === 'mora' ? 'activo' : est
      if (apiEstado) params.set('estado', apiEstado)
      const res = await fetch(`/api/prestamos?${params}`)
      if (!res.ok) throw new Error()
      let data = await res.json()
      if (est === 'mora') data = data.filter((p) => p.diasMora > 0)
      setPrestamos(data)
    } catch {
      setError('No se pudieron cargar los préstamos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPrestamos('', estado) }, [fetchPrestamos, estado])

  useEffect(() => {
    const t = setTimeout(() => fetchPrestamos(buscar, estado), 300)
    return () => clearTimeout(t)
  }, [buscar, estado, fetchPrestamos])

  const enMoraCount = prestamos.filter((p) => p.diasMora > 0).length

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[white]">Préstamos</h1>
          <p className="text-sm text-[#888888] mt-0.5">
            {loading ? '…' : `${prestamos.length} préstamo${prestamos.length !== 1 ? 's' : ''}`}
            {enMoraCount > 0 && (
              <span className="ml-2 text-[#ef4444]">· {enMoraCount} en mora</span>
            )}
          </p>
        </div>
        {!authLoading && esOwner && (
          <Link href="/prestamos/nuevo">
            <Button
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Nuevo préstamo
            </Button>
          </Link>
        )}
      </div>

      {/* Filtro de estado */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none pb-1">
        {ESTADOS.map(({ value, label, color }) => {
          const isActive = estado === value
          const accent = color ?? '#3b82f6'
          return (
            <button
              key={value}
              onClick={() => setEstado(value)}
              className={[
                'shrink-0 px-3 h-8 rounded-full text-xs font-medium border transition-all',
                isActive
                  ? 'border-current'
                  : 'bg-transparent border-[#2a2a2a] text-[#888888] hover:bg-[#222222] hover:text-[white]',
              ].join(' ')}
              style={isActive ? { color: accent, backgroundColor: `${accent}20` } : undefined}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Buscador */}
      <div className="relative mb-5">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888888] pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar por nombre o cédula del cliente…"
          className="w-full h-10 pl-9 pr-4 rounded-[12px] border border-[#2a2a2a] bg-[#1a1a1a] text-sm text-[white] placeholder-[#777777] focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[rgba(59,130,246,0.3)] transition-all"
        />
        {buscar && (
          <button
            onClick={() => setBuscar('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[white]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Lista */}
      {!loading && prestamos.length > 0 && (
        <div className="space-y-2.5">
          {prestamos.map((p) => <PrestamoCard key={p.id} prestamo={p} />)}
        </div>
      )}

      {/* Estado vacío */}
      {!loading && !error && prestamos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-[rgba(59,130,246,0.1)] flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          {buscar ? (
            <>
              <p className="text-sm font-medium text-[white]">Sin resultados</p>
              <p className="text-xs text-[#888888] mt-1">No hay préstamos para "{buscar}"</p>
              <button onClick={() => setBuscar('')} className="mt-3 text-xs text-[#3b82f6] hover:underline">
                Limpiar búsqueda
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-[white]">
                {estado === 'activo' ? 'No hay préstamos activos' : estado === 'mora' ? 'No hay préstamos en mora' : 'Sin préstamos'}
              </p>
              <p className="text-xs text-[#888888] mt-1">
                {estado !== '' && (
                  <button onClick={() => setEstado('')} className="text-[#3b82f6] hover:underline">
                    Ver todos los estados
                  </button>
                )}
              </p>
              {!authLoading && esOwner && (
                <Link href="/prestamos/nuevo" className="mt-4">
                  <Button size="sm">Crear préstamo</Button>
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
