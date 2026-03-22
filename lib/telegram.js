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

  // El lead llenó un formulario — sabe por qué lo contactamos.
  // NO usar emojis de saludo, NO sonar como bot, NO "vi que te interesó".
  // Hablar en tercera persona, generar identificación, obtener UNA respuesta.
  return [
    `Hola ${saludo}, soy Carlos de Control Finanzas.`,
    ``,
    `Vi que llenaste el formulario para conocer el sistema, qué bueno que te interesó.`,
    ``,
    `Trabajamos con prestamistas que estaban cansados de perder plata por errores en el cuaderno o porque el cobrador les reportaba mal. Les hicimos un sistema web donde controlan todo desde el celular, sin descargar nada.`,
    ``,
    `Si quieres te cuento cómo funciona, o si tienes alguna duda específica me dices.`,
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
      [{ text: '🔄 Cómo funciona', callback_data: `resp_como:${leadId}` }],
      [
        { text: '📓 Cuaderno', callback_data: `resp_cuaderno:${leadId}` },
        { text: '📊 Excel', callback_data: `resp_excel:${leadId}` },
      ],
      [
        { text: '📱 WhatsApp/notas', callback_data: `resp_wa:${leadId}` },
        { text: '📲 Otra app', callback_data: `resp_otraapp:${leadId}` },
      ],
      [
        { text: '👤 Cobra solo', callback_data: `resp_solo:${leadId}` },
        { text: '👥 Tiene cobradores', callback_data: `resp_cobr:${leadId}` },
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
        { text: '✅ Ya se registró', callback_data: `resp_reg:${leadId}` },
      ],
      [
        { text: '🔀 Otro método', callback_data: `resp_otro:${leadId}` },
        { text: '📋 Post-registro', callback_data: `resp_post:${leadId}` },
      ],
      [{ text: '── Seguimiento (sin respuesta) ──', callback_data: `noop:${leadId}` }],
      [
        { text: '⏰ 2 horas', callback_data: `resp_seg2h:${leadId}` },
        { text: '🔔 24 horas', callback_data: `resp_seg24h:${leadId}` },
        { text: '👋 48h último', callback_data: `resp_seg48h:${leadId}` },
      ],
    ],
  }
}

function buildFollowupKeyboard(leadId, waLink) {
  const keyboard = []
  if (waLink) {
    keyboard.push([{ text: '📱 Contactar por WhatsApp', url: waLink }])
  }
  keyboard.push([
    { text: '✅ Ya lo contacté', callback_data: `contactado:${leadId}` },
    { text: '❌ Descartar', callback_data: `descartado:${leadId}` },
  ])
  return { inline_keyboard: keyboard }
}

// ---------------------------------------------------------------------------
// Precio message (uses real PLANES from mercadopago.js)
// ---------------------------------------------------------------------------

