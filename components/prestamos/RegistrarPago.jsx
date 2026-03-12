'use client'
// components/prestamos/RegistrarPago.jsx - Modal de registro de pago

import { useState }    from 'react'
import { Modal }       from '@/components/ui/Modal'
import { Button }      from '@/components/ui/Button'
import { Input }       from '@/components/ui/Input'
import BotonWhatsApp   from '@/components/ui/BotonWhatsApp'
import { formatCOP, DIAS_ABONO } from '@/lib/calculos'
import { guardarPagoPendiente }  from '@/lib/offline'

export default function RegistrarPago({
  prestamoId, cuotaDiaria, saldoPendiente,
  open, onClose, onSuccess,
  cliente, prestamo,
}) {
  const [monto,        setMonto]        = useState(String(Math.round(cuotaDiaria ?? 0)))
  const [tipo,         setTipo]         = useState('completo')
  const [nota,         setNota]         = useState('')
  const [diasAbonados, setDiasAbonados] = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [exitoso,      setExitoso]      = useState(false)
  const [pagoGuardado, setPagoGuardado] = useState(null)
  const [prestamoAct,  setPrestamoAct]  = useState(null)

  const handleSubmit = async () => {
    const m = Number(monto)
    if (!m || m <= 0) { setError('Ingresa un monto válido'); return }
    if (m > saldoPendiente) {
      setError(`El monto no puede superar el saldo: ${formatCOP(saldoPendiente)}`)
      return
    }

    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`/api/prestamos/${prestamoId}/pagos`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ montoPagado: m, tipo, nota, diasAbonados }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al registrar el pago'); return }

      const pagoParaWA = { montoPagado: m, fechaPago: new Date().toISOString() }
      setPagoGuardado(pagoParaWA)
      setPrestamoAct(data)
      setExitoso(true)
      onSuccess?.(data, pagoParaWA)
    } catch {
      // Offline: guardar en IndexedDB para sincronizar después
      if (!navigator.onLine) {
        try {
          await guardarPagoPendiente({
            prestamoId,
            montoPagado: m,
            tipo,
            nota,
            diasAbonados,
            clienteNombre: cliente?.nombre,
          })
          window.dispatchEvent(new Event('paymentQueued'))
          const pagoOffline = { montoPagado: m, fechaPago: new Date().toISOString(), offline: true }
          setPagoGuardado(pagoOffline)
          setExitoso(true)
          setError('')
          onSuccess?.(prestamo, pagoOffline)
          return
        } catch {
          setError('No se pudo guardar el pago offline.')
          return
        }
      }
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleCerrar = () => {
    setExitoso(false)
    setPagoGuardado(null)
    setPrestamoAct(null)
    setMonto(String(Math.round(cuotaDiaria ?? 0)))
    setTipo('completo')
    setNota('')
    setDiasAbonados(null)
    setError('')
    onClose?.()
  }

  const handleAbonoDias = (dias) => {
    const montoAbono = cuotaDiaria * dias
    setMonto(String(montoAbono))
    setDiasAbonados(dias)
    setError('')
  }

  // ── Vista éxito ───────────────────────────────────────────────
  if (exitoso && pagoGuardado) {
    const prestamoWA = prestamoAct ?? prestamo
    return (
      <Modal
        open={open}
        onClose={handleCerrar}
        title="¡Pago registrado!"
        footer={<Button onClick={handleCerrar} className="w-full">Cerrar</Button>}
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2 py-3">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${pagoGuardado.offline ? 'bg-[rgba(245,197,24,0.15)]' : 'bg-[rgba(34,197,94,0.15)]'}`}>
              {pagoGuardado.offline ? (
                <svg className="w-7 h-7 text-[#f5c518]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <p className="text-white font-bold text-lg">{formatCOP(pagoGuardado.montoPagado)}</p>
            <p className="text-[#888888] text-sm">
              {pagoGuardado.offline ? 'guardado offline — se sincronizará al conectar' : 'pagado correctamente'}
            </p>
          </div>

          {prestamoWA && (
            <div className="bg-[#111111] rounded-[12px] px-4 py-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[#888888]">Saldo pendiente</span>
                <span className="text-white font-medium">{formatCOP(prestamoWA.saldoPendiente)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888888]">Progreso</span>
                <span className="text-[#22c55e] font-medium">{prestamoWA.porcentajePagado}%</span>
              </div>
            </div>
          )}

          {cliente?.telefono && prestamoWA && (
            <BotonWhatsApp tipo="pago" cliente={cliente} prestamo={prestamoWA} pago={pagoGuardado} />
          )}
        </div>
      </Modal>
    )
  }

  // ── Vista formulario ──────────────────────────────────────────
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar pago"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={loading}>Confirmar pago</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[10px] px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex justify-between items-center text-sm">
          <span className="text-[#888888]">Cuota</span>
          <span className="font-semibold text-white">{formatCOP(cuotaDiaria)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-[#888888]">Saldo pendiente</span>
          <span className="font-semibold text-white">{formatCOP(saldoPendiente)}</span>
        </div>

        {/* Botones de abono rápido por días */}
        <div className="border-t border-[#2a2a2a] pt-4">
          <p className="text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em] mb-2">
            Abono rápido por días
          </p>
          <div className="grid grid-cols-5 gap-2">
            {DIAS_ABONO.map((dias) => (
              <button
                key={dias}
                type="button"
                onClick={() => handleAbonoDias(dias)}
                className={[
                  'h-9 rounded-[10px] border text-sm font-medium transition-all cursor-pointer',
                  diasAbonados === dias
                    ? 'bg-[rgba(34,197,94,0.15)] border-[#22c55e] text-[#22c55e]'
                    : 'bg-transparent border-[#2a2a2a] text-[#888888] hover:bg-[#1a1a1a]',
                ].join(' ')}
              >
                {dias}d
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-[#2a2a2a] pt-4 space-y-4">
          <Input
            label="Monto del pago *"
            type="number"
            inputMode="numeric"
            value={monto}
            onChange={(e) => { setMonto(e.target.value); setError('') }}
            prefix="$"
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em]">Tipo de pago</span>
            <div className="flex gap-2">
              {['completo', 'parcial'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={[
                    'flex-1 h-9 rounded-[10px] border text-sm font-medium transition-all capitalize cursor-pointer',
                    tipo === t
                      ? 'bg-[rgba(245,197,24,0.15)] border-[#f5c518] text-[#f5c518]'
                      : 'bg-transparent border-[#2a2a2a] text-[#888888] hover:bg-[#1a1a1a]',
                  ].join(' ')}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Nota (opcional)"
            placeholder="Ej: Pago en efectivo"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}
