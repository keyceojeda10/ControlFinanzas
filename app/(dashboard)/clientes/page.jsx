'use client'
// app/(dashboard)/clientes/page.jsx - Lista de clientes

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth }       from '@/hooks/useAuth'
import { useOffline }    from '@/components/providers/OfflineProvider'
import { guardarEnCache, leerDeCache, obtenerClientesOffline } from '@/lib/offline'
import { Button }        from '@/components/ui/Button'
import { Modal }         from '@/components/ui/Modal'
import { SkeletonClienteList } from '@/components/ui/Skeleton'
import ClienteCard       from '@/components/clientes/ClienteCard'
import BadgeNuevo, { NuevoChip } from '@/components/ui/BadgeNuevo'
import { StaggeredList } from '@/components/ui/StaggeredList'
import TarjetaCliente from '@/components/cf/TarjetaCliente'
import { adaptarClientes } from '@/lib/adaptadores/clientes'
import { BarraFiltros } from '@/components/pantallas/ListaClientes'
import ModalWhatsAppTemplates from '@/components/ui/ModalWhatsAppTemplates'
import MonedaCF          from '@/components/ui/MonedaCF'
import Avatar            from '@/components/ui/Avatar'
import { Card }          from '@/components/ui/Card'
import { formatMoney, isHoy } from '@/lib/i18n'
import { useCountry }    from '@/hooks/useCountry'

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

const VISTA_KEY = 'cf-clientes-vista'

const COLOR_OK   = 'var(--color-accent)'
const COLOR_HOT  = '#f97316'
const COLOR_CRIT = 'var(--color-danger)'
const COLOR_OFF  = 'var(--color-text-muted)'

function moodColorCompacto(c) {
  if (c.estado === 'cancelado' || c.estado === 'inactivo') return COLOR_OFF
  if (c.diasMoraMax > 7) return COLOR_CRIT
  if (c.estado === 'mora' || c.diasMoraMax > 0) return COLOR_HOT
  return COLOR_OK
}

function moodLabelCompacto(c) {
  if (c.estado === 'cancelado') return 'Cancelado'
  if (c.estado === 'inactivo')  return 'Inactivo'
  if (c.diasMoraMax > 7)        return `${c.diasMoraMax}d`
  if (c.estado === 'mora' || c.diasMoraMax > 0) return `${c.diasMoraMax || ''}d`.trim()
  if (c.pagoHoy)                return 'Pagó'
  return 'OK'
}

function ClienteCardCompacto({ cliente, esNuevo }) {
  const color = moodColorCompacto(cliente)
  const label = moodLabelCompacto(cliente)
  const saldo = Number(cliente.saldoPendienteTotal ?? 0)
  const tienePrestamo = (cliente.prestamosActivos ?? 0) > 0

  return (
    <Card
      as={Link}
      href={`/clientes/${cliente.id}`}
      glowColor={color}
      padding={false}
      hoverable
      className="block px-2.5 py-2.5 group"
    >
      {/* Row 1: Avatar + nombre */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="relative shrink-0">
          <Avatar
            nombre={cliente.nombre}
            fotoUrl={cliente.fotoUrl}
            size={28}
            fontSize={10}
            style={cliente.fotoUrl ? { border: `1.5px solid ${color}` } : undefined}
          />
          {cliente.pagoHoy && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
              style={{ background: 'var(--color-success)', border: '1.5px solid var(--color-bg-card)' }}
            />
          )}
        </div>
        <p className="text-[12px] font-semibold text-[var(--color-text-primary)] leading-tight flex-1 min-w-0 truncate">
          {cliente.nombre}
        </p>
      </div>

      {/* Row 2: estado + monto */}
      <div className="flex items-center justify-between gap-1">
        <span
          className="inline-flex items-center gap-0.5 text-[8px] font-semibold px-1.5 py-px rounded-full shrink-0"
          style={{ background: `color-mix(in srgb, ${color} 13%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 21%, transparent)` }}
        >
          <span className="w-1 h-1 rounded-full" style={{ background: color }} />
          {label}
        </span>
        {tienePrestamo && (
          <span className="text-[11px] font-mono-display font-bold truncate" style={{ color: cliente.diasMoraMax > 0 ? color : 'var(--color-text-secondary)' }}>
            {formatMoney(saldo)}
          </span>
        )}
      </div>

      {/* Row 3: cobrador + nuevo (solo si aplica) */}
      {(cliente.creadoPor || esNuevo) && (
        <div className="flex items-center justify-between gap-1 mt-1.5">
          {cliente.creadoPor ? (
            <span className="text-[8px] font-medium px-1.5 py-px rounded-full truncate" style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-hover)' }}>
              {cliente.creadoPor.nombre || 'Cobrador'}
            </span>
          ) : <span />}
          {esNuevo && <NuevoChip />}
        </div>
      )}
    </Card>
  )
}

