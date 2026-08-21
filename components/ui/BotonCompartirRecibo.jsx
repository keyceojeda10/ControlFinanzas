// components/ui/BotonCompartirRecibo.jsx
// Comparte el comprobante de pago como IMAGEN (PNG) directo al WhatsApp
// (o cualquier app) via la hoja de compartir nativa — sin descargar archivo.
// Pedido por cliente: "que el comprobante se pueda compartir en imagen
// directamente al WhatsApp y no descargar el archivo".
//
// Se dibuja en canvas (sin dependencias tipo html2canvas) reusando el mismo
// patron probado en QrClienteModal. En escritorio (sin navigator.share de
// archivos) cae a descarga del PNG.
'use client'

import { formatMoney } from '@/lib/i18n'
import { abreviaturaDocumento } from '@/lib/documento'
import { getDefaultCampos } from '@/components/recibos/CamposReciboEditor'
import { resolverCampo } from '@/components/ui/BotonImprimirRecibo'
// ⚠ La paleta del bloque oscuro se IMPORTA, no se copia: sus colores son
// distintos de los del tema claro a propósito (el dorado y el verde de la app
// no contrastan sobre #15161A) y tenerlos dos veces es como se desincronizan.
import { BLOQUE } from '@/components/cf/bloqueOscuro'

const SHARE_ICON = (
  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
  </svg>
)

function fmtFecha(d) {
  if (!d) return 'N/A'
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtFechaHora(d) {
  const f = d ? new Date(d) : new Date()
  /* Mes ENTERO y «a las». En corto el ICU nuevo escribe «7 de ago de 2026»,
     con un «de» de mas que chirria, y en un comprobante hay sitio de sobra
     para la fecha completa: es el papel al que se recurre cuando hay una
     discusion sobre si se pago o no. */
  return f.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
    + ' a las ' + f.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

// Dibuja el recibo termico en un canvas y lo devuelve.
// Exportada por la misma razón que `generarHTMLRecibo`: la imagen del recibo se
// pide desde los tres caminos y tiene que salir idéntica en todos.
/* ══ LOS COLORES DE LA MARCA, EN HEX ═══════════════════════════════════════
 *
 * ⚠ CANVAS NO RESUELVE `var(--cf-…)`, y NO AVISA. `ctx.strokeStyle =
 * 'var(--cf-border)'` no lanza nada: la propiedad se descarta y se queda el
 * valor anterior, que de fábrica es NEGRO. Este archivo dibujaba el marco del
 * recibo así, y de ahí el borde negro de 2px alrededor de todo: literalmente
 * «un cuadradito feo». El mismo fallo estaba en `FirmaDigital` (5 veces) y en
 * la pantalla de préstamo nuevo.
 *
 * Aquí van en hex, copiados de `app/tokens-2026.css`. Si cambia el dorado en
 * la app, cambia aquí. */
const TINTA = {
  gold: '#E7A400', goldInk: '#3A2900', goldTint: '#FDF3D6',
  ink: '#15161A', ink2: '#4A4E57', ink3: '#63676F', ink4: '#8E929A',
  green: '#12A150', greenTint: '#E8F6EE',
  card: '#FFFFFF', cardAlt: '#F9F9F6', border: '#E4E4E1', borderSoft: '#EDEDEA',
  surface: '#F1F1EC',   // el hueso del fondo: el PNG no puede salir transparente
}

/* Las familias REALES que está usando la página. `next/font` genera un nombre
   de familia distinto en cada compilación (`__Manrope_abc123`), así que no se
   puede escribir a mano: se lee del DOM. Si algo falla, sans del sistema. */
function familias() {
  try {
    const raiz = getComputedStyle(document.documentElement)
    const manrope = raiz.getPropertyValue('--font-manrope').trim()
    const grotesk = raiz.getPropertyValue('--font-space-grotesk').trim()
    const sistema = '"Segoe UI", system-ui, -apple-system, sans-serif'
    return {
      texto: manrope ? `${manrope}, ${sistema}` : sistema,
      cifra: grotesk ? `${grotesk}, ${sistema}` : sistema,
    }
  } catch {
    return { texto: 'sans-serif', cifra: 'sans-serif' }
  }
}


/* ══ LAS PIEZAS DEL PAPEL ══════════════════════════════════════════════════ */

/**
 * La silueta de un ticket: esquinas redondeadas y el borde de arriba y el de
 * abajo MORDIDOS por semicírculos.
 *
 * Es lo que más hace por el parecido con un comprobante de verdad, y es una
 * sola ruta —no un rectángulo con círculos del color del fondo encima—: así la
 * sombra sigue el contorno dentado en vez de quedarse recta por detrás.
 *
 * `paso` sale de dividir el ancho: con un número fijo de dientes cambian de
 * tamaño según el ancho, y con un tamaño fijo el último queda cortado.
 */
function siluetaTicket(ctx, x, y, w, h, r, radioDiente) {
  const dientes = Math.max(4, Math.round(w / (radioDiente * 2.6)))
  const paso = w / dientes
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  for (let i = 0; i < dientes; i++) {
    const cx = x + paso * (i + 0.5)
    ctx.lineTo(cx - radioDiente, y)
    ctx.arc(cx, y, radioDiente, Math.PI, 0, true)   // muerde hacia dentro
  }
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  for (let i = dientes - 1; i >= 0; i--) {
    const cx = x + paso * (i + 0.5)
    ctx.lineTo(cx + radioDiente, y + h)
    ctx.arc(cx, y + h, radioDiente, 0, Math.PI, true)
  }
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/** El separador de puntitos, como el del papel térmico. */
function punteado(ctx, x1, y, x2) {
  ctx.save()
  ctx.setLineDash([2, 5])
  ctx.strokeStyle = TINTA.border
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2, y)
  ctx.stroke()
  ctx.restore()
}

/** Un rectángulo redondeado, con salida para navegadores sin `roundRect`. */
function caja(ctx, x, y, w, h, r) {
  const radio = Math.min(r, h / 2, w / 2)
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, radio)
  else ctx.rect(x, y, w, h)
  return ctx
}

/** El visto de «recibido», DIBUJADO y no un emoji: los emoji no se pintan igual
    en cada teléfono y en varios salen como un cuadro hueco. */
function visto(ctx, cx, cy, r, color) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - r, cy)
  ctx.lineTo(cx - r * 0.25, cy + r * 0.75)
  ctx.lineTo(cx + r, cy - r * 0.8)
  ctx.stroke()
  ctx.restore()
}

