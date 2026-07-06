// components/prestamos/TablaAmortizacion.jsx - Desglose periodo a periodo
// para prestamos en modoInteres = 'lineal' o 'solo_interes' (globo).
// Layout en 2 lineas por fila: encabezado (estado + periodo + chips + boton)
// y montos en grid de 3 columnas debajo — evita choques en anchos angostos.

import { useState } from 'react'
import { formatMoney } from '@/lib/i18n'

const fmtFecha = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

const LABEL_FRECUENCIA = {
  diario: 'Dia',
  semanal: 'Semana',
  quincenal: 'Quincena',
  mensual: 'Mes',
}

export default function TablaAmortizacion({
  tabla, frecuencia = 'mensual', mostrarPagado = false,
  onPagarCuota, modoInteres,
  capitalExtra, onCapitalExtraChange,
}) {
  if (!Array.isArray(tabla) || tabla.length === 0) return null

  const labelPeriodo = LABEL_FRECUENCIA[frecuencia] || 'Periodo'
  const sorted = [...tabla].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
  const totalFilas = sorted.length
  const esGloboEditable = modoInteres === 'solo_interes' && !!onCapitalExtraChange

  let proximaCuotaIdx = -1
  if (mostrarPagado) {
    proximaCuotaIdx = sorted.findIndex(f => (f.pagado || 0) < f.cuotaTotal)
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-[#8b95a5] uppercase tracking-wide">
        Desglose por {labelPeriodo.toLowerCase()}
      </p>
      {esGloboEditable && (
        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
          Toca una cuota para agregar abono a capital (ej: primas, bonos, ingresos extra)
        </p>
      )}
      <div className="space-y-1.5">
        {sorted.map((fila, idx) => {
          const completado = mostrarPagado && (fila.pagado || 0) >= fila.cuotaTotal
          const interesAlDia = mostrarPagado && !completado && (fila.interesPagado || 0) >= fila.interes
          const esProxima = mostrarPagado && idx === proximaCuotaIdx
          const esBalloon = modoInteres === 'solo_interes' && fila.numeroPeriodo === totalFilas
          const faltante = Math.max(0, fila.cuotaTotal - (fila.pagado || 0))
          const tieneExtra = fila.capital > 0 && !esBalloon && modoInteres === 'solo_interes'

          const vencida = (() => {
            if (!mostrarPagado || completado || interesAlDia) return false
            if (!fila.fechaEsperada) return false
            return new Date(fila.fechaEsperada) < new Date()
          })()

          return (
            <CuotaFila
              key={fila.numeroPeriodo}
              fila={fila}
              labelPeriodo={labelPeriodo}
              completado={completado}
              interesAlDia={interesAlDia}
              esProxima={esProxima}
              esBalloon={esBalloon}
              tieneExtra={tieneExtra}
              faltante={faltante}
              vencida={vencida}
              mostrarPagado={mostrarPagado}
              onPagarCuota={onPagarCuota}
              esGloboEditable={esGloboEditable && !esBalloon}
              capitalExtra={capitalExtra}
              onCapitalExtraChange={onCapitalExtraChange}
            />
          )
        })}
      </div>
    </div>
  )
}

function CuotaFila({
  fila, labelPeriodo, completado, interesAlDia, esProxima, esBalloon,
  tieneExtra, faltante, vencida, mostrarPagado, onPagarCuota,
  esGloboEditable, capitalExtra, onCapitalExtraChange,
}) {
  const [editando, setEditando] = useState(false)
  const extraActual = capitalExtra?.find(e => e.numeroPeriodo === fila.numeroPeriodo)

  const handleTapCuota = () => {
    if (!esGloboEditable) return
    setEditando(true)
  }

  const handleGuardarExtra = (monto) => {
    if (!onCapitalExtraChange) return
    const num = Math.round(Number(monto) || 0)
    const nuevos = (capitalExtra || []).filter(e => e.numeroPeriodo !== fila.numeroPeriodo)
    if (num > 0) {
      nuevos.push({ numeroPeriodo: fila.numeroPeriodo, monto: num })
    }
    onCapitalExtraChange(nuevos)
    setEditando(false)
  }

  const handleQuitarExtra = () => {
    if (!onCapitalExtraChange) return
    const nuevos = (capitalExtra || []).filter(e => e.numeroPeriodo !== fila.numeroPeriodo)
    onCapitalExtraChange(nuevos)
    setEditando(false)
  }

  return (
    <div
      className="relative bg-[var(--color-bg-surface)] border rounded-[10px] px-3 py-2 transition-all"
      style={{
        borderColor: esProxima
          ? 'var(--color-accent)'
          : tieneExtra
            ? 'var(--color-info, #3b82f6)'
            : vencida
              ? 'var(--color-danger)'
              : 'var(--color-border)',
        boxShadow: esProxima ? '0 0 0 1px var(--color-accent)' : undefined,
        cursor: esGloboEditable ? 'pointer' : undefined,
      }}
      onClick={esGloboEditable && !editando ? handleTapCuota : undefined}
    >
      {/* Linea 1: estado + periodo + chips + fecha | boton pagar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {mostrarPagado && (
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: completado ? 'var(--color-success)' : interesAlDia ? 'var(--color-warning)' : vencida ? 'var(--color-danger)' : 'transparent',
                border: (completado || interesAlDia || vencida) ? 'none' : '1.5px solid var(--color-border)',
              }}
              title={completado ? 'Cuota pagada' : interesAlDia ? 'Intereses al dia' : vencida ? 'Vencida' : 'Pendiente'}
            >
              {completado && (
                <svg className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {interesAlDia && (
                <svg className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 4h.01" />
                </svg>
              )}
              {vencida && !interesAlDia && (
                <svg className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              )}
            </span>
          )}
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <p className="text-[11px] font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
              {labelPeriodo} {fila.numeroPeriodo}
            </p>
            <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
              · {fmtFecha(fila.fechaEsperada)}
            </span>
            {esProxima && (
              <span className="text-[8px] font-bold px-1.5 py-px rounded-full whitespace-nowrap"
                style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }}>
                Siguiente
              </span>
            )}
            {esBalloon && !completado && (
              <span className="text-[8px] font-bold px-1.5 py-px rounded-full whitespace-nowrap"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                Capital + interes
              </span>
            )}
            {tieneExtra && (
              <span className="text-[8px] font-bold px-1.5 py-px rounded-full whitespace-nowrap"
                style={{ background: 'color-mix(in srgb, var(--color-info, #3b82f6) 12%, transparent)', color: 'var(--color-info, #3b82f6)' }}>
                + Capital extra
              </span>
            )}
            {mostrarPagado && !completado && faltante > 0 && faltante < fila.cuotaTotal && (
              <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--color-warning)' }}>
                falta {formatMoney(faltante)}
              </span>
            )}
          </div>
        </div>
        {onPagarCuota && !completado && (
          <button
            type="button"
            onClick={() => onPagarCuota(fila)}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-95"
            style={{
              background: esProxima ? 'var(--color-accent)' : 'var(--color-bg-hover)',
              color: esProxima ? '#000' : 'var(--color-text-muted)',
            }}
            title={`Pagar ${labelPeriodo.toLowerCase()} ${fila.numeroPeriodo}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-6-6h12" />
            </svg>
          </button>
        )}
      </div>

      {/* Editor inline de capital extra */}
      {editando && (
        <CapitalExtraEditor
          montoActual={extraActual?.monto || 0}
          onGuardar={handleGuardarExtra}
          onQuitar={handleQuitarExtra}
          onCancelar={() => setEditando(false)}
        />
      )}

      {/* Linea 2: montos en 3 columnas — nunca compite con el encabezado */}
      <div
        className="grid grid-cols-3 gap-2 mt-1.5 pt-1.5"
        style={{ borderTop: '1px dashed color-mix(in srgb, var(--color-border) 70%, transparent)' }}
      >
        <div>
          <p className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>Capital</p>
          <p className="text-[11px] font-mono-display" style={{ color: tieneExtra ? 'var(--color-info, #3b82f6)' : 'var(--color-text-primary)' }}>{formatMoney(fila.capital)}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>Interés</p>
          <p className="text-[11px] font-mono-display" style={{ color: 'var(--color-warning)' }}>{formatMoney(fila.interes)}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>Cuota</p>
          <p className="text-[12px] font-bold font-mono-display" style={{ color: completado ? 'var(--color-success)' : 'var(--color-accent)' }}>
            {formatMoney(fila.cuotaTotal)}
          </p>
        </div>
      </div>
    </div>
  )
}

function CapitalExtraEditor({ montoActual, onGuardar, onQuitar, onCancelar }) {
  const [valor, setValor] = useState(montoActual > 0 ? String(montoActual) : '')

  return (
    <div
      className="mt-2 p-2 rounded-lg"
      style={{ background: 'color-mix(in srgb, var(--color-info, #3b82f6) 8%, var(--color-bg-base))' }}
      onClick={e => e.stopPropagation()}
    >
      <p className="text-[10px] font-semibold mb-1.5" style={{ color: 'var(--color-info, #3b82f6)' }}>
        Abono extra a capital
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={valor}
          onChange={e => setValor(e.target.value)}
          placeholder="Monto"
          autoFocus
          className="flex-1 h-7 rounded-md border px-2 text-xs"
          style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          onKeyDown={e => {
            if (e.key === 'Enter') onGuardar(valor)
            if (e.key === 'Escape') onCancelar()
          }}
        />
        <button
          type="button"
          onClick={() => onGuardar(valor)}
          className="h-7 px-2.5 rounded-md text-[10px] font-bold"
          style={{ background: 'var(--color-info, #3b82f6)', color: '#fff' }}
        >
          OK
        </button>
        {montoActual > 0 && (
          <button
            type="button"
            onClick={onQuitar}
            className="h-7 px-2 rounded-md text-[10px] font-bold"
            style={{ background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)', color: 'var(--color-danger)' }}
          >
            Quitar
          </button>
        )}
        <button
          type="button"
          onClick={onCancelar}
          className="h-7 px-2 rounded-md text-[10px]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          X
        </button>
      </div>
    </div>
  )
}
