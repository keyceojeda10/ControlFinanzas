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

function resumenContexto(lead, historial = []) {
  const piezas = []
  if (lead.cantClientes) piezas.push(`tiene ${lead.cantClientes} clientes`)
  if (lead.metodoActual) piezas.push(`usa ${lead.metodoActual}`)
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

  const mensajeParaCopiar = `Hola ${primerNombre}, soy Carlos del equipo de Control Finanzas. Te puedo seguir ayudando por acá.\n\n${resumenContexto(lead, historial) ? 'Vi que ' + resumenContexto(lead, historial) + '.' : ''}\n\nCuéntame, en qué te puedo ayudar?`

  // 1. Telegram (principal) — con mensaje listo para copiar/pegar
  const texto =
`🔥 <b>ESCALAMIENTO INMEDIATO</b>

👤 <b>${esc(lead.nombre || 'Sin nombre')}</b>
📱 ${esc(tel)}
👥 Clientes: ${esc(lead.cantClientes || '—')}
🌡 Temperatura: ${lead.temperatura || '—'}/100

📌 Motivo: ${esc(motivo || 'El lead necesita atención humana.')}

💬 Lo último que dijo:
${esc(resumenConversacion(historial))}

📋 <b>Copiar y pegar en WhatsApp:</b>

<pre>${esc(mensajeParaCopiar)}</pre>

📱 Escribirle: https://wa.me/${tel}`

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

Gasto API: US$${gasto.hoyUsd} hoy / US$${gasto.totalUsd} total`

  return enviar(texto, 'reporte')
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
