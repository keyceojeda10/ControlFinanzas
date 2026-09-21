'use client'
// components/cf/ResumenDelDia.jsx — «TU RESUMEN DEL DÍA».
//
// El dueño, 20 sep 2026: «un pop-up grande que se abra a cierta hora que diga tu
// resumen del día y lo resuma bien bonito, detallado, con gráficos modernos, el
// texto súper entendible… letras grandes, conceptos entendibles, el dinero bien
// sacado… que la persona decida verlo o que le ponga si no ha terminado la
// jornada».
//
// Dos piezas:
//   · `AvisoResumen` — el pop-up que sale solo a la hora elegida: «Ver mi resumen»
//     o «Todavía no termino» (vuelve en una hora).
//   · `ResumenDelDia` — la pantalla: se lee de arriba abajo como una historia.
//     Lo que entró → de eso, cuánto es ganancia → lo que salió → la semana →
//     el equipo → cómo queda el negocio.
//
// NO CALCULA PLATA. Todo sale de `armarResumen()` (lib/resumen-del-dia.js), que a
// su vez lee la MISMA respuesta que el Inicio: no puede decir otra cifra.
//
// Carbón literal, como `BloqueOscuro` y `Procesando`: es oscura en los dos temas.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BLOQUE, BORDE_BLOQUE } from '@/components/cf/bloqueOscuro'
import { textoParaCompartir } from '@/lib/resumen-del-dia'
import SemanaDeCobros from '@/components/cf/SemanaDeCobros'

const VERDE = '#2FBE6A'
const menosMovimiento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Una cifra que sube de cero a su valor. Con «menos movimiento», aparece puesta. */
function Cuenta({ valor = 0, formatear, duracion = 900, espera = 0 }) {
  const [n, setN] = useState(menosMovimiento() ? valor : 0)
  const cuadro = useRef(0)
  useEffect(() => {
    if (menosMovimiento()) { setN(valor); return undefined }
    let inicio = null
    const t = setTimeout(() => {
      const paso = (ahora) => {
        if (inicio === null) inicio = ahora
        const k = Math.min(1, (ahora - inicio) / duracion)
        setN(Math.round(valor * (1 - Math.pow(1 - k, 4))))   // sale rápido, llega suave
        if (k < 1) cuadro.current = requestAnimationFrame(paso)
      }
      cuadro.current = requestAnimationFrame(paso)
    }, espera)
    return () => { clearTimeout(t); cancelAnimationFrame(cuadro.current) }
  }, [valor, duracion, espera])
  return <>{formatear(n)}</>
}

/** Una barra que crece hasta su porcentaje. */
function Barra({ pct = 0, color = BLOQUE.oro, alto = 12, espera = 0, fondo = BLOQUE.pista }) {
  const [ancho, setAncho] = useState(menosMovimiento() ? pct : 0)
  useEffect(() => {
    const t = setTimeout(() => setAncho(pct), 60 + espera)
    return () => clearTimeout(t)
  }, [pct, espera])
  return (
    <span style={{ display: 'block', height: alto, borderRadius: 999, background: fondo, overflow: 'hidden' }}>
      <span style={{
        display: 'block', height: alto, borderRadius: fondo === BLOQUE.pista ? 999 : 0, background: color,
        width: `${Math.max(0, Math.min(100, ancho))}%`,
        transition: 'width 1s cubic-bezier(.16,1,.3,1)',
      }} />
    </span>
  )
}

function Seccion({ rotulo, children, orden = 0 }) {
  return (
    <section className="cf-res-sec" style={{
      animationDelay: `${120 + orden * 110}ms`,
      background: 'rgba(255,255,255,.04)', border: BORDE_BLOQUE, borderRadius: 20,
      padding: '18px 18px 19px', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: BLOQUE.rotulo }}>{rotulo}</span>
      {children}
    </section>
  )
}

