// components/ui/BotonImprimirRecibo.jsx
// Botón para imprimir recibo estilo térmico (58mm) via window.open + print.
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

function getTipoPagoLabel(tipo) {
  if (tipo === 'completo') return 'Pago completo'
  if (tipo === 'parcial') return 'Pago parcial'
  if (tipo === 'capital') return 'Abono a capital'
  if (tipo === 'recargo') return 'Recargo'
  if (tipo === 'descuento') return 'Descuento'
  return 'Pago'
}

function generarHTMLRecibo(cliente, prestamo, pago, orgNombre) {
  const saldo     = prestamo.saldoPendiente ?? 0
  const totalPag  = prestamo.totalPagado ?? 0
  const progreso  = prestamo.porcentajePagado ?? 0
  const totalAPagar = prestamo.totalAPagar ?? 0
  const cuota     = prestamo.cuotaDiaria ?? 0
  const linea     = '━'.repeat(30)
  const lineaFina = '─'.repeat(30)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Recibo de Pago</title>
<style>
  @page { margin: 4mm; size: 58mm auto; }
  @media print { .no-print { display: none !important; } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    line-height: 1.5;
    max-width: 300px;
    margin: 0 auto;
    padding: 8px;
    color: #000;
    background: #fff;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .linea { color: #333; margin: 4px 0; font-size: 10px; }
  .linea-fina { color: #999; margin: 3px 0; font-size: 10px; }
  .row { display: flex; justify-content: space-between; padding: 1px 0; }
  .row span:last-child { font-weight: bold; }
  .mt { margin-top: 6px; }
  .monto-grande { font-size: 18px; font-weight: bold; text-align: center; margin: 8px 0; }
  .footer { font-size: 9px; color: #666; margin-top: 10px; text-align: center; }
  .btn-cerrar {
    display: block; margin: 20px auto 0; padding: 12px 32px;
    background: #000; color: #fff; border: none; border-radius: 8px;
    font-size: 14px; font-weight: bold; cursor: pointer;
  }
</style></head><body>

  <div class="center bold" style="font-size:15px; letter-spacing: 1px;">CONTROL FINANZAS</div>
  ${orgNombre ? `<div class="center" style="font-size:11px; color:#555;">${orgNombre}</div>` : ''}
  <div class="linea">${linea}</div>

  <div class="center bold" style="font-size:12px;">COMPROBANTE DE PAGO</div>
  <div class="linea">${linea}</div>

  <div class="mt">Cliente: <strong>${cliente?.nombre ?? 'N/A'}</strong></div>
  ${cliente?.cedula ? `<div>CC: ${cliente.cedula}</div>` : ''}
  <div>Fecha: ${fmtFecha(pago?.fechaPago)}</div>

  <div class="linea-fina">${lineaFina}</div>

  <div class="monto-grande">${formatCOP(pago?.montoPagado ?? 0)}</div>

  <div class="linea-fina">${lineaFina}</div>

  <div class="row mt"><span>Total pagado:</span><span>${formatCOP(totalPag)}</span></div>
  <div class="row"><span>Saldo pendiente:</span><span>${formatCOP(saldo)}</span></div>
  <div class="row"><span>Total a pagar:</span><span>${formatCOP(totalAPagar)}</span></div>
  <div class="row"><span>Cuota:</span><span>${formatCOP(cuota)}</span></div>
  <div class="row"><span>Progreso:</span><span>${progreso}%</span></div>

  <div class="linea">${linea}</div>

  <div class="footer">${fmtFechaHora(pago?.fechaPago || new Date())}</div>
  <div class="footer" style="margin-top:4px;">Gracias por su pago</div>
  <div class="footer" style="margin-top:2px;">www.control-finanzas.com</div>

  <button class="btn-cerrar no-print" onclick="window.close()">Cerrar</button>

</body></html>`
}

function generarHTMLHistorialCompleto(cliente, prestamo, orgNombre) {
  const pagos = Array.isArray(prestamo?.pagos) ? [...prestamo.pagos] : []
  pagos.sort((a, b) => new Date(a.fechaPago) - new Date(b.fechaPago))

  const totalPagadoReal = pagos
    .filter((p) => !['recargo', 'descuento'].includes(p.tipo))
    .reduce((acc, p) => acc + Number(p.montoPagado || 0), 0)

  const montoPrestado = Number(prestamo?.montoPrestado || 0)
  const totalAPagar = Number(prestamo?.totalAPagar || 0)
  const saldoPendiente = Math.max(0, Number(prestamo?.saldoPendiente || (totalAPagar - totalPagadoReal)))
  const cuotaDiaria = Number(prestamo?.cuotaDiaria || 0)
  const cuotasPagadas = cuotaDiaria > 0 ? Math.floor(totalPagadoReal / cuotaDiaria) : 0
  const cuotasPendientes = Number.isFinite(prestamo?.cuotasPendientes)
    ? Math.max(0, prestamo.cuotasPendientes)
    : (cuotaDiaria > 0 ? Math.ceil(saldoPendiente / cuotaDiaria) : 0)
  const porcentajePagado = Number(prestamo?.porcentajePagado || (totalAPagar > 0 ? Math.round((totalPagadoReal / totalAPagar) * 100) : 0))
  const diasMora = Number(prestamo?.diasMora || 0)

  const filasPagos = pagos.length
    ? pagos.map((pago) => {
      const prefijoMonto = pago.tipo === 'descuento' ? '-' : pago.tipo === 'recargo' ? '+' : ''
      const metodo = pago.metodoPago === 'transferencia'
        ? `Transferencia${pago.plataforma ? ` (${pago.plataforma})` : ''}`
        : pago.metodoPago === 'efectivo'
          ? 'Efectivo'
          : '-'
      return `
        <tr>
          <td>${fmtFechaHora(pago.fechaPago)}</td>
          <td>${getTipoPagoLabel(pago.tipo)}</td>
          <td>${metodo}</td>
          <td style="text-align:right; font-weight:bold;">${prefijoMonto}${formatCOP(pago.montoPagado || 0)}</td>
        </tr>
      `
    }).join('')
    : '<tr><td colspan="4" style="text-align:center; color:#666;">Sin pagos registrados</td></tr>'

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Historial completo del crédito</title>
<style>
  @page { margin: 8mm; size: auto; }
  @media print { .no-print { display: none !important; } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; padding: 16px; }
  .wrap { max-width: 880px; margin: 0 auto; }
  .title { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .sub { font-size: 12px; color: #555; margin-bottom: 14px; }
  .line { border-top: 1px solid #ddd; margin: 12px 0; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; margin-bottom: 10px; }
  .item { font-size: 12px; }
  .item b { display: inline-block; min-width: 150px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border-bottom: 1px solid #e6e6e6; padding: 7px 6px; font-size: 12px; vertical-align: top; }
  th { text-align: left; background: #f7f7f7; font-size: 11px; text-transform: uppercase; color: #555; }
  .footer { margin-top: 16px; color: #666; font-size: 11px; }
  .btn-cerrar {
    display: inline-block; margin-top: 18px; padding: 10px 24px;
    background: #111; color: #fff; border: none; border-radius: 8px;
    font-size: 14px; font-weight: bold; cursor: pointer;
  }
</style></head><body>
  <div class="wrap">
    <div class="title">Historial completo del crédito</div>
    <div class="sub">Control Finanzas${orgNombre ? ` · ${orgNombre}` : ''}</div>

    <div class="grid">
      <div class="item"><b>Cliente:</b> ${cliente?.nombre || 'N/A'}</div>
      <div class="item"><b>Cédula:</b> ${cliente?.cedula || 'N/A'}</div>
      <div class="item"><b>Monto prestado:</b> ${formatCOP(montoPrestado)}</div>
      <div class="item"><b>Total a pagar:</b> ${formatCOP(totalAPagar)}</div>
      <div class="item"><b>Total pagado:</b> ${formatCOP(totalPagadoReal)}</div>
      <div class="item"><b>Saldo pendiente:</b> ${formatCOP(saldoPendiente)}</div>
      <div class="item"><b>Cuota diaria:</b> ${formatCOP(cuotaDiaria)}</div>
      <div class="item"><b>Progreso:</b> ${porcentajePagado}%</div>
      <div class="item"><b>Cuotas pagadas:</b> ${cuotasPagadas}</div>
      <div class="item"><b>Cuotas pendientes:</b> ${cuotasPendientes}</div>
      <div class="item"><b>Días en mora:</b> ${diasMora}</div>
      <div class="item"><b>Fecha de emisión:</b> ${fmtFechaHora(new Date())}</div>
    </div>

    <div class="line"></div>

    <table>
      <thead>
        <tr>
          <th>Fecha y hora</th>
          <th>Tipo</th>
          <th>Método</th>
          <th style="text-align:right;">Monto</th>
        </tr>
      </thead>
      <tbody>${filasPagos}</tbody>
    </table>

    <div class="footer">Documento generado automáticamente por Control Finanzas.</div>

    <button class="btn-cerrar no-print" onclick="window.close()">Cerrar</button>
  </div>
</body></html>`
}

export default function BotonImprimirRecibo({ tipo = 'recibo', cliente, prestamo, pago, orgNombre = '' }) {
  const handleClick = () => {
    const html = tipo === 'historial'
      ? generarHTMLHistorialCompleto(cliente, prestamo, orgNombre)
      : generarHTMLRecibo(cliente, prestamo, pago, orgNombre)

    // Abrir ventana nueva (funciona en móvil y desktop)
    const win = window.open('', '_blank')
    if (!win) return // bloqueado por popup blocker

    win.document.open()
    win.document.write(html)
    win.document.close()

    // Imprimir después de que cargue
    win.onload = () => {
      win.focus()
      win.print()
    }
    // Fallback si onload no se dispara
    setTimeout(() => {
      win.focus()
      win.print()
    }, 500)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex-1 flex items-center justify-center gap-2 px-3 h-10 rounded-[12px] text-sm font-medium transition-all duration-150 cursor-pointer bg-[#1a1a1a] border border-[#2a2a2a] text-[#888888] hover:text-white hover:border-[#444]"
    >
      {PRINT_ICON}
      {tipo === 'historial' ? 'Imprimir historial' : 'Imprimir'}
    </button>
  )
}
