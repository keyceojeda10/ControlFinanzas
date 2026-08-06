// lib/whatsapp-plantillas.js
// Definicion centralizada de plantillas WhatsApp con secciones personalizables.
// Usado por ModalWhatsAppTemplates, BotonWhatsApp y RegistrarPago.

import { formatMoney, formatFechaCorta, formatFechaHora } from '@/lib/i18n'
import { calcularProximoCobro, cuotaProximoCobro } from '@/lib/calculos'
import { generarCronogramaCobros } from '@/lib/whatsapp'
import { numeroCuotaDe, porcentajeDe, cuotasRestantesDe } from '@/lib/recibo-derivados'

// ─── Helpers ───────────────────────────────────────────────────

function firma(orgNombre) {
  return orgNombre ? `_${orgNombre}_` : '_Control Finanzas_'
}

function etiquetasFrecuencia(freq) {
  const f = (freq || 'diario').toLowerCase()
  if (f === 'semanal')   return { cuota: 'Cuota semanal',   pago: 'pago semanal',   plazo: 'semanas',   uno: 'semana',   divisor: 7 }
  if (f === 'quincenal') return { cuota: 'Cuota quincenal', pago: 'pago quincenal', plazo: 'quincenas', uno: 'quincena', divisor: 15 }
  if (f === 'mensual')   return { cuota: 'Cuota mensual',   pago: 'pago mensual',   plazo: 'meses',     uno: 'mes',      divisor: 30 }
  return { cuota: 'Cuota diaria', pago: 'pago diario', plazo: 'días', uno: 'día', divisor: 1 }
}

// «1 meses (30 dias)» se lee mal y el cliente lo ve. Singular cuando toca, y
// con tilde: el mensaje va tal cual al WhatsApp del deudor.
function formatearPlazo(diasPlazo, freq) {
  const etq = etiquetasFrecuencia(freq)
  const dias = `${diasPlazo} ${diasPlazo === 1 ? 'día' : 'días'}`
  if (etq.divisor === 1) return dias
  const unidades = Math.round(diasPlazo / etq.divisor)
  return `${unidades} ${unidades === 1 ? etq.uno : etq.plazo} (${dias})`
}

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function fmtProximoPago(fecha) {
  if (!fecha) return null
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  if (isNaN(d.getTime())) return null
  return `el ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`
}

function calcularTotalPagadoReal(prestamo) {
  if (Number.isFinite(prestamo?.totalPagado)) return prestamo.totalPagado
  return (prestamo?.pagos ?? [])
    .filter(p => !['recargo', 'descuento'].includes(p.tipo))
    .reduce((acc, p) => acc + Number(p.montoPagado || 0), 0)
}