function Renglon({ etiqueta, nota, valor, color = BLOQUE.tinta }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: BLOQUE.tinta }}>{etiqueta}</span>
        {nota && <span style={{ fontSize: 13, color: BLOQUE.apagado, lineHeight: 1.4 }}>{nota}</span>}
      </span>
      <span className="cf-fig" style={{ fontSize: 19, letterSpacing: '-.02em', color, flex: 'none', whiteSpace: 'nowrap' }}>{valor}</span>
    </div>
  )
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

const CSS = `
@keyframes cf-res-entra { from { opacity: 0 } to { opacity: 1 } }
@keyframes cf-res-sube { from { opacity: 0; transform: translate3d(0, 18px, 0) } to { opacity: 1; transform: none } }
@keyframes cf-res-crece { from { transform: scaleY(0) } to { transform: scaleY(1) } }
.cf-res { animation: cf-res-entra .2s ease-out both; }
.cf-res-sec { animation: cf-res-sube .55s cubic-bezier(.16,1,.3,1) both; }
.cf-res-col { transform-origin: bottom; animation: cf-res-crece .8s cubic-bezier(.16,1,.3,1) both; }
@media (prefers-reduced-motion: reduce) { .cf-res, .cf-res-sec, .cf-res-col { animation: none; } }
`

/* ── PIEZAS QUE SE TOCAN ──────────────────────────────────────────────────────
   El dueño, tras ver la primera versión: «le falta más funcionalidad… uno le da a
   una barrita y no le dice cuánto cobró… que sea más interactivo, que dé los datos
   que se necesitan sin sobrecargar la pantalla». La regla de esta pantalla: arriba
   SIEMPRE la cifra grande; el detalle está a un toque, plegado. */

const Flecha = ({ abierta }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ transform: abierta ? 'rotate(90deg)' : 'none', transition: 'transform .25s cubic-bezier(.16,1,.3,1)', flex: 'none' }}>
    <path d="M9 6l6 6-6 6" />
  </svg>
)

/** Un renglón con su cifra que, si tiene detalle, se abre al tocarlo. */
function RenglonQueAbre({ etiqueta, nota, valor, color = BLOQUE.tinta, children, cuantos = 0 }) {
  const [abierto, setAbierto] = useState(false)
  const seAbre = cuantos > 0 && !!children
  const Caja = seAbre ? 'button' : 'div'
  return (
    <div>
      <Caja {...(seAbre ? { type: 'button', onClick: () => setAbierto((v) => !v), 'aria-expanded': abierto } : {})} style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, width: '100%', textAlign: 'left',
        background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: seAbre ? 'pointer' : 'default',
      }}>
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: BLOQUE.tinta }}>{etiqueta}</span>
          {nota && <span style={{ fontSize: 13, color: BLOQUE.apagado, lineHeight: 1.4 }}>{nota}</span>}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none', color: BLOQUE.apagado }}>
          <span className="cf-fig" style={{ fontSize: 19, letterSpacing: '-.02em', color, whiteSpace: 'nowrap' }}>{valor}</span>
          {seAbre && <Flecha abierta={abierto} />}
        </span>
      </Caja>
      {seAbre && abierto && <div className="cf-res-sec" style={{ marginTop: 12 }}>{children}</div>}
    </div>
  )
}

/** Una lista corta, con «ver todos» cuando es larga. */
function Lista({ filas, tope = 6, render }) {
  const [todas, setTodas] = useState(false)
  const visibles = todas ? filas : filas.slice(0, tope)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 14, overflow: 'hidden', border: `1px solid ${BLOQUE.linea}` }}>
      {visibles.map((f, i) => (
        <div key={f.id ?? f.clienteId ?? i} style={{ borderTop: i === 0 ? 0 : `1px solid ${BLOQUE.linea}` }}>{render(f)}</div>
      ))}
      {filas.length > tope && (
        <button type="button" onClick={() => setTodas((v) => !v)} style={{
          height: 44, border: 0, borderTop: `1px solid ${BLOQUE.linea}`, background: 'rgba(255,255,255,.03)', cursor: 'pointer',
          font: 'inherit', fontSize: 13, fontWeight: 700, color: BLOQUE.oro,
        }}>{todas ? 'Ver menos' : `Ver los ${filas.length}`}</button>
      )}
    </div>
  )
}

