'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney } from '@/lib/i18n'
import { Modal } from '@/components/ui/Modal'
import { obtenerCoordsRapido } from '@/lib/geo'
import { StaggeredList } from '@/components/ui/StaggeredList'
import MonedaCF from '@/components/ui/MonedaCF'
import MetodoPagoSelector from '@/components/pagos/MetodoPagoSelector'
import { obtenerRutasOffline } from '@/lib/offline'

export default function CobrosHoyPage() {
  const { esCobrador, loading: authLoading } = useAuth()
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const [modalPago, setModalPago]         = useState(null)
  const [pagando, setPagando]             = useState(null)
  const [pagoOk, setPagoOk]               = useState(null)
  const [undoPago, setUndoPago]           = useState(null)
  const [confirmDuplicado, setConfirmDuplicado] = useState(null)
  const undoTimerRef = useRef(null)
  const [metaCumplida, setMetaCumplida] = useState(false)
  const [rutasColapsadas, setRutasColapsadas] = useState({})
  const [montoParcial, setMontoParcial] = useState('')
  const [modoParcial, setModoParcial] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [fotoSubida, setFotoSubida] = useState(false)
  const fotoInputRef = useRef(null)
  const [metodosPago, setMetodosPago] = useState([])

  const construirCobrosOffline = useCallback(async () => {
    const rutas = await obtenerRutasOffline()
    if (!rutas?.length) return null
    const clientes = []
    let esperado = 0, recaudado = 0
    for (const r of rutas) {
      for (const c of (r.clientes || [])) {
        if (!c.prestamos?.length && !c.cuota) continue
        const pagado = c.pagadoHoy || false
        const cuota = c.cuota || c.cuotaDiaria || 0
        clientes.push({
          id: c.id, nombre: c.nombre, cedula: c.cedula, telefono: c.telefono,
          direccion: c.direccion, estado: c.estado, pagadoHoy: pagado,
          cuota, diasMora: c.diasMora || 0, rutaNombre: r.nombre, rutaId: r.id,
          cobroPendienteHoy: c.cobroPendienteHoy ?? !pagado,
          prestamos: c.prestamos || [],
          offline: true,
        })
        esperado += cuota
        if (pagado) recaudado += cuota
      }
    }
    const pendientes = clientes.filter(c => c.cobroPendienteHoy).length
    const pagados = clientes.filter(c => c.pagadoHoy).length
    return {
      clientes,
      resumen: { total: clientes.length, pendientes, pagados, esperadoHoy: esperado, recaudadoHoy: recaudado },
      offline: true,
    }
  }, [])

  const fetchCobros = useCallback(async () => {
    try {
      const r = await fetch(`/api/cobros-hoy?t=${Date.now()}`, { cache: 'no-store' })
      const d = await r.json()
      if (d.error) {
        const offline = await construirCobrosOffline()
        if (offline) { setData(offline); setError('') }
        else setError(d.error)
      } else { setData(d); setError('') }
    } catch {
      const offline = await construirCobrosOffline()
      if (offline) { setData(offline); setError('') }
      else setError('No se pudo cargar los cobros de hoy.')
    } finally {
      setLoading(false)
    }
  }, [construirCobrosOffline])

  useEffect(() => { fetchCobros() }, [fetchCobros])

  useEffect(() => {
    fetch('/api/metodos-pago').then(r => r.ok ? r.json() : []).then(setMetodosPago).catch(() => {})
  }, [])

  // Refrescar cuando el usuario vuelve a la app despues de tenerla en
  // segundo plano (ej. revisar WhatsApp). Sin esto, los cobradores ven
  // estados de pago desactualizados en campo.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchCobros() }
    const onFocus = () => fetchCobros()
    const onOnline = () => fetchCobros()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
    }
  }, [fetchCobros])

  // Detectar meta cumplida
  useEffect(() => {
    if (!data?.resumen) return
    const { recaudadoHoy, esperadoHoy } = data.resumen
    if (esperadoHoy > 0 && recaudadoHoy >= esperadoHoy && !metaCumplida) {
      setMetaCumplida(true)
    }
  }, [data, metaCumplida])

  const abrirPago = (cliente) => {
    if (pagando) return
    const activos = cliente.prestamosActivos ?? []
    if (activos.length === 0) return
    if (activos.length > 1) {
      setModalPago({ id: cliente.id, nombre: cliente.nombre, cuota: null, prestamoActivo: null, prestamosActivos: activos, abonoConPendiente: false })
      return
    }
    const p = activos[0]
    const cuota = p.cuotaDiaria || cliente.cuota
    if (!cuota || cuota <= 0) return
    setModoParcial(false)
    setMontoParcial('')
    setModalPago({ id: cliente.id, nombre: cliente.nombre, cuota, prestamoActivo: p.id, prestamosActivos: activos, abonoConPendiente: cliente.pagoHoy && cliente.cobroPendienteHoy, esBalloon: p.esBalloon || false, cuotaNumero: p.cuotaNumero ?? null, modoInteres: p.modoInteres, cuotaExtraHoy: p.cuotaExtraHoy || false, montoCuotaExtra: p.montoCuotaExtra || 0 })
  }

  const elegirPrestamo = (prestamoId, cuota, extra = {}) => {
    if (!modalPago) return
    setModalPago(prev => prev ? { ...prev, prestamoActivo: prestamoId, cuota, esBalloon: extra.esBalloon || false, cuotaNumero: extra.cuotaNumero ?? null, modoInteres: extra.modoInteres, cuotaExtraHoy: extra.cuotaExtraHoy || false, montoCuotaExtra: extra.montoCuotaExtra || 0 } : prev)
  }

  const ejecutarPago = async (metodoPago, { confirmarDuplicado = false, montoCustom = null, metodoPagoId = null, plataforma = null } = {}) => {
    try { sessionStorage.setItem('cf-ultimo-metodo-pago', metodoPago) } catch {}
    if (!modalPago || pagando) return
    const { id: clienteId, nombre, cuota, prestamoActivo } = modalPago
    const montoFinal = montoCustom ?? cuota
    const tipoPago = montoCustom && montoCustom < cuota ? 'parcial' : 'completo'
    setModalPago(null)
    setModoParcial(false)
    setMontoParcial('')
    setPagando(clienteId)
    const coords = await obtenerCoordsRapido().catch(() => null)

    setData(prev => prev ? {
      ...prev,
      clientes: prev.clientes.map(c =>
        c.id === clienteId ? { ...c, pagoHoy: true, cobroPendienteHoy: false } : c
      ),
      resumen: {
        ...prev.resumen,
        pendientes: tipoPago === 'completo' ? Math.max(0, prev.resumen.pendientes - 1) : prev.resumen.pendientes,
        pagados: tipoPago === 'completo' ? prev.resumen.pagados + 1 : prev.resumen.pagados,
        recaudadoHoy: prev.resumen.recaudadoHoy + montoFinal,
      }
    } : prev)

    try {
      const url = `/api/prestamos/${prestamoActivo}/pagos${confirmarDuplicado ? '?confirmarDuplicado=1' : ''}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ montoPagado: montoFinal, tipo: tipoPago, diasAbonados: tipoPago === 'completo' ? 1 : 0, metodoPago, ...(metodoPagoId ? { metodoPagoId } : {}), ...(coords ?? {}) }),
      })

      if (res.ok) {
        const d = await res.json()
        const pagoId = d.pagos?.[0]?.id
        setPagoOk(clienteId)
        setTimeout(() => setPagoOk(null), 1200)
        fetchCobros()
        if (pagoId) {
          if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
          setUndoPago({ pagoId, prestamoId: prestamoActivo, clienteNombre: nombre })
          setFotoSubida(false)
          undoTimerRef.current = setTimeout(() => setUndoPago(null), 10000)
        }
      } else if (res.status === 409) {
        const d = await res.json().catch(() => ({}))
        if (d?.duplicado && !confirmarDuplicado) {
          fetchCobros()
          setConfirmDuplicado({ clienteId, nombre, cuota, prestamoActivo, metodoPago, metodoPagoId })
        } else {
          alert(d?.error || 'No se pudo registrar el pago')
          fetchCobros()
        }
      } else {
        const d = await res.json().catch(() => ({}))
        alert(d?.error || 'No se pudo registrar el pago')
        fetchCobros()
      }
    } catch {
      alert('Error de conexión. Verifica tu red.')
      fetchCobros()
    } finally {
      setPagando(null)
    }
  }

  const subirFotoQuick = async (file) => {
    if (!undoPago?.pagoId || subiendoFoto) return
    setSubiendoFoto(true)
    try {
      const fd = new FormData()
      fd.append('foto', file)
      const res = await fetch(`/api/pagos/${undoPago.pagoId}/foto`, { method: 'POST', body: fd })
      if (res.ok) setFotoSubida(true)
    } catch {} finally {
      setSubiendoFoto(false)
    }
  }

  const deshacerPago = async () => {
    if (!undoPago) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoPago(null)
    try {
      await fetch(`/api/pagos/${undoPago.pagoId}`, { method: 'DELETE' })
      fetchCobros()
    } catch {}
  }

  if (authLoading || loading) return (
    <div className="max-w-2xl mx-auto space-y-3 px-1">
      <div className="rounded-[20px] h-28 animate-pulse" style={{ background: 'var(--color-bg-card)' }} />
      <div className="rounded-[16px] h-16 animate-pulse" style={{ background: 'var(--color-bg-card)' }} />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-[16px] h-[76px] animate-pulse" style={{ background: 'var(--color-bg-card)' }} />
      ))}
    </div>
  )

  if (!esCobrador) return (
    <div className="max-w-2xl mx-auto px-1 py-8 text-center">
      <p style={{ color: 'var(--color-text-muted)' }}>Esta vista es solo para cobradores.</p>
    </div>
  )

  const clientes = data?.clientes ?? []
  const resumen = data?.resumen ?? {}
  const pendientes = clientes.filter(c => c.cobroPendienteHoy)
  const pagados = clientes.filter(c => !c.cobroPendienteHoy && c.pagoHoy)

  const rutasPendientes = (() => {
    const map = {}
    pendientes.forEach(c => {
      const ruta = c.rutaNombre || 'Sin ruta'
      if (!map[ruta]) map[ruta] = []
      map[ruta].push(c)
    })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
  })()
  const pct = resumen.esperadoHoy > 0
    ? Math.min(100, Math.round((resumen.recaudadoHoy / resumen.esperadoHoy) * 100))
    : 0

  return (
    <div className="max-w-2xl lg:max-w-5xl mx-auto space-y-4 px-1">

      {/* ── Hero: Progreso del día — tarjeta dorada de marca ── */}
      {clientes.length > 0 && (
        <div
          className="rounded-[20px] p-4 sm:p-5 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #f9d64a 0%, #f5c518 55%, #eab308 100%)',
            border: '1px solid rgba(180, 140, 10, 0.35)',
            boxShadow: '0 14px 34px rgba(200, 160, 20, 0.30)',
          }}
        >
          {/* Gloss sutil */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.16) 45%, transparent 58%)' }}
          />

          {/* Header */}
          <div className="flex items-start justify-between gap-3 relative z-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'rgba(35,26,4,0.62)' }}>
                Recaudado hoy
              </p>
              <p className="text-3xl font-extrabold font-mono-display mt-0.5" style={{ color: '#231a04' }}>
                {formatMoney(resumen.recaudadoHoy ?? 0)}
              </p>
              <p className="text-xs mt-1 font-medium" style={{ color: 'rgba(35,26,4,0.62)' }}>
                de {formatMoney(resumen.esperadoHoy ?? 0)} esperados
              </p>
            </div>

            {/* Porcentaje circular */}
            <div className="shrink-0 relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" stroke="rgba(35,26,4,0.16)" />
                <circle
                  cx="18" cy="18" r="15" fill="none" strokeWidth="3"
                  stroke="#231a04"
                  strokeLinecap="round"
                  strokeDasharray={`${pct * 0.942} 100`}
                  style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.22,1,0.36,1)' }}
                />
              </svg>
              <span className="absolute text-xs font-bold" style={{ color: '#231a04' }}>
                {pct}%
              </span>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="mt-3 relative z-10">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(35,26,4,0.16)' }}>
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, background: '#231a04' }}
              />
            </div>
          </div>

          {/* Stats inline */}
          <div className="flex items-center gap-4 mt-3 relative z-10">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: '#b45309' }} />
              <span className="text-xs font-semibold" style={{ color: 'rgba(35,26,4,0.72)' }}>
                {resumen.pendientes ?? 0} pendientes
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: '#15803d' }} />
              <span className="text-xs font-semibold" style={{ color: 'rgba(35,26,4,0.72)' }}>
                {resumen.pagados ?? 0} cobrados
              </span>
            </div>
            <button
              onClick={fetchCobros}
              className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              style={{ background: 'color-mix(in srgb, #231a04 12%, transparent)', color: '#231a04' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>

          {/* Celebración meta cumplida */}
          {metaCumplida && pct >= 100 && (
            <div
              className="mt-3 rounded-[12px] px-3 py-2 relative z-10 flex items-center justify-center gap-2"
              style={{
                background: 'color-mix(in srgb, #231a04 10%, transparent)',
                border: '1px solid color-mix(in srgb, #231a04 18%, transparent)',
              }}
            >
              <MonedaCF pose="celebra" size={34} />
              <p className="text-xs font-bold" style={{ color: '#231a04' }}>
                Meta del dia cumplida
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-[12px] px-4 py-3 flex items-center justify-between gap-3" style={{ background: 'var(--color-danger-dim)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)' }}>
          <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>
          <button
            onClick={fetchCobros}
            className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
            style={{ background: 'color-mix(in srgb, var(--color-danger) 20%, transparent)', color: 'var(--color-danger)' }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── Lista: pendientes agrupados por ruta ── */}
      {pendientes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-warning)' }} />
            <p className="text-[11px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--color-text-muted)' }}>
              Por cobrar ({pendientes.length})
            </p>
          </div>

          {rutasPendientes.length === 1 ? (
            <StaggeredList className="space-y-1.5">
              {rutasPendientes[0][1].map(c => (
                <ClienteCard
                  key={c.id}
                  cliente={c}
                  pagando={pagando === c.id}
                  pagoOk={pagoOk === c.id}
                  onCobrar={() => abrirPago(c)}
                />
              ))}
            </StaggeredList>
          ) : (
            <div className="space-y-3">
              {rutasPendientes.map(([ruta, clientes]) => {
                const colapsada = rutasColapsadas[ruta] ?? false
                return (
                  <div key={ruta} className="space-y-1.5">
                    <button
                      onClick={() => setRutasColapsadas(prev => ({ ...prev, [ruta]: !prev[ruta] }))}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-[12px] transition-all active:scale-[0.99]"
                      style={{
                        background: 'color-mix(in srgb, var(--color-accent) 6%, var(--color-bg-card))',
                        border: '1px solid color-mix(in srgb, var(--color-accent) 12%, var(--color-border))',
                      }}
                    >
                      <svg
                        className="w-3.5 h-3.5 transition-transform shrink-0"
                        style={{ color: 'var(--color-accent)', transform: colapsada ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                      <svg className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      <span className="text-xs font-semibold flex-1 text-left truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {ruta}
                      </span>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--color-warning) 15%, transparent)', color: 'var(--color-warning)' }}
                      >
                        {clientes.length}
                      </span>
                    </button>
                    {!colapsada && (
                      <StaggeredList className="space-y-1.5">
                        {clientes.map(c => (
                          <ClienteCard
                            key={c.id}
                            cliente={c}
                            pagando={pagando === c.id}
                            pagoOk={pagoOk === c.id}
                            onCobrar={() => abrirPago(c)}
                            showRuta={false}
                          />
                        ))}
                      </StaggeredList>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Todos cobrados ── */}
      {pendientes.length === 0 && pagados.length > 0 && (
        <div
          className="rounded-[20px] px-4 py-3 flex items-center gap-3 cf-card-shadow"
          style={{
            background: 'color-mix(in srgb, var(--color-success) 10%, var(--color-bg-card))',
            border: '1px solid color-mix(in srgb, var(--color-success) 25%, var(--color-border))',
          }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--color-success) 20%, transparent)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-success)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>Todos cobrados</p>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>No quedan cobros pendientes por hoy</p>
          </div>
        </div>
      )}

      {/* ── Lista: cobrados ── */}
      {pagados.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-success)' }} />
            <p className="text-[11px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--color-text-muted)' }}>
              Cobrados hoy ({pagados.length})
            </p>
          </div>
          <StaggeredList className="space-y-1.5">
            {pagados.map(c => (
              <ClienteCard
                key={c.id}
                cliente={c}
                pagando={false}
                pagoOk={pagoOk === c.id}
                onCobrar={() => abrirPago(c)}
              />
            ))}
          </StaggeredList>
        </div>
      )}

      {clientes.length === 0 && !loading && (
        <div className="rounded-[20px] px-6 py-10 text-center" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div className="inline-block mb-2">
            <MonedaCF pose="vacia" size={100} />
          </div>
          <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Sin cobros programados hoy</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>No hay clientes con cuota pendiente para hoy.</p>
          <Link href="/rutas" className="inline-block mt-5 text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>Ver rutas →</Link>
        </div>
      )}

      {/* ── Modal: elegir método de pago ── */}
      <Modal open={!!modalPago} onClose={() => setModalPago(null)} title="Cobro rápido">
        {modalPago && !modalPago.prestamoActivo && (modalPago.prestamosActivos?.length ?? 0) > 1 && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{modalPago.nombre}</span> tiene varios préstamos. Elige cual cobrar.
            </p>
            <div className="space-y-2">
              {modalPago.prestamosActivos.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => elegirPrestamo(p.id, p.cuotaDiaria, { esBalloon: p.esBalloon, cuotaNumero: p.cuotaNumero, modoInteres: p.modoInteres, cuotaExtraHoy: p.cuotaExtraHoy, montoCuotaExtra: p.montoCuotaExtra })}
                  disabled={!p.cuotaDiaria || p.cuotaDiaria <= 0}
                  className="w-full text-left px-4 py-3.5 rounded-[12px] border transition-all active:scale-[0.99] disabled:opacity-50"
                  style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Préstamo {i + 1}</p>
                    <span className="text-sm font-bold font-mono-display" style={{ color: 'var(--color-success)' }}>{formatMoney(p.cuotaDiaria ?? 0)}</span>
                  </div>
                  {p.diasMora > 0 && (
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-danger)' }}>{p.diasMora} días de atraso</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {modalPago && modalPago.prestamoActivo && (() => {
          return (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{modoParcial ? 'Pago parcial para' : 'Registrar 1 cuota para'}</p>
              <p className="text-base font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{modalPago.nombre}</p>
              {!modoParcial ? (
                <p className="text-3xl font-extrabold font-mono-display mt-2" style={{ color: 'var(--color-success)' }}>{formatMoney(modalPago.cuota)}</p>
              ) : (
                <div className="mt-3 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold" style={{ color: 'var(--color-text-muted)' }}>$</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={montoParcial}
                    onChange={e => setMontoParcial(e.target.value)}
                    placeholder="Monto"
                    autoFocus
                    className="w-full text-center text-2xl font-extrabold font-mono-display py-3 pl-8 pr-3 rounded-[12px] border outline-none"
                    style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                    min={1}
                    max={modalPago.cuota}
                  />
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-text-muted)' }}>Cuota completa: {formatMoney(modalPago.cuota)}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => { setModoParcial(!modoParcial); setMontoParcial('') }}
              className="w-full text-center text-[12px] font-medium py-1.5 rounded-lg transition-all"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {modoParcial ? 'Cobrar cuota completa' : 'Cobrar otro monto'}
            </button>
            {modalPago.esBalloon && (
              <div className="rounded-[12px] px-3 py-2.5 text-center" style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>Cuota de capital + interés (globo)</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Esta es la última cuota. Incluye la devolución del capital completo mas el interés del período.</p>
              </div>
            )}
            {modalPago.cuotaExtraHoy && (
              <div className="rounded-[12px] px-3 py-2.5 text-center" style={{ background: 'color-mix(in srgb, var(--color-purple) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-purple) 25%, transparent)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--color-purple)' }}>Cuota extra programada: {formatMoney(modalPago.montoCuotaExtra)}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Esta cuota incluye un abono extra a capital. Ya está incluido en el monto total.</p>
              </div>
            )}
            {modalPago.cuotaNumero && ['lineal', 'lineal_dinamico', 'solo_interes'].includes(modalPago.modoInteres) && (
              <p className="text-[10px] text-center" style={{ color: 'var(--color-text-muted)' }}>Cuota #{modalPago.cuotaNumero}</p>
            )}
            {modalPago.abonoConPendiente && (
              <div className="rounded-[12px] px-3 py-2.5 text-center" style={{ background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--color-warning)' }}>Tiene cuotas atrasadas</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Ya pagó hoy pero aún debe mas. Cada registro cubre 1 cuota.</p>
              </div>
            )}
            <MetodoPagoSelector
              metodosPago={metodosPago}
              disabled={!!pagando}
              onSelect={({ metodoPago: mp, metodoPagoId: mpId }) => {
                const monto = modoParcial ? parseFloat(montoParcial) : null
                if (modoParcial && (!monto || monto <= 0 || monto > modalPago.cuota)) return
                ejecutarPago(mp, { montoCustom: monto, metodoPagoId: mpId })
              }}
            />
          </div>
          )
        })()}
      </Modal>

      {/* ── Modal: confirmar pago duplicado ── */}
      <Modal
        open={!!confirmDuplicado}
        onClose={() => { setConfirmDuplicado(null); fetchCobros() }}
        title="Pago duplicado"
      >
        {confirmDuplicado && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{confirmDuplicado.nombre}</span> ya recibio un pago por{' '}
              <span className="font-bold font-mono-display" style={{ color: 'var(--color-warning)' }}>{formatMoney(confirmDuplicado.cuota)}</span> hace menos de 1 minuto.
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Registrar este pago de todos modos?</p>
            <div className="flex gap-3">
              <button
                onClick={() => { const d = confirmDuplicado; setConfirmDuplicado(null); setModalPago({ id: d.clienteId, nombre: d.nombre, cuota: d.cuota, prestamoActivo: d.prestamoActivo, prestamosActivos: [], abonoConPendiente: false }); ejecutarPago(d.metodoPago, { confirmarDuplicado: true, metodoPagoId: d.metodoPagoId }) }}
                className="flex-1 py-2.5 rounded-[12px] text-sm font-semibold transition-all"
                style={{ background: 'var(--color-warning)', color: 'var(--color-accent-text)' }}
              >
                Si, registrar igual
              </button>
              <button
                onClick={() => { setConfirmDuplicado(null); fetchCobros() }}
                className="flex-1 py-2.5 rounded-[12px] text-sm font-medium transition-all"
                style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Toast: deshacer pago ── */}
      <input
        ref={fotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) subirFotoQuick(f)
          e.target.value = ''
        }}
      />
      {undoPago && (
        <div className="fixed bottom-24 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-6 sm:w-auto z-50 animate-slide-up">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-[12px] border sm:min-w-[320px]"
            style={{ background: 'rgba(15,15,22,0.98)', border: '1px solid rgba(34,197,94,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--color-success) 20%, transparent)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-success)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm flex-1 truncate" style={{ color: 'var(--color-text-primary)' }}>Pago registrado — {undoPago.clienteNombre}</span>
            <button
              onClick={() => fotoInputRef.current?.click()}
              disabled={subiendoFoto || fotoSubida}
              className="shrink-0 transition-colors disabled:opacity-50"
              style={{ color: fotoSubida ? 'var(--color-success)' : 'var(--color-text-muted)' }}
              title={fotoSubida ? 'Foto guardada' : 'Adjuntar foto'}
            >
              {subiendoFoto ? (
                <svg className="w-4 h-4 animate-spin" fill="currentColor" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" fill="none" strokeWidth={3} />
                  <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : fotoSubida ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
            <button onClick={deshacerPago} className="text-sm font-bold shrink-0 transition-colors" style={{ color: 'var(--color-accent)' }}>
              Deshacer
            </button>
            <button onClick={() => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); setUndoPago(null) }} className="shrink-0 transition-colors" style={{ color: 'var(--color-text-muted)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ClienteCard({ cliente, pagando, pagoOk, onCobrar, showRuta = true }) {
  const pagado = !cliente.cobroPendienteHoy && cliente.pagoHoy
  const enMora = cliente.diasMora > 0

  const borderColor = pagoOk
    ? 'color-mix(in srgb, var(--color-success) 40%, var(--color-border))'
    : enMora && !pagado
      ? 'color-mix(in srgb, var(--color-danger) 25%, var(--color-border))'
      : pagado
        ? 'color-mix(in srgb, var(--color-success) 20%, var(--color-border))'
        : 'var(--color-border)'

  const bgColor = pagoOk
    ? 'color-mix(in srgb, var(--color-success) 8%, var(--color-bg-card))'
    : enMora && !pagado
      ? 'color-mix(in srgb, var(--color-danger) 4%, var(--color-bg-card))'
      : 'var(--color-bg-card)'

  return (
    <div
      className="rounded-[16px] px-4 py-3.5 flex items-center gap-3 transition-all"
      style={{ background: bgColor, border: `1px solid ${borderColor}` }}
    >
      {/* Avatar */}
      <div
        className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 text-sm font-bold"
        style={{
          background: pagado
            ? 'color-mix(in srgb, var(--color-success) 15%, transparent)'
            : enMora
              ? 'color-mix(in srgb, var(--color-danger) 12%, transparent)'
              : 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
          color: pagado ? 'var(--color-success)' : enMora ? 'var(--color-danger)' : 'var(--color-accent)',
        }}
      >
        {pagado
          ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          : cliente.nombre.charAt(0).toUpperCase()
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link href={`/clientes/${cliente.id}`} className="text-[15px] font-semibold truncate block" style={{ color: 'var(--color-text-primary)' }}>{cliente.nombre}</Link>
        {cliente.direccion && (
          <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{cliente.direccion}</p>
        )}
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {enMora && !pagado && (
            <>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                style={{ background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)', color: 'var(--color-danger)' }}
              >
                {cliente.diasMora}d atraso
              </span>
              {cliente.montoParaPonerseAlDia > cliente.cuota && (
                <span className="text-[10px]" style={{ color: 'var(--color-warning)' }}>
                  Al día: {formatMoney(cliente.montoParaPonerseAlDia)}
                </span>
              )}
            </>
          )}
          {cliente.cuotaExtraHoy && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-md"
              style={{ background: 'color-mix(in srgb, var(--color-purple) 15%, transparent)', color: 'var(--color-purple)' }}
            >
              +Extra {formatMoney(cliente.montoCuotaExtra)}
            </span>
          )}
          {showRuta && cliente.rutaNombre && (
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{cliente.rutaNombre}</span>
          )}
          {pagado && (
            <span className="text-[10px] font-medium" style={{ color: 'var(--color-success)' }}>Pagó hoy</span>
          )}
        </div>
      </div>

      {/* Acción */}
      {pagado ? (
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold font-mono-display" style={{ color: 'var(--color-success)' }}>{formatMoney(cliente.cuota)}</p>
          <Link href={`/clientes/${cliente.id}`} className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Ver detalle</Link>
        </div>
      ) : (
        <button
          onClick={onCobrar}
          disabled={pagando}
          className="shrink-0 px-4 h-11 rounded-[12px] font-bold text-sm font-mono-display transition-all active:scale-95 disabled:opacity-60"
          style={{
            background: pagando ? 'var(--color-bg-hover)' : enMora ? 'var(--color-danger)' : 'var(--color-success)',
            color: '#fff',
            minWidth: '90px',
          }}
        >
          {pagando
            ? <svg className="w-4 h-4 animate-spin mx-auto" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            : formatMoney(cliente.cuota)
          }
        </button>
      )}
    </div>
  )
}
