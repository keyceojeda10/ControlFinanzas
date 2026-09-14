// lib/recibo-dibujo.js — Las piezas de trazo con las que se dibuja el recibo.
//
// Vive aparte del boton a proposito: es dibujo puro sobre un `CanvasRenderingContext2D`,
// no interfaz, asi que se puede probar sin montar React y lo puede reusar
// cualquier papel que se genere como imagen.
//
// ⚠ TODO ES TRAZO, NADA ES EMOJI. Los emoji no se pintan igual en cada telefono
// y en varios salen como un cuadro hueco; el recibo se manda por WhatsApp y
// tiene que verse identico en el Android de $300.000 del cliente y en el iPhone
// del dueño. Cada icono se dibuja dentro de una caja de 24×24 y se escala al
// vuelo, asi que tampoco se pixela al ampliar el PNG.

/* ══ LOS ICONOS ════════════════════════════════════════════════════════════ */
export const ICONOS = {
  billete(c) {
    c.beginPath(); c.roundRect(1.5, 6, 21, 12, 2.5); c.stroke()
    c.beginPath(); c.arc(12, 12, 3.2, 0, Math.PI * 2); c.stroke()
    c.beginPath(); c.moveTo(5, 12); c.lineTo(5.6, 12); c.moveTo(18.4, 12); c.lineTo(19, 12); c.stroke()
  },
  moneda(c) {
    c.beginPath(); c.arc(12, 12, 8.5, 0, Math.PI * 2); c.stroke()
    c.beginPath(); c.moveTo(12, 7.5); c.lineTo(12, 16.5); c.stroke()
    c.beginPath(); c.moveTo(14.6, 9.6); c.bezierCurveTo(13, 8.2, 9.8, 8.5, 9.8, 10.6)
    c.bezierCurveTo(9.8, 13.4, 14.4, 12.2, 14.4, 14.4)
    c.bezierCurveTo(14.4, 16.2, 11, 16.2, 9.4, 14.8); c.stroke()
  },
  visto(c) {
    c.beginPath(); c.arc(12, 12, 9, 0, Math.PI * 2); c.stroke()
    c.beginPath(); c.moveTo(7.8, 12.2); c.lineTo(10.8, 15.1); c.lineTo(16.4, 9.2); c.stroke()
  },
  calendario(c) {
    c.beginPath(); c.roundRect(3, 5, 18, 16, 2.5); c.stroke()
    c.beginPath(); c.moveTo(3, 10); c.lineTo(21, 10); c.stroke()
    c.beginPath(); c.moveTo(8, 2.6); c.lineTo(8, 6.4); c.moveTo(16, 2.6); c.lineTo(16, 6.4); c.stroke()
    c.beginPath(); c.moveTo(8, 14.4); c.lineTo(8.3, 14.4); c.moveTo(12, 14.4); c.lineTo(12.3, 14.4)
    c.moveTo(16, 14.4); c.lineTo(16.3, 14.4); c.moveTo(8, 17.6); c.lineTo(8.3, 17.6)
    c.moveTo(12, 17.6); c.lineTo(12.3, 17.6); c.stroke()
  },
  reloj(c) {
    c.beginPath(); c.arc(12, 12, 9, 0, Math.PI * 2); c.stroke()
    c.beginPath(); c.moveTo(12, 7); c.lineTo(12, 12.4); c.lineTo(15.6, 14.4); c.stroke()
  },
  persona(c) {
    c.beginPath(); c.arc(12, 8.6, 4, 0, Math.PI * 2); c.stroke()
    c.beginPath(); c.moveTo(4.4, 20.2); c.bezierCurveTo(4.4, 15.6, 8, 14, 12, 14)
    c.bezierCurveTo(16, 14, 19.6, 15.6, 19.6, 20.2); c.stroke()
  },
  bolsa(c) {
    c.beginPath(); c.moveTo(9.4, 6.4); c.lineTo(8.2, 3.2); c.lineTo(15.8, 3.2); c.lineTo(14.6, 6.4); c.stroke()
    c.beginPath(); c.moveTo(9.4, 6.4); c.bezierCurveTo(4.4, 9.4, 3.6, 20.6, 12, 20.6)
    c.bezierCurveTo(20.4, 20.6, 19.6, 9.4, 14.6, 6.4); c.stroke()
    c.beginPath(); c.moveTo(12, 10.4); c.lineTo(12, 16.4); c.stroke()
  },
  recibo(c) {
    c.beginPath()
    c.moveTo(5, 3.4); c.lineTo(19, 3.4); c.lineTo(19, 20.6); c.lineTo(16.6, 19); c.lineTo(14.2, 20.6)
    c.lineTo(11.8, 19); c.lineTo(9.4, 20.6); c.lineTo(7, 19); c.lineTo(5, 20.6); c.closePath(); c.stroke()
    c.beginPath(); c.moveTo(8.4, 8); c.lineTo(15.6, 8); c.moveTo(8.4, 12); c.lineTo(15.6, 12); c.stroke()
  },
  grafico(c) {
    c.beginPath(); c.moveTo(3.6, 20); c.lineTo(20.4, 20); c.stroke()
    c.beginPath(); c.moveTo(4.6, 15.6); c.lineTo(9.4, 10.6); c.lineTo(13, 14); c.lineTo(19.4, 6.6); c.stroke()
    c.beginPath(); c.moveTo(15.2, 6.6); c.lineTo(19.8, 6.6); c.lineTo(19.8, 11); c.stroke()
  },
  candado(c) {
    c.beginPath(); c.roundRect(4.6, 10.4, 14.8, 10.2, 2.4); c.stroke()
    c.beginPath(); c.arc(12, 10.2, 4.4, Math.PI, 0); c.stroke()
    c.beginPath(); c.arc(12, 15.2, 1.3, 0, Math.PI * 2); c.stroke()
  },
  telefono(c) {
    c.beginPath(); c.roundRect(7, 2.6, 10, 18.8, 2.4); c.stroke()
    c.beginPath(); c.moveTo(10.6, 5.4); c.lineTo(13.4, 5.4); c.stroke()
    c.beginPath(); c.arc(12, 18.4, 1, 0, Math.PI * 2); c.stroke()
  },
  pin(c) {
    c.beginPath(); c.moveTo(12, 21); c.bezierCurveTo(5, 14.6, 4, 12.4, 4, 9.6)
    c.bezierCurveTo(4, 5.4, 7.6, 2.8, 12, 2.8); c.bezierCurveTo(16.4, 2.8, 20, 5.4, 20, 9.6)
    c.bezierCurveTo(20, 12.4, 19, 14.6, 12, 21); c.closePath(); c.stroke()
    c.beginPath(); c.arc(12, 9.4, 3, 0, Math.PI * 2); c.stroke()
  },
  hucha(c) {
    c.beginPath(); c.moveTo(4.4, 13.4); c.bezierCurveTo(4.4, 8.6, 8.4, 6.4, 12.4, 6.4)
    c.bezierCurveTo(17, 6.4, 20, 9.2, 20, 12.6); c.bezierCurveTo(20, 16.4, 16.6, 18.6, 12.4, 18.6)
    c.bezierCurveTo(8, 18.6, 4.4, 16.6, 4.4, 13.4); c.closePath(); c.stroke()
    c.beginPath(); c.moveTo(7, 18); c.lineTo(7, 20.6); c.moveTo(17, 17.4); c.lineTo(17, 20.6); c.stroke()
    c.beginPath(); c.moveTo(10, 9.4); c.lineTo(14, 9.4); c.stroke()
    c.beginPath(); c.arc(18.4, 11.6, 0.7, 0, Math.PI * 2); c.stroke()
    c.beginPath(); c.moveTo(9.8, 6.2); c.lineTo(11.6, 3.6); c.stroke()
  },
}

