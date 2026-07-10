// lib/bot/alertas.js — Alertas internas al admin (lead caliente, reporte diario)
//
// Escalamiento va por Telegram (canal 'notif') con mensaje listo para copiar.
// WhatsApp al admin se intenta como bonus (requiere ventana 24h o plantilla aprobada).

import { sendMessage } from '@/lib/telegram'
import * as wa from './whatsapp-cloud'

const ADMIN_PHONE = process.env.WHATSAPP_ADMIN_NUMBER || ''
const TEMPLATE_ESCALAMIENTO = 'alerta_escalamiento'

function resumenConversacion(historial = []) {
  const ultimos = historial
    .filter(m => m.rol === 'lead')
    .slice(-3)
    .map(m => `"${(m.texto || '').slice(0, 120)}"`)
    .join('\n')
  return ultimos || '(sin mensajes recientes)'
}

function humanizar(val) {
  if (!val) return null
  return String(val).replace(/_/g, ' ').replace(/menos de/i, 'menos de').replace(/mas de/i, 'más de')
}

function resumenContexto(lead, historial = []) {
  const piezas = []
  if (lead.cantClientes) piezas.push(`tiene ${humanizar(lead.cantClientes)} clientes`)
  if (lead.metodoActual) piezas.push(`usa ${humanizar(lead.metodoActual)}`)
  const ultimoLead = historial.filter(m => m.rol === 'lead').slice(-1)[0]
  if (ultimoLead?.texto) piezas.push(`preguntó: "${(ultimoLead.texto).slice(0, 80)}"`)
  return piezas.length ? piezas.join(', ') : 'lead interesado en el sistema'
}