/**
 * Parte un texto en renglones que quepan en `ancho`, sin cortar palabras.
 *
 * ⚠ AQUÍ SE PERDÍA EL NOMBRE DEL NEGOCIO. Antes se encogía la letra en un bucle
 * con suelo de 13px y, pasado ese suelo, lo que sobraba se iba fuera del papel y
 * el recorte del ticket se lo comía. Con un nombre normal no se nota; PRESTA MIL
 * usa de nombre una frase entera —«PRESTA MIL 3223846884 número SUPERVISOR para
 * información sobre su crédito o reclamos»— y en su comprobante se leía hasta
 * «reclam» y se acababa el mundo. Es el dato por el que el cliente sabe a quién
 * le pagó: no puede quedar cortado.
 */
function renglones(ctx, texto, ancho, maximo = 3) {
  const palabras = String(texto).split(/\s+/).filter(Boolean)
  const lineas = []
  let actual = ''
  for (const pal of palabras) {
    const prueba = actual ? `${actual} ${pal}` : pal
    if (ctx.measureText(prueba).width <= ancho || !actual) { actual = prueba; continue }
    lineas.push(actual)
    actual = pal
    if (lineas.length === maximo) break
  }
  if (lineas.length < maximo && actual) lineas.push(actual)
  return lineas.slice(0, maximo)
}

/**
 * El fondo de garabatos, como el del papel tapiz de WhatsApp.
 *
 * Lo pidió el dueño para que el comprobante se lea como algo hecho, no como una
 * captura. Son trazos del mundo del negocio —billete, moneda, visto, calendario
 * y las barras del logo— repartidos en una rejilla al tresbolillo y girados un
 * poco, para que no se vea la cuadrícula.
 *
 * ⚠ MUY FLOJO A PROPÓSITO. Es papel tapiz, no decoración: en cuanto se ve, le
 * quita sitio a la cifra, que es lo único que este papel tiene que responder.
 */