/** Dibuja un icono centrado en (cx,cy) al tamaño pedido. */
export function ico(ctx, nombre, cx, cy, tam, color, grosor) {
  const f = ICONOS[nombre]
  if (!f) return
  ctx.save()
  ctx.translate(cx, cy)
  const k = tam / 24
  ctx.scale(k, k)
  ctx.translate(-12, -12)
  ctx.strokeStyle = color
  // El grosor se divide por la escala o los iconos pequeños salen gordos y los
  // grandes, de hilo.
  ctx.lineWidth = (grosor || 1.7) / k
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  f(ctx)
  ctx.restore()
}

/* ══ LA REJILLA ════════════════════════════════════════════════════════════
 *
 * ⚠ EL SALTO DE COLUMNA TIENE QUE SER COPRIMO CON EL TAMAÑO DE LA LISTA. Con
 * diez iconos y un salto de 5, `c*5 % 10` solo da 0 y 5: la fila entera sale
 * del mismo par de dibujos y se ve la repeticion a un metro. Ya paso dos veces
 * (una fila entera de relojes en oro), asi que el salto SE ELIGE, no se supone.
 */
export function mcd(a, b) { while (b) { const t = a % b; a = b; b = t } return a }
export function salto(largo) { return [7, 5, 3, 2].find((k) => mcd(k, largo) === 1) || 1 }

