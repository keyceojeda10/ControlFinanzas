'use client'
// app/(dashboard)/prestamos/[id]/page.jsx - Detalle del préstamo (página central del sistema)

import { useState, useEffect, useRef, useCallback, use } from 'react'
import { useRouter }                  from 'next/navigation'
import Link                           from 'next/link'
import { useAuth }                    from '@/hooks/useAuth'
import { useOffline }                 from '@/components/providers/OfflineProvider'
import { obtenerPrestamoOffline, resolverTempId }     from '@/lib/offline'
import { Badge }                      from '@/components/ui/Badge'
import { Card }                       from '@/components/ui/Card'
import { Modal }                      from '@/components/ui/Modal'
import { SkeletonCard }               from '@/components/ui/Skeleton'
import RegistrarPago                  from '@/components/prestamos/RegistrarPago'
import AjusteSaldo                    from '@/components/prestamos/AjusteSaldo'
import RenovarPrestamo                from '@/components/prestamos/RenovarPrestamo'
import ModificarPlazo                 from '@/components/prestamos/ModificarPlazo'
import EditarDiaCobro                 from '@/components/prestamos/EditarDiaCobro'
import BotonWhatsApp                  from '@/components/ui/BotonWhatsApp'
import BotonCompartir                 from '@/components/ui/BotonCompartir'
import BotonImprimirRecibo            from '@/components/ui/BotonImprimirRecibo'
import OfflineBadge                   from '@/components/offline/OfflineBadge'
import ModalWhatsAppTemplates         from '@/components/ui/ModalWhatsAppTemplates'
import {
  PrestamoHeroCard,
  HeaderClienteContexto,
  BotonPagoPersonalidad,
  StatsContextuales,
  generarStatsContextuales,
  ChipsAccionesSecundarias,
  GrillaDatosSecciones,
  TimelinePrestamo,
  PagoMiniCard,
  ComparativoPrestamosCliente,
  moodColorFromPrestamo,
} from '@/components/prestamos/PrestamoDetalleViews'
import { formatCOP, formatFechaCobroRelativa } from '@/lib/calculos'

// ─── Helpers de formato ──────────────────────────────────────────
const fmtFecha = (d) => d
  ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—'

const estadoBadge = {
  activo:     { variant: 'blue',  label: 'Activo'     },
  completado: { variant: 'green', label: 'Completado' },
  cancelado:  { variant: 'gray',  label: 'Cancelado'  },
}

const tipoPagoBadge = {
  completo:  { variant: 'green',  label: 'Completo'  },
  parcial:   { variant: 'yellow', label: 'Parcial'   },
  capital:   { variant: 'purple', label: 'A Capital' },
  recargo:   { variant: 'red',    label: 'Recargo'   },
  descuento: { variant: 'blue',   label: 'Descuento' },
}

