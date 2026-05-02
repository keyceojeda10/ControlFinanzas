'use client'
// app/(dashboard)/clientes/page.jsx - Lista de clientes

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuth }       from '@/hooks/useAuth'
import { useOffline }    from '@/components/providers/OfflineProvider'
import { guardarEnCache, leerDeCache, obtenerClientesOffline } from '@/lib/offline'
import { Button }        from '@/components/ui/Button'
import { Modal }         from '@/components/ui/Modal'
import { SkeletonCard }  from '@/components/ui/Skeleton'
import ClienteCard       from '@/components/clientes/ClienteCard'
import SwipeableCard     from '@/components/ui/SwipeableCard'
import ModalWhatsAppTemplates from '@/components/ui/ModalWhatsAppTemplates'
import Mascota           from '@/components/ui/Mascota'

// Iconos para acciones swipe
const IconWA = (
  <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)
const IconPagar = (
  <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
  </svg>
)

const ESTADOS_CLIENTE = [
  { value: '',          label: 'Todos'     },
  { value: 'activo',    label: 'Al día'    },
  { value: 'mora',      label: 'En mora',  color: 'var(--color-danger)' },
  { value: 'cancelado', label: 'Cancelados' },
]

const LIMIT = 50

const COLORES_GRUPO = [
  '#3b82f6', 'var(--color-success)', 'var(--color-warning)', 'var(--color-danger)',
  'var(--color-purple)', 'var(--color-info)', '#ec4899', '#84cc16',
]

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
  const [grupos,   setGrupos]     = useState([])
  const [grupoFiltro, setGrupoFiltro] = useState('')
  const [modalGrupos, setModalGrupos] = useState(false)
  // Modal selector de plantillas WhatsApp (se abre desde swipe)
  const [waCliente, setWaCliente] = useState(null)
  const [tabModalGrupos, setTabModalGrupos] = useState('filtrar') // filtrar | gestionar
  const [nuevoGrupo,  setNuevoGrupo]  = useState('')
  const [grupoColor,  setGrupoColor]  = useState(null)
  const [guardandoGrupo, setGuardandoGrupo] = useState(false)
  const [editandoGrupo, setEditandoGrupo]   = useState(null)
  const [modoAsignar, setModoAsignar] = useState(false)
  const [selAsignar,  setSelAsignar]  = useState([])
  const [grupoAsignar, setGrupoAsignar] = useState('')
  const [asignandoGrupo, setAsignandoGrupo] = useState(false)

  const [isOffline, setIsOffline] = useState(false)
  const hasLoadedOnceRef = useRef(false)

  const fetchClientes = useCallback(async (q, p, grupoId = '', { soft = false } = {}) => {
    const shouldUseSoftRefresh = soft && hasLoadedOnceRef.current
    if (!shouldUseSoftRefresh) setLoading(true)
    setError('')
    setIsOffline(false)
    const cacheKey = `clientes:${q || ''}:${p}:${grupoId || 'all'}`

    // Offline: go straight to IndexedDB
    if (!navigator.onLine) {
      try {
        let cached = await leerDeCache(cacheKey)
        if (!cached) {
          const allClientes = await obtenerClientesOffline()
          if (allClientes.length > 0) {
            let filtered = allClientes
            if (q) {
              const ql = q.toLowerCase()
              filtered = filtered.filter(c => c.nombre?.toLowerCase().includes(ql) || c.cedula?.includes(ql) || c.telefono?.includes(ql))
            }
            if (grupoId) {
              filtered = grupoId === '_none'
                ? filtered.filter((c) => !c.grupoCobro?.id)
                : filtered.filter((c) => c.grupoCobro?.id === grupoId)
            }
            const start = (p - 1) * LIMIT
            cached = { clientes: filtered.slice(start, start + LIMIT), total: filtered.length, totalPages: Math.ceil(filtered.length / LIMIT) }
          }
        }
        if (cached) {
          setClientes(cached.clientes); setTotal(cached.total); setTotalPages(cached.totalPages)
          setIsOffline(true); setLoading(false); hasLoadedOnceRef.current = true; return
        }
      } catch {}
    }

    try {
      const params = new URLSearchParams()
      if (q) params.set('buscar', q)
      if (grupoId) params.set('grupo', grupoId)
      params.set('page', String(p))
      params.set('limit', String(LIMIT))
      const res = await fetch(`/api/clientes?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.offline) throw new Error('offline')
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
            if (grupoId) {
              filtered = grupoId === '_none'
                ? filtered.filter((c) => !c.grupoCobro?.id)
                : filtered.filter((c) => c.grupoCobro?.id === grupoId)
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
          hasLoadedOnceRef.current = true
          return
        }
      } catch {}
      setError('No se pudieron cargar los clientes.')
    } finally {
      setLoading(false)
      hasLoadedOnceRef.current = true
    }
  }, [])

  const fetchGrupos = useCallback(async () => {
    try {
      const res = await fetch('/api/grupos')
      if (!res.ok) return
      const data = await res.json()
      setGrupos(Array.isArray(data) ? data : [])
    } catch {}
  }, [])

  useEffect(() => {
    fetchGrupos()
  }, [fetchGrupos, lastSyncedAt])

  // Búsqueda -> volver a página 1
  useEffect(() => {
    setPage(1)
  }, [buscar])

  // Cambiar filtro de grupo reinicia paginación y selección (mantiene modo asignar activo)
  useEffect(() => {
    setPage(1)
    setSelAsignar([])
  }, [grupoFiltro])

  // Carga de clientes con debounce
  useEffect(() => {
    const t = setTimeout(() => fetchClientes(buscar, page, grupoFiltro), 280)
    return () => clearTimeout(t)
  }, [fetchClientes, buscar, page, grupoFiltro])

  // Refresh silencioso cuando hay nueva sincronización global.
  useEffect(() => {
    if (!lastSyncedAt) return
    fetchClientes(buscar, page, grupoFiltro, { soft: true })
  }, [lastSyncedAt, fetchClientes, buscar, page, grupoFiltro])

  const getApiError = async (res, fallback) => {
    try {
      const data = await res.json()
      if (typeof data?.error === 'string' && data.error.trim()) return data.error
      if (typeof data?.message === 'string' && data.message.trim()) return data.message
    } catch {}
    return fallback
  }

  const crearGrupo = async () => {
    if (!nuevoGrupo.trim()) return
    setGuardandoGrupo(true)
    setError('')
    try {
      const res = await fetch('/api/grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevoGrupo.trim(), color: grupoColor }),
      })
      if (!res.ok) {
        setError(await getApiError(res, 'No se pudo crear el grupo.'))
        return
      }

      setNuevoGrupo('')
      setGrupoColor(null)
      fetchGrupos()
    } catch {
      setError('No se pudo crear el grupo.')
    } finally {
      setGuardandoGrupo(false)
    }
  }

  const editarGrupo = async (grupoId, data) => {
    setError('')
    try {
      const res = await fetch(`/api/grupos/${grupoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        setError(await getApiError(res, 'No se pudo actualizar el grupo.'))
        return false
      }

      fetchGrupos()
      fetchClientes(buscar, page, grupoFiltro, { soft: true })
      return true
    } catch {}
    setError('No se pudo actualizar el grupo.')
    return false
  }

  const guardarNombreGrupo = async (grupo, valorCrudo) => {
    const nombreLimpio = valorCrudo.trim()
    if (!nombreLimpio) {
      setError('El nombre del grupo no puede quedar vacio.')
      setEditandoGrupo(null)
      return
    }
    if (nombreLimpio === grupo.nombre) {
      setEditandoGrupo(null)
      return
    }
    await editarGrupo(grupo.id, { nombre: nombreLimpio })
    setEditandoGrupo(null)
  }

  const eliminarGrupo = async (grupoId) => {
    if (!confirm('¿Eliminar este grupo? Los clientes quedarán sin grupo.')) return
    setError('')
    try {
      const res = await fetch(`/api/grupos/${grupoId}`, { method: 'DELETE' })
      if (!res.ok) {
        setError(await getApiError(res, 'No se pudo eliminar el grupo.'))
        return
      }

      if (grupoFiltro === grupoId) setGrupoFiltro('')
      fetchGrupos()
      fetchClientes(buscar, page, grupoFiltro === grupoId ? '' : grupoFiltro, { soft: true })
    } catch {
      setError('No se pudo eliminar el grupo.')
    }
  }

  const toggleSeleccion = (clienteId) => {
    setSelAsignar((prev) =>
      prev.includes(clienteId) ? prev.filter((id) => id !== clienteId) : [...prev, clienteId]
    )
  }

  const asignarGrupoClientes = async () => {
    if (!selAsignar.length || !grupoAsignar) return
    setAsignandoGrupo(true)
    setError('')
    try {
      const responses = await Promise.all(selAsignar.map((cid) =>
        fetch(`/api/clientes/${cid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grupoCobroId: grupoAsignar === '_none' ? null : grupoAsignar }),
        })
      ))

      const failed = responses.find((res) => !res.ok)
      if (failed) {
        setError(await getApiError(failed, 'No se pudo asignar el grupo a todos los clientes seleccionados.'))
        return
      }

      setModoAsignar(false)
      setSelAsignar([])
      setGrupoAsignar('')
      fetchClientes(buscar, page, grupoFiltro, { soft: true })
      fetchGrupos()
    } catch {
      setError('No se pudo asignar el grupo a los clientes seleccionados.')
    } finally {
      setAsignandoGrupo(false)
    }
  }

  const moraCount = clientes.filter((c) => c.estado === 'mora').length
  const filtrosActivos = (estado ? 1 : 0) + (grupoFiltro ? 1 : 0)
  const tieneBusqueda = !!buscar.trim()
  const grupoActivoLabel = grupoFiltro === '_none'
    ? 'Sin grupo'
    : (grupos.find((g) => g.id === grupoFiltro)?.nombre || '')
  const hayControlesActivos = tieneBusqueda || filtrosActivos > 0 || modoAsignar

  const limpiarControles = () => {
    setBuscar('')
    setEstado('')
    setGrupoFiltro('')
    setModoAsignar(false)
    setSelAsignar([])
    setGrupoAsignar('')
  }

  const abrirModoAsignar = () => {
    setModoAsignar(true)
    setSelAsignar([])
    setGrupoAsignar('')
    setModalGrupos(false)
  }

  const cancelarAsignacion = () => {
    setModoAsignar(false)
    setSelAsignar([])
    setGrupoAsignar('')
  }

  return (
    <div className={`max-w-3xl mx-auto ${modoAsignar ? 'pb-40 lg:pb-28' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[white]">Clientes</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {loading ? '...' : `${total} cliente${total !== 1 ? 's' : ''}`}
            {!loading && moraCount > 0 && (
              <span className="ml-2 text-[var(--color-danger)]">· {moraCount} en mora</span>
            )}
          </p>
        </div>
        {!authLoading && puedeCrearClientes && (
          <Link href="/clientes/nuevo" className="shrink-0">
            <Button
              size="sm"
              className="whitespace-nowrap"
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

      {/* Barra compacta: buscador + filtro estado + botón grupos */}
      <div className="mb-4 space-y-2.5">
        {/* Fila 1: buscador + botón grupos (solo owner) */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
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
              placeholder={modoAsignar ? 'Buscar cliente para asignar…' : 'Buscar por nombre, cédula o teléfono…'}
              className="w-full h-10 pl-9 pr-9 rounded-[12px] border border-[var(--color-border)] bg-[#161616] text-sm text-[white] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] transition-all"
            />
            {buscar && (
              <button
                onClick={() => setBuscar('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[white]"
                aria-label="Limpiar búsqueda"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {!authLoading && esOwner && (
            <button
              onClick={() => setModalGrupos(true)}
              className="shrink-0 h-10 px-3 rounded-[12px] border border-[var(--color-border)] bg-[#161616] text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-bg-hover)] transition-colors flex items-center gap-1.5"
              aria-label="Grupos de cobro"
              title="Grupos de cobro"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="hidden sm:inline">Grupos</span>
              {grupoFiltro && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
              )}
            </button>
          )}
        </div>

        {/* Fila 2: chips de estado (siempre visibles) */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {ESTADOS_CLIENTE.map(({ value, label, color }) => {
            const isActive = estado === value
            const accent = color ?? 'var(--color-accent)'
            return (
              <button
                key={value}
                onClick={() => setEstado(value)}
                className={[
                  'shrink-0 px-3 h-8 rounded-full text-[12px] font-medium border transition-all',
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
          {hayControlesActivos && (
            <button
              onClick={limpiarControles}
              className="shrink-0 px-3 h-8 rounded-full text-[11px] font-medium border border-[#303030] text-[#b4b4b4] hover:text-[var(--color-text-primary)] hover:border-[#4a4a4a] transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Fila 3: chip del grupo activo (si hay filtro) */}
        {grupoFiltro && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[var(--color-text-muted)]">Filtrado por grupo:</span>
            <span
              className="inline-flex items-center gap-1.5 px-2 h-6 rounded-full text-[11px] font-medium border"
              style={
                grupoFiltro === '_none'
                  ? { color: 'var(--color-info)', borderColor: 'rgba(6,182,212,0.4)', background: 'rgba(6,182,212,0.12)' }
                  : (() => {
                    const g = grupos.find((gr) => gr.id === grupoFiltro)
                    const c = g?.color || 'var(--color-accent)'
                    return { color: c, borderColor: `${c}66`, background: `${c}1f` }
                  })()
              }
            >
              {grupoFiltro !== '_none' && (
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: (grupos.find(g => g.id === grupoFiltro)?.color) || 'var(--color-accent)' }} />
              )}
              {grupoActivoLabel}
              <button
                onClick={() => setGrupoFiltro('')}
                className="ml-1 opacity-70 hover:opacity-100"
                aria-label="Quitar filtro de grupo"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          </div>
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
      {!loading && clientes.length > 0 && (() => {
        const filtrados = estado ? clientes.filter((c) => c.estado === estado) : clientes
        return filtrados.length > 0 ? (
          <div className="space-y-2.5">
            {filtrados.map((c) => (
              modoAsignar ? (
                <label
                  key={c.id}
                  className={[
                    'flex items-center gap-3 border rounded-[14px] p-4 transition-all cursor-pointer',
                    selAsignar.includes(c.id)
                      ? 'border-[rgba(245,197,24,0.35)] bg-[rgba(245,197,24,0.08)]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[#f5c518]/40',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={selAsignar.includes(c.id)}
                    onChange={() => toggleSeleccion(c.id)}
                    className="accent-[#f5c518]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#f1f5f9] truncate">{c.nombre}</p>
                    <p className="text-xs text-[#8b95a5] mt-0.5">CC {c.cedula}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {c.grupoCobro ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border"
                          style={{
                            color: c.grupoCobro.color || 'var(--color-accent)',
                            borderColor: `${c.grupoCobro.color || 'var(--color-accent)'}44`,
                            background: `${c.grupoCobro.color || 'var(--color-accent)'}18`,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.grupoCobro.color || 'var(--color-accent)' }} />
                          {c.grupoCobro.nombre}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#7b8794]">Sin grupo</span>
                      )}
                    </div>
                  </div>
                </label>
              ) : (
                <SwipeableCard
                  key={c.id}
                  actions={[
                    ...(c.telefono ? [{
                      icon: IconWA,
                      label: 'WhatsApp',
                      color: '#25D366',
                      onClick: () => setWaCliente(c),
                    }] : []),
                    ...(c.prestamosActivos > 0 ? [{
                      icon: IconPagar,
                      label: 'Pagar',
                      color: '#22c55e',
                      onClick: () => { window.location.href = `/clientes/${c.id}` },
                    }] : []),
                  ]}
                >
                  <ClienteCard cliente={c} />
                </SwipeableCard>
              )
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium text-[white]">Sin clientes {estado === 'mora' ? 'en mora' : estado === 'activo' ? 'al día' : 'cancelados'}</p>
            <button onClick={() => setEstado('')} className="mt-2 text-xs text-[var(--color-accent)] hover:underline">
              Ver todos
            </button>
          </div>
        )
      })()}

      {/* Estado vacío */}
      {!loading && clientes.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4">
            <Mascota variant={buscar || grupoFiltro ? 'thinking' : 'empty'} size={100} />
          </div>
          {buscar ? (
            <>
              <p className="text-sm font-medium text-[white]">Sin resultados</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">No se encontró ningún cliente con "{buscar}"</p>
              <button onClick={() => setBuscar('')} className="mt-3 text-xs text-[var(--color-accent)] hover:underline">
                Limpiar búsqueda
              </button>
            </>
          ) : grupoFiltro ? (
            <>
              <p className="text-sm font-medium text-[white]">Sin clientes en este grupo</p>
              <button onClick={() => setGrupoFiltro('')} className="mt-3 text-xs text-[var(--color-accent)] hover:underline">
                Ver todos los grupos
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-[white]">No hay clientes aún</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Crea el primer cliente para comenzar</p>
              {!authLoading && puedeCrearClientes && (
                <Link href="/clientes/nuevo" className="mt-4">
                  <Button size="sm">Crear primer cliente</Button>
                </Link>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal: grupos de cobro con pestañas */}
      <Modal
        open={modalGrupos}
        onClose={() => { setModalGrupos(false); setEditandoGrupo(null) }}
        title="Grupos de cobro"
      >
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-[var(--color-bg-card)] border border-[#222]">
            {[
              { key: 'filtrar', label: 'Filtrar' },
              { key: 'gestionar', label: 'Gestionar' },
              { key: 'asignar', label: 'Asignar' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTabModalGrupos(t.key)}
                className={[
                  'flex-1 h-8 rounded-lg text-xs font-medium transition-colors',
                  tabModalGrupos === t.key
                    ? 'bg-[var(--color-accent)] text-black'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* FILTRAR */}
          {tabModalGrupos === 'filtrar' && (
            <div className="space-y-2">
              <p className="text-[11px] text-[var(--color-text-muted)]">Mostrar solo clientes de un grupo:</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => { setGrupoFiltro(''); setModalGrupos(false) }}
                  className={[
                    'px-3 h-8 rounded-full text-xs border transition-colors',
                    !grupoFiltro
                      ? 'border-[#f5c518] text-[var(--color-accent)] bg-[rgba(245,197,24,0.12)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                  ].join(' ')}
                >
                  Todos
                </button>
                <button
                  onClick={() => { setGrupoFiltro('_none'); setModalGrupos(false) }}
                  className={[
                    'px-3 h-8 rounded-full text-xs border transition-colors',
                    grupoFiltro === '_none'
                      ? 'border-[#06b6d4] text-[var(--color-info)] bg-[rgba(6,182,212,0.12)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                  ].join(' ')}
                >
                  Sin grupo
                </button>
                {grupos.map((g) => {
                  const c = g.color || 'var(--color-accent)'
                  const active = grupoFiltro === g.id
                  return (
                    <button
                      key={g.id}
                      onClick={() => { setGrupoFiltro(g.id); setModalGrupos(false) }}
                      className="px-3 h-8 rounded-full text-xs border inline-flex items-center gap-1.5 transition-colors"
                      style={active
                        ? { color: c, borderColor: c, background: `${c}1f` }
                        : { color: '#888', borderColor: '#2a2a2a' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                      {g.nombre}
                      <span className="text-[10px] opacity-70">{g._count?.clientes ?? 0}</span>
                    </button>
                  )
                })}
              </div>
              {grupos.length === 0 && (
                <p className="text-sm text-[#666] text-center py-4">
                  Aún no tienes grupos. Créalos en la pestaña "Gestionar".
                </p>
              )}
            </div>
          )}

          {/* GESTIONAR */}
          {tabModalGrupos === 'gestionar' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  value={nuevoGrupo}
                  onChange={e => setNuevoGrupo(e.target.value)}
                  placeholder="Nombre del grupo..."
                  className="flex-1 h-9 px-3 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                  onKeyDown={e => e.key === 'Enter' && crearGrupo()}
                />
                <button
                  onClick={crearGrupo}
                  disabled={!nuevoGrupo.trim() || guardandoGrupo}
                  className="h-9 px-4 rounded-lg bg-[var(--color-accent)] text-black text-sm font-bold shrink-0 disabled:opacity-50 active:scale-95 transition-transform"
                >
                  {guardandoGrupo ? '...' : 'Crear'}
                </button>
              </div>

              <div className="flex gap-2 flex-wrap">
                {COLORES_GRUPO.map(c => (
                  <button
                    key={c}
                    onClick={() => setGrupoColor(grupoColor === c ? null : c)}
                    className={`w-7 h-7 rounded-full transition-all ${grupoColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0a0a0a] scale-110' : 'hover:scale-110'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>

              {grupos.length > 0 ? (
                <div className="space-y-2 pt-2 border-t border-[#222]">
                  {grupos.map(g => (
                    <div key={g.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[#1f1f1f]">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: g.color || '#666' }} />
                      {editandoGrupo === g.id ? (
                        <input
                          defaultValue={g.nombre}
                          autoFocus
                          className="flex-1 h-7 px-2 rounded bg-[var(--color-bg-surface)] border border-[#444] text-sm text-[var(--color-text-primary)]"
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
                            if (e.key === 'Escape') setEditandoGrupo(null)
                          }}
                          onBlur={e => { guardarNombreGrupo(g, e.target.value) }}
                        />
                      ) : (
                        <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate cursor-pointer" onClick={() => setEditandoGrupo(g.id)}>
                          {g.nombre}
                        </span>
                      )}
                      <span className="text-[10px] text-[#666] shrink-0">{g._count?.clientes ?? 0}</span>
                      <div className="flex gap-1 shrink-0">
                        {COLORES_GRUPO.slice(0, 4).map(c => (
                          <button
                            key={c}
                            onClick={() => editarGrupo(g.id, { color: c })}
                            className={`w-4 h-4 rounded-full ${g.color === c ? 'ring-1 ring-white' : ''}`}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                      <button onClick={() => eliminarGrupo(g.id)} className="text-[#666] hover:text-[var(--color-danger)] transition-colors shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#666] text-center py-4">Aún no tienes grupos. Crea uno para organizar tus clientes por día o zona.</p>
              )}
            </div>
          )}

          {/* ASIGNAR */}
          {tabModalGrupos === 'asignar' && (
            <div className="space-y-3">
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Activa el modo asignación para seleccionar varios clientes de la lista y cambiarles el grupo.
              </p>
              <Button onClick={abrirModoAsignar} className="w-full">
                Activar selección múltiple
              </Button>
              {grupos.length === 0 && (
                <p className="text-[11px] text-[#a16207] text-center">
                  Primero crea al menos un grupo en la pestaña "Gestionar".
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Sticky bar: modo asignación activo (posicionada encima del BottomNav móvil) */}
      {modoAsignar && (
        <div className="fixed left-0 right-0 z-50 border-t border-[#f5c518]/40 bg-[var(--color-bg-base)]/98 backdrop-blur-md bottom-[84px] lg:bottom-0 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
          <div className="max-w-3xl mx-auto px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-xs text-[var(--color-accent)] font-semibold">
                {selAsignar.length} {selAsignar.length === 1 ? 'seleccionado' : 'seleccionados'}
              </div>
              <button
                onClick={cancelarAsignacion}
                className="text-xs text-[#b4b4b4] hover:text-[var(--color-text-primary)] underline underline-offset-2"
              >
                Cancelar
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={grupoAsignar}
                onChange={(e) => setGrupoAsignar(e.target.value)}
                className="flex-1 min-w-0 h-10 px-2 rounded-lg bg-[#161616] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)]"
              >
                <option value="">Elegir grupo…</option>
                <option value="_none">Sin grupo</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
              <button
                onClick={asignarGrupoClientes}
                disabled={!selAsignar.length || !grupoAsignar || asignandoGrupo}
                className="shrink-0 h-10 px-4 rounded-lg bg-[var(--color-accent)] text-black text-xs font-bold disabled:opacity-40 active:scale-95 transition-transform"
              >
                {asignandoGrupo ? '...' : 'Asignar'}
              </button>
            </div>
          </div>
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

      {/* Modal selector de plantillas WhatsApp (se abre desde swipe) */}
      <ModalWhatsAppTemplates
        open={!!waCliente}
        onClose={() => setWaCliente(null)}
        cliente={waCliente}
        prestamo={null}
      />
    </div>
  )
}
