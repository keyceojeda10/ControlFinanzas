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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatMoney, soloDecimal } from '@/lib/i18n'
import { calcularPrestamo } from '@/lib/calculos'

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

// ── EL BLOQUE NEGRO (T38-01) ──
//
// La lámina dice para qué existe, y es la razón entera de la pantalla ancha:
// «Nadie sabe qué significa "20% al mes, cuota fija" hasta que ve la cuota, y
// hoy hay que salir a crear un préstamo de prueba para averiguarlo.»
//
// La cuota NO se calcula aquí. Se pide a `calcularPrestamo`, la misma función
// que usa el formulario de nuevo préstamo, porque un ejemplo que no coincida
// con lo que luego sale al crear el préstamo es peor que no enseñar nada.
// Esa función ya sabe que la tasa tiene tres semánticas según el modo.
const MONTO_EJEMPLO = 500000

// Cuántos cobros dura el ejemplo en cada frecuencia. Son plazos corrientes, no
// una regla del sistema: se dicen en voz alta debajo para que nadie los tome
// por un valor que él haya configurado.
const PLAZO_EJEMPLO = {
  diario:    { cobros: 30, dias: 30,  cada: 'al día' },
  semanal:   { cobros: 12, dias: 84,  cada: 'a la semana' },
  quincenal: { cobros: 8,  dias: 120, cada: 'cada quince días' },
  mensual:   { cobros: 6,  dias: 180, cada: 'al mes' },
}

function Ejemplo({ frecuencia, tasa, modo, pais }) {
  const plazo = PLAZO_EJEMPLO[frecuencia]
  const tasaNum = Number(String(tasa).replace(',', '.'))

  const calc = useMemo(() => {
    if (!plazo || !modo || !(tasaNum > 0)) return null
    try {
      return calcularPrestamo({
        montoPrestado: MONTO_EJEMPLO,
        tasaInteres: tasaNum,
        diasPlazo: plazo.dias,
        fechaInicio: new Date(),
        frecuencia,
        modoInteres: modo,
      })
    } catch {
      // Un ejemplo que revienta no puede tumbar la configuración entera.
      return null
    }
  }, [plazo, modo, tasaNum, frecuencia])

  // Sin los tres datos no hay ejemplo que enseñar, y un cero inventado sería
  // peor: aquí se viene precisamente a ver la cifra.
  if (!calc) {
    return (
      <div style={{
        marginTop: 16, padding: '14px 16px', borderRadius: 'var(--cf-r-card)',
        background: 'var(--cf-surface)', border: '1px dashed var(--cf-border)',
        fontSize: 12.5, color: 'var(--cf-ink-3)', lineHeight: 1.5,
      }}>
        Elige frecuencia, tasa y modo de interés y aquí verás en cuánto quedaría
        un préstamo de {formatMoney(MONTO_EJEMPLO, pais)}.
      </div>
    )
  }

  const total = calc.totalAPagar
  const ganancia = calc.totalInteres
  const cobros = calc.numPeriodos ?? plazo.cobros
  const pctCapital = Math.max(0, Math.min(100, (MONTO_EJEMPLO / total) * 100))

  return (
    <div style={{
      marginTop: 16, padding: '18px 20px', borderRadius: 'var(--cf-r-card)',
      background: 'var(--cf-ink)', color: 'var(--cf-card)',
    }}>
      <p style={{ margin: 0, fontSize: 12.5, opacity: 0.72 }}>
        Un préstamo de {formatMoney(MONTO_EJEMPLO, pais)} quedaría
      </p>
      <p className="cf-fig" style={{
        margin: '4px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: '-.02em',
        color: 'var(--cf-gold)',
      }}>
        {formatMoney(calc.cuotaDiaria, pais)} {plazo.cada}
      </p>
      <p style={{ margin: '5px 0 0', fontSize: 12.5, opacity: 0.72 }}>
        {cobros} cobros · devuelve <span className="cf-fig">{formatMoney(total, pais)}</span>
        {' '}· ganas <span className="cf-fig">{formatMoney(ganancia, pais)}</span>
      </p>

      {/* El reparto capital/ganancia. Una barra dice de un vistazo qué parte de
          lo que vuelve es plata que ya era suya y qué parte es lo que gana. */}
      <div style={{
        display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden',
        marginTop: 14, background: 'color-mix(in srgb, var(--cf-card) 18%, transparent)',
      }}>
        <div style={{ width: `${pctCapital}%`, background: 'color-mix(in srgb, var(--cf-card) 55%, transparent)', flex: 'none' }} />
        <div style={{ width: `${100 - pctCapital}%`, background: 'var(--cf-gold)', flex: 'none' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 11, opacity: 0.72 }}>
        <span>tu capital vuelve</span>
        <span>tu ganancia</span>
      </div>

      <p style={{ margin: '12px 0 0', fontSize: 11, opacity: 0.55, lineHeight: 1.45 }}>
        Ejemplo a {plazo.cobros} cobros. El plazo lo eliges en cada préstamo.
      </p>
    </div>
  )
}

