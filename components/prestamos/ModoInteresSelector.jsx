'use client'
import { useState } from 'react'
import { formatMoney } from '@/lib/i18n'
import { calcularPrestamo } from '@/lib/calculos'

// `base` dice QUÉ SIGNIFICA el porcentaje que escribió el prestamista. No es
// cosmético: el mismo "20%" vale tres cosas distintas según el modo.
//   'mes'     -> se prorratea por los días que dure el préstamo
//   'total'   -> es del préstamo completo; el plazo no cambia el interés
//   'periodo' -> se cobra ENTERO en cada cobro (semanal = 20% por semana)
const BASES = {
  mes:     { texto: 'El % es por mes',             color: 'var(--cf-ink-2)' },
  total:   { texto: 'El % es de todo el préstamo', color: 'var(--cf-green-dark)' },
  periodo: { texto: 'El % es por cada cobro',      color: 'var(--cf-gold-dark)' },
}

const MODOS = [
  {
    key: 'fijo', label: 'Cuota fija', tag: 'Recomendado', base: 'mes', avanzado: false,
    desc: 'La cuota es igual todas las veces. Capital e interés repartidos parejo. Es el más usado.',
    formula: 'Interés = Monto × % × meses.  Cuota = (Monto + Interés) ÷ número de cobros.',
  },
  {
    key: 'unico', label: 'Interés de una sola vez', tag: 'De una vez', base: 'total', avanzado: false,
    desc: 'Cobras el interés una sola vez, dure lo que dure. Si prestas $250.000 al 20%, son $50.000 así sean 6 semanas o 6 meses.',
    formula: 'Interés = Monto × % (una sola vez).  Cuota = (Monto + Interés) ÷ cobros.',
  },
  {
    key: 'solo_interes', label: 'Solo interés, capital al final', tag: 'Globo', base: 'periodo', avanzado: false,
    desc: 'Cada cobro es solo interés. El capital completo vuelve al final, en una cuota grande.',
    formula: 'Cada cobro = Capital × %.  El último cobro incluye el capital completo.',
  },
  {
    key: 'saldo', label: 'Interés sobre lo que falta', tag: 'Como los bancos', base: 'mes', avanzado: false,
    desc: 'El interés se calcula sobre lo que aún debe: a medida que abona capital, el interés baja.',
    formula: 'Cuota fija (sistema francés). El interés de cada cuota = saldo pendiente × %; el resto abona capital.',
  },
  {
    key: 'manual', label: 'Yo decido la cuota', tag: 'Manual', base: null, avanzado: false,
    desc: 'Tú pones la cuota exacta. El sistema calcula cuántos cobros hacen falta. Aquí el % no se usa.',
    formula: 'Tú fijas la cuota. Número de cobros = Total a pagar ÷ cuota.',
  },
  {
    key: 'lineal', label: 'Cuota que va bajando', tag: 'Decreciente', base: 'periodo', avanzado: true,
    desc: 'El capital se divide parejo y el interés baja cada cobro, porque va sobre lo que falta.',
    formula: 'Capital ÷ cobros (parejo) + interés del período (saldo × %). La cuota baja cada vez.',
  },
  {
    key: 'lineal_dinamico', label: 'Cuota que se ajusta al pago real', tag: 'Dinámico', base: 'periodo', avanzado: true,
    desc: 'Igual que la que va bajando, pero recalcula los cobros que faltan según lo que de verdad pagó.',
    formula: 'Como decreciente, pero recalcula los cobros restantes según lo ya pagado.',
  },
]

// ─── Asistente: preguntas con EJEMPLOS reales (más claras que la lista) ────
const PREGUNTA_1 = {
  titulo: '¿Cuál se parece más a tu forma de prestar?',
  ayuda: 'Piensa en cómo le cobras a un cliente típico.',
  opciones: [
    { label: 'Le cobro una cuota igual cada vez', ej: 'El cliente paga lo mismo cada cobro hasta terminar de pagar.', next: 'q2' },
    { label: 'Le cobro solo el interés; el capital al final', ej: 'Cada cobro es solo la ganancia. Al final me devuelve todo lo prestado de una.', modo: 'solo_interes' },
    { label: 'Le cobro un interés fijo, una sola vez', ej: 'Presto $100.000 y me devuelve $120.000, se demore lo que se demore.', modo: 'unico' },
    { label: 'Yo decido cuánto paga cada cuota', ej: 'Sin fórmulas: yo pongo el valor exacto de cada cobro.', modo: 'manual' },
  ],
}
const PREGUNTA_2 = {
  titulo: '¿El interés se mantiene, o baja si el cliente abona?',
  ayuda: 'Cuando el cliente adelanta capital, ¿qué pasa con el interés?',
  opciones: [
    { label: 'Se mantiene parejo', ej: 'Cobro el mismo interés sobre lo que presté, de principio a fin. Es lo más común.', modo: 'fijo' },
    { label: 'Baja cuando abona capital', ej: 'Si el cliente adelanta, le cobro interés solo sobre lo que aún debe. Como los bancos.', modo: 'saldo' },
  ],
}

