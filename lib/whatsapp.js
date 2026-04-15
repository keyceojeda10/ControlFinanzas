// lib/whatsapp.js - Utilidades para notificaciones por WhatsApp via wa.me

import { formatCOP } from '@/lib/calculos'

// Formatea fecha en es-CO: "5 ene. 2026"
function fmtFecha(d) {
  if (!d) return 'N/A'
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtFechaHora(d) {
  if (!d) return 'N/A'
  const fecha = new Date(d)
  return `${fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })} ${fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
}

function calcularTotalPagadoReal(prestamo) {
  if (Number.isFinite(prestamo?.totalPagado)) return prestamo.totalPagado
  const pagos = prestamo?.pagos ?? []
  return pagos
    .filter((pago) => !['recargo', 'descuento'].includes(pago.tipo))
    .reduce((acc, pago) => acc + Number(pago.montoPagado || 0), 0)
}

function calcularCuotasPagadas(prestamo) {
  if (!prestamo?.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0
  return Math.floor(calcularTotalPagadoReal(prestamo) / prestamo.cuotaDiaria)
}

function calcularCuotasPendientes(prestamo) {
  if (Number.isFinite(prestamo?.cuotasPendientes)) return Math.max(0, prestamo.cuotasPendientes)
  if (!prestamo?.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0
  const saldo = Math.max(0, Number(prestamo?.saldoPendiente || 0))
  return Math.ceil(saldo / prestamo.cuotaDiaria)
}

function getTipoPagoLabel(tipo) {
  if (tipo === 'completo') return 'Pago completo'
  if (tipo === 'parcial') return 'Pago parcial'
  if (tipo === 'capital') return 'Abono a capital'
  if (tipo === 'recargo') return 'Recargo'
  if (tipo === 'descuento') return 'Descuento'
  return 'Pago'
}

function getMetodoPagoLabel(pago) {
  if (pago?.metodoPago === 'transferencia') {
    return pago?.plataforma ? `Transferencia (${pago.plataforma})` : 'Transferencia'
  }
  if (pago?.metodoPago === 'efectivo') return 'Efectivo'
  return ''
}

/**
 * Limpia y formatea un número de teléfono colombiano.
 * Retorna: "57XXXXXXXXXX" listo para wa.me
 */
export function formatearTelefono(telefono) {
  if (!telefono) return null
  // Quitar todo lo que no sea dígito
  let limpio = String(telefono).replace(/[\s\-().+]/g, '')
  // Si empieza con 57 y tiene 12 dígitos → ya está bien
  if (limpio.startsWith('57') && limpio.length === 12) return limpio
  // Si empieza con 0 quitarlo
  if (limpio.startsWith('0')) limpio = limpio.slice(1)
  // Si empieza con 3 (celular colombiano) agregar 57
  if (limpio.startsWith('3') && limpio.length === 10) return '57' + limpio
  // Si ya tiene 10 dígitos agregar 57
  if (limpio.length === 10) return '57' + limpio
  return null
}

/**
 * Abre WhatsApp en una nueva pestaña con el enlace dado.
 */
export function abrirWhatsApp(enlace) {
  if (typeof window !== 'undefined') {
    window.open(enlace, '_blank', 'noopener,noreferrer')
  }
}

/**
 * Genera enlace wa.me para notificar la creación de un préstamo.
 * @param {object} cliente - { nombre, telefono }
 * @param {object} prestamo - { montoPrestado, totalAPagar, cuotaDiaria, fechaInicio, fechaFin, diasPlazo }
 */
export function generarEnlacePrestamo(cliente, prestamo) {
  const tel = formatearTelefono(cliente?.telefono)
  if (!tel) return null

  const mensaje = `Hola ${cliente.nombre} 👋

✅ *Tu crédito ha sido aprobado*

📋 *Resumen de tu crédito:*
💰 Monto prestado: ${formatCOP(prestamo.montoPrestado)}
💵 Total a pagar: ${formatCOP(prestamo.totalAPagar)}
📅 Cuota diaria: ${formatCOP(prestamo.cuotaDiaria)}
📆 Fecha inicio: ${fmtFecha(prestamo.fechaInicio)}
📆 Fecha fin: ${fmtFecha(prestamo.fechaFin)}
📊 Plazo: ${prestamo.diasPlazo} días

⚠️ Recuerda pagar tu cuota diaria para evitar intereses por mora.

_Control Finanzas_ 💼`

  return `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
}

/**
 * Genera el texto plano del comprobante de pago (reutilizable por WA, Compartir, Imprimir).
 * @param {object} cliente - { nombre, cedula }
 * @param {object} prestamo - { totalPagado, saldoPendiente, porcentajePagado, diasMora }
 * @param {object} pago - { montoPagado, fechaPago }
 */
export function generarTextoComprobante(cliente, prestamo, pago) {
  const saldoPendiente = prestamo.saldoPendiente ?? 0
  const diasMora       = prestamo.diasMora ?? 0
  const porcentaje     = prestamo.porcentajePagado ?? 0

  let extra = ''
  if (saldoPendiente <= 0) {
    extra = '\n🎉 *¡Felicitaciones! Tu crédito está completamente pagado* 🎉'
  } else if (diasMora > 0) {
    extra = `\n⚠️ Tienes ${diasMora} días en mora. Por favor ponte al día.`
  }

  return `Hola ${cliente.nombre} 👋

✅ *Pago registrado con éxito*

💳 *Detalle del pago:*
💵 Pagaste: ${formatCOP(pago.montoPagado)}
📅 Fecha: ${fmtFecha(pago.fechaPago)}

📊 *Estado de tu crédito:*
✅ Total pagado: ${formatCOP(prestamo.totalPagado)}
⏳ Saldo pendiente: ${formatCOP(saldoPendiente)}
📈 Progreso: ${porcentaje}%${extra}

_Control Finanzas_ 💼`
}

/**
 * Genera texto de historial completo de un crédito.
 * Incluye resumen financiero y detalle pago a pago con fecha/hora.
 */
export function generarTextoHistorialCredito(cliente, prestamo) {
  const montoPrestado = Number(prestamo?.montoPrestado || 0)
  const totalAPagar = Number(prestamo?.totalAPagar || 0)
  const totalPagado = Number(calcularTotalPagadoReal(prestamo) || 0)
  const saldoPendiente = Math.max(0, Number(prestamo?.saldoPendiente || (totalAPagar - totalPagado)))
  const cuotaDiaria = Number(prestamo?.cuotaDiaria || 0)
  const cuotasPagadas = calcularCuotasPagadas(prestamo)
  const cuotasPendientes = calcularCuotasPendientes(prestamo)
  const diasMora = Number(prestamo?.diasMora || 0)
  const porcentajePagado = Number(prestamo?.porcentajePagado || (totalAPagar > 0 ? Math.round((totalPagado / totalAPagar) * 100) : 0))

  const pagosOrdenados = [...(prestamo?.pagos || [])]
    .sort((a, b) => new Date(a.fechaPago) - new Date(b.fechaPago))

  const detallePagos = pagosOrdenados.length
    ? pagosOrdenados.map((pago, idx) => {
      const prefijoMonto = pago.tipo === 'descuento' ? '-' : pago.tipo === 'recargo' ? '+' : ''
      const metodo = getMetodoPagoLabel(pago)
      const partes = [
        `${idx + 1}. ${fmtFechaHora(pago.fechaPago)}`,
        getTipoPagoLabel(pago.tipo),
        `${prefijoMonto}${formatCOP(pago.montoPagado || 0)}`,
      ]
      if (metodo) partes.push(metodo)
      return `• ${partes.join(' | ')}`
    }).join('\n')
    : '• Sin pagos registrados'

  return `Hola ${cliente?.nombre || 'cliente'} 👋

📄 *Historial completo del crédito*

📋 *Resumen:*
💰 Monto prestado: ${formatCOP(montoPrestado)}
💵 Total a pagar: ${formatCOP(totalAPagar)}
✅ Total pagado: ${formatCOP(totalPagado)}
⏳ Saldo pendiente: ${formatCOP(saldoPendiente)}
📆 Cuota diaria: ${formatCOP(cuotaDiaria)}
🔢 Cuotas pagadas: ${cuotasPagadas}
📌 Cuotas pendientes: ${cuotasPendientes}
📈 Progreso: ${porcentajePagado}%
⚠️ Mora: ${diasMora} día${diasMora === 1 ? '' : 's'}

🧾 *Detalle de pagos:*
${detallePagos}

_Control Finanzas_ 💼`
}

/**
 * Genera enlace wa.me para confirmar un pago registrado.
 * @param {object} cliente - { nombre, telefono }
 * @param {object} prestamo - { totalPagado, saldoPendiente, porcentajePagado, diasMora }
 * @param {object} pago - { montoPagado, fechaPago }
 */
export function generarEnlacePago(cliente, prestamo, pago) {
  const tel = formatearTelefono(cliente?.telefono)
  if (!tel) return null

  const mensaje = generarTextoComprobante(cliente, prestamo, pago)
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
}

/**
 * Genera enlace wa.me para enviar historial completo del crédito.
 */
export function generarEnlaceHistorialCredito(cliente, prestamo) {
  const tel = formatearTelefono(cliente?.telefono)
  if (!tel) return null

  const mensaje = generarTextoHistorialCredito(cliente, prestamo)
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
}

/**
 * Genera enlace wa.me para alertar al cliente sobre mora.
 * @param {object} cliente - { nombre, telefono }
 * @param {object} prestamo - { cuotaDiaria, saldoPendiente, diasMora, pagos }
 */
export function generarEnlaceMora(cliente, prestamo) {
  const tel = formatearTelefono(cliente?.telefono)
  if (!tel) return null

  // Buscar último pago
  const pagos = prestamo.pagos ?? []
  const ultimoPago = pagos.length > 0
    ? pagos.reduce((a, b) => new Date(a.fechaPago) > new Date(b.fechaPago) ? a : b)
    : null

  const mensaje = `Hola ${cliente.nombre} 👋

⚠️ *Aviso de mora en tu crédito*

Llevamos ${prestamo.diasMora} días sin recibir tu pago diario de ${formatCOP(prestamo.cuotaDiaria)}.

📊 *Estado actual:*
💰 Saldo pendiente: ${formatCOP(prestamo.saldoPendiente)}
📅 Último pago: ${ultimoPago ? fmtFecha(ultimoPago.fechaPago) : 'Sin pagos registrados'}

Por favor comunícate con nosotros para ponerte al día.

_Control Finanzas_ 💼`

  return `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
}
