'use client'
// components/prestamos/RegistrarPago.jsx - Modal de registro de pago

import { useState, useEffect, useRef } from 'react'
import { useCountry } from '@/hooks/useCountry'
import { useAuth }    from '@/hooks/useAuth'
import { useRouter }   from 'next/navigation'
import { Modal }       from '@/components/ui/Modal'
import { Button }      from '@/components/ui/Button'
import { Input }       from '@/components/ui/Input'
import BotonWhatsApp        from '@/components/ui/BotonWhatsApp'
import BotonCompartir       from '@/components/ui/BotonCompartir'
import BotonImprimirRecibo  from '@/components/ui/BotonImprimirRecibo'
import { ChecklistCamposRecibo, getDefaultCampos } from '@/components/recibos/CamposReciboEditor'
import MoneyInput           from '@/components/ui/MoneyInput'
import MonedaCF             from '@/components/ui/MonedaCF'
import MetodoPagoSelector   from '@/components/pagos/MetodoPagoSelector'
import { guardarPagoPendiente, actualizarPrestamoOffline }  from '@/lib/offline'
import { obtenerCoordsRapido }                              from '@/lib/geo'

export default function RegistrarPago({
  prestamoId, cuotaDiaria, saldoPendiente,
  open, onClose, onSuccess,
  cliente, prestamo, rutaNav,
  presetPago,
  // tabInicial: 'pago' (default) | 'capital' | 'recargo' | 'descuento'
  // Cuando se abre desde botones "Recargo" / "Descuento" / "Abono a capital".
  tabInicial = 'pago',
}) {
  const router = useRouter()
  const { formatMoney } = useCountry()
  const { puedeAplicarDescuentos, orgNombre, ocultarSaldoWA, camposRecibo: camposReciboOrg } = useAuth()
  const camposRecibo = (Array.isArray(cliente?.camposRecibo) && cliente.camposRecibo.length > 0)
    ? cliente.camposRecibo
    : (Array.isArray(camposReciboOrg) && camposReciboOrg.length > 0 ? camposReciboOrg : getDefaultCampos())

  // Pre-llena con la cuota, pero nunca más que el saldo pendiente (último pago de saldos pequeños)
  const montoInicial = Math.min(Math.round(cuotaDiaria ?? 0), Math.round(saldoPendiente ?? 0))
  const [monto,        setMonto]        = useState(String(montoInicial))
  const [tipo,         setTipo]         = useState('completo')
  const [metodoPago,   setMetodoPago]   = useState('efectivo')
  const [plataforma,   setPlataforma]   = useState('')
  const [metodoPagoId, setMetodoPagoId] = useState(null)
  const [metodosPago,  setMetodosPago]  = useState([])
  const [nota,         setNota]         = useState('')
  const [diasAbonados, setDiasAbonados] = useState(null)
  // Valor visual del slider — se anima entre cambios para que las transiciones
  // (boton mora, ponerse al dia) se sientan fluidas en vez de saltar de golpe.
  const [sliderVisual, setSliderVisual] = useState(1)
  const sliderAnimRef = useRef(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [exitoso,      setExitoso]      = useState(false)
  const [pagoGuardado, setPagoGuardado] = useState(null)
  const [prestamoAct,  setPrestamoAct]  = useState(null)
  const [fotoEvidencia, setFotoEvidencia] = useState(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [vistaComprobante, setVistaComprobante] = useState(false)
  const [camposLocal, setCamposLocal] = useState(camposRecibo)
  const [editandoCampos, setEditandoCampos] = useState(false)
  const fotoInputRef = useRef(null)
  const prevOpenRef = useRef(false)

  useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = open
    if (!open) return
    // Solo resetear campos al ABRIR el modal (transicion false→true).
    // Si ya estaba abierto y cambia saldoPendiente/cuotaDiaria por un
    // rerender del padre, NO pisar el monto que el usuario escribio.
    if (wasOpen) return

    if (tabInicial === 'recargo' || tabInicial === 'descuento') {
      setMonto('')
      setTipo(tabInicial)
      setNota('')
      setDiasAbonados(null)
      setSliderVisual(1)
      setError('')
      return
    }
    if (tabInicial === 'capital') {
      setMonto('')
      setTipo('capital')
      setNota('')
      setDiasAbonados(null)
      setSliderVisual(1)
      setError('')
      return
    }
    if (tabInicial === 'intereses') {
      const interesesPend = prestamo?.cuotasAmortizacion
        ?.filter(f => new Date(f.fechaEsperada) <= new Date() && (f.pagado || 0) < f.cuotaTotal)
        ?.reduce((acc, f) => acc + Math.max(0, f.interes - (f.interesPagado || 0)), 0) ?? 0
      setMonto(String(Math.round(interesesPend)))
      setTipo('intereses')
      setNota('')
      setDiasAbonados(null)
      setSliderVisual(1)
      setError('')
      return
    }

    const montoBase = Math.min(Math.round(cuotaDiaria ?? 0), Math.round(saldoPendiente ?? 0))
    const montoPreset = Number(presetPago?.monto)
    const montoFinal = montoPreset > 0
      ? Math.min(Math.round(montoPreset), Math.round(saldoPendiente ?? 0))
      : montoBase

    setMonto(String(montoFinal))
    setTipo(presetPago?.tipo ?? (montoFinal >= montoBase ? 'completo' : 'parcial'))
    const cuota = Math.max(1, Math.round(cuotaDiaria ?? 1))
    const diasCalc = montoPreset > 0 ? Math.min(30, Math.max(1, Math.round(montoFinal / cuota))) : null
    setDiasAbonados(diasCalc)
    setSliderVisual(diasCalc ?? 1)
    setError('')
    setVistaComprobante(false)
    setEditandoCampos(false)
    setCamposLocal(camposRecibo)
  }, [open, presetPago, cuotaDiaria, saldoPendiente, tabInicial])

  // Animacion del slider visual: cuando diasAbonados cambia (por boton de mora,
  // ponerse al dia o snap), interpola gradualmente desde el valor visual actual
  // hasta el nuevo. Si el cambio viene del propio drag del slider, va instantaneo.
  useEffect(() => {
    const target = diasAbonados ?? 1
    const from = sliderVisual
    if (from === target) return
    // Si la diferencia es 1, no animar (es el drag manual)
    if (Math.abs(target - from) <= 1) {
      setSliderVisual(target)
      return
    }
    // Animar con requestAnimationFrame
    if (sliderAnimRef.current) cancelAnimationFrame(sliderAnimRef.current)
    const start = performance.now()
    const duration = 350
    const tick = (now) => {
      const elapsed = now - start
      const progress = Math.min(1, elapsed / duration)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = from + (target - from) * eased
      setSliderVisual(progress >= 1 ? target : current)
      if (progress < 1) sliderAnimRef.current = requestAnimationFrame(tick)
    }
    sliderAnimRef.current = requestAnimationFrame(tick)
    return () => {
      if (sliderAnimRef.current) cancelAnimationFrame(sliderAnimRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diasAbonados])

  useEffect(() => {
    fetch('/api/metodos-pago').then(r => r.ok ? r.json() : []).then(setMetodosPago).catch(() => {})
  }, [])

  const handleSubmit = async ({ confirmarDuplicado = false } = {}) => {
    let m = Number(monto)
    if (!m || m <= 0) { setError('Ingresa un monto válido'); return }
    // Nota obligatoria para recargo y descuento (auditoria).
    if ((tipo === 'recargo' || tipo === 'descuento') && !nota.trim()) {
      setError('El motivo es obligatorio para recargo y descuento')
      return
    }
    // Descuento: validacion preventiva — no exceder espacio disponible.
    if (tipo === 'descuento') {
      const totalPag = Number(prestamo?.totalPagado || 0)
      const totalAP = Number(prestamo?.totalAPagar || 0)
      const espacioDescuento = Math.max(0, totalAP - totalPag)
      if (m > espacioDescuento) {
        setError(`Máximo permitido: ${formatMoney(espacioDescuento)} (no puede exceder lo no pagado).`)
        return
      }
    }
    // Limitar al saldo en lugar de bloquear (permite cobrar saldos pequeños)
    // Excepcion: recargo NO se limita (suma al saldo) y descuento ya valido arriba.
    if (tipo !== 'recargo' && tipo !== 'descuento' && m > saldoPendiente) {
      m = Math.round(saldoPendiente)
    }

    setLoading(true)
    setError('')

    // Geolocalizacion del cobro (MVP). No bloquea si falla: timeout corto,
    // si el usuario nego permiso o el GPS no responde -> coords = null.
    // Solo se pide para pagos reales, no para ajustes (recargo/descuento) que
    // los hace el owner desde el detalle del prestamo, no en campo.
    const necesitaGeo = !['recargo', 'descuento'].includes(tipo)
    const coords = necesitaGeo ? await obtenerCoordsRapido() : null

    // Fix #6: helper para encolar offline — usado tanto en catch de red como en 503 del SW
    const encolarOffline = async () => {
      try {
        await guardarPagoPendiente({
          prestamoId,
          montoPagado: m,
          tipo,
          nota,
          diasAbonados,
          metodoPago,
          plataforma,
          clienteNombre: cliente?.nombre,
          // Las coords viajan con el pago cuando sincronice.
          ...(coords ?? {}),
        })
        await actualizarPrestamoOffline(prestamoId, { montoPagado: m, tipo, nota })
        window.dispatchEvent(new Event('paymentQueued'))
        const saldoNuevo = Math.max(0, (prestamo?.saldoPendiente || 0) - m)
        const totalPagadoNuevo = (prestamo?.totalPagado || 0) + m
        const porcentajeNuevo = prestamo?.totalAPagar > 0
          ? Math.round((totalPagadoNuevo / prestamo.totalAPagar) * 100)
          : 0
        const prestamoActualizado = prestamo ? {
          ...prestamo,
          saldoPendiente: saldoNuevo,
          totalPagado: totalPagadoNuevo,
          porcentajePagado: porcentajeNuevo,
          pagoHoy: true,
          estado: saldoNuevo <= 0 ? 'completado' : prestamo.estado,
        } : prestamo
        const pagoOffline = { montoPagado: m, fechaPago: new Date().toISOString(), offline: true }
        setPagoGuardado(pagoOffline)
        setPrestamoAct(prestamoActualizado)
        setExitoso(true)
        setError('')
        onSuccess?.(prestamoActualizado, pagoOffline)
        return true
      } catch {
        setError('No se pudo guardar el pago offline.')
        return false
      }
    }

    try {
      const qs = confirmarDuplicado ? '?confirmarDuplicado=1' : ''
      const res  = await fetch(`/api/prestamos/${prestamoId}/pagos${qs}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ montoPagado: m, tipo, nota, diasAbonados, metodoPago, ...(metodoPagoId ? { metodoPagoId } : {}), plataforma, ...(coords ?? {}) }),
      })
      // Fix #6: el Service Worker puede responder 503 cuando no hay red en vez
      // de dejar fallar el fetch. Tratarlo igual que offline.
      if (res.status === 503 && !navigator.onLine) {
        await encolarOffline()
        return
      }
      const data = await res.json()
      if (res.status === 409 && data?.duplicado) {
        setLoading(false)
        const hace = Math.round((Date.now() - new Date(data.pagoReciente.fechaPago).getTime()) / 1000)
        const ok = window.confirm(
          `Ya se registró un pago idéntico hace ${hace}s.\n\n¿Confirmas que este es un pago adicional y no un duplicado?`
        )
        if (ok) {
          return handleSubmit({ confirmarDuplicado: true })
        }
        return
      }
      if (!res.ok) { setError(data.error ?? 'Error al registrar el pago'); return }

      const pagoId = data.pagos?.[0]?.id ?? null
      const pagoParaWA = { id: pagoId, montoPagado: m, fechaPago: new Date().toISOString(), metodoPago, plataforma }
      setPagoGuardado(pagoParaWA)
      setPrestamoAct(data)
      setExitoso(true)
      onSuccess?.(data, pagoParaWA)
    } catch {
      if (!navigator.onLine) {
        await encolarOffline()
        return
      }
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const guardarCamposCliente = async (campos) => {
    if (!cliente?.id) return
    setCamposLocal(campos)
    try {
      await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camposRecibo: campos }),
      })
    } catch {}
  }

  const subirFotoEvidencia = async (file) => {
    if (!pagoGuardado?.id || subiendoFoto) return
    setSubiendoFoto(true)
    try {
      const fd = new FormData()
      fd.append('foto', file)
      const res = await fetch(`/api/pagos/${pagoGuardado.id}/foto`, { method: 'POST', body: fd })
      if (res.ok) {
        const { fotoUrl } = await res.json()
        setFotoEvidencia(fotoUrl)
      }
    } catch {} finally {
      setSubiendoFoto(false)
    }
  }

  const handleCerrar = () => {
    setExitoso(false)
    setPagoGuardado(null)
    setPrestamoAct(null)
    setFotoEvidencia(null)
    setMonto(String(Math.min(Math.round(cuotaDiaria ?? 0), Math.round(saldoPendiente ?? 0))))
    setTipo('completo')
    setMetodoPago('efectivo')
    setPlataforma('')
    setNota('')
    setDiasAbonados(null)
    setError('')
    onClose?.()
  }

  const handleAbonoDias = (dias) => {
    const montoAbono = Math.min(Math.round(cuotaDiaria * dias), Math.round(saldoPendiente ?? 0))
    setMonto(String(montoAbono))
    setDiasAbonados(dias)
    setError('')
  }

  // ── Lógica siguiente cliente en ruta ────────────────────────
  const getNextInRuta = () => {
    if (!rutaNav || !cliente) return null
    const idx = rutaNav.clientes.findIndex(c => c.id === cliente.id)
    if (idx < 0) return null
    const isLast = idx >= rutaNav.clientes.length - 1
    return { idx, isLast, next: isLast ? null : rutaNav.clientes[idx + 1] }
  }

  const navigateNextInRuta = () => {
    const info = getNextInRuta()
    if (!info) return
    const getDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const getRutaCobroUrl = (clienteRuta) => {
      const prestamosIds = Array.isArray(clienteRuta?.prestamosActivosIds)
        ? clienteRuta.prestamosActivosIds.filter(Boolean)
        : (clienteRuta?.prestamoActivo ? [clienteRuta.prestamoActivo] : [])

      if (prestamosIds.length === 1) {
        return `/prestamos/${prestamosIds[0]}?openPago=1&fromRuta=1`
      }
      return `/clientes/${clienteRuta.id}`
    }

    if (info.isLast) {
      sessionStorage.removeItem('cf-ruta-nav')
      const url = `/rutas/${rutaNav.rutaId}`
      navigator.onLine ? router.push(url) : (window.location.href = url)
    } else {
      const newNav = { ...rutaNav, currentIndex: info.idx + 1 }
      sessionStorage.setItem('cf-ruta-nav', JSON.stringify(newNav))
      localStorage.setItem(`cf-ruta-progress-${rutaNav.rutaId}`, JSON.stringify({
        clienteId: info.next.id, clienteNombre: info.next.nombre, index: info.idx + 1, date: getDate(),
      }))
      const url = getRutaCobroUrl(info.next)
      navigator.onLine ? router.push(url) : (window.location.href = url)
    }
  }

  // ── Vista comprobante (segundo paso desde éxito) ──────────────
  if (exitoso && pagoGuardado && vistaComprobante) {
    const prestamoWA = prestamoAct ?? prestamo

    return (
      <Modal
        open={open}
        onClose={() => setVistaComprobante(false)}
        title="Generar comprobante"
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--color-text-muted)]">
            Selecciona los campos que aparecen en el comprobante impreso de este cliente.
          </p>

          <ChecklistCamposRecibo
            campos={camposLocal}
            onChange={(newCampos) => guardarCamposCliente(newCampos)}
          />

          <div className="pt-2 border-t border-[var(--color-border)]">
            <BotonImprimirRecibo cliente={cliente} prestamo={prestamoWA} pago={pagoGuardado} orgNombre={orgNombre} camposRecibo={camposLocal} />
          </div>
        </div>
      </Modal>
    )
  }

  // ── Vista éxito ───────────────────────────────────────────────
  if (exitoso && pagoGuardado) {
    const prestamoWA = prestamoAct ?? prestamo
    const rutaInfo = getNextInRuta()

    return (
      <Modal
        open={open}
        onClose={handleCerrar}
        title={
          tipo === 'recargo' ? 'Recargo aplicado' :
          tipo === 'descuento' ? 'Descuento aplicado' :
          tipo === 'capital' ? 'Abono a capital registrado' :
          tipo === 'intereses' ? 'Pago de intereses registrado' :
          'Pago registrado'
        }
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="secondary" onClick={handleCerrar} className={rutaInfo ? 'flex-shrink-0' : 'w-full'}>
              Cerrar
            </Button>
            {rutaInfo && (
              <button
                onClick={navigateNextInRuta}
                className="flex-1 py-2.5 rounded-[12px] text-sm font-semibold active:scale-[0.98] transition-all"
                style={rutaInfo.isLast
                  ? { background: 'var(--color-success)', color: 'var(--color-text-primary)' }
                  : { background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 85%, black))', color: '#3a2900' }
                }
              >
                {rutaInfo.isLast
                  ? 'Ruta finalizada'
                  : `Siguiente → ${rutaInfo.next.nombre}`
                }
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2 py-3">
            {pagoGuardado.offline ? (
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-[rgba(245,197,24,0.15)]">
                <svg className="w-7 h-7 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            ) : (
              <div className="relative wizard-success-bounce">
                <MonedaCF pose="celebra" size={104} />
                <div
                  className="absolute -bottom-1 right-0 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--color-success)', border: '2px solid var(--color-bg-card)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="#ffffff" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            )}
            <p className="text-[var(--color-text-primary)] font-bold text-lg font-mono-display">{formatMoney(pagoGuardado.montoPagado)}</p>
            <p className="text-[var(--color-text-muted)] text-sm">
              {pagoGuardado.offline ? 'guardado offline — se sincronizará al conectar'
                : tipo === 'recargo' ? 'recargo aplicado correctamente'
                : tipo === 'descuento' ? 'descuento aplicado correctamente'
                : 'pagado correctamente'}
            </p>
            {!pagoGuardado.offline && !['recargo', 'descuento'].includes(tipo) && pagoGuardado.metodoPago && (
              <p className="text-[11px] mt-0.5" style={{ color: pagoGuardado.metodoPago === 'transferencia' ? 'var(--color-info)' : 'var(--color-success)' }}>
                {pagoGuardado.metodoPago === 'transferencia'
                  ? (pagoGuardado.plataforma ? `Transferencia · ${pagoGuardado.plataforma}` : 'Transferencia')
                  : 'Efectivo'}
              </p>
            )}
          </div>

          {prestamoWA && (
            <div
              className="rounded-[20px] px-4 py-3 space-y-1.5 text-sm"
              style={{
                background: `linear-gradient(135deg, color-mix(in srgb, var(--color-success) 4%, transparent) 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, color-mix(in srgb, var(--color-success) 2%, transparent) 100%)`,
                boxShadow: `0 0 30px color-mix(in srgb, var(--color-success) 3%, transparent), 0 1px 2px rgba(0,0,0,0.3)`,
              }}
            >
              {(() => {
                const cuotasPagadas = prestamoWA.pagos
                  ? prestamoWA.pagos.filter(p => !['recargo', 'descuento'].includes(p.tipo)).length
                  : null
                const totalCuotas = prestamoWA.cuotasAmortizacion?.length || null
                return cuotasPagadas != null && totalCuotas ? (
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Cuota</span>
                    <span className="text-[var(--color-text-primary)] font-medium font-mono-display">{cuotasPagadas} de {totalCuotas}</span>
                  </div>
                ) : null
              })()}
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Saldo pendiente</span>
                <span className="text-[var(--color-text-primary)] font-medium font-mono-display">{formatMoney(prestamoWA.saldoPendiente)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Progreso</span>
                <span className="text-[var(--color-success)] font-medium font-mono-display">{prestamoWA.porcentajePagado}%</span>
              </div>
            </div>
          )}

          {pagoGuardado?.id && !pagoGuardado.offline && (
            <div className="space-y-2">
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) subirFotoEvidencia(f)
                  e.target.value = ''
                }}
              />
              {fotoEvidencia ? (
                <div className="relative rounded-[12px] overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
                  <img src={fotoEvidencia} alt="Evidencia" className="w-full h-32 object-cover" />
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium" style={{ background: 'rgba(0,0,0,0.7)', color: 'var(--color-success)' }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Foto guardada
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fotoInputRef.current?.click()}
                  disabled={subiendoFoto}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[12px] border text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-60"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--color-border) 80%, transparent)',
                    background: 'color-mix(in srgb, var(--color-bg-elevated) 60%, transparent)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {subiendoFoto ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" />
                        <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" stroke="none" />
                      </svg>
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Adjuntar foto de evidencia
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {cliente?.telefono && prestamoWA && (
            <BotonWhatsApp tipo="pago" cliente={cliente} prestamo={prestamoWA} pago={pagoGuardado} orgNombre={orgNombre} ocultarSaldo={ocultarSaldoWA} camposRecibo={camposLocal} />
          )}

          {prestamoWA && (
            <div className="flex gap-2">
              <BotonCompartir cliente={cliente} prestamo={prestamoWA} pago={pagoGuardado} orgNombre={orgNombre} ocultarSaldo={ocultarSaldoWA} camposRecibo={camposLocal} />
              <button
                type="button"
                onClick={() => setVistaComprobante(true)}
                className="flex-1 flex items-center justify-center gap-2 px-3 h-10 rounded-[12px] text-sm font-medium transition-all cursor-pointer bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)]"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Imprimir
              </button>
            </div>
          )}
        </div>
      </Modal>
    )
  }

  // ── Vista formulario ──────────────────────────────────────────
  const tituloModal =
    tipo === 'recargo' ? 'Agregar recargo' :
    tipo === 'descuento' ? 'Aplicar descuento' :
    tipo === 'capital' ? 'Abono a capital' :
    tipo === 'intereses' ? 'Pago a intereses' :
    'Registrar pago'
  const labelBoton =
    tipo === 'recargo' ? 'Aplicar recargo' :
    tipo === 'descuento' ? 'Aplicar descuento' :
    tipo === 'capital' ? 'Confirmar abono' :
    tipo === 'intereses' ? 'Confirmar pago' :
    'Confirmar pago'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tituloModal}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={loading}>{labelBoton}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[10px] px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex justify-between items-center text-sm">
          <span className="text-[var(--color-text-muted)]">Cuota</span>
          <span className="font-semibold text-[var(--color-text-primary)] font-mono-display">{formatMoney(cuotaDiaria)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-[var(--color-text-muted)]">Saldo pendiente</span>
          <span className="font-semibold text-[var(--color-text-primary)] font-mono-display">{formatMoney(saldoPendiente)}</span>
        </div>

        {/* Desglose de cuotas pendientes para modos con tabla de amortización */}
        {['lineal', 'lineal_dinamico', 'solo_interes'].includes(prestamo?.modoInteres) && prestamo?.cuotasAmortizacion?.length > 0 && (() => {
          const filas = [...prestamo.cuotasAmortizacion]
            .sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
            .filter(f => (f.pagado || 0) < f.cuotaTotal)
            .slice(0, 3)
          if (!filas.length) return null
          const totalFilas = prestamo.cuotasAmortizacion.length
          const LABEL_FREQ = { diario: 'Dia', semanal: 'Sem', quincenal: 'Qna', mensual: 'Mes' }
          const labelP = LABEL_FREQ[prestamo.frecuencia] || 'Per'
          return (
            <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-2.5 space-y-1.5">
              <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                Próximas cuotas pendientes
              </p>
              {filas.map(f => {
                const faltante = Math.round(Math.max(0, f.cuotaTotal - (f.pagado || 0)))
                const esBalloon = prestamo.modoInteres === 'solo_interes' && f.numeroPeriodo === totalFilas
                const vencida = f.fechaEsperada && new Date(f.fechaEsperada) < new Date()
                return (
                  <button
                    key={f.numeroPeriodo}
                    type="button"
                    onClick={() => {
                      setMonto(String(faltante))
                      setTipo(faltante >= (cuotaDiaria ?? 0) ? 'completo' : 'parcial')
                      setDiasAbonados(null)
                    }}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors text-left"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-medium" style={{ color: vencida ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                        {labelP} {f.numeroPeriodo}
                      </span>
                      {esBalloon && (
                        <span className="text-[8px] font-bold px-1 py-px rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)' }}>
                          Globo
                        </span>
                      )}
                      {vencida && (
                        <span className="text-[8px] font-bold px-1 py-px rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)' }}>
                          Vencida
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold font-mono-display" style={{ color: 'var(--color-accent)' }}>
                      {formatMoney(faltante)}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })()}

        {/* Atajos para no recalcular mora / ponerse al dia manualmente.
            Al pulsar, calculamos cuantos dias equivale el monto y movemos
            tambien el slider de abono rapido para que el usuario vea visualmente
            el progreso. Si supera 30 dias (max del slider), se capea en 30. */}
        {tipo !== 'capital' && tipo !== 'recargo' && tipo !== 'descuento' && tipo !== 'intereses' && (() => {
          const cuota = Math.max(1, Math.round(cuotaDiaria ?? 1))
          const diasParaMonto = (m) => Math.min(30, Math.max(1, Math.round((Number(m) || 0) / cuota)))
          return (
          <div className="grid grid-cols-1 gap-2">
            {Number(prestamo?.montoEnMora) > 0 && (
              <button
                type="button"
                onClick={() => {
                  const montoFinal = Math.min(Math.round(prestamo.montoEnMora), Math.round(saldoPendiente ?? 0))
                  const dias = diasParaMonto(montoFinal)
                  setMonto(String(montoFinal))
                  setTipo('completo')
                  setDiasAbonados(dias)
                  setSliderVisual(dias)
                }}
                className="h-10 rounded-[12px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] text-[var(--color-danger)] text-sm font-semibold hover:bg-[rgba(239,68,68,0.15)] transition-colors"
              >
                Pagar mora
                {Number(prestamo?.cuotasEnMora) > 0 ? ` (${prestamo.cuotasEnMora} cuota${prestamo.cuotasEnMora === 1 ? '' : 's'})` : ''}
                {' · '}
                {formatMoney(prestamo.montoEnMora)}
              </button>
            )}

            {Number(prestamo?.montoParaPonerseAlDia) > 0 && Number(prestamo?.montoParaPonerseAlDia) !== Number(prestamo?.montoEnMora) && (
              <button
                type="button"
                onClick={() => {
                  const montoFinal = Math.min(Math.round(prestamo.montoParaPonerseAlDia), Math.round(saldoPendiente ?? 0))
                  const dias = diasParaMonto(montoFinal)
                  setMonto(String(montoFinal))
                  setTipo('completo')
                  setDiasAbonados(dias)
                  setSliderVisual(dias)
                }}
                className="h-10 rounded-[12px] border border-[rgba(245,197,24,0.3)] bg-[rgba(245,197,24,0.1)] text-[var(--color-accent)] text-sm font-semibold hover:bg-[rgba(245,197,24,0.18)] transition-colors"
              >
                Ponerse al día · {formatMoney(prestamo.montoParaPonerseAlDia)}
              </button>
            )}
          </div>
          )
        })()}

        {/* Slider de abono rápido por días */}
        {tipo !== 'capital' && tipo !== 'recargo' && tipo !== 'descuento' && tipo !== 'intereses' && (() => {
          const val = diasAbonados || 1
          // Valor mostrado en el slider (puede ser fraccional durante la animacion)
          const visual = sliderVisual
          const SNAPS = [7, 15, 30]
          const isSnap = SNAPS.includes(val)
          const snapLabel = val === 7 ? '1 sem' : val === 15 ? 'Quinc.' : val === 30 ? '1 mes' : null
          const pctVisual = ((visual - 1) / 29 * 100)
          return (
          <div className="border-t border-[var(--color-border)] pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-[0.05em]">
                Abono rápido por días
              </p>
              {diasAbonados && (
                <span className={`text-sm font-bold font-mono-display transition-colors ${isSnap ? 'text-[var(--color-accent)]' : 'text-[var(--color-success)]'}`}>
                  {diasAbonados} {diasAbonados === 1 ? 'día' : 'días'}
                  {snapLabel && <span className="text-[10px] font-normal text-[var(--color-text-muted)] ml-1">({snapLabel})</span>}
                  {' — '}{formatMoney(Number(monto))}
                </span>
              )}
            </div>
            {/* Track visual + thumb animado. Usamos un contenedor relative con
                un track de fondo, fill animado y thumb posicionado por porcentaje.
                El input range nativo va encima invisible para capturar el drag. */}
            <div className="relative h-6 flex items-center select-none">
              {/* Track de fondo */}
              <div className="absolute inset-x-0 h-2 rounded-full" style={{ background: 'var(--color-bg-hover)' }} />
              {/* Fill verde animado */}
              <div
                className="absolute h-2 rounded-full"
                style={{
                  width: `${pctVisual}%`,
                  background: 'linear-gradient(to right, color-mix(in srgb, var(--color-success) 85%, black), var(--color-success))',
                  boxShadow: pctVisual > 5 ? '0 0 6px rgba(34, 197, 94, 0.25)' : 'none',
                }}
              />
              {/* Thumb */}
              <div
                className="absolute w-5 h-5 rounded-full pointer-events-none"
                style={{
                  left: `calc(${pctVisual}% - 10px)`,
                  background: 'var(--color-success)',
                  border: '3px solid var(--color-bg-base)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3), 0 0 0 1px rgba(34, 197, 94, 0.3)',
                }}
              />
              {/* Input range invisible para drag manual */}
              <input
                type="range"
                min={1}
                max={30}
                value={val}
                onChange={(e) => handleAbonoDias(Number(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
                style={{ height: '24px' }}
              />
            </div>
            {/* Tick marks */}
            <div className="relative h-5 mt-1">
              <span className="absolute left-0 text-[10px] text-[var(--color-text-muted)]">1</span>
              {SNAPS.map((s) => {
                const pct = ((s - 1) / 29 * 100)
                const active = val === s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleAbonoDias(s)}
                    className={`absolute -translate-x-1/2 text-[10px] font-medium transition-all cursor-pointer ${active ? 'text-[var(--color-accent)] scale-110' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}
                    style={{ left: `${pct}%` }}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
          )
        })()}

        <div className="border-t border-[var(--color-border)] pt-4 space-y-4">
          <MoneyInput
            label="Monto del pago *"
            value={monto}
            onChange={(e) => {
              setMonto(e.target.value)
              setError('')
              // Si el usuario edita manualmente el monto, limpiar diasAbonados
              // para evitar que el backend recalcule monto = cuotaDiaria * dias.
              if (diasAbonados !== null) setDiasAbonados(null)
            }}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-[0.05em]">Tipo</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'completo', label: 'Completo',  color: 'var(--color-accent)' },
                { key: 'parcial',  label: 'Parcial',   color: 'var(--color-accent)' },
                { key: 'capital',  label: 'A capital',  color: 'var(--color-purple)' },
                { key: 'recargo',  label: 'Recargo',   color: '#f97316' },
                ...(['lineal', 'lineal_dinamico', 'solo_interes'].includes(prestamo?.modoInteres) ? [{ key: 'intereses', label: 'Intereses', color: 'var(--color-warning)' }] : []),
                // Descuento solo visible si el usuario tiene el permiso (riesgo: reduce saldo).
                ...(puedeAplicarDescuentos ? [{ key: 'descuento', label: 'Descuento', color: 'var(--color-success)' }] : []),
              ].map(({ key, label, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTipo(key)
                    if (key === 'capital' || key === 'recargo' || key === 'descuento' || key === 'intereses') {
                      setDiasAbonados(null)
                      if (key === 'intereses') {
                        const interesesPend = prestamo?.cuotasAmortizacion
                          ?.filter(f => new Date(f.fechaEsperada) <= new Date() && (f.pagado || 0) < f.cuotaTotal)
                          ?.reduce((acc, f) => acc + Math.max(0, f.interes - (f.interesPagado || 0)), 0) ?? 0
                        setMonto(String(Math.round(interesesPend)))
                      } else {
                        setMonto('')
                      }
                    }
                  }}
                  className={[
                    'h-9 rounded-[10px] border text-xs font-medium transition-all cursor-pointer',
                    tipo === key
                      ? `border-[${color}] text-[${color}]`
                      : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface)]',
                  ].join(' ')}
                  style={tipo === key ? { backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`, borderColor: color, color } : undefined}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview para recargo/descuento */}
          {(tipo === 'recargo' || tipo === 'descuento') && Number(monto) > 0 && (
            <div
              className="px-3 py-2.5 rounded-[10px] border"
              style={{
                background: tipo === 'recargo' ? 'rgba(249,115,22,0.08)' : 'rgba(34,197,94,0.08)',
                borderColor: tipo === 'recargo' ? 'rgba(249,115,22,0.2)' : 'rgba(34,197,94,0.2)',
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[var(--color-text-muted)]">
                  {tipo === 'recargo' ? 'Recargo' : 'Descuento'}
                </span>
                <span
                  className="text-sm font-semibold font-mono-display"
                  style={{ color: tipo === 'recargo' ? '#f97316' : 'var(--color-success)' }}
                >
                  {tipo === 'recargo' ? '+' : '−'}{formatMoney(Number(monto))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-muted)]">Nuevo saldo</span>
                <span className="text-sm font-bold text-[var(--color-text-primary)] font-mono-display">
                  {formatMoney(tipo === 'recargo'
                    ? saldoPendiente + Number(monto)
                    : Math.max(0, saldoPendiente - Number(monto)))}
                </span>
              </div>
            </div>
          )}

          {tipo === 'capital' && (
            <div className="bg-[rgba(168,85,247,0.08)] border border-[rgba(168,85,247,0.2)] rounded-[10px] px-3 py-2.5 text-xs">
              <p className="font-medium text-[var(--color-purple)] mb-1">Abono a capital</p>
              <p className="text-[var(--color-text-muted)]">
                Reduce el capital y los intereses sobre ese monto. El préstamo termina antes.
                {monto && Number(monto) > 0 && prestamo?.tasaInteres > 0 && (() => {
                  const ahora = new Date(Date.now() - 5 * 60 * 60 * 1000)
                  const inicio = new Date(prestamo.fechaInicio)
                  const diasTrans = Math.max(0, Math.floor((ahora - inicio) / (1000 * 60 * 60 * 24)))
                  const diasRest = Math.max(0, (prestamo.diasPlazo || 0) - diasTrans)
                  const ahorro = Math.round(Number(monto) * (prestamo.tasaInteres / 100) * (diasRest / 30))
                  return (
                    <> Ahorro en intereses: <span className="text-[var(--color-purple)] font-medium font-mono-display">
                      {formatMoney(ahorro)}
                    </span></>
                  )
                })()}
              </p>
            </div>
          )}

          {tipo === 'intereses' && (
            <div className="bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)] rounded-[10px] px-3 py-2.5 text-xs">
              <p className="font-medium text-[var(--color-warning)] mb-1">Pago a intereses</p>
              <p className="text-[var(--color-text-muted)]">
                Cubre solo los intereses de las cuotas vencidas. El capital queda pendiente pero no genera mora adicional.
              </p>
            </div>
          )}

          {/* Método de pago — solo para pagos reales, no ajustes */}
          {!['recargo', 'descuento'].includes(tipo) && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-[0.05em]">Metodo de pago</span>
              <MetodoPagoSelector
                metodosPago={metodosPago}
                compact
                value={{ metodoPago, metodoPagoId }}
                onSelect={({ metodoPago: mp, metodoPagoId: mpId, plataforma: pl }) => {
                  setMetodoPago(mp)
                  setMetodoPagoId(mpId)
                  setPlataforma(pl || '')
                }}
              />
            </div>
          )}

          <Input
            label={(tipo === 'recargo' || tipo === 'descuento') ? 'Motivo (obligatorio)' : 'Nota (opcional)'}
            placeholder={
              tipo === 'recargo' ? 'Ej: Multa por 5 días de atraso' :
              tipo === 'descuento' ? 'Ej: Pago anticipado, devolucion' :
              'Ej: Pago adelantado'
            }
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}
