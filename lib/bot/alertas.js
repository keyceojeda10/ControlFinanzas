// lib/bot/alertas.js — Alertas internas al admin (lead caliente, reporte diario)
//
// Las alertas van por Telegram (canal 'notif'). El cliente que necesita soporte
// o quiere pagar recibe directamente el link wa.me del número de soporte en el
// chat del bot — no se necesita notificación adicional al admin.

import { sendMessage } from '@/lib/telegram'

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
  const texto =
`🔥 <b>LEAD CALIENTE</b> — Control Finanzas

👤 <b>${esc(lead.nombre || 'Sin nombre')}</b>
📱 ${esc(tel)}
👥 Clientes: ${esc(lead.cantClientes || '—')}
🌡 Temperatura: ${lead.temperatura || '—'}/100

Motivo: ${esc(motivo || 'El prospecto esta listo para avanzar.')}

Ultimo que dijo:
${esc(resumenConversacion(historial))}

Escribirle: https://wa.me/${tel}`

  return enviar(texto, 'notif')
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
