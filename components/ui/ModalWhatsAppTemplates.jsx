'use client'
// components/ui/ModalWhatsAppTemplates.jsx
// Modal selector de plantillas de WhatsApp con preview editable
// y secciones personalizables por plantilla.

import { formatMoney } from '@/lib/i18n'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import {
  formatearTelefono,
  abrirWhatsApp,
  generarTextoPrestamo,
  generarTextoRecordatorio,
  generarTextoFelicitacion,
  generarTextoRenovacion,
  generarTextoVisita,
  generarTextoComprobantePedido,
  generarCronogramaCobros,
  generarTextoComprobante,
} from '@/lib/whatsapp'

function firma(orgNombre) {
  return orgNombre ? `_${orgNombre}_` : '_Control Finanzas_'
}

// ─── Secciones definidas por plantilla ─────────────────────────
// Cada seccion tiene: key, label, default (on/off), y genera su bloque de texto.
// Las secciones se evaluan en orden para componer el mensaje final.

function seccionesPagoConfirmacion(ctx) {
  const { cliente, prestamo, pago, orgNombre, ocultarSaldo, camposRecibo } = ctx
  const saldo = prestamo?.saldoPendiente ?? 0
  const diasMora = prestamo?.diasMora ?? 0
  const porcentaje = prestamo?.porcentajePagado ?? 0

  return [
    {
      key: 'saludo',
      label: 'Saludo',
      default: true,
      locked: true,
      texto: `Hola ${cliente?.nombre || ''} \u{1f44b}`,
    },
    {
      key: 'encabezado',
      label: 'Encabezado de exito',
      default: true,
      locked: true,
      texto: '\n✅ *Pago registrado con exito*',
    },
    {
      key: 'detalle_pago',
      label: 'Detalle del pago',
      default: true,
      texto: `\n\u{1f4b3} *Detalle del pago:*\n\u{1f4b5} Pagaste: ${formatMoney(pago?.montoPagado || 0)}\n\u{1f4c5} Fecha: ${formatFechaCorta(pago?.fechaPago)}`,
    },
    {
      key: 'estado_credito',
      label: 'Estado del credito',
      default: true,
      texto: buildEstadoCredito(prestamo, ocultarSaldo),
    },
    ...(Array.isArray(camposRecibo) && camposRecibo.length > 0 ? [{
      key: 'campos_extra',
      label: 'Campos personalizados',
      default: true,
      texto: '\n' + camposRecibo.map(c => {
        const val = c.tipo === 'texto' ? c.valor : resolverCampoWA(c.campo, cliente, prestamo)
        return `\u{1f4cb} ${c.nombre}: ${val}`
      }).join('\n'),
    }] : []),
    ...(diasMora > 0 ? [{
      key: 'aviso_mora',
      label: 'Aviso de mora',
      default: true,
      texto: `\n⚠️ Tienes ${diasMora} días en mora. Por favor ponte al día.`,
    }] : []),
    ...(saldo <= 0 ? [{
      key: 'felicitacion_pago',
      label: 'Felicitacion pago completo',
      default: true,
      texto: '\n\u{1f389} *¡Felicitaciones! Tu crédito está completamente pagado* \u{1f389}',
    }] : []),
    {
      key: 'firma',
      label: 'Firma',
      default: true,
      texto: `\n\n${firma(orgNombre)} \u{1f4bc}`,
    },
  ]
}

