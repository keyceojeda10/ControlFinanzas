// components/ui/BotonImprimirRecibo.jsx
// Botón para imprimir recibo estilo térmico (58mm) via window.print() en iframe oculto.
'use client'

import { formatCOP } from '@/lib/calculos'

const PRINT_ICON = (
  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
)

function fmtFecha(d) {
  if (!d) return 'N/A'
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtFechaHora(d) {
  if (!d) return ''
  const f = new Date(d)
  return f.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' ' + f.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function generarHTMLRecibo(cliente, prestamo, pago, orgNombre) {
  const saldo     = prestamo.saldoPendiente ?? 0
  const progreso  = prestamo.porcentajePagado ?? 0
  const linea     = '─'.repeat(32)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Recibo</title>
<style>
  @page { margin: 4mm; size: 58mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    line-height: 1.4;
    max-width: 280px;
    margin: 0 auto;
    color: #000;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .linea { color: #666; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; }
  .row span:last-child { font-weight: bold; }
  .mt { margin-top: 6px; }
  .footer { font-size: 9px; color: #666; margin-top: 8px; text-align: center; }
</style></head><body>
  <div class="center bold" style="font-size:13px;">CONTROL FINANZAS</div>
  ${orgNombre ? `<div class="center" style="font-size:10px;">${orgNombre}</div>` : ''}
  <div class="linea">${linea}</div>
  <div class="center bold">COMPROBANTE DE PAGO</div>
  <div class="linea">${linea}</div>
  <div class="mt">Cliente: ${cliente?.nombre ?? 'N/A'}</div>
  ${cliente?.cedula ? `<div>C&eacute;dula: ${cliente.cedula}</div>` : ''}
  <div>Fecha: ${fmtFecha(pago?.fechaPago)}</div>
  <div class="linea">${linea}</div>
  <div class="row"><span>Monto pagado:</span><span>${formatCOP(pago?.montoPagado ?? 0)}</span></div>
  <div class="linea">${linea}</div>
  <div class="row mt"><span>Total pagado:</span><span>${formatCOP(prestamo.totalPagado ?? 0)}</span></div>
  <div class="row"><span>Saldo pend.:</span><span>${formatCOP(saldo)}</span></div>
  <div class="row"><span>Progreso:</span><span>${progreso}%</span></div>
  <div class="linea">${linea}</div>
  <div class="footer">${fmtFechaHora(pago?.fechaPago || new Date())}</div>
  <div class="footer">Gracias por su pago</div>
</body></html>`
}

export default function BotonImprimirRecibo({ cliente, prestamo, pago, orgNombre = '' }) {
  const handleClick = () => {
    const html = generarHTMLRecibo(cliente, prestamo, pago, orgNombre)

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument || iframe.contentWindow.document
    doc.open()
    doc.write(html)
    doc.close()

    // Esperar a que el contenido cargue antes de imprimir
    iframe.contentWindow.onafterprint = () => {
      document.body.removeChild(iframe)
    }

    setTimeout(() => {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
      // Limpiar después de un timeout por si onafterprint no se dispara
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe)
      }, 5000)
    }, 250)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex-1 flex items-center justify-center gap-2 px-3 h-10 rounded-[12px] text-sm font-medium transition-all duration-150 cursor-pointer bg-[#1a1a1a] border border-[#2a2a2a] text-[#888888] hover:text-white hover:border-[#444]"
    >
      {PRINT_ICON}
      Imprimir
    </button>
  )
}