/**
 * Iconos repartidos en cuadricula dentro de (x,y,w,h).
 *
 * Calcula filas y columnas ENTERAS y las centra, asi que ningun icono queda
 * partido por el borde — es la diferencia con una trama recortada, que siempre
 * deja medios dibujos pegados al margen.
 *
 * Con `color2` mezcla dos matices en la misma pasada: uno de cada tres sale en
 * el segundo color. Dos rejillas superpuestas darian el doble de dibujos.
 */
export function rejilla(ctx, x, y, w, h, o = {}) {
  const paso = o.paso || 44
  const tam = o.tam || 18
  const lista = o.lista || Object.keys(ICONOS)
  const k = salto(lista.length)
  const cols = Math.max(1, Math.floor(w / paso))
  const filas = Math.max(1, Math.floor(h / paso))
  const x0 = x + (w - cols * paso) / 2
  const y0 = y + (h - filas * paso) / 2
  const alfa = o.alfa == null ? 0.12 : o.alfa
  if (alfa <= 0) return
  ctx.save()
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < cols; c++) {
      const n = lista[((f + (o.semilla || 0)) * 3 + c * k) % lista.length]
      const dos = o.color2 && (((f * 2 + c) % 3) === 0)
      ctx.globalAlpha = dos ? (o.alfa2 == null ? alfa : o.alfa2) : alfa
      ico(ctx, n, x0 + paso * (c + 0.5), y0 + paso * (f + 0.5), tam,
        (dos ? o.color2 : o.color) || '#FFFFFF', o.g || 1.6)
    }
  }
  ctx.restore()
}

/* ══ PIEZAS SUELTAS ════════════════════════════════════════════════════════ */

/** La inicial del negocio en su cuadro. */
export function monograma(ctx, x, y, s, letra, fondo, tinta, borde, fam) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, s, s, s * 0.3)
  else ctx.rect(x, y, s, s)
  ctx.fillStyle = fondo
  ctx.fill()
  if (borde) { ctx.strokeStyle = borde; ctx.lineWidth = 1.4; ctx.stroke() }
  ctx.textAlign = 'center'
  ctx.fillStyle = tinta
  ctx.font = `800 ${Math.round(s * 0.46)}px ${fam}`
  ctx.fillText(String(letra || 'C').toUpperCase(), x + s / 2, y + s * 0.66)
  ctx.textAlign = 'left'
}

/** Encoge la letra hasta que el texto entre en `ancho`. Devuelve el tamaño. */
export function encoge(ctx, txt, ancho, base, min, peso, fam) {
  let t = base
  ctx.font = `${peso} ${t}px ${fam}`
  while (t > min && ctx.measureText(txt).width > ancho) {
    t -= 1
    ctx.font = `${peso} ${t}px ${fam}`
  }
  return t
}

/** Barra apilada: cada tramo con su color, sin huecos entre ellos. */
export function apilada(ctx, x, y, w, partes, alto, fondo) {
  const h = alto || 9
  const total = partes.reduce((a, p) => a + p.v, 0) || 1
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 999); else ctx.rect(x, y, w, h)
  ctx.fillStyle = fondo
  ctx.fill()
  ctx.save()
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 999); else ctx.rect(x, y, w, h)
  ctx.clip()
  let cx = x
  for (const p of partes) {
    if (p.v <= 0) continue
    const pw = w * p.v / total
    ctx.fillStyle = p.color
    // +1 px de solape: sin el, entre tramo y tramo asoma una linea del fondo.
    ctx.fillRect(cx, y, pw + 1, h)
    cx += pw
  }
  ctx.restore()
}

/** Una linea de 1px, al pixel entero para que no salga borrosa. */
export function raya(ctx, x1, y, x2, color) {
  ctx.fillStyle = color
  ctx.fillRect(x1, Math.round(y), x2 - x1, 1)
}