export default function PrestamoDetallePage({ params }) {
  const { id }             = use(params)
  const router             = useRouter()
  const { session, puedeGestionarPrestamos } = useAuth()
  const { lastSyncedAt }   = useOffline()

  const [prestamo,     setPrestamo]     = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [modalPago,    setModalPago]    = useState(false)
  const [modalAtajosCobro, setModalAtajosCobro] = useState(false)
  const [modalGestionPrestamo, setModalGestionPrestamo] = useState(false)
  const [presetPago,   setPresetPago]   = useState(null)
  const [exito,        setExito]        = useState(false)   // animación de éxito
  const [completado,   setCompletado]   = useState(false)   // celebración
  const [ultimoPago,   setUltimoPago]   = useState(null)    // para botón WA pago
  const [cancelando,   setCancelando]   = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [modoReversionCapital, setModoReversionCapital] = useState('devolver_todo')
  const [anulando,     setAnulando]     = useState(null)   // pagoId que se está anulando
  const [comprobante,  setComprobante]  = useState(null)   // pagoId del comprobante expandido
  const [editandoFecha, setEditandoFecha] = useState(null) // pagoId cuya fecha se edita
  const [filtroFecha,  setFiltroFecha]  = useState('')    // YYYY-MM-DD opcional para filtrar historial
  const [rutaNav,      setRutaNav]     = useState(null)
  const [modalRecargo,  setModalRecargo]  = useState(false)
  const [modalDescuento, setModalDescuento] = useState(false)
  const [modalRenovar,  setModalRenovar]  = useState(false)
  const [modalPlazo,    setModalPlazo]    = useState(false)
  const [modalDiaCobro, setModalDiaCobro] = useState(false)
  const [modalWA, setModalWA] = useState(false)
  const [statsCliente, setStatsCliente] = useState(null) // { totalPrestamos, completados, numeroEsteDe }
  const hasLoadedOnceRef = useRef(false)

  // Leer contexto de ruta activa
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('cf-ruta-nav')
      if (saved) setRutaNav(JSON.parse(saved))
    } catch {}
  }, [])

  const fetchPrestamo = useCallback(async ({ soft = false } = {}) => {
    const shouldUseSoftRefresh = soft && hasLoadedOnceRef.current
    if (!shouldUseSoftRefresh) setLoading(true)

    // Temp ID (creado offline) — si ya se sincronizó, redirigir al ID real
    if (typeof id === 'string' && id.startsWith('offline-')) {
      try {
        const realId = await resolverTempId(id)
        if (realId) {
          router.replace(`/prestamos/${realId}`)
          return
        }
      } catch {}
      try {
        const cached = await obtenerPrestamoOffline(id)
        if (cached) {
          setPrestamo(cached)
          if (!shouldUseSoftRefresh) setLoading(false)
          hasLoadedOnceRef.current = true
          return
        }
      } catch {}
    }

    // Offline: prefer IndexedDB (has locally-updated data, SW cache may be stale)
    if (!navigator.onLine) {
      try {
        const cached = await obtenerPrestamoOffline(id)
        if (cached) {
          setPrestamo(cached)
          if (!shouldUseSoftRefresh) setLoading(false)
          hasLoadedOnceRef.current = true
          return
        }
      } catch {}
    }
    try {
      const res  = await fetch(`/api/prestamos/${id}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.offline) throw new Error('offline')
      setPrestamo(data)
    } catch {
      try {
        const cached = await obtenerPrestamoOffline(id)
        if (cached) {
          setPrestamo(cached)
          if (!shouldUseSoftRefresh) setLoading(false)
          hasLoadedOnceRef.current = true
          return
        }
      } catch {}
      if (!shouldUseSoftRefresh) setError('No se pudo cargar el préstamo.')
    } finally {
      if (!shouldUseSoftRefresh) setLoading(false)
      hasLoadedOnceRef.current = true
    }
  }, [id])

  useEffect(() => { fetchPrestamo() }, [fetchPrestamo])

  // Re-fetch silently when offline payments get synced
  useEffect(() => {
    if (lastSyncedAt > 0) {
      fetchPrestamo({ soft: true })
    }
  }, [lastSyncedAt, fetchPrestamo])

  // Intent param desde rutas: abrir modal de pago al entrar
  useEffect(() => {
    if (!prestamo || modalPago) return
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    if (params.get('openPago') !== '1') return
    if (prestamo.estado !== 'activo' || prestamo.pagoHoy) return

    setModalPago(true)
    params.delete('openPago')
    const search = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${search ? `?${search}` : ''}`)
  }, [prestamo, modalPago])

  // Cargar stats del cliente para mostrar comparativo "vs prestamos anteriores"
  useEffect(() => {
    const clienteId = prestamo?.cliente?.id
    if (!clienteId) return
    let cancel = false
    fetch(`/api/clientes/${clienteId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancel || !data?.prestamos) return
        const todos = data.prestamos
        const completados = todos.filter(p => p.estado === 'completado').length
        // Numero de este prestamo: ordenamos por fecha createdAt asc, este indice + 1
        const ordenados = [...todos].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        const idx = ordenados.findIndex(p => p.id === prestamo.id)
        setStatsCliente({
          totalPrestamos: todos.length,
          completados,
          numeroEsteDe: idx >= 0 ? idx + 1 : 1,
        })
      })
      .catch(() => {})
    return () => { cancel = true }
  }, [prestamo?.cliente?.id, prestamo?.id])

  const handlePagoExito = (prestamoActualizado, pagoRegistrado) => {
    setPrestamo(prestamoActualizado)
    setUltimoPago(pagoRegistrado ?? null)
    setExito(true)
    if (prestamoActualizado.estado === 'completado') setCompletado(true)
    setTimeout(() => setExito(false), 3000)
  }

  // ─── Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  // ─── Error ──────────────────────────────────────────────────────
  if (error || !prestamo) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] rounded-[16px] p-6 text-center">
          <p className="font-semibold mb-2">Préstamo no encontrado</p>
          <button onClick={() => router.back()} className="text-sm underline">Volver</button>
        </div>
      </div>
    )
  }

  const {
    cliente, estado, montoPrestado, totalAPagar, cuotaDiaria, frecuencia,
    tasaInteres, diasPlazo, fechaInicio, fechaFin,
    totalPagado, saldoPendiente, porcentajePagado, diasMora,
    cuotasPendientes = 0,
    cuotasEnMora = 0,
    montoEnMora = 0,
    montoParaPonerseAlDia = 0,
    pagoHoy: yaPagoHoy, pagos = [], proximoCobro,
  } = prestamo

  const frecuenciaLabel = {
    diario: 'diario',
    semanal: 'semanal',
    quincenal: 'quincenal',
    mensual: 'mensual',
  }[frecuencia] || 'diario'

  const badge      = estadoBadge[estado] ?? estadoBadge.activo
  const estaActivo = estado === 'activo'
  const enMora     = diasMora > 3
  const totalPagadoReal = Math.round(totalPagado || 0)
  const montoPrestadoRedondeado = Math.round(montoPrestado || 0)
  const saldoFinancieroPendiente = Math.max(0, montoPrestadoRedondeado - totalPagadoReal)
  const hayCobrosRegistrados = totalPagadoReal > 0
  const hayMontoMora = estaActivo && !completado && montoEnMora > 0
  const hayMontoAlDia = estaActivo && !completado && montoParaPonerseAlDia > 0
  const mostrarAtajosCobro = estaActivo && !completado && saldoPendiente > 0

  // Sparkline 14 dias: monto cobrado por dia (excluye recargos/descuentos)
  const sparkline14d = (() => {
    const buckets = Array(14).fill(0)
    const hoyCO = new Date(Date.now() - 5 * 60 * 60 * 1000)
    const inicioHoyMs = Date.UTC(hoyCO.getUTCFullYear(), hoyCO.getUTCMonth(), hoyCO.getUTCDate())
    for (const pg of pagos) {
      if (!pg.fechaPago) continue
      if (['recargo', 'descuento'].includes(pg.tipo)) continue
      const pagoCO = new Date(new Date(pg.fechaPago).getTime() - 5 * 60 * 60 * 1000)
      const diaCO = Date.UTC(pagoCO.getUTCFullYear(), pagoCO.getUTCMonth(), pagoCO.getUTCDate())
      const diasAtras = Math.floor((inicioHoyMs - diaCO) / (24 * 60 * 60 * 1000))
      if (diasAtras >= 0 && diasAtras < 14) {
        buckets[13 - diasAtras] += pg.montoPagado
      }
    }
    return buckets
  })()

  // Cuotas pagadas
  const cuotasPagadas = cuotaDiaria > 0 ? Math.floor(totalPagadoReal / cuotaDiaria) : 0

  // Stats contextuales
  const statsContexto = generarStatsContextuales({
    prestamo,
    totalPagado: totalPagadoReal,
    cuotasPagadas,
    fechaInicio,
    fechaFin,
    diasMora,
    porcentajePagado,
    prestamoNumeroCliente: statsCliente?.numeroEsteDe,
    totalPrestamosCliente: statsCliente?.totalPrestamos,
  })

  // Narrativa para el HeroCard
  const narrativaSaldo = (() => {
    if (estado === 'completado') return '¡Préstamo completado! 🎉'
    if (estado === 'cancelado') return 'Préstamo cancelado'
    if (porcentajePagado >= 90) return '¡Casi listo! Falta poco'
    if (diasMora > 7) return `${diasMora} días en mora — atención urgente`
    if (diasMora > 0) return `${diasMora} día${diasMora === 1 ? '' : 's'} vencido`
    if (yaPagoHoy) return 'Pagó hoy ✓'
    if (porcentajePagado >= 50) return 'Va por buen camino'
    return null
  })()
  const mostrarGestionPrestamo = estaActivo && !completado && puedeGestionarPrestamos

  const abrirPagoNormal = () => {
    setPresetPago(null)
    setModalPago(true)
  }

  const abrirPagoConMonto = (monto, tipo = 'parcial') => {
    const montoSeguro = Math.max(0, Math.min(Math.round(monto || 0), Math.round(saldoPendiente || 0)))
    if (!montoSeguro) {
      abrirPagoNormal()
      return
    }
    setPresetPago({ monto: montoSeguro, tipo })
    setModalPago(true)
  }

  const getRutaCobroUrl = (clienteRuta) => {
    const prestamosIds = Array.isArray(clienteRuta?.prestamosActivosIds)
      ? clienteRuta.prestamosActivosIds.filter(Boolean)
      : (clienteRuta?.prestamoActivo ? [clienteRuta.prestamoActivo] : [])

    if (prestamosIds.length === 1) {
      return `/prestamos/${prestamosIds[0]}?openPago=1&fromRuta=1`
    }
    return `/clientes/${clienteRuta.id}`
  }
  const cobroInfo = estaActivo && proximoCobro
    ? {
        label: diasMora > 0 ? 'Debió cobrarse' : 'Próximo cobro',
        value: formatFechaCobroRelativa(proximoCobro),
        color: diasMora > 0 ? 'var(--color-danger)' : 'var(--color-accent)',
      }
    : null

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-4">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[white] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Préstamos
      </button>

      {/* ── CELEBRACIÓN ──────────────────────────────────────────── */}
      {completado && (
        <div className="bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.3)] rounded-[16px] p-4 text-center animate-pulse">
          <p className="text-2xl mb-1">🎉</p>
          <p className="text-[var(--color-success)] font-bold">¡Préstamo completado!</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">El cliente terminó de pagar</p>
        </div>
      )}

      {/* ── ALERTA MORA ──────────────────────────────────────────── */}
      {enMora && estaActivo && !completado && (
        <div className="flex items-center gap-3 bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.3)] rounded-[16px] px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-[var(--color-danger)] animate-pulse shrink-0" />
          <p className="text-sm text-[var(--color-danger)] font-semibold">
            {diasMora} días en mora
            {cuotasEnMora > 0 ? ` · ${cuotasEnMora} cuota${cuotasEnMora === 1 ? '' : 's'} vencida${cuotasEnMora === 1 ? '' : 's'}` : ''}
            {montoEnMora > 0 ? ` · ${formatCOP(montoEnMora)}` : ''}
          </p>
        </div>
      )}

      {/* ── ANIMACIÓN ÉXITO PAGO ────────────────────────────────── */}
      {exito && !completado && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.3)] rounded-[16px] px-4 py-3">
            <svg className="w-5 h-5 text-[var(--color-success)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-[var(--color-success)] font-medium">Pago registrado exitosamente</p>
          </div>
          {ultimoPago && cliente?.telefono && (
            <BotonWhatsApp tipo="pago" cliente={cliente} prestamo={prestamo} pago={ultimoPago} />
          )}
          {ultimoPago && (
            <div className="flex gap-2">
              <BotonCompartir cliente={cliente} prestamo={prestamo} pago={ultimoPago} />
              <BotonImprimirRecibo cliente={cliente} prestamo={prestamo} pago={ultimoPago} />
            </div>
          )}
        </div>
      )}

      {/* ── WA PAGO (persiste después de cerrar animación) ───────── */}
      {!exito && ultimoPago && !completado && (
        <>
          {cliente?.telefono && (
            <BotonWhatsApp tipo="pago" cliente={cliente} prestamo={prestamo} pago={ultimoPago} />
          )}
          <div className="flex gap-2">
            <BotonCompartir cliente={cliente} prestamo={prestamo} pago={ultimoPago} />
            <BotonImprimirRecibo cliente={cliente} prestamo={prestamo} pago={ultimoPago} />
          </div>
        </>
      )}

      {/* ── WA PRÉSTAMO COMPLETADO ───────────────────────────────── */}
      {completado && ultimoPago && (
        <>
          {cliente?.telefono && (
            <BotonWhatsApp tipo="pago" cliente={cliente} prestamo={prestamo} pago={ultimoPago} />
          )}
          <div className="flex gap-2">
            <BotonCompartir cliente={cliente} prestamo={prestamo} pago={ultimoPago} />
            <BotonImprimirRecibo cliente={cliente} prestamo={prestamo} pago={ultimoPago} />
          </div>
        </>
      )}

      {/* ── SIGUIENTE EN RUTA (después de pago) ──────────────────── */}
      {rutaNav && (exito || yaPagoHoy) && (() => {
        const idx = rutaNav.clientes.findIndex(c => c.id === cliente?.id)
        const isLast = idx >= rutaNav.clientes.length - 1
        const nextCliente = !isLast && idx >= 0 ? rutaNav.clientes[idx + 1] : null

        const navigateNext = () => {
          if (!nextCliente) return
          const newNav = { ...rutaNav, currentIndex: idx + 1 }
          sessionStorage.setItem('cf-ruta-nav', JSON.stringify(newNav))
          const getDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
          localStorage.setItem(`cf-ruta-progress-${rutaNav.rutaId}`, JSON.stringify({
            clienteId: nextCliente.id, clienteNombre: nextCliente.nombre, index: idx + 1, date: getDate(),
          }))
          const url = getRutaCobroUrl(nextCliente)
          navigator.onLine ? router.push(url) : (window.location.href = url)
        }

        return isLast ? (
          <button
            onClick={() => { sessionStorage.removeItem('cf-ruta-nav'); const u = `/rutas/${rutaNav.rutaId}`; navigator.onLine ? router.push(u) : (window.location.href = u) }}
            className="w-full py-3.5 rounded-[14px] bg-[var(--color-success)] text-[var(--color-text-primary)] text-sm font-semibold active:scale-[0.98] transition-all"
          >
            Ruta finalizada · Volver a {rutaNav.rutaNombre}
          </button>
        ) : (
          <button
            onClick={navigateNext}
            className="w-full py-3.5 rounded-[14px] text-sm font-semibold active:scale-[0.98] transition-all"
            style={{ background: 'linear-gradient(135deg, #f5c518, #f0b800)', color: '#0a0a0a' }}
          >
            Siguiente → {nextCliente.nombre}
          </button>
        )
      })()}

      {/* ── 2. HEADER CLIENTE CON CONTEXTO ─────────────────────────── */}
      <HeaderClienteContexto
        cliente={cliente}
        prestamo={prestamo}
        statsCliente={statsCliente && statsCliente.totalPrestamos > 1
          ? `${statsCliente.completados} préstamo${statsCliente.completados === 1 ? '' : 's'} completado${statsCliente.completados === 1 ? '' : 's'} · cliente recurrente`
          : null}
        onWhatsApp={cliente?.telefono ? () => setModalWA(true) : null}
      />

      {/* ── 3. BOTÓN PRINCIPAL DE PAGO CON PERSONALIDAD ────────────── */}
      {estaActivo && !yaPagoHoy && !completado && (
        <BotonPagoPersonalidad
          enMora={enMora}
          frecuenciaLabel={frecuenciaLabel}
          monto={cuotaDiaria}
          onClick={abrirPagoNormal}
        />
      )}

      {/* ── PAGÓ HOY ─────────────────────────────────────────────── */}
      {estaActivo && yaPagoHoy && !completado && (
        <div
          className="w-full h-14 rounded-[16px] flex items-center justify-center gap-2.5"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}
        >
          <svg className="w-5 h-5 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-[var(--color-success)] font-bold">Pagó {frecuenciaLabel} — {formatCOP(cuotaDiaria)}</span>
        </div>
      )}

      {/* ── 5. ACCIONES SECUNDARIAS COMO CHIPS ─────────────────── */}
      {(mostrarAtajosCobro || mostrarGestionPrestamo) && (
        <ChipsAccionesSecundarias
          acciones={[
            ...(mostrarAtajosCobro ? [{
              label: 'Cobros',
              sublabel: hayMontoMora ? `Mora ${formatCOP(montoEnMora)}` : 'Abonos y atajos',
              color: hayMontoMora ? 'var(--color-danger)' : 'var(--color-accent)',
              icon: <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
              onClick: () => setModalAtajosCobro(true),
            }] : []),
            ...(mostrarGestionPrestamo ? [{
              label: 'Gestión',
              sublabel: 'Renovar, plazo, ajustes',
              color: '#a855f7',
              icon: <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.425-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" /></svg>,
              onClick: () => setModalGestionPrestamo(true),
            }] : []),
          ]}
        />
      )}

      {/* ── 1. HERO CARD: SALDO PENDIENTE EN GRANDE + DONUT + SPARKLINE ── */}
      <PrestamoHeroCard
        prestamo={prestamo}
        narrativa={narrativaSaldo}
        sparklineData={sparkline14d.some(v => v > 0) ? sparkline14d : null}
      />

      {/* ── 4. STATS INTELIGENTES CONTEXTUALES (chips) ───────────── */}
      {statsContexto.length > 0 && <StatsContextuales stats={statsContexto} />}

      {/* ── 9. COMPARATIVO PRÉSTAMOS DEL CLIENTE ─────────────────── */}
      <ComparativoPrestamosCliente
        totalPrestamosCliente={statsCliente?.totalPrestamos}
        prestamoNumeroCliente={statsCliente?.numeroEsteDe}
        prestamosCompletadosCliente={statsCliente?.completados}
      />

      {/* ── 7. LÍNEA DE TIEMPO DEL PRÉSTAMO ──────────────────────── */}
      {estaActivo && fechaInicio && fechaFin && (
        <TimelinePrestamo
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
          porcentajePagado={porcentajePagado}
          color={moodColorFromPrestamo(prestamo)}
        />
      )}

      {/* ── 6. GRILLA DE DATOS EN 3 SECCIONES ─────────────────────── */}
      <GrillaDatosSecciones
        secciones={[
          {
            titulo: 'Crédito',
            color: '#f5c518',
            icon: (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ),
            items: [
              { label: 'Prestado', value: formatCOP(montoPrestado) },
              { label: 'Total a pagar', value: formatCOP(totalAPagar) },
              { label: 'Tasa', value: `${tasaInteres}%` },
              { label: 'Plazo', value: `${diasPlazo} días` },
            ],
          },
          {
            titulo: 'Pagos',
            color: '#22c55e',
            icon: (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            items: [
              { label: `Cuota ${frecuenciaLabel}`, value: formatCOP(cuotaDiaria) },
              { label: 'Cuotas pendientes', value: `${cuotasPendientes}` },
              ...(cobroInfo ? [{ label: cobroInfo.label, value: cobroInfo.value, color: cobroInfo.color }] : []),
              {
                label: diasMora > 0 ? 'Días en mora' : 'Estado',
                value: diasMora > 0 ? `${diasMora} días${cuotasEnMora > 0 ? ` · ${cuotasEnMora}c` : ''}` : 'Al día',
                color: diasMora > 0 ? 'var(--color-danger)' : 'var(--color-success)',
              },
            ],
          },
          {
            titulo: 'Fechas',
            color: '#3b82f6',
            icon: (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ),
            items: [
              { label: 'Inicio', value: fmtFecha(fechaInicio) },
              { label: 'Vencimiento', value: fmtFecha(fechaFin) },
            ],
          },
        ]}
      />

      {/* ── BOTONES WHATSAPP ─────────────────────────────────────── */}
      {cliente?.telefono && estaActivo && enMora && !completado && (
        <BotonWhatsApp tipo="mora" cliente={cliente} prestamo={prestamo} />
      )}
      {cliente?.telefono && estaActivo && !enMora && !ultimoPago && (
        <BotonWhatsApp tipo="prestamo" cliente={cliente} prestamo={prestamo} />
      )}

      {/* ── HISTORIAL DE PAGOS ───────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
            Historial de pagos ({(filtroFecha ? pagos.filter(p => {
              const d = new Date(new Date(p.fechaPago).getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
              return d === filtroFecha
            }) : pagos).length}{filtroFecha ? ` de ${pagos.length}` : ''})
          </p>
          <div className="flex items-center gap-1">
            <label
              className="relative h-8 flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 cursor-pointer hover:border-[#3b82f6] transition-colors"
              title="Filtrar por fecha"
            >
              <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[11px] text-[var(--color-text-primary)] whitespace-nowrap">
                {filtroFecha || 'Fecha'}
              </span>
              <input
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
            {filtroFecha && (
              <button
                type="button"
                onClick={() => setFiltroFecha('')}
                className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] px-2 py-1"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {cliente?.telefono && (
            <BotonWhatsApp
              tipo="historial"
              cliente={cliente}
              prestamo={prestamo}
            />
          )}
          <div className="flex gap-2">
            <BotonCompartir
              tipo="historial"
              cliente={cliente}
              prestamo={prestamo}
            />
            <BotonImprimirRecibo
              tipo="historial"
              cliente={cliente}
              prestamo={prestamo}
            />
          </div>
        </div>

        {(() => {
          const pagosFiltrados = filtroFecha
            ? pagos.filter((p) => {
                const d = new Date(new Date(p.fechaPago).getTime() - 5 * 60 * 60 * 1000)
                  .toISOString().slice(0, 10)
                return d === filtroFecha
              })
            : pagos
          return pagosFiltrados.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
              {filtroFecha ? 'Sin pagos en esta fecha' : 'Sin pagos registrados'}
            </p>
          ) : (
          <div className="space-y-2.5">
            {pagosFiltrados.map((pago) => {
              const esAjuste = ['recargo', 'descuento'].includes(pago.tipo)
              const comprobanteAbierto = comprobante === pago.id
              return (
                <PagoMiniCard key={pago.id} pago={pago} isOffline={pago.id?.startsWith?.('offline-')}>
                  {/* Botones de accion (comprobante, editar fecha, anular) */}
                  <div className="flex items-center gap-1 mt-2 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                    {!esAjuste && (
                      <button
                        onClick={() => setComprobante(comprobanteAbierto ? null : pago.id)}
                        className={[
                          'flex items-center gap-1 px-2 h-7 rounded-[8px] text-[10px] font-medium transition-colors',
                          comprobanteAbierto
                            ? 'text-[var(--color-accent)] bg-[rgba(245,197,24,0.1)]'
                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[rgba(245,197,24,0.08)]',
                        ].join(' ')}
                        title="Enviar comprobante"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Compartir
                      </button>
                    )}
                    {pago.tipo === 'capital' && tasaInteres > 0 && (
                      <span className="text-[10px] px-2 py-1 rounded-[6px]" style={{ background: 'rgba(168, 85, 247, 0.1)', color: 'var(--color-purple)' }}>
                        -{formatCOP(Math.round(pago.montoPagado * tasaInteres / 100))} int.
                      </span>
                    )}
                    <div className="flex-1" />
                    {session?.user?.rol === 'owner' && (
                      <button
                        onClick={() => setEditandoFecha(editandoFecha === pago.id ? null : pago.id)}
                        className={[
                          'w-7 h-7 flex items-center justify-center rounded-[8px] transition-colors',
                          editandoFecha === pago.id
                            ? 'text-[var(--color-info)] bg-[rgba(59,130,246,0.1)]'
                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-info)] hover:bg-[rgba(59,130,246,0.08)]',
                        ].join(' ')}
                        title="Editar fecha"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                    )}
                    {session?.user?.rol === 'owner' && (
                      <button
                        onClick={async () => {
                          if (anulando) return
                          if (!confirm(`¿Anular pago de ${formatCOP(pago.montoPagado)}?`)) return
                          setAnulando(pago.id)
                          try {
                            const res = await fetch(`/api/pagos/${pago.id}`, { method: 'DELETE' })
                            if (!res.ok) throw new Error()
                            await fetchPrestamo()
                          } catch {
                            setError('No se pudo anular el pago.')
                          } finally {
                            setAnulando(null)
                          }
                        }}
                        disabled={anulando === pago.id}
                        className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-dim)] transition-colors disabled:opacity-50"
                        title="Anular pago"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {/* Panel de comprobante expandible */}
                  {comprobanteAbierto && (
                    <div className="pb-3 pl-1 flex flex-col gap-2">
                      {cliente?.telefono && (
                        <BotonWhatsApp
                          tipo="pago"
                          cliente={cliente}
                          prestamo={prestamo}
                          pago={{ montoPagado: pago.montoPagado, fechaPago: pago.fechaPago }}
                        />
                      )}
                      <div className="flex gap-2">
                        <BotonCompartir
                          cliente={cliente}
                          prestamo={prestamo}
                          pago={{ montoPagado: pago.montoPagado, fechaPago: pago.fechaPago }}
                        />
                        <BotonImprimirRecibo
                          cliente={cliente}
                          prestamo={prestamo}
                          pago={{ montoPagado: pago.montoPagado, fechaPago: pago.fechaPago }}
                        />
                      </div>
                    </div>
                  )}
                  {/* Panel de editar fecha expandible */}
                  {editandoFecha === pago.id && (
                    <div className="pb-3 pl-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          defaultValue={new Date(new Date(pago.fechaPago).getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)}
                          className="h-9 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-info)] transition-colors"
                          id={`fecha-pago-${pago.id}`}
                        />
                        <button
                          onClick={async () => {
                            const input = document.getElementById(`fecha-pago-${pago.id}`)
                            if (!input?.value) return
                            // Crear fecha a mediodía para evitar problemas de timezone
                            const nuevaFecha = new Date(input.value + 'T12:00:00')
                            try {
                              const res = await fetch(`/api/pagos/${pago.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ fechaPago: nuevaFecha.toISOString() }),
                              })
                              if (!res.ok) throw new Error()
                              setEditandoFecha(null)
                              await fetchPrestamo()
                            } catch {
                              setError('No se pudo cambiar la fecha.')
                            }
                          }}
                          className="h-9 px-3 rounded-[10px] text-xs font-medium text-[var(--color-text-primary)] bg-[#3b82f6] hover:bg-[#2563eb] transition-colors active:scale-[0.97]"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditandoFecha(null)}
                          className="h-9 px-2 rounded-[10px] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </PagoMiniCard>
              )
            })}
          </div>
          )
        })()}
      </Card>

      {/* ── CANCELAR PRÉSTAMO (solo owner, solo activo) ──────────── */}
      {estaActivo && session?.user?.rol === 'owner' && !completado && (
        <div className="pt-2">
          {!confirmCancel ? (
            <button
              onClick={() => {
                setModoReversionCapital(hayCobrosRegistrados ? 'devolver_restante' : 'devolver_todo')
                setConfirmCancel(true)
              }}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-[12px] text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[rgba(239,68,68,0.08)] border border-[var(--color-border)] hover:border-[rgba(239,68,68,0.3)] transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Cancelar préstamo
            </button>
          ) : (
            <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.3)] rounded-[14px] p-4 space-y-3">
              <p className="text-sm text-[var(--color-danger)] font-semibold">¿Cancelar este préstamo?</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Se marcará como cancelado. El saldo pendiente de {formatCOP(saldoPendiente)} quedará sin cobrar.
              </p>

              {hayCobrosRegistrados && (
                <div className="space-y-2">
                  <p className="text-[11px] text-[var(--color-text-secondary)]">El préstamo ya tiene cobros registrados ({formatCOP(totalPagadoReal)}). Elige cómo reversar en caja:</p>

                  <label className="flex items-start gap-2.5 rounded-[10px] border border-[var(--color-border)] bg-[#131313] px-3 py-2 cursor-pointer">
                    <input
                      type="radio"
                      name="modo-reversion-capital"
                      value="devolver_todo"
                      checked={modoReversionCapital === 'devolver_todo'}
                      onChange={() => setModoReversionCapital('devolver_todo')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-text-primary)]">Devolver todo el préstamo a caja (+{formatCOP(montoPrestadoRedondeado)})</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">Conserva los cobros ya registrados y regresa el monto completo prestado.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 rounded-[10px] border border-[var(--color-border)] bg-[#131313] px-3 py-2 cursor-pointer">
                    <input
                      type="radio"
                      name="modo-reversion-capital"
                      value="devolver_restante"
                      checked={modoReversionCapital === 'devolver_restante'}
                      onChange={() => setModoReversionCapital('devolver_restante')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-text-primary)]">Devolver solo lo pendiente (+{formatCOP(saldoFinancieroPendiente)})</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">Calculado como prestado menos cobrado real.</p>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="flex-1 h-10 rounded-[10px] text-sm font-medium text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-bg-surface)] transition-colors"
                >
                  No, volver
                </button>
                <button
                  onClick={async () => {
                    setCancelando(true)
                    try {
                      const res = await fetch(`/api/prestamos/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          estado: 'cancelado',
                          modoReversionCapital: hayCobrosRegistrados ? modoReversionCapital : 'devolver_todo',
                        }),
                      })
                      if (!res.ok) {
                        let mensaje = 'No se pudo cancelar el préstamo.'
                        try {
                          const payload = await res.json()
                          if (payload?.error) mensaje = payload.error
                        } catch {}
                        throw new Error(mensaje)
                      }
                      await fetchPrestamo()
                      setConfirmCancel(false)
                    } catch (err) {
                      setError(err.message || 'No se pudo cancelar el préstamo.')
                    } finally {
                      setCancelando(false)
                    }
                  }}
                  disabled={cancelando}
                  className="flex-1 h-10 rounded-[10px] text-sm font-bold text-[var(--color-text-primary)] bg-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_85%,black)] disabled:opacity-50 transition-colors"
                >
                  {cancelando ? 'Cancelando…' : 'Sí, cancelar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: atajos de cobro */}
      <Modal
        open={modalAtajosCobro}
        onClose={() => setModalAtajosCobro(false)}
        title="Opciones de cobro"
      >
        <div className="space-y-2">
          {hayMontoMora && (
            <button
              onClick={() => {
                setModalAtajosCobro(false)
                abrirPagoConMonto(montoEnMora)
              }}
              className="w-full h-11 rounded-[12px] font-semibold text-sm text-[var(--color-danger)] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] hover:bg-[rgba(239,68,68,0.15)] transition-all"
            >
              Pagar mora
              {cuotasEnMora > 0 ? ` (${cuotasEnMora} cuota${cuotasEnMora === 1 ? '' : 's'})` : ''}
              {' · '}
              {formatCOP(montoEnMora)}
            </button>
          )}

          {hayMontoAlDia && montoParaPonerseAlDia !== montoEnMora && (
            <button
              onClick={() => {
                setModalAtajosCobro(false)
                abrirPagoConMonto(montoParaPonerseAlDia)
              }}
              className="w-full h-11 rounded-[12px] font-semibold text-sm text-[var(--color-accent)] bg-[rgba(245,197,24,0.08)] border border-[rgba(245,197,24,0.3)] hover:bg-[rgba(245,197,24,0.15)] transition-all"
            >
              Ponerse al día · {formatCOP(montoParaPonerseAlDia)}
            </button>
          )}

          <button
            onClick={() => {
              setModalAtajosCobro(false)
              abrirPagoNormal()
            }}
            className="w-full h-11 rounded-[12px] font-semibold text-sm text-[var(--color-success)] bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.25)] hover:bg-[rgba(34,197,94,0.15)] transition-all"
          >
            Hacer abono extraordinario
          </button>
        </div>
      </Modal>

      {/* Modal: gestión del préstamo (según permisos) */}
      <Modal
        open={modalGestionPrestamo}
        onClose={() => setModalGestionPrestamo(false)}
        title="Gestión del préstamo"
      >
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setModalGestionPrestamo(false)
              setModalRenovar(true)
            }}
            className="h-11 rounded-[12px] font-medium text-sm text-[var(--color-purple)] bg-[rgba(168,85,247,0.08)] border border-[rgba(168,85,247,0.25)] hover:bg-[rgba(168,85,247,0.15)] transition-all"
          >
            Renovar
          </button>
          <button
            onClick={() => {
              setModalGestionPrestamo(false)
              setModalPlazo(true)
            }}
            className="h-11 rounded-[12px] font-medium text-sm text-[var(--color-info)] bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.25)] hover:bg-[rgba(59,130,246,0.15)] transition-all"
          >
            Modificar plazo
          </button>
          {prestamo?.frecuencia && prestamo.frecuencia !== 'diario' && (
            <button
              onClick={() => {
                setModalGestionPrestamo(false)
                setModalDiaCobro(true)
              }}
              className="h-11 rounded-[12px] font-medium text-sm text-[var(--color-accent)] bg-[rgba(245,197,24,0.08)] border border-[rgba(245,197,24,0.25)] hover:bg-[rgba(245,197,24,0.15)] transition-all"
            >
              Día de cobro
            </button>
          )}
          <button
            onClick={() => {
              setModalGestionPrestamo(false)
              setModalRecargo(true)
            }}
            className="h-11 rounded-[12px] font-medium text-sm text-[#f97316] bg-[rgba(249,115,22,0.08)] border border-[rgba(249,115,22,0.2)] hover:bg-[rgba(249,115,22,0.15)] transition-all"
          >
            Recargo
          </button>
          <button
            onClick={() => {
              setModalGestionPrestamo(false)
              setModalDescuento(true)
            }}
            className="h-11 rounded-[12px] font-medium text-sm text-[var(--color-success)] bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] hover:bg-[rgba(34,197,94,0.15)] transition-all"
          >
            Descuento
          </button>
        </div>
      </Modal>

      {/* Modal de pago */}
      <RegistrarPago
        prestamoId={id}
        cuotaDiaria={cuotaDiaria}
        saldoPendiente={saldoPendiente}
        open={modalPago}
        onClose={() => {
          setModalPago(false)
          setPresetPago(null)
        }}
        onSuccess={handlePagoExito}
        cliente={cliente}
        prestamo={prestamo}
        rutaNav={rutaNav}
        presetPago={presetPago}
      />

      {/* Modales de ajuste */}
      <AjusteSaldo
        prestamoId={id}
        saldoPendiente={saldoPendiente}
        totalAPagar={totalAPagar}
        tipoAjuste="recargo"
        open={modalRecargo}
        onClose={() => setModalRecargo(false)}
        onSuccess={(prestamoActualizado) => {
          setPrestamo(prestamoActualizado)
        }}
      />
      <AjusteSaldo
        prestamoId={id}
        saldoPendiente={saldoPendiente}
        totalAPagar={totalAPagar}
        tipoAjuste="descuento"
        open={modalDescuento}
        onClose={() => setModalDescuento(false)}
        onSuccess={(prestamoActualizado) => {
          setPrestamo(prestamoActualizado)
          if (prestamoActualizado.estado === 'completado') setCompletado(true)
        }}
      />

      {/* Modal de renovación */}
      <RenovarPrestamo
        prestamoId={id}
        saldoPendiente={saldoPendiente}
        prestamoAnterior={{ tasaInteres, diasPlazo, frecuencia }}
        clienteNombre={cliente?.nombre}
        open={modalRenovar}
        onClose={() => setModalRenovar(false)}
      />

      {/* Modal de modificar plazo */}
      <ModificarPlazo
        prestamoId={id}
        prestamo={prestamo}
        open={modalPlazo}
        onClose={() => setModalPlazo(false)}
        onSuccess={fetchPrestamo}
      />

      {/* Modal de dia de cobro */}
      <EditarDiaCobro
        prestamoId={id}
        prestamo={prestamo}
        open={modalDiaCobro}
        onClose={() => setModalDiaCobro(false)}
        onSuccess={fetchPrestamo}
      />

      {/* Modal selector de plantillas WhatsApp (boton circular del header) */}
      <ModalWhatsAppTemplates
        open={modalWA}
        onClose={() => setModalWA(false)}
        cliente={cliente}
        prestamo={prestamo}
      />
    </div>
  )
}
