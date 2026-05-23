// lib/bot/alertas.js — Alertas al WhatsApp personal

import * as openwa from './openwa-client'

const WHATSAPP_PERSONAL = process.env.BOT_WHATSAPP_PERSONAL

function resumenConversacion(historial = []) {
  const ultimos = historial
    .filter(m => m.rol === 'lead')
    .slice(-3)
    .map(m => `"${(m.texto || '').slice(0, 120)}"`)
    .join('\n')
  return ultimos || '(sin mensajes recientes)'
}

export async function alertarLeadCaliente(lead, motivo, historial = []) {
  if (!WHATSAPP_PERSONAL) {
    console.warn('[Bot Alertas] Falta BOT_WHATSAPP_PERSONAL')
    return false
  }
  const tel = (lead.telefono || '').replace(/\D/g, '')
  const texto =
`LEAD CALIENTE — Control Finanzas

Nombre: ${lead.nombre || 'Sin nombre'}
WhatsApp: ${tel}
Clientes: ${lead.cantClientes || '—'}
Temperatura: ${lead.temperatura || '—'}/100

Motivo: ${motivo || 'El prospecto esta listo para avanzar.'}

Ultimo que dijo:
${resumenConversacion(historial)}

Escribirle: https://wa.me/${tel}

El bot SIGUE respondiendo. Escribe TOMAR para tomar la conversacion.`

  return enviar(texto, lead.nombre)
}

export async function alertarReporteDiario(metricas, gasto) {
  if (!WHATSAPP_PERSONAL) return false
  const fecha = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const texto =
`REPORTE DEL DIA — ${fecha}

Total leads: ${metricas.total}
Contactados: ${metricas.contactados}
Tasa respuesta: ${metricas.tasaRespuesta}%

Por estado:
- Pendientes: ${metricas.porEstado.pendiente || 0}
- Contactados: ${metricas.porEstado.contactado || 0}
- Interesados: ${metricas.porEstado.interesado || 0}
- Cerrados: ${metricas.porEstado.cerrado || 0}

Gasto API: US$${gasto.hoyUsd} hoy / US$${gasto.totalUsd} total`

  return enviar(texto, 'reporte')
}

async function enviar(texto, nombre) {
  try {
    await openwa.sendText(WHATSAPP_PERSONAL, texto)
    console.log(`[Bot Alertas] Enviada (${nombre}).`)
    return true
  } catch (e) {
    console.error('[Bot Alertas] Error:', e.message)
    return false
  }
}