function garabatos(ctx, w, h, alfa = 0.055) {
  const PASO = 96
  ctx.save()
  ctx.globalAlpha = alfa
  ctx.strokeStyle = TINTA.ink3
  ctx.fillStyle = TINTA.ink3
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  let n = 0
  for (let fy = PASO * 0.5; fy < h + PASO; fy += PASO) {
    for (let fx = (n % 2 ? PASO * 0.5 : 0) + PASO * 0.5; fx < w + PASO; fx += PASO) {
      const cual = (n * 7 + Math.round(fx / PASO) * 3) % 5
      ctx.save()
      ctx.translate(fx, fy)
      // Giro fijo por posición: `Math.random()` daría un fondo distinto en cada
      // comprobante del mismo cobro, y el papel tiene que ser reproducible.
      ctx.rotate((((n * 13 + Math.round(fx / PASO) * 29) % 24) - 12) * Math.PI / 180)
      const R = 13
      if (cual === 0) {                       // billete
        ctx.beginPath(); ctx.rect(-R, -R * 0.62, R * 2, R * 1.24); ctx.stroke()
        ctx.beginPath(); ctx.arc(0, 0, R * 0.3, 0, Math.PI * 2); ctx.stroke()
      } else if (cual === 1) {                // moneda con el signo
        ctx.beginPath(); ctx.arc(0, 0, R * 0.85, 0, Math.PI * 2); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, -R * 0.5); ctx.lineTo(0, R * 0.5); ctx.stroke()
      } else if (cual === 2) {                // el visto
        ctx.beginPath()
        ctx.moveTo(-R * 0.7, 0); ctx.lineTo(-R * 0.15, R * 0.55); ctx.lineTo(R * 0.75, -R * 0.6)
        ctx.stroke()
      } else if (cual === 3) {                // calendario
        ctx.beginPath(); ctx.rect(-R * 0.8, -R * 0.7, R * 1.6, R * 1.5); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(-R * 0.8, -R * 0.2); ctx.lineTo(R * 0.8, -R * 0.2); ctx.stroke()
      } else {                                // las tres barras de la marca
        const anc = R * 0.32
        ;[R * 0.5, R * 0.85, R * 1.2].forEach((alto, i) => {
          ctx.beginPath()
          ctx.rect(-R * 0.75 + i * (anc * 1.7), R * 0.6 - alto, anc, alto)
          ctx.stroke()
        })
      }
      ctx.restore()
      n++
    }
    n++
  }
  ctx.restore()
}

/** Una fila de dato: rótulo a la izquierda, valor a la derecha. */
function fila(ctx, L, R, y, rotulo, valor, SANS, MONO) {
  ctx.textAlign = 'left'
  ctx.fillStyle = TINTA.ink3
  ctx.font = `14px ${SANS}`
  ctx.fillText(String(rotulo), L, y)

  /* El valor encoge hasta caber en su mitad; no se recorta. Y va en la familia
     de las cifras cuando es dinero, para que las columnas queden a plomo. */
  const esCifra = /^[$\d]/.test(String(valor).trim())
  const anchoRotulo = ctx.measureText(String(rotulo)).width
  const disponible = (R - L) - anchoRotulo - 16
  let t = 17
  ctx.font = `600 ${t}px ${esCifra ? MONO : SANS}`
  while (t > 11 && ctx.measureText(String(valor)).width > disponible) {
    t -= 1
    ctx.font = `600 ${t}px ${esCifra ? MONO : SANS}`
  }
  ctx.textAlign = 'right'
  ctx.fillStyle = TINTA.ink
  ctx.fillText(String(valor), R, y)
  ctx.textAlign = 'left'
}

/** La línea fina que separa bloques. */
function hairline(ctx, x1, y, x2) {
  ctx.save()
  ctx.strokeStyle = TINTA.borderSoft
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x1, y + 0.5)
  ctx.lineTo(x2, y + 0.5)
  ctx.stroke()
  ctx.restore()
}

