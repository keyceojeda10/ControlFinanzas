// lib/whatsapp.js - Utilidades para notificaciones por WhatsApp via wa.me

import { formatMoney, telefonoParaWhatsApp, paisDeLaApp } from '@/lib/i18n'

import { formatFechaCorta, formatFechaHora as fmtFechaHoraI18n } from '@/lib/i18n'
import { calcularProximoCobro } from '@/lib/calculos'

function fmtFecha(d) {
  if (!d) return 'N/A'
  return formatFechaCorta(d)
}

function fmtFechaHora(d) {
  if (!d) return 'N/A'
  return fmtFechaHoraI18n(d)
}

const MESES_LARGO = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function fmtFechaProximoPago(fecha) {
  if (!fecha) return null
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  if (isNaN(d.getTime())) return null
  return `el ${d.getUTCDate()} de ${MESES_LARGO[d.getUTCMonth()]}`
}

// Etiquetas segun frecuencia del prestamo ('diario'|'semanal'|'quincenal'|'mensual')
function etiquetasFrecuencia(freq) {
  const f = (freq || 'diario').toLowerCase()
  if (f === 'semanal')   return { cuota: 'Cuota semanal',   pago: 'pago semanal',   plazo: 'semanas',   divisor: 7 }
  if (f === 'quincenal') return { cuota: 'Cuota quincenal', pago: 'pago quincenal', plazo: 'quincenas', divisor: 15 }
  if (f === 'mensual')   return { cuota: 'Cuota mensual',   pago: 'pago mensual',   plazo: 'meses',     divisor: 30 }
  return { cuota: 'Cuota diaria', pago: 'pago diario', plazo: 'dias', divisor: 1 }
}

function formatearPlazo(diasPlazo, freq) {
  const etq = etiquetasFrecuencia(freq)
  if (etq.divisor === 1) return `${diasPlazo} dias`
  const unidades = Math.round(diasPlazo / etq.divisor)
  return `${unidades} ${etq.plazo} (${diasPlazo} dias)`
}

/* Ver la nota de `lib/whatsapp-plantillas.js`: el software no firma cobros. */
function firma(orgNombre) {
  return orgNombre ? `_${orgNombre}_` : ''
}

export function generarCronogramaCobros(prestamo) {
  if (!prestamo?.fechaInicio || !prestamo?.cuotaDiaria || !prestamo?.totalAPagar) return ''
  const freq = (prestamo.frecuencia || 'diario').toLowerCase()
  const divisor = freq === 'semanal' ? 7 : freq === 'quincenal' ? 15 : freq === 'mensual' ? 30 : 1
  const cuota = Number(prestamo.cuotaDiaria)
  const total = Number(prestamo.totalAPagar)
  const totalPagado = Number(prestamo.totalPagado ?? 0)
  const saldo = total - totalPagado
  if (saldo <= 0 || cuota <= 0) return ''
  const numCuotas = Math.ceil(saldo / cuota)
  const inicio = new Date(prestamo.fechaInicio)
  const cuotasPagadas = cuota > 0 ? Math.floor(totalPagado / cuota) : 0
  const lines = []
  const MAX_MOSTRAR = 20
  const mostrar = Math.min(numCuotas, MAX_MOSTRAR)
  for (let i = 0; i < mostrar; i++) {
    const numCuota = cuotasPagadas + i + 1
    const diasDesdeInicio = (cuotasPagadas + i + 1) * divisor
    const fecha = new Date(inicio.getTime() + diasDesdeInicio * 86400000)
    const esUltima = i === numCuotas - 1
    const montoCuota = esUltima ? saldo - cuota * (numCuotas - 1) : cuota
    lines.push(`  ${numCuota}. ${fmtFecha(fecha)} — ${formatMoney(montoCuota > 0 ? montoCuota : cuota)}`)
  }
  if (numCuotas > MAX_MOSTRAR) {
    lines.push(`  ... y ${numCuotas - MAX_MOSTRAR} cuotas mas`)
  }
  return `\n📅 *Calendario de cobros:*\n${lines.join('\n')}`
}

function calcularTotalPagadoReal(prestamo) {
  if (Number.isFinite(prestamo?.totalPagado)) return prestamo.totalPagado
  const pagos = prestamo?.pagos ?? []
  return pagos
    .filter((pago) => !['recargo', 'descuento'].includes(pago.tipo))
    .reduce((acc, pago) => acc + Number(pago.montoPagado || 0), 0)
}

