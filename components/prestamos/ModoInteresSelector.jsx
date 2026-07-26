'use client'
import { useState } from 'react'
import { formatMoney } from '@/lib/i18n'
import { calcularPrestamo } from '@/lib/calculos'

// `base` dice QUE SIGNIFICA el porcentaje que escribio el prestamista. No es
// cosmetico: el mismo "20%" vale tres cosas distintas segun el modo.
//   'mes'     -> se prorratea por los dias que dure el prestamo
//   'total'   -> es del prestamo completo; el plazo no cambia el interes
//   'periodo' -> se cobra ENTERO en cada cobro (semanal = 20% por semana)
const BASES = {
  mes:     { texto: 'El % es por mes',             color: 'var(--color-info)' },
  total:   { texto: 'El % es de todo el préstamo', color: 'var(--color-success)' },
  periodo: { texto: 'El % es por cada cobro',      color: 'var(--color-warning)' },
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
    formula: 'Cuota fija (sistema francés). Interés de cada cuota = saldo pendiente × %; el resto abona capital.',
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

// ─── Asistente: 2 preguntas -> modo sugerido ──────────────────────
const PREGUNTA_1 = {
  titulo: '¿Cómo le cobras al cliente?',
  opciones: [
    { label: 'Una cuota igual cada vez', sub: 'La misma cantidad hasta terminar', next: 'q2' },
    { label: 'Solo el interés, y el capital al final', sub: 'Cada cobro es el interés; el capital de una al final', modo: 'solo_interes' },
    { label: 'Un solo interés fijo', sub: 'No importa cuánto se demore en pagar', modo: 'unico' },
    { label: 'Yo pongo el valor exacto de la cuota', sub: 'Tú decides cuánto paga cada vez', modo: 'manual' },
  ],
}
const PREGUNTA_2 = {
  titulo: '¿El interés cómo lo sacas?',
  opciones: [
    { label: 'Parejo, sobre todo lo que presté', sub: 'Lo más común en el día a día', modo: 'fijo' },
    { label: 'Sobre lo que aún debe', sub: 'Si abona capital, el interés baja', modo: 'saldo' },
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
  const [formulaAbierta, setFormulaAbierta] = useState(null)

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
    // Si el sugerido es avanzado, abrir esa sección para que se vea seleccionado.
    if (modoData(sugerido)?.avanzado) setVerAvanzados(true)
  }

  // ── Vista asistente (preguntas) ──
  if (paso === 'q1' || paso === 'q2') {
    const preg = paso === 'q1' ? PREGUNTA_1 : PREGUNTA_2
    return (
      <div className="rounded-[16px] p-4" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{preg.titulo}</p>
          <button type="button" onClick={() => setPaso(paso === 'q2' ? 'q1' : 'lista')}
            className="text-[11px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
            {paso === 'q2' ? '← Atrás' : 'Cerrar'}
          </button>
        </div>
        <div className="space-y-2">
          {preg.opciones.map((op, i) => (
            <button key={i} type="button" onClick={() => elegirOpcion(op)}
              className="w-full text-left rounded-[12px] p-3 transition-all active:scale-[0.99]"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{op.label}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{op.sub}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Vista resultado del asistente ──
  if (paso === 'resultado') {
    const md = modoData(sugerido)
    const ej = calcularEjemplo(sugerido, ctx)
    return (
      <div className="rounded-[16px] p-4" style={{ background: 'color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-surface))', border: '1.5px solid var(--color-accent)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>Te recomendamos</p>
        <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{md?.label}</p>
        {md?.base && <p className="text-[11px] font-semibold mt-0.5" style={{ color: BASES[md.base].color }}>{BASES[md.base].texto}</p>}
        <p className="text-[12px] mt-1.5 leading-snug" style={{ color: 'var(--color-text-secondary)' }}>{md?.desc}</p>
        {ej && sugerido !== 'manual' && (
          <p className="text-[12px] mt-2 font-medium tabular-nums" style={{ color: 'var(--color-accent)' }}>
            {ej.numPeriodos} cuotas de {formatMoney(ej.cuotaDiaria)} · Total {formatMoney(ej.totalAPagar)}
          </p>
        )}
        <div className="flex flex-col gap-2 mt-4">
          {onGuardarPreferido ? (
            <>
              <button type="button" onClick={() => aplicarSugerido(true)}
                className="h-11 rounded-[12px] text-sm font-bold flex items-center justify-center gap-2"
                style={{ background: 'var(--color-accent)', color: '#111' }}>
                {CHECK} Usar siempre este modo
              </button>
              <button type="button" onClick={() => aplicarSugerido(false)}
                className="h-10 rounded-[12px] text-sm font-semibold"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                Solo para este préstamo
              </button>
            </>
          ) : (
            <button type="button" onClick={() => aplicarSugerido(false)}
              className="h-11 rounded-[12px] text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: 'var(--color-accent)', color: '#111' }}>
              {CHECK} Usar este modo
            </button>
          )}
          <button type="button" onClick={() => setPaso('q1')}
            className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Volver a responder
          </button>
        </div>
      </div>
    )
  }

  // ── Vista lista (default) ──
  const visibles = MODOS.filter(m => !m.avanzado || verAvanzados || modoInteres === m.key)
  const renderModo = (m) => {
    const activo = modoInteres === m.key
    const esPreferido = preferido === m.key
    const ej = calcularEjemplo(m.key, ctx)
    return (
      <div key={m.key} className="rounded-xl transition-all"
        style={{ background: activo ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'var(--color-bg-surface)', border: activo ? '1.5px solid var(--color-accent)' : '1px solid var(--color-border)' }}>
        <button type="button" onClick={() => onChange(m.key)} className="w-full text-left p-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center" style={{ borderColor: activo ? 'var(--color-accent)' : 'var(--color-border)' }}>
              {activo && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent)' }} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{m.label}</span>
                {esPreferido && (
                  <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md" style={{ background: 'color-mix(in srgb, var(--color-accent) 18%, transparent)', color: 'var(--color-accent)' }}>Tu modo habitual</span>
                )}
                {m.tag && !esPreferido && (
                  <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md" style={{ background: m.key === 'fijo' ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)', color: m.key === 'fijo' ? 'var(--color-success)' : 'var(--color-text-muted)' }}>{m.tag}</span>
                )}
              </div>
              {m.base && <p className="text-[11px] font-semibold mb-0.5" style={{ color: BASES[m.base].color }}>{BASES[m.base].texto}</p>}
              <p className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>{m.desc}</p>
              {ej && m.key !== 'manual' && (
                <p className="text-[11px] mt-1 font-medium tabular-nums" style={{ color: activo ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                  {ej.numPeriodos} cuotas de {formatMoney(ej.cuotaDiaria)} · Total {formatMoney(ej.totalAPagar)}
                  <span style={{ color: 'var(--color-text-muted)' }}> · Interés {formatMoney(ej.totalInteres)}</span>
                </p>
              )}
            </div>
          </div>
        </button>
        {/* Ver formula (avanzado, oculto por defecto) */}
        <button type="button" onClick={() => setFormulaAbierta(formulaAbierta === m.key ? null : m.key)}
          className="w-full text-left px-3 pb-2 -mt-1 text-[10px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
          {formulaAbierta === m.key ? 'Ocultar fórmula' : 'Ver fórmula'}
        </button>
        {formulaAbierta === m.key && (
          <div className="px-3 pb-3 -mt-1">
            <p className="text-[11px] leading-snug rounded-[8px] p-2" style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>{m.formula}</p>
          </div>
        )}
      </div>
    )
  }

  const hayAvanzadosOcultos = MODOS.some(m => m.avanzado) && !verAvanzados

  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>
        Como cobras el interes?
      </label>

      {/* Asistente: quita la friccion de leer 7 modos */}
      <button type="button" onClick={() => { setSugerido(null); setPaso('q1') }}
        className="w-full flex items-center gap-2.5 rounded-[12px] p-3 mb-3 transition-all active:scale-[0.99]"
        style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', border: '1px dashed color-mix(in srgb, var(--color-accent) 45%, transparent)' }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--color-accent)', color: '#111' }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 17h.008M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div className="text-left">
          <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>¿No sabes cuál usar?</p>
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Respóndeme 2 preguntas y te digo cuál</p>
        </div>
      </button>

      <div className="space-y-2">
        {visibles.map(renderModo)}
      </div>

      {hayAvanzadosOcultos && (
        <button type="button" onClick={() => setVerAvanzados(true)}
          className="w-full mt-2 h-9 rounded-[10px] text-[12px] font-semibold" style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
          Ver modos avanzados ▾
        </button>
      )}
    </div>
  )
}