/* ══ EL COMPROBANTE ════════════════════════════════════════════════════════
 *
 * El dueño trajo el de Nequi de referencia y de ahí vienen la SILUETA DENTADA
 * —lo que hace que se lea como un recibo y no como una tarjeta—, el ESTADO
 * arriba y los datos APILADOS, que con nombres largos no se pelean por el ancho
 * como sí lo hacían en dos columnas.
 *
 * ── ⚠ LA VERSIÓN ANTERIOR ROMPÍA LA REGLA 1 DEL SISTEMA ───────────────────
 *
 * Tenía una banda dorada de cabecera. `components/cf/bloqueOscuro.js` lo dice
 * con todas las letras: **«el fondo dorado no es un estilo, es un error de
 * sistema»**. El dorado está reservado a tres cosas —el monto principal, la
 * acción primaria y el foco del campo activo— así que con el fondo entero
 * dorado el monto queda del color de su propia caja y el ojo no encuentra dónde
 * mirar. Por eso se veía plano: no había jerarquía, solo una franja de color.
 *
 * Ahora habla el idioma que el dueño ya ve todos los días en la app:
 *
 *   · La cifra que resuelve el papel va en **bloque oscuro** (radio 20), y
 *     dentro va en **dorado**. Una por documento, como manda «una pantalla, una
 *     respuesta».
 *   · La superficie es **blanca**; el estado va en una **pastilla**, nunca
 *     tiñendo el fondo.
 *   · Los radios salen de la escala cerrada: 20 el bloque, 18 el papel, 999 la
 *     pastilla. No hay ninguno inventado.
 *
 * ── LO QUE NO SE COPIA DE NEQUI, Y POR QUÉ ────────────────────────────────
 *
 *   · **El QR.** El único que existe —`/qr/{cliente}`— es del COBRADOR: abre la
 *     pantalla de cobro y pide sesión. En un papel que va al deudor por
 *     WhatsApp no sirve. El portal del cliente sí tiene enlace, pero se entra
 *     con teléfono y PIN: un QR a una puerta que quizá no puede abrir es peor
 *     que ninguno.
 *   · **La ilustración de fondo.** La de Nequi la hizo un ilustrador. La marca
 *     de agua de aquí son las tres barras del logo, geometría pura.
 */
