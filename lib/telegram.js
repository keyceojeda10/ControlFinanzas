// lib/telegram.js — Utilidades centralizadas de Telegram Bot
// Usado por: webhook leads, cron sync, cron followup, callback handler

import { PLANES } from '@/lib/mercadopago'

// Bot de Leads (leads nuevos, tarjetas interactivas)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

// Bot de Notificaciones (recordatorios, alertas)
const NOTIF_BOT_TOKEN = process.env.TELEGRAM_NOTIF_BOT_TOKEN
const NOTIF_CHAT_ID = process.env.TELEGRAM_NOTIF_CHAT_ID

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatNombreSaludo(nombre) {
  if (!nombre) return 'cliente'
  const primer = nombre.split(' ')[0]
  return primer.charAt(0).toUpperCase() + primer.slice(1).toLowerCase()
}

// Escapa caracteres HTML para Telegram (previene errores con <> en nombres)
function escapeHtml(text) {
  if (!text) return ''
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatTelefono(telefono) {
  return telefono ? telefono.replace(/\D/g, '') : ''
}

function formatFecha(createdTime) {
  const opts = {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }
  const date = createdTime ? new Date(createdTime * 1000) : new Date()
  return date.toLocaleString('es-CO', opts)
}

// ---------------------------------------------------------------------------
// Low-level Telegram API
// ---------------------------------------------------------------------------

// bot = 'leads' (default) | 'notif'
async function telegramAPI(method, body, bot = 'leads') {
  const token = bot === 'notif' ? NOTIF_BOT_TOKEN : BOT_TOKEN
  if (!token) {
    console.warn(`[Telegram:${bot}] BOT_TOKEN no configurado`)
    return null
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!data.ok) console.error(`[Telegram:${bot}] ${method} error:`, data.description)
    return data
  } catch (err) {
    console.error(`[Telegram:${bot}] ${method}:`, err.message)
    return null
  }
}

function getChatId(bot = 'leads') {
  return bot === 'notif' ? NOTIF_CHAT_ID : CHAT_ID
}

export async function sendMessage(text, replyMarkup, bot = 'leads') {
  const body = {
    chat_id: getChatId(bot),
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }
  if (replyMarkup) body.reply_markup = replyMarkup
  return telegramAPI('sendMessage', body, bot)
}

export async function editMessageReplyMarkup(messageId, replyMarkup, bot = 'leads') {
  return telegramAPI('editMessageReplyMarkup', {
    chat_id: getChatId(bot),
    message_id: messageId,
    reply_markup: replyMarkup,
  }, bot)
}

export async function editMessageText(messageId, text, replyMarkup, bot = 'leads') {
  const body = {
    chat_id: getChatId(bot),
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }
  if (replyMarkup) body.reply_markup = replyMarkup
  return telegramAPI('editMessageText', body, bot)
}

