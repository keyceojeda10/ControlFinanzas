'use client'

/**
 * LLEVAS HOY — cómo va el día, en el comprobante que sale al cobrar.
 *
 * Aprobado por el dueño el 19 sep 2026 tras diez versiones de prototipo. Lo
 * que tenía que dar: «cobrar y llenar los bolsillos de billetes, esa sería la
 * analogía del programa en general» — no ahorrar (un pote de monedas «parecía
 * de una app de ahorros») y no una fila de puntos por cliente («si cobrara cien
 * clientes sería exagerada esa cantidad de punticos»).
 *
 *   · El total del día GIRA como un contador desde lo que llevaba hasta lo que
 *     lleva, y al lado sale «+$30.000».
 *   · La billetera se infla con lo cobrado sobre lo esperado hoy
 *     (`recaudadoHoy / esperadoHoy`): sirve igual con 20 que con 100 clientes,
 *     y es un dato que la ruta ya tiene.
 *   · Si el cobro ENTRÓ AL FAJO, el monto se suelta en billetes que caen
 *     revoloteando y se meten en la billetera, cada uno con su sonido de papel.
 *     Si fue una transferencia a la cuenta del negocio, esa plata no está en el
 *     bolsillo: en vez de la billetera sale UN TELÉFONO, y una notificación
 *     viaja del monto a él, enciende la pantalla y lo hace vibrar («no quitar la
 *     animación… que llegue el dinero al teléfono», el dueño, 19 sep). Lo decide
 *     `entraAlFajo()` en quien la monta, que es la única que puede decidirlo.
 *
 * Sin movimiento (preferencia del sistema) todo queda en su estado final.
 */

import { useEffect, useRef } from 'react'
import {
  construirRodillos, CSS_RODILLOS, menosMovimiento, rodarContador,
  sonidoBillete, sonidoCobrado, sonidoNotificacion, vibrar,
} from '@/lib/celebrar'
import { BW, BH, cuerpo, lanzarBilletes, lanzarNotificacion, pintarBilletera } from '@/lib/billetes'

const EXPO = 'cubic-bezier(.16,1,.3,1)'

/* EL TELÉFONO, para el cobro por transferencia: la plata no llegó al bolsillo
   sino al celular. Apagado mientras viaja la notificación; al llegar la pantalla
   se enciende, baja el aviso con su visto y el teléfono vibra. */