function FilaLista({ titulo, detalle, valor, colorValor = BLOQUE.tinta, onClick }) {
  const Caja = onClick ? 'button' : 'div'
  return (
    <Caja {...(onClick ? { type: 'button', onClick } : {})} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', minHeight: 54,
      padding: '9px 13px', textAlign: 'left', background: 'none', border: 0, font: 'inherit', color: 'inherit',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: BLOQUE.tinta, overflowWrap: 'anywhere' }}>{titulo}</span>
        {detalle && <span className="cf-num" style={{ fontSize: 12, color: BLOQUE.apagado }}>{detalle}</span>}
      </span>
      <span className="cf-fig" style={{ fontSize: 15, color: colorValor, flex: 'none', whiteSpace: 'nowrap' }}>{valor}</span>
    </Caja>
  )
}

/** Las dos cifras grandes de gente: se tocan y abren su lista debajo. */
function Azulejo({ rotulo, cifra, pie, color, activo, onClick, deshabilitado }) {
  return (
    <button type="button" onClick={onClick} disabled={deshabilitado} aria-pressed={activo} style={{
      flex: 1, minWidth: 0, textAlign: 'left', cursor: deshabilitado ? 'default' : 'pointer', font: 'inherit',
      display: 'flex', flexDirection: 'column', gap: 6, padding: '15px 15px 14px', borderRadius: 18,
      background: activo ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.04)',
      border: `1.5px solid ${activo ? color : 'rgba(255,255,255,.14)'}`, color: BLOQUE.tinta,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: BLOQUE.rotulo }}>{rotulo}</span>
      <span className="cf-fig" style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-.03em', color }}>{cifra}</span>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 13, color: BLOQUE.apagado }}>
        <span>{pie}</span>{!deshabilitado && <Flecha abierta={activo} />}
      </span>
    </button>
  )
}

const hora = (iso) => { try { return new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) } catch { return '' } }

/**
 * La pantalla entera.
 * @param r         lo que devuelve `armarResumen()`
 * @param formatear (n) → «$1.250.000»
 * @param fecha     «domingo, 20 de septiembre»
 * @param onIr      (href) → navega y cierra (a un préstamo, a un cliente)
 */