function calcularCuotasPagadas(prestamo) {
  if (prestamo?.cuotasAmortizacion?.length > 0) {
    const pend = calcularCuotasPendientes(prestamo)
    return prestamo.cuotasAmortizacion.length - pend
  }
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

export { formatearTelefonoIntl } from '@/lib/i18n'

/**
 * El número para `wa.me/…`.
 *
 * ⚠ ESTO PEGABA «57» A TODO EL MUNDO. Un prestamista de Argentina abría el
 * comprobante de un cliente suyo y WhatsApp le contestaba «+573625325911 no es
 * un número de teléfono válido» —el 57 es el indicativo de Colombia, y encima
 * al número argentino le falta el 9 de los móviles—. Reportado el 12 ago 2026.
 *
 * Ahora lo resuelve `telefonoParaWhatsApp`, que sabe de países. El país por
 * defecto NO es Colombia: es el de la organización, que el panel deja puesto
 * con `fijarPaisActivo` al arrancar.
 *
 * ⚠ EN EL SERVIDOR ESO NO VALE: una petición de un negocio argentino y otra de
 * uno colombiano comparten proceso, así que ahí hay que pasar el país a mano.
 * Los endpoints que arman enlaces lo sacan de la sesión.
 */
export function formatearTelefono(telefono, country = paisDeLaApp()) {
  return telefonoParaWhatsApp(telefono, country)
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
export function generarTextoPrestamo(cliente, prestamo, { orgNombre, cronograma } = {}) {
  const etq = etiquetasFrecuencia(prestamo?.frecuencia)
  const bloqueCronograma = cronograma ? generarCronogramaCobros(prestamo) : ''
  return `Hola ${cliente.nombre} 👋

✅ *Tu crédito ha sido aprobado*

📋 *Resumen de tu crédito:*
💰 Monto prestado: ${formatMoney(prestamo.montoPrestado)}
💵 Total a pagar: ${formatMoney(prestamo.totalAPagar)}
📅 ${etq.cuota}: ${formatMoney(prestamo.cuotaDiaria)}
📆 Fecha inicio: ${fmtFecha(prestamo.fechaInicio)}
📆 Fecha fin: ${fmtFecha(prestamo.fechaFin)}
📊 Plazo: ${formatearPlazo(prestamo.diasPlazo, prestamo?.frecuencia)}${bloqueCronograma}

⚠️ Recuerda pagar tu ${etq.cuota.toLowerCase()} a tiempo para evitar intereses por mora.

${firma(orgNombre)} 💼`
}

export function generarEnlacePrestamo(cliente, prestamo, opts) {
  const tel = formatearTelefono(cliente?.telefono, opts?.country)
  if (!tel) return null
  const mensaje = generarTextoPrestamo(cliente, prestamo, opts)
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
}

/**
 * Genera el texto plano del comprobante de pago (reutilizable por WA, Compartir, Imprimir).
 * @param {object} cliente - { nombre, cedula }
 * @param {object} prestamo - { totalPagado, saldoPendiente, porcentajePagado, diasMora }
 * @param {object} pago - { montoPagado, fechaPago }
 */
function resolverCampoWA(campo, cliente, prestamo) {
  const saldo = prestamo.saldoPendiente ?? Math.max(0, (prestamo.totalAPagar ?? 0) - (prestamo.totalPagado ?? 0))
  const map = {
    saldoPendiente:  formatMoney(saldo),
    totalPagado:     formatMoney(prestamo.totalPagado ?? 0),
    totalAPagar:     formatMoney(prestamo.totalAPagar ?? 0),
    montoPrestado:   formatMoney(prestamo.montoPrestado ?? 0),
    cuota:           formatMoney(prestamo.cuotaDiaria ?? 0),
    progreso:        `${prestamo.porcentajePagado ?? 0}%`,
    frecuencia:      prestamo.frecuencia ?? '-',
    fechaVencimiento: fmtFecha(prestamo.fechaFin),
    numeroCuota:     prestamo.numeroCuota ?? '-',
    diasMora:        `${prestamo.diasMora ?? 0}`,
    clienteCedula:   (cliente?.cedula && !cliente.cedula.startsWith('SIN-')) ? cliente.cedula : '-',
    clienteTelefono: cliente?.telefono ?? '-',
    ruta:            prestamo.rutaNombre ?? '-',
    cobrador:        prestamo.cobradorNombre ?? '-',
  }
  return map[campo] ?? '-'
}

export function generarTextoComprobante(cliente, prestamo, pago, { orgNombre, ocultarSaldo, camposRecibo } = {}) {
  const saldoPendiente = prestamo.saldoPendiente ?? 0
  const diasMora       = prestamo.diasMora ?? 0
  const porcentaje     = prestamo.porcentajePagado ?? 0

  let extra = ''
  if (saldoPendiente <= 0) {
    extra = '\n🎉 *¡Felicitaciones! Tu crédito está completamente pagado* 🎉'
  } else if (diasMora > 0) {
    extra = `\n⚠️ Tienes ${diasMora} días en mora. Por favor ponte al día.`
  }

  const estadoLines = [`✅ Total pagado: ${formatMoney(prestamo.totalPagado)}`]
  if (!ocultarSaldo) {
    estadoLines.push(`⏳ Saldo pendiente: ${formatMoney(saldoPendiente)}`)
    estadoLines.push(`📈 Progreso: ${porcentaje}%`)
  }

  let camposExtra = ''
  if (Array.isArray(camposRecibo) && camposRecibo.length > 0) {
    const lines = camposRecibo.map(c => {
      const val = c.tipo === 'texto' ? c.valor : resolverCampoWA(c.campo, cliente, prestamo)
      return `📋 ${c.nombre}: ${val}`
    })
    camposExtra = '\n' + lines.join('\n')
  }

  return `Hola ${cliente.nombre} 👋

✅ *Pago registrado con éxito*

💳 *Detalle del pago:*
💵 Pagaste: ${formatMoney(pago.montoPagado)}
📅 Fecha: ${fmtFecha(pago.fechaPago)}

📊 *Estado de tu crédito:*
${estadoLines.join('\n')}${camposExtra}${extra}

${firma(orgNombre)} 💼`
}

/**
 * Genera texto de historial completo de un crédito.
 * Incluye resumen financiero y detalle pago a pago con fecha/hora.
 */
export function generarTextoHistorialCredito(cliente, prestamo, { orgNombre, ocultarSaldo } = {}) {
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
        `${prefijoMonto}${formatMoney(pago.montoPagado || 0)}`,
      ]
      if (metodo) partes.push(metodo)
      return `• ${partes.join(' | ')}`
    }).join('\n')
    : '• Sin pagos registrados'

  const etq = etiquetasFrecuencia(prestamo?.frecuencia)

  const resumenLines = [
    `💰 Monto prestado: ${formatMoney(montoPrestado)}`,
    `💵 Total a pagar: ${formatMoney(totalAPagar)}`,
    `✅ Total pagado: ${formatMoney(totalPagado)}`,
  ]
  if (!ocultarSaldo) {
    resumenLines.push(`⏳ Saldo pendiente: ${formatMoney(saldoPendiente)}`)
  }
  resumenLines.push(
    `📆 ${etq.cuota}: ${formatMoney(cuotaDiaria)}`,
    `🔢 Cuotas pagadas: ${cuotasPagadas}`,
    `📌 Cuotas pendientes: ${cuotasPendientes}`,
  )
  if (!ocultarSaldo) {
    resumenLines.push(`📈 Progreso: ${porcentajePagado}%`)
  }
  resumenLines.push(`⚠️ Mora: ${diasMora} día${diasMora === 1 ? '' : 's'}`)

  return `Hola ${cliente?.nombre || 'cliente'} 👋

📄 *Historial completo del crédito*

📋 *Resumen:*
${resumenLines.join('\n')}

🧾 *Detalle de pagos:*
${detallePagos}

${firma(orgNombre)} 💼`
}

