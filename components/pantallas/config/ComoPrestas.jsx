'use client'

// components/pantallas/config/ComoPrestas.jsx — «Cómo prestas por defecto».
//
// REHECHO MIRANDO LA LÁMINA (scripts/ver-diseno.mjs "01 · Configuración").
// Mi primera versión la construí leyendo el texto del handoff y salió otra cosa:
// los cuatro campos en rejilla en vez de en UNA FILA, los días sin cobro como
// chips en vez de desplegable, la nota debajo del título en vez de a su derecha,
// y un botón «Guardar» que en el diseño NO EXISTE.
//
// Que no haya botón no es un descuido del diseño: son cuatro ajustes que no
// crean nada ni tocan dinero. Pedir «Guardar» para elegir «Diario» es un paso de
// más, y además deja la duda de si se guardó o no. Se guarda al cambiar.
//
// La advertencia sí es literal y va en la pantalla, no en un tooltip:
//   «Estos valores llenan el formulario de nuevo préstamo. Cambiarlos aquí no
//    toca los préstamos que ya existen.»
// Sin ella, quien baja la tasa del 20% al 15% cree que le acaba de rebajar la
// deuda a toda su cartera.

import { useCallback, useEffect, useRef, useState } from 'react'
import { soloDecimal } from '@/lib/i18n'

const FRECUENCIAS = [
  { valor: '', nombre: 'Sin preferencia' },
  { valor: 'diario', nombre: 'Diario' },
  { valor: 'semanal', nombre: 'Semanal' },
  { valor: 'quincenal', nombre: 'Quincenal' },
  { valor: 'mensual', nombre: 'Mensual' },
]

// Los mismos nombres que la lista de préstamos. Si aquí se llamaran distinto, el
// mismo préstamo tendría dos nombres según dónde se mire.
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

// Un solo día, como en el diseño («Domingos»). El domingo es el que usa
// prácticamente todo el gota a gota; los demás están por si acaso.
const DIAS = [
  { valor: '', nombre: 'Ninguno' },
  { valor: 'domingo', nombre: 'Domingos' },
  { valor: 'sabado', nombre: 'Sábados' },
  { valor: 'lunes', nombre: 'Lunes' },
  { valor: 'martes', nombre: 'Martes' },
  { valor: 'miercoles', nombre: 'Miércoles' },
  { valor: 'jueves', nombre: 'Jueves' },
  { valor: 'viernes', nombre: 'Viernes' },
]

const ROTULO = {
  display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
  textTransform: 'uppercase', color: 'var(--cf-ink-3)', marginBottom: 6,
}

const CONTROL = {
  height: 46, padding: '0 13px', borderRadius: 'var(--cf-r-control)',
  background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
  outline: 'none', fontSize: 15, color: 'var(--cf-ink)', width: '100%',
}