export function dibujarRecibo(cliente, prestamo, pago, orgNombre, camposRecibo) {
  /* ⚠ 540 DE ANCHO, NO 620, Y VERTICAL. A escala 2 salen 1080 px de ancho, que
     es la medida de una foto de móvil, y el papel deja de ser casi cuadrado. Lo
     pidió el dueño: «hacerlo más largo, más ordenado, el tamaño como el
     estándar de móvil». La altura crece con el contenido pero nunca baja de
     16:9, así que el pie siempre cae abajo del todo como en un recibo de
     verdad. */
  const W = 540
  const { texto: SANS, cifra: MONO } = familias()

  const campos = (Array.isArray(camposRecibo) && camposRecibo.length > 0)
    ? camposRecibo
    : getDefaultCampos()
  const tieneCedula = cliente?.cedula && !String(cliente.cedula).startsWith('SIN-')

  /* Las filas de dato, ya resueltas. El cliente y su documento salen de aquí:
     van arriba y en grande, que es lo primero que se mira al recibir el papel. */
  const filas = campos
    .map((c) => [c.nombre, c.tipo === 'texto' ? c.valor : resolverCampo(c.campo, cliente, prestamo)])
    .filter(([, v]) => v != null && String(v).trim() !== '' && String(v) !== '-' && String(v) !== '—')

  // El progreso se saca de las filas para pintarlo como barra, que dice más que
  // un número suelto y llena el papel sin ruido.
  const iProg = filas.findIndex(([r]) => /progreso/i.test(String(r)))
  const progreso = iProg >= 0 ? filas.splice(iProg, 1)[0] : null
  const pct = progreso ? Math.max(0, Math.min(100, parseFloat(String(progreso[1])) || 0)) : null

  const referencia = pago?.id ? String(pago.id).slice(-8).toUpperCase() : null

  const MARGEN = 30          // el papel tapiz se ve por aquí
  const PAD = 30
  const L0 = MARGEN + PAD
  const R0 = W - MARGEN - PAD
  const ANCHO_TEXTO = R0 - L0

  /* La altura se MIDE antes de crear el lienzo: el nombre del negocio puede
     ocupar uno, dos o tres renglones y el número de filas depende de lo que el
     prestamista haya configurado. */
  const medidor = document.createElement('canvas').getContext('2d')
  medidor.font = `700 26px ${SANS}`
  const lineasOrg = renglones(medidor, orgNombre || 'Mi negocio', ANCHO_TEXTO, 3)

  const ALTO_CABECERA = 30 + 18 + lineasOrg.length * 32 + 26
  const ALTO_BLOQUE = 168
  const ALTO_CLIENTE = 84
  const ALTO_FILA = 40
  const ALTO_PROGRESO = pct == null ? 0 : 62
  const ALTO_PIE = referencia ? 92 : 66
  const contenido = ALTO_CABECERA + ALTO_BLOQUE + 26 + ALTO_CLIENTE + 18
    + filas.length * ALTO_FILA + ALTO_PROGRESO + ALTO_PIE
  const H = Math.max(Math.round(W * 16 / 9), contenido + MARGEN * 2 + PAD * 2)

  /* ⚠ EL AIRE QUE SOBRA SE REPARTE, no se amontona. Con pocas filas el papel
     llegaba al alto de móvil dejando un vacío blanco de un palmo justo encima
     del pie, y parecía que faltaba algo. Repartido entre las filas, el
     comprobante respira de arriba abajo y se lee más ordenado, que es lo que
     pidió el dueño. El tope evita que con dos filas queden separadas media
     página. */
  const sobra = Math.max(0, H - contenido - MARGEN * 2 - PAD * 2)
  const ALTO_FILA_REAL = ALTO_FILA + Math.min(20, sobra / Math.max(1, filas.length + 2))

  const escala = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * escala
  canvas.height = H * escala
  const ctx = canvas.getContext('2d')
  ctx.scale(escala, escala)

  /* El fondo NO se deja transparente: un PNG con alfa sale sobre negro en
     varias vistas de WhatsApp y el recibo acaba ilegible. */
  ctx.fillStyle = TINTA.surface
  ctx.fillRect(0, 0, W, H)
  garabatos(ctx, W, H)

  const x0 = MARGEN, y0 = MARGEN
  const w = W - MARGEN * 2, h = H - MARGEN * 2
  const L = L0, R = R0

  siluetaTicket(ctx, x0, y0, w, h, 18, 9)
  ctx.save()
  ctx.shadowColor = 'rgba(20,20,28,.14)'
  ctx.shadowBlur = 22
  ctx.shadowOffsetY = 6
  ctx.fillStyle = TINTA.card
  ctx.fill()
  ctx.restore()

  ctx.save()
  siluetaTicket(ctx, x0, y0, w, h, 18, 9)
  ctx.clip()
  /* El MISMO papel tapiz por dentro, más flojo y en las mismas coordenadas: se
     lee como una sola tela vista a través del papel, y de paso llena el hueco
     que queda entre los datos y el pie cuando el comprobante tiene pocas filas.
     Antes ahí había un vacío blanco enorme.

     Sustituye a la marca de agua de las tres barras, que además caía justo
     detrás de «Referencia» y se leían encima una de otra. */
  garabatos(ctx, W, H, 0.028)

  // ── Quién lo emite ──────────────────────────────────────────────────────
  let y = y0 + 46
  ctx.textAlign = 'left'
  ctx.fillStyle = TINTA.ink4
  ctx.font = `600 11px ${SANS}`
  ctx.fillText('COMPROBANTE DE PAGO', L, y)

  y += 34
  ctx.fillStyle = TINTA.ink
  ctx.font = `700 26px ${SANS}`
  for (const linea of lineasOrg) {
    ctx.fillText(linea, L, y)
    y += 32
  }

  y += 8
  hairline(ctx, L, y, R)

  // ── El bloque oscuro: la cifra que resuelve el papel ────────────────────
  y += 24
  const bh = ALTO_BLOQUE - 26
  caja(ctx, L, y, R - L, bh, 20)
  ctx.fillStyle = BLOQUE.fondo
  ctx.fill()

  ctx.fillStyle = BLOQUE.rotulo
  ctx.font = `13px ${SANS}`
  ctx.fillText('Pagó', L + 24, y + 36)

  /* La pastilla del estado, arriba a la derecha del bloque. El estado va en el
     acento y nunca tiñendo la superficie. */
  const rot = 'RECIBIDO'
  ctx.font = `700 11px ${SANS}`
  const anchoP = ctx.measureText(rot).width + 32
  caja(ctx, R - 24 - anchoP, y + 22, anchoP, 26, 999)
  ctx.fillStyle = 'rgba(18,161,80,.20)'
  ctx.fill()
  visto(ctx, R - 24 - anchoP + 12, y + 35, 5, '#5BD98A')
  ctx.fillStyle = '#5BD98A'
  ctx.fillText(rot, R - 24 - anchoP + 27, y + 39)

  /* La cifra: dorado sobre carbón, encogiendo si hace falta. Es lo único
     dorado del documento. */
  const monto = formatMoney(pago?.montoPagado ?? 0)
  let tc = 54
  ctx.font = `700 ${tc}px ${MONO}`
  while (tc > 24 && ctx.measureText(monto).width > R - L - 48) {
    tc -= 2
    ctx.font = `700 ${tc}px ${MONO}`
  }
  ctx.fillStyle = BLOQUE.oro
  ctx.fillText(monto, L + 24, y + 100)

  ctx.fillStyle = BLOQUE.apagado
  ctx.font = `13px ${SANS}`
  ctx.fillText(fmtFechaHora(pago?.fechaPago), L + 24, y + bh - 22)

  // ── A quién ─────────────────────────────────────────────────────────────
  y += ALTO_BLOQUE + 10
  ctx.fillStyle = TINTA.ink4
  ctx.font = `600 11px ${SANS}`
  ctx.fillText('CLIENTE', L, y)

  /* ⚠ El nombre NO se recorta: se encoge hasta que entra. Es lo que identifica
     a la persona, y cortado no sirve para nada. */
  y += 30
  let tn = 24
  ctx.font = `700 ${tn}px ${SANS}`
  while (tn > 13 && ctx.measureText(cliente?.nombre ?? '—').width > ANCHO_TEXTO) {
    tn -= 1
    ctx.font = `700 ${tn}px ${SANS}`
  }
  ctx.fillStyle = TINTA.ink
  ctx.fillText(cliente?.nombre ?? '—', L, y)

  if (tieneCedula) {
    y += 24
    ctx.fillStyle = TINTA.ink3
    ctx.font = `14px ${SANS}`
    ctx.fillText(`${abreviaturaDocumento()} ${cliente.cedula}`, L, y)
  }

  y += 26
  hairline(ctx, L, y, R)

  // ── Los datos, en dos columnas ──────────────────────────────────────────
  //
  // Antes iban APILADOS —rótulo encima, valor debajo— y por eso el papel salía
  // largo y desordenado, con la mitad derecha vacía. En dos columnas se lee de
  // un vistazo y las cifras quedan a plomo.
  y += 30
  for (const [rotulo, valor] of filas) {
    fila(ctx, L, R, y, rotulo, valor, SANS, MONO)
    y += ALTO_FILA_REAL
  }

  // ── El progreso, como barra ─────────────────────────────────────────────
  if (pct != null) {
    y -= 6
    fila(ctx, L, R, y, progreso[0], `${Math.round(pct)}%`, SANS, MONO)
    y += 18
    caja(ctx, L, y, R - L, 8, 999)
    ctx.fillStyle = TINTA.borderSoft
    ctx.fill()
    if (pct > 0) {
      caja(ctx, L, y, Math.max(8, (R - L) * pct / 100), 8, 999)
      ctx.fillStyle = TINTA.green
      ctx.fill()
    }
    y += 34
  }

  // ── El pie, siempre abajo del todo ──────────────────────────────────────
  y = y0 + h - (referencia ? 86 : 56)
  punteado(ctx, L, y, R)

  if (referencia) {
    y += 30
    fila(ctx, L, R, y, 'Referencia', referencia, SANS, SANS)
    y += 30
  } else {
    y += 28
  }
  ctx.textAlign = 'left'
  ctx.fillStyle = TINTA.ink4
  ctx.font = `11px ${SANS}`
  // Dice el papel que cumple, no solo el nombre: esta imagen se le manda al
  // deudor por WhatsApp y es de lo poco que se queda en su teléfono.
  ctx.fillText('Software de gestión: Control Finanzas · no presta dinero ni realiza cobros', L, y)

  ctx.restore()
  return canvas
}

