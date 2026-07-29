'use client'

// components/pantallas/config/ComoPrestas.jsx — «Cómo prestas por defecto».
//
// Lo que PRELLENA el formulario de nuevo préstamo. Y la advertencia del diseño
// no es letra pequeña, es la frase que evita un susto:
//
//   «Estos valores llenan el formulario de nuevo préstamo. Cambiarlos aquí NO
//    TOCA los préstamos que ya existen.»
//
// Sin ella, alguien que baja la tasa del 20% al 15% se queda pensando que le
// acaba de rebajar la deuda a toda su cartera. Va en la pantalla, no en un
// tooltip.
//
// Los cuatro campos pueden quedar VACÍOS, y vacío no es un error: significa
// «no tengo una forma fija de prestar» y el formulario usa lo suyo de siempre.

import { useEffect, useState } from 'react'
import { soloDecimal } from '@/lib/i18n'

const FRECUENCIAS = [
  { valor: '', nombre: 'Sin preferencia' },
  { valor: 'diario', nombre: 'Diario' },
  { valor: 'semanal', nombre: 'Semanal' },
  { valor: 'quincenal', nombre: 'Quincenal' },
  { valor: 'mensual', nombre: 'Mensual' },
]

// Los nombres que ya usa la app en la lista de préstamos. Si aquí se llamaran
// distinto, el mismo préstamo tendría dos nombres según dónde se mire.
const MODOS = [
  { valor: '', nombre: 'Sin preferencia' },
  { valor: 'fijo', nombre: 'Cuota fija' },
  { valor: 'unico', nombre: 'De una vez' },
  { valor: 'solo_interes', nombre: 'Globo' },
  { valor: 'saldo', nombre: 'Sobre saldo' },
  { valor: 'lineal', nombre: 'Decreciente' },
  { valor: 'lineal_dinamico', nombre: 'Dinámico' },
  { valor: 'manual', nombre: 'Manual' },
]

const DIAS = [
  { valor: 'domingo', nombre: 'Domingos' },
  { valor: 'sabado', nombre: 'Sábados' },
  { valor: 'lunes', nombre: 'Lunes' },
  { valor: 'martes', nombre: 'Martes' },
  { valor: 'miercoles', nombre: 'Miércoles' },
  { valor: 'jueves', nombre: 'Jueves' },
  { valor: 'viernes', nombre: 'Viernes' },
]

function Campo({ etiqueta, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cf-ink-2)' }}>{etiqueta}</span>
      {children}
    </label>
  )
}

const control = {
  height: 'var(--cf-h-field)', padding: '0 13px', borderRadius: 'var(--cf-r-control)',
  background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
  outline: 'none', fontSize: 16, color: 'var(--cf-ink)', width: '100%',
}

