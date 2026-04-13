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

const ESTADOS_CLIENTE = [
  { value: '',          label: 'Todos'     },
  { value: 'activo',    label: 'Al día'    },
  { value: 'mora',      label: 'En mora',  color: '#ef4444' },
  { value: 'cancelado', label: 'Cancelados' },
]

const LIMIT = 50

const COLORES_GRUPO = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#a855f7', '#06b6d4', '#ec4899', '#84cc16',
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
  const [nuevoGrupo,  setNuevoGrupo]  = useState('')
  const [grupoColor,  setGrupoColor]  = useState(null)
  const [guardandoGrupo, setGuardandoGrupo] = useState(false)
  const [editandoGrupo, setEditandoGrupo]   = useState(null)
  const [modoAsignar, setModoAsignar] = useState(false)
  const [selAsignar,  setSelAsignar]  = useState([])
  const [grupoAsignar, setGrupoAsignar] = useState('')
  const [asignandoGrupo, setAsignandoGrupo] = useState(false)
  const [mostrarControles, setMostrarControles] = useState(false)

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

  // Cambiar filtro de grupo reinicia selección masiva
  useEffect(() => {
    setPage(1)
    setModoAsignar(false)
    setSelAsignar([])
    setGrupoAsignar('')
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

  useEffect(() => {
    if (estado || grupoFiltro || modoAsignar) {
      setMostrarControles(true)
    }
  }, [estado, grupoFiltro, modoAsignar])

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
  const estadoActivoLabel = ESTADOS_CLIENTE.find((e) => e.value === estado)?.label || ''
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

  const toggleModoAsignar = () => {
    setModoAsignar((prev) => !prev)
    setSelAsignar([])
    setGrupoAsignar('')
    setMostrarControles(true)
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[white]">Clientes</h1>
          <p className="text-sm text-[#888888] mt-0.5">
            {loading ? '...' : `${total} cliente${total !== 1 ? 's' : ''}`}
            {!loading && moraCount > 0 && (
              <span className="ml-2 text-[#ef4444]">· {moraCount} en mora</span>
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

      {/* Barra compacta de búsqueda y controles */}
      <div className="mb-5 rounded-[16px] border border-[#1f1f1f] bg-[rgba(255,255,255,0.018)] px-3 py-2.5 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {!modoAsignar ? (
            <div className="relative flex-1">
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
                className="w-full h-9 pl-9 pr-9 rounded-[11px] border border-[#2a2a2a] bg-[#161616] text-sm text-[white] placeholder-[#777777] focus:outline-none focus:border-[#f5c518] focus:ring-1 focus:ring-[rgba(245,197,24,0.3)] transition-all"
              />
              {buscar && (
                <button
                  onClick={() => setBuscar('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[white]"
                  aria-label="Limpiar búsqueda"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <div className="h-9 flex-1 rounded-[11px] border border-[rgba(245,197,24,0.24)] bg-[rgba(245,197,24,0.08)] px-3 flex items-center text-[11px] font-medium text-[#f5c518]">
              Asignación activa: usa el buscador dentro de Opciones.
            </div>
          )}
          <button
            onClick={() => setMostrarControles((v) => (modoAsignar ? true : !v))}
            aria-label={mostrarControles ? 'Ocultar filtros y acciones' : 'Mostrar filtros y acciones'}
            className="h-9 px-2.5 sm:px-3 rounded-[11px] border border-[#2a2a2a] bg-[#1a1a1a] text-xs font-medium text-[#d4d4d4] hover:bg-[#222222] transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
          >
            <svg
              className={`w-4 h-4 transition-transform ${mostrarControles ? 'rotate-180 text-[#f5c518]' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span>{mostrarControles ? 'Ocultar' : 'Opciones'}</span>
            {filtrosActivos > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-[rgba(245,197,24,0.18)] text-[#f5c518] text-[10px] leading-4 text-center">
                {filtrosActivos}
              </span>
            )}
          </button>
        </div>

        {!mostrarControles && !hayControlesActivos && (
          <p className="mt-1.5 px-0.5 text-[11px] text-[#707783]">
            Aquí encuentras filtros por estado, grupos y asignación masiva.
          </p>
        )}

        {!mostrarControles && hayControlesActivos && (
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            {tieneBusqueda && (
              <span className="shrink-0 px-2 h-6 rounded-full border border-[rgba(245,197,24,0.26)] bg-[rgba(245,197,24,0.1)] text-[10px] font-medium text-[#f5c518]">
                Búsqueda activa
              </span>
            )}
            {estado && (
              <span className="shrink-0 px-2 h-6 rounded-full border border-[#2f2f2f] bg-[#151515] text-[10px] font-medium text-[#9ca3af] inline-flex items-center">
                Estado: {estadoActivoLabel}
              </span>
            )}
            {grupoFiltro && (
              <span className="shrink-0 px-2 h-6 rounded-full border border-[#2f2f2f] bg-[#151515] text-[10px] font-medium text-[#9ca3af] inline-flex items-center">
                Grupo: {grupoActivoLabel}
              </span>
            )}
            {modoAsignar && (
              <span className="shrink-0 px-2 h-6 rounded-full border border-[rgba(245,197,24,0.26)] bg-[rgba(245,197,24,0.12)] text-[10px] font-medium text-[#f5c518] inline-flex items-center">
                Asignación activa
              </span>
            )}
            <button
              onClick={limpiarControles}
              className="shrink-0 px-2 h-6 rounded-full border border-[#303030] text-[10px] font-medium text-[#b4b4b4] hover:text-white hover:border-[#4a4a4a] transition-colors"
            >
              Limpiar todo
            </button>
          </div>
        )}

        {mostrarControles && (
          <div className="mt-3 pt-3 border-t border-[#242424] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {!authLoading && esOwner && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setModalGrupos(true)}
                    className="h-8 px-3 rounded-[10px] border border-[#2a2a2a] bg-[#1a1a1a] text-xs font-medium text-[#f5c518] hover:bg-[#222222] transition-colors"
                  >
                    Gestionar grupos
                  </button>
                  <button
                    onClick={toggleModoAsignar}
                    className={[
                      'h-8 px-3 rounded-[10px] border text-xs font-medium transition-colors',
                      modoAsignar
                        ? 'border-[#f5c518] bg-[rgba(245,197,24,0.15)] text-[#f5c518]'
                        : 'border-[#2a2a2a] bg-[#1a1a1a] text-[#888888] hover:bg-[#222222] hover:text-[white]',
                    ].join(' ')}
                  >
                    {modoAsignar ? 'Cancelar asignación' : 'Asignar grupo'}
                  </button>
                </div>
              )}

              {hayControlesActivos && (
                <button
                  onClick={limpiarControles}
                  className="h-8 px-3 rounded-[10px] border border-[#2a2a2a] bg-[#151515] text-xs font-medium text-[#b4b4b4] hover:bg-[#222222] hover:text-white transition-colors"
                >
                  Limpiar todo
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              {ESTADOS_CLIENTE.map(({ value, label, color }) => {
                const isActive = estado === value
                const accent = color ?? '#f5c518'
                return (
                  <button
                    key={value}
                    onClick={() => setEstado(value)}
                    className={[
                      'shrink-0 px-2.5 h-7 rounded-full text-[11px] font-medium border transition-all',
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

            {grupos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                <button
                  onClick={() => setGrupoFiltro('')}
                  className={[
                    'shrink-0 px-2.5 h-7 rounded-full text-[11px] font-medium border transition-all',
                    !grupoFiltro
                      ? 'border-[#f5c518] text-[#f5c518] bg-[rgba(245,197,24,0.12)]'
                      : 'bg-transparent border-[#2a2a2a] text-[#888888] hover:bg-[#222222] hover:text-[white]',
                  ].join(' ')}
                >
                  Todos los grupos
                </button>
                <button
                  onClick={() => setGrupoFiltro('_none')}
                  className={[
                    'shrink-0 px-2.5 h-7 rounded-full text-[11px] font-medium border transition-all',
                    grupoFiltro === '_none'
                      ? 'border-[#06b6d4] text-[#06b6d4] bg-[rgba(6,182,212,0.12)]'
                      : 'bg-transparent border-[#2a2a2a] text-[#888888] hover:bg-[#222222] hover:text-[white]',
                  ].join(' ')}
                >
                  Sin grupo
                </button>
                {grupos.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGrupoFiltro(g.id)}
                    className={[
                      'shrink-0 px-2.5 h-7 rounded-full text-[11px] font-medium border transition-all flex items-center gap-1.5',
                      grupoFiltro === g.id
                        ? 'border-current'
                        : 'bg-transparent border-[#2a2a2a] text-[#888888] hover:bg-[#222222] hover:text-[white]',
                    ].join(' ')}
                    style={grupoFiltro === g.id ? { color: g.color || '#f5c518', backgroundColor: `${g.color || '#f5c518'}20` } : undefined}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: g.color || '#666' }} />
                    {g.nombre}
                    <span className="text-[10px] opacity-70">{g._count?.clientes ?? 0}</span>
                  </button>
                ))}
              </div>
            )}

            {modoAsignar && (
              <div className="rounded-[14px] border border-[rgba(245,197,24,0.26)] bg-[rgba(15,15,22,0.72)] p-3 sm:p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#f5c518]">Asignación por grupo</p>
                  <span className="text-[11px] text-[#f4f4f5]">{selAsignar.length} seleccionados</span>
                </div>

                <div className="relative">
                  <svg
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7b8794] pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="search"
                    value={buscar}
                    onChange={(e) => setBuscar(e.target.value)}
                    placeholder="Buscar cliente para asignar..."
                    className="w-full h-9 pl-8 pr-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-sm text-white placeholder:text-[#6c7280]"
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    value={grupoAsignar}
                    onChange={e => setGrupoAsignar(e.target.value)}
                    className="h-9 px-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-sm text-white min-w-0 sm:flex-1"
                  >
                    <option value="">Elegir grupo...</option>
                    {grupos.map(g => (
                      <option key={g.id} value={g.id}>{g.nombre}</option>
                    ))}
                    <option value="_none">Sin grupo</option>
                  </select>
                  <button
                    onClick={asignarGrupoClientes}
                    disabled={!grupoAsignar || !selAsignar.length || asignandoGrupo}
                    className="h-9 px-4 rounded-lg bg-[#f5c518] text-black text-sm font-bold shrink-0 disabled:opacity-50 active:scale-95 transition-transform"
                  >
                    {asignandoGrupo ? 'Asignando...' : 'Asignar'}
                  </button>
                </div>

                <p className="text-[11px] text-[#8b95a5]">
                  Busca en esta misma sección y marca clientes en la lista para asignarlos.
                </p>
              </div>
            )}
          </div>
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
            {filtrados.map((c) => (
              modoAsignar ? (
                <label
                  key={c.id}
                  className={[
                    'flex items-center gap-3 border rounded-[14px] p-4 transition-all cursor-pointer',
                    selAsignar.includes(c.id)
                      ? 'border-[rgba(245,197,24,0.35)] bg-[rgba(245,197,24,0.08)]'
                      : 'border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#f5c518]/40',
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
                            color: c.grupoCobro.color || '#f5c518',
                            borderColor: `${c.grupoCobro.color || '#f5c518'}44`,
                            background: `${c.grupoCobro.color || '#f5c518'}18`,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.grupoCobro.color || '#f5c518' }} />
                          {c.grupoCobro.nombre}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#7b8794]">Sin grupo</span>
                      )}
                    </div>
                  </div>
                </label>
              ) : (
                <ClienteCard key={c.id} cliente={c} />
              )
            ))}
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
          ) : grupoFiltro ? (
            <>
              <p className="text-sm font-medium text-[white]">Sin clientes en este grupo</p>
              <button onClick={() => setGrupoFiltro('')} className="mt-3 text-xs text-[#f5c518] hover:underline">
                Ver todos los grupos
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

      {/* Modal: gestión de grupos */}
      <Modal open={modalGrupos} onClose={() => { setModalGrupos(false); setEditandoGrupo(null) }} title="Grupos de cobro">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              value={nuevoGrupo}
              onChange={e => setNuevoGrupo(e.target.value)}
              placeholder="Nombre del grupo..."
              className="flex-1 h-9 px-3 rounded-lg bg-[#1a1a1a] border border-[#333] text-sm text-white placeholder:text-[#555]"
              onKeyDown={e => e.key === 'Enter' && crearGrupo()}
            />
            <button
              onClick={crearGrupo}
              disabled={!nuevoGrupo.trim() || guardandoGrupo}
              className="h-9 px-4 rounded-lg bg-[#f5c518] text-black text-sm font-bold shrink-0 disabled:opacity-50 active:scale-95 transition-transform"
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
                      className="flex-1 h-7 px-2 rounded bg-[#1a1a1a] border border-[#444] text-sm text-white"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          e.currentTarget.blur()
                        }
                        if (e.key === 'Escape') setEditandoGrupo(null)
                      }}
                      onBlur={e => { guardarNombreGrupo(g, e.target.value) }}
                    />
                  ) : (
                    <span className="flex-1 text-sm text-white truncate cursor-pointer" onClick={() => setEditandoGrupo(g.id)}>
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
                  <button onClick={() => eliminarGrupo(g.id)} className="text-[#666] hover:text-[#ef4444] transition-colors shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#666] text-center py-4">Aún no tienes grupos. Crea uno para organizar tus clientes por día o zona.</p>
          )}
        </div>
      </Modal>

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
