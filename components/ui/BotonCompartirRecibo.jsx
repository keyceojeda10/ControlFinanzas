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
  /* ⚠ Debajo de los datos ensuciaba las cifras: la barra del medio caia justo
     detras de «Saldo pendiente». Mas pequeña, mas clara y pegada al pie. */
  ctx.globalAlpha = 0.04
  ctx.fillStyle = TINTA.gold
  const lado = Math.min(w, h) * 0.26
  const bx = x + w - lado * 1.05
  const by = y + h - lado * 0.22
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
  const W = 620
  const { texto: SANS, cifra: MONO } = familias()

  const campos = (Array.isArray(camposRecibo) && camposRecibo.length > 0)
    ? camposRecibo
    : getDefaultCampos()
  const tieneCedula = cliente?.cedula && !String(cliente.cedula).startsWith('SIN-')

  const datos = [
    ['Cliente', cliente?.nombre ?? '—'],
    ...(tieneCedula ? [[abreviaturaDocumento(), String(cliente.cedula)]] : []),
    ...campos.map((c) => [
      c.nombre,
      c.tipo === 'texto' ? c.valor : resolverCampo(c.campo, cliente, prestamo),
    ]),
    ...(pago?.id ? [['Referencia', String(pago.id).slice(-8).toUpperCase()]] : []),
  ].filter(([, v]) => v != null && String(v).trim() !== '' && String(v) !== '—')

  const MARGEN = 20          // el aire donde caen los dientes
  const PAD = 34             // desde el borde del papel, no del lienzo
  const ALTO_CABECERA = 84
  const ALTO_BLOQUE = 150
  const ALTO_FILA = 42
  const ALTO_PIE = 62
  const H = MARGEN * 2 + ALTO_CABECERA + ALTO_BLOQUE + 24
    + datos.length * ALTO_FILA + ALTO_PIE

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

  const x0 = MARGEN, y0 = MARGEN
  const w = W - MARGEN * 2, h = H - MARGEN * 2
  const L = x0 + PAD              // el carril de texto
  const R = x0 + w - PAD

  siluetaTicket(ctx, x0, y0, w, h, 18, 10)
  ctx.save()
  ctx.shadowColor = 'rgba(20,20,28,.12)'
  ctx.shadowBlur = 16
  ctx.shadowOffsetY = 4
  ctx.fillStyle = TINTA.card
  ctx.fill()
  ctx.restore()

  ctx.save()
  siluetaTicket(ctx, x0, y0, w, h, 18, 10)
  ctx.clip()
  filigrana(ctx, x0, y0, w, h)

  // ── Quién lo emite ──────────────────────────────────────────────────────
  let y = y0 + 38
  ctx.textAlign = 'left'
  ctx.fillStyle = TINTA.ink3
  ctx.font = `13px ${SANS}`
  ctx.fillText('Comprobante de pago', L, y)

  y += 26
  let tam = 22
  ctx.font = `700 ${tam}px ${SANS}`
  while (tam > 13 && ctx.measureText(orgNombre || 'Mi negocio').width > R - L) {
    tam -= 1
    ctx.font = `700 ${tam}px ${SANS}`
  }
  ctx.fillStyle = TINTA.ink
  ctx.fillText(orgNombre || 'Mi negocio', L, y)

  // ── El bloque oscuro: la cifra que resuelve el papel ────────────────────
  y = y0 + ALTO_CABECERA
  const bh = ALTO_BLOQUE - 18
  caja(ctx, L, y, R - L, bh, 20)
  ctx.fillStyle = BLOQUE.fondo
  ctx.fill()

  ctx.fillStyle = BLOQUE.rotulo
  ctx.font = `13px ${SANS}`
  ctx.fillText('Pagó', L + 22, y + 34)

  /* La pastilla del estado, arriba a la derecha del bloque. El estado va en el
     acento y nunca tiñendo la superficie. */
  const rot = 'RECIBIDO'
  ctx.font = `700 11px ${SANS}`
  const anchoP = ctx.measureText(rot).width + 30
  caja(ctx, R - 22 - anchoP, y + 20, anchoP, 24, 999)
  ctx.fillStyle = 'rgba(18,161,80,.20)'
  ctx.fill()
  visto(ctx, R - 22 - anchoP + 11, y + 32, 5, '#5BD98A')
  ctx.fillStyle = '#5BD98A'
  ctx.textAlign = 'left'
  ctx.fillText(rot, R - 22 - anchoP + 26, y + 36)

  /* La cifra: dorado sobre carbón, encogiendo si hace falta. Es lo único
     dorado del documento. */
  const monto = formatMoney(pago?.montoPagado ?? 0)
  let tc = 52
  ctx.font = `700 ${tc}px ${MONO}`
  while (tc > 24 && ctx.measureText(monto).width > R - L - 44) {
    tc -= 2
    ctx.font = `700 ${tc}px ${MONO}`
  }
  ctx.fillStyle = BLOQUE.oro
  ctx.fillText(monto, L + 22, y + 34 + 52)

  ctx.fillStyle = BLOQUE.apagado
  ctx.font = `13px ${SANS}`
  ctx.fillText(fmtFechaHora(pago?.fechaPago), L + 22, y + bh - 20)

  // ── Los datos, apilados ─────────────────────────────────────────────────
  y = y0 + ALTO_CABECERA + ALTO_BLOQUE + 6
  for (const [rotulo, valor] of datos) {
    ctx.fillStyle = TINTA.ink3
    ctx.font = `13px ${SANS}`
    ctx.fillText(String(rotulo), L, y)

    /* ⚠ Nombre y cédula NO se recortan: se encoge la letra hasta que entra. Es
       lo que identifica a la persona, y cortado no sirve. */
    let t = 18
    ctx.font = `600 ${t}px ${SANS}`
    while (t > 11 && ctx.measureText(String(valor)).width > R - L) {
      t -= 1
      ctx.font = `600 ${t}px ${SANS}`
    }
    ctx.fillStyle = TINTA.ink
    ctx.fillText(String(valor), L, y + 22)
    y += ALTO_FILA
  }

  // ── El pie ──────────────────────────────────────────────────────────────
  y += 2
  punteado(ctx, L, y, R)
  y += 26
  ctx.fillStyle = TINTA.ink4
  ctx.font = `12px ${SANS}`
  // Dice el papel que cumple, no solo el nombre: esta imagen se le manda al
  // deudor por WhatsApp y es de lo poco que se queda en su teléfono.
  ctx.font = `11px ${SANS}`
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