export function ResumenDelDia({ r, formatear, fecha, onCerrar, onIr }) {
  const [montado, setMontado] = useState(false)
  const [gente, setGente] = useState(null)               // 'pagaron' | 'faltan' | null
  const [compartido, setCompartido] = useState(false)
  useEffect(() => { setMontado(true) }, [])
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onCerrar?.() }
    window.addEventListener('keydown', tecla)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', tecla); document.body.style.overflow = antes }
  }, [onCerrar])
  if (!montado || !r) return null

  const hayReparto = r.interes != null && r.capitalDeVuelta != null && r.cobrado > 0
  const hayEquipo = r.cobradores.length > 1
  const topeEquipo = Math.max(...r.cobradores.map((c) => c.monto), 1)
  const salio = r.prestado + r.gastos
  const mesNombre = new Date().toLocaleDateString('es-CO', { month: 'long' })

  const compartir = async () => {
    const texto = textoParaCompartir(r, formatear, fecha)
    try {
      if (navigator.share) await navigator.share({ text: texto })
      else { await navigator.clipboard.writeText(texto); setCompartido(true); setTimeout(() => setCompartido(false), 2500) }
    } catch { /* canceló: no pasa nada */ }
  }

  return createPortal(
    <div className="cf-res" role="dialog" aria-modal="true" aria-label="Tu resumen del día" style={{
      position: 'fixed', inset: 0, zIndex: 10005, background: BLOQUE.fondo, color: BLOQUE.tinta,
      overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch',
    }}>
      <style>{CSS}</style>
      <div style={{
        maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14,
        padding: 'max(20px, env(safe-area-inset-top)) 18px max(28px, env(safe-area-inset-bottom))',
      }}>
        {/* ── Cabecera ── */}
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em', color: BLOQUE.oro }}>Tu resumen del día</span>
            <span style={{ fontSize: 13, color: BLOQUE.apagado }}>{fecha ? fecha.charAt(0).toUpperCase() + fecha.slice(1) : ''}</span>
          </span>
          <button type="button" onClick={onCerrar} aria-label="Cerrar el resumen" style={{
            width: 40, height: 40, borderRadius: 999, flex: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,.08)', border: 0, color: BLOQUE.tinta,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        {/* ── 1 · Lo que entró ── */}
        <section className="cf-res-sec" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '10px 2px 4px' }}>
          <h1 className="cf-fig" style={{ margin: 0, fontSize: 30, lineHeight: 1.1, letterSpacing: '-.03em', textWrap: 'balance', color: BLOQUE.tinta }}>
            {r.nombre ? `${r.nombre}, ${r.titular.charAt(0).toLowerCase()}${r.titular.slice(1)}` : r.titular}
          </h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: BLOQUE.rotulo }}>Hoy entraron</span>
            <span className="cf-fig" style={{ fontSize: 48, lineHeight: 1, letterSpacing: '-.04em', color: BLOQUE.oro, whiteSpace: 'nowrap' }}>
              <Cuenta valor={r.cobrado} formatear={formatear} duracion={1100} espera={150} />
            </span>
            <span style={{ fontSize: 14, color: BLOQUE.apagado }}>
              en {r.cobros} {r.cobros === 1 ? 'cobro' : 'cobros'}
              {r.vsAyer != null && (
                <> · <strong style={{ color: r.vsAyer >= 0 ? VERDE : BLOQUE.rojo, fontWeight: 700 }}>
                  {r.vsAyer >= 0 ? `${r.vsAyer}% más` : `${Math.abs(r.vsAyer)}% menos`}</strong> que ayer ({formatear(r.ayer)})</>
              )}
            </span>
          </div>
          {r.tocaba > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Barra pct={r.avance ?? 0} espera={350} />
              <span style={{ fontSize: 14, color: BLOQUE.tinta, lineHeight: 1.5 }}>
                Cobraste el <strong>{r.avance}%</strong> de los {formatear(r.tocaba)} que tocaba cobrar hoy
                {r.faltoPorCobrar > 0 ? <>. Quedaron <strong style={{ color: BLOQUE.oro }}>{formatear(r.faltoPorCobrar)}</strong> por cobrar.</> : '.'}
              </span>
            </div>
          )}
        </section>

        {/* ── 2 · La gente: quién pagó y quién no. Se tocan. ── */}
        <div className="cf-res-sec" style={{ display: 'flex', flexDirection: 'column', gap: 10, animationDelay: '200ms' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Azulejo
              rotulo="Te pagaron" cifra={String(r.pagos.length || r.cobros)} pie={r.pagos.length === 1 ? 'cobro · ver cuál' : 'cobros · ver cuáles'}
              color={VERDE} activo={gente === 'pagaron'} deshabilitado={r.pagos.length === 0}
              onClick={() => setGente(gente === 'pagaron' ? null : 'pagaron')}
            />
            <Azulejo
              rotulo="No pagaron" cifra={String(r.clientesSinCobrar)} pie={r.clientesSinCobrar === 0 ? 'de los que tocaban hoy' : 'les tocaba hoy · ver'}
              color={r.clientesSinCobrar > 0 ? BLOQUE.rojo : VERDE} activo={gente === 'faltan'} deshabilitado={r.sinCobrar.length === 0}
              onClick={() => setGente(gente === 'faltan' ? null : 'faltan')}
            />
          </div>
          {gente === 'pagaron' && (
            <div className="cf-res-sec">
              <Lista filas={r.pagos} render={(x) => (
                <FilaLista
                  titulo={x.cliente} valor={formatear(x.monto)} colorValor={VERDE}
                  detalle={[hora(x.hora), x.medio, x.cobrador].filter(Boolean).join(' · ')}
                  onClick={x.prestamoId && onIr ? () => onIr(`/prestamos/${x.prestamoId}`) : undefined}
                />
              )} />
            </div>
          )}
          {gente === 'faltan' && (
            <div className="cf-res-sec" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, color: BLOQUE.apagado, lineHeight: 1.45 }}>
                A estos les tocaba pagar hoy y no pagaron. Los más atrasados van primero: son a los que conviene ir mañana.
              </span>
              <Lista filas={r.sinCobrar} render={(x) => (
                <FilaLista
                  titulo={x.nombre} valor={formatear(x.cuota)}
                  detalle={x.diasMora > 0 ? `${x.diasMora} ${x.diasMora === 1 ? 'día' : 'días'} de atraso` : 'estaba al día'}
                  colorValor={x.diasMora > 0 ? BLOQUE.rojo : BLOQUE.tinta}
                  onClick={x.clienteId && onIr ? () => onIr(`/clientes/${x.clienteId}`) : undefined}
                />
              )} />
            </div>
          )}
        </div>

        {/* ── 3 · De eso, cuánto es ganancia ── */}
        {hayReparto && (
          <Seccion rotulo="De lo que entró" orden={1}>
            {/* Una sola barra partida en dos: lo verde es ganancia, lo gris es
                plata tuya que volvió. */}
            <Barra pct={(r.interes / r.cobrado) * 100} color={VERDE} alto={14} espera={420} fondo="rgba(255,255,255,.30)" />
            <Renglon
              etiqueta="Tu ganancia de hoy" nota="El interés que cobraste. Esto sí es plata nueva."
              valor={<Cuenta valor={r.interes} formatear={formatear} espera={450} />} color={VERDE}
            />
            <Renglon
              etiqueta="Plata tuya que volvió" nota="Capital que habías prestado y regresó a la caja."
              valor={<Cuenta valor={r.capitalDeVuelta} formatear={formatear} espera={550} />}
            />
            {r.medios && (r.medios.transferencia > 0 || r.medios.efectivo > 0) && (
              <div style={{ display: 'flex', gap: 10, paddingTop: 13, borderTop: `1px solid ${BLOQUE.linea}` }}>
                {[['En efectivo', r.medios.efectivo], ['Por transferencia', r.medios.transferencia]].map(([n, v]) => (
                  <span key={n} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 13, color: BLOQUE.apagado }}>{n}</span>
                    <span className="cf-fig" style={{ fontSize: 17, color: BLOQUE.tinta, whiteSpace: 'nowrap' }}>{formatear(v)}</span>
                  </span>
                ))}
              </div>
            )}
          </Seccion>
        )}

        {/* ── 4 · Lo que salió ── */}
        <Seccion rotulo="Lo que salió hoy" orden={2}>
          <RenglonQueAbre
            etiqueta="Prestaste" cuantos={r.prestamosLista.length}
            nota={r.prestamos > 0 ? `${r.prestamos} ${r.prestamos === 1 ? 'préstamo nuevo' : 'préstamos nuevos'}. No es un gasto: sigue siendo tuya, en la calle.` : 'Hoy no prestaste.'}
            valor={formatear(r.prestado)}
          >
            <Lista filas={r.prestamosLista} render={(x) => (
              <FilaLista titulo={x.cliente} valor={formatear(x.monto)} onClick={onIr ? () => onIr(`/prestamos/${x.id}`) : undefined} />
            )} />
          </RenglonQueAbre>
          <RenglonQueAbre
            etiqueta="Gastos" cuantos={r.gastosLista.length}
            nota={r.gastosCuantos > 0 ? `${r.gastosCuantos} ${r.gastosCuantos === 1 ? 'gasto' : 'gastos'}. Esto sí baja tu ganancia.` : 'Sin gastos hoy.'}
            valor={formatear(r.gastos)} color={r.gastos > 0 ? BLOQUE.rojo : BLOQUE.tinta}
          >
            <Lista filas={r.gastosLista} render={(x) => (
              <FilaLista titulo={x.que} detalle={[x.quien, x.pendiente ? 'por aprobar' : null].filter(Boolean).join(' · ') || null} valor={formatear(x.monto)} />
            )} />
          </RenglonQueAbre>
          {(r.cobrado > 0 || salio > 0) && (
            <div style={{ paddingTop: 13, borderTop: `1px solid ${BLOQUE.linea}` }}>
              <Renglon
                etiqueta={r.movimientoNeto >= 0 ? 'Entró más de lo que salió' : 'Salió más de lo que entró'}
                nota={r.movimientoNeto >= 0 ? 'Tu caja subió hoy.' : 'Tu caja bajó hoy porque pusiste plata a trabajar, no porque perdieras.'}
                valor={`${r.movimientoNeto >= 0 ? '+' : '−'}${formatear(Math.abs(r.movimientoNeto))}`}
              />
            </div>
          )}
        </Seccion>

        {/* ── 5 · La semana: cada barra se toca ──
            La MISMA gráfica que el Inicio, desde que el dueño pidió que allá se
            viera como aquí. Vive en `components/cf/SemanaDeCobros.jsx`. */}
        {r.dias.length > 0 && (
          <Seccion rotulo="Tus últimos 7 días" orden={3}>
            <SemanaDeCobros
              dias={r.dias}
              formatear={formatear}
              eligeHoy
              anima
              pie={({ total }) => (
                <>{r.mejorDeLaSemana ? 'Hoy fue tu mejor día de la semana. ' : ''}En 7 días llevas <strong>{formatear(total)}</strong> cobrados. Toca una barra para ver ese día.</>
              )}
            />
          </Seccion>
        )}

        {/* ── 6 · El equipo ── */}
        {hayEquipo && (
          <Seccion rotulo="Quién cobró" orden={4}>
            {r.cobradores.map((c, i) => (
              <div key={c.nombre + i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: BLOQUE.tinta, minWidth: 0, overflowWrap: 'anywhere' }}>{c.nombre}</span>
                  <span className="cf-num" style={{ fontSize: 14, color: BLOQUE.apagado, flex: 'none' }}>
                    <strong style={{ color: BLOQUE.tinta }}>{formatear(c.monto)}</strong> · {c.pagos} {c.pagos === 1 ? 'cobro' : 'cobros'}
                    {r.cobrado > 0 ? ` · ${Math.round((c.monto / r.cobrado) * 100)}%` : ''}
                  </span>
                </div>
                <Barra pct={(c.monto / topeEquipo) * 100} alto={8} color={i === 0 ? BLOQUE.oro : BLOQUE.barra} espera={600 + i * 90} />
              </div>
            ))}
          </Seccion>
        )}

        {/* ── 7 · Mañana ── */}
        {r.manana && (
          <Seccion rotulo="Mañana" orden={5}>
            {r.manana.monto > 0 ? (
              <RenglonQueAbre
                etiqueta="Te toca cobrar" cuantos={r.manana.lista.length}
                nota={`A ${r.manana.clientes} ${r.manana.clientes === 1 ? 'cliente' : 'clientes'}. Toca para ver a quiénes.`}
                valor={formatear(r.manana.monto)} color={BLOQUE.oro}
              >
                <Lista filas={r.manana.lista} render={(x) => (
                  <FilaLista titulo={x.nombre} valor={formatear(x.cuota)} onClick={x.clienteId && onIr ? () => onIr(`/clientes/${x.clienteId}`) : undefined} />
                )} />
              </RenglonQueAbre>
            ) : (
              <span style={{ fontSize: 15, color: BLOQUE.tinta }}>Mañana no toca cobrarle a nadie.</span>
            )}
            {r.clientesSinCobrar > 0 && (
              <span style={{ fontSize: 13, color: BLOQUE.apagado, lineHeight: 1.45 }}>
                Más los {r.clientesSinCobrar} que hoy no pagaron ({formatear(r.faltoPorCobrar)}).
              </span>
            )}
          </Seccion>
        )}

        {/* ── 8 · El mes ── */}
        {(r.mes.cobrado > 0 || r.mes.ganancia != null) && (
          <Seccion rotulo={`Tu ${mesNombre}, hasta hoy`} orden={6}>
            {r.mes.ganancia != null && (
              <Renglon
                etiqueta="Tu ganancia del mes" nota={`Interés cobrado (${formatear(r.mes.interes)}) menos gastos (${formatear(r.mes.gastos)}).`}
                valor={<Cuenta valor={r.mes.ganancia} formatear={formatear} espera={300} />} color={r.mes.ganancia >= 0 ? VERDE : BLOQUE.rojo}
              />
            )}
            <Renglon etiqueta="Cobrado en el mes" nota={`${r.mes.cobros} ${r.mes.cobros === 1 ? 'cobro' : 'cobros'}, entre capital e interés.`} valor={formatear(r.mes.cobrado)} />
          </Seccion>
        )}

        {/* ── 9 · Cómo queda ── */}
        <Seccion rotulo="Cómo queda tu negocio" orden={7}>
          {r.enCaja != null && <Renglon etiqueta="En caja" nota="Lo que tienes para prestar mañana." valor={formatear(r.enCaja)} />}
          {r.enLaCalle != null && <Renglon etiqueta="En la calle" nota="Tu capital prestado, que todavía no ha vuelto." valor={formatear(r.enLaCalle)} />}
          {r.porCobrar != null && <Renglon etiqueta="Por cobrar" nota="Lo que recibes si todos terminan de pagar." valor={formatear(r.porCobrar)} />}
          <Renglon
            etiqueta="Clientes atrasados" nota={r.enMora > 0 ? 'Son los primeros que conviene visitar mañana.' : 'Nadie atrasado. Así da gusto.'}
            valor={String(r.enMora)} color={r.enMora > 0 ? BLOQUE.rojo : VERDE}
          />
        </Seccion>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
          <button type="button" onClick={onCerrar} style={{
            height: 56, borderRadius: 999, border: 0, cursor: 'pointer', font: 'inherit',
            background: BLOQUE.oro, color: '#3A2900', fontSize: 16, fontWeight: 700,
          }}>Listo</button>
          <button type="button" onClick={compartir} style={{
            height: 48, borderRadius: 999, cursor: 'pointer', font: 'inherit',
            background: 'none', border: '1px solid rgba(255,255,255,.18)', color: BLOQUE.tinta, fontSize: 14, fontWeight: 700,
          }}>{compartido ? 'Copiado' : 'Compartir el resumen'}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** El pop-up que sale solo a la hora elegida. */
