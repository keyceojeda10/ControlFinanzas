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
 *     Si fue una transferencia a la cuenta del negocio NO: esa plata no está en
 *     el bolsillo del cobrador, y la animación no puede decir que sí. Lo decide
 *     `entraAlFajo()` en quien la monta, que es la única que puede decidirlo.
 *
 * Sin movimiento (preferencia del sistema) todo queda en su estado final.
 */

import { useEffect, useRef } from 'react'
import {
  construirRodillos, CSS_RODILLOS, menosMovimiento, rodarContador,
  sonidoBillete, sonidoCobrado, vibrar,
} from '@/lib/celebrar'

const BW = 84
const BH = 68
// Billetes genéricos, de tres colores: no copian ningún billete real.
const COLORES = [['#D4E6C4', '#5E8A4E'], ['#EFD3C6', '#A8705A'], ['#CCDAEB', '#5F7FA6']]

function dibujarBillete(g, w, h, [fondo, tinta]) {
  g.beginPath()
  if (g.roundRect) g.roundRect(-w / 2, -h / 2, w, h, 1.5); else g.rect(-w / 2, -h / 2, w, h)
  g.fillStyle = fondo; g.fill()
  g.lineWidth = 0.7; g.strokeStyle = tinta; g.stroke()
  g.lineWidth = 0.5; g.strokeRect(-w / 2 + 2.2, -h / 2 + 2.2, w - 4.4, h - 4.4)
  g.beginPath(); g.arc(w * 0.2, 0, h * 0.25, 0, Math.PI * 2); g.stroke()
  g.fillStyle = tinta
  g.fillRect(-w / 2 + 4.5, -h / 2 + 4.5, w * 0.3, 1); g.fillRect(-w / 2 + 4.5, h / 2 - 5.5, w * 0.16, 1)
}

// Los billetes que asoman por arriba, sorteados una vez: la billetera no cambia
// de cara entre un cobro y otro.
const ASOMAN = (() => {
  let semilla = 919
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647
  return Array.from({ length: 8 }, (_, k) => ({
    dx: (azar() - 0.5) * 18, giro: (azar() - 0.5) * 0.28, asoma: 5 + azar() * 9, color: COLORES[k % COLORES.length],
  }))
})()

const cuerpo = (p) => {
  const alto = 30 + 10 * p
  return { alto, arriba: BH - 4 - alto, abajo: BH - 4, izq: 6, der: BW - 6, panza: 3 * p }
}

/* La billetera: cuero negro, esquinas rectas, costura del mismo tono («un poco
   más varonil», el dueño). Más llena, más alta, más panza y más billetes. */
function pintarBilletera(lienzo, inflado) {
  const g = lienzo.getContext('2d')
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  if (lienzo.width !== BW * dpr) { lienzo.width = BW * dpr; lienzo.height = BH * dpr }
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, BW, BH)
  const oscuro = document.documentElement.getAttribute('data-theme') === 'dark'
  const c = cuerpo(inflado), { arriba, abajo, izq, der, panza } = c, medio = (arriba + abajo) / 2

  g.beginPath(); g.ellipse(BW / 2, abajo + 1.5, 34, 2.6, 0, 0, Math.PI * 2)
  g.fillStyle = oscuro ? 'rgba(0,0,0,.4)' : 'rgba(0,0,0,.14)'; g.fill()

  const cuantos = inflado <= 0 ? 0 : Math.max(1, Math.round(inflado * ASOMAN.length))
  for (let k = 0; k < cuantos; k++) {
    const b = ASOMAN[k]
    g.save(); g.translate(BW / 2 + b.dx, arriba - b.asoma - inflado * 4 + 14); g.rotate(b.giro)
    dibujarBillete(g, 50, 28, b.color); g.restore()
  }

  g.beginPath()
  g.moveTo(izq + 3, arriba)
  g.quadraticCurveTo(BW / 2, arriba - panza * 0.5, der - 3, arriba)
  g.quadraticCurveTo(der, arriba, der, arriba + 3)
  g.quadraticCurveTo(der + panza, medio, der, abajo - 3)
  g.quadraticCurveTo(der, abajo, der - 3, abajo)
  g.lineTo(izq + 3, abajo)
  g.quadraticCurveTo(izq, abajo, izq, abajo - 3)
  g.quadraticCurveTo(izq - panza, medio, izq, arriba + 3)
  g.quadraticCurveTo(izq, arriba, izq + 3, arriba)
  g.closePath()
  const cuero = g.createLinearGradient(0, arriba, 0, abajo)
  cuero.addColorStop(0, oscuro ? '#48494F' : '#2E2F34'); cuero.addColorStop(1, oscuro ? '#35363B' : '#1B1C20')
  g.fillStyle = cuero; g.fill()
  g.lineWidth = 1; g.strokeStyle = oscuro ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.35)'; g.stroke()

  const pliegue = arriba + c.alto * 0.42
  g.beginPath(); g.moveTo(izq + 3, pliegue); g.quadraticCurveTo(BW / 2, pliegue + 2 + panza * 0.5, der - 3, pliegue)
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.2; g.stroke()
  g.beginPath(); g.moveTo(izq + 3, pliegue + 1.4); g.quadraticCurveTo(BW / 2, pliegue + 3.4 + panza * 0.5, der - 3, pliegue + 1.4)
  g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; g.stroke()

  g.save(); g.setLineDash([2, 2]); g.lineWidth = 0.8; g.strokeStyle = 'rgba(255,255,255,.2)'
  g.beginPath()
  if (g.roundRect) g.roundRect(izq + 3.5, arriba + 3.5, der - izq - 7, c.alto - 7, 1.5)
  else g.rect(izq + 3.5, arriba + 3.5, der - izq - 7, c.alto - 7)
  g.stroke(); g.restore()

  g.beginPath(); g.moveTo(izq + 4, arriba + 0.8); g.quadraticCurveTo(BW / 2, arriba - panza * 0.5 + 0.8, der - 4, arriba + 0.8)
  g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1; g.stroke()
}

