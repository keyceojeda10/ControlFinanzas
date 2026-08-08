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
  return f.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' ' + f.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
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

/* Dibuja el comprobante en un canvas y lo devuelve.
 *
 * Exportada por la misma razón que `generarHTMLRecibo`: la imagen se pide desde
 * tres caminos distintos y tiene que salir idéntica en los tres. Cuando arreglé
 * el recibo de WhatsApp con funciones privadas, la IMAGEN no pudo usarlas y el
 * mismo fallo se reportó dos días seguidos.
 *
 * ⚠ Quien manda en la cabecera es EL NEGOCIO, no nosotros. Antes el titular
 * era «CONTROL FINANZAS» en grande y el nombre del prestamista debajo en gris:
 * el cliente recibe por WhatsApp el comprobante de un proveedor de software que
 * no conoce. Nuestro nombre va al pie, en pequeño. */
export function dibujarRecibo(cliente, prestamo, pago, orgNombre, camposRecibo) {
  const W = 620
  const PAD = 40
  const { texto: SANS, cifra: MONO } = familias()

  const campos = (Array.isArray(camposRecibo) && camposRecibo.length > 0)
    ? camposRecibo
    : getDefaultCampos()
  const filas = campos.map((c) => ({
    label: c.nombre,
    value: c.tipo === 'texto' ? c.valor : resolverCampo(c.campo, cliente, prestamo),
  }))
  const tieneCedula = cliente?.cedula && !String(cliente.cedula).startsWith('SIN-')

  const ALTO_BANDA = 92
  const ALTO_MONTO = 132
  const ALTO_FILA = 32
  const H = ALTO_BANDA + 26 + ALTO_MONTO + 22
    + (2 + (tieneCedula ? 1 : 0) + filas.length) * ALTO_FILA
    + 22 + 52

  const escala = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * escala
  canvas.height = H * escala
  const ctx = canvas.getContext('2d')
  ctx.scale(escala, escala)

  ctx.fillStyle = TINTA.card
  ctx.fillRect(0, 0, W, H)

  // ── La banda dorada, con el nombre del negocio ──────────────────────────
  ctx.fillStyle = TINTA.gold
  ctx.fillRect(0, 0, W, ALTO_BANDA)

  ctx.textAlign = 'left'
  ctx.fillStyle = TINTA.goldInk
  ctx.font = `600 12px ${SANS}`
  ctx.fillText('COMPROBANTE DE PAGO', PAD, 34)

  /* El nombre se encoge hasta que entra. Hay negocios con nombres de 100
     caracteres —hay uno que lleva el teléfono y un aviso dentro del nombre— y
     dibujado tal cual se sale del recibo por la derecha. */
  let tam = 26
  ctx.font = `700 ${tam}px ${SANS}`
  while (tam > 13 && ctx.measureText(orgNombre || 'Mi negocio').width > W - PAD * 2) {
    tam -= 1
    ctx.font = `700 ${tam}px ${SANS}`
  }
  ctx.fillStyle = TINTA.ink
  ctx.fillText(orgNombre || 'Mi negocio', PAD, 68)

  // ── El monto, que es lo que el cliente busca ────────────────────────────
  let y = ALTO_BANDA + 26
  ctx.fillStyle = TINTA.goldTint
  caja(ctx, PAD, y, W - PAD * 2, ALTO_MONTO, 14).fill()

  ctx.textAlign = 'center'
  ctx.fillStyle = TINTA.ink3
  ctx.font = `600 12px ${SANS}`
  ctx.fillText('PAGÓ', W / 2, y + 30)

  ctx.fillStyle = TINTA.ink
  ctx.font = `700 44px ${MONO}`
  ctx.fillText(formatMoney(pago?.montoPagado ?? 0), W / 2, y + 78)

  // Pastilla verde: el recibo dice «recibido», no solo cuánto.
  const rotulo = 'RECIBIDO'
  ctx.font = `700 11px ${SANS}`
  const anchoPastilla = ctx.measureText(rotulo).width + 26
  ctx.fillStyle = TINTA.greenTint
  caja(ctx, (W - anchoPastilla) / 2, y + 94, anchoPastilla, 22, 11).fill()
  ctx.fillStyle = TINTA.green
  ctx.fillText(rotulo, W / 2, y + 109)

  y += ALTO_MONTO + 22

  // ── Los datos ───────────────────────────────────────────────────────────
  const renglon = (etiqueta, valor, fuerte) => {
    ctx.textAlign = 'left'
    ctx.font = `14px ${SANS}`
    ctx.fillStyle = TINTA.ink3
    ctx.fillText(String(etiqueta), PAD, y + 20)

    ctx.textAlign = 'right'
    ctx.font = `${fuerte ? '700' : '600'} 14px ${fuerte ? MONO : SANS}`
    ctx.fillStyle = TINTA.ink
    /* ⚠ El nombre y la cédula NO se recortan: es lo que identifica a la
       persona. Se encoge la letra hasta que entra. */
    const hueco = W - PAD * 2 - ctx.measureText(String(etiqueta)).width - 90
    let t = 14
    while (t > 9 && ctx.measureText(String(valor)).width > hueco) {
      t -= 1
      ctx.font = `${fuerte ? '700' : '600'} ${t}px ${fuerte ? MONO : SANS}`
    }
    ctx.fillText(String(valor), W - PAD, y + 20)

    ctx.strokeStyle = TINTA.borderSoft
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(PAD, y + ALTO_FILA - 0.5)
    ctx.lineTo(W - PAD, y + ALTO_FILA - 0.5)
    ctx.stroke()
    y += ALTO_FILA
  }

  renglon('Cliente', cliente?.nombre ?? '—')
  if (tieneCedula) renglon(abreviaturaDocumento(), cliente.cedula)
  renglon('Fecha', fmtFecha(pago?.fechaPago))
  for (const f of filas) renglon(f.label, f.value, true)

  // ── El pie ──────────────────────────────────────────────────────────────
  y += 22
  ctx.textAlign = 'left'
  ctx.font = `11px ${SANS}`
  ctx.fillStyle = TINTA.ink4
  ctx.fillText(fmtFechaHora(pago?.fechaPago), PAD, y)
  ctx.textAlign = 'right'
  ctx.fillText('Control Finanzas', W - PAD, y)

  // El marco, al final, para que ninguna caja lo tape.
  ctx.strokeStyle = TINTA.border
  ctx.lineWidth = 1
  caja(ctx, 0.5, 0.5, W - 1, H - 1, 16).stroke()

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
