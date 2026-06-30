'use client'
// app/(dashboard)/clientes/[id]/page.jsx - Detalle del cliente

import { useState, useEffect, useRef, useCallback, use } from 'react'
import { useRouter }                 from 'next/navigation'
import Link                          from 'next/link'
import { useAuth }                   from '@/hooks/useAuth'
import { useOffline }                from '@/components/providers/OfflineProvider'
import { obtenerClienteOffline, resolverTempId }     from '@/lib/offline'
import { obtenerCoordsRapido }                       from '@/lib/geo'
import { Badge }                     from '@/components/ui/Badge'
import { Button }                    from '@/components/ui/Button'
import { Card }                      from '@/components/ui/Card'
import { SkeletonCard }              from '@/components/ui/Skeleton'
import BotonWhatsApp                 from '@/components/ui/BotonWhatsApp'
import ModalWhatsAppTemplates        from '@/components/ui/ModalWhatsAppTemplates'
import { formatFechaCobroRelativa } from '@/lib/calculos'
import { formatMoney } from '@/lib/i18n'
import { planTieneFotos }            from '@/lib/planes'
import ScoreCrediticio               from '@/components/clientes/ScoreCrediticio'
import ClienteHeroCard, { InfoContactoCard, AccionesClienteChips } from '@/components/clientes/ClienteHeroCard'
import AiTipBanner from '@/components/ui/AiTipBanner'
import { generarTipCliente } from '@/lib/tips/clienteTips'
import ReagendarVisitaModal from '@/components/visitas/ReagendarVisitaModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

const estadoBadge = {
  activo:    { variant: 'green',  label: 'Al día'    },
  mora:      { variant: 'red',    label: 'En mora'   },
  cancelado: { variant: 'gray',   label: 'Cancelado' },
  inactivo:  { variant: 'gray',   label: 'Inactivo'  },
}

const estadoPrestamoBadge = {
  activo:     { variant: 'blue',   label: 'Activo'     },
  completado: { variant: 'green',  label: 'Completado' },
  cancelado:  { variant: 'gray',   label: 'Cancelado'  },
}