function esc(t) {
  return (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function alertarLeadCaliente(lead, motivo, historial = []) {
  const tel = (lead.telefono || '').replace(/\D/g, '')
  const primerNombre = (lead.nombre || 'amigo').split(' ')[0]

  const contexto = resumenContexto(lead, historial)
  const mensajeWa = `Hola ${primerNombre}, soy del equipo de Control Finanzas. ${contexto !== 'lead interesado en el sistema' ? 'Vi que ' + contexto + '.' : 'Le escribo para ayudarle.'}\n\nCuéntame, en qué te puedo ayudar?`
  const linkWa = `https://wa.me/${tel}?text=${encodeURIComponent(mensajeWa)}`

  // 1. Telegram (principal) — con botón directo a WhatsApp
  const texto =
`🔥 <b>Lead caliente</b>

${esc(lead.nombre || 'Sin nombre')} · ${esc(tel)}${humanizar(lead.cantClientes) || lead.metodoActual ? '\n' + [humanizar(lead.cantClientes) ? humanizar(lead.cantClientes) + ' clientes' : '', lead.metodoActual ? 'usa ' + humanizar(lead.metodoActual) : ''].filter(Boolean).join(' · ') : ''}
Temperatura: ${lead.temperatura || '—'}/100

${esc(motivo || 'El lead necesita atención.')}

Lo último que dijo:
${esc(resumenConversacion(historial))}

👉 <a href="${linkWa}">Escribirle por WhatsApp</a>`

  const tgOk = await enviar(texto, 'escalamiento')

  // 2. WhatsApp al admin (bonus, puede fallar si no hay ventana)
  const waOk = await alertarPorWhatsApp(lead, motivo)

  return tgOk || waOk
}

async function alertarPorWhatsApp(lead, motivo) {
  if (!ADMIN_PHONE) return false
  let adminTel = ADMIN_PHONE.replace(/\D/g, '')
  if (!adminTel) return false
  if (adminTel.length === 10) adminTel = '57' + adminTel

  const nombre = (lead.nombre || 'Sin nombre').slice(0, 60)
  const motivoCorto = (motivo || 'Lead listo para avanzar').slice(0, 120)
  const tel = (lead.telefono || '').replace(/\D/g, '')

  try {
    const msg = `*Escalamiento*: ${nombre} (${tel})\n\nMotivo: ${motivoCorto}\n\nEscribirle: https://wa.me/${tel}`
    const r = await wa.sendText(adminTel, msg)
    if (r && !r.error) {
      console.log(`[Bot Alertas] WhatsApp enviado al admin (texto libre).`)
      return true
    }
  } catch (e) {
    console.log(`[Bot Alertas] Texto libre WA fallo (${e.message}), intentando plantilla...`)
  }

  try {
    const r = await wa.sendTemplate(adminTel, TEMPLATE_ESCALAMIENTO, {
      nombre: (lead.nombre || 'Sin nombre').slice(0, 60),
      motivo: (motivo || 'Lead listo para avanzar').slice(0, 120),
      telefono: tel || 'sin_telefono',
    })
    if (r && !r.error) {
      console.log(`[Bot Alertas] WhatsApp enviado al admin (plantilla).`)
      return true
    }
    console.warn(`[Bot Alertas] Plantilla WA fallo:`, r?.error || 'sin respuesta')
    return false
  } catch (e) {
    console.error(`[Bot Alertas] Error enviando WA al admin:`, e.message)
    return false
  }
}

export async function alertarReporteDiario(metricas, gasto) {
  const fecha = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const texto =
`📊 <b>REPORTE DEL DIA</b> — ${esc(fecha)}

Total leads: ${metricas.total}
Contactados: ${metricas.contactados}
Tasa respuesta: ${metricas.tasaRespuesta}%

Por estado:
- Pendientes: ${metricas.porEstado.pendiente || 0}
- Contactados: ${metricas.porEstado.contactado || 0}
- Interesados: ${metricas.porEstado.interesado || 0}
- Cerrados: ${metricas.porEstado.cerrado || 0}

Entrega WhatsApp: ${metricas.tasaEntrega ?? '—'}% (${metricas.entregaFallidos || 0} fallidos / ${metricas.entregaTotal || 0})${(metricas.tasaEntrega != null && metricas.tasaEntrega < 70) ? '\n⚠️ TASA DE ENTREGA BAJA — revisar pago en Meta Business' : ''}

Gasto API: US$${gasto.hoyUsd} hoy / US$${gasto.totalUsd} total${metricas.ab && (metricas.ab.A || metricas.ab.B) ? `

🧪 <b>A/B Test Hooks</b>
A (pregunta metodo): ${metricas.ab.A ? `${metricas.ab.A.total} leads → ${metricas.ab.A.tasaResp}% resp → ${metricas.ab.A.tasaReg}% reg` : 'sin datos'}
B (pregunta deuda): ${metricas.ab.B ? `${metricas.ab.B.total} leads → ${metricas.ab.B.tasaResp}% resp → ${metricas.ab.B.tasaReg}% reg` : 'sin datos'}` : ''}`

  return enviar(texto, 'reporte')
}

export async function alertarFallosEntrega(fallidos, total, pct, ultimoError) {
  const texto =
`🚨 <b>ALERTA: WHATSAPP NO ENTREGA MENSAJES</b>

${fallidos}/${total} mensajes fallaron en 24h (<b>${pct}%</b>)

Error: <code>${esc(ultimoError || 'desconocido')}</code>

⚠️ Si el error es 131042 (payment issue), revisar la forma de pago en business.facebook.com → Configuración de pago → WhatsApp.

Los leads NO están recibiendo mensajes del bot.`

  return enviar(texto, 'alerta-entrega')
}

async function enviar(texto, etiqueta) {
  try {
    const r = await sendMessage(texto, null, 'notif')
    if (r && r.ok) {
      console.log(`[Bot Alertas] Telegram enviada (${etiqueta}).`)
      return true
    }
    console.warn(`[Bot Alertas] Telegram no confirmo envio (${etiqueta}).`)
    return false
  } catch (e) {
    console.error('[Bot Alertas] Error:', e.message)
    return false
  }
}
