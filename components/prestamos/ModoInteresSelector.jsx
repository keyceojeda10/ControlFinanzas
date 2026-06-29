'use client'
import { formatMoney } from '@/lib/i18n'
import { calcularPrestamo } from '@/lib/calculos'

const MODOS = [
  {
    key: 'fijo',
    label: 'Cuota fija',
    tag: 'Recomendado',
    desc: 'La cuota es la misma todos los dias. Capital + interes repartidos en partes iguales. Es el metodo mas usado.',
  },
  {
    key: 'unico',
    label: 'Interes de una sola vez',
    tag: 'De una vez',
    desc: 'El cliente paga todo el interes al inicio (o al final). Las cuotas solo devuelven el capital. Ideal para prestamos cortos.',
  },
  {
    key: 'saldo',
    label: 'Interes sobre lo que falta',
    tag: 'Como los bancos',
    desc: 'El interes se calcula sobre el saldo pendiente: a medida que paga capital, el interes baja. La cuota empieza alta y va bajando.',
  },
  {
    key: 'manual',
    label: 'Yo decido la cuota',
    tag: 'Manual',
    desc: 'Tu pones la cuota exacta que quieras cobrar. El sistema calcula cuantas cuotas necesita para pagar el total.',
  },
  {
    key: 'lineal',
    label: 'Cuota que va bajando',
    tag: 'Decreciente',
    desc: 'Capital e interes se cobran por separado. El capital se divide en partes iguales y el interes baja cada periodo porque se calcula sobre lo que falta.',
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
      <p className="text-[11px] mb-3" style={{ color: 'var(--color-text-muted)' }}>
        La mayoria usa el clasico. Si no estas seguro, dejalo asi.
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
                          color: m.key === 'fijo' ? '#22c55e' : 'var(--color-text-muted)',
                        }}
                      >{m.tag}</span>
                    )}
                  </div>
                  <p className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>{m.desc}</p>
                  {ej && m.key !== 'manual' && (
                    <p className="text-[11px] mt-1 font-medium" style={{ color: activo ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                      Cuota: {formatMoney(ej.cuotaDiaria)} &middot; Total: {formatMoney(ej.totalAPagar)}
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
