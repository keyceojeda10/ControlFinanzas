'use client'
/* «¿Cada cuánto baja el interés?» — Decreciente quincenal. La misma pregunta en
 * nuevo préstamo y en el simulador: si dijeran cosas distintas, el prestamista
 * simularía una cuenta y crearía otra. Ver `calcularPrestamo` (`interesPorMes`). */
import { formatMoney } from '@/lib/i18n'

function estilo(activo) {
  return activo
    ? { background: 'color-mix(in srgb, var(--cf-gold) 14%, transparent)', borderColor: 'var(--cf-gold)', color: 'var(--cf-gold-dark)' }
    : { background: 'var(--cf-card)', borderColor: 'var(--cf-border)', color: 'var(--cf-ink-2)' }
}

export default function EleccionInteresPorMes({ porMes, onElegir, tabla }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>¿Cada cuánto baja el interés?</label>
      <div className="grid grid-cols-2 gap-2 mt-1.5">
        <button type="button" onClick={() => onElegir(false)}
          className="h-11 rounded-[10px] border text-[13px] font-semibold transition-all"
          style={estilo(!porMes)}>Cada quincena</button>
        <button type="button" onClick={() => onElegir(true)}
          className="h-11 rounded-[10px] border text-[13px] font-semibold transition-all"
          style={estilo(porMes)}>Cada mes</button>
      </div>
      <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: 'var(--cf-ink-3)' }}>
        {porMes
          ? 'Escribe el % de un mes. Se calcula sobre lo que debe al empezar el mes y cada quincena paga la mitad.'
          : 'El % se cobra en cada quincena, sobre lo que debe en ese momento.'}
      </p>
      {porMes && tabla?.length > 2 && (
        <p className="text-[12px] mt-1 font-semibold cf-num" style={{ color: 'var(--cf-ink-2)' }}>
          Interés por quincena: {tabla.slice(0, 4).map((f) => formatMoney(f.interes)).join(', ')}…
        </p>
      )}
    </div>
  )
}