export default function ComoPrestas({ inicial = {}, onGuardado }) {
  const [frecuencia, setFrecuencia] = useState(inicial.frecuenciaDefault ?? '')
  const [tasa, setTasa] = useState(inicial.tasaDefault == null ? '' : String(inicial.tasaDefault))
  const [modo, setModo] = useState(inicial.modoInteresDefault ?? '')
  const [dias, setDias] = useState(() => {
    try { return JSON.parse(inicial.diasSinCobro || '[]') } catch { return [] }
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)

  // El «guardado» se retira solo. Un aviso de éxito que se queda para siempre
  // deja de significar «acabas de guardar».
  useEffect(() => {
    if (!listo) return
    const t = setTimeout(() => setListo(false), 2600)
    return () => clearTimeout(t)
  }, [listo])

  const alternarDia = (d) => {
    setDias((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))
    setListo(false)
  }

  const guardar = async () => {
    setGuardando(true)
    setError('')
    try {
      const res = await fetch('/api/configuracion/organizacion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Vacío se manda como null: es «quítamelo», no «no lo cambies».
          frecuenciaDefault: frecuencia || null,
          modoInteresDefault: modo || null,
          tasaDefault: tasa.trim() === '' ? null : Number(String(tasa).replace(',', '.')),
          diasSinCobro: JSON.stringify(dias),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'No se pudo guardar'); return }
      setListo(true)
      onGuardado?.(data.org)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={{
      padding: '20px 21px', borderRadius: 'var(--cf-r-card)',
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      display: 'flex', flexDirection: 'column', gap: 17,
    }}>
      <div>
        <h2 style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 18, fontWeight: 600, letterSpacing: '-.02em',
          color: 'var(--cf-ink)', margin: 0,
        }}>
          Cómo prestas por defecto
        </h2>
        <p style={{ fontSize: 12.5, color: 'var(--cf-ink-3)', margin: '3px 0 0' }}>
          Se puede cambiar en cada préstamo
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 13 }}>
        <Campo etiqueta="Frecuencia">
          <select value={frecuencia} onChange={(e) => { setFrecuencia(e.target.value); setListo(false) }} style={control}>
            {FRECUENCIAS.map((f) => <option key={f.valor} value={f.valor}>{f.nombre}</option>)}
          </select>
        </Campo>

        <Campo etiqueta="Tasa">
          <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              // type=text con inputMode: <input type=number> rechaza el separador
              // que no coincide con el idioma del teléfono y el campo se queda
              // vacío sin decir por qué.
              type="text"
              inputMode="decimal"
              value={tasa}
              onChange={(e) => { setTasa(soloDecimal ? soloDecimal(e.target.value) : e.target.value); setListo(false) }}
              placeholder="—"
              style={{ ...control, paddingRight: 34 }}
            />
            <span style={{ position: 'absolute', right: 13, fontSize: 14, color: 'var(--cf-ink-3)' }}>%</span>
          </span>
        </Campo>

        <Campo etiqueta="Modo de interés">
          <select value={modo} onChange={(e) => { setModo(e.target.value); setListo(false) }} style={control}>
            {MODOS.map((m) => <option key={m.valor} value={m.valor}>{m.nombre}</option>)}
          </select>
        </Campo>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cf-ink-2)' }}>Días sin cobro</span>
        <div style={{ display: 'flex', gap: 'var(--cf-gap-chips)', flexWrap: 'wrap' }}>
          {DIAS.map((d) => {
            const puesto = dias.includes(d.valor)
            return (
              <button key={d.valor} type="button" onClick={() => alternarDia(d.valor)} style={{
                height: 38, padding: '0 14px', borderRadius: 999, cursor: 'pointer',
                fontSize: 13.5, fontWeight: puesto ? 700 : 600,
                background: puesto ? 'var(--cf-ink)' : 'var(--cf-surface)',
                color: puesto ? 'var(--cf-card)' : 'var(--cf-ink-2)',
                border: `1px solid ${puesto ? 'var(--cf-ink)' : 'var(--cf-border)'}`,
              }}>
                {d.nombre}
              </button>
            )
          })}
        </div>
      </div>

      {/* LA FRASE QUE EVITA EL SUSTO. Va en la pantalla, no en un tooltip: quien
          baja la tasa del 20% al 15% necesita saber AHÍ que no le acaba de
          rebajar la deuda a toda su cartera. */}
      <p style={{ fontSize: 12.5, color: 'var(--cf-ink-3)', margin: 0, lineHeight: 1.5 }}>
        Estos valores llenan el formulario de nuevo préstamo. Cambiarlos aquí{' '}
        <strong style={{ color: 'var(--cf-ink-2)' }}>no toca los préstamos que ya existen</strong>.
      </p>

      {error && <p style={{ fontSize: 13, color: 'var(--cf-red-darker)', margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <button type="button" onClick={guardar} disabled={guardando} style={{
          height: 'var(--cf-h-btn-2)', padding: '0 20px', border: 0,
          borderRadius: 'var(--cf-r-control)', cursor: guardando ? 'default' : 'pointer',
          background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
          fontSize: 14.5, fontWeight: 700, opacity: guardando ? 0.6 : 1,
        }}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        {listo && (
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cf-green-dark)' }}>Guardado</span>
        )}
      </div>
    </div>
  )
}