export async function answerCallback(callbackQueryId, text, bot = 'leads') {
  return telegramAPI('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  }, bot)
}

// ---------------------------------------------------------------------------
// WhatsApp message generation (for first contact)
// ---------------------------------------------------------------------------

export function buildFirstMessage(nombre) {
  const saludo = formatNombreSaludo(nombre)

  // CORTO. El objetivo es que responda, nada más.
  // Pregunta fácil de contestar. No vender.
  return [
    `Hola ${saludo}, acabo de ver tu solicitud.`,
    ``,
    `Una pregunta rápida: tú cobras tú mismo o tienes cobradores en la calle?`,
  ].join('\n')
}

export function whatsappLink(telefono, mensaje) {
  const tel = formatTelefono(telefono)
  if (!tel) return null
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
}

// Link que pasa por nuestro redirect para marcar como contactado antes de abrir WhatsApp
export function whatsappRedirectLink(leadId, telefono, mensaje) {
  const waUrl = whatsappLink(telefono, mensaje)
  if (!waUrl) return null
  const BASE = process.env.NEXTAUTH_URL || 'https://app.control-finanzas.com'
  return `${BASE}/api/telegram/wa-redirect?lead=${leadId}&wa=${encodeURIComponent(waUrl)}`
}

// ---------------------------------------------------------------------------
// Inline keyboard builders
// ---------------------------------------------------------------------------

export function buildLeadKeyboard(leadId, waLink) {
  const keyboard = []

  // Fila 1: WhatsApp + Respuestas
  const row1 = []
  if (waLink) {
    row1.push({ text: '📱 WhatsApp', url: waLink })
  }
  row1.push({ text: '💬 Respuestas', callback_data: `respuestas:${leadId}` })
  keyboard.push(row1)

  // Fila 2: Precio + Contactado + Descartar
  keyboard.push([
    { text: '💰 Precio', callback_data: `precio:${leadId}` },
    { text: '✅ Contactado', callback_data: `contactado:${leadId}` },
    { text: '❌ Descartar', callback_data: `descartado:${leadId}` },
  ])

  return { inline_keyboard: keyboard }
}

export function buildRespuestasKeyboard(leadId) {
  return {
    inline_keyboard: [
      [{ text: '── Según lo que dijo ──', callback_data: `noop:${leadId}` }],
      [
        { text: '🔄 Cómo funciona', callback_data: `resp_como:${leadId}` },
        { text: '💰 Precios', callback_data: `resp_precio:${leadId}` },
      ],
      [
        { text: '👤 Cobra solo', callback_data: `resp_solo:${leadId}` },
        { text: '👥 Tiene cobradores', callback_data: `resp_cobr:${leadId}` },
      ],
      [
        { text: '📓 Cuaderno/diario', callback_data: `resp_cuaderno:${leadId}` },
        { text: '📊 Excel', callback_data: `resp_excel:${leadId}` },
      ],
      [
        { text: '📱 WhatsApp/notas', callback_data: `resp_wa:${leadId}` },
        { text: '📲 Otra app', callback_data: `resp_otraapp:${leadId}` },
      ],
      [
        { text: '📅 Préstamos grandes', callback_data: `resp_grande:${leadId}` },
        { text: '🔀 Otro método', callback_data: `resp_otro:${leadId}` },
      ],
      [
        { text: '🌐 No es app', callback_data: `resp_web:${leadId}` },
        { text: '🔒 Seguridad', callback_data: `resp_seg:${leadId}` },
      ],
      [
        { text: '🔑 Permisos cobr.', callback_data: `resp_perm:${leadId}` },
        { text: '🎥 Video/demo', callback_data: `resp_video:${leadId}` },
      ],
      [
        { text: '💲 Sin cobros extra', callback_data: `resp_cobro:${leadId}` },
      ],
      [{ text: '── Objeciones ──', callback_data: `noop:${leadId}` }],
      [
        { text: '😬 Está caro', callback_data: `resp_caro:${leadId}` },
        { text: '🤔 Déjame pensarlo', callback_data: `resp_pensar:${leadId}` },
        { text: '📱 Ya usa algo', callback_data: `resp_yausa:${leadId}` },
      ],
      [{ text: '── Onboarding ──', callback_data: `noop:${leadId}` }],
      [
        { text: '✅ Ya se registró', callback_data: `resp_reg:${leadId}` },
        { text: '📋 Post-registro', callback_data: `resp_post:${leadId}` },
      ],
      [
        { text: '📨 24h sin usar', callback_data: `resp_onb24:${leadId}` },
        { text: '📨 3d sin usar', callback_data: `resp_onb3d:${leadId}` },
        { text: '⏳ Día 10', callback_data: `resp_onb10:${leadId}` },
      ],
      [{ text: '── Seguimiento (5 toques) ──', callback_data: `noop:${leadId}` }],
      [
        { text: '🔔 T2 social', callback_data: `resp_t2ps:${leadId}` },
        { text: '🔔 T2 dolor', callback_data: `resp_t2dolor:${leadId}` },
      ],
      [
        { text: '💡 T3 beneficio', callback_data: `resp_t3:${leadId}` },
        { text: '🔗 T4 link', callback_data: `resp_t4:${leadId}` },
        { text: '👋 T5 cierre', callback_data: `resp_t5:${leadId}` },
      ],
    ],
  }
}

function buildFollowupKeyboard(leadId, waLink) {
  const keyboard = []
  if (waLink) {
    keyboard.push([{ text: '📱 Contactar por WhatsApp', url: waLink }])
  }
  // Respuestas rápidas para seguimiento
  keyboard.push([{ text: '💬 Respuestas', callback_data: `respuestas:${leadId}` }])
  keyboard.push([
    { text: '💰 Precio', callback_data: `precio:${leadId}` },
    { text: '✅ Contactado', callback_data: `contactado:${leadId}` },
    { text: '❌ Descartar', callback_data: `descartado:${leadId}` },
  ])
  return { inline_keyboard: keyboard }
}

// ---------------------------------------------------------------------------
// Precio message (uses real PLANES from mercadopago.js)
// ---------------------------------------------------------------------------

export function buildPrecioMessage() {
  const b = PLANES.basic
  const g = PLANES.growth
  const s = PLANES.standard
  const p = PLANES.professional

  return [
    `💰 <b>Planes Control Finanzas</b>`,
    ``,
    `📌 <b>${b.nombre}</b> — $${b.precio.toLocaleString('es-CO')}/mes`,
    `   ${b.maxUsuarios} usuario, hasta ${b.maxClientes} clientes, ${b.maxRutas} ruta`,
    ``,
    `📌 <b>${g.nombre}</b> — $${g.precio.toLocaleString('es-CO')}/mes (el mas popular)`,
    `   ${g.maxUsuarios} usuarios, hasta ${g.maxClientes.toLocaleString('es-CO')} clientes, ${g.maxRutas} rutas`,
    ``,
    `📌 <b>${s.nombre}</b> — $${s.precio.toLocaleString('es-CO')}/mes`,
    `   ${s.maxUsuarios} usuarios, hasta ${s.maxClientes.toLocaleString('es-CO')} clientes, ${s.maxRutas} rutas`,
    ``,
    `📌 <b>${p.nombre}</b> — $${p.precio.toLocaleString('es-CO')}/mes`,
    `   ${p.maxUsuarios} usuarios, hasta ${p.maxClientes.toLocaleString('es-CO')} clientes, ${p.maxRutas} rutas`,
    ``,
    `Todos incluyen <b>14 dias gratis</b> sin pedir tarjeta.`,
    ``,
    `📋 Copiar para WhatsApp (version corta):`,
    ``,
    `<pre>El plan basico sale en $${b.precio.toLocaleString('es-CO')} al mes. Pero primero pruebalo 14 dias gratis sin meter tarjeta.\n\nSi en esos 14 dias no sientes que te sirve, no pagas nada. Asi de simple.\n\nQuieres que te mande el link para registrarte?</pre>`,
    ``,
    `📋 Copiar para WhatsApp (version completa):`,
    ``,
    `<pre>Claro, estos son los planes:\n\nBasico — $${b.precio.toLocaleString('es-CO')}/mes (1 usuario, ${b.maxClientes} clientes, 1 ruta)\n\nCrecimiento — $${g.precio.toLocaleString('es-CO')}/mes (${g.maxUsuarios} usuarios, ${g.maxClientes.toLocaleString('es-CO')} clientes, ${g.maxRutas} rutas)\n\nProfesional — $${s.precio.toLocaleString('es-CO')}/mes (${s.maxUsuarios} usuarios, ${s.maxClientes.toLocaleString('es-CO')} clientes, ${s.maxRutas} rutas)\n\nEmpresarial — $${p.precio.toLocaleString('es-CO')}/mes (${p.maxUsuarios} usuarios, ${p.maxClientes.toLocaleString('es-CO')} clientes, ${p.maxRutas} rutas)\n\nTodos incluyen 14 dias gratis sin tarjeta.\n\nCuantos clientes manejas mas o menos? Asi te digo cual te conviene.</pre>`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Lead notification (new lead arrived)
// ---------------------------------------------------------------------------

export async function sendLeadNotification({ nombre, telefono, cantClientes, esPrestamista, anuncioId, createdTime, leadgenId }, leadId) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('[Telegram] ❌ No se puede enviar notificación de lead — BOT_TOKEN:', !!BOT_TOKEN, 'CHAT_ID:', !!CHAT_ID)
    return null
  }

  const fecha = formatFecha(createdTime)
  const saludo = formatNombreSaludo(nombre)
  const mensaje = buildFirstMessage(nombre, cantClientes)
  const waLink = whatsappRedirectLink(leadId, telefono, mensaje)

  // Formatear respuesta de is_lender
  const prestamista = esPrestamista
    ? (esPrestamista.includes('si') ? '✅ Sí presta dinero' : `ℹ️ ${escapeHtml(esPrestamista)}`)
    : ''

  const lines = [
    `📢 <b>Nuevo Lead</b> - Facebook Ads`,
    ``,
    `👤 <b>${escapeHtml(nombre)}</b>`,
    `📱 ${escapeHtml(telefono) || 'Sin teléfono'}`,
    `👥 ${escapeHtml(cantClientes) || 'No especificó'} clientes`,
  ]
  if (prestamista) lines.push(prestamista)
  lines.push(
    `📅 ${fecha}`,
    ``,
    `💬 <b>Mensaje listo:</b>`,
    `<i>"${escapeHtml(mensaje.substring(0, 120))}..."</i>`,
    ``,
    `⚠️ NO asumas método (cuaderno/Excel)`,
    `⚠️ Si pregunta precio, usa botón 💰`,
    ``,
    `🖥 <a href="https://app.control-finanzas.com/admin/leads">Ver en panel</a>`,
  )
  const text = lines.join('\n')

  const keyboard = buildLeadKeyboard(leadId, waLink)
  const result = await sendMessage(text, keyboard)

  return result?.result?.message_id ?? null
}

// ---------------------------------------------------------------------------
// Follow-up reminders
// ---------------------------------------------------------------------------

export async function sendFollowupReminder(lead, tipo) {
  const saludo = formatNombreSaludo(lead.nombre)
  const horasTranscurridas = Math.round((Date.now() - new Date(lead.createdAt).getTime()) / 3600000)

  let emoji, titulo, detalle, msgTemplate, msgLabel
  switch (tipo) {
    case '2h': // >2h sin contactar — primer aviso
      emoji = '🚨'
      titulo = 'SIN CONTACTAR'
      detalle = `Lleva <b>${horasTranscurridas}h</b> sin contactar`
      msgLabel = 'Primer contacto'
      msgTemplate = buildFirstMessage(lead.nombre)
      break
    case '6h': // >6h sin contactar — segundo aviso
      emoji = '🚨🚨'
      titulo = 'URGENTE — SIN CONTACTAR'
      detalle = `Lleva <b>${horasTranscurridas}h</b> sin contactar`
      msgLabel = 'Primer contacto'
      msgTemplate = buildFirstMessage(lead.nombre)
      break
    case '24h': // Toque 2: prueba social
      emoji = '🔔'
      titulo = 'Seguimiento 24h'
      detalle = `Lleva <b>${horasTranscurridas}h</b> sin respuesta`
      msgLabel = 'Toque 2: prueba social'
      msgTemplate = `${saludo}, no sé si viste mi mensaje de ayer.\n\nSolo quería contarte que ya son más de 500 prestamistas en Colombia usando esto. La mayoría me dicen lo mismo: "por qué no lo conocí antes".\n\nSi quieres te muestro cómo funciona en 2 minutos. Si no te interesa, no hay problema, me dices y no te vuelvo a escribir.`
      break
    case '48h': // Toque 3: beneficio concreto
      emoji = '⏰'
      titulo = 'Seguimiento 48h'
      detalle = `Lleva <b>${horasTranscurridas}h</b> sin respuesta`
      msgLabel = 'Toque 3: beneficio concreto'
      msgTemplate = `${saludo}, se me quedó pendiente contarte.\n\nUn prestamista que usa el sistema me dijo que desde que lo tiene dejó de perder como $200.000 al mes en cobros que se le olvidaba anotar.\n\nLa app es gratis 14 días. Sin tarjeta, sin compromiso.\nQuieres que te mande el link?`
      break
    case '7d': // registrado hace 7d — check-in único
      emoji = '📋'
      titulo = 'Check-in registro'
      detalle = `Se registró hace <b>${Math.round(horasTranscurridas / 24)} días</b>`
      msgLabel = 'Check-in'
      msgTemplate = `${saludo}, cómo te ha ido con el sistema? Te ha servido?\n\nSi quieres seguir usándolo después del día 14, el plan básico son $${PLANES.basic.precio.toLocaleString('es-CO')}/mes y te incluye todo lo que ya estás usando.\n\nMe dices si tienes alguna pregunta.`
      break
    default:
      return null
  }

  const waLink = whatsappRedirectLink(lead.id, lead.telefono, msgTemplate)
  const keyboard = buildFollowupKeyboard(lead.id, waLink)

  const text = [
    `${emoji} <b>${titulo}</b> — ${escapeHtml(saludo)}`,
    ``,
    `👤 ${escapeHtml(lead.nombre)}`,
    `📱 ${escapeHtml(lead.telefono) || 'Sin tel'}`,
    `👥 ${escapeHtml(lead.cantClientes) || '?'} clientes`,
    ``,
    detalle,
    ``,
    `📋 <b>${msgLabel}</b> — copiar para WhatsApp:`,
    ``,
    `<pre>${escapeHtml(msgTemplate)}</pre>`,
  ].join('\n')

  return sendMessage(text, keyboard, 'notif')
}