function seccionesCreditoAprobado(ctx) {
  const { cliente, prestamo, orgNombre } = ctx
  const etq = etiquetasFrecuencia(prestamo?.frecuencia)
  const crono = generarCronogramaCobros(prestamo)

  return [
    { key: 'saludo', label: 'Saludo', default: true, locked: true,
      texto: `Hola ${cliente?.nombre || ''} \u{1f44b}` },
    { key: 'encabezado', label: 'Encabezado', default: true, locked: true,
      texto: '\n\n✅ *Tu crédito ha sido aprobado*' },
    { key: 'resumen', label: 'Resumen del credito', default: true,
      texto: `\n\n\u{1f4cb} *Resumen de tu crédito:*\n\u{1f4b0} Monto prestado: ${formatMoney(prestamo?.montoPrestado)}\n\u{1f4b5} Total a pagar: ${formatMoney(prestamo?.totalAPagar)}\n\u{1f4c5} ${etq.cuota}: ${formatMoney(prestamo?.cuotaDiaria)}\n\u{1f4c6} Fecha inicio: ${formatFechaCorta(prestamo?.fechaInicio)}\n\u{1f4c6} Fecha fin: ${formatFechaCorta(prestamo?.fechaFin)}\n\u{1f4ca} Plazo: ${formatearPlazo(prestamo?.diasPlazo, prestamo?.frecuencia)}` },
    ...(crono ? [{ key: 'cronograma', label: 'Calendario de cobros', default: false,
      texto: crono }] : []),
    { key: 'aviso', label: 'Aviso de pago a tiempo', default: true,
      texto: `\n\n⚠️ Recuerda pagar tu ${etq.cuota.toLowerCase()} a tiempo para evitar intereses por mora.` },
    { key: 'firma', label: 'Firma', default: true,
      texto: `\n\n${firma(orgNombre)} \u{1f4bc}` },
  ]
}

function seccionesRecordatorio(ctx) {
  const { cliente, prestamo, orgNombre, ocultarSaldo } = ctx
  const etq = etiquetasFrecuencia(prestamo?.frecuencia)
  const saldo = Number(prestamo?.saldoPendiente ?? 0)
  const resumenLines = []
  if (!ocultarSaldo) resumenLines.push(`\u{1f4b0} Saldo pendiente: ${formatMoney(saldo)}`)
  resumenLines.push(`\u{1f4ca} Cuotas pendientes: ${calcularCuotasPendientes(prestamo)}`)
  const proximaFecha = calcularProximoCobroLocal(prestamo)
  const fechaTexto = fmtFechaProximoPago(proximaFecha)
  resumenLines.push(`\u{1f4c5} Próximo pago: ${fechaTexto || formatFechaCorta(proximaFecha) || 'Pendiente'}`)
  const lineaPago = fechaTexto
    ? `Te recordamos amablemente tu próximo ${etq.pago} de ${formatMoney(prestamo?.cuotaDiaria || 0)} *${fechaTexto}*.`
    : `Te recordamos amablemente tu próximo ${etq.pago} de ${formatMoney(prestamo?.cuotaDiaria || 0)}.`

  return [
    { key: 'saludo', label: 'Saludo', default: true, locked: true,
      texto: `Hola ${cliente?.nombre || ''} \u{1f44b}` },
    { key: 'recordatorio', label: 'Linea de recordatorio', default: true,
      texto: `\n\n${lineaPago}` },
    { key: 'resumen', label: 'Resumen financiero', default: true,
      texto: `\n\n\u{1f4cb} *Resumen:*\n${resumenLines.join('\n')}` },
    { key: 'cierre', label: 'Cierre amable', default: true,
      texto: '\n\nCualquier inquietud, escríbenos por aquí.\n\n¡Gracias por tu puntualidad! \u{1f64c}' },
    { key: 'firma', label: 'Firma', default: true,
      texto: `\n\n${firma(orgNombre)} \u{1f4bc}` },
  ]
}

