// lib/bot/alertas.js — Alertas internas al admin (lead caliente, reporte diario)
//
// Escalamiento va por Telegram (canal 'notif') con mensaje listo para copiar.
// WhatsApp al admin se intenta como bonus (requiere ventana 24h o plantilla aprobada).

import { sendMessage } from '@/lib/telegram'
import * as wa from './whatsapp-cloud'
import { textoCantClientes } from '@/lib/fb-leads'

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

/* El rango va por `textoCantClientes`, el mismo que usa el bot: si la alerta al
   admin y el mensaje al lead escribieran el rango de dos formas distintas, el
   día que una se rompa la otra lo tapa. El resto de códigos —el método— sigue
   por la sustitución simple, que para ellos alcanza. */
function humanizar(val) {
  if (!val) return null
  if (/\d/.test(String(val))) return textoCantClientes(val)
  return String(val).replace(/_/g, ' ')
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

  // Canal DEDICADO de escalamientos (cae a 'notif' si no esta configurado).
  const tgOk = await enviar(texto, 'escalamiento', 'escalamiento')

  // 2. WhatsApp al numero de soporte (canal principal: es donde trabaja el
  //    humano que devuelve el contacto).
  const waOk = await alertarPorWhatsApp(lead, motivo, historial)

  return tgOk || waOk
}

async function alertarPorWhatsApp(lead, motivo, historial = []) {
  if (!ADMIN_PHONE) {
    console.warn('[Bot Alertas] WHATSAPP_ADMIN_NUMBER no configurado — sin alerta por WhatsApp.')
    return false
  }
  let adminTel = ADMIN_PHONE.replace(/\D/g, '')
  if (!adminTel) return false
  if (adminTel.length === 10) adminTel = '57' + adminTel

  const nombre = (lead.nombre || 'Sin nombre').slice(0, 60)
  const motivoCorto = (motivo || 'Lead listo para avanzar').slice(0, 160)
  const tel = (lead.telefono || '').replace(/\D/g, '')
  const ultimo = (historial.filter(m => m.rol === 'lead').slice(-1)[0]?.texto || '').slice(0, 160)
  const datos = [
    humanizar(lead.cantClientes) ? `${humanizar(lead.cantClientes)} clientes` : '',
    lead.metodoActual ? `usa ${humanizar(lead.metodoActual)}` : '',
  ].filter(Boolean).join(' · ')

  try {
    // Formato scaneable: llega entre muchos chats de soporte, tiene que
    // distinguirse de un lead cualquiera y decir QUE hacer en un vistazo.
    const msg =
`🔴 *LEAD CALIENTE — atender ya*

*${nombre}*
Tel: ${tel}
Temperatura: ${lead.temperatura ?? '—'}/100${datos ? `\n${datos}` : ''}

*Motivo:* ${motivoCorto}${ultimo ? `\n\n*Lo último que dijo:*\n"${ultimo}"` : ''}

Abrirle el chat:
https://wa.me/${tel}`
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

Entrega WhatsApp: ${metricas.tasaEntrega ?? '—'}% (${metricas.entregaFallidos || 0} fallidos / ${metricas.entregaTotal || 0})${(metricas.tasaEntrega != null && metricas.tasaEntrega < 70) ? '\n⚠️ ENTREGA BAJA — mirar el motivo en la alerta de entrega, NO dar por hecho que es el pago' : ''}

Gasto API: US$${gasto.hoyUsd} hoy / US$${gasto.totalUsd} total${metricas.ab && (metricas.ab.A || metricas.ab.B) ? `

🧪 <b>A/B Test Hooks</b>
A (pregunta metodo): ${metricas.ab.A ? `${metricas.ab.A.total} leads → ${metricas.ab.A.tasaResp}% resp → ${metricas.ab.A.tasaReg}% reg` : 'sin datos'}
B (pregunta deuda): ${metricas.ab.B ? `${metricas.ab.B.total} leads → ${metricas.ab.B.tasaResp}% resp → ${metricas.ab.B.tasaReg}% reg` : 'sin datos'}` : ''}`

  return enviar(texto, 'reporte')
}

/* ⚠ LA ALERTA DICE QUÉ PASÓ DE VERDAD, NO UNA CAUSA POSIBLE.
 *
 * Antes soltaba SIEMPRE esta frase, fuera cual fuera el error:
 *
 *   «Si el error es 131042 (payment issue), revisar la forma de pago…»
 *
 * El 29 de agosto de 2026 saltó dos veces con el código 130472 —que no tiene
 * nada que ver con el pago— y el dueño se pasó la mañana buscando un problema
 * de facturación que no existía. Una alerta que nombra una causa ajena manda a
 * la persona al sitio equivocado, y eso sale más caro que no avisar.
 *
 * Y tampoco decía «los leads NO están recibiendo mensajes», que era falso: con
 * un 20 % de fallo, cuatro de cada cinco SÍ llegaban. Ahora se dice el reparto
 * entero, porque la diferencia entre «se cayó» y «pierde uno de cada cinco» es
 * la diferencia entre dejar todo y mirarlo el lunes. */
export async function alertarFallosEntrega(fallidos, total, pct, ultimoError) {
  const { explicarCodigo } = await import('@/lib/bot/codigos-wa')
  const e = explicarCodigo(ultimoError)
  const llegaron = Math.max(0, total - fallidos)

  const texto =
`⚠️ <b>BAJA LA ENTREGA DE WHATSAPP</b>

No llegaron <b>${fallidos} de ${total}</b> mensajes en 24h (${pct}%).
Los otros ${llegaron} sí llegaron.

<b>Qué pasa</b>
${esc(e.que)}

<b>Qué hacer</b>
${esc(e.hacer)}

Código de Meta: <code>${esc(String(ultimoError || 'desconocido')).slice(0, 120)}</code>`

  return enviar(texto, 'alerta-entrega')
}

/**
 * Meta corto los envios (facturacion o restriccion de cuenta).
 * Se dispara con el PRIMER mensaje bloqueado, no con una tasa acumulada:
 * cuando esto pasa el bot ya esta mudo y cada hora cuesta leads.
 */
export async function alertarCorteMeta(codigo, motivo) {
  const texto =
`🛑 <b>META CORTÓ EL BOT</b>

${esc(motivo)}
Código: <code>${esc(codigo)}</code>

<b>El bot NO está entregando mensajes ahora mismo.</b>

Qué revisar, en este orden:
1. business.facebook.com → Configuración → Pagos
2. Que la tarjeta no esté vencida ni rechazada
3. Si hay saldo pendiente, pagarlo (se reactiva solo en minutos)

Para ver el estado completo:
<code>node scripts/salud-bot.cjs</code>`

  return enviar(texto, 'corte-meta')
}

async function enviar(texto, etiqueta, bot = 'notif') {
  try {
    const r = await sendMessage(texto, null, bot)
    if (r && r.ok) {
      console.log(`[Bot Alertas] Telegram enviada (${etiqueta} → bot:${bot}).`)
      return true
    }
    console.warn(`[Bot Alertas] Telegram no confirmo envio (${etiqueta} → bot:${bot}).`)
    return false
  } catch (e) {
    console.error('[Bot Alertas] Error:', e.message)
    return false
  }
}