export default function BotonCompartirRecibo({ cliente, prestamo, pago, orgNombre = '', camposRecibo, label = 'Compartir recibo' }) {
  const handleClick = () => {
    let canvas
    try {
      canvas = dibujarRecibo(cliente, prestamo, pago, orgNombre, camposRecibo)
    } catch {
      return
    }
    const nombre = `Recibo-${(cliente?.nombre || 'pago').replace(/\s+/g, '-')}.png`
    canvas.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], nombre, { type: 'image/png' })
      // Compartir nativo con archivo adjunto (movil): WhatsApp aparece en la hoja
      // con la imagen ya pegada, sin pasar por descargas.
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Comprobante de pago',
            text: `Comprobante de pago${orgNombre ? ` - ${orgNombre}` : ''}`,
          })
        } catch { /* usuario cancelo */ }
        return
      }
      // Fallback escritorio: descargar el PNG.
      const link = document.createElement('a')
      link.download = nombre
      link.href = canvas.toDataURL('image/png')
      link.click()
    }, 'image/png')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex-1 flex items-center justify-center gap-2 px-3 h-10 rounded-[12px] text-sm font-medium transition-all cursor-pointer bg-[var(--cf-surface)] border border-[var(--cf-border)] text-[var(--cf-ink-3)] hover:text-[var(--cf-ink)] hover:border-[var(--cf-gold)]"
    >
      {SHARE_ICON}
      {label}
    </button>
  )
}
