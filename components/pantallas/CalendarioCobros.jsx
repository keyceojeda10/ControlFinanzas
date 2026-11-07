'use client'
/* ══ EL CALENDARIO DE COBROS ════════════════════════════════════════════════
 *
 * «Un calendario visual donde la gente pudiera ver qué día le toca a qué persona…
 *  si salen varios punticos que son varias personas, le pica y le sale en orden
 *  los cobros que tiene ese día, como para fijarse en un calendario real» — el
 *  dueño, 6 nov 2026. «Solo lo que viene, y para planes a partir de Básico puedan
 *  ver lo anterior.» Va en «Más»: no todo el mundo usa «Cobrar hoy».
 *
 * Un punto por persona (hasta cuatro; con más, el número). Debajo, lo que suma el
 * día. Al tocarlo, la lista en el orden de la ruta. En PC caben los nombres.
 *
 * ⚠ Las cifras salen de `/api/calendario` → `armarCalendario`, que usa el mismo
 *   calendario que «Cobrar hoy» y, para hoy, su misma cuenta. Aquí no se calcula
 *   ninguna fecha.
 *
 * El color va en el punto, nunca en el fondo de la celda (DESIGN §4): verde lo
 * cobrado, rojo lo que tocaba y no se pagó, gris lo que viene. Nada dorado: no hay
 * una cifra principal que brille, la respuesta es el calendario.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import HojaInferior from '@/components/cf/HojaInferior'
import { Tarjeta, Chip, Pastilla } from '@/components/cf/primitivos'

const SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DIA_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MAX_PUNTOS = 4

const fecha = (iso) => new Date(`${iso}T05:00:00.000Z`)
const nombreMes = (mes) => { const [y, m] = mes.split('-').map(Number); return `${MESES[m - 1][0].toUpperCase()}${MESES[m - 1].slice(1)} ${y}` }
const otroMes = (mes, k) => { const [y, m] = mes.split('-').map(Number); const f = new Date(Date.UTC(y, m - 1 + k, 1)); return f.toISOString().slice(0, 7) }
const diaLargo = (iso) => { const f = fecha(iso); return `${DIA_LARGO[f.getUTCDay()]} ${f.getUTCDate()} de ${MESES[f.getUTCMonth()]}` }

/** «$560k», «$1,2M»: lo que cabe en una celda de 52px. */
function corto(n) {
  const v = Math.round(Number(n) || 0)
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1).replace(/\.0$/, '').replace('.', ',')}M`
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`
  return `$${v}`
}

const ESTADO = {
  cobrado:   { tono: 'aldia', texto: 'Cobrado', punto: 'var(--cf-green)' },
  sin_pagar: { tono: 'mora', texto: 'No pagó', punto: 'var(--cf-red)' },
  pendiente: { tono: 'neutro', texto: 'Pendiente', punto: 'var(--cf-ink-3)' },
  programado: { tono: null, texto: null, punto: 'var(--cf-ink-3)' },
}

function Puntos({ d }) {
  if (!d?.n) return <span style={{ height: 6 }} />
  /* Con más de cuatro, el número; y debajo una barrita partida para que el verde
     y el rojo no se pierdan (un día pasado de 17 cobros con 3 que no pagaron). */
  if (d.n > MAX_PUNTOS) {
    const pc = (x) => `${(100 * (x || 0)) / d.n}%`
    const hayEstado = d.nCobrado || d.nSinPagar
    return (
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <span className="cf-num" style={{ fontSize: 10, fontWeight: 700, color: 'inherit', opacity: 0.8, lineHeight: '10px' }}>{d.n}</span>
        {hayEstado ? (
          <span aria-hidden style={{ display: 'flex', width: 28, height: 3, borderRadius: 2, overflow: 'hidden', background: ESTADO.programado.punto }}>
            <span style={{ width: pc(d.nCobrado), background: ESTADO.cobrado.punto }} />
            <span style={{ width: pc(d.nSinPagar), background: ESTADO.sin_pagar.punto }} />
          </span>
        ) : null}
      </span>
    )
  }
  const colores = [
    ...Array(d.nCobrado || 0).fill(ESTADO.cobrado.punto),
    ...Array(d.nSinPagar || 0).fill(ESTADO.sin_pagar.punto),
  ]
  while (colores.length < d.n) colores.push(ESTADO.programado.punto)
  return (
    <span aria-hidden style={{ display: 'flex', gap: 3, justifyContent: 'center', height: 6 }}>
      {colores.map((c, i) => <span key={i} style={{ width: 6, height: 6, borderRadius: 3, background: c }} />)}
    </span>
  )
}

