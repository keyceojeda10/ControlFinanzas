'use client'
// app/(dashboard)/prestamos/page.jsx - Lista de préstamos

import { useState, useEffect, useCallback, useRef } from 'react'
import Link                                   from 'next/link'
import { useAuth }                            from '@/hooks/useAuth'
import { useOffline }                         from '@/components/providers/OfflineProvider'
import { guardarEnCache, leerDeCache, obtenerPrestamosOffline } from '@/lib/offline'
import { Button }                             from '@/components/ui/Button'
import { SkeletonCard }                       from '@/components/ui/Skeleton'
import PrestamoCard                           from '@/components/prestamos/PrestamoCard'
import Mascota                                from '@/components/ui/Mascota'

const ESTADOS = [
  { value: '',           label: 'Todos'     },
  { value: 'activo',     label: 'Activos'   },
  { value: 'mora',       label: 'En mora',  color: 'var(--color-danger)' },
  { value: 'completado', label: 'Completados' },
  { value: 'cancelado',  label: 'Cancelados' },
]

const LIMIT = 50

export default function PrestamosPage() {
  const { esOwner, puedeCrearPrestamos, loading: authLoading } = useAuth()
  const { lastSyncedAt } = useOffline()
  const [prestamos, setPrestamos] = useState([])
  const [buscar,    setBuscar]    = useState('')
  const [estado,    setEstado]    = useState('activo')
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [page,      setPage]      = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total,     setTotal]     = useState(0)

  const [isOffline, setIsOffline] = useState(false)
  const hasLoadedOnceRef = useRef(false)

  const fetchPrestamos = useCallback(async (q, est, p, { soft = false } = {}) => {
    const shouldUseSoftRefresh = soft && hasLoadedOnceRef.current
    if (!shouldUseSoftRefresh) setLoading(true)
    setError('')
    setIsOffline(false)
    const cacheKey = `prestamos:${q || ''}:${est || ''}:${p}`

    // Offline: go straight to IndexedDB (skip SW cache which may be stale)
    if (!navigator.onLine) {
      try {
        let cached = await leerDeCache(cacheKey)
        if (!cached) {
          const allPrestamos = await obtenerPrestamosOffline()
          if (allPrestamos.length > 0) {
            let filtered = allPrestamos
            const apiEstado = est === 'mora' ? 'activo' : est
            if (apiEstado) filtered = filtered.filter(pr => pr.estado === apiEstado)
            if (est === 'mora') filtered = filtered.filter(pr => pr.diasMora > 0)
            if (q) {
              const ql = q.toLowerCase()
              filtered = filtered.filter(pr => pr.cliente?.nombre?.toLowerCase().includes(ql) || pr.cliente?.cedula?.includes(ql))
            }
            const start = (p - 1) * LIMIT
            cached = { prestamos: filtered.slice(start, start + LIMIT), total: filtered.length, totalPages: Math.ceil(filtered.length / LIMIT) }
          }
        }
        if (cached) {
          setPrestamos(cached.prestamos); setTotal(cached.total); setTotalPages(cached.totalPages)
          setIsOffline(true); setLoading(false); hasLoadedOnceRef.current = true; return
        }
      } catch {}
    }

    try {
      const params = new URLSearchParams()
      if (q) params.set('buscar', q)
      // "mora" no es un estado en BD — pedimos activos y filtramos client-side
      const apiEstado = est === 'mora' ? 'activo' : est
      if (apiEstado) params.set('estado', apiEstado)
      params.set('page', String(p))
      params.set('limit', String(LIMIT))
      const res = await fetch(`/api/prestamos?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.offline) throw new Error('offline')
      let items = data.prestamos
      if (est === 'mora') items = items.filter((pr) => pr.diasMora > 0)
      setPrestamos(items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      guardarEnCache(cacheKey, { prestamos: items, total: data.total, totalPages: data.totalPages }).catch(() => {})
    } catch {
      try {
        let cached = await leerDeCache(cacheKey)
        if (!cached) {
          const allPrestamos = await obtenerPrestamosOffline()
          if (allPrestamos.length > 0) {
            let filtered = allPrestamos
            const apiEstado = est === 'mora' ? 'activo' : est
            if (apiEstado) filtered = filtered.filter(pr => pr.estado === apiEstado)
            if (est === 'mora') filtered = filtered.filter(pr => pr.diasMora > 0)
            if (q) {
              const ql = q.toLowerCase()
              filtered = filtered.filter(pr => pr.cliente?.nombre?.toLowerCase().includes(ql) || pr.cliente?.cedula?.includes(ql))
            }
            const start = (p - 1) * LIMIT
            cached = { prestamos: filtered.slice(start, start + LIMIT), total: filtered.length, totalPages: Math.ceil(filtered.length / LIMIT) }
          }
        }
        if (cached) {
          setPrestamos(cached.prestamos)
          setTotal(cached.total)
          setTotalPages(cached.totalPages)
          setIsOffline(true)
          setLoading(false)
          hasLoadedOnceRef.current = true
          return
        }
      } catch {}
      setError('No se pudieron cargar los préstamos.')
    } finally {
      setLoading(false)
      hasLoadedOnceRef.current = true
    }
  }, [])

  useEffect(() => { setPage(1); fetchPrestamos('', estado, 1) }, [fetchPrestamos, estado])

  useEffect(() => {
    setPage(1)
    const t = setTimeout(() => fetchPrestamos(buscar, estado, 1), 300)
    return () => clearTimeout(t)
  }, [buscar, estado, fetchPrestamos])

  // Cambio de página
  useEffect(() => {
    if (page > 1) fetchPrestamos(buscar, estado, page)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh silencioso cuando llega nueva sincronización global.
  useEffect(() => {
    if (!lastSyncedAt) return
    fetchPrestamos(buscar, estado, page, { soft: true })
  }, [lastSyncedAt, fetchPrestamos, buscar, estado, page])

  const enMoraCount = prestamos.filter((p) => p.diasMora > 0).length

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[white]">Préstamos</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {loading ? '…' : `${total} préstamo${total !== 1 ? 's' : ''}`}
            {enMoraCount > 0 && (
              <span className="ml-2 text-[var(--color-danger)]">· {enMoraCount} en mora</span>
            )}
          </p>
        </div>
        {!authLoading && puedeCrearPrestamos && (
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
          const accent = color ?? 'var(--color-accent)'
          return (
            <button
              key={value}
              onClick={() => setEstado(value)}
              className={[
                'shrink-0 px-3 h-8 rounded-full text-xs font-medium border transition-all',
                isActive
                  ? 'border-current'
                  : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[white]',
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
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none"
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
          className="w-full h-10 pl-9 pr-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm text-[white] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] transition-all"
        />
        {buscar && (
          <button
            onClick={() => setBuscar('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[white]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Offline indicator */}
      {isOffline && (
        <div className="bg-[var(--color-warning-dim)] border border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)] text-[var(--color-warning)] text-xs rounded-[12px] px-4 py-2.5 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse shrink-0" />
          Datos guardados — sin conexión
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[12px] px-4 py-3 mb-4">
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
          <div className="mb-4">
            <Mascota variant={buscar ? 'thinking' : 'empty'} size={100} />
          </div>
          {buscar ? (
            <>
              <p className="text-sm font-medium text-[white]">Sin resultados</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">No hay préstamos para "{buscar}"</p>
              <button onClick={() => setBuscar('')} className="mt-3 text-xs text-[var(--color-accent)] hover:underline">
                Limpiar búsqueda
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-[white]">
                {estado === 'activo' ? 'No hay préstamos activos' : estado === 'mora' ? 'No hay préstamos en mora' : 'Sin préstamos'}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {estado !== '' && (
                  <button onClick={() => setEstado('')} className="text-[var(--color-accent)] hover:underline">
                    Ver todos los estados
                  </button>
                )}
              </p>
              {!authLoading && puedeCrearPrestamos && (
                <Link href="/prestamos/nuevo" className="mt-4">
                  <Button size="sm">Crear préstamo</Button>
                </Link>
              )}
            </>
          )}
        </div>
      )}

      {/* Paginación */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[#222] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Anterior
          </button>
          <span className="text-xs text-[var(--color-text-muted)]">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[#222] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
