'use client'
// app/(dashboard)/clientes/[id]/page.jsx - Detalle del cliente

import { ComoPaga } from '@/components/pantallas/FichaCliente'
import { useState, useEffect, useRef, useCallback, use } from 'react'
import { useRouter }                 from 'next/navigation'
import Link                          from 'next/link'
import { useAuth }                   from '@/hooks/useAuth'
import { useOffline }                from '@/components/providers/OfflineProvider'
import { obtenerClienteOffline, resolverTempId, invalidarCachePorPrefijo } from '@/lib/offline'
import { obtenerCoordsRapido }                       from '@/lib/geo'
import { Badge }                     from '@/components/ui/Badge'
import { Button }                    from '@/components/ui/Button'
import { Card }                      from '@/components/ui/Card'
import { SkeletonPrestamoDetalle }    from '@/components/ui/Skeleton'
import BotonWhatsApp                 from '@/components/ui/BotonWhatsApp'
import HojaWhatsApp        from '@/components/whatsapp/HojaWhatsApp'
import TarjetaCliente      from '@/components/cf/TarjetaCliente'
import { adaptarPrestamos } from '@/lib/adaptadores/prestamos'
import { formatFechaCobroRelativa } from '@/lib/calculos'
import { formatMoney } from '@/lib/i18n'
import { useCabecera } from '@/components/armazon/Armazon'
import { planTieneFotos }            from '@/lib/planes'
import ScoreCrediticio               from '@/components/clientes/ScoreCrediticio'
import ClienteHeroCard, { InfoContactoCard, AccionesClienteChips } from '@/components/clientes/ClienteHeroCard'
import { generarTipCliente } from '@/lib/tips/clienteTips'
import LucasSugiere from '@/components/clientes/LucasSugiere'
import ReagendarVisitaModal from '@/components/visitas/ReagendarVisitaModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Modal } from '@/components/ui/Modal'
import QrClienteModal from '@/components/clientes/QrClienteModal'
import dynamic from 'next/dynamic'
import { anotarReciente } from '@/lib/recientes'