function Telefono({ refTel, refPantalla, refAviso }) {
  return (
    <span aria-hidden style={{ width: BW, height: BH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span ref={refTel} style={{
        position: 'relative', width: 42, height: 66, borderRadius: 10, background: 'var(--cf-telefono-cuerpo)',
        display: 'block', willChange: 'transform', boxShadow: '0 2px 4px rgba(0,0,0,.18)',
      }}>
        <span ref={refPantalla} style={{
          position: 'absolute', inset: 3, borderRadius: 7, overflow: 'hidden',
          background: 'var(--cf-telefono-pantalla)', transition: 'background-color .25s',
        }}>
          <span style={{ position: 'absolute', top: 3, left: '50%', width: 12, height: 3, marginLeft: -6, borderRadius: 999, background: 'rgba(0,0,0,.55)' }} />
          <span ref={refAviso} style={{
            position: 'absolute', left: 3, right: 3, top: 9, height: 15, borderRadius: 5, background: 'var(--cf-card)',
            display: 'flex', alignItems: 'center', gap: 3, padding: '0 3px', opacity: 0, transform: 'translateY(-24px)',
            boxShadow: '0 1px 2px rgba(0,0,0,.2)',
          }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--cf-green)', flex: 'none', display: 'grid', placeItems: 'center' }}>
              <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
            </span>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <i style={{ display: 'block', height: 2, borderRadius: 1, background: 'var(--cf-ink-3)', width: '90%' }} />
              <i style={{ display: 'block', height: 2, borderRadius: 1, background: 'var(--cf-border-strong)', width: '60%' }} />
            </span>
          </span>
        </span>
      </span>
    </span>
  )
}

/**
 * @param progreso `{ antes, ahora, meta, formatear, efectivo }` — números en la
 *   moneda del negocio y la función que los formatea.
 * @param origenRef el elemento del monto cobrado: de ahí salen los billetes.
 */
export default function LlevasHoy({ progreso, origenRef, extra = null }) {
  const { antes, ahora, meta, formatear, efectivo } = progreso
  const refOdo = useRef(null)
  const refBilletera = useRef(null)
  const refVuelo = useRef(null)
  const refDelta = useRef(null)
  const refTel = useRef(null), refPantalla = useRef(null), refAviso = useRef(null)
  const monto = Math.max(0, ahora - antes)

  useEffect(() => {
    const billetera = refBilletera.current, odo = refOdo.current
    if (!odo || (efectivo && !billetera)) return
    // Sin nada que tocaba cobrar hoy, lo cobrado igual llena la billetera: vacía
    // diría que no entró nada.
    const fraccion = (v) => (meta > 0 ? Math.max(0, Math.min(1, v / meta)) : (v > 0 ? 0.6 : 0))
    let inflado = fraccion(antes)
    let rodillos = construirRodillos(odo, formatear(antes))
    if (billetera) pintarBilletera(billetera, inflado)
    // El teléfono: la pantalla se enciende y baja el aviso.
    const encender = (animar) => {
      if (refPantalla.current) refPantalla.current.style.backgroundColor = 'var(--cf-telefono-luz)'
      const aviso = refAviso.current
      if (!aviso) return
      if (!animar) { aviso.style.opacity = '1'; aviso.style.transform = 'none'; return }
      aviso.animate?.([{ opacity: 0, transform: 'translateY(-24px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: EXPO, fill: 'forwards' })
      // Vibra como un teléfono de verdad: corto y seco, sin rebote.
      refTel.current?.animate?.([
        { transform: 'translateX(0)' }, { transform: 'translateX(-1.5px)' }, { transform: 'translateX(1.5px)' },
        { transform: 'translateX(-1.5px)' }, { transform: 'translateX(1.5px)' }, { transform: 'translateX(0)' },
      ], { duration: 260, easing: 'linear' })
    }
    const temporizadores = []
    let vivo = true

    const inflar = (destino) => {
      const desde = inflado, t0 = performance.now()
      const paso = (t1) => {
        if (!vivo) return
        const t = Math.min(1, (t1 - t0) / 240)
        inflado = desde + (destino - desde) * (1 - Math.pow(1 - t, 4))
        if (billetera) pintarBilletera(billetera, inflado)
        if (t < 1) requestAnimationFrame(paso)
      }
      requestAnimationFrame(paso)
    }
    const llega = () => {
      rodillos = rodarContador(odo, rodillos, formatear(ahora))
      refDelta.current?.animate?.([
        { opacity: 0, transform: 'translateY(4px)' },
        { opacity: 1, transform: 'none' },
      ], { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' })
    }

    if (menosMovimiento() || monto <= 0) {
      rodillos = construirRodillos(odo, formatear(ahora))
      if (billetera) pintarBilletera(billetera, fraccion(ahora))
      if (!efectivo && monto > 0) encender(false)
      if (refDelta.current) refDelta.current.style.opacity = monto > 0 ? '1' : '0'
      return () => { vivo = false }
    }

    const origen = origenRef?.current?.getBoundingClientRect?.()
    if (efectivo && origen) {
      // Más plata respecto al día, más billetes: de 2 a 6, en cualquier moneda.
      const n = Math.max(2, Math.min(6, Math.round(2 + (meta > 0 ? monto / meta : 0) * 20)))
      temporizadores.push(setTimeout(() => {
        if (!vivo) return
        const b = billetera.getBoundingClientRect()
        const c = cuerpo(inflado)
        requestAnimationFrame(() => {
          if (!vivo || !refVuelo.current) return
          let entraron = 0
          lanzarBilletes(refVuelo.current, n,
            { x: origen.left + origen.width / 2, y: origen.top + origen.height / 2, ancho: origen.width },
            { x: b.left + BW / 2, y: b.top + c.arriba + 2 },
            () => {
              entraron += 1
              if (entraron === 1) llega()
              inflar(fraccion(antes + monto * (entraron / n)))
              sonidoBillete(); vibrar(8)
              billetera.animate?.([{ transform: 'translateY(0)' }, { transform: 'translateY(1.5px)', offset: 0.3 }, { transform: 'translateY(0)' }], { duration: 200, easing: 'ease-out' })
            },
            () => { sonidoCobrado(); vibrar([10, 40, 22]) })
        })
      }, 420))
    } else if (efectivo) {
      // Efectivo sin sitio de donde soltar billetes: el día sube igual.
      temporizadores.push(setTimeout(() => {
        if (!vivo) return
        llega(); inflar(fraccion(ahora)); sonidoCobrado(); vibrar([10, 40, 22])
      }, 420))
    } else {
      /* TRANSFERENCIA: no son billetes al bolsillo sino plata que llega al
         teléfono. La notificación viaja del monto recibido al celular y, al
         llegar, se enciende la pantalla, baja el aviso y el total gira. */
      temporizadores.push(setTimeout(() => {
        if (!vivo) return
        const tel = refTel.current?.getBoundingClientRect()
        const alLlegar = () => { if (!vivo) return; llega(); encender(true); sonidoNotificacion(); vibrar([30, 40, 30]) }
        if (!origen || !tel || !refVuelo.current) return alLlegar()
        lanzarNotificacion(refVuelo.current,
          { x: origen.left + origen.width / 2, y: origen.top + origen.height / 2 },
          { x: tel.left + tel.width / 2, y: tel.top + 18 }, alLlegar)
      }, 420))
    }
    return () => { vivo = false; temporizadores.forEach(clearTimeout) }
    // Una vez por comprobante: los números son de este cobro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ flex: 'none', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12, padding: '2px 2px 0' }}>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase', color: 'var(--cf-ink-3)',
          }}>Llevas hoy</span>
          {monto > 0 && (
            <span ref={refDelta} className="cf-num" style={{
              opacity: 0, fontSize: 12, fontWeight: 700, color: 'var(--cf-green-dark)',
              background: 'var(--cf-green-pill-bg)', borderRadius: 999, padding: '2px 8px',
            }}>+{formatear(monto)}</span>
          )}
          {extra && <span style={{ marginLeft: 'auto' }}>{extra}</span>}
        </div>
        <span ref={refOdo} className="cf-rodillos" aria-live="polite" style={{
          fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 22, fontWeight: 700, letterSpacing: '-.01em',
        }} />
        {meta > 0 && (
          <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>de {formatear(meta)}</span>
        )}
      </div>
      {efectivo
        ? <canvas ref={refBilletera} aria-hidden style={{ display: 'block', width: BW, height: BH }} />
        : <Telefono refTel={refTel} refPantalla={refPantalla} refAviso={refAviso} />}
      {/* Siempre montado y vacío: sin ancho hasta que vuela algo. */}
      <canvas ref={refVuelo} width={0} height={0} aria-hidden style={{
        position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 10003,
      }} />
      <style>{CSS_RODILLOS}</style>
    </div>
  )
}