/* Los billetes en vuelo, en un lienzo encima de todo mientras dura el vuelo.
   Revolotean como papel (giran y se aplanan) y entran derechos al final. */
function lanzarBilletes(lienzo, n, origen, boca, alEntrar, alFin) {
  const g = lienzo.getContext('2d')
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  lienzo.width = Math.round(window.innerWidth * dpr); lienzo.height = Math.round(window.innerHeight * dpr)
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  const billetes = []
  for (let k = 0; k < n; k++) {
    const ox = origen.x + (n > 1 ? (k / (n - 1) - 0.5) : 0) * origen.ancho * 0.6
    const bx = boca.x + (Math.random() - 0.5) * 10
    billetes.push({
      ox, oy: origen.y, bx,
      cx: (ox + bx) / 2 + (Math.random() - 0.5) * 50,
      cy: Math.min(origen.y, boca.y) - 40 - Math.random() * 22,
      t0: performance.now() + k * 110, dur: 720 + Math.random() * 160,
      fase: Math.random() * Math.PI * 2, fase2: Math.random() * Math.PI * 2,
      rot0: (Math.random() - 0.5) * 0.5, color: COLORES[k % COLORES.length], vivo: true,
    })
  }
  let quedan = n
  const cuadro = () => {
    g.clearRect(0, 0, window.innerWidth, window.innerHeight)
    const ahora = performance.now()
    for (const b of billetes) {
      if (!b.vivo) continue
      const t = (ahora - b.t0) / b.dur
      if (t < 0) continue
      if (t >= 1) { b.vivo = false; alEntrar(); if (--quedan === 0) alFin(); continue }
      const u = 1 - t
      const x = u * u * b.ox + 2 * u * t * b.cx + t * t * b.bx
      const entra = t > 0.8 ? (t - 0.8) / 0.2 : 0
      const y = u * u * b.oy + 2 * u * t * b.cy + t * t * boca.y + entra * 10
      const calma = 1 - entra
      const rot = b.rot0 * u + Math.sin(t * 8 + b.fase) * 0.45 * (1 - t * 0.6) * calma
      const aplana = 1 - (1 - (0.35 + 0.65 * Math.abs(Math.cos(t * 6 + b.fase2)))) * calma
      g.save()
      g.globalAlpha = Math.min(1, t / 0.08) * (1 - entra * entra)
      g.translate(x, y); g.rotate(rot); g.scale(1 - entra * 0.2, aplana * (1 - entra * 0.2))
      dibujarBillete(g, 30, 16, b.color)
      g.restore()
    }
    if (quedan > 0) requestAnimationFrame(cuadro)
    else g.clearRect(0, 0, window.innerWidth, window.innerHeight)
  }
  requestAnimationFrame(cuadro)
}

/**
 * @param progreso `{ antes, ahora, meta, formatear, efectivo }` — números en la
 *   moneda del negocio y la función que los formatea.
 * @param origenRef el elemento del monto cobrado: de ahí salen los billetes.
 */
export default function LlevasHoy({ progreso, origenRef }) {
  const { antes, ahora, meta, formatear, efectivo } = progreso
  const refOdo = useRef(null)
  const refBilletera = useRef(null)
  const refVuelo = useRef(null)
  const refDelta = useRef(null)
  const monto = Math.max(0, ahora - antes)

  useEffect(() => {
    const billetera = refBilletera.current, odo = refOdo.current
    if (!billetera || !odo) return
    const fraccion = (v) => (meta > 0 ? Math.max(0, Math.min(1, v / meta)) : 0)
    let inflado = fraccion(antes)
    let rodillos = construirRodillos(odo, formatear(antes))
    pintarBilletera(billetera, inflado)
    const temporizadores = []
    let vivo = true

    const inflar = (destino) => {
      const desde = inflado, t0 = performance.now()
      const paso = (t1) => {
        if (!vivo) return
        const t = Math.min(1, (t1 - t0) / 240)
        inflado = desde + (destino - desde) * (1 - Math.pow(1 - t, 4))
        pintarBilletera(billetera, inflado)
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
      pintarBilletera(billetera, fraccion(ahora))
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
    } else {
      // Transferencia a la cuenta del negocio: el día sube, el bolsillo no se
      // llena de billetes que no están en él.
      temporizadores.push(setTimeout(() => {
        if (!vivo) return
        llega(); inflar(fraccion(ahora)); sonidoCobrado(); vibrar([10, 40, 22])
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
        </div>
        <span ref={refOdo} className="cf-rodillos" aria-live="polite" style={{
          fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 22, fontWeight: 700, letterSpacing: '-.01em',
        }} />
        {meta > 0 && (
          <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>de {formatear(meta)}</span>
        )}
      </div>
      <canvas ref={refBilletera} aria-hidden style={{ display: 'block', width: BW, height: BH }} />
      {/* Siempre montado y vacío: sin ancho hasta que vuela algo. */}
      <canvas ref={refVuelo} width={0} height={0} aria-hidden style={{
        position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 10003,
      }} />
      <style>{CSS_RODILLOS}</style>
    </div>
  )
}
