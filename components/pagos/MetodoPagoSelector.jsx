'use client'

import { useState, useEffect } from 'react'

const ICON_EFECTIVO = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const ICON_TRANSFER = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
  </svg>
)

const ICON_BACK = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
)

const ICON_CHECK = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
)

/**
 * Selector de metodo de pago reutilizable.
 *
 * Modo accion (cobros-hoy, rutas): onSelect dispara el pago directamente.
 * Modo formulario (RegistrarPago): value controla la seleccion visual.
 *
 * Props:
 * - metodosPago: array de { id, nombre } (medios de transferencia)
 * - onSelect({ metodoPago, metodoPagoId, plataforma }): callback
 * - disabled: boolean
 * - value: { metodoPago, metodoPagoId } — si se pasa, el componente muestra
 *   la seleccion activa en vez del "ultimo usado" de sessionStorage.
 * - compact: boolean — version mas pequena para formularios
 */
export default function MetodoPagoSelector({ metodosPago = [], onSelect, disabled = false, value = null, compact = false }) {
  const [paso, setPaso] = useState('tipo')
  const [ultimoMetodo, setUltimoMetodo] = useState(null)
  const [ultimoMedioId, setUltimoMedioId] = useState(null)

  const controlado = value !== null
  const metodoActivo = controlado ? value.metodoPago : ultimoMetodo
  const medioActivo = controlado ? value.metodoPagoId : ultimoMedioId

  useEffect(() => {
    if (controlado) return
    try {
      setUltimoMetodo(sessionStorage.getItem('cf-ultimo-metodo-pago'))
      setUltimoMedioId(sessionStorage.getItem('cf-ultimo-medio-id'))
    } catch {}
  }, [controlado])

  const guardarUltimo = (metodo, medioId) => {
    if (!controlado) {
      try {
        sessionStorage.setItem('cf-ultimo-metodo-pago', metodo)
        if (medioId) sessionStorage.setItem('cf-ultimo-medio-id', medioId)
      } catch {}
      setUltimoMetodo(metodo)
      setUltimoMedioId(medioId)
    }
  }

  const seleccionarEfectivo = () => {
    guardarUltimo('efectivo', null)
    onSelect({ metodoPago: 'efectivo', metodoPagoId: null, plataforma: null })
  }

  const seleccionarMedio = (medio) => {
    guardarUltimo('transferencia', medio.id)
    onSelect({ metodoPago: 'transferencia', metodoPagoId: medio.id, plataforma: medio.nombre })
    if (controlado) setPaso('tipo')
  }

  const medioNombre = medioActivo && metodosPago.find(m => m.id === medioActivo)?.nombre

  if (paso === 'medios') {
    return (
      <div className="space-y-2">
        <button
          onClick={() => setPaso('tipo')}
          disabled={disabled}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {ICON_BACK}
          Volver
        </button>
        <div className={`grid gap-2 ${metodosPago.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {metodosPago.map(m => {
            const selected = medioActivo === m.id
            return (
              <button
                key={m.id}
                onClick={() => seleccionarMedio(m)}
                disabled={disabled}
                className={`flex flex-col items-center gap-2 ${compact ? 'py-3' : 'py-4'} rounded-[12px] border transition-all active:scale-95 relative`}
                style={{
                  background: selected
                    ? 'color-mix(in srgb, var(--color-info) 12%, var(--color-bg-card))'
                    : 'color-mix(in srgb, var(--color-info) 5%, var(--color-bg-card))',
                  borderColor: selected
                    ? 'var(--color-info)'
                    : 'var(--color-border)',
                }}
              >
                {selected && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'var(--color-info)', color: '#fff' }}>
                    {ICON_CHECK}
                  </span>
                )}
                <div
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center"
                  style={{ background: 'color-mix(in srgb, var(--color-info) 15%, transparent)', color: 'var(--color-info)' }}
                >
                  {ICON_TRANSFER}
                </div>
                <span className="text-xs font-semibold leading-tight text-center" style={{ color: 'var(--color-text-primary)' }}>{m.nombre}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={seleccionarEfectivo}
        disabled={disabled}
        className={`flex flex-col items-center gap-2.5 ${compact ? 'py-3.5' : 'py-5'} rounded-[16px] border transition-all active:scale-95 relative`}
        style={{
          background: metodoActivo === 'efectivo'
            ? 'color-mix(in srgb, var(--color-success) 10%, var(--color-bg-card))'
            : 'color-mix(in srgb, var(--color-success) 5%, var(--color-bg-card))',
          borderColor: metodoActivo === 'efectivo'
            ? (controlado ? 'var(--color-success)' : 'color-mix(in srgb, var(--color-success) 35%, var(--color-border))')
            : 'var(--color-border)',
        }}
      >
        {metodoActivo === 'efectivo' && controlado && (
          <span className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--color-success)', color: '#fff' }}>
            {ICON_CHECK}
          </span>
        )}
        {metodoActivo === 'efectivo' && !controlado && (
          <span className="absolute top-2 right-2 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md" style={{ background: 'color-mix(in srgb, var(--color-success) 15%, transparent)', color: 'var(--color-success)' }}>Ultimo</span>
        )}
        <div
          className="w-11 h-11 rounded-[12px] flex items-center justify-center"
          style={{ background: 'color-mix(in srgb, var(--color-success) 15%, transparent)', color: 'var(--color-success)' }}
        >
          {ICON_EFECTIVO}
        </div>
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Efectivo</span>
      </button>
      <button
        onClick={() => {
          if (metodosPago.length === 0) {
            guardarUltimo('transferencia', null)
            onSelect({ metodoPago: 'transferencia', metodoPagoId: null, plataforma: null })
          } else {
            setPaso('medios')
          }
        }}
        disabled={disabled}
        className={`flex flex-col items-center gap-2.5 ${compact ? 'py-3.5' : 'py-5'} rounded-[16px] border transition-all active:scale-95 relative`}
        style={{
          background: metodoActivo === 'transferencia'
            ? 'color-mix(in srgb, var(--color-info) 10%, var(--color-bg-card))'
            : 'color-mix(in srgb, var(--color-info) 5%, var(--color-bg-card))',
          borderColor: metodoActivo === 'transferencia'
            ? (controlado ? 'var(--color-info)' : 'color-mix(in srgb, var(--color-info) 35%, var(--color-border))')
            : 'var(--color-border)',
        }}
      >
        {metodoActivo === 'transferencia' && controlado && (
          <span className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--color-info)', color: '#fff' }}>
            {ICON_CHECK}
          </span>
        )}
        {metodoActivo === 'transferencia' && !controlado && (
          <span className="absolute top-2 right-2 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md" style={{ background: 'color-mix(in srgb, var(--color-info) 15%, transparent)', color: 'var(--color-info)' }}>Ultimo</span>
        )}
        <div
          className="w-11 h-11 rounded-[12px] flex items-center justify-center"
          style={{ background: 'color-mix(in srgb, var(--color-info) 15%, transparent)', color: 'var(--color-info)' }}
        >
          {ICON_TRANSFER}
        </div>
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Transferencia</span>
        {metodoActivo === 'transferencia' && medioNombre && (
          <span className="text-[10px] font-medium -mt-1" style={{ color: 'var(--color-info)' }}>{medioNombre}</span>
        )}
      </button>
    </div>
  )
}