const LocationPicker = dynamic(() => import('@/components/clientes/LocationPicker'), { ssr: false })

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
  const { esOwner, puedeCrearPrestamos, puedeEditarClientes, plan, orgNombre, ocultarSaldoWA, organizationId, country } = useAuth()

  const { lastSyncedAt } = useOffline()

  const [cliente, setCliente]   = useState(null)
  // ── «COMO PAGA»: LOS DOCE MESES (C10 · T15-01) ──
  // La pieza que la lamina llama la que justifica la pantalla, y que llevaba
  // semanas bloqueada porque el dato no existia. Ya existe:
  // `/api/clientes/[id]/comportamiento`.
  //
  // Se pide APARTE y no se bloquea la ficha con ella: recorre doce meses de
  // pagos y es la peticion mas cara de esta pantalla. Si falla o tarda, la
  // ficha se ve igual y el bloque simplemente no aparece — antes tampoco
  // estaba.
  const [comportamiento, setComportamiento] = useState(null)

  // Deja constancia para «Últimos que abriste» del buscador (T34-03). Se anota
  // AQUI y no en el armazón porque la ruta sola trae el id: el nombre y el
  // estado solo los sabe esta pantalla.
  useEffect(() => {
    if (!cliente?.nombre) return
    anotarReciente({
      tipo: 'cliente', id: cliente.id, nombre: cliente.nombre,
      detalle: cliente.cedula && !String(cliente.cedula).startsWith('SIN-')
        ? cliente.cedula : (cliente.telefono || ''),
      estado: cliente.estado === 'mora' ? 'rojo' : undefined,
    })
  }, [cliente])

  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [deleteData, setDeleteData] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [modalWA, setModalWA] = useState(false)
  const [modalReagendar, setModalReagendar] = useState(false)
  const [modalQR, setModalQR] = useState(false)
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
  useEffect(() => {
    const goOnline = () => { setIsOffline(false) }
    window.addEventListener('online', goOnline)
    return () => window.removeEventListener('online', goOnline)
  }, [])
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
          if (!navigator.onLine) setIsOffline(true)
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
          if (!navigator.onLine) setIsOffline(true)
          if (!shouldUseSoftRefresh) setLoading(false)
          hasLoadedOnceRef.current = true
          return
        }
      } catch {}
    }

    try {
      const res = await fetch(`/api/clientes/${id}`)
      fetch(`/api/clientes/${id}/comportamiento`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setComportamiento(d))
        .catch(() => {})
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.offline) throw new Error('offline')
      setCliente(data)
    } catch {
      try {
        const cached = await obtenerClienteOffline(id)
        if (cached) {
          setCliente(cached)
          if (!navigator.onLine) setIsOffline(true)
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
      invalidarCachePorPrefijo('clientes:').catch(() => {})
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
  const [ubicacionModal, setUbicacionModal] = useState({ lat: null, lng: null })
  const handleFijarUbicacion = () => {
    if (fijandoGPS) return
    setUbicacionModal({ lat: cliente?.latitud ?? null, lng: cliente?.longitud ?? null })
    setConfirmGPS({ modo: 'elegir' })
  }

  const _doFijarGPS = async () => {
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

  const _doGuardarUbicacionMapa = async () => {
    if (ubicacionModal.lat == null || ubicacionModal.lng == null) return
    setConfirmGPS(null)
    setFijandoGPS(true)
    try {
      const res = await fetch(`/api/clientes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitud: ubicacionModal.lat, longitud: ubicacionModal.lng }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Error al guardar'); return }
      setCliente(prev => ({ ...prev, latitud: ubicacionModal.lat, longitud: ubicacionModal.lng }))
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

  /* ── LA CABECERA, IGUAL QUE EN LA FICHA DEL PRÉSTAMO ──────────────────────
   *
   * Esta pantalla NO llamaba a `useCabecera`, así que su cabecera salía vacía:
   * solo la flecha de volver. La ficha del préstamo —que es la misma clase de
   * pantalla— sí la llama y enseña «nombre · contexto». Reportado por el dueño:
   * «genera la sensación de que son dos aplicaciones distintas».
   *
   * No es una decisión de diseño distinta: es un olvido. `clientes/nuevo`,
   * `clientes/[id]/editar` y `clientes/[id]/historial` SÍ la llaman.
   *
   * Se copia el patrón que ya existe en `prestamos/[id]` —nombre arriba, una
   * línea de contexto separada por `·`— en vez de inventar otro. Regla de
   * `11-ESCALAS-Y-CONSISTENCIA.md §9`: busca otro elemento con el mismo papel y
   * copia sus medidas; si no coinciden, el tuyo está mal.
   *
   * ⚠ VA AQUÍ, ANTES DEL `if (loading) return`. Es un hook: detrás de un return
   * temprano el orden cambia entre renders y React tira la pantalla. Está
   * documentado en `prestamos/[id]/page.jsx` con el mismo aviso.
   */
  useCabecera({
    titulo: cliente?.nombre,
    subtitulo: cliente ? (() => {
      const activos = cliente.prestamos?.filter((p) => p.estado === 'activo') ?? []
      const debe = activos.reduce((a, p) => a + Math.max(0, (p.totalAPagar ?? 0) - (p.totalPagado ?? 0)), 0)
      const mora = Math.max(0, ...activos.map((p) => p.diasMora ?? 0))
      return [
        activos.length === 0
          ? 'sin préstamos activos'
          : `${activos.length} préstamo${activos.length === 1 ? '' : 's'} · debe ${formatMoney(Math.round(debe))}`,
        activos.length > 0 ? (mora > 0 ? `${mora} día${mora === 1 ? '' : 's'} de atraso` : 'al día') : null,
      ].filter(Boolean).join(' · ')
    })() : null,
  })

  if (loading) {
    return <SkeletonPrestamoDetalle />
  }

  if (error || !cliente) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-[var(--cf-red-pill-bg)] border border-[color-mix(in_srgb,var(--cf-red-dark)_30%,transparent)] text-[var(--cf-red-dark)] rounded-[20px] cf-card-shadow p-6 text-center">
          <p className="font-semibold mb-2">Cliente no encontrado</p>
          <div className="flex items-center justify-center gap-4 mt-3">
            <button onClick={() => { setError(''); setLoading(true); fetchCliente() }} className="text-sm underline">Reintentar</button>
            <button onClick={() => router.back()} className="text-sm underline opacity-70">Volver</button>
          </div>
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
    <div className="max-w-2xl lg:max-w-6xl mx-auto space-y-5 pb-4">

      {/* Barra de navegación de ruta */}
      {rutaNav && (
        <div
          className="rounded-[12px] px-3 py-2.5 flex items-center justify-between"
          style={{ background: 'color-mix(in srgb, var(--cf-gold) 6%, var(--cf-card))', border: '1px solid color-mix(in srgb, var(--cf-gold) 15%, var(--cf-border))' }}
        >
          <button
            onClick={() => navegarEnRuta(-1)}
            disabled={esPrimeroEnRuta}
            className="p-1.5 rounded-[8px] bg-[var(--cf-surface)] border border-[var(--cf-border)] text-[var(--cf-ink-3)] disabled:opacity-30 active:scale-95 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center min-w-0 px-2">
            <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wide">{rutaNav.rutaNombre}</p>
            <p className="text-xs text-[var(--cf-ink)] font-medium">{rutaNav.currentIndex + 1} de {rutaNav.clientes.length}</p>
          </div>
          <button
            onClick={irSiguienteEnRuta}
            disabled={esUltimoEnRuta}
            className="p-1.5 rounded-[8px] bg-[var(--cf-surface)] border border-[var(--cf-border)] text-[var(--cf-ink-3)] disabled:opacity-30 active:scale-95 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Banner cartulina — préstamo detectado pendiente de crear */}
      {bannerCartulina && (
        <div className="mb-4 rounded-[12px] px-3.5 py-3 flex items-start gap-3" style={{ background: 'color-mix(in srgb, var(--cf-gold) 8%, var(--cf-card))', border: '1px solid color-mix(in srgb, var(--cf-gold) 25%, var(--cf-border))' }}>
          <svg className="w-4 h-4 mt-0.5 shrink-0 text-[var(--cf-gold)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--cf-ink)]">Préstamo detectado en la cartulina</p>
            <p className="text-[11px] text-[var(--cf-ink-3)] mt-0.5">
              {bannerCartulina.montoPrestado ? `${Number(bannerCartulina.montoPrestado).toLocaleString('es-CO')} · ` : ''}
              {bannerCartulina.frecuencia ?? ''}{bannerCartulina.esEnCurso ? ' · En curso' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/prestamos/nuevo?clienteId=${id}&fromCartulina=1`}
              onClick={() => {}}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-[8px] bg-[var(--cf-gold)] text-[var(--cf-gold-ink)] hover:bg-[var(--cf-gold-dark)] transition-colors"
            >
              Crear préstamo
            </Link>
            <button onClick={cerrarBannerCartulina} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-[rgba(255,255,255,0.1)] transition-colors" style={{ color: 'var(--cf-ink-3)' }}>
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

      {/* ══ E05 · Lucas, en vez del banner gris ══
          Era un aviso con chispa y ✕ que decía una frase sin salida. Ahora
          lleva el monto —el tope que TÚ le pusiste, no una cifra inventada— y
          el botón para prestarlo. Con mora o con varios préstamos abiertos no
          ofrece nada: avisa. */}
      <LucasSugiere
        sugerencia={generarTipCliente(cliente, prestamosActivos, {
          completados: historial.filter((p) => p.estado === 'completado').length,
          incumplidos: historial.filter((p) => p.estado === 'cancelado').length,
        })}
        onPrestar={(monto) => router.push(`/prestamos/nuevo?clienteId=${id}&monto=${monto}`)}
        onOtroMonto={() => router.push(`/prestamos/nuevo?clienteId=${id}`)}
        /* Deja cerrar el aviso cuando NO es una oferta. Por cliente, para que
           cerrar el de uno no calle el de los demás. */
        claveCierre={id}
      />

      {/* Score crediticio (si aplica al plan) */}
      <div className="flex">
        <ScoreCrediticio cedula={cliente.cedula} plan={plan} />
      </div>

      {/* ── DOS COLUMNAS EN ESCRITORIO (T15-01) ─────────────────────────
          A 1440 esto era una columna de tarjetas móviles apiladas: el
          histograma de «cómo paga» quedaba a dos pantallas de scroll del
          nombre del cliente, y la mitad derecha del monitor en blanco.

          La lámina reparte por PREGUNTA, no por tamaño: a la izquierda lo que
          se consulta —sus préstamos y cómo ha pagado—, a la derecha lo que se
          usa para contactarlo y lo que se configura. Lo de la izquierda es
          largo y lo de la derecha corto, así que el carril no se estira.

          En móvil sigue siendo una sola columna, en el mismo orden de siempre:
          `lg:grid` no aplica por debajo de 1024. */}
      <div className="lg:grid lg:grid-cols-[1.55fr_1fr] lg:gap-5 lg:items-start space-y-5 lg:space-y-0">
        <div className="space-y-5 min-w-0">

      {/* ── LOS PRÉSTAMOS VAN ANTES QUE LAS ACCIONES ────────────────────
          Estaban DEBAJO de la lista de acciones (siete filas: reagendar,
          GPS, historial, QR, editar, inactivar, eliminar). Un cobrador lo
          reportó en video: su cliente tenía dos créditos y «me toca ir y
          buscar, pero buscar, buscar, para encontrar los otros 200».

          Se entra a un cliente para ver SUS CRÉDITOS. Que «Fijar ubicación
          (GPS)» estuviera antes que el préstamo por el que se entró es la
          pantalla contradiciendo su propio motivo.

          NO se quita ninguna acción ni cambia su orden entre ellas: solo
          pasan a ir después. */}
      {/* Préstamos activos */}
      {prestamosActivos.length > 0 && (
        <div>
          <h2 className="text-[11px] font-extrabold text-[var(--cf-ink-3)] mb-3 uppercase tracking-[.07em]">
            Préstamos activos
          </h2>
          {/* LA MISMA TARJETA QUE EN /prestamos, no otra.
              `PrestamoCard` era propia de esta pagina: monto arriba a la
              izquierda, un «Activo» gris a la derecha, y DOS botones dentro —
              «Ver prestamo» y «Enviar alerta de mora», este ultimo dorado. Con
              el «Nuevo prestamo» de arriba y el «Activar portal» del portal,
              eran TRES dorados en una pantalla; la receta permite uno.

              `TarjetaCliente` es la del rediseño: riel de estado, monto en la
              fila del nombre, pastilla de dias y la tira de cifras. Se lee igual
              aqui que en la lista, que es de donde se viene. */}
          <div className="space-y-3">
            {(() => {
              const adaptados = adaptarPrestamos(prestamosActivos, country)
              return prestamosActivos.map((p, i) => (
                <TarjetaCliente
                  key={p.id}
                  {...adaptados[i]}
                  // EL TITULAR NO ES EL NOMBRE. Aqui ya se sabe de quien es la
                  // ficha; repetirlo gasta la linea mas visible. Y ademas salia
                  // «Sin cliente», porque en esta pagina los prestamos llegan
                  // sin el cliente anidado — no hace falta, ya esta arriba.
                  nombre={`Prestado el ${new Date(p.fechaInicio).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}`}
                  onClick={() => router.push(`/prestamos/${p.id}`)}
                />
              ))
            })()}
          </div>
        </div>
      )}

      {/* Líneas de crédito */}
      {cliente.lineasCredito?.filter(lc => lc.estado === 'activa').length > 0 && (
        <div>
          <h2 className="text-[11px] font-extrabold text-[var(--cf-ink-3)] mb-3 uppercase tracking-[.07em]">
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
                  glowColor="var(--cf-ink-2)"
                  className="block px-4 py-3.5"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" style={{ color: 'var(--cf-ink-2)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      <span className="text-xs font-semibold text-[var(--cf-ink)]">Línea de crédito</span>
                    </div>
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 12%, transparent)', color: 'var(--cf-ink-2)', border: '1px solid color-mix(in srgb, var(--cf-ink-2) 20%, transparent)' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--cf-ink-2)' }} />
                      Activa
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-2">
                    <div>
                      <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wider">Cupo</p>
                      <p className="text-xs font-mono-display font-bold text-[var(--cf-ink)] mt-0.5">{formatMoney(lc.cupoMaximo)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wider">Usado</p>
                      <p className="text-xs font-mono-display font-bold text-[var(--cf-ink)] mt-0.5">{formatMoney(lc.capitalUsado || 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wider">Disponible</p>
                      <p className="text-xs font-mono-display font-bold mt-0.5" style={{ color: 'var(--cf-ink-2)' }}>{formatMoney(lc.cupoDisponible || 0)}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-[var(--cf-ink-3)]">Uso del cupo</span>
                      <span className="font-mono-display font-semibold" style={{ color: porcentaje > 80 ? 'var(--cf-red-dark)' : 'var(--cf-ink-2)' }}>{porcentaje}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--cf-fill)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(porcentaje, 2)}%`,
                          background: porcentaje > 80 ? 'var(--cf-red-dark)' : 'linear-gradient(90deg, color-mix(in srgb, var(--cf-ink-2) 80%, transparent), var(--cf-ink-2))',
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-[var(--cf-ink-3)] mt-2">Tasa: {lc.tasaInteres}% mensual · Corte dia {lc.diaCorte}</p>
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
            <p className="text-sm text-[var(--cf-ink-3)]">Sin préstamos activos</p>
            {puedeCrearPrestamos && (
              <div className="mt-3">
                <p className="text-xs text-[var(--cf-ink-3)] mb-2">Siguiente paso recomendado: crear el primer préstamo.</p>
                <Link href={`/prestamos/nuevo?clienteId=${id}`}>
                  <Button size="sm">Crear préstamo ahora</Button>
                </Link>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── EL WHATSAPP SUELTO SE FUE ────────────────────────────────────
          Habia TRES caminos a lo mismo: el circulo verde de la tarjeta, este
          boton, y «Enviar por WhatsApp» en la lista. Reportado con captura:
          «hay 2 botones de whatsapp, dejar solo uno».

          Este se añadio porque la fila de la lista caia debajo de la barra
          flotante y quedaba tapada. Medido ahora: los dos estaban a 123px uno
          del otro y la lista se ve entera, asi que el motivo ya no existe.

          OJO: dentro del JSX el comentario VA CON LLAVES. Sin ellas se imprime
          en la pantalla — salio como parrafo en la ficha del cliente. Es la
          trampa contraria a la de `return (`, donde las llaves sobran. */}

      {/* Acciones rapidas como chips */}
      {(puedeCrearPrestamos || puedeEditarClientes || esOwner) && (
        <AccionesClienteChips
          acciones={[
            ...(puedeCrearPrestamos ? [{
              label: 'Nuevo préstamo',
              color: 'var(--cf-green-dark)',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
              onClick: () => router.push(`/prestamos/nuevo?clienteId=${cliente.id}`),
            }] : []),
            // ── «ENVIAR POR WHATSAPP», CON SU NOMBRE ─────────────────────
            //
            // Ya existía: es el círculo verde de la tarjeta de arriba. Pero es
            // un ICONO PELADO, y debajo hay siete acciones CON LETRA. Un
            // cobrador lo reportó en video: «no encuentro por dónde mandarle a
            // WhatsApp... sé que están ahí, pero no llego fácilmente a ellas».
            // En su grabación el botón se ve en pantalla mientras lo busca: su
            // ojo lee la lista con nombres y el icono no se registra.
            //
            // Va SEGUNDA, detrás de «Nuevo préstamo», porque su ciclo es
            // justamente ese: creo el crédito y lo mando. El icono se queda:
            // quien ya lo aprendió no pierde su camino.
            ...(cliente.telefono ? [{
              label: 'Enviar por WhatsApp',
              color: '#25D366',
              icon: (
                <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M20.52 3.449C12.831-3.984.106 1.407.101 11.893c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a11.882 11.882 0 0 0 5.68 1.448h.005c9.6 0 15.24-10.4 10.5-18.35a11.83 11.83 0 0 0-2-2.997zM12.02 21.785h-.004a9.87 9.87 0 0 1-5.03-1.378l-.36-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.263c.001-8.708 10.59-13.067 16.752-6.909 6.16 6.158 1.812 16.805-6.87 16.805z" />
                </svg>
              ),
              onClick: () => setModalWA(true),
            }] : []),
            {
              label: 'Reagendar visita',
              color: 'var(--cf-gold-dark)',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
              onClick: () => setModalReagendar(true),
            },
            ...(puedeEditarClientes ? [{
              // GPS aqui mismo, en campo. Sin tener que entrar a "Editar".
              label: fijandoGPS
                ? 'Capturando GPS...'
                : (cliente.latitud != null && cliente.longitud != null ? 'Actualizar ubicación' : 'Fijar ubicación (GPS)'),
              color: 'var(--cf-ink-2)',
              icon: (
                <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              ),
              onClick: handleFijarUbicacion,
              disabled: fijandoGPS,
            }] : []),
            ...(cliente.latitud != null && cliente.longitud != null ? [{
              label: 'Cómo llegar',
              color: '#4285f4',
              icon: (
                <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                </svg>
              ),
              onClick: () => window.open(`https://www.google.com/maps/dir/?api=1&destination=${cliente.latitud},${cliente.longitud}`, '_blank'),
            }] : []),
            {
              label: 'Historial',
              color: 'var(--cf-ink-2)',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
              onClick: () => router.push(`/clientes/${id}/historial`),
            },
            {
              label: 'QR',
              color: 'var(--cf-ink-2)',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" /></svg>,
              onClick: () => setModalQR(true),
            },
            ...(puedeEditarClientes ? [{
              label: 'Editar',
              color: 'var(--cf-ink-2)',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>,
              onClick: () => router.push(`/clientes/${id}/editar`),
            }] : []),
            ...(esOwner ? [{
              label: cliente.estado === 'inactivo' ? 'Activar' : 'Inactivar',
              color: cliente.estado === 'inactivo' ? 'var(--cf-green-dark)' : 'var(--cf-gold-dark)',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
              onClick: handleToggleInactivo,
              disabled: actionLoading,
            }] : []),
            ...(esOwner ? [{
              label: 'Eliminar',
              // La unica accion que reconoce una perdida, y la unica con color.
              peligro: true,
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
            'flex items-center gap-1.5 h-8 rounded-[12px] border text-xs px-2.5 transition-all disabled:opacity-50',
            festivoHoy
              ? 'border-[var(--cf-green-dark)] text-[var(--cf-green-dark)] bg-[rgba(34,197,94,0.08)]'
              : 'border-[var(--cf-border)] text-[var(--cf-ink-3)] hover:border-[var(--cf-green-dark)] hover:text-[var(--cf-green-dark)]',
          ].join(' ')}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5m-9-6h.008v.008H12V13.5zm0 3h.008v.008H12v-3zm-3 3h.008v.008H9V16.5zm0-3h.008v.008H9V13.5zm6 3h.008v.008H15V16.5zm0-3h.008v.008H15V13.5z" />
          </svg>
          {guardandoFestivo ? 'Guardando…' : festivoHoy ? 'Hoy es festivo — toca para quitar' : 'Festivo hoy'}
        </button>
      )}

        </div>

        {/* ── EL CARRIL DERECHO ── */}
        <div className="space-y-5 min-w-0">

      {/* ══ E04 · «Cómo ubicarlo» ══
          Los datos ya no son solo texto: el teléfono llama y escribe, la
          dirección abre el mapa. La ruta va en la segunda línea de la
          dirección —es parte de dónde está, no un dato suelto— y «Editar»
          lleva al mismo sitio que la acción de abajo. */}
      <InfoContactoCard
        cliente={cliente}
        rutaNombre={cliente?.ruta?.nombre || null}
        onEditar={puedeEditarClientes ? () => router.push(`/clientes/${id}/editar`) : undefined}
        onWhatsApp={cliente?.telefono ? () => setModalWA(true) : undefined}
      />

      {/* Portal del cliente — solo owner */}
      {esOwner && (
        <PortalClienteCard clienteId={id} organizationId={cliente.organizationId} cedula={cliente.cedula} />
      )}

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

      {/* Doce barras y LA FRASE QUE LAS LEE. Sin la frase son doce barras: el
          ojo se queda con el ultimo mes y saca la conclusion equivocada. Va
          ANTES de los prestamos porque es lo que se mira para decidir si
          prestarle otra vez. */}
      {comportamiento?.meses?.some((m) => m.cumplio !== null) && (
        <ComoPaga meses={comportamiento.meses} lectura={comportamiento.lectura} />
      )}


      {/* Historial */}
        </div>
      </div>

      {historial.length > 0 && (
        <div>
          <h2 className="text-[11px] font-extrabold text-[var(--cf-ink-3)] mb-3 uppercase tracking-[.07em]">
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
                className="flex-1 py-3 rounded-[12px] bg-[var(--cf-surface)] border border-[var(--cf-border)] text-[var(--cf-ink-3)] text-sm font-medium active:scale-[0.98] transition-all"
              >
                No pagó · Siguiente
              </button>
              <button
                onClick={irSiguienteEnRuta}
                className="flex-1 py-3 rounded-[12px] bg-[var(--cf-gold)] text-[var(--cf-gold-ink)] text-sm font-semibold active:scale-[0.98] transition-all"
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
              className="flex-1 py-3 rounded-[12px] bg-[var(--cf-green-dark)] text-[var(--cf-ink)] text-sm font-semibold active:scale-[0.98] transition-all"
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
            className="w-full sm:max-w-sm bg-[var(--cf-surface)] border border-[var(--cf-border)] rounded-t-[20px] sm:rounded-[20px] p-5"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-[rgba(239,68,68,0.12)] flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--cf-red-dark)]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-[var(--cf-ink)]">Eliminar cliente</h3>
              <p className="text-sm text-[var(--cf-ink-3)] text-center">
                Vas a eliminar a <span className="font-medium text-[var(--cf-ink)]">{cliente.nombre}</span>. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 h-11 rounded-[12px] border border-[var(--cf-border)] text-sm font-medium text-[var(--cf-ink-2)] hover:bg-[var(--cf-fill)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setShowConfirmDelete(false); handleDelete() }}
                disabled={actionLoading}
                className="flex-1 h-11 rounded-[12px] bg-[var(--cf-red-dark)] text-white text-sm font-semibold hover:bg-[#dc2626] transition-colors disabled:opacity-50"
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
      <HojaWhatsApp
        open={modalWA}
        onClose={() => setModalWA(false)}
        cliente={cliente}
        prestamo={prestamosActivos[0] || null}
        orgNombre={orgNombre}
        ocultarSaldo={ocultarSaldoWA}
        organizationId={organizationId}
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

      <QrClienteModal
        open={modalQR}
        onClose={() => setModalQR(false)}
        cliente={cliente}
      />

      <Modal
        open={!!confirmGPS}
        onClose={() => setConfirmGPS(null)}
        title="Fijar ubicación"
      >
        {confirmGPS?.modo === 'elegir' && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--cf-ink-2)]">Elige cómo fijar la ubicación del cliente:</p>
            <button
              onClick={_doFijarGPS}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-surface)] hover:border-[var(--cf-gold)] transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 12%, transparent)' }}>
                <svg className="w-5 h-5 text-[var(--cf-ink-2)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--cf-ink)]">Mi ubicación actual</p>
                <p className="text-xs text-[var(--cf-ink-3)]">Usa el GPS de tu teléfono</p>
              </div>
            </button>
            <button
              onClick={() => setConfirmGPS({ modo: 'mapa' })}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-surface)] hover:border-[var(--cf-gold)] transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--cf-gold) 12%, transparent)' }}>
                <svg className="w-5 h-5 text-[var(--cf-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--cf-ink)]">Seleccionar en el mapa</p>
                <p className="text-xs text-[var(--cf-ink-3)]">Toca el mapa para poner el pin</p>
              </div>
            </button>
          </div>
        )}
        {confirmGPS?.modo === 'mapa' && (
          <div className="space-y-3">
            <button
              onClick={() => setConfirmGPS({ modo: 'elegir' })}
              className="flex items-center gap-1 text-xs text-[var(--cf-ink-3)] hover:text-[var(--cf-ink)] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </button>
            <LocationPicker
              latitud={ubicacionModal.lat}
              longitud={ubicacionModal.lng}
              onLocationChange={(lat, lng) => setUbicacionModal({ lat, lng })}
            />
            <Button
              onClick={_doGuardarUbicacionMapa}
              disabled={ubicacionModal.lat == null}
              className="w-full"
            >
              Guardar ubicación
            </Button>
          </div>
        )}
      </Modal>

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

