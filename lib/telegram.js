// lib/telegram.js — Utilidades centralizadas de Telegram Bot
// Usado por: webhook leads, cron sync, cron followup, callback handler

import { PLANES } from '@/lib/mercadopago'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

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

async function telegramAPI(method, body) {
  if (!BOT_TOKEN) {
    console.warn('[Telegram] BOT_TOKEN no configurado')
    return null
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!data.ok) console.error(`[Telegram] ${method} error:`, data.description)
    return data
  } catch (err) {
    console.error(`[Telegram] ${method}:`, err.message)
    return null
  }
}

export async function sendMessage(text, replyMarkup) {
  const body = {
    chat_id: CHAT_ID,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }
  if (replyMarkup) body.reply_markup = replyMarkup
  return telegramAPI('sendMessage', body)
}

export async function editMessageReplyMarkup(messageId, replyMarkup) {
  return telegramAPI('editMessageReplyMarkup', {
    chat_id: CHAT_ID,
    message_id: messageId,
    reply_markup: replyMarkup,
  })
}

export async function editMessageText(messageId, text, replyMarkup) {
  const body = {
    chat_id: CHAT_ID,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }
  if (replyMarkup) body.reply_markup = replyMarkup
  return telegramAPI('editMessageText', body)
}

export async function answerCallback(callbackQueryId, text) {
  return telegramAPI('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  })
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
  const waLink = whatsappLink(telefono, mensaje)

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

  let emoji, titulo, detalle, msgTemplate
  switch (tipo) {
    case 'urgente': // >2h sin contactar
      emoji = '🚨'
      titulo = 'URGENTE'
      detalle = `Lleva <b>${horasTranscurridas}h</b> sin contactar`
      msgTemplate = buildFirstMessage(lead.nombre, lead.cantClientes)
      break
    case '24h': // >24h sin respuesta
      emoji = '🔔'
      titulo = 'Seguimiento 24h'
      detalle = `Lleva <b>${horasTranscurridas}h</b> sin respuesta. ¿Videollamada?`
      msgTemplate = `Hola ${saludo}, ¿quieres que te muestre cómo funciona el sistema con una videollamada rápida de 5 minutos?\n\nSi prefieres probarlo tú mismo: https://app.control-finanzas.com/registro\n14 días gratis, sin tarjeta.`
      break
    case '48h': // >48h último intento
      emoji = '⏰'
      titulo = 'Último intento'
      detalle = `Lleva <b>${horasTranscurridas}h</b> sin respuesta`
      msgTemplate = `${saludo}, no quiero ser intenso. Si en algún momento necesitas organizar tus préstamos y cobros, aquí tienes tu prueba gratis:\n\nhttps://app.control-finanzas.com/registro\n\nÉxitos con tu negocio.`
      break
    case '7d': // registrado hace 7d
      emoji = '📋'
      titulo = 'Check-in'
      detalle = `Se registró hace <b>${Math.round(horasTranscurridas / 24)} días</b>`
      msgTemplate = `Hola ${saludo}, ¿cómo te ha ido con Control Finanzas? ¿Necesitas ayuda con algo?`
      break
    default:
      return null
  }

  const waLink = whatsappLink(lead.telefono, msgTemplate)
  const keyboard = buildFollowupKeyboard(lead.id, waLink)

  const text = [
    `${emoji} <b>${titulo}</b> — ${saludo}`,
    ``,
    `👤 ${lead.nombre}`,
    `📱 ${lead.telefono || 'Sin tel'}`,
    `👥 ${lead.cantClientes || '?'} clientes`,
    ``,
    detalle,
  ].join('\n')

  return sendMessage(text, keyboard)
}