function Celda({ iso, d, hoy, bloqueado, elegido, onElegir, formatMoney }) {
  const n = fecha(iso).getUTCDate()
  const esHoy = iso === hoy
  const pasado = iso < hoy
  const vacio = !d?.n
  // En un día que ya pasó, la cifra es lo que se COBRÓ; lo que tocaba y no se
  // pagó va aparte, con su nombre (una cifra que suma las dos no dice nada).
  const cifra = pasado ? d?.cobrado ?? 0 : d?.total ?? 0
  const etiqueta = `${diaLargo(iso)}${esHoy ? ', hoy' : ''}: ${vacio ? 'sin cobros'
    : pasado ? `cobrado ${formatMoney(d.cobrado)}${d.nSinPagar ? `, ${d.nSinPagar} no ${d.nSinPagar === 1 ? 'pagó' : 'pagaron'}` : ''}`
    : `${d.n} ${d.n === 1 ? 'cobro' : 'cobros'} por ${formatMoney(d.total)}`}`
  return (
    <button type="button" disabled={bloqueado || vacio} onClick={() => onElegir(iso)}
      aria-label={etiqueta} aria-pressed={elegido}
      className="cf-pulsa"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        minHeight: 64, padding: '7px 2px 6px', minWidth: 0,
        borderRadius: 'var(--cf-r-control)',
        border: esHoy && !elegido ? '1.5px solid var(--cf-ink)' : '1px solid transparent',
        background: elegido ? 'var(--cf-ink)' : 'transparent',
        color: elegido ? 'var(--cf-surface)' : bloqueado ? 'var(--cf-ink-4, var(--cf-ink-3))' : 'var(--cf-ink)',
        opacity: bloqueado ? 0.45 : 1,
        cursor: bloqueado || vacio ? 'default' : 'pointer',
      }}>
      <span className="cf-num" style={{ fontSize: 13, fontWeight: esHoy ? 800 : 600 }}>{n}</span>
      {!bloqueado && <Puntos d={d} />}
      {!bloqueado && !vacio && (
        <span className="cf-num" style={{ fontSize: 10, fontWeight: 600, color: elegido ? 'var(--cf-surface)' : 'var(--cf-ink-3)' }}>{corto(cifra)}</span>
      )}
      {/* En PC caben los nombres: el «calendario real» que pidió el dueño. */}
      {!bloqueado && !vacio && (
        <span className="hidden lg:flex" style={{ flexDirection: 'column', gap: 1, width: '100%', padding: '0 4px', textAlign: 'left' }}>
          {d.nombres.map((x) => (
            <span key={x} style={{ fontSize: 11, lineHeight: '14px', color: elegido ? 'var(--cf-surface)' : 'var(--cf-ink-2)', overflowWrap: 'anywhere' }}>{x}</span>
          ))}
          {d.n > d.nombres.length && (
            <span style={{ fontSize: 11, lineHeight: '14px', color: elegido ? 'var(--cf-surface)' : 'var(--cf-ink-3)' }}>y {d.n - d.nombres.length} más</span>
          )}
        </span>
      )}
    </button>
  )
}

function ListaDelDia({ items, formatMoney, onIrCliente }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((x, i) => {
        const e = ESTADO[x.estado] ?? ESTADO.programado
        const ruta = x.ruta && (i === 0 || items[i - 1].ruta !== x.ruta)
        return (
          <div key={`${x.prestamoId}-${i}`}>
            {ruta && (
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)', padding: i === 0 ? '2px 2px 8px' : '14px 2px 8px' }}>{x.ruta}</div>
            )}
            <button type="button" onClick={() => onIrCliente(x.clienteId)} className="cf-pulsa" style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56,
              padding: '10px 2px', background: 'none', border: 0, textAlign: 'left', cursor: 'pointer',
              borderTop: i === 0 || ruta ? 0 : '1px solid var(--cf-hairline)',
            }}>
              <span className="cf-num" style={{ flex: 'none', width: 22, fontSize: 12, fontWeight: 700, color: 'var(--cf-ink-3)' }}>{i + 1}</span>
              {/* El nombre no se recorta: baja de renglón (DESIGN, «lo que identifica»). */}
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)', overflowWrap: 'anywhere' }}>{x.nombre}</span>
              <span style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span className="cf-num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>{formatMoney(x.monto)}</span>
                {e.texto && <Pastilla tono={e.tono}>{e.texto}</Pastilla>}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