function calcularEjemplo(modo, { monto, tasa, frecuencia, diasPlazo }) {
  const m = Number(monto)
  const p = Number(diasPlazo)
  if (!m || !p) return null
  try {
    return calcularPrestamo({ montoPrestado: m, tasaInteres: Number(tasa), diasPlazo: p, fechaInicio: new Date(), frecuencia, modoInteres: modo })
  } catch { return null }
}

const CHECK = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-7.997 8a1 1 0 01-1.414 0L3.296 10.71a1 1 0 011.415-1.415l3.29 3.29 7.288-7.295a1 1 0 011.415 0z" clipRule="evenodd" /></svg>
)

export default function ModoInteresSelector({ modoInteres, onChange, calculo, monto, tasa, frecuencia, diasPlazo, preferido = null, onGuardarPreferido }) {
  // paso: 'lista' | 'q1' | 'q2' | 'resultado'
  const [paso, setPaso] = useState('lista')
  const [sugerido, setSugerido] = useState(null)
  const [verAvanzados, setVerAvanzados] = useState(false)

  const ctx = { monto, tasa, frecuencia, diasPlazo }
  const modoData = (k) => MODOS.find(m => m.key === k)

  const elegirOpcion = (op) => {
    if (op.next === 'q2') { setPaso('q2'); return }
    if (op.modo) { setSugerido(op.modo); setPaso('resultado') }
  }

  const aplicarSugerido = (comoPredeterminado) => {
    onChange(sugerido)
    if (comoPredeterminado && onGuardarPreferido) onGuardarPreferido(sugerido)
    setPaso('lista')
    if (modoData(sugerido)?.avanzado) setVerAvanzados(true)
  }

  // ── Asistente: preguntas ──
  if (paso === 'q1' || paso === 'q2') {
    const preg = paso === 'q1' ? PREGUNTA_1 : PREGUNTA_2
    return (
      <div className="rounded-[16px] p-4" style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)' }}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-gold)' }}>
              {paso === 'q1' ? 'Paso 1 de 2' : 'Paso 2 de 2'}
            </p>
            <p className="text-[15px] font-bold leading-tight mt-0.5" style={{ color: 'var(--cf-ink)' }}>{preg.titulo}</p>
          </div>
          <button type="button" onClick={() => setPaso(paso === 'q2' ? 'q1' : 'lista')}
            className="text-[11px] font-semibold shrink-0 mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
            {paso === 'q2' ? '← Atrás' : 'Cerrar'}
          </button>
        </div>
        <p className="text-[11px] mb-3" style={{ color: 'var(--cf-ink-3)' }}>{preg.ayuda}</p>
        <div className="space-y-2">
          {preg.opciones.map((op, i) => (
            <button key={i} type="button" onClick={() => elegirOpcion(op)}
              className="w-full text-left rounded-[12px] p-3 transition-all active:scale-[0.99]"
              style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--cf-ink)' }}>{op.label}</p>
              <p className="text-[12px] mt-1 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>{op.ej}</p>
            </button>
          ))}
        </div>
        {/* Salida para quien no encaja en las opciones comunes (ej: cuota que va
            bajando). Abre la lista completa con los modos avanzados desplegados,
            en vez de mandarlo a un modo equivocado. */}
        {paso === 'q1' && (
          <button type="button" onClick={() => { setVerAvanzados(true); setPaso('lista') }}
            className="w-full text-center text-[11px] font-semibold mt-3 py-1.5" style={{ color: 'var(--cf-ink-3)' }}>
            Ninguna se parece — ver todos los modos
          </button>
        )}
      </div>
    )
  }

  // ── Asistente: resultado ──
  if (paso === 'resultado') {
    const md = modoData(sugerido)
    const ej = calcularEjemplo(sugerido, ctx)
    return (
      <div className="rounded-[16px] p-4" style={{ background: 'color-mix(in srgb, var(--cf-gold) 8%, var(--cf-surface))', border: '1.5px solid var(--cf-gold)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--cf-ink-3)' }}>Tu modo ideal es</p>
        <p className="text-lg font-bold" style={{ color: 'var(--cf-ink)' }}>{md?.label}</p>
        {md?.base && <p className="text-[11px] font-semibold mt-0.5" style={{ color: BASES[md.base].color }}>{BASES[md.base].texto}</p>}
        <p className="text-[12px] mt-1.5 leading-snug" style={{ color: 'var(--cf-ink-2)' }}>{md?.desc}</p>
        {ej && sugerido !== 'manual' && (
          <p className="text-[12px] mt-2 font-medium tabular-nums" style={{ color: 'var(--cf-gold)' }}>
            {ej.numPeriodos} cuotas de {formatMoney(ej.cuotaDiaria)} · Total {formatMoney(ej.totalAPagar)}
          </p>
        )}
        <p className="text-[11px] mt-2.5 leading-snug rounded-[8px] p-2" style={{ background: 'var(--cf-card)', color: 'var(--cf-ink-2)', border: '1px solid var(--cf-border)' }}>
          <span className="font-semibold" style={{ color: 'var(--cf-ink-3)' }}>Cómo se calcula: </span>{md?.formula}
        </p>
        <div className="flex flex-col gap-2 mt-4">
          {onGuardarPreferido ? (
            <>
              <button type="button" onClick={() => aplicarSugerido(true)}
                className="h-11 rounded-[12px] text-sm font-bold flex items-center justify-center gap-2"
                style={{ background: 'var(--cf-gold)', color: '#111' }}>
                {CHECK} Usar siempre este modo
              </button>
              <button type="button" onClick={() => aplicarSugerido(false)}
                className="h-10 rounded-[12px] text-sm font-semibold"
                style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink-2)' }}>
                Solo para este préstamo
              </button>
            </>
          ) : (
            <button type="button" onClick={() => aplicarSugerido(false)}
              className="h-11 rounded-[12px] text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: 'var(--cf-gold)', color: '#111' }}>
              {CHECK} Usar este modo
            </button>
          )}
          <button type="button" onClick={() => setPaso('q1')}
            className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
            Volver a responder
          </button>
        </div>
      </div>
    )
  }

  // ── Lista (vista por defecto) ──
  const visibles = MODOS.filter(m => !m.avanzado || verAvanzados || modoInteres === m.key)
  const renderModo = (m) => {
    const activo = modoInteres === m.key
    const esPreferido = preferido === m.key
    const ej = calcularEjemplo(m.key, ctx)
    return (
      <button key={m.key} type="button" onClick={() => onChange(m.key)}
        className="w-full text-left rounded-xl p-3 transition-all"
        style={{ background: activo ? 'color-mix(in srgb, var(--cf-gold) 8%, transparent)' : 'var(--cf-surface)', border: activo ? '1.5px solid var(--cf-gold)' : '1px solid var(--cf-border)' }}>
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center" style={{ borderColor: activo ? 'var(--cf-gold)' : 'var(--cf-border)' }}>
            {activo && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--cf-gold)' }} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-sm font-semibold" style={{ color: 'var(--cf-ink)' }}>{m.label}</span>
              {esPreferido && (
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md" style={{ background: 'color-mix(in srgb, var(--cf-gold) 18%, transparent)', color: 'var(--cf-gold)' }}>Tu modo habitual</span>
              )}
              {m.tag && !esPreferido && (
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md" style={{ background: m.key === 'fijo' ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)', color: m.key === 'fijo' ? 'var(--cf-green-dark)' : 'var(--cf-ink-3)' }}>{m.tag}</span>
              )}
            </div>
            {m.base && <p className="text-[11px] font-semibold mb-0.5" style={{ color: BASES[m.base].color }}>{BASES[m.base].texto}</p>}
            <p className="text-[11px] leading-snug" style={{ color: 'var(--cf-ink-3)' }}>{m.desc}</p>
            {ej && m.key !== 'manual' && (
              <p className="text-[11px] mt-1 font-medium tabular-nums" style={{ color: activo ? 'var(--cf-gold)' : 'var(--cf-ink-2)' }}>
                {ej.numPeriodos} cuotas de {formatMoney(ej.cuotaDiaria)} · Total {formatMoney(ej.totalAPagar)}
                <span style={{ color: 'var(--cf-ink-3)' }}> · Interés {formatMoney(ej.totalInteres)}</span>
              </p>
            )}
            {/* La formula aparece SOLO en el modo elegido (para los que quieren el
                detalle), sin llenar todas las tarjetas de botones. */}
            {activo && (
              <p className="text-[11px] mt-1.5 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
                <span className="font-semibold">Cómo se calcula: </span>{m.formula}
              </p>
            )}
          </div>
        </div>
      </button>
    )
  }

  const hayAvanzadosOcultos = MODOS.some(m => m.avanzado) && !verAvanzados

  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--cf-ink-3)' }}>
        Modo de interés
      </label>

      {/* Asistente: quita la fricción de leer 7 modos y decidir */}
      <button type="button" onClick={() => { setSugerido(null); setPaso('q1') }}
        className="w-full flex items-center gap-2.5 rounded-[12px] p-3 mb-3 transition-all active:scale-[0.99]"
        style={{ background: 'color-mix(in srgb, var(--cf-gold) 10%, transparent)', border: '1px dashed color-mix(in srgb, var(--cf-gold) 45%, transparent)' }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--cf-gold)', color: '#111' }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 17h.008M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div className="text-left">
          <p className="text-sm font-bold" style={{ color: 'var(--cf-ink)' }}>¿No sabes cuál usar?</p>
          <p className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Responde 2 preguntas y te decimos cuál es tu modo ideal.</p>
        </div>
      </button>

      <div className="space-y-2">
        {visibles.map(renderModo)}
      </div>

      {hayAvanzadosOcultos && (
        <button type="button" onClick={() => setVerAvanzados(true)}
          className="w-full mt-2 h-9 rounded-[10px] text-[12px] font-semibold" style={{ color: 'var(--cf-ink-3)', background: 'var(--cf-surface)', border: '1px solid var(--cf-border)' }}>
          Ver modos avanzados ▾
        </button>
      )}
    </div>
  )
}