export function buildPrecioMessage() {
  const b = PLANES.basic
  const s = PLANES.standard
  const p = PLANES.professional

  return [
    `💰 <b>Planes Control Finanzas</b>`,
    ``,
    `📌 <b>${b.nombre}</b> — $${b.precio.toLocaleString('es-CO')}/mes`,
    `   ${b.maxUsuarios} usuario, hasta ${b.maxClientes} clientes`,
    ``,
    `📌 <b>${s.nombre}</b> — $${s.precio.toLocaleString('es-CO')}/mes (el más popular)`,
    `   ${s.maxUsuarios} usuarios, hasta ${s.maxClientes} clientes, rutas y cobradores`,
    ``,
    `📌 <b>${p.nombre}</b> — $${p.precio.toLocaleString('es-CO')}/mes`,
    `   ${p.maxUsuarios} usuarios, clientes ilimitados`,
    ``,
    `Todos incluyen <b>14 días gratis</b> sin pedir tarjeta.`,
    ``,
    `📋 Copiar para WhatsApp:`,
    `<code>¡Claro! Estos son los planes:\n\nBásico — $${b.precio.toLocaleString('es-CO')}/mes (1 usuario, hasta ${b.maxClientes} clientes)\n\nProfesional — $${s.precio.toLocaleString('es-CO')}/mes (${s.maxUsuarios} usuarios, ${s.maxClientes} clientes, cobradores)\n\nEmpresarial — $${p.precio.toLocaleString('es-CO')}/mes (${p.maxUsuarios} usuarios, ilimitado)\n\nTodos incluyen 14 días gratis sin tarjeta.\n\n¿Cuántos clientes manejas? Así te digo cuál te conviene.</code>`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Lead notification (new lead arrived)
// ---------------------------------------------------------------------------

export async function sendLeadNotification({ nombre, telefono, cantClientes, anuncioId, createdTime, leadgenId }, leadId) {
  if (!BOT_TOKEN || !CHAT_ID) return null

  const fecha = formatFecha(createdTime)
  const saludo = formatNombreSaludo(nombre)
  const mensaje = buildFirstMessage(nombre, cantClientes)
  const waLink = whatsappRedirectLink(leadId, telefono, mensaje)

  const text = [
    `📢 <b>Nuevo Lead</b> - Facebook Ads`,
    ``,
    `👤 <b>${nombre}</b>`,
    `📱 ${telefono || 'Sin teléfono'}`,
    `👥 ${cantClientes || 'No especificó'} clientes`,
    `📅 ${fecha}`,
    ``,
    `💬 <b>Mensaje listo:</b>`,
    `<i>"${mensaje.substring(0, 120)}..."</i>`,
    ``,
    `⚠️ NO asumas método (cuaderno/Excel)`,
    `⚠️ Si pregunta precio, usa botón 💰`,
    ``,
    `🖥 <a href="https://app.control-finanzas.com/admin/leads">Ver en panel</a>`,
  ].join('\n')

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
    case '24h': // >24h sin contactar o sin respuesta
      emoji = '🔔'
      titulo = 'Seguimiento 24h'
      detalle = `Lleva <b>${horasTranscurridas}h</b> sin respuesta`
      msgLabel = 'Seguimiento 24h'
      msgTemplate = `Hola ${saludo}, ¿quieres que te muestre cómo funciona el sistema con una videollamada rápida de 5 minutos?\n\nSi prefieres probarlo tú mismo: https://app.control-finanzas.com/registro\n14 días gratis, sin tarjeta.`
      break
    case '48h': // >48h último intento
      emoji = '⏰'
      titulo = 'Último intento'
      detalle = `Lleva <b>${horasTranscurridas}h</b> sin respuesta — último mensaje`
      msgLabel = 'Despedida'
      msgTemplate = `${saludo}, no quiero ser intenso. Si en algún momento necesitas organizar tus préstamos y cobros, aquí tienes tu prueba gratis:\n\nhttps://app.control-finanzas.com/registro\n\nÉxitos con tu negocio.`
      break
    case '7d': // registrado hace 7d — check-in único
      emoji = '📋'
      titulo = 'Check-in registro'
      detalle = `Se registró hace <b>${Math.round(horasTranscurridas / 24)} días</b>`
      msgLabel = 'Check-in'
      msgTemplate = `Hola ${saludo}, ¿cómo te ha ido con Control Finanzas? ¿Necesitas ayuda con algo?`
      break
    default:
      return null
  }

  const waLink = whatsappRedirectLink(lead.id, lead.telefono, msgTemplate)
  const keyboard = buildFollowupKeyboard(lead.id, waLink)

  const text = [
    `${emoji} <b>${titulo}</b> — ${saludo}`,
    ``,
    `👤 ${lead.nombre}`,
    `📱 ${lead.telefono || 'Sin tel'}`,
    `👥 ${lead.cantClientes || '?'} clientes`,
    ``,
    detalle,
    ``,
    `📋 <b>${msgLabel}</b> — copiar para WhatsApp:`,
    `<code>${msgTemplate}</code>`,
  ].join('\n')

  return sendMessage(text, keyboard, 'notif')
}
