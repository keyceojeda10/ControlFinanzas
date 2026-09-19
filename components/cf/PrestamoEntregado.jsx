'use client'

/**
 * PRÉSTAMO ENTREGADO — lo que sale al crear o renovar un préstamo.
 *
 * Aprobado por el dueño el 19 sep 2026 con el prototipo «Prestar que engancha»,
 * en el mismo lenguaje del cobro: el visto con dos anillos, los billetes que
 * salen hacia el cliente y, lo que motiva, LO QUE VUELVE.
 *
 *   · «Lo que vuelve» gira de lo prestado al total a cobrar, y al lado la
 *     GANANCIA, que es el interés y nunca lo prestado. En los modos donde el
 *     total no trae el interés futuro (abierto, globo) no hay ganancia que
 *     enseñar: el chip no sale, en vez de decir «+$0».
 *   · «Cartera activa» —el mismo nombre y la misma cifra del inicio— sube con
 *     este préstamo. La cifra llega del servidor (`cargarCartera`); si no llega,
 *     el renglón no se pinta.
 *   · En una RENOVACIÓN la suma se arma a la vista: lo que debía + lo que se
 *     lleva en mano = el nuevo crédito. La cartera sube solo lo nuevo, porque
 *     lo que debía ya estaba en ella.
 *   · Los billetes solo vuelan si la plata SALIÓ EN BILLETES: efectivo, y no un
 *     préstamo «en curso» traído del cuaderno ni una mercancía.
 */

import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import { CAPA_RECIBO } from '@/components/pantallas/Recibo'
import { construirRodillos, CSS_RODILLOS, menosMovimiento, rodarContador, sonidoBillete, sonidoCobrado, vibrar } from '@/lib/celebrar'
import { soltarBilletes } from '@/lib/billetes'

const EXPO = 'cubic-bezier(.16,1,.3,1)'
const VERDE_WA = '#25D366'

function Linea({ rotulo, refOdo, refChip, chip, pie }) {
  return (
    <div>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>{rotulo}</span>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '4px 12px', flexWrap: 'wrap' }}>
        <span ref={refOdo} className="cf-rodillos" style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 22, fontWeight: 700 }} />
        {chip && (
          <span ref={refChip} className="cf-num" style={{
            opacity: 0, fontSize: 12, fontWeight: 700, color: 'var(--cf-green-dark)', background: 'var(--cf-green-pill-bg)',
            borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap',
          }}>{chip}</span>
        )}
      </div>
      {pie && <span className="cf-num" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--cf-ink-3)', marginTop: 2 }}>{pie}</span>}
    </div>
  )
}

/**
 * @param titulo      opcional: «Préstamo cargado» para uno «en curso» traído del cuaderno
 * @param entregado   lo que salió en mano (en una renovación, solo la diferencia)
 * @param renovacion  `{ debia, credito, enMano, redondeado, numero }` o null. `debia` es la
 *                    deuda que se liquidó y `enMano` el efectivo, redondeado al centenar
 *                    a favor del cliente: la suma puede no dar exacta y el pie lo dice.
 * @param prestado    lo prestado (el nuevo crédito en una renovación)
 * @param total       el total a cobrar del préstamo nuevo
 * @param conGanancia si el total trae el interés (no en abierto ni globo)
 * @param billetes    si la plata salió en billetes
 * @param plan        la frase del plan: «24 cuotas diarias de $25.000 · la primera mañana»
 * @param cargarCartera `() => Promise<number|null>`: la cartera activa DESPUÉS de este préstamo
 * @param subeCartera  cuánto sube la cartera con este préstamo
 */