export default function ClienteDetallePage({ params }) {
  const { id }     = use(params)
  const router     = useRouter()
  const { esOwner, puedeCrearPrestamos, puedeEditarClientes, plan, orgNombre } = useAuth()

  const { lastSyncedAt } = useOffline()

  const [cliente, setCliente]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [deleteData, setDeleteData] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [modalWA, setModalWA] = useState(false)
  const [modalReagendar, setModalReagendar] = useState(false)
  const [rutaNav, setRutaNav]   = useState(null)
  const [festivoHoy, setFestivoHoy] = useState(null)
  const [guardandoFestivo, setGuardandoFestivo] = useState(false)
  const [confirmGPS, setConfirmGPS] = useState(null)
  const [confirmDeletePrestamo, setConfirmDeletePrestamo] = useState(null)
  const [bannerCartulina, setBannerCartulina] = useState(null)

  // Leer datos de préstamo pendientes de cartulina
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('cf-cartulina-prestamo')
      if (!raw) return
      const datos = JSON.parse(raw)
      if (datos.clienteId === id) {
        setBannerCartulina(datos)
      } else {
        sessionStorage.removeItem('cf-cartulina-prestamo')
      }
    } catch {}
  }, [id])

  const cerrarBannerCartulina = () => {
    setBannerCartulina(null)
    try { sessionStorage.removeItem('cf-cartulina-prestamo') } catch {}
  }

  // Leer contexto de ruta activa
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('cf-ruta-nav')
      if (!saved) return
      const nav = JSON.parse(saved)
      const idx = nav.clientes.findIndex(c => c.id === id)
      if (idx >= 0) {
        setRutaNav({ ...nav, currentIndex: idx })
      }
    } catch {}
  }, [id])

  const [isOffline, setIsOffline] = useState(false)
  const hasLoadedOnceRef = useRef(false)

  const fetchCliente = useCallback(async ({ soft = false } = {}) => {
    const shouldUseSoftRefresh = soft && hasLoadedOnceRef.current
    if (!shouldUseSoftRefresh) setLoading(true)
    setIsOffline(false)

    // Temp ID (creado offline) — si ya se sincronizó, redirigir al ID real
    if (typeof id === 'string' && id.startsWith('offline-')) {
      try {
        const realId = await resolverTempId(id)
        if (realId) {
          router.replace(`/clientes/${realId}`)
          return
        }
      } catch {}
      try {
        const cached = await obtenerClienteOffline(id)
        if (cached) {
          setCliente(cached)
          setIsOffline(true)
          if (!shouldUseSoftRefresh) setLoading(false)
          hasLoadedOnceRef.current = true
          return
        }
      } catch {}
    }

    // Offline: prefer IndexedDB (SW cache may be stale)
    if (!navigator.onLine) {
      try {
        const cached = await obtenerClienteOffline(id)
        if (cached) {
          setCliente(cached)
          setIsOffline(true)
          if (!shouldUseSoftRefresh) setLoading(false)
          hasLoadedOnceRef.current = true
          return
        }
      } catch {}
    }

    try {
      const res = await fetch(`/api/clientes/${id}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.offline) throw new Error('offline')
      setCliente(data)
    } catch {
      try {
        const cached = await obtenerClienteOffline(id)
        if (cached) {
          setCliente(cached)
          setIsOffline(true)
          if (!shouldUseSoftRefresh) setLoading(false)
          hasLoadedOnceRef.current = true
          return
        }
      } catch {}
      if (!shouldUseSoftRefresh) setError('No se pudo cargar el cliente.')
    } finally {
      if (!shouldUseSoftRefresh) setLoading(false)
      hasLoadedOnceRef.current = true
    }
  }, [id])

  useEffect(() => {
    fetchCliente()
    if (esOwner) {
      fetch('/api/festivos')
        .then(r => r.json())
        .then(d => {
          const hoyStr = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().split('T')[0]
          const hoy = (d.festivos ?? []).find(f => new Date(f.fecha).toISOString().split('T')[0] === hoyStr)
          setFestivoHoy(hoy ?? null)
        })
        .catch(() => {})
    }
  }, [fetchCliente, esOwner])

  // Re-fetch silently when offline payments get synced
  useEffect(() => {
    if (lastSyncedAt > 0) {
      fetchCliente({ soft: true })
    }
  }, [lastSyncedAt, fetchCliente])

  const handleDelete = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/clientes/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error === 'tiene_prestamos') {
        setDeleteData(data.prestamos)
        setShowDeleteModal(true)
        return
      }
      if (!res.ok) { alert(data.error || 'Error'); return }
      router.push('/clientes')
    } catch { alert('Error de conexión') }
    finally { setActionLoading(false) }
  }

  const marcarFestivoHoy = async () => {
    setGuardandoFestivo(true)
    try {
      const hoyStr = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().split('T')[0]
      const res = await fetch('/api/festivos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: hoyStr, nombre: 'Festivo' }),
      })
      const data = await res.json()
      if (res.ok) setFestivoHoy(data.festivo)
    } finally { setGuardandoFestivo(false) }
  }

  const quitarFestivoHoy = async () => {
    if (!festivoHoy) return
    setGuardandoFestivo(true)
    try {
      await fetch(`/api/festivos/${festivoHoy.id}`, { method: 'DELETE' })
      setFestivoHoy(null)
    } finally { setGuardandoFestivo(false) }
  }

  const handleToggleInactivo = async () => {
    setActionLoading(true)
    try {
      const accion = cliente.estado === 'inactivo' ? 'activar' : 'inactivar'
      const res = await fetch(`/api/clientes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      })
      if (!res.ok) {
        const d = await res.json()
        // Mismo flujo que el borrado: si tiene préstamos activos, mostrar el modal
        // para eliminarlos/trasladarlos (eliminar devuelve el capital al saldo).
        if (d.error === 'tiene_prestamos') {
          setDeleteData(d.prestamos)
          setShowDeleteModal(true)
          return
        }
        alert(d.error || 'Error'); return
      }
      const updated = await res.json()
      setCliente(prev => ({ ...prev, estado: updated.estado }))
    } catch { alert('Error de conexión') }
    finally { setActionLoading(false) }
  }

  // Fijar ubicacion del cliente con el GPS del telefono. Pensado para usar
  // en campo: el cobrador toca el chip al estar frente al cliente y queda
  // marcado en el mapa para futuros cobros geolocalizados.
  const [fijandoGPS, setFijandoGPS] = useState(false)
  const handleFijarUbicacion = async () => {
    if (fijandoGPS) return
    const yaTiene = cliente?.latitud != null && cliente?.longitud != null
    setConfirmGPS({ yaTiene })
  }

  const _doFijarUbicacion = async () => {
    setConfirmGPS(null)
    setFijandoGPS(true)
    try {
      const coords = await obtenerCoordsRapido(8000)
      if (!coords) {
        alert('No se pudo obtener tu ubicación. Verifica que el GPS este activo y que diste permiso al navegador.')
        return
      }
      const res = await fetch(`/api/clientes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitud: coords.latitud, longitud: coords.longitud }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Error al guardar'); return }
      setCliente(prev => ({ ...prev, latitud: coords.latitud, longitud: coords.longitud }))
    } catch {
      alert('Error de conexión')
    } finally {
      setFijandoGPS(false)
    }
  }

  const handleDeletePrestamo = async (prestamoId) => {
    setConfirmDeletePrestamo(prestamoId)
  }

  const _doDeletePrestamo = async (prestamoId) => {
    setConfirmDeletePrestamo(null)
    setActionLoading(true)
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); alert(d.error || 'Error'); return }
      setDeleteData(prev => prev.filter(p => p.id !== prestamoId))
      setCliente(prev => ({ ...prev, prestamos: prev.prestamos.filter(p => p.id !== prestamoId) }))
    } catch { alert('Error de conexión') }
    finally { setActionLoading(false) }
  }

  const handleTrasladar = async (prestamoId, clienteDestinoId) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}/trasladar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteDestinoId }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Error'); return }
      alert(data.message)
      setDeleteData(prev => prev.filter(p => p.id !== prestamoId))
      setCliente(prev => ({ ...prev, prestamos: prev.prestamos.filter(p => p.id !== prestamoId) }))
    } catch { alert('Error de conexión') }
    finally { setActionLoading(false) }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (error || !cliente) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] rounded-[16px] p-6 text-center">
          <p className="font-semibold mb-2">Cliente no encontrado</p>
          <button onClick={() => router.back()} className="text-sm underline">Volver</button>
        </div>
      </div>
    )
  }

  const badge = estadoBadge[cliente.estado] ?? estadoBadge.cancelado
  const prestamosActivos = cliente.prestamos?.filter((p) => p.estado === 'activo') ?? []
  const historial        = cliente.prestamos?.filter((p) => p.estado !== 'activo')  ?? []

  const getRutaCobroUrl = (clienteRuta) => {
    const prestamosIds = Array.isArray(clienteRuta?.prestamosActivosIds)
      ? clienteRuta.prestamosActivosIds.filter(Boolean)
      : (clienteRuta?.prestamoActivo ? [clienteRuta.prestamoActivo] : [])

    if (prestamosIds.length === 1) {
      return `/prestamos/${prestamosIds[0]}?openPago=1&fromRuta=1`
    }
    return `/clientes/${clienteRuta.id}`
  }

  const navegarEnRuta = (direction) => {
    if (!rutaNav) return
    const newIdx = rutaNav.currentIndex + direction
    if (newIdx < 0 || newIdx >= rutaNav.clientes.length) return
    const next = rutaNav.clientes[newIdx]
    // Actualizar contexto
    sessionStorage.setItem('cf-ruta-nav', JSON.stringify({ ...rutaNav, currentIndex: newIdx }))
    // Actualizar progreso de ruta
    const getColombiaDateStr = () => new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
    localStorage.setItem(`cf-ruta-progress-${rutaNav.rutaId}`, JSON.stringify({
      clienteId: next.id,
      clienteNombre: next.nombre,
      index: newIdx,
      date: getColombiaDateStr(),
    }))
    const url = getRutaCobroUrl(next)
    if (navigator.onLine) {
      router.push(url)
    } else {
      window.location.href = url
    }
  }

  const irSiguienteEnRuta = () => navegarEnRuta(1)
  const noPagoSiguiente = () => navegarEnRuta(1)

  const esUltimoEnRuta = rutaNav && rutaNav.currentIndex >= rutaNav.clientes.length - 1
  const esPrimeroEnRuta = rutaNav && rutaNav.currentIndex <= 0

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {rutaNav ? rutaNav.rutaNombre : 'Clientes'}
      </button>

      {/* Barra de navegación de ruta */}
      {rutaNav && (
        <div className="bg-[rgba(245,197,24,0.06)] border border-[rgba(245,197,24,0.15)] rounded-[14px] px-3 py-2.5 flex items-center justify-between">
          <button
            onClick={() => navegarEnRuta(-1)}
            disabled={esPrimeroEnRuta}
            className="p-1.5 rounded-[8px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] disabled:opacity-30 active:scale-95 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center min-w-0 px-2">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">{rutaNav.rutaNombre}</p>
            <p className="text-xs text-[var(--color-text-primary)] font-medium">{rutaNav.currentIndex + 1} de {rutaNav.clientes.length}</p>
          </div>
          <button
            onClick={irSiguienteEnRuta}
            disabled={esUltimoEnRuta}
            className="p-1.5 rounded-[8px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] disabled:opacity-30 active:scale-95 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Banner cartulina — préstamo detectado pendiente de crear */}
      {bannerCartulina && (
        <div className="mb-4 rounded-[12px] px-3.5 py-3 flex items-start gap-3" style={{ background: 'color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-card))', border: '1px solid color-mix(in srgb, var(--color-accent) 25%, var(--color-border))' }}>
          <svg className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-accent)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">Préstamo detectado en la cartulina</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              {bannerCartulina.montoPrestado ? `${Number(bannerCartulina.montoPrestado).toLocaleString('es-CO')} · ` : ''}
              {bannerCartulina.frecuencia ?? ''}{bannerCartulina.esEnCurso ? ' · En curso' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/prestamos/nuevo?clienteId=${id}&fromCartulina=1`}
              onClick={() => {}}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-[8px] bg-[var(--color-accent)] text-[#111] hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              Crear préstamo
            </Link>
            <button onClick={cerrarBannerCartulina} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-[rgba(255,255,255,0.1)] transition-colors" style={{ color: 'var(--color-text-muted)' }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* HERO CARD: Saldo total + avatar + chip estado + WA */}
      <ClienteHeroCard
        cliente={cliente}
        prestamosActivos={prestamosActivos}
        stats={historial.length > 0
          ? `${historial.filter(p => p.estado === 'completado').length} préstamo${historial.filter(p => p.estado === 'completado').length === 1 ? '' : 's'} completado${historial.filter(p => p.estado === 'completado').length === 1 ? '' : 's'} antes`
          : null}
        onWhatsApp={cliente.telefono ? () => setModalWA(true) : null}
        puedeSubirFoto={(puedeEditarClientes || esOwner) && planTieneFotos(plan)}
        onFotoActualizada={(url) => setCliente(prev => ({ ...prev, fotoUrl: url }))}
      />

      {/* Tip IA contextual */}
      <AiTipBanner tip={generarTipCliente(cliente, prestamosActivos)} pageKey={`cliente-${cliente.id}`} />

      {/* Score crediticio (si aplica al plan) */}
      <div className="flex">
        <ScoreCrediticio cedula={cliente.cedula} plan={plan} />
      </div>

      {/* Acciones rapidas como chips */}
      {(puedeCrearPrestamos || puedeEditarClientes || esOwner) && (
        <AccionesClienteChips
          acciones={[
            ...(puedeCrearPrestamos ? [{
              label: 'Nuevo préstamo',
              color: '#22c55e',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
              onClick: () => router.push(`/prestamos/nuevo?clienteId=${cliente.id}`),
            }] : []),
            {
              label: 'Reagendar visita',
              color: '#f59e0b',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
              onClick: () => setModalReagendar(true),
            },
            ...(puedeEditarClientes ? [{
              // GPS aqui mismo, en campo. Sin tener que entrar a "Editar".
              label: fijandoGPS
                ? 'Capturando GPS...'
                : (cliente.latitud != null && cliente.longitud != null ? 'Actualizar ubicación' : 'Fijar ubicación (GPS)'),
              color: '#14b8a6',
              icon: (
                <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              ),
              onClick: handleFijarUbicacion,
              disabled: fijandoGPS,
            }] : []),
            {
              label: 'Historial',
              color: '#3b82f6',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
              onClick: () => router.push(`/clientes/${id}/historial`),
            },
            ...(puedeEditarClientes ? [{
              label: 'Editar',
              color: '#a855f7',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>,
              onClick: () => router.push(`/clientes/${id}/editar`),
            }] : []),
            ...(esOwner ? [{
              label: cliente.estado === 'inactivo' ? 'Activar' : 'Inactivar',
              color: cliente.estado === 'inactivo' ? '#22c55e' : '#f59e0b',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
              onClick: handleToggleInactivo,
              disabled: actionLoading,
            }] : []),
            ...(esOwner ? [{
              label: 'Eliminar',
              color: '#ef4444',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>,
              onClick: () => setShowConfirmDelete(true),
              disabled: actionLoading,
            }] : []),
          ]}
        />
      )}

      {/* Festivo hoy (solo owner) */}
      {esOwner && (
        <button
          onClick={festivoHoy ? quitarFestivoHoy : marcarFestivoHoy}
          disabled={guardandoFestivo}
          className={[
            'flex items-center gap-1.5 h-8 rounded-[10px] border text-xs px-2.5 transition-all disabled:opacity-50',
            festivoHoy
              ? 'border-[#22c55e] text-[#22c55e] bg-[rgba(34,197,94,0.08)]'
              : 'border-[#2a2a2a] text-[#a0a0a0] hover:border-[#22c55e] hover:text-[#22c55e]',
          ].join(' ')}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5m-9-6h.008v.008H12V13.5zm0 3h.008v.008H12v-3zm-3 3h.008v.008H9V16.5zm0-3h.008v.008H9V13.5zm6 3h.008v.008H15V16.5zm0-3h.008v.008H15V13.5z" />
          </svg>
          {guardandoFestivo ? 'Guardando…' : festivoHoy ? 'Hoy es festivo — toca para quitar' : 'Festivo hoy'}
        </button>
      )}

      {/* Info de contacto */}
      <InfoContactoCard cliente={cliente} />

      {/* Tope de préstamo — owner edita, cobrador solo ve */}
      {(esOwner || cliente.montoMaximoPrestamo > 0) && (
        <TopePrestamoCard
          tope={cliente.montoMaximoPrestamo}
          onSave={esOwner ? async (nuevoTope) => {
            const res = await fetch(`/api/clientes/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ montoMaximoPrestamo: nuevoTope }),
            })
            if (!res.ok) throw new Error('Error al guardar')
            setCliente(prev => ({ ...prev, montoMaximoPrestamo: nuevoTope }))
          } : null}
        />
      )}

      {/* Préstamos activos */}
      {prestamosActivos.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] mb-3 uppercase tracking-wide">
            Préstamos activos
          </h2>
          <div className="space-y-3">
            {prestamosActivos.map((p) => (
              <PrestamoCard key={p.id} prestamo={p} clienteId={id} cliente={cliente} orgNombre={orgNombre} />
            ))}
          </div>
        </div>
      )}

      {/* Líneas de crédito */}
      {cliente.lineasCredito?.filter(lc => lc.estado === 'activa').length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] mb-3 uppercase tracking-wide">
            Lineas de credito
          </h2>
          <div className="space-y-3">
            {cliente.lineasCredito.filter(lc => lc.estado === 'activa').map(lc => {
              const porcentaje = lc.cupoMaximo > 0 ? Math.round((lc.capitalUsado || 0) / lc.cupoMaximo * 100) : 0
              return (
                <Card
                  key={lc.id}
                  as={Link}
                  href={`/lineas-credito/${lc.id}`}
                  hoverable
                  padding={false}
                  glowColor="#8b5cf6"
                  className="block px-4 py-3.5"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" style={{ color: '#8b5cf6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      <span className="text-xs font-semibold text-[var(--color-text-primary)]">Linea de credito</span>
                    </div>
                    <span
                      className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: '#8b5cf620', color: '#8b5cf6', border: '1px solid #8b5cf635' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#8b5cf6' }} />
                      Activa
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-2">
                    <div>
                      <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">Cupo</p>
                      <p className="text-xs font-mono-display font-bold text-[var(--color-text-primary)] mt-0.5">{formatMoney(lc.cupoMaximo)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">Usado</p>
                      <p className="text-xs font-mono-display font-bold text-[var(--color-text-primary)] mt-0.5">{formatMoney(lc.capitalUsado || 0)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">Disponible</p>
                      <p className="text-xs font-mono-display font-bold mt-0.5" style={{ color: '#8b5cf6' }}>{formatMoney(lc.cupoDisponible || 0)}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-[var(--color-text-muted)]">Uso del cupo</span>
                      <span className="font-mono-display font-semibold" style={{ color: porcentaje > 80 ? 'var(--color-danger)' : '#8b5cf6' }}>{porcentaje}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(porcentaje, 2)}%`,
                          background: porcentaje > 80 ? 'var(--color-danger)' : 'linear-gradient(90deg, #8b5cf6cc, #8b5cf6)',
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-2">Tasa: {lc.tasaInteres}% mensual · Corte dia {lc.diaCorte}</p>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Sin préstamos activos */}
      {prestamosActivos.length === 0 && (
        <Card>
          <div className="text-center py-4">
            <p className="text-sm text-[var(--color-text-muted)]">Sin préstamos activos</p>
            {puedeCrearPrestamos && (
              <div className="mt-3">
                <p className="text-xs text-[var(--color-text-muted)] mb-2">Siguiente paso recomendado: crear el primer préstamo.</p>
                <Link href={`/prestamos/nuevo?clienteId=${id}`}>
                  <Button size="sm">Crear préstamo ahora</Button>
                </Link>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] mb-3 uppercase tracking-wide">
            Historial
          </h2>
          <div className="space-y-2.5">
            {historial.map((p) => (
              <PrestamoCard key={p.id} prestamo={p} clienteId={id} mini />
            ))}
          </div>
        </div>
      )}

      {/* Navegación ruta: botones de acción */}
      {rutaNav && (
        <div className="flex gap-2">
          {!esUltimoEnRuta ? (
            <>
              <button
                onClick={noPagoSiguiente}
                className="flex-1 py-3 rounded-[14px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-sm font-medium active:scale-[0.98] transition-all"
              >
                No pagó · Siguiente
              </button>
              <button
                onClick={irSiguienteEnRuta}
                className="flex-1 py-3 rounded-[14px] bg-[var(--color-accent)] text-[#1a1a2e] text-sm font-semibold active:scale-[0.98] transition-all"
              >
                Siguiente cliente →
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                sessionStorage.removeItem('cf-ruta-nav')
                const url = `/rutas/${rutaNav.rutaId}`
                navigator.onLine ? router.push(url) : (window.location.href = url)
              }}
              className="flex-1 py-3 rounded-[14px] bg-[var(--color-success)] text-[var(--color-text-primary)] text-sm font-semibold active:scale-[0.98] transition-all"
            >
              Ruta finalizada →
            </button>
          )}
        </div>
      )}

      {/* Modal: confirmar eliminación */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/70 px-0 sm:px-4" onClick={() => setShowConfirmDelete(false)}>
          <div
            className="w-full sm:max-w-sm bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-t-[20px] sm:rounded-[20px] p-5"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-[rgba(239,68,68,0.12)] flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--color-danger)]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Eliminar cliente</h3>
              <p className="text-sm text-[var(--color-text-muted)] text-center">
                Vas a eliminar a <span className="font-medium text-[var(--color-text-primary)]">{cliente.nombre}</span>. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 h-11 rounded-[12px] border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setShowConfirmDelete(false); handleDelete() }}
                disabled={actionLoading}
                className="flex-1 h-11 rounded-[12px] bg-[var(--color-danger)] text-white text-sm font-semibold hover:bg-[#dc2626] transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: cliente tiene préstamos */}
      {showDeleteModal && deleteData && (
        <DeleteClienteModal
          cliente={cliente}
          prestamos={deleteData}
          onClose={() => { setShowDeleteModal(false); setDeleteData(null) }}
          onDeletePrestamo={handleDeletePrestamo}
          onTrasladar={handleTrasladar}
          onRetryDelete={handleDelete}
          loading={actionLoading}
          clienteId={id}
        />
      )}

      {/* Modal selector de plantillas WhatsApp */}
      <ModalWhatsAppTemplates
        open={modalWA}
        onClose={() => setModalWA(false)}
        cliente={cliente}
        prestamo={prestamosActivos[0] || null}
        orgNombre={orgNombre}
      />

      {/* Modal reagendar visita */}
      <ReagendarVisitaModal
        open={modalReagendar}
        onClose={() => setModalReagendar(false)}
        clienteId={cliente.id}
        clienteNombre={cliente.nombre}
        prestamoId={prestamosActivos[0]?.id || null}
        rutaId={cliente.rutaId || null}
      />

      <ConfirmModal
        open={!!confirmGPS}
        title="Fijar ubicación"
        message={confirmGPS?.yaTiene
          ? 'Vas a reemplazar la ubicación guardada del cliente por tu posición actual. ¿Continuar?'
          : 'Vas a fijar la ubicación de este cliente con tu posición actual. Asegúrate de estar frente al cliente.'}
        confirmLabel="Fijar ubicación"
        confirmColor="blue"
        onConfirm={_doFijarUbicacion}
        onCancel={() => setConfirmGPS(null)}
      />

      <ConfirmModal
        open={!!confirmDeletePrestamo}
        title="Eliminar préstamo"
        message="¿Eliminar este préstamo y todos sus pagos? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        confirmColor="red"
        onConfirm={() => _doDeletePrestamo(confirmDeletePrestamo)}
        onCancel={() => setConfirmDeletePrestamo(null)}
      />
    </div>
  )
}

// ─── Modal: eliminar cliente con préstamos ───────────────────────
function DeleteClienteModal({ cliente, prestamos, onClose, onDeletePrestamo, onTrasladar, onRetryDelete, loading, clienteId }) {
  const [trasladarId, setTrasladarId] = useState(null) // prestamoId que se va a trasladar
  const [clientes, setClientes] = useState([])
  const [buscar, setBuscar] = useState('')
  const [loadingClientes, setLoadingClientes] = useState(false)
  const retryDeleteTriggeredRef = useRef(false)

  // Buscar clientes para trasladar
  useEffect(() => {
    if (!trasladarId) return
    setLoadingClientes(true)
    fetch(`/api/clientes?buscar=${encodeURIComponent(buscar)}`)
      .then(r => r.json())
      .then(data => {
        const lista = (data.clientes || data || []).filter(c => c.id !== clienteId)
        setClientes(lista)
      })
      .catch(() => {})
      .finally(() => setLoadingClientes(false))
  }, [trasladarId, buscar, clienteId])

  // Si ya no quedan préstamos, reintentar eliminar
  useEffect(() => {
    if (prestamos.length !== 0 || retryDeleteTriggeredRef.current) return
    retryDeleteTriggeredRef.current = true
    onRetryDelete()
  }, [prestamos.length, onRetryDelete])

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/70 px-0 sm:px-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-t-[20px] sm:rounded-[20px] flex flex-col max-h-[85vh]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 70px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Eliminar cliente</h3>
            <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-[var(--color-danger)]">
            {cliente.nombre} tiene {prestamos.length} préstamo{prestamos.length > 1 ? 's' : ''}.
            Debes eliminarlos o trasladarlos antes de eliminar el cliente.
          </p>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-5 pb-3">
          {/* Vista de trasladar */}
          {trasladarId && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-[var(--color-text-primary)] font-medium">Trasladar a otro cliente</p>
                <button onClick={() => setTrasladarId(null)} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">Cancelar</button>
              </div>
              <input
                type="text"
                value={buscar}
                onChange={e => setBuscar(e.target.value)}
                placeholder="Buscar cliente por nombre o cédula..."
                className="w-full mb-2 px-3 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[10px] text-sm text-[var(--color-text-primary)] placeholder-[#555] focus:outline-none focus:border-[var(--color-accent)]"
              />
              {loadingClientes ? (
                <p className="text-xs text-[var(--color-text-muted)] text-center py-3">Buscando...</p>
              ) : clientes.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] text-center py-3">No se encontraron clientes</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {clientes.slice(0, 10).map(c => (
                    <button
                      key={c.id}
                      onClick={() => { onTrasladar(trasladarId, c.id); setTrasladarId(null) }}
                      disabled={loading}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-[8px] bg-[var(--color-bg-card)] hover:bg-[rgba(245,197,24,0.08)] text-left transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-[rgba(245,197,24,0.15)] flex items-center justify-center text-xs font-bold text-[var(--color-accent)] shrink-0">
                        {c.nombre?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--color-text-primary)] truncate">{c.nombre}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)]">CC {c.cedula}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Lista de préstamos */}
          {!trasladarId && (
            <div className="space-y-3">
              {prestamos.map(p => (
                <div key={p.id} className="p-3 rounded-[12px] bg-[#151515] border border-[#222]">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{formatMoney(p.montoPrestado)}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        Saldo: {formatMoney(p.saldoPendiente)} - {p.estado}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTrasladarId(p.id)}
                      disabled={loading}
                      className="flex-1 py-2 rounded-[8px] bg-[var(--color-warning-dim)] border border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)] text-[var(--color-warning)] text-xs font-medium hover:bg-[rgba(245,197,24,0.15)] transition-colors"
                    >
                      Trasladar a otro cliente
                    </button>
                    <button
                      onClick={() => onDeletePrestamo(p.id)}
                      disabled={loading}
                      className="flex-1 py-2 rounded-[8px] bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-xs font-medium hover:bg-[rgba(239,68,68,0.15)] transition-colors"
                    >
                      Eliminar préstamo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-componente: tope de préstamo editable inline ─────────────
function TopePrestamoCard({ tope, onSave }) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState('')
  const [saving, setSaving] = useState(false)

  const formatDisplay = (v) => {
    const n = Number(v)
    if (!n || n <= 0) return ''
    return n.toLocaleString('es-CO')
  }

  const editable = typeof onSave === 'function'

  const handleEditar = () => {
    if (!editable) return
    setValor(tope > 0 ? String(tope) : '')
    setEditando(true)
  }

  const handleGuardar = async () => {
    setSaving(true)
    try {
      const raw = String(valor).replace(/\D/g, '')
      const num = Number(raw) || null
      await onSave(num)
      setEditando(false)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '')
    setValor(raw)
  }

  const displayValor = valor ? Number(valor).toLocaleString('es-CO') : ''

  if (editando) {
    return (
      <div className="rounded-[14px] border p-3.5 flex items-center gap-3" style={{ background: 'color-mix(in srgb, var(--color-warning) 5%, var(--color-bg-card))', borderColor: 'color-mix(in srgb, var(--color-warning) 20%, var(--color-border))' }}>
        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--color-warning) 15%, transparent)' }}>
          <svg className="w-4 h-4" style={{ color: 'var(--color-warning)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-[var(--color-text-muted)] text-sm pointer-events-none">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={displayValor}
              onChange={handleChange}
              placeholder="Sin limite"
              autoFocus
              className="w-full h-9 rounded-[10px] border text-sm pl-7 pr-3 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[rgba(245,197,24,0.2)] transition-all"
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setEditando(false)}
            className="h-8 px-2.5 rounded-[8px] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={saving}
            className="h-8 px-3 rounded-[8px] bg-[var(--color-accent)] text-[#111] text-xs font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
          >
            {saving ? '...' : 'Guardar'}
          </button>
        </div>
      </div>
    )
  }

  const Tag = editable ? 'button' : 'div'

  return (
    <Tag
      {...(editable ? { onClick: handleEditar } : {})}
      className={`w-full rounded-[14px] border p-3.5 flex items-center gap-3 text-left transition-colors${editable ? ' hover:border-[color-mix(in_srgb,var(--color-warning)_40%,var(--color-border))] active:scale-[0.99] cursor-pointer' : ''}`}
      style={{
        background: tope > 0
          ? 'color-mix(in srgb, var(--color-warning) 5%, var(--color-bg-card))'
          : 'var(--color-bg-card)',
        borderColor: tope > 0
          ? 'color-mix(in srgb, var(--color-warning) 20%, var(--color-border))'
          : 'var(--color-border)',
      }}
    >
      <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: tope > 0 ? 'color-mix(in srgb, var(--color-warning) 15%, transparent)' : 'color-mix(in srgb, var(--color-text-muted) 10%, transparent)' }}>
        <svg className="w-4 h-4" style={{ color: tope > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Tope de préstamo</p>
        <p className="text-sm font-semibold mt-0.5" style={{ color: tope > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
          {tope > 0 ? `$${formatDisplay(tope)}` : 'Sin limite'}
        </p>
      </div>
      {editable && (
        <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        </svg>
      )}
    </Tag>
  )
}

// ─── Sub-componente: tarjeta de préstamo ─────────────────────────
function PrestamoCard({ prestamo: p, clienteId, cliente, orgNombre, mini = false }) {
  const badge  = estadoPrestamoBadge[p.estado] ?? estadoPrestamoBadge.activo
  const porcentaje = p.porcentajePagado ?? 0
  const enMora = (p.diasMora ?? 0) > 0
  const tieneProximoCobro = p.estado === 'activo' && p.proximoCobro
  const proximoCobroLabel = tieneProximoCobro ? formatFechaCobroRelativa(p.proximoCobro) : null
  const cobroVencido = enMora && tieneProximoCobro
  const prefijoCobro = cobroVencido ? 'Debió cobrarse' : 'Próx. cobro'
  const valorCobro = proximoCobroLabel

  if (mini) {
    return (
      <Link
        href={`/prestamos/${p.id}`}
        className="flex items-center gap-3 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-4 py-3 hover:border-[var(--color-border)]/70 transition-colors group"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--color-text-primary)]">{formatMoney(p.montoPrestado)}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {new Date(p.fechaInicio).toLocaleDateString('es-CO')}
          </p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <svg className="w-4 h-4 text-[#2a2a2a] group-hover:text-[var(--color-text-muted)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    )
  }

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-base font-bold text-[var(--color-text-primary)]">{formatMoney(p.montoPrestado)}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Prestado el {new Date(p.fechaInicio).toLocaleDateString('es-CO')}
          </p>
          {proximoCobroLabel && (
            <p className={[
              'text-xs mt-0.5 flex items-center gap-1 capitalize',
              cobroVencido ? 'text-[var(--color-danger)]' : 'text-[var(--color-accent)]',
            ].join(' ')}>
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {prefijoCobro}: <span className="font-medium">{valorCobro}</span>
            </p>
          )}
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {/* Barra de progreso */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1.5">
          <span>Pagado: {formatMoney(p.montoPrestado - (p.saldoPendiente ?? 0))}</span>
          <span>{porcentaje}%</span>
        </div>
        <div className="h-1.5 bg-[var(--color-bg-hover)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${porcentaje}%`,
              background: porcentaje === 100 ? 'var(--color-success)' : p.diasMora > 0 ? 'var(--color-danger)' : 'var(--color-accent)',
            }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1.5">
          <span className="text-[var(--color-text-muted)]">Saldo: <span className="text-[var(--color-text-primary)] font-medium">{formatMoney(p.saldoPendiente)}</span></span>
          {p.diasMora > 0 && (
            <span className="text-[var(--color-danger)] font-medium">{p.diasMora} días en mora</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Link href={`/prestamos/${p.id}`}>
          <Button size="sm" variant="secondary" className="w-full">
            Ver préstamo
          </Button>
        </Link>
        {p.diasMora > 0 && cliente?.telefono && (
          <BotonWhatsApp tipo="mora" cliente={cliente} prestamo={p} orgNombre={orgNombre} />
        )}
      </div>
    </Card>
  )
}