function seccionesMora(nivel, ctx) {
  const { cliente, prestamo, orgNombre, ocultarSaldo } = ctx
  const dias = prestamo?.diasMora ?? 0

  if (nivel === 'suave') {
    const saldoLine = ocultarSaldo ? '' : `\n\u{1f4b0} Saldo pendiente: ${formatMoney(prestamo?.saldoPendiente || 0)}\n`
    return [
      { key: 'saludo', label: 'Saludo', default: true, locked: true,
        texto: `Hola ${cliente?.nombre || ''} \u{1f44b}` },
      { key: 'aviso', label: 'Aviso de vencimiento', default: true,
        texto: `\n\nNotamos que tu cuota de ${formatMoney(prestamo?.cuotaDiaria || 0)} lleva ${dias} día${dias === 1 ? '' : 's'} pendiente.\n\n¿Podemos pasar hoy a cobrar? También puedes ponerte al día por transferencia.` },
      { key: 'estado', label: 'Saldo pendiente', default: true,
        texto: saldoLine },
      { key: 'cierre', label: 'Cierre', default: true,
        texto: '\n¡Gracias!' },
      { key: 'firma', label: 'Firma', default: true,
        texto: `\n\n${firma(orgNombre)} \u{1f4bc}` },
    ]
  }

  if (nivel === 'firme') {
    const estadoLines = []
    if (!ocultarSaldo) estadoLines.push(`\u{1f4b0} Saldo pendiente: ${formatMoney(prestamo?.saldoPendiente || 0)}`)
    estadoLines.push(`\u{1f4c5} Cuota diaria: ${formatMoney(prestamo?.cuotaDiaria || 0)}`)
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

  // critica
  const saldoLine = ocultarSaldo ? '' : `\n\u{1f4ca} Saldo total pendiente: ${formatMoney(prestamo?.saldoPendiente || 0)}\n`
  return [
    { key: 'saludo', label: 'Saludo directo', default: true, locked: true,
      texto: `${cliente?.nombre || ''},` },
    { key: 'encabezado', label: 'Encabezado critico', default: true,
      texto: '\n\n\u{1f6a8} *Última oportunidad antes de cobro jurídico*' },
    { key: 'aviso', label: 'Texto del aviso', default: true,
      texto: `\n\nTu crédito tiene ${dias} días sin pago. Hemos intentado contactarte sin respuesta.` },
    { key: 'estado', label: 'Saldo pendiente', default: true,
      texto: saldoLine },
    { key: 'cierre', label: 'Cierre legal', default: true,
      texto: '\nPara evitar acciones legales, comunícate HOY mismo. Aún puedes acordar un plan de pago.\n\nEs la última vez que te escribimos por este medio antes de proceder.' },
    { key: 'firma', label: 'Firma', default: true,
      texto: `\n\n${firma(orgNombre)}` },
  ]
}

function seccionesHistorial(ctx) {
  const { cliente, prestamo, orgNombre, ocultarSaldo } = ctx
  const montoPrestado = Number(prestamo?.montoPrestado || 0)
  const totalAPagar = Number(prestamo?.totalAPagar || 0)
  const totalPagado = Number(calcularTotalPagadoReal(prestamo) || 0)
  const saldoPendiente = Math.max(0, Number(prestamo?.saldoPendiente || (totalAPagar - totalPagado)))
  const cuotaDiaria = Number(prestamo?.cuotaDiaria || 0)
  const cuotasPag = calcularCuotasPagadasLocal(prestamo)
  const cuotasPend = calcularCuotasPendientes(prestamo)
  const diasMora = Number(prestamo?.diasMora || 0)
  const porcentajePagado = Number(prestamo?.porcentajePagado || (totalAPagar > 0 ? Math.round((totalPagado / totalAPagar) * 100) : 0))
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
      return `• ${idx + 1}. ${formatFechaHoraLocal(p.fechaPago)} | ${getTipoPagoLabel(p.tipo)} | ${prefijo}${formatMoney(p.montoPagado || 0)}`
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

// ─── Helpers locales (duplicados mínimos de lib/whatsapp.js para evitar
//     imports circulares — solo formateo y lookup) ──────────────────────

import { formatFechaCorta, formatFechaHora as fmtFechaHoraI18n } from '@/lib/i18n'
import { calcularProximoCobro } from '@/lib/calculos'

function formatFechaHoraLocal(d) {
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

function calcularProximoCobroLocal(prestamo) {
  try { return calcularProximoCobro(prestamo) } catch { return null }
}

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

function calcularTotalPagadoReal(prestamo) {
  if (Number.isFinite(prestamo?.totalPagado)) return prestamo.totalPagado
  return (prestamo?.pagos ?? [])
    .filter(p => !['recargo', 'descuento'].includes(p.tipo))
    .reduce((acc, p) => acc + Number(p.montoPagado || 0), 0)
}

function calcularCuotasPagadasLocal(prestamo) {
  if (!prestamo?.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0
  return Math.floor(calcularTotalPagadoReal(prestamo) / prestamo.cuotaDiaria)
}

function calcularCuotasPendientes(prestamo) {
  if (Number.isFinite(prestamo?.cuotasPendientes)) return Math.max(0, prestamo.cuotasPendientes)
  if (!prestamo?.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0
  return Math.ceil(Math.max(0, Number(prestamo?.saldoPendiente || 0)) / prestamo.cuotaDiaria)
}

function getTipoPagoLabel(tipo) {
  if (tipo === 'completo') return 'Pago completo'
  if (tipo === 'parcial') return 'Pago parcial'
  if (tipo === 'capital') return 'Abono a capital'
  if (tipo === 'recargo') return 'Recargo'
  if (tipo === 'descuento') return 'Descuento'
  return 'Pago'
}

function buildEstadoCredito(prestamo, ocultarSaldo) {
  const saldo = prestamo?.saldoPendiente ?? 0
  const porcentaje = prestamo?.porcentajePagado ?? 0
  const lines = [`✅ Total pagado: ${formatMoney(prestamo?.totalPagado ?? 0)}`]
  if (!ocultarSaldo) {
    lines.push(`⏳ Saldo pendiente: ${formatMoney(saldo)}`)
    lines.push(`\u{1f4c8} Progreso: ${porcentaje}%`)
  }
  return `\n\n\u{1f4ca} *Estado de tu crédito:*\n${lines.join('\n')}`
}

function resolverCampoWA(campo, cliente, prestamo) {
  const saldo = prestamo?.saldoPendiente ?? Math.max(0, (prestamo?.totalAPagar ?? 0) - (prestamo?.totalPagado ?? 0))
  const map = {
    saldoPendiente:  formatMoney(saldo),
    totalPagado:     formatMoney(prestamo?.totalPagado ?? 0),
    totalAPagar:     formatMoney(prestamo?.totalAPagar ?? 0),
    montoPrestado:   formatMoney(prestamo?.montoPrestado ?? 0),
    cuota:           formatMoney(prestamo?.cuotaDiaria ?? 0),
    progreso:        `${prestamo?.porcentajePagado ?? 0}%`,
    frecuencia:      prestamo?.frecuencia ?? '-',
    fechaVencimiento: formatFechaCorta(prestamo?.fechaFin),
    numeroCuota:     prestamo?.numeroCuota ?? '-',
    diasMora:        `${prestamo?.diasMora ?? 0}`,
    clienteCedula:   (cliente?.cedula && !cliente.cedula.startsWith('SIN-')) ? cliente.cedula : '-',
    clienteTelefono: cliente?.telefono ?? '-',
    ruta:            prestamo?.rutaNombre ?? '-',
    cobrador:        prestamo?.cobradorNombre ?? '-',
  }
  return map[campo] ?? '-'
}

// ─── Persistencia en localStorage ─────────────────────────────

function getStorageKey(orgId) {
  return `cf-wa-secciones-${orgId || 'default'}`
}

function loadSeccionesGuardadas(orgId) {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(getStorageKey(orgId))
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveSeccionesGuardadas(orgId, config) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(getStorageKey(orgId), JSON.stringify(config))
  } catch {}
}

// ─── Definicion de plantillas ──────────────────────────────────

const TEMPLATES = [
  {
    id: 'pago_confirmacion',
    label: 'Confirmacion de pago',
    desc: 'Detalle completo del pago',
    icon: '✅',
    color: 'var(--color-success)',
    aplica: ({ prestamo, pago }) => !!prestamo && !!pago,
    getSecciones: (ctx) => seccionesPagoConfirmacion(ctx),
  },
  {
    id: 'gracias_corto',
    label: 'Gracias por tu pago',
    desc: 'Confirmacion corta sin saldo',
    icon: '\u{1f44d}',
    color: 'var(--color-success)',
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
    label: 'Credito aprobado',
    desc: 'Datos del nuevo credito',
    icon: '✅',
    color: 'var(--color-success)',
    aplica: ({ prestamo }) => !!prestamo,
    getSecciones: (ctx) => seccionesCreditoAprobado(ctx),
  },
  {
    id: 'recordatorio',
    label: 'Recordatorio amable',
    desc: 'Para clientes al dia',
    icon: '\u{1f514}',
    color: 'var(--color-success)',
    aplica: ({ prestamo }) => prestamo && prestamo.estado === 'activo' && (prestamo.diasMora ?? 0) === 0,
    getSecciones: (ctx) => seccionesRecordatorio(ctx),
  },
  {
    id: 'mora_suave',
    label: 'Vencimiento cercano',
    desc: 'Aviso suave de pago',
    icon: '⏰',
    color: '#f59e0b',
    aplica: ({ prestamo }) => prestamo && (prestamo.diasMora ?? 0) > 0 && (prestamo.diasMora ?? 0) <= 3,
    getSecciones: (ctx) => seccionesMora('suave', ctx),
  },
  {
    id: 'mora_firme',
    label: 'Aviso de mora',
    desc: 'Cliente atrasado +3 dias',
    icon: '⚠️',
    color: '#f97316',
    aplica: ({ prestamo }) => prestamo && (prestamo.diasMora ?? 0) > 3 && (prestamo.diasMora ?? 0) <= 15,
    getSecciones: (ctx) => seccionesMora('firme', ctx),
  },
  {
    id: 'mora_critica',
    label: 'Mora critica',
    desc: 'Mas de 15 dias',
    icon: '\u{1f6a8}',
    color: 'var(--color-danger)',
    aplica: ({ prestamo }) => prestamo && (prestamo.diasMora ?? 0) > 15,
    getSecciones: (ctx) => seccionesMora('critica', ctx),
  },
  {
    id: 'felicitacion',
    label: 'Felicitacion',
    desc: 'Cliente cumplido',
    icon: '\u{1f389}',
    color: 'var(--color-purple)',
    aplica: ({ prestamo }) => prestamo && prestamo.estado === 'activo' && (prestamo.porcentajePagado ?? 0) >= 50 && (prestamo.diasMora ?? 0) === 0,
    getSecciones: null,
    generar: ({ cliente, prestamo, orgNombre }) => generarTextoFelicitacion(cliente, prestamo, { orgNombre }),
  },
  {
    id: 'renovacion',
    label: 'Ofrecer renovacion',
    desc: 'Cerca de terminar',
    icon: '\u{1f504}',
    color: 'var(--color-teal)',
    aplica: ({ prestamo }) => prestamo && (prestamo.estado === 'completado' || (prestamo.porcentajePagado ?? 0) >= 80),
    getSecciones: null,
    generar: ({ cliente, orgNombre }) => generarTextoRenovacion(cliente, { orgNombre }),
  },
  {
    id: 'historial',
    label: 'Historial completo',
    desc: 'Todos los pagos del credito',
    icon: '\u{1f4c4}',
    color: 'var(--color-info)',
    aplica: ({ prestamo }) => prestamo && (prestamo.pagos?.length ?? 0) > 0,
    getSecciones: (ctx) => seccionesHistorial(ctx),
  },
  {
    id: 'oferta_credito',
    label: 'Oferta de credito',
    desc: 'Cliente sin prestamo activo',
    icon: '\u{1f4b0}',
    color: 'var(--color-success)',
    aplica: ({ prestamo }) => !prestamo || prestamo.estado === 'completado',
    getSecciones: null,
    generar: ({ cliente, orgNombre }) => `Hola ${cliente.nombre} \u{1f44b}\n\nTenemos credito disponible para ti con aprobacion inmediata.\n\nSi necesitas financiamiento, escribenos por aqui y te explicamos las condiciones. Sin compromiso.\n\n${firma(orgNombre)} \u{1f4bc}`,
  },
  {
    id: 'visita',
    label: 'Confirmar visita',
    desc: 'Coordinar cobro hoy',
    icon: '\u{1f6b6}',
    color: 'var(--color-info)',
    aplica: () => true,
    getSecciones: null,
    generar: ({ cliente, orgNombre }) => generarTextoVisita(cliente, { orgNombre }),
  },
  {
    id: 'comprobante',
    label: 'Pedir comprobante',
    desc: 'Solicitar foto de pago',
    icon: '\u{1f4f8}',
    color: 'var(--color-purple)',
    aplica: () => true,
    getSecciones: null,
    generar: ({ cliente, orgNombre }) => generarTextoComprobantePedido(cliente, { orgNombre }),
  },
  {
    id: 'libre',
    label: 'Mensaje libre',
    desc: 'Escribir desde cero',
    icon: '✏️',
    color: '#94a3b8',
    aplica: () => true,
    getSecciones: null,
    generar: ({ cliente }) => `Hola ${cliente.nombre} \u{1f44b}\n\n`,
  },
]

// ─── Componente de toggle de secciones ─────────────────────────

function PanelSecciones({ secciones, activas, onChange, guardado, onGuardar }) {
  if (!secciones?.length) return null

  const toggleables = secciones.filter(s => !s.locked)
  if (!toggleables.length) return null

  return (
    <div className="rounded-[12px] overflow-hidden" style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)' }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <p className="text-[10px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--color-text-muted)' }}>
          Secciones del mensaje
        </p>
        <button
          type="button"
          onClick={onGuardar}
          className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] font-medium transition-all"
          style={{
            background: guardado ? 'color-mix(in srgb, var(--color-success) 15%, transparent)' : 'var(--color-bg-card)',
            color: guardado ? 'var(--color-success)' : 'var(--color-accent)',
            border: `1px solid ${guardado ? 'var(--color-success)' : 'var(--color-border)'}`,
          }}
        >
          {guardado ? (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          )}
          {guardado ? 'Guardado' : 'Guardar'}
        </button>
      </div>

      <div className="divide-y divide-[var(--color-border)]">
        {toggleables.map(sec => {
          const checked = activas.has(sec.key)
          return (
            <button
              key={sec.key}
              type="button"
              onClick={() => onChange(sec.key)}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors"
              style={{ background: checked ? 'color-mix(in srgb, var(--color-accent) 4%, transparent)' : 'transparent' }}
            >
              {checked ? (
                <span className="flex items-center justify-center w-[18px] h-[18px] rounded-[5px] shrink-0 transition-all" style={{ background: 'var(--color-accent)' }}>
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              ) : (
                <span className="flex items-center justify-center w-[18px] h-[18px] rounded-[5px] shrink-0 transition-all" style={{ border: '2px solid var(--color-border)' }} />
              )}
              <span className={`text-[11px] font-medium transition-colors ${checked ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                {sec.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────

export default function ModalWhatsAppTemplates({
  open, onClose, cliente, prestamo, orgNombre, ocultarSaldo,
  pago, organizationId, camposRecibo,
  preselectedTemplateId,
}) {
  const [selectedId, setSelectedId] = useState(null)
  const [textoEditable, setTextoEditable] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [seccionesActivas, setSeccionesActivas] = useState(new Set())
  const [showSecciones, setShowSecciones] = useState(false)

  const tel = formatearTelefono(cliente?.telefono)

  const allConfig = useMemo(() => loadSeccionesGuardadas(organizationId), [organizationId, open])

  const ctx = useMemo(() => ({
    cliente, prestamo, pago, orgNombre, ocultarSaldo, camposRecibo,
  }), [cliente, prestamo, pago, orgNombre, ocultarSaldo, camposRecibo])

  const aplicables = useMemo(() => {
    return TEMPLATES.filter(t => {
      try { return t.aplica({ cliente, prestamo, pago }) } catch { return false }
    })
  }, [cliente, prestamo, pago])

  const selectedTemplate = useMemo(() => TEMPLATES.find(t => t.id === selectedId), [selectedId])

  const seccionesActuales = useMemo(() => {
    if (!selectedTemplate?.getSecciones) return null
    try { return selectedTemplate.getSecciones(ctx) } catch { return null }
  }, [selectedTemplate, ctx])

  const generarTextoConSecciones = useCallback((template, secActivas) => {
    if (!template) return ''
    if (template.getSecciones) {
      try {
        const secs = template.getSecciones(ctx)
        return secs
          .filter(s => s.locked || secActivas.has(s.key))
          .map(s => s.texto)
          .join('')
          .trim()
      } catch { return '' }
    }
    if (template.generar) {
      try { return template.generar(ctx) } catch { return '' }
    }
    return ''
  }, [ctx])

  const initSeccionesForTemplate = useCallback((templateId) => {
    const tmpl = TEMPLATES.find(t => t.id === templateId)
    if (!tmpl?.getSecciones) return new Set()
    const saved = allConfig[templateId]
    if (saved && Array.isArray(saved)) {
      return new Set(saved)
    }
    try {
      const secs = tmpl.getSecciones(ctx)
      return new Set(secs.filter(s => s.default || s.locked).map(s => s.key))
    } catch {
      return new Set()
    }
  }, [allConfig, ctx])

  useEffect(() => {
    if (!open) {
      setSelectedId(null)
      setTextoEditable('')
      setCopiado(false)
      setGuardado(false)
      setShowSecciones(false)
      return
    }
    const targetId = preselectedTemplateId || null
    const sugerido = targetId
      ? aplicables.find(t => t.id === targetId) || aplicables.find(t => t.id !== 'libre') || aplicables[0]
      : aplicables.find(t => t.id !== 'libre') || aplicables[0]
    if (sugerido) {
      setSelectedId(sugerido.id)
      const secs = initSeccionesForTemplate(sugerido.id)
      setSeccionesActivas(secs)
      setTextoEditable(generarTextoConSecciones(sugerido, secs))
      setShowSecciones(!!sugerido.getSecciones)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleSelect = (template) => {
    setSelectedId(template.id)
    setGuardado(false)
    const secs = initSeccionesForTemplate(template.id)
    setSeccionesActivas(secs)
    setTextoEditable(generarTextoConSecciones(template, secs))
    setShowSecciones(!!template.getSecciones)
  }

  const handleToggleSeccion = (key) => {
    setSeccionesActivas(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      const tmpl = TEMPLATES.find(t => t.id === selectedId)
      if (tmpl) {
        setTextoEditable(generarTextoConSecciones(tmpl, next))
      }
      return next
    })
    setGuardado(false)
  }

  const handleGuardar = () => {
    if (!selectedId) return
    const newConfig = { ...allConfig, [selectedId]: [...seccionesActivas] }
    saveSeccionesGuardadas(organizationId, newConfig)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2500)
  }

  const handleEnviar = () => {
    if (!tel || !textoEditable.trim()) return
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(textoEditable)}`
    abrirWhatsApp(url)
    onClose?.()
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Enviar WhatsApp a ${cliente?.nombre || 'cliente'}`}
      footer={
        <div className="flex gap-2 w-full">
          <Button variant="secondary" onClick={onClose} className="flex-shrink-0">
            Cancelar
          </Button>
          <button
            onClick={handleEnviar}
            disabled={!tel || !textoEditable.trim()}
            className="flex-1 h-10 rounded-[12px] text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: '#25D366', color: '#fff' }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            Enviar por WhatsApp
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {!tel && (
          <div className="rounded-[10px] px-3 py-2.5 text-[12px]" style={{ background: 'var(--color-warning-dim)', color: 'var(--color-warning)', border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)' }}>
            Este cliente no tiene un telefono valido registrado.
          </div>
        )}

        {/* Selector de plantillas */}
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.07em] mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Elige una plantilla
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {aplicables.map(t => {
              const active = selectedId === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelect(t)}
                  className="rounded-[10px] px-2.5 py-2 text-left transition-all"
                  style={{
                    background: active ? `color-mix(in srgb, ${t.color} 18%, transparent)` : 'var(--color-bg-card)',
                    border: `1px solid ${active ? t.color : 'var(--color-border)'}`,
                    boxShadow: active ? `0 0 0 1px ${t.color}, 0 4px 12px color-mix(in srgb, ${t.color} 20%, transparent)` : 'none',
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[14px]">{t.icon}</span>
                    <span className="text-[11px] font-semibold truncate" style={{ color: active ? t.color : 'var(--color-text-primary)' }}>{t.label}</span>
                  </div>
                  <p className="text-[9px] leading-tight" style={{ color: 'var(--color-text-muted)' }}>{t.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Panel de secciones personalizables */}
        {seccionesActuales && seccionesActuales.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowSecciones(v => !v)}
              className="flex items-center gap-1.5 w-full text-left mb-2"
            >
              <svg
                className="w-3 h-3 transition-transform"
                style={{ transform: showSecciones ? 'rotate(90deg)' : 'rotate(0)', color: 'var(--color-text-muted)' }}
                fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-[10px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--color-text-muted)' }}>
                Personalizar secciones
              </span>
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', color: 'var(--color-accent)' }}>
                {seccionesActuales.filter(s => !s.locked && seccionesActivas.has(s.key)).length}/{seccionesActuales.filter(s => !s.locked).length}
              </span>
            </button>

            {showSecciones && (
              <PanelSecciones
                secciones={seccionesActuales}
                activas={seccionesActivas}
                onChange={handleToggleSeccion}
                guardado={guardado}
                onGuardar={handleGuardar}
              />
            )}
          </div>
        )}

        {/* Preview editable */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--color-text-muted)' }}>
              Mensaje (puedes editarlo)
            </p>
            <div className="flex items-center gap-2">
              <p className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
                {textoEditable.length} caracteres
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(textoEditable)
                    setCopiado(true)
                    setTimeout(() => setCopiado(false), 2000)
                  } catch {}
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] font-medium transition-all"
                style={{
                  background: copiado ? 'color-mix(in srgb, var(--color-success) 15%, transparent)' : 'var(--color-bg-card)',
                  color: copiado ? 'var(--color-success)' : 'var(--color-text-muted)',
                  border: `1px solid ${copiado ? 'var(--color-success)' : 'var(--color-border)'}`,
                }}
              >
                {copiado ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                )}
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
          <textarea
            value={textoEditable}
            onChange={(e) => setTextoEditable(e.target.value)}
            rows={10}
            className="w-full rounded-[10px] px-3 py-2.5 text-[13px] font-mono resize-y focus:outline-none focus:ring-2"
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              minHeight: '180px',
            }}
            placeholder="Escribe tu mensaje..."
          />
        </div>
      </div>
    </Modal>
  )
}