/** Lo que dice la hoja: en un día pasado, lo cobrado y lo que no se pagó, cada uno
 *  con su nombre; hoy y lo que viene, cuántos cobros y por cuánto. */
function subtituloDelDia(d, pasado, formatMoney) {
  if (pasado) {
    const no = d.nSinPagar ? ` · ${d.nSinPagar} no ${d.nSinPagar === 1 ? 'pagó' : 'pagaron'}: ${formatMoney(d.sinPagar)}` : ''
    return `Cobrado ${formatMoney(d.cobrado)}${no}`
  }
  const base = `${d.n} ${d.n === 1 ? 'cobro' : 'cobros'} · ${formatMoney(d.total)}`
  return d.cobrado ? `${base} · ya cobrado ${formatMoney(d.cobrado)}` : base
}

export default function CalendarioCobros({ formatMoney, esCobrador, onIrCliente, onVerPlanes }) {
  // El mes de hoy en Bogotá; el servidor lo corrige si el país es otro.
  const [mes, setMes] = useState(() => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 7))
  const [rutaId, setRutaId] = useState('')
  const [datos, setDatos] = useState(null)
  const [fallo, setFallo] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [elegido, setElegido] = useState(null)
  const [lista, setLista] = useState(null)
  const [falloLista, setFalloLista] = useState(false)

  const consulta = useCallback((extra = {}) => {
    const q = new URLSearchParams()
    if (mes) q.set('mes', mes)
    if (rutaId) q.set('rutaId', rutaId)
    for (const [k, v] of Object.entries(extra)) q.set(k, v)
    return `/api/calendario?${q}`
  }, [mes, rutaId])

  const traer = useCallback(async () => {
    setCargando(true)
    try {
      const r = await fetch(consulta())
      if (!r.ok) { setFallo(true); return }
      const d = await r.json()
      setDatos(d); setFallo(false)
    } catch { setFallo(true) } finally { setCargando(false) }
  }, [consulta])

  useEffect(() => { traer() }, [traer])

  const abrir = useCallback(async (iso) => {
    setElegido(iso); setLista(null); setFalloLista(false)
    try {
      const r = await fetch(consulta({ mes: iso.slice(0, 7), dia: iso }))
      if (!r.ok) { setFalloLista(true); return }
      const d = await r.json()
      setLista(d.dias?.[iso]?.items ?? [])
    } catch { setFalloLista(true) }
  }, [consulta])

  const celdas = useMemo(() => {
    if (!datos?.mes) return []
    const [y, m] = datos.mes.split('-').map(Number)
    const total = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const hueco = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
    return [...Array(hueco).fill(null), ...Array.from({ length: total }, (_, i) => `${datos.mes}-${String(i + 1).padStart(2, '0')}`)]
  }, [datos?.mes])

  const resumen = useMemo(() => {
    if (!datos?.dias) return null
    let n = 0, total = 0
    for (const [iso, d] of Object.entries(datos.dias)) {
      if (iso < datos.hoy) continue
      n += d.n; total += d.total
    }
    return { n, total }
  }, [datos])

  const mesActual = datos?.hoy?.slice(0, 7)
  const puedeAtras = datos && (datos.conPasado || datos.mes > mesActual)
  const puedeAdelante = datos && datos.mes < datos.tope
  const hayDiasBloqueados = datos && !datos.conPasado && datos.mes === mesActual && datos.hoy.slice(8) !== '01'
  const dElegido = elegido && datos?.dias?.[elegido]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)' }}>
      {/* El mes, con sus flechas. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" aria-label="Mes anterior" disabled={!puedeAtras} onClick={() => { setMes(otroMes(datos.mes, -1)); setElegido(null) }}
          className="cf-pulsa" style={{ width: 44, height: 44, borderRadius: 'var(--cf-r-control)', border: '1px solid var(--cf-border)', background: 'var(--cf-card)', color: 'var(--cf-ink)', opacity: puedeAtras ? 1 : 0.35, cursor: puedeAtras ? 'pointer' : 'default', display: 'grid', placeItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 700, color: 'var(--cf-ink)' }}>{datos?.mes ? nombreMes(datos.mes) : ' '}</span>
        <button type="button" aria-label="Mes siguiente" disabled={!puedeAdelante} onClick={() => { setMes(otroMes(datos.mes, 1)); setElegido(null) }}
          className="cf-pulsa" style={{ width: 44, height: 44, borderRadius: 'var(--cf-r-control)', border: '1px solid var(--cf-border)', background: 'var(--cf-card)', color: 'var(--cf-ink)', opacity: puedeAdelante ? 1 : 0.35, cursor: puedeAdelante ? 'pointer' : 'default', display: 'grid', placeItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {datos?.rutas?.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          <Chip activo={!rutaId} onClick={() => { setRutaId(''); setElegido(null) }}>Todas</Chip>
          {datos.rutas.map((r) => (
            <Chip key={r.id} activo={rutaId === r.id} onClick={() => { setRutaId(r.id); setElegido(null) }}>{r.nombre}</Chip>
          ))}
        </div>
      )}

      {fallo && !cargando && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 'var(--cf-r-control)', background: 'var(--cf-fill)', border: '1px solid var(--cf-border)' }}>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--cf-ink-2)' }}>No pudimos cargar el calendario.</span>
          <button type="button" onClick={traer} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)' }}>Reintentar</button>
        </div>
      )}

      <Tarjeta plana style={{ padding: '10px 8px 12px', opacity: cargando ? 0.6 : 1, transition: 'opacity .15s' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2 }}>
          {SEMANA.map((s, i) => (
            <span key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--cf-ink-3)', padding: '2px 0 6px' }}>{s}</span>
          ))}
          {celdas.map((iso, i) => iso === null
            ? <span key={`h${i}`} />
            : <Celda key={iso} iso={iso} d={datos.dias?.[iso]} hoy={datos.hoy}
                bloqueado={iso < datos.desde} elegido={iso === elegido}
                onElegir={abrir} formatMoney={formatMoney} />)}
        </div>
      </Tarjeta>

      {/* El cero es un dato: se dice, no se esconde. */}
      {resumen && datos.mes >= mesActual && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--cf-ink-2)', padding: '0 2px' }}>
          {resumen.n === 0
            ? `No hay cobros programados de aquí a fin de ${MESES[Number(datos.mes.slice(5)) - 1]}.`
            : <>De aquí a fin de {MESES[Number(datos.mes.slice(5)) - 1]}: <b className="cf-num">{resumen.n} {resumen.n === 1 ? 'cobro' : 'cobros'}</b> por <b className="cf-num">{formatMoney(resumen.total)}</b>.</>}
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: '0 2px', fontSize: 12, color: 'var(--cf-ink-3)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: ESTADO.programado.punto }} />Por cobrar</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: ESTADO.cobrado.punto }} />Cobrado</span>
        {datos?.conPasado && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: ESTADO.sin_pagar.punto }} />No pagó</span>}
        <span>Un punto por persona</span>
      </div>

      {hayDiasBloqueados && !esCobrador && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--cf-ink-2)', padding: '0 2px' }}>
          Los días que ya pasaron, con quién pagó y quién no, se ven desde el plan Básico.{' '}
          <button type="button" onClick={onVerPlanes} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontWeight: 700, color: 'var(--cf-gold-dark)' }}>Ver planes</button>
        </p>
      )}

      <HojaInferior abierta={!!elegido} onCerrar={() => setElegido(null)}
        titulo={elegido ? `${diaLargo(elegido)[0].toUpperCase()}${diaLargo(elegido).slice(1)}${elegido === datos?.hoy ? ' · hoy' : ''}` : ''}
        subtitulo={dElegido ? subtituloDelDia(dElegido, elegido < datos.hoy, formatMoney) : undefined}>
        {falloLista ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 2px' }}>
            <span style={{ flex: 1, fontSize: 14, color: 'var(--cf-ink-2)' }}>No pudimos traer la lista de ese día.</span>
            <button type="button" onClick={() => abrir(elegido)} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: 14, fontWeight: 700, color: 'var(--cf-gold-dark)' }}>Reintentar</button>
          </div>
        ) : lista === null ? (
          <p style={{ margin: 0, padding: '6px 2px', fontSize: 14, color: 'var(--cf-ink-3)' }}>Cargando…</p>
        ) : (
          <ListaDelDia items={lista} formatMoney={formatMoney} onIrCliente={onIrCliente} />
        )}
      </HojaInferior>
    </div>
  )
}