const IconLista = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
)

const IconGrid = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5h4.5v-4.5h-4.5zm0 12v4.5h4.5v-4.5h-4.5zm12-12v4.5h4.5v-4.5h-4.5zm0 12v4.5h4.5v-4.5h-4.5z" />
  </svg>
)

const COLORES_GRUPO = [
  'var(--color-info)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-danger)',
  'var(--color-purple)', 'var(--color-info)', '#ec4899', '#84cc16',
]

export default function ClientesPage() {
  const { esOwner, puedeCrearClientes, puedeCrearPrestamos, orgNombre, ocultarSaldoWA, organizationId, loading: authLoading } = useAuth()
  const { country } = useCountry()
  const { lastSyncedAt } = useOffline()
  const searchParams = useSearchParams()
  const [clientes, setClientes]   = useState([])
  const [buscar,   setBuscar]     = useState('')
  const [estado,   setEstado]     = useState(() => searchParams?.get('filtro') || '')

  // El filtro llega por URL desde las alertas del dashboard (/clientes?filtro=mora).
  // useState solo corre su inicializador AL MONTAR, y eso fallaba en dos casos:
  // si useSearchParams aun no habia resuelto en el primer render, y —siempre—
  // si ya estabas en /clientes y solo cambiaba el query (React no remonta la
  // misma ruta). En ambos casos caias al listado completo sin filtrar.
  const filtroUrlPrevio = useRef(null)
  useEffect(() => {
    const filtroUrl = searchParams?.get('filtro') || ''
    const rutaUrl = searchParams?.get('rutaId') || ''
    const clave = `${filtroUrl}|${rutaUrl}`
    if (clave !== filtroUrlPrevio.current) {
      filtroUrlPrevio.current = clave
      setEstado(filtroUrl)
      // rutaId tambien llega por URL: sin esto, "Clientes de esta ruta" desde
      // el detalle de la ruta caia al listado completo.
      setRutaIdFiltro(rutaUrl)
    }
  }, [searchParams])
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

  const [rutaIdFiltro, setRutaIdFiltro] = useState('')
  const [rutas,        setRutas]       = useState([])
  const [vista, setVista] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(VISTA_KEY) || 'lista'
    return 'lista'
  })

  const cambiarVista = (v) => {
    setVista(v)
    localStorage.setItem(VISTA_KEY, v)
  }

  const [isOffline, setIsOffline] = useState(false)
  const hasLoadedOnceRef = useRef(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const goOnline = () => { setIsOffline(false) }
    window.addEventListener('online', goOnline)
    return () => window.removeEventListener('online', goOnline)
  }, [])

  useEffect(() => {
    const bump = () => { if (hasLoadedOnceRef.current) setRefreshKey(k => k + 1) }
    const onVisible = () => { if (document.visibilityState === 'visible') bump() }
    const onPageShow = (e) => { if (e.persisted) bump() }
    window.addEventListener('focus', bump)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      window.removeEventListener('focus', bump)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])

  useEffect(() => {
    if (!esOwner) return
    fetch('/api/rutas').then(r => r.ok ? r.json() : []).then(data => {
      const list = Array.isArray(data) ? data : (data.rutas || [])
      setRutas(list.map(r => ({ id: r.id, nombre: r.nombre })))
    }).catch(() => {})
  }, [esOwner])

  const fetchClientes = useCallback(async (q, p, grupoId = '', rutaId = '', { soft = false } = {}) => {
    const shouldUseSoftRefresh = soft && hasLoadedOnceRef.current
    setError('')
    setIsOffline(false)
    const cacheKey = `clientes:${q || ''}:${p}:${grupoId || 'all'}:${rutaId || 'all'}`

    // Cache-first: si hay datos cacheados para este filtro, pintarlos al
    // instante y revalidar en segundo plano. Sin cache → skeleton.
    if (!shouldUseSoftRefresh) {
      try {
        const cached = await leerDeCache(cacheKey)
        if (cached && cached.clientes) {
          setClientes(cached.clientes)
          setTotal(cached.total)
          setTotalPages(cached.totalPages)
          setLoading(false)
        } else {
          setLoading(true)
        }
      } catch { setLoading(true) }
    }

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
      if (rutaId) params.set('rutaId', rutaId)
      // Viene de la alerta "N clientes sin ruta asignada" del dashboard.
      // Se lee de window.location y NO del hook: este loader es un useCallback
      // con dependencias vacias, asi que un searchParams capturado aqui se
      // quedaria congelado en el primer render (el mismo bug de closure viejo
      // que hacia que los filtros por URL no se aplicaran).
      if (new URLSearchParams(window.location.search).get('sinRuta') === '1') {
        params.set('sinRuta', '1')
      }
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
          if (!navigator.onLine) setIsOffline(true)
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

  // Cambiar filtro de grupo o ruta reinicia paginación y selección
  useEffect(() => {
    setPage(1)
    setSelAsignar([])
  }, [grupoFiltro, rutaIdFiltro])

  // Carga de clientes con debounce
  useEffect(() => {
    const t = setTimeout(() => fetchClientes(buscar, page, grupoFiltro, rutaIdFiltro, { soft: refreshKey > 0 }), 280)
    return () => clearTimeout(t)
  }, [fetchClientes, buscar, page, grupoFiltro, rutaIdFiltro, refreshKey])

  // Refresh silencioso cuando hay nueva sincronización global.
  useEffect(() => {
    if (!lastSyncedAt) return
    fetchClientes(buscar, page, grupoFiltro, rutaIdFiltro, { soft: true })
  }, [lastSyncedAt, fetchClientes, buscar, page, grupoFiltro, rutaIdFiltro])

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
      fetchClientes(buscar, page, grupoFiltro, rutaIdFiltro, { soft: true })
      return true
    } catch {}
    setError('No se pudo actualizar el grupo.')
    return false
  }

  const guardarNombreGrupo = async (grupo, valorCrudo) => {
    const nombreLimpio = valorCrudo.trim()
    if (!nombreLimpio) {
      setError('El nombre del grupo no puede quedar vacío.')
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
      fetchClientes(buscar, page, grupoFiltro === grupoId ? '' : grupoFiltro, rutaIdFiltro, { soft: true })
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
      fetchClientes(buscar, page, grupoFiltro, rutaIdFiltro, { soft: true })
      fetchGrupos()
    } catch {
      setError('No se pudo asignar el grupo a los clientes seleccionados.')
    } finally {
      setAsignandoGrupo(false)
    }
  }

  const moraCount = clientes.filter((c) => c.estado === 'mora').length
  const filtrosActivos = (estado ? 1 : 0) + (grupoFiltro ? 1 : 0) + (rutaIdFiltro ? 1 : 0)
  const tieneBusqueda = !!buscar.trim()
  const grupoActivoLabel = grupoFiltro === '_none'
    ? 'Sin grupo'
    : (grupos.find((g) => g.id === grupoFiltro)?.nombre || '')
  const hayControlesActivos = tieneBusqueda || filtrosActivos > 0 || modoAsignar

  const limpiarControles = () => {
    setBuscar('')
    setEstado('')
    setGrupoFiltro('')
    setRutaIdFiltro('')
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
    <div className={`max-w-3xl lg:max-w-6xl mx-auto ${modoAsignar ? 'pb-40 lg:pb-28' : ''}`}>
      {/* ── Cabecera de pantalla de navegación ──
          Sin título propio: la cabecera del armazón ya dice dónde estás, y un
          <h1> "Clientes" bajo un icono de Clientes es decir lo mismo dos veces.
          Lo que va aquí es lo que la pantalla necesita para trabajar: buscar y
          filtrar.

          Antes había título, subtítulo, un botón dorado, "Pasar mi cuaderno",
          buscador, TRES filas de chips (estado, frecuencia, modo), un desplegable
          de rutas y un conmutador de vista. Unos 380px antes del primer cliente.
          Los filtros secundarios pasan a la hoja de "Más filtros". */}
      <div className="flex flex-col gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--cf-ink-3)' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              value={buscar}
              onChange={(e) => { setBuscar(e.target.value); setPage(1) }}
              placeholder={modoAsignar ? 'Buscar para asignar…' : 'Buscar cliente…'}
              style={{
                width: '100%', height: 'var(--cf-h-field)', paddingLeft: 42, paddingRight: 14,
                borderRadius: 999, background: 'var(--cf-card)',
                border: '1px solid var(--cf-border)', outline: 'none',
                fontSize: 16, color: 'var(--cf-ink)',
              }}
            />
          </div>
          {!authLoading && puedeCrearClientes && (
            <Link href="/clientes/nuevo" className="shrink-0" aria-label="Nuevo cliente">
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 'var(--cf-h-field)', height: 'var(--cf-h-field)', borderRadius: 999,
                background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </Link>
          )}
        </div>

        {/* Cada filtro con SU CONTEO: sin el número, elegir es a ciegas y hay
            que aplicarlo para saber si había algo. */}
        <BarraFiltros
          activo={estado}
          onCambiar={(v) => { setEstado(v); setPage(1) }}
          filtros={ESTADOS_CLIENTE.map(({ value, label }) => ({
            id: value,
            nombre: label,
            // Mientras carga NO se pone conteo. Un "· 0" que todavia no es
            // cierto se lee como "no hay ninguno" y hace descartar el filtro
            // antes de que llegue el dato.
            conteo: loading ? undefined
              : value === '' ? total
              : value === 'mora' ? moraCount
              : clientes.filter((c) => c.estado === value).length,
          }))}
        />
      </div>

      {/* Offline indicator */}
      {isOffline && (
        <div className="bg-[var(--color-warning-dim)] border border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)] text-[var(--color-warning)] text-xs rounded-[12px] px-4 py-2.5 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse shrink-0" />
          Datos guardados — sin conexión
        </div>
      )}

      {/* Error — solo mostrar si ya teniamos datos o si no es la primera carga */}
      {error && total > 0 && (
        <div className="bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[12px] px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Skeleton */}
      {loading && <SkeletonClienteList />}

      {/* Lista */}
      {!loading && clientes.length > 0 && (() => {
        // OJO: el estado del cliente (al dia / mora / cancelado) se calcula en
        // el servidor con calcularEstadoCliente(), no es una columna, asi que
        // no se puede filtrar en el `where` de Prisma. Este filtro corre sobre
        // la PAGINA ACTUAL (50 registros), no sobre la cartera entera: por eso
        // el dashboard puede decir "18 en mora" y aca aparecer 4.
        // Mientras no exista el filtro server-side, al menos se avisa en vez de
        // dar un numero falso por bueno.
        const filtrados = estado ? clientes.filter((c) => c.estado === estado) : clientes
        // Las tarjetas del rediseño: superficie SIEMPRE blanca y el estado en un
        // riel de 4px. Lo anterior teñía la tarjeta entera de rosa o ámbar, y
        // con media cartera en mora eso es un muro donde nada destaca porque
        // todo destaca. Es la razón por la que se rediseñó esta pantalla.
        //
        // Las acciones en línea (WhatsApp, cobrar) salen de la tarjeta: se toca
        // para abrir la ficha, y ahí viven. Una lista es para mirar.
        const adaptados = adaptarClientes(filtrados, country)
        return filtrados.length > 0 ? (
          <StaggeredList className={vista === 'compacta' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2' : 'flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3'}>
            {filtrados.map((c, i) => (
              modoAsignar ? (
                <label
                  key={c.id}
                  className={[
                    'flex items-center gap-3 border rounded-[12px] p-4 transition-all cursor-pointer',
                    selAsignar.includes(c.id)
                      ? 'border-[color-mix(in_srgb,var(--color-accent)_35%,transparent)] bg-[var(--color-accent-soft)]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[color-mix(in_srgb,var(--color-accent)_40%,transparent)]',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={selAsignar.includes(c.id)}
                    onChange={() => toggleSeleccion(c.id)}
                    className="accent-[var(--color-accent)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{c.nombre}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">CC {c.cedula}</p>
                  </div>
                </label>
              ) : vista === 'compacta' ? (
                <BadgeNuevo key={c.id} fecha={c.createdAt}>
                  <ClienteCardCompacto cliente={c} esNuevo={isHoy(c.createdAt, country)} />
                </BadgeNuevo>
              ) : (
                <TarjetaCliente
                  key={c.id}
                  {...adaptados[i]}
                  onClick={() => { window.location.href = `/clientes/${c.id}` }}
                />
              )
            ))}
          </StaggeredList>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Sin clientes {estado === 'mora' ? 'en mora' : estado === 'activo' ? 'al día' : 'cancelados'}</p>
            <button onClick={() => setEstado('')} className="mt-2 text-xs text-[var(--color-accent)] hover:underline">
              Ver todos
            </button>
          </div>
        )
      })()}

      {/* Error en la carga inicial (sin cache ni datos previos) — con accion de reintento */}
      {!loading && error && total === 0 && clientes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4">
            <MonedaCF pose="busca" size={100} />
          </div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">No pudimos cargar tus clientes</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Revisa tu conexión e intenta de nuevo</p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => fetchClientes(buscar, page, grupoFiltro, rutaIdFiltro)}
          >
            Reintentar
          </Button>
        </div>
      )}

      {/* Estado vacío (sin error) */}
      {!loading && !error && clientes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4">
            <MonedaCF pose={buscar || grupoFiltro ? 'busca' : 'vacia'} size={100} />
          </div>
          {buscar ? (
            <>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Sin resultados</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">No se encontró ningún cliente con "{buscar}"</p>
              <button onClick={() => setBuscar('')} className="mt-3 text-xs text-[var(--color-accent)] hover:underline">
                Limpiar búsqueda
              </button>
            </>
          ) : grupoFiltro ? (
            <>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Sin clientes en este grupo</p>
              <button onClick={() => setGrupoFiltro('')} className="mt-3 text-xs text-[var(--color-accent)] hover:underline">
                Ver todos los grupos
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">No hay clientes aún</p>
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
          <div className="flex gap-1 p-1 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
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
                    ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)]'
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
                      ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-soft)]'
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
                      ? 'border-[var(--color-info)] text-[var(--color-info)] bg-[var(--color-info-dim)]'
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
                        ? { color: c, borderColor: c, background: `color-mix(in srgb, ${c} 12%, transparent)` }
                        : { color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                      {g.nombre}
                      <span className="text-[10px] opacity-70">{g._count?.clientes ?? 0}</span>
                    </button>
                  )
                })}
              </div>
              {grupos.length === 0 && (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
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
                  className="h-9 px-4 rounded-lg bg-[var(--color-accent)] text-[var(--color-accent-text)] text-sm font-bold shrink-0 disabled:opacity-50 active:scale-95 transition-transform"
                >
                  {guardandoGrupo ? '...' : 'Crear'}
                </button>
              </div>

              <div className="flex gap-2 flex-wrap">
                {COLORES_GRUPO.map(c => (
                  <button
                    key={c}
                    onClick={() => setGrupoColor(grupoColor === c ? null : c)}
                    className={`w-7 h-7 rounded-full transition-all ${grupoColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--color-bg-base)] scale-110' : 'hover:scale-110'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>

              {grupos.length > 0 ? (
                <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
                  {grupos.map(g => (
                    <div key={g.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--color-bg-hover)] border border-[var(--color-border)]">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: g.color || 'var(--color-text-muted)' }} />
                      {editandoGrupo === g.id ? (
                        <input
                          defaultValue={g.nombre}
                          autoFocus
                          className="flex-1 h-7 px-2 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-hover)] text-sm text-[var(--color-text-primary)]"
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
                      <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">{g._count?.clientes ?? 0}</span>
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
                      <button onClick={() => eliminarGrupo(g.id)} className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-4">Aún no tienes grupos. Crea uno para organizar tus clientes por día o zona.</p>
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
                <p className="text-[11px] text-[var(--color-warning)] text-center">
                  Primero crea al menos un grupo en la pestaña "Gestionar".
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Sticky bar: modo asignación activo (posicionada encima del BottomNav móvil) */}
      {modoAsignar && (
        <div className="fixed left-0 right-0 z-50 border-t border-[color-mix(in_srgb,var(--color-accent)_40%,transparent)] bg-[var(--color-bg-base)] lg:bg-[var(--color-bg-base)]/98 lg:backdrop-blur-md bottom-[84px] lg:bottom-0 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
          <div className="max-w-3xl lg:max-w-6xl mx-auto px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-xs text-[var(--color-accent)] font-semibold">
                {selAsignar.length} {selAsignar.length === 1 ? 'seleccionado' : 'seleccionados'}
              </div>
              <button
                onClick={cancelarAsignacion}
                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline underline-offset-2"
              >
                Cancelar
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={grupoAsignar}
                onChange={(e) => setGrupoAsignar(e.target.value)}
                className="flex-1 min-w-0 h-10 px-2 rounded-lg bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)]"
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
                className="shrink-0 h-10 px-4 rounded-lg bg-[var(--color-accent)] text-[var(--color-accent-text)] text-xs font-bold disabled:opacity-40 active:scale-95 transition-transform"
              >
                {asignandoGrupo ? '...' : 'Asignar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paginación */}
      {/* Con un chip de estado activo el paginador es mentira: filtra sobre la
          pagina actual, asi que "Pagina 1 de 6" sugiere que hay mas morosos
          adelante cuando en realidad cada pagina se filtra por separado. */}
      {!loading && estado && totalPages > 1 && (
        <p className="text-center text-[12px] mt-4 px-4" style={{ color: 'var(--color-text-muted)' }}>
          Mostrando los de esta página. Para ver toda la cartera en mora, usa la alerta del inicio.
        </p>
      )}
      {!loading && !estado && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Anterior
          </button>
          <span className="text-xs text-[var(--color-text-muted)]">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
        orgNombre={orgNombre}
        ocultarSaldo={ocultarSaldoWA}
        organizationId={organizationId}
      />
    </div>
  )
}

