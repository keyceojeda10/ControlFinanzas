'use client'
import { formatMoney } from '@/lib/i18n'
import { calcularPrestamo } from '@/lib/calculos'

// `base` dice QUE SIGNIFICA el porcentaje que escribio el prestamista. No es
// cosmetico: el mismo "20%" vale tres cosas distintas segun el modo, y hasta
// ahora la pantalla no lo decia en ninguna parte. Un usuario reporto que
// esperaba $300.000 y le salio $325.200 justamente por esto.
//
//   'mes'     -> se prorratea por los dias que dure el prestamo
//   'total'   -> es del prestamo completo; el plazo no cambia el interes
//   'periodo' -> se cobra ENTERO en cada cobro (semanal = 20% por semana)
//
// Verificado contra lib/calculos.js, modo por modo. Si cambia el calculo, esto
// tiene que cambiar con el.
const BASES = {
  mes:     { texto: 'El % es por mes',        color: 'var(--color-info)' },
  total:   { texto: 'El % es de todo el préstamo', color: 'var(--color-success)' },
  periodo: { texto: 'El % es por cada cobro', color: 'var(--color-warning)' },
}

const MODOS = [
  {
    key: 'fijo',
    label: 'Cuota fija',
    tag: 'Recomendado',
    base: 'mes',
    desc: 'La cuota es igual todas las veces. Capital e interés repartidos parejo. Es el más usado.',
  },
  {
    key: 'unico',
    label: 'Interés de una sola vez',
    tag: 'De una vez',
    base: 'total',
    desc: 'Cobras el interés una sola vez, dure lo que dure. Si prestas $250.000 al 20%, son $50.000 así sean 6 semanas o 6 meses.',
  },
  {
    key: 'solo_interes',
    label: 'Solo interés, capital al final',
    tag: 'Globo',
    base: 'periodo',
    desc: 'Cada cobro es solo interés. El capital completo vuelve al final, en una cuota grande.',
  },
  {
    key: 'saldo',
    label: 'Interés sobre lo que falta',
    tag: 'Como los bancos',
    base: 'mes',
    desc: 'El interés se calcula sobre lo que aún debe: a medida que abona capital, el interés baja.',
  },
  {
    key: 'manual',
    label: 'Yo decido la cuota',
    tag: 'Manual',
    base: null,
    desc: 'Tú pones la cuota exacta. El sistema calcula cuántos cobros hacen falta. Aquí el % no se usa.',
  },
  {
    key: 'lineal',
    label: 'Cuota que va bajando',
    tag: 'Decreciente',
    base: 'periodo',
    desc: 'El capital se divide parejo y el interés baja cada cobro, porque va sobre lo que falta.',
  },
  {
    key: 'lineal_dinamico',
    label: 'Cuota que se ajusta al pago real',
    tag: 'Dinámico',
    base: 'periodo',
    desc: 'Igual que la que va bajando, pero recalcula los cobros que faltan según lo que de verdad pagó.',
  },
]

function calcularEjemplo(modo, { monto, tasa, frecuencia, diasPlazo }) {
  const m = Number(monto)
  const t = Number(tasa)
  const p = Number(diasPlazo)
  if (!m || !p) return null
  try {
    return calcularPrestamo({ montoPrestado: m, tasaInteres: t, diasPlazo: p, fechaInicio: new Date(), frecuencia, modoInteres: modo })
  } catch { return null }
}

export default function ModoInteresSelector({ modoInteres, onChange, calculo, monto, tasa, frecuencia, diasPlazo }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>
        Como cobras el interes?
      </label>
      {/* Decia "la mayoria usa el clasico", pero ningun modo se llama asi. */}
      <p className="text-[11px] mb-3" style={{ color: 'var(--color-text-muted)' }}>
        Fíjate en la línea de color: dice si el % que escribiste es por mes, por
        cobro, o de todo el préstamo. Si no estás seguro, deja <strong style={{ color: 'var(--color-text-secondary)' }}>Cuota fija</strong>.
      </p>
      <div className="space-y-2">
        {MODOS.map((m) => {
          const activo = modoInteres === m.key
          const ej = calcularEjemplo(m.key, { monto, tasa, frecuencia, diasPlazo })
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onChange(m.key)}
              className="w-full text-left rounded-xl p-3 transition-all"
              style={{
                background: activo ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'var(--color-bg-surface)',
                border: activo ? '1.5px solid var(--color-accent)' : '1px solid var(--color-border)',
              }}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                  style={{ borderColor: activo ? 'var(--color-accent)' : 'var(--color-border)' }}
                >
                  {activo && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent)' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      {m.label}
                    </span>
                    {m.tag && (
                      <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md"
                        style={{
                          background: m.key === 'fijo' ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
                          color: m.key === 'fijo' ? 'var(--color-success)' : 'var(--color-text-muted)',
                        }}
                      >{m.tag}</span>
                    )}
                  </div>
                  {/* Que significa el % — lo primero que se lee, antes de la
                      descripcion. Es el dato que faltaba y que hacia elegir mal
                      el modo. */}
                  {m.base && (
                    <p className="text-[11px] font-semibold mb-0.5" style={{ color: BASES[m.base].color }}>
                      {BASES[m.base].texto}
                    </p>
                  )}
                  <p className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>{m.desc}</p>
                  {ej && m.key !== 'manual' && (
                    <p className="text-[11px] mt-1 font-medium tabular-nums" style={{ color: activo ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                      {ej.numPeriodos} cuotas de {formatMoney(ej.cuotaDiaria)}
                      {' · '}Total {formatMoney(ej.totalAPagar)}
                      {/* El interes en pesos es lo que hace obvia la diferencia
                          entre modos de un vistazo. Antes solo se veia cuota y
                          total, y habia que restar mentalmente. */}
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        {' · '}Interés {formatMoney(ej.totalInteres)}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