export default function ComoPrestas({ inicial = {}, onGuardar }) {
  const [frecuencia, setFrecuencia] = useState(inicial.frecuenciaDefault ?? '')
  const [tasa, setTasa] = useState(inicial.tasaDefault == null ? '' : String(inicial.tasaDefault))
  const [modo, setModo] = useState(inicial.modoInteresDefault ?? '')
  const [dia, setDia] = useState(() => {
    try { return (JSON.parse(inicial.diasSinCobro || '[]')[0]) ?? '' } catch { return '' }
  })
  const [estado, setEstado] = useState(null)   // 'guardando' | 'guardado' | mensaje de error
  const primera = useRef(true)
  const temporizador = useRef(null)

  const guardar = useCallback(async (campos) => {
    setEstado('guardando')
    try {
      const res = await fetch('/api/configuracion/organizacion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setEstado(data.error ?? 'No se pudo guardar'); return }
      setEstado('guardado')
      onGuardar?.(data.org)
    } catch {
      setEstado('Error de conexión')
    }
  }, [onGuardar])

  // Se guarda al cambiar, con medio segundo de espera: sin él, escribir «20» en
  // la tasa dispara dos guardados —uno por el «2»—, y el primero deja un valor
  // que el usuario nunca quiso.
  useEffect(() => {
    if (primera.current) { primera.current = false; return }
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => {
      guardar({
        // Vacío se manda como null: es «quítamelo», no «no lo cambies».
        frecuenciaDefault: frecuencia || null,
        modoInteresDefault: modo || null,
        tasaDefault: String(tasa).trim() === '' ? null : Number(String(tasa).replace(',', '.')),
        diasSinCobro: JSON.stringify(dia ? [dia] : []),
      })
    }, 500)
    return () => clearTimeout(temporizador.current)
  }, [frecuencia, tasa, modo, dia, guardar])

  // El «guardado» se retira solo: un aviso que se queda para siempre deja de
  // significar «acabas de guardar».
  useEffect(() => {
    if (estado !== 'guardado') return
    const t = setTimeout(() => setEstado(null), 2400)
    return () => clearTimeout(t)
  }, [estado])

  const problema = estado && estado !== 'guardando' && estado !== 'guardado'

  return (
    <section style={{
      padding: '20px 22px', borderRadius: 'var(--cf-r-card)',
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
    }}>
      {/* El título y la nota EN LA MISMA LÍNEA, como en la lámina. */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 14, flexWrap: 'wrap', marginBottom: 15,
      }}>
        <span style={{ ...ROTULO, marginBottom: 0 }}>Cómo prestas por defecto</span>
        <span style={{ fontSize: 12.5, color: 'var(--cf-ink-3)' }}>
          {estado === 'guardando' ? 'Guardando…'
            : estado === 'guardado' ? <span style={{ color: 'var(--cf-green-dark)', fontWeight: 700 }}>Guardado</span>
            : problema ? <span style={{ color: 'var(--cf-red-darker)', fontWeight: 700 }}>{estado}</span>
            : 'Se puede cambiar en cada préstamo'}
        </span>
      </div>

      {/* LOS CUATRO EN UNA FILA. En móvil bajan solos. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        <label>
          <span style={ROTULO}>Frecuencia</span>
          <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)} style={CONTROL}>
            {FRECUENCIAS.map((f) => <option key={f.valor} value={f.valor}>{f.nombre}</option>)}
          </select>
        </label>

        <label>
          <span style={ROTULO}>Tasa</span>
          <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              // type=text + inputMode, no type=number: type=number rechaza el
              // separador que no coincide con el idioma del teléfono y el campo
              // se queda vacío sin decir por qué.
              type="text"
              inputMode="decimal"
              value={tasa}
              onChange={(e) => setTasa(soloDecimal(e.target.value))}
              placeholder="—"
              style={{ ...CONTROL, paddingRight: 32 }}
            />
            <span style={{ position: 'absolute', right: 13, fontSize: 14, color: 'var(--cf-ink-3)' }}>%</span>
          </span>
        </label>

        <label>
          <span style={ROTULO}>Modo de interés</span>
          <select value={modo} onChange={(e) => setModo(e.target.value)} style={CONTROL}>
            {MODOS.map((m) => <option key={m.valor} value={m.valor}>{m.nombre}</option>)}
          </select>
        </label>

        <label>
          <span style={ROTULO}>Días sin cobro</span>
          <select value={dia} onChange={(e) => setDia(e.target.value)} style={CONTROL}>
            {DIAS.map((d) => <option key={d.valor} value={d.valor}>{d.nombre}</option>)}
          </select>
        </label>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--cf-ink-3)', margin: '15px 0 0', lineHeight: 1.5 }}>
        Estos valores llenan el formulario de nuevo préstamo. Cambiarlos aquí{' '}
        <strong style={{ color: 'var(--cf-ink-2)', fontWeight: 700 }}>no toca los préstamos que ya existen</strong>.
      </p>
    </section>
  )
}
