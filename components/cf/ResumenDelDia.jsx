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

/**
 * La pantalla entera.
 * @param r         lo que devuelve `armarResumen()`
 * @param formatear (n) → «$1.250.000»
 * @param fecha     «domingo, 20 de septiembre»
 */
export function ResumenDelDia({ r, formatear, fecha, onCerrar }) {
  const [montado, setMontado] = useState(false)
  useEffect(() => { setMontado(true) }, [])
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onCerrar?.() }
    window.addEventListener('keydown', tecla)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', tecla); document.body.style.overflow = antes }
  }, [onCerrar])
  if (!montado || !r) return null

  const hoy = new Date().getDay()
  const tope = Math.max(...r.semana, 1)
  const hayReparto = r.interes != null && r.capitalDeVuelta != null && r.cobrado > 0
  const hayEquipo = r.cobradores.length > 1
  const topeEquipo = Math.max(...r.cobradores.map((c) => c.monto), 1)
  const salio = r.prestado + r.gastos

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
            <span style={{ fontSize: 13, color: BLOQUE.apagado, }}>{fecha ? fecha.charAt(0).toUpperCase() + fecha.slice(1) : ''}</span>
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
        <section className="cf-res-sec" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '10px 2px 8px' }}>
          <h1 className="cf-fig" style={{ margin: 0, fontSize: 30, lineHeight: 1.1, letterSpacing: '-.03em', textWrap: 'balance', color: BLOQUE.tinta }}>
            {r.nombre ? `${r.nombre}, ` : ''}{r.nombre ? r.titular.charAt(0).toLowerCase() + r.titular.slice(1) : r.titular}
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
                {r.faltoPorCobrar > 0 ? <>. Quedaron <strong style={{ color: BLOQUE.oro }}>{formatear(r.faltoPorCobrar)}</strong> por cobrar</> : ''}
                {r.clientesHoy > 0 ? <>: le cobraste a <strong>{r.clientesCobrados} de {r.clientesHoy}</strong> clientes.</> : '.'}
              </span>
            </div>
          )}
        </section>

        {/* ── 2 · De eso, cuánto es ganancia ── */}
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
          </Seccion>
        )}

        {/* ── 3 · Lo que salió ── */}
        <Seccion rotulo="Lo que salió hoy" orden={2}>
          <Renglon
            etiqueta="Prestaste" nota={r.prestamos > 0 ? `${r.prestamos} ${r.prestamos === 1 ? 'préstamo nuevo' : 'préstamos nuevos'}. No es un gasto: sigue siendo tuya, en la calle.` : 'Hoy no prestaste.'}
            valor={formatear(r.prestado)}
          />
          <Renglon
            etiqueta="Gastos" nota={r.gastosCuantos > 0 ? `${r.gastosCuantos} ${r.gastosCuantos === 1 ? 'gasto' : 'gastos'}. Esto sí baja tu ganancia.` : 'Sin gastos hoy.'}
            valor={formatear(r.gastos)} color={r.gastos > 0 ? BLOQUE.rojo : BLOQUE.tinta}
          />
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

        {/* ── 4 · La semana ── */}
        {r.semana.length > 0 && (
          <Seccion rotulo="Tus últimos 7 días" orden={3}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 132 }}>
              {r.semana.map((n, i) => {
                const esHoy = i === r.semana.length - 1
                const dia = DIAS[(hoy - (r.semana.length - 1 - i) + 7 * 2) % 7]
                return (
                  <span key={i} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                    <span className="cf-res-col" style={{
                      width: '100%', height: Math.max(n > 0 ? 5 : 2, Math.round((n / tope) * 100)), borderRadius: 7, flex: 'none',
                      background: esHoy ? BLOQUE.oro : BLOQUE.barra, animationDelay: `${500 + i * 70}ms`,
                    }} />
                    <span className="cf-num" style={{ fontSize: 12, fontWeight: esHoy ? 700 : 500, color: esHoy ? BLOQUE.oro : BLOQUE.apagado }}>
                      {esHoy ? 'hoy' : dia}
                    </span>
                  </span>
                )
              })}
            </div>
            <span style={{ fontSize: 14, color: BLOQUE.tinta, lineHeight: 1.5 }}>
              {r.mejorDeLaSemana ? 'Hoy fue tu mejor día de la semana.' : `En la semana llevas ${formatear(r.semana.reduce((a, b) => a + b, 0))} cobrados.`}
            </span>
          </Seccion>
        )}

        {/* ── 5 · El equipo ── */}
        {hayEquipo && (
          <Seccion rotulo="Quién cobró" orden={4}>
            {r.cobradores.map((c, i) => (
              <div key={c.nombre + i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: BLOQUE.tinta, minWidth: 0, overflowWrap: 'anywhere' }}>{c.nombre}</span>
                  <span className="cf-num" style={{ fontSize: 14, color: BLOQUE.apagado, flex: 'none' }}>
                    <strong style={{ color: BLOQUE.tinta }}>{formatear(c.monto)}</strong> · {c.pagos} {c.pagos === 1 ? 'cobro' : 'cobros'}
                  </span>
                </div>
                <Barra pct={(c.monto / topeEquipo) * 100} alto={8} color={i === 0 ? BLOQUE.oro : BLOQUE.barra} espera={600 + i * 90} />
              </div>
            ))}
          </Seccion>
        )}

        {/* ── 6 · Cómo queda ── */}
        <Seccion rotulo="Cómo queda tu negocio" orden={5}>
          {r.enCaja != null && <Renglon etiqueta="En caja" nota="Lo que tienes para prestar mañana." valor={formatear(r.enCaja)} />}
          <Renglon
            etiqueta="Clientes atrasados" nota={r.enMora > 0 ? 'Son los primeros que conviene visitar mañana.' : 'Nadie atrasado. Así da gusto.'}
            valor={String(r.enMora)} color={r.enMora > 0 ? BLOQUE.rojo : VERDE}
          />
          {r.clientesSinCobrar > 0 && (
            <Renglon etiqueta="Se quedaron sin cobrar hoy" nota="Les tocaba hoy y no pagaron." valor={String(r.clientesSinCobrar)} />
          )}
        </Seccion>

        <button type="button" onClick={onCerrar} style={{
          height: 56, borderRadius: 999, border: 0, cursor: 'pointer', font: 'inherit', marginTop: 6,
          background: BLOQUE.oro, color: '#3A2900', fontSize: 16, fontWeight: 700,
        }}>Listo</button>
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