export function AvisoResumen({ r, formatear, onVer, onLuego }) {
  const [montado, setMontado] = useState(false)
  useEffect(() => { setMontado(true) }, [])
  if (!montado || !r) return null
  return createPortal(
    <div className="cf-res" role="dialog" aria-modal="true" aria-label="Tu resumen del día está listo" style={{
      position: 'fixed', inset: 0, zIndex: 10004, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: 'rgba(10,11,14,.62)',
    }}>
      <style>{CSS}</style>
      <div className="cf-res-sec" style={{
        width: 'min(100%, 420px)', background: BLOQUE.fondo, border: BORDE_BLOQUE, borderRadius: 24,
        padding: '26px 22px 20px', display: 'flex', flexDirection: 'column', gap: 18, color: BLOQUE.tinta,
      }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em', color: BLOQUE.oro }}>Tu resumen del día está listo</span>
          <span className="cf-fig" style={{ fontSize: 26, lineHeight: 1.12, letterSpacing: '-.03em', textWrap: 'balance' }}>{r.titular}</span>
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: BLOQUE.rotulo }}>Hoy entraron</span>
          <span className="cf-fig" style={{ fontSize: 40, lineHeight: 1, letterSpacing: '-.04em', color: BLOQUE.oro, whiteSpace: 'nowrap' }}>
            <Cuenta valor={r.cobrado} formatear={formatear} />
          </span>
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" onClick={onVer} style={{
            height: 54, borderRadius: 999, border: 0, cursor: 'pointer', font: 'inherit',
            background: BLOQUE.oro, color: '#3A2900', fontSize: 16, fontWeight: 700,
          }}>Ver mi resumen</button>
          <button type="button" onClick={onLuego} style={{
            height: 48, borderRadius: 999, cursor: 'pointer', font: 'inherit',
            background: 'none', border: 0, color: BLOQUE.rotulo, fontSize: 14, fontWeight: 700,
          }}>Todavía no termino el día</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
