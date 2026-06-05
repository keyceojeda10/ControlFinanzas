'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney } from '@/lib/i18n'
import { Modal } from '@/components/ui/Modal'

export default function CobrosHoyPage() {
  const { esCobrador, loading: authLoading } = useAuth()
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  // Pago rápido
  const [modalPago, setModalPago]         = useState(null)  // { id, nombre, cuota, prestamoActivo, prestamosActivos, abonoConPendiente }
  const [pagando, setPagando]             = useState(null)  // clienteId
  const [pagoOk, setPagoOk]               = useState(null)  // clienteId (flash verde)
  const [undoPago, setUndoPago]           = useState(null)  // { pagoId, clienteNombre }
  const [confirmDuplicado, setConfirmDuplicado] = useState(null) // { clienteId, nombre, cuota, prestamoActivo }
  const undoTimerRef = useRef(null)

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

  // Abrir modal de cobro
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
    setModalPago({ id: cliente.id, nombre: cliente.nombre, cuota, prestamoActivo: p.id, prestamosActivos: activos, abonoConPendiente: cliente.pagoHoy && cliente.cobroPendienteHoy })
  }

  const elegirPrestamo = (prestamoId, cuota) => {
    if (!modalPago) return
    setModalPago(prev => prev ? { ...prev, prestamoActivo: prestamoId, cuota } : prev)
  }

  const ejecutarPago = async (metodoPago, { confirmarDuplicado = false } = {}) => {
    if (!modalPago || pagando) return
    const { id: clienteId, nombre, cuota, prestamoActivo } = modalPago
    setModalPago(null)
    setPagando(clienteId)

    // Optimista: marcar como pagado
    setData(prev => prev ? {
      ...prev,
      clientes: prev.clientes.map(c =>
        c.id === clienteId ? { ...c, pagoHoy: true, cobroPendienteHoy: false } : c
      ),
      resumen: {
        ...prev.resumen,
        pendientes: Math.max(0, prev.resumen.pendientes - 1),
        pagados: prev.resumen.pagados + 1,
        recaudadoHoy: prev.resumen.recaudadoHoy + cuota,
      }
    } : prev)

    try {
      const url = `/api/prestamos/${prestamoActivo}/pagos${confirmarDuplicado ? '?confirmarDuplicado=1' : ''}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ montoPagado: cuota, tipo: 'completo', diasAbonados: 1, metodoPago }),
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
      {[...Array(5)].map((_, i) => (
        <div key={i} className="rounded-[16px] h-20 animate-pulse" style={{ background: 'var(--color-bg-card)' }} />
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

  return (
    <div className="max-w-2xl mx-auto space-y-4 px-1">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Mis cobros de hoy</h1>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {resumen.pendientes > 0
              ? `${resumen.pendientes} cliente${resumen.pendientes === 1 ? '' : 's'} por cobrar`
              : clientes.length === 0 ? 'Sin cobros programados hoy' : 'Todo cobrado por hoy'}
          </p>
        </div>
        <button
          onClick={fetchCobros}
          className="w-9 h-9 rounded-[10px] flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="text-sm rounded-[12px] px-4 py-3" style={{ background: 'var(--color-danger-dim)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      {/* Resumen del día */}
      {clientes.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-[14px] px-3 py-3 text-center" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <p className="text-xl font-bold font-mono-display" style={{ color: resumen.pendientes > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>{resumen.pendientes ?? 0}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Pendientes</p>
          </div>
          <div className="rounded-[14px] px-3 py-3 text-center" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <p className="text-xl font-bold font-mono-display" style={{ color: 'var(--color-success)' }}>{resumen.pagados ?? 0}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Cobrados</p>
          </div>
          <div className="rounded-[14px] px-3 py-3 text-center" style={{ background: 'color-mix(in srgb, var(--color-success) 8%, var(--color-bg-card))', border: '1px solid color-mix(in srgb, var(--color-success) 20%, var(--color-border))' }}>
            <p className="text-base font-bold font-mono-display truncate" style={{ color: 'var(--color-success)' }}>{formatMoney(resumen.recaudadoHoy ?? 0)}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Recaudado</p>
          </div>
        </div>
      )}

      {/* Lista: pendientes primero */}
      {pendientes.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider px-1" style={{ color: 'var(--color-text-muted)' }}>
            Por cobrar ({pendientes.length})
          </p>
          {pendientes.map(c => (
            <ClienteCard
              key={c.id}
              cliente={c}
              pagando={pagando === c.id}
              pagoOk={pagoOk === c.id}
              onCobrar={() => abrirPago(c)}
            />
          ))}
        </div>
      )}

      {/* Lista: ya pagaron */}
      {pagados.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider px-1" style={{ color: 'var(--color-text-muted)' }}>
            Cobrados hoy ({pagados.length})
          </p>
          {pagados.map(c => (
            <ClienteCard
              key={c.id}
              cliente={c}
              pagando={false}
              pagoOk={pagoOk === c.id}
              onCobrar={() => abrirPago(c)}
            />
          ))}
        </div>
      )}

      {clientes.length === 0 && !loading && (
        <div className="rounded-[16px] px-6 py-12 text-center" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <svg className="w-10 h-10 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-text-muted)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Sin cobros programados hoy</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-muted)' }}>No hay clientes con cuota pendiente para hoy.</p>
          <Link href="/rutas" className="inline-block mt-4 text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>Ver rutas →</Link>
        </div>
      )}

      {/* Modal: elegir método de pago */}
      <Modal open={!!modalPago} onClose={() => setModalPago(null)} title="Cobro rápido">
        {modalPago && !modalPago.prestamoActivo && (modalPago.prestamosActivos?.length ?? 0) > 1 && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{modalPago.nombre}</span> tiene varios préstamos. Elige cuál cobrar.
            </p>
            <div className="space-y-2">
              {modalPago.prestamosActivos.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => elegirPrestamo(p.id, p.cuotaDiaria)}
                  disabled={!p.cuotaDiaria || p.cuotaDiaria <= 0}
                  className="w-full text-left px-3 py-3 rounded-[12px] border transition-all active:scale-[0.99] disabled:opacity-50"
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

        {modalPago && modalPago.prestamoActivo && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Registrar 1 cuota para</p>
              <p className="text-base font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{modalPago.nombre}</p>
              <p className="text-2xl font-bold font-mono-display mt-1" style={{ color: 'var(--color-success)' }}>{formatMoney(modalPago.cuota)}</p>
            </div>
            {modalPago.abonoConPendiente && (
              <div className="rounded-[12px] px-3 py-2.5 text-center" style={{ background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--color-warning)' }}>Tiene cuotas atrasadas</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Ya pagó hoy pero aún debe más. Cada registro cubre 1 cuota.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => ejecutarPago('efectivo')}
                className="flex flex-col items-center gap-2 py-4 rounded-[14px] border transition-all active:scale-95"
                style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} style={{ color: 'var(--color-success)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Efectivo</span>
              </button>
              <button
                onClick={() => ejecutarPago('transferencia')}
                className="flex flex-col items-center gap-2 py-4 rounded-[14px] border transition-all active:scale-95"
                style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} style={{ color: 'var(--color-info)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Transferencia</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: confirmar pago duplicado */}
      <Modal
        open={!!confirmDuplicado}
        onClose={() => { setConfirmDuplicado(null); fetchCobros() }}
        title="Pago duplicado"
      >
        {confirmDuplicado && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{confirmDuplicado.nombre}</span> ya recibió un pago por{' '}
              <span className="font-bold font-mono-display" style={{ color: 'var(--color-warning)' }}>{formatMoney(confirmDuplicado.cuota)}</span> hace menos de 1 minuto.
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>¿Registrar este pago de todos modos?</p>
            <div className="flex gap-3">
              <button
                onClick={() => { const d = confirmDuplicado; setConfirmDuplicado(null); setModalPago({ id: d.clienteId, nombre: d.nombre, cuota: d.cuota, prestamoActivo: d.prestamoActivo, prestamosActivos: [], abonoConPendiente: false }); ejecutarPago(d.metodoPago, { confirmarDuplicado: true }) }}
                className="flex-1 py-2.5 rounded-[12px] text-sm font-semibold transition-all"
                style={{ background: 'var(--color-warning)', color: '#000' }}
              >
                Sí, registrar igual
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

      {/* Toast: deshacer pago */}
      {undoPago && (
        <div className="fixed bottom-24 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-6 sm:w-auto z-50 animate-slide-up">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-[14px] border sm:min-w-[320px]"
            style={{ background: 'rgba(15,15,22,0.98)', border: '1px solid rgba(34,197,94,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-success)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
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

function ClienteCard({ cliente, pagando, pagoOk, onCobrar }) {
  const pagado = !cliente.cobroPendienteHoy && cliente.pagoHoy
  const enMora = cliente.diasMora > 0

  return (
    <div
      className="rounded-[16px] px-4 py-3 flex items-center gap-3 transition-all"
      style={{
        background: pagoOk
          ? 'color-mix(in srgb, var(--color-success) 10%, var(--color-bg-card))'
          : 'var(--color-bg-card)',
        border: `1px solid ${enMora && !pagado ? 'color-mix(in srgb, var(--color-danger) 25%, var(--color-border))' : pagado ? 'color-mix(in srgb, var(--color-success) 20%, var(--color-border))' : 'var(--color-border)'}`,
      }}
    >
      {/* Avatar inicial */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
        style={{
          background: pagado
            ? 'color-mix(in srgb, var(--color-success) 20%, transparent)'
            : enMora
              ? 'color-mix(in srgb, var(--color-danger) 15%, transparent)'
              : 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
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
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{cliente.nombre}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {enMora && !pagado && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)', color: 'var(--color-danger)' }}>
              {cliente.diasMora}d atraso
            </span>
          )}
          {cliente.rutaNombre && (
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{cliente.rutaNombre}</span>
          )}
          {pagado && (
            <span className="text-[10px]" style={{ color: 'var(--color-success)' }}>Pagó hoy</span>
          )}
        </div>
      </div>

      {/* Botón cobrar o monto pagado */}
      {pagado ? (
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold font-mono-display" style={{ color: 'var(--color-success)' }}>{formatMoney(cliente.cuota)}</p>
          <Link href={`/clientes/${cliente.id}`} className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Ver detalle</Link>
        </div>
      ) : (
        <button
          onClick={onCobrar}
          disabled={pagando}
          className="shrink-0 px-4 h-10 rounded-[12px] font-bold text-sm transition-all active:scale-95 disabled:opacity-60"
          style={{
            background: pagando ? 'var(--color-bg-hover)' : enMora ? 'var(--color-danger)' : 'var(--color-success)',
            color: '#fff',
            minWidth: '90px',
          }}
        >
          {pagando
            ? <svg className="w-4 h-4 animate-spin mx-auto" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            : `Cobrar · ${formatMoney(cliente.cuota)}`
          }
        </button>
      )}
    </div>
  )
}