function calcularCuotasPagadas(prestamo) {
  if (!prestamo?.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0
  return Math.floor(calcularTotalPagadoReal(prestamo) / prestamo.cuotaDiaria)
}

function calcularCuotasPendientes(prestamo) {
  if (Number.isFinite(prestamo?.cuotasPendientes)) return Math.max(0, prestamo.cuotasPendientes)
  if (!prestamo?.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0
  return Math.ceil(Math.max(0, Number(prestamo?.saldoPendiente || 0)) / prestamo.cuotaDiaria)
}

function getTipoPagoLabel(tipo) {
  const labels = { completo: 'Pago completo', parcial: 'Pago parcial', capital: 'Abono a capital', recargo: 'Recargo', descuento: 'Descuento' }
  return labels[tipo] || 'Pago'
}

/* Los tres datos que la base NO guarda —en qué cuota va, cuántas faltan y el
   porcentaje— viven en `lib/recibo-derivados.js`.

   ⚠ ESTABAN AQUÍ COMO FUNCIONES PRIVADAS, y por eso el fallo volvió: la IMAGEN
   del comprobante (`BotonImprimirRecibo`) no podía importarlas y seguía leyendo
   `prestamo.numeroCuota ?? '-'`. El cliente lo reportó dos días seguidos. */

// Lo que sobró del pago DESPUES de cubrir todo lo que se debía hoy.
//
// Se descuenta la mora antes que nada: si no, el recibo diría "te sobraron
// $27.700" a alguien que sigue debiendo el recargo. Es el mismo criterio que usa
// el prestamista que reporto esto en su propia hoja de calculo.
function excedenteDelPago(prestamo, pago) {
  const pagado = Number(pago?.montoPagado ?? 0)
  if (!pagado) return 0
  const cuota = cuotaProximoCobro(prestamo) || prestamo?.cuotaDiaria || 0
  const mora = prestamo?.moratorio?.aplicable ? Number(prestamo.moratorio.montoMoratorio || 0) : 0
  const saldo = prestamo?.saldoPendiente ?? Math.max(0, (prestamo?.totalAPagar ?? 0) - (prestamo?.totalPagado ?? 0))
  // Nunca puede sobrar mas que lo que exceda al saldo total del prestamo.
  const debidoHoy = Math.min(cuota + mora, saldo + mora)
  return Math.max(0, Math.round(pagado - debidoHoy))
}

function resolverCampoWA(campo, cliente, prestamo, pago = null) {
  const saldo = prestamo?.saldoPendiente ?? Math.max(0, (prestamo?.totalAPagar ?? 0) - (prestamo?.totalPagado ?? 0))
  const mor = prestamo?.moratorio
  const excedente = excedenteDelPago(prestamo, pago)
  const restantes = cuotasRestantesDe(prestamo)
  const map = {
    saldoPendiente:  formatMoney(saldo),
    totalPagado:     formatMoney(prestamo?.totalPagado ?? 0),
    totalAPagar:     formatMoney(prestamo?.totalAPagar ?? 0),
    montoPrestado:   formatMoney(prestamo?.montoPrestado ?? 0),
    cuota:           formatMoney(cuotaProximoCobro(prestamo) || prestamo?.cuotaDiaria || 0),
    progreso:        `${porcentajeDe(prestamo)}%`,
    frecuencia:      prestamo?.frecuencia ?? '-',
    fechaVencimiento: formatFechaCorta(prestamo?.fechaFin),
    numeroCuota:     prestamo?.numeroCuota ?? numeroCuotaDe(prestamo) ?? '-',
    diasMora:        `${prestamo?.diasMora ?? 0}`,
    clienteCedula:   (cliente?.cedula && !cliente.cedula.startsWith('SIN-')) ? cliente.cedula : '-',
    clienteTelefono: cliente?.telefono ?? '-',
    ruta:            prestamo?.rutaNombre ?? '-',
    cobrador:        prestamo?.cobradorNombre ?? '-',

    // ── Campos pedidos por un prestamista, 28 jul 2026 ──
    // Su queja de fondo: el cliente final paga de mas y el recibo no le dice a
    // donde fue esa plata.
    cuotasRestantes: restantes == null ? '-' : `${restantes}`,
    // El recargo por mora se calcula con calcularInteresMoratorio, la misma
    // funcion que usa la ficha del prestamo. La diaria se deriva del total para
    // que las dos cifras no puedan contradecirse.
    moraDiaria: (mor?.aplicable && mor.diasMoraEfectivos > 0)
      ? formatMoney(Math.round(mor.montoMoratorio / mor.diasMoraEfectivos))
      : formatMoney(0),
    totalMora: mor?.aplicable ? formatMoney(mor.montoMoratorio) : formatMoney(0),
    excedente: formatMoney(excedente),
    // Explica el destino, que es lo que el deudor no entiende. El excedente cae
    // en cascada sobre la tabla y baja las cuotas siguientes; para bajar capital
    // hay un tipo de pago aparte ("abono a capital").
    excedenteAplicado: excedente > 0
      ? `${formatMoney(excedente)} a la próxima cuota`
      : '-',
  }
  return map[campo] ?? '-'
}

// ─── Generadores de secciones por plantilla ───────────────────

function secsPagoConfirmacion(ctx) {
  const { cliente, prestamo, pago, orgNombre, ocultarSaldo, camposRecibo } = ctx
  const saldo = prestamo?.saldoPendiente ?? 0
  const diasMora = prestamo?.diasMora ?? 0
  // ⚠ POR `porcentajeDe`, NO por el campo a secas: desde `RegistrarPago` el
  // préstamo llega crudo y ese campo lo pone el API. El recibo decía «Progreso:
  // 0%» a quien acababa de pagar $140.000 de $560.000, que es un 25%.
  const porcentaje = porcentajeDe(prestamo)
  const estadoLines = [`✅ Total pagado: ${formatMoney(prestamo?.totalPagado ?? 0)}`]
  if (!ocultarSaldo) {
    estadoLines.push(`⏳ Saldo pendiente: ${formatMoney(saldo)}`)
    estadoLines.push(`\u{1f4c8} Progreso: ${porcentaje}%`)
  }

  const secs = [
    { key: 'saludo', label: 'Saludo', default: true, locked: true,
      texto: `Hola ${cliente?.nombre || ''} \u{1f44b}` },
    { key: 'encabezado', label: 'Encabezado', default: true, locked: true,
      texto: '\n\n✅ *Pago registrado con éxito*' },
    { key: 'detalle_pago', label: 'Detalle del pago', default: true,
      texto: `\n\n\u{1f4b3} *Detalle del pago:*\n\u{1f4b5} Pagaste: ${formatMoney(pago?.montoPagado || 0)}\n\u{1f4c5} Fecha: ${formatFechaCorta(pago?.fechaPago)}` },
    { key: 'estado_credito', label: 'Estado del crédito', default: true,
      texto: `\n\n\u{1f4ca} *Estado de tu crédito:*\n${estadoLines.join('\n')}` },
  ]
  /* ⚠ SIN REPETIR LO QUE «Estado de tu crédito» YA DIJO.
     Los campos personalizados son del dueño, pero los tres de arriba ya salen
     en la sección anterior: el cliente recibía «Saldo pendiente: $279.000» dos
     veces en el mismo mensaje, una con icono y otra sin él.
     Medido en producción: los 9 negocios que configuraron campos repiten al
     menos uno. No es un caso raro, es todos.
     `progreso` y `saldoPendiente` solo chocan si el saldo se enseña; con
     `ocultarSaldo` la plantilla no los pone y el campo del dueño sí vale. */
  const yaEnEstado = ocultarSaldo
    ? new Set(['totalPagado'])
    : new Set(['totalPagado', 'saldoPendiente', 'progreso'])
  const camposSinRepetir = (Array.isArray(camposRecibo) ? camposRecibo : [])
    .filter((c) => !(c?.tipo === 'dato' && yaEnEstado.has(c.campo)))

  if (camposSinRepetir.length > 0) {
    secs.push({
      key: 'campos_extra', label: 'Campos personalizados', default: true,
      texto: '\n' + camposSinRepetir.map(c => {
        const val = c.tipo === 'texto' ? c.valor : resolverCampoWA(c.campo, cliente, prestamo, pago)
        return `\u{1f4cb} ${c.nombre}: ${val}`
      }).join('\n'),
    })
  }
  if (diasMora > 0) {
    secs.push({ key: 'aviso_mora', label: 'Aviso de mora', default: true,
      texto: `\n⚠️ Tienes ${diasMora} días en mora. Por favor ponte al día.` })
  }
  if (saldo <= 0) {
    secs.push({ key: 'felicitacion_pago', label: 'Felicitacion pago completo', default: true,
      texto: '\n\u{1f389} *¡Felicitaciones! Tu crédito está completamente pagado* \u{1f389}' })
  }
  secs.push({ key: 'firma', label: 'Firma', default: true,
    texto: `\n\n${firma(orgNombre)} \u{1f4bc}` })
  return secs
}

function secsCreditoAprobado(ctx) {
  const { cliente, prestamo, orgNombre } = ctx
  const etq = etiquetasFrecuencia(prestamo?.frecuencia)
  const crono = generarCronogramaCobros(prestamo)
  return [
    { key: 'saludo', label: 'Saludo', default: true, locked: true,
      texto: `Hola ${cliente?.nombre || ''} \u{1f44b}` },
    { key: 'encabezado', label: 'Encabezado', default: true, locked: true,
      texto: '\n\n✅ *Tu crédito ha sido aprobado*' },
    { key: 'resumen', label: 'Resumen del crédito', default: true,
      texto: `\n\n\u{1f4cb} *Resumen de tu crédito:*\n\u{1f4b0} Monto prestado: ${formatMoney(prestamo?.montoPrestado)}\n\u{1f4b5} Total a pagar: ${formatMoney(prestamo?.totalAPagar)}\n\u{1f4c5} ${etq.cuota}: ${formatMoney(prestamo?.cuotaDiaria)}\n\u{1f4c6} Fecha inicio: ${formatFechaCorta(prestamo?.fechaInicio)}\n\u{1f4c6} Fecha fin: ${formatFechaCorta(prestamo?.fechaFin)}\n\u{1f4ca} Plazo: ${formatearPlazo(prestamo?.diasPlazo, prestamo?.frecuencia)}` },
    ...(crono ? [{ key: 'cronograma', label: 'Calendario de cobros', default: false,
      texto: crono }] : []),
    { key: 'aviso', label: 'Aviso de pago a tiempo', default: true,
      texto: `\n\n⚠️ Recuerda pagar tu ${etq.cuota.toLowerCase()} a tiempo para evitar intereses por mora.` },
    { key: 'firma', label: 'Firma', default: true,
      texto: `\n\n${firma(orgNombre)} \u{1f4bc}` },
  ]
}

function secsRecordatorio(ctx) {
  const { cliente, prestamo, orgNombre, ocultarSaldo } = ctx
  const etq = etiquetasFrecuencia(prestamo?.frecuencia)
  const saldo = Number(prestamo?.saldoPendiente ?? 0)
  const resumenLines = []
  if (!ocultarSaldo) resumenLines.push(`\u{1f4b0} Saldo pendiente: ${formatMoney(saldo)}`)
  resumenLines.push(`\u{1f4ca} Cuotas pendientes: ${calcularCuotasPendientes(prestamo)}`)
  let proximaFecha = null
  try { proximaFecha = calcularProximoCobro(prestamo) } catch {}
  const fechaTexto = fmtProximoPago(proximaFecha)
  resumenLines.push(`\u{1f4c5} Próximo pago: ${fechaTexto || formatFechaCorta(proximaFecha) || 'Pendiente'}`)
  const cuotaMostrar = cuotaProximoCobro(prestamo) || prestamo?.cuotaDiaria || 0
  const lineaPago = fechaTexto
    ? `Te recordamos amablemente tu próximo ${etq.pago} de ${formatMoney(cuotaMostrar)} *${fechaTexto}*.`
    : `Te recordamos amablemente tu próximo ${etq.pago} de ${formatMoney(cuotaMostrar)}.`
  return [
    { key: 'saludo', label: 'Saludo', default: true, locked: true,
      texto: `Hola ${cliente?.nombre || ''} \u{1f44b}` },
    { key: 'recordatorio', label: 'Línea de recordatorio', default: true,
      texto: `\n\n${lineaPago}` },
    { key: 'resumen', label: 'Resumen financiero', default: true,
      texto: `\n\n\u{1f4cb} *Resumen:*\n${resumenLines.join('\n')}` },
    { key: 'cierre', label: 'Cierre amable', default: true,
      texto: '\n\nCualquier inquietud, escríbenos por aquí.\n\n¡Gracias por tu puntualidad! \u{1f64c}' },
    { key: 'firma', label: 'Firma', default: true,
      texto: `\n\n${firma(orgNombre)} \u{1f4bc}` },
  ]
}

function secsMora(nivel, ctx) {
  const { cliente, prestamo, orgNombre, ocultarSaldo } = ctx
  const dias = prestamo?.diasMora ?? 0

  if (nivel === 'suave') {
    return [
      { key: 'saludo', label: 'Saludo', default: true, locked: true,
        texto: `Hola ${cliente?.nombre || ''} \u{1f44b}` },
      { key: 'aviso', label: 'Aviso de vencimiento', default: true,
        texto: `\n\nNotamos que tu cuota de ${formatMoney(cuotaProximoCobro(prestamo) || prestamo?.cuotaDiaria || 0)} lleva ${dias} día${dias === 1 ? '' : 's'} pendiente.\n\n¿Podemos pasar hoy a cobrar? También puedes ponerte al día por transferencia.` },
      ...(!ocultarSaldo ? [{ key: 'estado', label: 'Saldo pendiente', default: true,
        texto: `\n\u{1f4b0} Saldo pendiente: ${formatMoney(prestamo?.saldoPendiente || 0)}` }] : []),
      { key: 'cierre', label: 'Cierre', default: true,
        texto: '\n\n¡Gracias!' },
      { key: 'firma', label: 'Firma', default: true,
        texto: `\n\n${firma(orgNombre)} \u{1f4bc}` },
    ]
  }

  if (nivel === 'firme') {
    const estadoLines = []
    if (!ocultarSaldo) estadoLines.push(`\u{1f4b0} Saldo pendiente: ${formatMoney(prestamo?.saldoPendiente || 0)}`)
    estadoLines.push(`\u{1f4c5} ${etiquetasFrecuencia(prestamo?.frecuencia).cuota}: ${formatMoney(cuotaProximoCobro(prestamo) || prestamo?.cuotaDiaria || 0)}`)
    return [
      { key: 'saludo', label: 'Saludo', default: true, locked: true,
        texto: `Hola ${cliente?.nombre || ''} \u{1f44b}` },
      { key: 'encabezado', label: 'Encabezado mora', default: true,
        texto: '\n\n⚠️ *Aviso de mora*' },
      { key: 'aviso', label: 'Texto del aviso', default: true,
        texto: `\n\nLlevamos ${dias} días sin recibir tu pago. Por favor comunícate con nosotros lo antes posible.` },
      { key: 'estado', label: 'Estado financiero', default: true,
        texto: `\n\n\u{1f4ca} *Estado:*\n${estadoLines.join('\n')}` },
      { key: 'cierre', label: 'Cierre', default: true,
        texto: '\n\nEstamos disponibles para acordar una solución. No dejes que se acumule más.' },
      { key: 'firma', label: 'Firma', default: true,
        texto: `\n\n${firma(orgNombre)} \u{1f4bc}` },
    ]
  }

  return [
    { key: 'saludo', label: 'Saludo directo', default: true, locked: true,
      texto: `${cliente?.nombre || ''},` },
    { key: 'encabezado', label: 'Encabezado critico', default: true,
      texto: '\n\n\u{1f6a8} *Última oportunidad antes de cobro jurídico*' },
    { key: 'aviso', label: 'Texto del aviso', default: true,
      texto: `\n\nTu crédito tiene ${dias} días sin pago. Hemos intentado contactarte sin respuesta.` },
    ...(!ocultarSaldo ? [{ key: 'estado', label: 'Saldo pendiente', default: true,
      texto: `\n\u{1f4ca} Saldo total pendiente: ${formatMoney(prestamo?.saldoPendiente || 0)}` }] : []),
    { key: 'cierre', label: 'Cierre legal', default: true,
      texto: '\n\nPara evitar acciones legales, comunícate HOY mismo. Aún puedes acordar un plan de pago.\n\nEs la última vez que te escribimos por este medio antes de proceder.' },
    { key: 'firma', label: 'Firma', default: true,
      texto: `\n\n${firma(orgNombre)}` },
  ]
}

function secsHistorial(ctx) {
  const { cliente, prestamo, orgNombre, ocultarSaldo } = ctx
  const montoPrestado = Number(prestamo?.montoPrestado || 0)
  const totalAPagar = Number(prestamo?.totalAPagar || 0)
  const totalPagado = Number(calcularTotalPagadoReal(prestamo) || 0)
  const saldoPendiente = Math.max(0, Number(prestamo?.saldoPendiente || (totalAPagar - totalPagado)))
  const cuotaDiaria = Number(prestamo?.cuotaDiaria || 0)
  const cuotasPag = calcularCuotasPagadas(prestamo)
  const cuotasPend = calcularCuotasPendientes(prestamo)
  const diasMora = Number(prestamo?.diasMora || 0)
  // Una sola fórmula para el porcentaje, aquí y en `estado_credito`.
  const porcentajePagado = porcentajeDe(prestamo)
  const etq = etiquetasFrecuencia(prestamo?.frecuencia)

  const resumenLines = [
    `\u{1f4b0} Monto prestado: ${formatMoney(montoPrestado)}`,
    `\u{1f4b5} Total a pagar: ${formatMoney(totalAPagar)}`,
    `✅ Total pagado: ${formatMoney(totalPagado)}`,
  ]
  if (!ocultarSaldo) resumenLines.push(`⏳ Saldo pendiente: ${formatMoney(saldoPendiente)}`)
  resumenLines.push(
    `\u{1f4c6} ${etq.cuota}: ${formatMoney(cuotaDiaria)}`,
    `\u{1f522} Cuotas pagadas: ${cuotasPag}`,
    `\u{1f4cc} Cuotas pendientes: ${cuotasPend}`,
  )
  if (!ocultarSaldo) resumenLines.push(`\u{1f4c8} Progreso: ${porcentajePagado}%`)
  resumenLines.push(`⚠️ Mora: ${diasMora} día${diasMora === 1 ? '' : 's'}`)

  const pagosOrdenados = [...(prestamo?.pagos || [])].sort((a, b) => new Date(a.fechaPago) - new Date(b.fechaPago))
  const detallePagos = pagosOrdenados.length
    ? pagosOrdenados.map((p, idx) => {
      const prefijo = p.tipo === 'descuento' ? '-' : p.tipo === 'recargo' ? '+' : ''
      return `• ${idx + 1}. ${formatFechaHora(p.fechaPago)} | ${getTipoPagoLabel(p.tipo)} | ${prefijo}${formatMoney(p.montoPagado || 0)}`
    }).join('\n')
    : '• Sin pagos registrados'

  return [
    { key: 'saludo', label: 'Saludo', default: true, locked: true,
      texto: `Hola ${cliente?.nombre || 'cliente'} \u{1f44b}` },
    { key: 'encabezado', label: 'Encabezado', default: true,
      texto: '\n\n\u{1f4c4} *Historial completo del crédito*' },
    { key: 'resumen', label: 'Resumen financiero', default: true,
      texto: `\n\n\u{1f4cb} *Resumen:*\n${resumenLines.join('\n')}` },
    { key: 'detalle_pagos', label: 'Detalle de pagos', default: true,
      texto: `\n\n\u{1f9fe} *Detalle de pagos:*\n${detallePagos}` },
    { key: 'firma', label: 'Firma', default: true,
      texto: `\n\n${firma(orgNombre)} \u{1f4bc}` },
  ]
}

// ─── Catálogo de plantillas ───────────────────────────────────

import {
  generarTextoFelicitacion,
  generarTextoRenovacion,
  generarTextoVisita,
  generarTextoComprobantePedido,
} from '@/lib/whatsapp'

export const PLANTILLAS = [
  {
    id: 'pago_confirmacion',
    label: 'Confirmación de pago',
    desc: 'Detalle completo del pago',
    icon: '✅', color: 'var(--color-success)',
    aplica: ({ prestamo, pago }) => !!prestamo && !!pago,
    getSecciones: secsPagoConfirmacion,
  },
  {
    id: 'gracias_corto',
    label: 'Gracias por tu pago',
    desc: 'Confirmación corta sin saldo',
    icon: '\u{1f44d}', color: 'var(--color-success)',
    aplica: ({ prestamo }) => prestamo && prestamo.estado === 'activo',
    getSecciones: null,
    generar: ({ cliente, prestamo, orgNombre }) => {
      const ultimoPago = prestamo?.pagos?.length > 0
        ? prestamo.pagos.reduce((a, b) => new Date(a.fechaPago) > new Date(b.fechaPago) ? a : b)
        : null
      const monto = ultimoPago?.montoPagado || prestamo?.cuotaDiaria || 0
      return `Hola ${cliente.nombre} \u{1f44b}\n\n✅ Tu pago de ${formatMoney(monto)} fue registrado correctamente.\n\n¡Gracias por tu puntualidad!\n\n${firma(orgNombre)} \u{1f4bc}`
    },
  },
  {
    id: 'credito_aprobado',
    label: 'Crédito aprobado',
    desc: 'Datos del nuevo crédito',
    icon: '✅', color: 'var(--color-success)',
    aplica: ({ prestamo }) => !!prestamo,
    getSecciones: secsCreditoAprobado,
  },
  {
    id: 'recordatorio',
    label: 'Recordatorio amable',
    desc: 'Para clientes al día',
    icon: '\u{1f514}', color: 'var(--color-success)',
    aplica: ({ prestamo }) => prestamo && prestamo.estado === 'activo' && (prestamo.diasMora ?? 0) === 0,
    getSecciones: secsRecordatorio,
  },
  {
    id: 'mora_suave',
    label: 'Vencimiento cercano',
    desc: 'Aviso suave de pago',
    icon: '⏰', color: '#f59e0b',
    aplica: ({ prestamo }) => prestamo && (prestamo.diasMora ?? 0) > 0 && (prestamo.diasMora ?? 0) <= 3,
    getSecciones: (ctx) => secsMora('suave', ctx),
  },
  {
    id: 'mora_firme',
    label: 'Aviso de mora',
    desc: 'Cliente atrasado +3 días',
    icon: '⚠️', color: '#f97316',
    aplica: ({ prestamo }) => prestamo && (prestamo.diasMora ?? 0) > 3 && (prestamo.diasMora ?? 0) <= 15,
    getSecciones: (ctx) => secsMora('firme', ctx),
  },
  {
    id: 'mora_critica',
    label: 'Mora crítica',
    desc: 'Más de 15 días',
    icon: '\u{1f6a8}', color: 'var(--color-danger)',
    aplica: ({ prestamo }) => prestamo && (prestamo.diasMora ?? 0) > 15,
    getSecciones: (ctx) => secsMora('critica', ctx),
  },
  {
    id: 'felicitacion',
    label: 'Felicitación',
    desc: 'Cliente cumplido',
    icon: '\u{1f389}', color: 'var(--color-purple)',
    // ⚠ POR `porcentajeDe`: con el campo crudo, un préstamo que llega sin él
    // se lee como 0% y esta plantilla no se ofrecía NUNCA desde el recibo.
    aplica: ({ prestamo }) => prestamo && prestamo.estado === 'activo' && porcentajeDe(prestamo) >= 50 && (prestamo.diasMora ?? 0) === 0,
    getSecciones: null,
    generar: ({ cliente, prestamo, orgNombre }) => generarTextoFelicitacion(cliente, prestamo, { orgNombre }),
  },
  {
    id: 'renovacion',
    label: 'Ofrecer renovación',
    desc: 'Cerca de terminar',
    icon: '\u{1f504}', color: 'var(--color-teal)',
    aplica: ({ prestamo }) => prestamo && (prestamo.estado === 'completado' || porcentajeDe(prestamo) >= 80),
    getSecciones: null,
    generar: ({ cliente, orgNombre }) => generarTextoRenovacion(cliente, { orgNombre }),
  },
  {
    id: 'historial',
    label: 'Historial completo',
    desc: 'Todos los pagos del crédito',
    icon: '\u{1f4c4}', color: 'var(--color-info)',
    aplica: ({ prestamo }) => prestamo && (prestamo.pagos?.length ?? 0) > 0,
    getSecciones: secsHistorial,
  },
  {
    id: 'oferta_credito',
    label: 'Oferta de crédito',
    desc: 'Cliente sin préstamo activo',
    icon: '\u{1f4b0}', color: 'var(--color-success)',
    aplica: ({ prestamo }) => !prestamo || prestamo.estado === 'completado',
    getSecciones: null,
    generar: ({ cliente, orgNombre }) => `Hola ${cliente.nombre} \u{1f44b}\n\nTenemos credito disponible para ti con aprobacion inmediata.\n\nSi necesitas financiamiento, escribenos por aqui y te explicamos las condiciones. Sin compromiso.\n\n${firma(orgNombre)} \u{1f4bc}`,
  },
  {
    id: 'visita',
    label: 'Confirmar visita',
    desc: 'Coordinar cobro hoy',
    icon: '\u{1f6b6}', color: 'var(--color-info)',
    aplica: () => true,
    getSecciones: null,
    generar: ({ cliente, orgNombre }) => generarTextoVisita(cliente, { orgNombre }),
  },
  {
    id: 'comprobante',
    label: 'Pedir comprobante',
    desc: 'Solicitar foto de pago',
    icon: '\u{1f4f8}', color: 'var(--color-purple)',
    aplica: () => true,
    getSecciones: null,
    generar: ({ cliente, orgNombre }) => generarTextoComprobantePedido(cliente, { orgNombre }),
  },
  {
    id: 'libre',
    label: 'Mensaje libre',
    desc: 'Escribir desde cero',
    icon: '✏️', color: '#94a3b8',
    aplica: () => true,
    getSecciones: null,
    generar: ({ cliente }) => `Hola ${cliente.nombre} \u{1f44b}\n\n`,
  },
]

// ─── Persistencia (localStorage + DB) ─────────────────────────
// localStorage sirve como cache inmediata (sin latencia).
// La DB (via /api/plantillas-wa) es la fuente de verdad para
// sincronizar entre dispositivos.

function storageKey(orgId) {
  return `cf-wa-plantillas-${orgId || 'default'}`
}

export function cargarConfigPlantillas(orgId) {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(storageKey(orgId))
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function guardarConfigPlantillas(orgId, config) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(storageKey(orgId), JSON.stringify(config)) } catch {}
  fetch('/api/plantillas-wa', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  }).catch(() => {})
}

