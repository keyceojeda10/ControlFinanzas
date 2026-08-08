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

/** Rectángulo redondeado, que es lo que distingue una tarjeta de un cuadrado. */
function caja(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
  return ctx
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

/** El visto de «pago recibido», dibujado y no un emoji: los emoji no se pintan
    igual en cada teléfono y en algunos salen como un cuadro. */
function visto(ctx, cx, cy, r) {
  ctx.save()
  ctx.fillStyle = TINTA.greenTint
  ctx.beginPath()
  ctx.arc(cx + r, cy, r + 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = TINTA.green
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cx + r - 4.5, cy)
  ctx.lineTo(cx + r - 1, cy + 3.5)
  ctx.lineTo(cx + r + 5, cy - 3.5)
  ctx.stroke()
  ctx.restore()
}

/**
 * La filigrana: las tres barras ascendentes de la marca
 * (`public/logo-icon.svg`), grandes y muy claras.
 *
 * ⚠ Se dibujan aquí en vez de cargar el SVG: la imagen se pide por red y
 * `dibujarRecibo` es sincrónica, así que a veces llegaría después de pintar y
 * el recibo saldría sin fondo unas veces sí y otras no. Son tres rectángulos.
 */
function filigrana(ctx, x, y, w, h) {
  ctx.save()
  /* ⚠ Grande y al borde parecia un fallo de pintado, no una marca: tres
     bloques beige cortados por el canto derecho. Cabe entera, abajo a la
     derecha, y a la mitad de opacidad. */
  ctx.globalAlpha = 0.045
  ctx.fillStyle = TINTA.gold
  const lado = Math.min(w, h) * 0.34
  const bx = x + w - lado * 1.15
  const by = y + h - lado * 0.30
  const ancho = lado * 0.20
  const hueco = lado * 0.34
  const altos = [lado * 0.30, lado * 0.52, lado * 0.80]
  altos.forEach((alto, i) => {
    const px = bx + i * hueco
    if (ctx.roundRect) {
      ctx.beginPath()
      ctx.roundRect(px, by - alto, ancho, alto, ancho * 0.35)
      ctx.fill()
    } else {
      ctx.fillRect(px, by - alto, ancho, alto)
    }
  })
  ctx.restore()
}

/* ══ EL COMPROBANTE, CON FORMA DE COMPROBANTE ══════════════════════════════
 *
 * El dueño trajo el de Nequi como referencia: «me parece muy bonito y muy buen
 * ejemplo de cómo se debe hacer». Lo que hace que ese funcione, y que aquí se
 * copia:
 *
 *   · **La silueta dentada.** Es lo que más pesa: unos bordes recortados
 *     arriba y abajo y el papel se lee como un RECIBO, no como una tarjeta.
 *   · **Un estado arriba, con icono y color.** «Envío realizado» allí,
 *     «Pago recibido» aquí. Contesta antes que ningún dato.
 *   · **Los datos APILADOS**, rótulo pequeño encima y valor grande debajo. En
 *     dos columnas —como estaba— un nombre largo y su valor se pelean por el
 *     ancho; apilados cada uno tiene la línea entera.
 *   · **Una filigrana** de fondo. Da textura y hace el papel más difícil de
 *     falsificar de un vistazo.
 *
 * ⚠ LO QUE NO SE COPIA, Y POR QUÉ:
 *
 *   · **El QR.** El de Nequi verifica el envío. Aquí el único QR que existe
 *     —`/qr/{cliente}`— es del COBRADOR: abre la pantalla de cobro y pide
 *     sesión. En un papel que va al deudor por WhatsApp no sirve de nada. El
 *     portal del cliente sí tiene enlace, pero se entra con teléfono y PIN: un
 *     QR a una puerta que quizá no puede abrir es peor que ninguno.
 *   · **La ilustración dibujada a mano.** La de Nequi la hizo un ilustrador.
 *     Mis dos intentos de dibujar para esta app se rechazaron —«quedaron mucho
 *     peor»—, así que la filigrana es la marca que ya existe: las tres barras
 *     de `public/logo-icon.svg`, geometría pura, en muy claro.
 *
 * Y manda EL NEGOCIO, no nosotros: el cliente recibe el comprobante de su
 * prestamista, no el de un proveedor de software que no conoce.
 */
export function dibujarRecibo(cliente, prestamo, pago, orgNombre, camposRecibo) {
  const W = 620
  const PAD = 44
  const { texto: SANS, cifra: MONO } = familias()

  const campos = (Array.isArray(camposRecibo) && camposRecibo.length > 0)
    ? camposRecibo
    : getDefaultCampos()
  const tieneCedula = cliente?.cedula && !String(cliente.cedula).startsWith('SIN-')

  /* Los pares, en orden de lo que se mira primero. Los configurables del
     negocio van al final: son el detalle del préstamo, no la identidad. */
  const datos = [
    ['Para', cliente?.nombre ?? '—'],
    ...(tieneCedula ? [[abreviaturaDocumento(), String(cliente.cedula)]] : []),
    ['Fecha', fmtFechaHora(pago?.fechaPago)],
    /* La referencia, como en cualquier comprobante: es lo que se cita cuando
       el cliente dice que pago y el cobrador dice que no. Solo sale si el pago
       trae `id` — hay una via que llama con el monto y la fecha nada mas. */
    ...(pago?.id ? [['Referencia', String(pago.id).slice(-8).toUpperCase()]] : []),
    ...campos.map((c) => [
      c.nombre,
      c.tipo === 'texto' ? c.valor : resolverCampo(c.campo, cliente, prestamo),
    ]),
  ].filter(([, v]) => v != null && String(v).trim() !== '' && String(v) !== '—')

  /* ⚠ La altura se suma con LAS MISMAS piezas con las que se dibuja. Al
     llevarlas por separado —una constante para el bloque del monto y luego un
     `y` que avanzaba a su aire— el monto acabo pintado ENCIMA del primer dato.
     Se ve en la imagen; en el codigo los dos numeros parecen razonables. */
  const MARGEN = 18          // aire alrededor del ticket, donde caen los dientes
  const ALTO_BANDA = 96
  const ALTO_ESTADO = 54     // el visto y «Pago recibido», con su punteado
  const ALTO_MONTO = 92      // rotulo + cifra grande + punteado
  const ALTO_PAR = 46
  const ALTO_PIE = 56
  const H = MARGEN * 2 + ALTO_BANDA + ALTO_ESTADO + ALTO_MONTO
    + datos.length * ALTO_PAR + ALTO_PIE

  const escala = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * escala
  canvas.height = H * escala
  const ctx = canvas.getContext('2d')
  ctx.scale(escala, escala)

  /* El fondo NO se deja transparente: un PNG con alfa sale con el fondo negro
     en varias vistas de WhatsApp, y el recibo acaba ilegible. */
  ctx.fillStyle = TINTA.surface
  ctx.fillRect(0, 0, W, H)

  // ── La silueta dentada ──────────────────────────────────────────────────
  const x0 = MARGEN, y0 = MARGEN
  const w = W - MARGEN * 2, h = H - MARGEN * 2
  siluetaTicket(ctx, x0, y0, w, h, 14, 11)
  ctx.save()
  ctx.shadowColor = 'rgba(20,20,28,.10)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 3
  ctx.fillStyle = TINTA.card
  ctx.fill()
  ctx.restore()

  // Todo lo demás queda DENTRO del ticket.
  ctx.save()
  siluetaTicket(ctx, x0, y0, w, h, 14, 11)
  ctx.clip()

  filigrana(ctx, x0, y0, w, h)

  // ── La banda del negocio ────────────────────────────────────────────────
  ctx.fillStyle = TINTA.gold
  ctx.fillRect(x0, y0, w, ALTO_BANDA)

  ctx.textAlign = 'left'
  ctx.fillStyle = TINTA.goldInk
  ctx.font = `600 12px ${SANS}`
  ctx.fillText('COMPROBANTE DE PAGO', PAD, y0 + 30)

  let tam = 26
  ctx.font = `700 ${tam}px ${SANS}`
  while (tam > 13 && ctx.measureText(orgNombre || 'Mi negocio').width > w - (PAD - x0) * 2) {
    tam -= 1
    ctx.font = `700 ${tam}px ${SANS}`
  }
  ctx.fillStyle = TINTA.ink
  ctx.fillText(orgNombre || 'Mi negocio', PAD, y0 + 66)

  let y = y0 + ALTO_BANDA

  // ── El estado, lo primero que se lee ────────────────────────────────────
  y += 32
  visto(ctx, PAD, y - 6, 9)
  ctx.textAlign = 'left'
  ctx.fillStyle = TINTA.green
  ctx.font = `700 19px ${SANS}`
  ctx.fillText('Pago recibido', PAD + 30, y)
  y += 22
  punteado(ctx, PAD, y, W - PAD)

  /* El monto va a la IZQUIERDA como los demas datos, no centrado. Centrado
     rompia la columna que forman todos los rotulos y se leia como si fuera
     otra seccion. Es un dato mas —el mas importante—, y eso se dice con el
     tamaño, no con la posicion. */
  y += 26
  ctx.fillStyle = TINTA.ink3
  ctx.font = `15px ${SANS}`
  ctx.fillText('¿Cuánto?', PAD, y)
  ctx.fillStyle = TINTA.ink
  ctx.font = `700 42px ${MONO}`
  ctx.fillText(formatMoney(pago?.montoPagado ?? 0), PAD, y + 42)
  y += 66

  // ── Los pares, apilados ─────────────────────────────────────────────────
  ctx.textAlign = 'left'
  for (const [rotulo, valor] of datos) {
    ctx.fillStyle = TINTA.ink3
    ctx.font = `15px ${SANS}`
    ctx.fillText(String(rotulo), PAD, y)

    /* ⚠ Nombre y cédula NO se recortan: se encoge la letra hasta que entra.
       Es lo que identifica a la persona, y cortado no sirve. */
    let t = 19
    ctx.font = `600 ${t}px ${SANS}`
    while (t > 11 && ctx.measureText(String(valor)).width > w - (PAD - x0) * 2) {
      t -= 1
      ctx.font = `600 ${t}px ${SANS}`
    }
    ctx.fillStyle = TINTA.ink
    ctx.fillText(String(valor), PAD, y + 24)
    y += ALTO_PAR
  }

  // ── El pie ──────────────────────────────────────────────────────────────
  y += 6
  punteado(ctx, PAD, y, W - PAD)
  y += 26
  ctx.fillStyle = TINTA.ink4
  ctx.font = `12px ${SANS}`
  ctx.fillText('Generado por Control Finanzas', PAD, y)

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
