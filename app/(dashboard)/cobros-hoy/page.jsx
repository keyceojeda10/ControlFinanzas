'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney } from '@/lib/i18n'
import { Modal } from '@/components/ui/Modal'
import { obtenerCoordsRapido } from '@/lib/geo'
import { StaggeredList } from '@/components/ui/StaggeredList'

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

  const fetchCobros = useCallback(async () => {
    try {
      const r = await fetch(`/api/cobros-hoy?t=${Date.now()}`, { cache: 'no-store' })
      const d = await r.json()
      if (d.error) setError(d.error)
      else { setData(d); setError('') }
    } catch {
      setError('No se pudo cargar los cobros de hoy.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCobros() }, [fetchCobros])

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
    setModalPago({ id: cliente.id, nombre: cliente.nombre, cuota, prestamoActivo: p.id, prestamosActivos: activos, abonoConPendiente: cliente.pagoHoy && cliente.cobroPendienteHoy })
  }

  const elegirPrestamo = (prestamoId, cuota) => {
    if (!modalPago) return
    setModalPago(prev => prev ? { ...prev, prestamoActivo: prestamoId, cuota } : prev)
  }

  const ejecutarPago = async (metodoPago, { confirmarDuplicado = false, montoCustom = null } = {}) => {
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
        body: JSON.stringify({ montoPagado: montoFinal, tipo: tipoPago, diasAbonados: tipoPago === 'completo' ? 1 : 0, metodoPago, ...(coords ?? {}) }),
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
          undoTimerRef.current = setTimeout(() => setUndoPago(null), 10000)
        }
      } else if (res.status === 409) {
        const d = await res.json().catch(() => ({}))
        if (d?.duplicado && !confirmarDuplicado) {
          fetchCobros()
          setConfirmDuplicado({ clienteId, nombre, cuota, prestamoActivo, metodoPago })
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
    <div className="max-w-2xl mx-auto space-y-4 px-1">

      {/* ── Hero: Progreso del día ── */}
      {clientes.length > 0 && (
        <div
          className="rounded-[20px] p-4 sm:p-5 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 60%)',
            border: '1px solid color-mix(in srgb, var(--color-accent) 15%, var(--color-border))',
          }}
        >
          {/* Orbe decorativo */}
          <div
            className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-[0.06] pointer-events-none"
            style={{ background: 'radial-gradient(circle, var(--color-accent), transparent 70%)' }}
          />

          {/* Header */}
          <div className="flex items-start justify-between gap-3 relative z-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Recaudado hoy
              </p>
              <p className="text-3xl font-extrabold font-mono-display mt-0.5" style={{ color: pct >= 100 ? 'var(--color-success)' : 'var(--color-text-primary)' }}>
                {formatMoney(resumen.recaudadoHoy ?? 0)}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                de {formatMoney(resumen.esperadoHoy ?? 0)} esperados
              </p>
            </div>

            {/* Porcentaje circular */}
            <div className="shrink-0 relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" stroke="var(--color-border)" />
                <circle
                  cx="18" cy="18" r="15" fill="none" strokeWidth="3"
                  stroke={pct >= 100 ? 'var(--color-success)' : 'var(--color-accent)'}
                  strokeLinecap="round"
                  strokeDasharray={`${pct * 0.942} 100`}
                  style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.22,1,0.36,1)' }}
                />
              </svg>
              <span
                className="absolute text-xs font-bold"
                style={{ color: pct >= 100 ? 'var(--color-success)' : 'var(--color-accent)' }}
              >
                {pct}%
              </span>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="mt-3 relative z-10">
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, var(--color-bg-surface))' }}
            >
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  background: pct >= 100
                    ? 'linear-gradient(90deg, var(--color-success), color-mix(in srgb, var(--color-success) 80%, var(--color-accent)))'
                    : 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, var(--color-success)))',
                }}
              />
            </div>
          </div>

          {/* Stats inline */}
          <div className="flex items-center gap-4 mt-3 relative z-10">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-warning)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                {resumen.pendientes ?? 0} pendientes
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-success)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                {resumen.pagados ?? 0} cobrados
              </span>
            </div>
            <button
              onClick={fetchCobros}
              className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>

          {/* Celebración meta cumplida */}
          {metaCumplida && pct >= 100 && (
            <div
              className="mt-3 rounded-[12px] px-3 py-2 text-center relative z-10"
              style={{
                background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-success) 25%, transparent)',
              }}
            >
              <p className="text-xs font-bold" style={{ color: 'var(--color-success)' }}>
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
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
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
          className="rounded-[16px] px-4 py-3 flex items-center gap-3"
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
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
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
        <div className="rounded-[20px] px-6 py-14 text-center" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div
            className="w-14 h-14 rounded-[16px] mx-auto flex items-center justify-center mb-4"
            style={{ background: 'color-mix(in srgb, var(--color-success) 12%, transparent)', color: 'var(--color-success)' }}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Sin cobros programados hoy</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>No hay clientes con cuota pendiente para hoy.</p>
          <Link href="/rutas" className="inline-block mt-5 text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>Ver rutas →</Link>
        </div>
      )}

      {/* ── Modal: elegir método de pago ── */}
      <Modal open={!!modalPago} onClose={() => setModalPago(null)} title="Cobro rapido">
        {modalPago && !modalPago.prestamoActivo && (modalPago.prestamosActivos?.length ?? 0) > 1 && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{modalPago.nombre}</span> tiene varios prestamos. Elige cual cobrar.
            </p>
            <div className="space-y-2">
              {modalPago.prestamosActivos.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => elegirPrestamo(p.id, p.cuotaDiaria)}
                  disabled={!p.cuotaDiaria || p.cuotaDiaria <= 0}
                  className="w-full text-left px-4 py-3.5 rounded-[14px] border transition-all active:scale-[0.99] disabled:opacity-50"
                  style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Prestamo {i + 1}</p>
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
          let ultimoMetodo = null
          try { ultimoMetodo = sessionStorage.getItem('cf-ultimo-metodo-pago') } catch {}
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
                    className="w-full text-center text-2xl font-extrabold font-mono-display py-3 pl-8 pr-3 rounded-[14px] border outline-none"
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
            {modalPago.abonoConPendiente && (
              <div className="rounded-[12px] px-3 py-2.5 text-center" style={{ background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--color-warning)' }}>Tiene cuotas atrasadas</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Ya pagó hoy pero aún debe mas. Cada registro cubre 1 cuota.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  const monto = modoParcial ? parseFloat(montoParcial) : null
                  if (modoParcial && (!monto || monto <= 0 || monto > modalPago.cuota)) return
                  ejecutarPago('efectivo', { montoCustom: monto })
                }}
                className="flex flex-col items-center gap-2.5 py-5 rounded-[16px] border transition-all active:scale-95 hover:border-[color-mix(in_srgb,var(--color-success)_40%,var(--color-border))] relative"
                style={{
                  background: ultimoMetodo === 'efectivo'
                    ? 'color-mix(in srgb, var(--color-success) 10%, var(--color-bg-card))'
                    : 'color-mix(in srgb, var(--color-success) 5%, var(--color-bg-card))',
                  borderColor: ultimoMetodo === 'efectivo'
                    ? 'color-mix(in srgb, var(--color-success) 35%, var(--color-border))'
                    : 'var(--color-border)',
                }}
              >
                {ultimoMetodo === 'efectivo' && (
                  <span className="absolute top-2 right-2 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md" style={{ background: 'color-mix(in srgb, var(--color-success) 15%, transparent)', color: 'var(--color-success)' }}>Ultimo</span>
                )}
                <div
                  className="w-11 h-11 rounded-[12px] flex items-center justify-center"
                  style={{ background: 'color-mix(in srgb, var(--color-success) 15%, transparent)', color: 'var(--color-success)' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Efectivo</span>
              </button>
              <button
                onClick={() => {
                  const monto = modoParcial ? parseFloat(montoParcial) : null
                  if (modoParcial && (!monto || monto <= 0 || monto > modalPago.cuota)) return
                  ejecutarPago('transferencia', { montoCustom: monto })
                }}
                className="flex flex-col items-center gap-2.5 py-5 rounded-[16px] border transition-all active:scale-95 hover:border-[color-mix(in_srgb,var(--color-info)_40%,var(--color-border))] relative"
                style={{
                  background: ultimoMetodo === 'transferencia'
                    ? 'color-mix(in srgb, var(--color-info) 10%, var(--color-bg-card))'
                    : 'color-mix(in srgb, var(--color-info) 5%, var(--color-bg-card))',
                  borderColor: ultimoMetodo === 'transferencia'
                    ? 'color-mix(in srgb, var(--color-info) 35%, var(--color-border))'
                    : 'var(--color-border)',
                }}
              >
                {ultimoMetodo === 'transferencia' && (
                  <span className="absolute top-2 right-2 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md" style={{ background: 'color-mix(in srgb, var(--color-info) 15%, transparent)', color: 'var(--color-info)' }}>Ultimo</span>
                )}
                <div
                  className="w-11 h-11 rounded-[12px] flex items-center justify-center"
                  style={{ background: 'color-mix(in srgb, var(--color-info) 15%, transparent)', color: 'var(--color-info)' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                  </svg>
                </div>
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Transferencia</span>
              </button>
            </div>
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
                onClick={() => { const d = confirmDuplicado; setConfirmDuplicado(null); setModalPago({ id: d.clienteId, nombre: d.nombre, cuota: d.cuota, prestamoActivo: d.prestamoActivo, prestamosActivos: [], abonoConPendiente: false }); ejecutarPago(d.metodoPago, { confirmarDuplicado: true }) }}
                className="flex-1 py-2.5 rounded-[12px] text-sm font-semibold transition-all"
                style={{ background: 'var(--color-warning)', color: '#000' }}
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
      {undoPago && (
        <div className="fixed bottom-24 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-6 sm:w-auto z-50 animate-slide-up">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-[14px] border sm:min-w-[320px]"
            style={{ background: 'rgba(15,15,22,0.98)', border: '1px solid rgba(34,197,94,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--color-success) 20%, transparent)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-success)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm flex-1 truncate" style={{ color: 'var(--color-text-primary)' }}>Pago registrado — {undoPago.clienteNombre}</span>
            <button onClick={deshacerPago} className="text-sm font-bold shrink-0 transition-colors" style={{ color: 'var(--color-accent)' }}>
              Deshacer
            </button>
            <button onClick={() => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); setUndoPago(null) }} className="shrink-0 transition-colors" style={{ color: '#666' }}>
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
                  Al dia: {formatMoney(cliente.montoParaPonerseAlDia)}
                </span>
              )}
            </>
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
          className="shrink-0 px-4 h-11 rounded-[12px] font-bold text-sm transition-all active:scale-95 disabled:opacity-60"
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