export async function sincronizarPlantillasDesdeDB(orgId) {
  if (typeof window === 'undefined') return {}
  try {
    const res = await fetch('/api/plantillas-wa')
    if (!res.ok) return cargarConfigPlantillas(orgId)
    const dbConfig = await res.json()
    if (dbConfig && typeof dbConfig === 'object' && Object.keys(dbConfig).length > 0) {
      try { localStorage.setItem(storageKey(orgId), JSON.stringify(dbConfig)) } catch {}
      return dbConfig
    }
    const local = cargarConfigPlantillas(orgId)
    if (Object.keys(local).length > 0) {
      fetch('/api/plantillas-wa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(local),
      }).catch(() => {})
    }
    return local
  } catch {
    return cargarConfigPlantillas(orgId)
  }
}

// ─── Generación de texto con secciones ────────────────────────

export function getSeccionesActivas(templateId, ctx, orgId) {
  const tmpl = PLANTILLAS.find(t => t.id === templateId)
  if (!tmpl?.getSecciones) return null
  const secs = tmpl.getSecciones(ctx)
  const config = cargarConfigPlantillas(orgId)
  const saved = config[templateId]
  if (saved && Array.isArray(saved.secciones)) {
    return new Set(saved.secciones)
  }
  return new Set(secs.filter(s => s.default || s.locked).map(s => s.key))
}

export function generarTextoPlantilla(templateId, ctx, orgId) {
  const tmpl = PLANTILLAS.find(t => t.id === templateId)
  if (!tmpl) return ''

  if (tmpl.getSecciones) {
    try {
      const secs = tmpl.getSecciones(ctx)
      const activas = getSeccionesActivas(templateId, ctx, orgId)
      let texto = secs
        .filter(s => s.locked || activas.has(s.key))
        .map(s => s.texto)
        .join('')
        .trim()

      const config = cargarConfigPlantillas(orgId)
      const extras = config[templateId]?.extras
      if (Array.isArray(extras) && extras.length > 0) {
        const firmaIdx = texto.lastIndexOf(firma(ctx.orgNombre))
        const extraText = extras.map(e => `\u{1f4cb} ${e.nombre}: ${e.valor}`).join('\n')
        if (firmaIdx > 0) {
          texto = texto.slice(0, firmaIdx) + extraText + '\n\n' + texto.slice(firmaIdx)
        } else {
          texto += '\n' + extraText
        }
      }
      return texto
    } catch { return '' }
  }

  if (tmpl.generar) {
    try { return tmpl.generar(ctx) } catch { return '' }
  }
  return ''
}
