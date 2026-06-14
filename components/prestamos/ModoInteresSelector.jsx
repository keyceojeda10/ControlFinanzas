'use client'
// components/prestamos/ModoInteresSelector.jsx
// Selector de modo de interes con tooltip de ejemplo numerico VIVO: usa los
// datos que el usuario ya escribio para explicar cada modo con su propio caso.

import { useState } from 'react'
import { formatMoney } from '@/lib/i18n'
import { calcularPrestamo } from '@/lib/calculos'

const MODOS = [
  { key: 'fijo',   label: 'Clásico' },
  { key: 'unico',  label: 'De una vez' },
  { key: 'saldo',  label: 'Sobre lo que falta' },
  { key: 'manual', label: 'Cuota exacta' },
  { key: 'lineal', label: 'Cuota decreciente' },
]

// Texto explicativo por modo. Si hay datos, agrega el ejemplo con el caso real.
function explicacion(modo, { monto, tasa, frecuencia, diasPlazo }) {
  const m = Number(monto)
  const t = Number(tasa)
  const hayDatos = m > 0 && t >= 0
  const ej = (dias) => {
    try {
      return calcularPrestamo({ montoPrestado: m, tasaInteres: t, diasPlazo: dias, fechaInicio: new Date(), frecuencia, modoInteres: modo })
    } catch { return null }
  }
  // Para el ejemplo usamos un plazo tipico de la frecuencia (2 meses) para que
  // se vea como sube/no sube el interes.
  const diasEjemplo = { diario: 60, semanal: 56, quincenal: 60, mensual: 60 }[frecuencia] || 60

  switch (modo) {
    case 'fijo': {
      const base = 'El interés sube con el plazo. Cobras el % por cada mes sobre lo prestado.'
      if (!hayDatos) return base
      const r = ej(diasEjemplo)
      return `${base}\n\nTu caso (a ~2 meses): interés ${formatMoney(r.totalInteres)}, total ${formatMoney(r.totalAPagar)}.`
    }
    case 'unico': {
      const base = 'Cobras el % una sola vez, sin importar el plazo.'
      if (!hayDatos) return base
      const r = ej(diasEjemplo)
      return `${base}\n\nTu caso: interés ${formatMoney(r.totalInteres)} fijo, dure lo que dure.`
    }
    case 'saldo': {
      const base = 'El interés baja a medida que el cliente abona. Mas justo para el cliente, cuota calculada por amortizacion.'
      if (!hayDatos) return base
      const r = ej(diasEjemplo)
      return `${base}\n\nTu caso (a ~2 meses): cuota ${formatMoney(r.cuotaDiaria)}, total ${formatMoney(r.totalAPagar)}.`
    }
    case 'manual':
      return 'Tu defines la cuota exacta que quieres cobrar. El sistema calcula el total = cuota x número de cobros. Util para plazos largos o casos a medida.'
    case 'lineal': {
      const base = 'El capital se reparte igual en cada cobro y el interés se calcula sobre lo que falta. La cuota empieza alta y BAJA en cada período.'
      if (!hayDatos) return base
      // Usa el plazo real que el usuario ya escribio (no un ejemplo generico a
      // 2 meses), para que coincida con la tabla del resumen de abajo.
      const r = ej(Number(diasPlazo) > 0 ? Number(diasPlazo) : diasEjemplo)
      if (!r?.tablaAmortizacion?.length) return base
      const primera = r.tablaAmortizacion[0]
      const ultima = r.tablaAmortizacion[r.tablaAmortizacion.length - 1]
      return `${base}\n\nTu caso: cuota 1 = ${formatMoney(primera.cuotaTotal)}, última cuota = ${formatMoney(ultima.cuotaTotal)}.`
    }
    default:
      return ''
  }
}

export default function ModoInteresSelector({ modoInteres, onChange, calculo, monto, tasa, frecuencia, diasPlazo }) {
  const [tipOpen, setTipOpen] = useState(null) // key del modo con tooltip abierto

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          ¿Cómo cobras el interés?
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-1.5">
        {MODOS.map((m) => {
          const activo = modoInteres === m.key
          return (
            <div key={m.key} className="relative">
              <button
                type="button"
                onClick={() => onChange(m.key)}
                className="w-full h-11 rounded-[10px] border text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                style={activo
                  ? { background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }
                  : { background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                {m.label}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setTipOpen(tipOpen === m.key ? null : m.key) }}
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold shrink-0"
                  style={{ border: `1px solid ${activo ? 'var(--color-accent)' : 'var(--color-border)'}`, opacity: 0.8 }}
                  aria-label={`Que es ${m.label}`}
                >
                  ?
                </span>
              </button>

              {tipOpen === m.key && (
                <div
                  className="absolute z-30 left-0 right-0 mt-1 p-3 rounded-[10px] text-[11px] leading-relaxed shadow-lg whitespace-pre-line"
                  style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onClick={() => setTipOpen(null)}
                >
                  {explicacion(m.key, { monto, tasa, frecuencia, diasPlazo })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