export default function PrestamoEntregado({
  titulo, cliente, entregado, renovacion = null, prestado, total, conGanancia, billetes, plan,
  cargarCartera, subeCartera, formatear, onWhatsApp, onVer, onOtro, textoOtro,
}) {
  const refMonto = useRef(null), refAvatar = useRef(null), refVuelo = useRef(null)
  const refCredito = useRef(null), refChipCredito = useRef(null)
  const refVuelve = useRef(null), refChipGana = useRef(null)
  const refCartera = useRef(null), refChipCartera = useRef(null)
  const [cartera, setCartera] = useState(undefined)   // undefined: cargando · null: no se sabe

  useEffect(() => {
    let vivo = true
    Promise.resolve(cargarCartera?.()).then((v) => { if (vivo) setCartera(Number.isFinite(v) ? v : null) }).catch(() => vivo && setCartera(null))
    return () => { vivo = false }
    // Una vez por préstamo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // El resto de la escena espera a saber la cartera (o a saber que no llega).
  useEffect(() => {
    if (cartera === undefined) return
    let vivo = true
    const temporizadores = []
    const credito = renovacion?.credito ?? prestado
    let rk = refCredito.current ? construirRodillos(refCredito.current, formatear(renovacion?.debia ?? 0)) : []
    let rv = refVuelve.current ? construirRodillos(refVuelve.current, formatear(credito)) : []
    let rc = (refCartera.current && cartera != null) ? construirRodillos(refCartera.current, formatear(cartera - subeCartera)) : []
    const aparecer = (el) => el?.animate?.([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EXPO, fill: 'forwards' })

    const loQueVuelve = () => {
      let t = 0
      if (renovacion && refCredito.current) { rk = rodarContador(refCredito.current, rk, formatear(credito)); aparecer(refChipCredito.current); t = 520 }
      temporizadores.push(setTimeout(() => {
        if (!vivo) return
        if (refVuelve.current) { rv = rodarContador(refVuelve.current, rv, formatear(total)); aparecer(refChipGana.current) }
        temporizadores.push(setTimeout(() => {
          if (!vivo) return
          if (refCartera.current && cartera != null) { rc = rodarContador(refCartera.current, rc, formatear(cartera)); aparecer(refChipCartera.current) }
          sonidoCobrado(); vibrar([10, 40, 22])
        }, 420))
      }, t))
    }

    if (menosMovimiento()) {
      if (refCredito.current) construirRodillos(refCredito.current, formatear(credito))
      if (refVuelve.current) construirRodillos(refVuelve.current, formatear(total))
      if (refCartera.current && cartera != null) construirRodillos(refCartera.current, formatear(cartera))
      ;[refChipCredito, refChipGana, refChipCartera].forEach((r) => { if (r.current) r.current.style.opacity = '1' })
      return () => { vivo = false }
    }

    temporizadores.push(setTimeout(() => {
      if (!vivo) return
      const m = refMonto.current?.getBoundingClientRect(), a = refAvatar.current?.getBoundingClientRect()
      if (!billetes || !m || !a || !refVuelo.current) return loQueVuelve()
      soltarBilletes(refVuelo.current, renovacion ? 3 : 4,
        { x: m.left + m.width / 2, y: m.top + m.height / 2, ancho: m.width },
        { x: a.left + a.width / 2, y: a.top + a.height / 2 },
        () => { sonidoBillete(); vibrar(8) },
        () => { refAvatar.current?.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.08)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: 200 }); loQueVuelve() })
    }, 450))
    return () => { vivo = false; temporizadores.forEach(clearTimeout) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartera])

  if (typeof document === 'undefined') return null
  const credito = renovacion?.credito ?? prestado
  const ganancia = Math.round(total - credito)

  return createPortal(
    <div data-prestamo-entregado="1" className={CAPA_RECIBO.className} style={CAPA_RECIBO.style}>
      <div className={'w-full max-w-[520px] mx-auto lg:w-[520px] lg:flex-none lg:my-8 lg:bg-[var(--cf-card)] lg:rounded-[20px] lg:shadow-2xl'}
        style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 14, padding: 24, color: 'var(--cf-ink)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
          <span aria-hidden className="cf-recibo-sello" style={{
            position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: 999, background: 'var(--cf-green)', flex: 'none',
          }}>
            <i className="cf-recibo-anillo" /><i className="cf-recibo-anillo" />
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path className="cf-recibo-visto" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <span style={{ marginTop: 6, fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 23, fontWeight: 600, letterSpacing: '-.02em' }}>
            {titulo ?? (renovacion ? 'Préstamo renovado' : 'Préstamo entregado')}
          </span>
          {renovacion?.numero > 1 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700,
              color: 'var(--cf-green-dark)', background: 'var(--cf-green-pill-bg)', borderRadius: 999, padding: '3px 9px',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-11.6 7.1" /><path d="M18 3v4h-4" />
              </svg>
              Renovación n.º {renovacion.numero} · cliente fiel
            </span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--cf-ink-2)' }}>
            <span ref={refAvatar} style={{ display: 'inline-flex' }}><Avatar nombre={cliente?.nombre} fotoUrl={cliente?.fotoUrl} size={28} round /></span>
            a {cliente?.nombre}
          </span>
          <span ref={refMonto} className="cf-fig" style={{ fontSize: 38, letterSpacing: '-.02em' }}>{formatear(entregado)}</span>
          {renovacion && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cf-ink-3)' }}>{renovacion.enMano > 0 ? 'en mano' : 'sin efectivo: solo se renovó'}</span>}
        </div>

        <div style={{
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 'var(--cf-r-card)',
          padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {renovacion && (
            <Linea rotulo="Nuevo crédito" refOdo={refCredito} refChip={refChipCredito}
              chip={renovacion.enMano > 0 ? `+${formatear(renovacion.enMano)} en mano` : null}
              pie={`Debía ${formatear(renovacion.debia)}${renovacion.enMano > 0 ? ` · ${formatear(renovacion.enMano)} en mano` : ''}${renovacion.redondeado ? ' · redondeado a favor del cliente' : ''}`} />
          )}
          <Linea rotulo="Lo que vuelve" refOdo={refVuelve} refChip={refChipGana}
            chip={conGanancia && ganancia > 0 ? `+${formatear(ganancia)} de ganancia` : null} />
          {cartera != null && (
            <Linea rotulo="Cartera activa" refOdo={refCartera} refChip={refChipCartera} chip={`+${formatear(subeCartera)}`} />
          )}
          {plan && (
            <p style={{ margin: 0, paddingTop: 12, borderTop: '1px dashed var(--cf-border-strong)', fontSize: 13, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>{plan}</p>
          )}
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {onWhatsApp && (
            <button type="button" onClick={onWhatsApp} style={{
              height: 54, border: 'none', borderRadius: 14, background: VERDE_WA, color: '#FFF', cursor: 'pointer',
              font: 'inherit', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 12a8 8 0 01-11.6 7.1L4 20l.9-4.3A8 8 0 1120 12z" />
              </svg>
              Enviar la aprobación por WhatsApp
            </button>
          )}
          <button type="button" onClick={onVer} style={{
            height: 48, borderRadius: 14, cursor: 'pointer', background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
            color: 'var(--cf-ink)', font: 'inherit', fontSize: 15, fontWeight: 700,
          }}>Ver el préstamo</button>
          {onOtro && (
            <button type="button" onClick={onOtro} style={{
              height: 40, border: 0, background: 'none', cursor: 'pointer', font: 'inherit', fontSize: 14, fontWeight: 700, color: 'var(--cf-ink-3)',
            }}>{textoOtro}</button>
          )}
        </div>
      </div>

      {/* Siempre montado y vacío: sin ancho hasta que vuela algo. */}
      <canvas ref={refVuelo} width={0} height={0} aria-hidden style={{
        position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 10003,
      }} />
      <style>{`
        ${CSS_RODILLOS}
        .cf-recibo-sello { animation: cf-recibo-sello .28s cubic-bezier(.16,1,.3,1) both; }
        .cf-recibo-visto { stroke-dasharray: 22; animation: cf-recibo-visto .32s cubic-bezier(.16,1,.3,1) .12s both; }
        .cf-recibo-anillo { position: absolute; inset: 0; border-radius: 999px; border: 2px solid var(--cf-green); opacity: 0; animation: cf-recibo-anillo .7s cubic-bezier(.16,1,.3,1) .2s; }
        .cf-recibo-anillo + .cf-recibo-anillo { animation-delay: .34s; }
        @keyframes cf-recibo-sello { from { opacity: 0; transform: scale(.86) } to { opacity: 1; transform: none } }
        @keyframes cf-recibo-visto { from { stroke-dashoffset: 22 } to { stroke-dashoffset: 0 } }
        @keyframes cf-recibo-anillo { from { opacity: .5; transform: scale(1) } to { opacity: 0; transform: scale(2.3) } }
        @media (prefers-reduced-motion: reduce) { .cf-recibo-sello, .cf-recibo-visto, .cf-recibo-anillo { animation: none; } }
      `}</style>
    </div>,
    document.body,
  )
}