// ─── Portal del cliente ──────────────────────────────────────────
function PortalClienteCard({ clienteId, organizationId, cedula }) {
  const [portal, setPortal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pinInput, setPinInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [showSetPin, setShowSetPin] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/clientes/${clienteId}/portal`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPortal(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clienteId])

  const guardarPin = async () => {
    if (pinInput.length < 4) { setMsg('Mínimo 4 dígitos'); return }
    setSaving(true); setMsg('')
    try {
      const res = await fetch(`/api/clientes/${clienteId}/portal`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg(data.error); return }
      setPortal(data)
      setPinInput('')
      setShowSetPin(false)
      setMsg('PIN guardado')
      setTimeout(() => setMsg(''), 2000)
    } catch { setMsg('Error de conexión') }
    finally { setSaving(false) }
  }

  const togglePortal = async () => {
    setSaving(true); setMsg('')
    try {
      const res = await fetch(`/api/clientes/${clienteId}/portal`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(portal?.portalActivo ? { portalActivo: false } : { portalActivo: true }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg(data.error); return }
      setPortal(data)
    } catch { setMsg('Error') }
    finally { setSaving(false) }
  }

  const copiarLink = () => {
    const url = `${window.location.origin}/portal/login?org=${organizationId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) return null

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-extrabold text-[var(--cf-ink-3)] uppercase tracking-[.07em]">
          Portal del cliente
        </h3>
        {portal?.tienePin && (
          <button
            onClick={togglePortal}
            disabled={saving}
            className={`relative w-10 h-[22px] rounded-full transition-colors ${portal.portalActivo ? 'bg-[var(--cf-green-dark)]' : 'bg-[var(--cf-fill)]'}`}
          >
            <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white transition-transform ${portal.portalActivo ? 'left-[22px]' : 'left-[3px]'}`} />
          </button>
        )}
      </div>

      {!portal?.tienePin ? (
        <>
          <p className="text-[12px] text-[var(--cf-ink-3)] mb-3">
            Permite que {cedula} vea sus préstamos y pagos desde su celular. Crea un PIN de acceso.
          </p>
          {!showSetPin ? (
            <button
              onClick={() => setShowSetPin(true)}
              className="w-full h-9 rounded-[10px] text-[12px] font-bold transition-opacity hover:opacity-90"
              style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)', color: 'var(--cf-ink)' }}
            >
              Activar portal
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="PIN (4-6 dígitos)"
                value={pinInput}
                onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                className="flex-1 h-9 px-3 rounded-[10px] bg-[var(--cf-surface)] border border-[var(--cf-border)] text-[var(--cf-ink)] text-[13px] font-mono tracking-widest text-center focus:outline-none focus:border-[var(--cf-gold)]"
              />
              <button
                onClick={guardarPin}
                disabled={saving || pinInput.length < 4}
                className="h-9 px-4 rounded-[10px] bg-[var(--cf-gold)] text-[var(--cf-gold-ink)] text-[12px] font-bold disabled:opacity-50"
              >
                {saving ? '...' : 'Guardar'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${portal.portalActivo ? 'bg-[var(--cf-green-dark)]' : 'bg-[var(--cf-ink-3)]'}`} />
            <span className="text-[12px] text-[var(--cf-ink-2)]">
              {portal.portalActivo ? 'Acceso activo' : 'Acceso desactivado'}
            </span>
          </div>
          {portal.ultimoAcceso && (
            <p className="text-[10px] text-[var(--cf-ink-3)]">
              Último acceso: {new Date(portal.ultimoAcceso).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={copiarLink}
              className="flex-1 h-8 rounded-[10px] border border-[var(--cf-border)] text-[var(--cf-ink-2)] text-[11px] font-semibold hover:border-[var(--cf-border-strong)] transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              {copied ? 'Copiado' : 'Copiar link'}
            </button>
            <button
              onClick={() => { setShowSetPin(true); setPinInput('') }}
              className="h-8 px-3 rounded-[10px] border border-[var(--cf-border)] text-[var(--cf-ink-3)] text-[11px] font-semibold hover:border-[var(--cf-border-strong)] transition-colors"
            >
              Cambiar PIN
            </button>
          </div>
          {showSetPin && (
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Nuevo PIN"
                value={pinInput}
                onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                className="flex-1 h-9 px-3 rounded-[10px] bg-[var(--cf-surface)] border border-[var(--cf-border)] text-[var(--cf-ink)] text-[13px] font-mono tracking-widest text-center focus:outline-none focus:border-[var(--cf-gold)]"
              />
              <button
                onClick={guardarPin}
                disabled={saving || pinInput.length < 4}
                className="h-9 px-4 rounded-[10px] bg-[var(--cf-gold)] text-[var(--cf-gold-ink)] text-[12px] font-bold disabled:opacity-50"
              >
                {saving ? '...' : 'Guardar'}
              </button>
              <button onClick={() => { setShowSetPin(false); setPinInput('') }} className="h-9 px-2 text-[var(--cf-ink-3)] text-[11px]">
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
      {msg && <p className={`text-[11px] mt-2 ${msg.includes('Error') || msg.includes('Mínimo') ? 'text-[var(--cf-red-dark)]' : 'text-[var(--cf-green-dark)]'}`}>{msg}</p>}
    </Card>
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
        className="w-full sm:max-w-md bg-[var(--cf-surface)] border border-[var(--cf-border)] rounded-t-[20px] sm:rounded-[20px] flex flex-col max-h-[85vh]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 70px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-[var(--cf-ink)]">Eliminar cliente</h3>
            <button onClick={onClose} className="text-[var(--cf-ink-3)] hover:text-[var(--cf-ink)] p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-[var(--cf-red-dark)]">
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
                <p className="text-sm text-[var(--cf-ink)] font-medium">Trasladar a otro cliente</p>
                <button onClick={() => setTrasladarId(null)} className="text-xs text-[var(--cf-ink-3)] hover:text-[var(--cf-ink)]">Cancelar</button>
              </div>
              <input
                type="text"
                value={buscar}
                onChange={e => setBuscar(e.target.value)}
                placeholder="Buscar cliente por nombre o cédula..."
                className="w-full mb-2 px-3 py-2 bg-[var(--cf-card)] border border-[var(--cf-border)] rounded-[12px] text-sm text-[var(--cf-ink)] placeholder-[var(--cf-ink-3)] focus:outline-none focus:border-[var(--cf-gold)]"
              />
              {loadingClientes ? (
                <p className="text-xs text-[var(--cf-ink-3)] text-center py-3">Buscando...</p>
              ) : clientes.length === 0 ? (
                <p className="text-xs text-[var(--cf-ink-3)] text-center py-3">No se encontraron clientes</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {clientes.slice(0, 10).map(c => (
                    <button
                      key={c.id}
                      onClick={() => { onTrasladar(trasladarId, c.id); setTrasladarId(null) }}
                      disabled={loading}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-[8px] bg-[var(--cf-card)] hover:bg-[rgba(245,197,24,0.08)] text-left transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-[rgba(245,197,24,0.15)] flex items-center justify-center text-xs font-bold text-[var(--cf-gold)] shrink-0">
                        {c.nombre?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--cf-ink)] truncate">{c.nombre}</p>
                        <p className="text-[10px] text-[var(--cf-ink-3)]">CC {c.cedula}</p>
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
                <div key={p.id} className="p-3 rounded-[12px] bg-[var(--cf-card)] border border-[var(--cf-border)]">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium font-mono-display text-[var(--cf-ink)]">{formatMoney(p.montoPrestado)}</p>
                      <p className="text-[10px] text-[var(--cf-ink-3)]">
                        Saldo: <span className="font-mono-display">{formatMoney(p.saldoPendiente)}</span> - {p.estado}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTrasladarId(p.id)}
                      disabled={loading}
                      className="flex-1 py-2 rounded-[8px] bg-[var(--cf-gold-tint)] border border-[color-mix(in_srgb,var(--cf-gold-dark)_30%,transparent)] text-[var(--cf-gold-dark)] text-xs font-medium hover:bg-[rgba(245,197,24,0.15)] transition-colors"
                    >
                      Trasladar a otro cliente
                    </button>
                    <button
                      onClick={() => onDeletePrestamo(p.id)}
                      disabled={loading}
                      className="flex-1 py-2 rounded-[8px] bg-[var(--cf-red-pill-bg)] border border-[color-mix(in_srgb,var(--cf-red-dark)_30%,transparent)] text-[var(--cf-red-dark)] text-xs font-medium hover:bg-[rgba(239,68,68,0.15)] transition-colors"
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
      <div className="rounded-[20px] cf-card-shadow border p-3.5 flex items-center gap-3" style={{ background: 'color-mix(in srgb, var(--cf-gold-dark) 5%, var(--cf-card))', borderColor: 'color-mix(in srgb, var(--cf-gold-dark) 20%, var(--cf-border))' }}>
        <div className="w-8 h-8 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--cf-gold-dark) 15%, transparent)' }}>
          <svg className="w-4 h-4" style={{ color: 'var(--cf-gold-dark)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-[var(--cf-ink-3)] text-sm pointer-events-none">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={displayValor}
              onChange={handleChange}
              placeholder="Sin limite"
              autoFocus
              className="w-full h-9 rounded-[12px] border text-sm pl-9 pr-3 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)] text-[var(--cf-ink)] placeholder-[var(--cf-ink-3)] focus:outline-none focus:border-[var(--cf-gold)] focus:ring-1 focus:ring-[rgba(245,197,24,0.2)] transition-all"
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setEditando(false)}
            className="h-8 px-2.5 rounded-[8px] border border-[var(--cf-border)] text-xs text-[var(--cf-ink-3)] hover:bg-[var(--cf-fill)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={saving}
            className="h-8 px-3 rounded-[8px] bg-[var(--cf-gold)] text-[var(--cf-gold-ink)] text-xs font-semibold hover:bg-[var(--cf-gold-dark)] transition-colors disabled:opacity-50"
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
      className={`w-full rounded-[20px] cf-card-shadow border p-3.5 flex items-center gap-3 text-left transition-colors${editable ? ' hover:border-[color-mix(in_srgb,var(--cf-gold-dark)_40%,var(--cf-border))] active:scale-[0.99] cursor-pointer' : ''}`}
      style={{
        background: tope > 0
          ? 'color-mix(in srgb, var(--cf-gold-dark) 5%, var(--cf-card))'
          : 'var(--cf-card)',
        borderColor: tope > 0
          ? 'color-mix(in srgb, var(--cf-gold-dark) 20%, var(--cf-border))'
          : 'var(--cf-border)',
      }}
    >
      <div className="w-8 h-8 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: tope > 0 ? 'color-mix(in srgb, var(--cf-gold-dark) 15%, transparent)' : 'color-mix(in srgb, var(--cf-ink-3) 10%, transparent)' }}>
        <svg className="w-4 h-4" style={{ color: tope > 0 ? 'var(--cf-gold-dark)' : 'var(--cf-ink-3)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-ink-3)' }}>Tope de préstamo</p>
        <p className="text-sm font-semibold font-mono-display mt-0.5" style={{ color: tope > 0 ? 'var(--cf-gold-dark)' : 'var(--cf-ink-3)' }}>
          {tope > 0 ? `$${formatDisplay(tope)}` : 'Sin limite'}
        </p>
      </div>
      {editable && (
        <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--cf-ink-3)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        </svg>
      )}
    </Tag>
  )
}

// ─── Sub-componente: tarjeta de préstamo ─────────────────────────
function PrestamoCard({ prestamo: p, clienteId, cliente, orgNombre, ocultarSaldoWA = false, organizationId, mini = false }) {
  const badge  = estadoPrestamoBadge[p.estado] ?? estadoPrestamoBadge.activo
  const porcentaje = p.porcentajePagado ?? 0
  const enMora = (p.diasMora ?? 0) > 0
  const tieneProximoCobro = p.estado === 'activo' && p.proximoCobro
  const proximoCobroLabel = tieneProximoCobro ? formatFechaCobroRelativa(p.proximoCobro) : null
  const cobroVencido = tieneProximoCobro && new Date(p.proximoCobro) < new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }).split(',')[0])
  const prefijoCobro = cobroVencido ? 'Debió cobrarse' : 'Próx. cobro'
  const valorCobro = proximoCobroLabel

  if (mini) {
    return (
      <Link
        href={`/prestamos/${p.id}`}
        className="flex items-center gap-3 bg-[var(--cf-surface)] border border-[var(--cf-border)] rounded-[12px] px-4 py-3 hover:border-[var(--cf-border)]/70 transition-colors group"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono-display text-[var(--cf-ink)]">{formatMoney(p.montoPrestado)}</p>
          <p className="text-xs text-[var(--cf-ink-3)]">
            {new Date(p.fechaInicio).toLocaleDateString('es-CO')}
          </p>
        </div>
        {p.esClavo && (
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'color-mix(in srgb, var(--cf-red-dark) 15%, transparent)', color: 'var(--cf-red-dark)' }}>Perdido</span>
        )}
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <svg className="w-4 h-4 text-[var(--cf-border)] group-hover:text-[var(--cf-ink-3)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    )
  }

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-base font-bold font-mono-display text-[var(--cf-ink)]">{formatMoney(p.montoPrestado)}</p>
          <p className="text-xs text-[var(--cf-ink-3)] mt-0.5">
            Prestado el {new Date(p.fechaInicio).toLocaleDateString('es-CO')}
          </p>
          {proximoCobroLabel && (
            <p className={[
              'text-xs mt-0.5 flex items-center gap-1 capitalize',
              cobroVencido ? 'text-[var(--cf-red-dark)]' : 'text-[var(--cf-gold)]',
            ].join(' ')}>
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {prefijoCobro}: <span className="font-medium">{valorCobro}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {p.esClavo && (
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'color-mix(in srgb, var(--cf-red-dark) 15%, transparent)', color: 'var(--cf-red-dark)' }}>Perdido</span>
          )}
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-[var(--cf-ink-3)] mb-1.5">
          <span>Pagado: <span className="font-mono-display">{formatMoney(Math.max(0, (p.totalAPagar ?? p.montoPrestado) - (p.saldoPendiente ?? 0)))}</span></span>
          <span className="font-mono-display">{porcentaje}%</span>
        </div>
        <div className="h-1.5 bg-[var(--cf-fill)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${porcentaje}%`,
              background: porcentaje === 100 ? 'var(--cf-green-dark)' : p.diasMora > 0 ? 'var(--cf-red-dark)' : 'var(--cf-gold)',
            }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1.5">
          <span className="text-[var(--cf-ink-3)]">Saldo: <span className="text-[var(--cf-ink)] font-medium font-mono-display">{formatMoney(p.saldoPendiente)}</span></span>
          {p.diasMora > 0 && (
            <span className="text-[var(--cf-red-dark)] font-medium">{p.diasMora} días en mora</span>
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
          <BotonWhatsApp tipo="mora" cliente={cliente} prestamo={p} orgNombre={orgNombre} ocultarSaldo={ocultarSaldoWA} organizationId={organizationId} />
        )}
      </div>
    </Card>
  )
}