export default function ComoPrestas({ inicial = {}, onGuardar, pais }) {
  const [frecuencia, setFrecuencia] = useState(inicial.frecuenciaDefault ?? '')
  const [tasa, setTasa] = useState(inicial.tasaDefault == null ? '' : String(inicial.tasaDefault))
  const [modo, setModo] = useState(inicial.modoInteresDefault ?? '')
  const [dia, setDia] = useState(() => {
    try { return (JSON.parse(inicial.diasSinCobro || '[]')[0]) ?? '' } catch { return '' }
  })
  const [estado, setEstado] = useState(null)   // 'guardando' | 'guardado' | mensaje de error
  // La firma de lo que ya está guardado. Se siembra con lo que llegó, para que
  // el primer efecto no vea diferencia y no dispare nada.
  const ultimo = useRef(JSON.stringify({
    frecuenciaDefault: (inicial.frecuenciaDefault ?? '') || null,
    modoInteresDefault: (inicial.modoInteresDefault ?? '') || null,
    tasaDefault: inicial.tasaDefault == null || String(inicial.tasaDefault).trim() === ''
      ? null
      : Number(String(inicial.tasaDefault).replace(',', '.')),
    diasSinCobro: JSON.stringify((() => {
      try { const d = JSON.parse(inicial.diasSinCobro || '[]')[0]; return d ? [d] : [] } catch { return [] }
    })()),
  }))
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
  // ── SE COMPARA CONTRA LO ÚLTIMO GUARDADO, NO CONTRA «¿ES LA PRIMERA VEZ?» ──
  //
  // La guarda anterior era `primera.current`, y aquí llegó a BORRAR la
  // configuración: React monta dos veces en desarrollo, el primer pase se come
  // la guarda y el segundo se cree una edición del usuario. Como el componente
  // se sembraba en vacío —los datos aún no habían llegado—, lo que salía era un
  // PATCH con los cuatro campos a null. Medido: la organización pasó de
  // «diario · 20% · fijo» a null SOLO POR ABRIR LA PANTALLA.
  //
  // Y en producción, donde no hay doble montaje, la otra cara del mismo fallo:
  // no se borraba solo, pero la pantalla enseñaba «Sin preferencia» para
  // siempre, y en cuanto se tocaba UN campo se guardaba esa pantalla vacía
  // encima de lo que sí había. Peor que no guardar, porque no se nota.
  //
  // Comparando el contenido no hay forma de que un montaje cuente como edición.
  useEffect(() => {
    const campos = {
      // Vacío se manda como null: es «quítamelo», no «no lo cambies».
      frecuenciaDefault: frecuencia || null,
      modoInteresDefault: modo || null,
      tasaDefault: String(tasa).trim() === '' ? null : Number(String(tasa).replace(',', '.')),
      diasSinCobro: JSON.stringify(dia ? [dia] : []),
    }
    const firma = JSON.stringify(campos)
    if (firma === ultimo.current) return
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => { ultimo.current = firma; guardar(campos) }, 500)
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

      <Ejemplo frecuencia={frecuencia} tasa={tasa} modo={modo} pais={pais} />
    </section>
  )
}
