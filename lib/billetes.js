// lib/billetes.js
//
// ══ LOS BILLETES Y LA BILLETERA ════════════════════════════════════════════
//
// Aprobados por el dueño el 19 sep 2026. Los comparten el comprobante del cobro
// (`LlevasHoy`), la entrega de un préstamo y el cierre de caja, para que el
// billete que entra al cobrar sea el mismo que sale al prestar o al entregar.
//
// Todo en <canvas>: se dibuja una vez por cuadro y solo mientras se mueve, sin
// tocar el árbol de React. Nada de esto decide plata: quien lo usa decide SI
// vuelan billetes (con `entraAlFajo`), aquí solo se pintan.

export const BW = 84
export const BH = 68
// Billetes genéricos, de tres colores: no copian ningún billete real.
export const COLORES = [['#D4E6C4', '#5E8A4E'], ['#EFD3C6', '#A8705A'], ['#CCDAEB', '#5F7FA6']]

export function dibujarBillete(g, w, h, [fondo, tinta]) {
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
export const ASOMAN = (() => {
  let semilla = 919
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647
  return Array.from({ length: 8 }, (_, k) => ({
    dx: (azar() - 0.5) * 18, giro: (azar() - 0.5) * 0.28, asoma: 5 + azar() * 9, color: COLORES[k % COLORES.length],
  }))
})()

export const cuerpo = (p) => {
  const alto = 30 + 10 * p
  return { alto, arriba: BH - 4 - alto, abajo: BH - 4, izq: 6, der: BW - 6, panza: 3 * p }
}

/* La billetera: cuero negro, esquinas rectas, costura del mismo tono («un poco
   más varonil», el dueño). Más llena, más alta, más panza y más billetes. */
export function pintarBilletera(lienzo, inflado) {
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
export function lanzarBilletes(lienzo, n, origen, boca, alEntrar, alFin) {
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
 * Billetes que SALEN: de `origen` hacia `destino` (el cliente al prestar, fuera
 * de la pantalla al entregar la caja). Mismo revoloteo que al entrar; al final
 * se desvanecen en vez de meterse en nada.
 */
export function soltarBilletes(lienzo, n, origen, destino, alSalir, alFin) {
  const g = lienzo.getContext('2d')
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  lienzo.width = Math.round(window.innerWidth * dpr); lienzo.height = Math.round(window.innerHeight * dpr)
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  const billetes = Array.from({ length: n }, (_, k) => {
    const ox = origen.x + (n > 1 ? (k / (n - 1) - 0.5) : 0) * (origen.ancho || 0) * 0.6
    const dx = destino.x + (destino.dispersion ? (Math.random() - 0.5) * destino.dispersion : 0)
    return {
      ox, oy: origen.y, dx, dy: destino.y,
      cx: (ox + dx) / 2 + (Math.random() - 0.5) * 60,
      cy: Math.min(origen.y, destino.y) - 40 - Math.random() * 30,
      t0: performance.now() + k * 110, dur: 740 + Math.random() * 160,
      fase: Math.random() * Math.PI * 2, fase2: Math.random() * Math.PI * 2,
      rot0: (Math.random() - 0.5) * 0.5, color: COLORES[k % COLORES.length], vivo: true, salio: false,
    }
  })
  let quedan = n
  const cuadro = () => {
    g.clearRect(0, 0, window.innerWidth, window.innerHeight)
    const ahora = performance.now()
    for (const b of billetes) {
      if (!b.vivo) continue
      const t = (ahora - b.t0) / b.dur
      if (t < 0) continue
      if (!b.salio) { b.salio = true; alSalir?.() }
      if (t >= 1) { b.vivo = false; if (--quedan === 0) alFin?.(); continue }
      const u = 1 - t
      const x = u * u * b.ox + 2 * u * t * b.cx + t * t * b.dx
      const y = u * u * b.oy + 2 * u * t * b.cy + t * t * b.dy
      g.save()
      g.globalAlpha = Math.min(1, t / 0.08) * (1 - Math.max(0, (t - 0.75) / 0.25))
      g.translate(x, y)
      g.rotate(b.rot0 * u + Math.sin(t * 8 + b.fase) * 0.45 * (1 - t * 0.6))
      g.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(t * 6 + b.fase2)))
      dibujarBillete(g, 30, 16, b.color)
      g.restore()
    }
    if (quedan > 0) requestAnimationFrame(cuadro)
    else g.clearRect(0, 0, window.innerWidth, window.innerHeight)
  }
  requestAnimationFrame(cuadro)
}

/* ══ LA TRANSFERENCIA ══════════════════════════════════════════════════════
   Una transferencia no son billetes: no revolotea como papel. Es una
   notificación que viaja derecha, con una estela corta, del monto recibido al
   teléfono. (El dueño, 19 sep: «si no salen billetes porque es Nequi, que llegue
   el dinero al teléfono… no quitar la animación».) */
function dibujarAviso(g, alfa) {
  g.globalAlpha = alfa
  g.beginPath()
  if (g.roundRect) g.roundRect(-16, -10, 32, 20, 6); else g.rect(-16, -10, 32, 20)
  g.fillStyle = '#12A150'; g.fill()
  // Flecha que entra: la plata llegando.
  g.strokeStyle = '#FFFFFF'; g.lineWidth = 2; g.lineCap = 'round'; g.lineJoin = 'round'
  g.beginPath(); g.moveTo(-6, -4); g.lineTo(4, 5); g.moveTo(4, -2); g.lineTo(4, 5); g.lineTo(-3, 5); g.stroke()
}

export function lanzarNotificacion(lienzo, origen, destino, alLlegar) {
  const g = lienzo.getContext('2d')
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  lienzo.width = Math.round(window.innerWidth * dpr); lienzo.height = Math.round(window.innerHeight * dpr)
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  const cx = (origen.x + destino.x) / 2 - 30, cy = Math.min(origen.y, destino.y) - 30
  const t0 = performance.now(), dur = 620
  const punto = (t) => {
    const u = 1 - t
    return [u * u * origen.x + 2 * u * t * cx + t * t * destino.x, u * u * origen.y + 2 * u * t * cy + t * t * destino.y]
  }
  const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  const cuadro = () => {
    g.clearRect(0, 0, window.innerWidth, window.innerHeight)
    const t = Math.min(1, (performance.now() - t0) / dur)
    // La estela: tres copias más atrás y más tenues.
    for (let k = 3; k >= 0; k--) {
      const tk = suave(Math.max(0, t - k * 0.05))
      const [x, y] = punto(tk)
      g.save(); g.translate(x, y); g.scale(1 - t * 0.35, 1 - t * 0.35)
      dibujarAviso(g, (k === 0 ? 1 : 0.18 / k) * (t > 0.85 ? (1 - t) / 0.15 : 1))
      g.restore()
    }
    if (t < 1) requestAnimationFrame(cuadro)
    else { g.clearRect(0, 0, window.innerWidth, window.innerHeight); alLlegar?.() }
  }
  requestAnimationFrame(cuadro)
}
