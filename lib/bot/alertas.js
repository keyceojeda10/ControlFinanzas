// lib/bot/alertas.js — Alertas internas al admin (lead caliente, reporte diario)
//
// Las alertas llegan por DOS canales en paralelo:
// 1. Telegram (canal 'notif') — independiente del WhatsApp, sirve de respaldo.
// 2. WhatsApp directo al número de soporte (WHATSAPP_ADMIN_NUMBER o 3011993001).
//    El bot le escribe al admin con el resumen del lead y un link para responderle.

import { sendMessage } from '@/lib/telegram'
import { sendText, toWaNumber, configurado } from '@/lib/bot/whatsapp-cloud'

// Número de soporte/admin al que llegan las alertas por WhatsApp
const ADMIN_WA = process.env.WHATSAPP_ADMIN_NUMBER || '3011993001'

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

  // 1. Alerta Telegram (HTML)
  const textoTelegram =
`🔥 <b>LEAD CALIENTE</b> — Control Finanzas

👤 <b>${esc(lead.nombre || 'Sin nombre')}</b>
📱 ${esc(tel)}
👥 Clientes: ${esc(lead.cantClientes || '—')}
🌡 Temperatura: ${lead.temperatura || '—'}/100

Motivo: ${esc(motivo || 'El prospecto esta listo para avanzar.')}

Ultimo que dijo:
${esc(resumenConversacion(historial))}

Escribirle: https://wa.me/${tel}`

  enviar(textoTelegram, 'notif')

  // 2. Alerta WhatsApp al número de soporte (texto plano)
  if (configurado()) {
    const nombreLead = lead.nombre || 'Sin nombre'
    const ultimoDijo = historial.filter(m => m.rol === 'lead').slice(-1)[0]?.texto || ''
    const textoWA =
`*CLIENTE NECESITA ATENCION* — Control Finanzas

*Nombre:* ${nombreLead}
*Tel:* ${tel ? `https://wa.me/${toWaNumber(tel)}` : '—'}
*Motivo:* ${motivo || 'Listo para avanzar'}
*Temperatura:* ${lead.temperatura || '—'}/100

*Último mensaje:*
"${ultimoDijo.slice(0, 200)}"`

    sendText(ADMIN_WA, textoWA).catch(e =>
      console.error('[Bot Alertas] WhatsApp admin error:', e.message)
    )
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