/**
 * Genera enlace wa.me para confirmar un pago registrado.
 * @param {object} cliente - { nombre, telefono }
 * @param {object} prestamo - { totalPagado, saldoPendiente, porcentajePagado, diasMora }
 * @param {object} pago - { montoPagado, fechaPago }
 */
export function generarEnlacePago(cliente, prestamo, pago, opts = {}) {
  const tel = formatearTelefono(cliente?.telefono, opts?.country)
  if (!tel) return null

  const mensaje = generarTextoComprobante(cliente, prestamo, pago, opts)
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
}

/**
 * Genera enlace wa.me para enviar historial completo del crédito.
 */
export function generarEnlaceHistorialCredito(cliente, prestamo, opts = {}) {
  const tel = formatearTelefono(cliente?.telefono, opts?.country)
  if (!tel) return null

  const mensaje = generarTextoHistorialCredito(cliente, prestamo, opts)
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
}

/**
 * Genera enlace wa.me para alertar al cliente sobre mora.
 * @param {object} cliente - { nombre, telefono }
 * @param {object} prestamo - { cuotaDiaria, saldoPendiente, diasMora, pagos }
 */
export function generarEnlaceMora(cliente, prestamo, { orgNombre, ocultarSaldo, country } = {}) {
  const tel = formatearTelefono(cliente?.telefono, country)
  if (!tel) return null

  const pagos = prestamo.pagos ?? []
  const ultimoPago = pagos.length > 0
    ? pagos.reduce((a, b) => new Date(a.fechaPago) > new Date(b.fechaPago) ? a : b)
    : null

  const etq = etiquetasFrecuencia(prestamo?.frecuencia)
  const estadoLines = []
  if (!ocultarSaldo) {
    estadoLines.push(`💰 Saldo pendiente: ${formatMoney(prestamo.saldoPendiente)}`)
  }
  estadoLines.push(`📅 Último pago: ${ultimoPago ? fmtFecha(ultimoPago.fechaPago) : 'Sin pagos registrados'}`)

  const mensaje = `Hola ${cliente.nombre} 👋

⚠️ *Aviso de mora en tu crédito*

Llevamos ${prestamo.diasMora} días sin recibir tu ${etq.pago} de ${formatMoney(prestamo.cuotaDiaria)}.

📊 *Estado actual:*
${estadoLines.join('\n')}

Por favor comunícate con nosotros para ponerte al día.

${firma(orgNombre)} 💼`

  return `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
}

// ─── Plantillas adicionales para selector ────────────────────────

// Recordatorio amable (cliente al dia o con vencimiento cercano)
export function generarTextoRecordatorio(cliente, prestamo, { orgNombre, ocultarSaldo } = {}) {
  const etq = etiquetasFrecuencia(prestamo?.frecuencia)
  const saldo = Number(prestamo?.saldoPendiente ?? 0)
  const resumenLines = []
  if (!ocultarSaldo) {
    resumenLines.push(`💰 Saldo pendiente: ${formatMoney(saldo)}`)
  }
  resumenLines.push(`📊 Cuotas pendientes: ${calcularCuotasPendientes(prestamo)}`)

  const proximaFecha = calcularProximoCobro(prestamo)
  const fechaTexto = fmtFechaProximoPago(proximaFecha)
  const lineaPago = fechaTexto
    ? `Te recordamos amablemente tu próximo ${etq.pago} de ${formatMoney(prestamo?.cuotaDiaria || 0)} *${fechaTexto}*.`
    : `Te recordamos amablemente tu próximo ${etq.pago} de ${formatMoney(prestamo?.cuotaDiaria || 0)}.`

  resumenLines.push(`📅 Próximo pago: ${fechaTexto || fmtFecha(proximaFecha) || 'Pendiente'}`)

  return `Hola ${cliente.nombre} 👋

${lineaPago}

📋 *Resumen:*
${resumenLines.join('\n')}

Cualquier inquietud, escríbenos por aquí.

¡Gracias por tu puntualidad! 🙌

${firma(orgNombre)} 💼`
}

// Felicitacion por buen comportamiento
export function generarTextoFelicitacion(cliente, prestamo, { orgNombre } = {}) {
  const cuotasPagadas = calcularCuotasPagadas(prestamo)
  return `¡Hola ${cliente.nombre}! 🎉

Queremos reconocer tu excelente comportamiento de pago. Has cumplido con ${cuotasPagadas} cuota${cuotasPagadas === 1 ? '' : 's'} y eres un cliente ejemplar.

🌟 *Beneficios para ti:*
✅ Acceso a montos más altos
✅ Tasas preferenciales
✅ Atención prioritaria

¡Sigue así! Cuando termines este crédito, hablamos de tu próxima oportunidad.

Gracias por confiar en nosotros 🙏

${firma(orgNombre)} 💼`
}

// Promo de renovacion (cliente cerca de terminar o que ya termino)
export function generarTextoRenovacion(cliente, { orgNombre } = {}) {
  return `Hola ${cliente.nombre} 👋

Vimos que estás muy cerca de terminar tu crédito (¡felicitaciones! 👏).

💡 *¿Sabías que puedes renovar?*
Como cliente cumplido, puedes acceder a:
• Un nuevo crédito por monto mayor
• Aprobación inmediata
• Sin papeleo adicional

Si te interesa, respóndenos y te enviamos las opciones disponibles para ti.

${firma(orgNombre)} 💼`
}

// Confirmar cita / visita de cobro
export function generarTextoVisita(cliente, { orgNombre } = {}) {
  return `Hola ${cliente.nombre} 👋

Te informamos que vamos a pasar por tu local hoy a recoger el ${'pago'}.

¿A qué hora te queda mejor?
🕐 Mañana
🕒 Tarde
🕖 Noche

Por favor confírmanos para coordinar.

¡Gracias!

${firma(orgNombre)} 💼`
}

// Solicitar comprobante de pago
export function generarTextoComprobantePedido(cliente, { orgNombre } = {}) {
  return `Hola ${cliente.nombre} 👋

Para confirmar tu pago, por favor envíanos:
📸 Foto del comprobante de transferencia
o
✅ Captura de pantalla

Apenas lo recibamos lo registramos en tu cuenta y te enviamos la confirmación.

¡Gracias!

${firma(orgNombre)} 💼`
}
