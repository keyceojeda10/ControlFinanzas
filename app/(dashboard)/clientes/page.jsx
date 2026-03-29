'use client'
// app/(dashboard)/clientes/page.jsx - Lista de clientes

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth }       from '@/hooks/useAuth'
import { useOffline }    from '@/components/providers/OfflineProvider'
import { guardarEnCache, leerDeCache, obtenerClientesOffline } from '@/lib/offline'
import { Button }        from '@/components/ui/Button'
import { SkeletonCard }  from '@/components/ui/Skeleton'
import ClienteCard       from '@/components/clientes/ClienteCard'

const ESTADOS_CLIENTE = [
  { value: '',          label: 'Todos'     },
  { value: 'activo',    label: 'Al día'    },
  { value: 'mora',      label: 'En mora',  color: '#ef4444' },
  { value: 'cancelado', label: 'Cancelados' },
]

const LIMIT = 50

export default function ClientesPage() {
  const { esOwner, puedeCrearClientes, loading: authLoading } = useAuth()
  const { lastSyncedAt } = useOffline()
  const [clientes, setClientes]   = useState([])
  const [buscar,   setBuscar]     = useState('')
  const [estado,   setEstado]     = useState('')
  const [loading,  setLoading]    = useState(true)
  const [error,    setError]      = useState('')
  const [page,     setPage]       = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total,    setTotal]      = useState(0)

  const [isOffline, setIsOffline] = useState(false)

  const fetchClientes = useCallback(async (q, p) => {
    setLoading(true)
    setError('')
    setIsOffline(false)
    const cacheKey = `clientes:${q || ''}:${p}`
    try {
      const params = new URLSearchParams()
      if (q) params.set('buscar', q)
      params.set('page', String(p))
      params.set('limit', String(LIMIT))
      const res = await fetch(`/api/clientes?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setClientes(data.clientes)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      // Cache for offline
      guardarEnCache(cacheKey, { clientes: data.clientes, total: data.total, totalPages: data.totalPages }).catch(() => {})
    } catch {
      // Try page-specific cache first, then bulk sync data
      try {
        let cached = await leerDeCache(cacheKey)
        if (!cached) {
          // Fall back to bulk sync: filter client-side
          const allClientes = await obtenerClientesOffline()
          if (allClientes.length > 0) {
            let filtered = allClientes
            if (q) {
              const ql = q.toLowerCase()
              filtered = filtered.filter(c => c.nombre?.toLowerCase().includes(ql) || c.cedula?.includes(ql) || c.telefono?.includes(ql))
            }
            const start = (p - 1) * LIMIT
            cached = { clientes: filtered.slice(start, start + LIMIT), total: filtered.length, totalPages: Math.ceil(filtered.length / LIMIT) }
          }
        }
        if (cached) {
          setClientes(cached.clientes)
          setTotal(cached.total)
          setTotalPages(cached.totalPages)
          setIsOffline(true)
          setLoading(false)
          return
        }
      } catch {}
      setError('No se pudieron cargar los clientes.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Carga inicial + re-fetch after offline sync
  useEffect(() => { fetchClientes('', 1) }, [fetchClientes, lastSyncedAt])

  // Búsqueda en tiempo real con debounce — reset to page 1
  useEffect(() => {
    setPage(1)
    const t = setTimeout(() => fetchClientes(buscar, 1), 300)
    return () => clearTimeout(t)
  }, [buscar, fetchClientes])

  // Cambio de página
  useEffect(() => {
    if (page > 1) fetchClientes(buscar, page)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[white]">Clientes</h1>
          <p className="text-sm text-[#888888] mt-0.5">
            {loading ? '...' : `${total} cliente${total !== 1 ? 's' : ''}`}
            {!loading && clientes.filter((c) => c.estado === 'mora').length > 0 && (
              <span className="ml-2 text-[#ef4444]">· {clientes.filter((c) => c.estado === 'mora').length} en mora</span>
            )}
          </p>
        </div>
        {!authLoading && puedeCrearClientes && (
          <Link href="/clientes/nuevo">
            <Button
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Nuevo cliente
            </Button>
          </Link>
        )}
      </div>

      {/* Filtro de estado */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none pb-1">
        {ESTADOS_CLIENTE.map(({ value, label, color }) => {
          const isActive = estado === value
          const accent = color ?? '#f5c518'
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
          placeholder="Buscar por nombre, cédula o teléfono…"
          className="w-full h-10 pl-9 pr-4 rounded-[12px] border border-[#2a2a2a] bg-[#1a1a1a] text-sm text-[white] placeholder-[#777777] focus:outline-none focus:border-[#f5c518] focus:ring-1 focus:ring-[rgba(245,197,24,0.3)] transition-all"
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

      {/* Offline indicator */}
      {isOffline && (
        <div className="bg-[rgba(245,197,24,0.1)] border border-[rgba(245,197,24,0.2)] text-[#f5c518] text-xs rounded-[12px] px-4 py-2.5 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#f5c518] animate-pulse shrink-0" />
          Datos guardados — sin conexión
        </div>
      )}

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
      {!loading && clientes.length > 0 && (() => {
        const filtrados = estado ? clientes.filter((c) => c.estado === estado) : clientes
        return filtrados.length > 0 ? (
          <div className="space-y-2.5">
            {filtrados.map((c) => <ClienteCard key={c.id} cliente={c} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium text-[white]">Sin clientes {estado === 'mora' ? 'en mora' : estado === 'activo' ? 'al día' : 'cancelados'}</p>
            <button onClick={() => setEstado('')} className="mt-2 text-xs text-[#f5c518] hover:underline">
              Ver todos
            </button>
          </div>
        )
      })()}

      {/* Estado vacío */}
      {!loading && clientes.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-[rgba(245,197,24,0.1)] flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[#f5c518]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          {buscar ? (
            <>
              <p className="text-sm font-medium text-[white]">Sin resultados</p>
              <p className="text-xs text-[#888888] mt-1">No se encontró ningún cliente con "{buscar}"</p>
              <button onClick={() => setBuscar('')} className="mt-3 text-xs text-[#f5c518] hover:underline">
                Limpiar búsqueda
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-[white]">No hay clientes aún</p>
              <p className="text-xs text-[#888888] mt-1">Crea el primer cliente para comenzar</p>
              {!authLoading && puedeCrearClientes && (
                <Link href="/clientes/nuevo" className="mt-4">
                  <Button size="sm">Crear primer cliente</Button>
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
            className="px-3 py-1.5 text-xs rounded-lg border border-[#2a2a2a] text-[#888] hover:bg-[#222] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Anterior
          </button>
          <span className="text-xs text-[#888]">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs rounded-lg border border-[#2a2a2a] text-[#888] hover:bg-[#222] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
