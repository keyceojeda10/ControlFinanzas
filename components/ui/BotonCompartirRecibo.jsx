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
export function dibujarRecibo(cliente, prestamo, pago, orgNombre, camposRecibo) {
  const W = 620          // ancho logico
  const PAD = 44
  const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

  const campos = (Array.isArray(camposRecibo) && camposRecibo.length > 0)
    ? camposRecibo
    : getDefaultCampos()
  const filas = campos.map((c) => ({
    label: c.nombre,
    value: c.tipo === 'texto' ? c.valor : resolverCampo(c.campo, cliente, prestamo),
  }))
  const tieneCedula = cliente?.cedula && !String(cliente.cedula).startsWith('SIN-')

  // ── Pase 1: calcular alto acumulando cada bloque ──
  let h = PAD
  h += 40                 // titulo CONTROL FINANZAS
  if (orgNombre) h += 26  // nombre org
  h += 18                 // separador
  h += 34                 // COMPROBANTE DE PAGO
  h += 18                 // separador
  h += 28                 // Cliente
  if (tieneCedula) h += 26 // CC
  h += 26                 // Fecha
  h += 16                 // separador fino
  h += 64                 // monto grande
  h += 16                 // separador fino
  h += filas.length * 30  // filas de campos
  h += 20                 // separador
  h += 24                 // footer fecha/hora
  h += 24                 // footer gracias
  h += PAD
  const H = h

  const scale = 2         // nitidez en pantallas retina
  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)

  // Fondo blanco + borde sutil (tarjeta)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'var(--cf-border)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, W - 2, H - 2)

  let y = PAD
  const sep = (color) => {
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(PAD, y)
    ctx.lineTo(W - PAD, y)
    ctx.stroke()
  }
  const center = (txt, font, color) => {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center'
    ctx.fillText(txt, W / 2, y)
  }
  const row = (label, value) => {
    ctx.textAlign = 'left'; ctx.font = `15px ${SANS}`; ctx.fillStyle = '#6b7280'
    ctx.fillText(String(label), PAD, y)
    ctx.textAlign = 'right'; ctx.font = `bold 15px ${SANS}`; ctx.fillStyle = '#111827'
    ctx.fillText(String(value), W - PAD, y)
  }

  y += 24; center('CONTROL FINANZAS', `bold 22px ${SANS}`, '#111827')
  y += 16
  if (orgNombre) { y += 8; center(orgNombre, `14px ${SANS}`, '#6b7280'); y += 12 }
  y += 6; sep('#d1d5db'); y += 12
  center('COMPROBANTE DE PAGO', `bold 16px ${SANS}`, '#111827'); y += 4
  y += 14; sep('#d1d5db'); y += 20

  row('Cliente', cliente?.nombre ?? 'N/A'); y += 26
  if (tieneCedula) { row(abreviaturaDocumento(), cliente.cedula); y += 26 }
  row('Fecha', fmtFecha(pago?.fechaPago)); y += 18
  sep('#eef0f2'); y += 34

  center(formatMoney(pago?.montoPagado ?? 0), `bold 34px ${SANS}`, '#059669'); y += 22
  sep('#eef0f2'); y += 22

  for (const f of filas) { row(f.label, f.value); y += 30 }
  y += 2; sep('#d1d5db'); y += 22

  center(fmtFechaHora(pago?.fechaPago), `12px ${SANS}`, '#9ca3af'); y += 22
  center('Gracias por su pago', `12px ${SANS}`, '#9ca3af')

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
