// lib/bot/alertas.js — Alertas internas al admin (lead caliente, reporte diario)
//
// Escalamientos prioritarios van por WhatsApp al numero admin.
// El reporte diario sigue por Telegram (canal 'notif').

import { sendMessage } from '@/lib/telegram'
import * as wa from './whatsapp-cloud'

const ADMIN_PHONE = process.env.WHATSAPP_ADMIN_NUMBER || ''
const TEMPLATE_ESCALAMIENTO = 'escalamiento_lead'

function resumenConversacion(historial = []) {
  const ultimos = historial
    .filter(m => m.rol === 'lead')
    .slice(-3)
    .map(m => `"${(m.texto || '').slice(0, 120)}"`)
    .join('\n')
  return ultimos || '(sin mensajes recientes)'
}

// Escapa caracteres HTML para Telegram (parse_mode HTML)
function esc(t) {
  return (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function alertarLeadCaliente(lead, motivo, historial = []) {
  const tel = (lead.telefono || '').replace(/\D/g, '')

  // 1. WhatsApp al admin (prioritario)
  const waOk = await alertarPorWhatsApp(lead, motivo)

  // 2. Telegram como backup
  const texto =
`🔥 <b>LEAD CALIENTE</b> — Control Finanzas

👤 <b>${esc(lead.nombre || 'Sin nombre')}</b>
📱 ${esc(tel)}
👥 Clientes: ${esc(lead.cantClientes || '—')}
🌡 Temperatura: ${lead.temperatura || '—'}/100

Motivo: ${esc(motivo || 'El prospecto esta listo para avanzar.')}

Último que dijo:
${esc(resumenConversacion(historial))}

Escribirle: https://wa.me/${tel}`

  const tgOk = await enviar(texto, 'notif')

  return waOk || tgOk
}

async function alertarPorWhatsApp(lead, motivo) {
  if (!ADMIN_PHONE) {
    console.warn('[Bot Alertas] WHATSAPP_ADMIN_NUMBER no configurado, saltando alerta WA.')
    return false
  }
  const adminTel = ADMIN_PHONE.replace(/\D/g, '')
  if (!adminTel) return false

  const nombre = (lead.nombre || 'Sin nombre').slice(0, 60)
  const motivoCorto = (motivo || 'Lead listo para avanzar').slice(0, 120)

  try {
    // Intentar texto libre primero (funciona si admin escribio al bot en <24h)
    const tel = (lead.telefono || '').replace(/\D/g, '')
    const msg = `*Escalamiento*: ${nombre} (${tel})\n\nMotivo: ${motivoCorto}\n\nEscribirle: https://wa.me/${tel}\nVer en panel: https://app.control-finanzas.com/admin/leads`
    const r = await wa.sendText(adminTel, msg)
    if (r && !r.error) {
      console.log(`[Bot Alertas] WhatsApp enviado al admin (texto libre).`)
      return true
    }
  } catch (e) {
    console.log(`[Bot Alertas] Texto libre fallo (${e.message}), intentando plantilla...`)
  }

  // Fallback: plantilla (funciona siempre, incluso fuera de ventana 24h)
  try {
    const r = await wa.sendTemplate(adminTel, TEMPLATE_ESCALAMIENTO, {
      nombre: (lead.nombre || 'Sin nombre').slice(0, 60),
      motivo: (motivo || 'Lead listo para avanzar').slice(0, 120),
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
