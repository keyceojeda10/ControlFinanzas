import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import * as openwa from '@/lib/bot/openwa-client'
import { transcribirAudio } from '@/lib/bot/transcribe'
import { responder } from '@/lib/bot/sales-agent'
import { alertarLeadCaliente } from '@/lib/bot/alertas'

const WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET
const WHATSAPP_PERSONAL = process.env.BOT_WHATSAPP_PERSONAL

const TIPOS_SOPORTADOS = new Set(['chat', 'text', 'audio', 'ptt', 'image'])

// Lock para evitar procesamiento concurrente del mismo mensaje o lead
const processingMessages = new Set()
const processingLeads = new Set()
const EVENTOS_IGNORADOS = new Set([
  'e2e_notification', 'notification_template', 'notification',
  'gp2', 'broadcast_notification', 'protocol', 'ciphertext',
  'revoked', 'call_log', 'group_notification',
])

function firmaValida(rawBody, firma) {
  if (!WEBHOOK_SECRET) return true
  if (!firma) return true
  const esperada = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')
  try {
    return crypto.timingSafeEqual(
      Buffer.from(firma.replace(/^sha256=/, '')),
      Buffer.from(esperada)
    )
  } catch {
    return false
  }
}

export async function POST(request) {
  const rawBody = await request.text()
  const firma = request.headers.get('x-signature') || request.headers.get('x-hub-signature-256') || ''

  if (!firmaValida(rawBody, firma)) {
    return NextResponse.json({ error: 'Firma invalida.' }, { status: 401 })
  }

  // Responder rapido, procesar async
  const body = JSON.parse(rawBody)
  procesarMensaje(body).catch(e => {
    console.error('[Bot Webhook] Error procesando:', e.message)
  })

  return NextResponse.json({ success: true })
}

async function procesarMensaje(body) {
  const msg = body.data || body.message || body
  const fromRaw = msg.from || msg.chatId || msg.author || ''
  const tipo = (msg.type || 'chat').toLowerCase()
  const messageId = msg.id || msg.messageId || null

  if (msg.fromMe === true) return
  if (msg.isGroup === true) return
  if (EVENTOS_IGNORADOS.has(tipo)) return

  // Lock por messageId: si ya se está procesando este mensaje, ignorar
  if (messageId && processingMessages.has(messageId)) {
    console.log('[Bot Webhook] Mensaje ya en proceso, ignorando:', messageId)
    return
  }
  if (messageId) processingMessages.add(messageId)

  try {
    await _procesarMensajeInternal(msg, fromRaw, tipo, messageId)
  } finally {
    if (messageId) setTimeout(() => processingMessages.delete(messageId), 30000)
  }
}

async function _procesarMensajeInternal(msg, fromRaw, tipo, messageId) {
  const texto_raw = msg.body || msg.text || ''
  const telefono = await openwa.resolverTelefono(fromRaw)

  // Comando del usuario personal (TOMAR/SOLTAR)
  if (esNumeroDelUsuario(telefono)) {
    await procesarComandoUsuario(msg.body || msg.text || '')
    return
  }

  // Buscar lead por telefono (ultimos 10 digitos)
  const lead = await buscarLeadPorTelefono(telefono || fromRaw)
  if (!lead) {
    console.log(`[Bot Webhook] Mensaje de ${fromRaw} (${telefono}) — no es lead conocido.`)
    return
  }

  // Dedup por messageId
  if (messageId) {
    const existe = await prisma.botConversacion.findFirst({
      where: { messageId, rol: 'lead' },
    })
    if (existe) return
  }

  const botApagado = !lead.botActivo || lead.estado === 'cerrado'

  // Lock por lead: evitar que dos mensajes del mismo lead se procesen a la vez
  if (processingLeads.has(lead.id)) {
    console.log('[Bot Webhook] Lead ya en proceso, esperando:', lead.nombre)
    // Esperar hasta 15s a que termine el otro
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500))
      if (!processingLeads.has(lead.id)) break
    }
  }
  processingLeads.add(lead.id)

  try {
    await _responderAlLead(msg, lead, tipo, messageId, botApagado)
  } finally {
    processingLeads.delete(lead.id)
  }
}

async function _responderAlLead(msg, lead, tipo, messageId, botApagado) {
  // Resolver contenido segun tipo
  let texto = msg.body || msg.text || ''
  let tipoMensaje = 'chat'
  let imagenBase64 = null
  let imagenMime = null

  if (tipo === 'audio' || tipo === 'ptt') {
    tipoMensaje = 'audio'
    const media = msg.media || {}
    const trans = await transcribirAudio(media.data, media.mimetype)
    if (trans.costoUsd > 0) {
      await prisma.botGastoApi.create({
        data: { proveedor: 'groq', modelo: 'whisper-large-v3-turbo', costoUsd: trans.costoUsd },
      }).catch(() => {})
    }
    if (!trans.texto) {
      await prisma.botConversacion.create({
        data: { botLeadId: lead.id, rol: 'lead', texto: '[nota de voz no transcrita]', tipoMensaje: 'audio', messageId },
      })
      return
    }
    texto = trans.texto
  } else if (tipo === 'image') {
    tipoMensaje = 'image'
    const media = msg.media || {}
    imagenBase64 = media.data || null
    imagenMime = media.mimetype || 'image/jpeg'
    if (!imagenBase64) {
      await prisma.botConversacion.create({
        data: { botLeadId: lead.id, rol: 'lead', texto: '[imagen no legible]', tipoMensaje: 'image', messageId },
      })
      return
    }
  } else if (!TIPOS_SOPORTADOS.has(tipo)) {
    await prisma.botConversacion.create({
      data: { botLeadId: lead.id, rol: 'lead', texto: texto || `[${tipo}]`, tipoMensaje: tipo, messageId },
    })
    return
  }

  // Guardar mensaje entrante
  await prisma.botConversacion.create({
    data: { botLeadId: lead.id, rol: 'lead', texto, tipoMensaje, messageId },
  })

  if (botApagado) {
    console.log(`[Bot Webhook] Lead ${lead.nombre} con bot apagado — mensaje guardado.`)
    return
  }

  // Verificar que el bot global esta activo
  const config = await prisma.botConfig.findFirst()
  if (config && !config.botActivo) {
    console.log(`[Bot Webhook] Bot global apagado — mensaje guardado.`)
    return
  }

  // Claude genera respuesta
  const historial = await prisma.botConversacion.findMany({
    where: { botLeadId: lead.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  historial.reverse()

  let decision
  try {
    decision = await responder(lead, historial, { texto, tipoMensaje, imagenBase64, imagenMime })
  } catch (e) {
    console.error('[Bot Webhook] Error del agente Claude:', e.message)
    return
  }

  // Actualizar temperatura
  await prisma.botLead.update({
    where: { id: lead.id },
    data: { temperatura: decision.temperatura },
  })

  // Responder al lead
  if (decision.mensaje) {
    try {
      await openwa.sendText(lead.telefono, decision.mensaje)
      await prisma.botConversacion.create({
        data: { botLeadId: lead.id, rol: 'bot', texto: decision.mensaje },
      })
      console.log(`[Bot] -> ${lead.nombre}: ${decision.mensaje.slice(0, 70)}`)
    } catch (e) {
      console.error(`[Bot Webhook] Error enviando a ${lead.nombre}:`, e.message)
    }
  }

  // Actualizar estado
  if (decision.escalar) {
    if (lead.estado !== 'cerrado') {
      await prisma.botLead.update({
        where: { id: lead.id },
        data: { estado: 'interesado', proximoSeguimiento: null },
      })
    }
  } else {
    if (lead.estado === 'contactado' || lead.estado === 'pendiente') {
      const dias = 1 + Math.floor(Math.random() * 2)
      await prisma.botLead.update({
        where: { id: lead.id },
        data: {
          estado: 'interesado',
          proximoSeguimiento: new Date(Date.now() + dias * 24 * 3600000),
        },
      })
    }
  }

  // Alertar si hay que escalar
  if (decision.escalar && !lead.alertado) {
    await alertarLeadCaliente(lead, decision.motivo, historial)
    await prisma.botLead.update({
      where: { id: lead.id },
      data: { alertado: true },
    })
  }
}

async function buscarLeadPorTelefono(phone) {
  const digitos = (phone || '').replace(/\D/g, '')
  if (!digitos) return null
  const ultimos10 = digitos.slice(-10)

  // Busqueda exacta primero
  let lead = await prisma.botLead.findFirst({
    where: { telefono: digitos, estado: { not: 'bloqueado' } },
  })
  if (lead) return lead

  // Busqueda por ultimos 10 digitos
  lead = await prisma.botLead.findFirst({
    where: {
      telefono: { endsWith: ultimos10 },
      estado: { not: 'bloqueado' },
    },
    orderBy: { createdAt: 'desc' },
  })
  return lead
}

function esNumeroDelUsuario(telefono) {
  if (!WHATSAPP_PERSONAL || !telefono) return false
  const a = telefono.replace(/\D/g, '').slice(-10)
  const b = WHATSAPP_PERSONAL.replace(/\D/g, '').slice(-10)
  return a && a === b
}

async function procesarComandoUsuario(texto) {
  const cmd = (texto || '').trim().toUpperCase()
  if (cmd === 'TOMAR') {
    const lead = await prisma.botLead.findFirst({
      where: { alertado: true, botActivo: true, estado: { not: 'cerrado' } },
      orderBy: { updatedAt: 'desc' },
    })
    if (lead) {
      await prisma.botLead.update({ where: { id: lead.id }, data: { botActivo: false } })
      await openwa.sendText(WHATSAPP_PERSONAL,
        `Listo. Bot apagado para ${lead.nombre}. Escribe SOLTAR para reactivar.`)
    } else {
      await openwa.sendText(WHATSAPP_PERSONAL, 'No hay leads pendientes.')
    }
  } else if (cmd === 'SOLTAR') {
    const lead = await prisma.botLead.findFirst({
      where: { alertado: true, botActivo: false, estado: { not: 'cerrado' } },
      orderBy: { updatedAt: 'desc' },
    })
    if (lead) {
      await prisma.botLead.update({ where: { id: lead.id }, data: { botActivo: true } })
      await openwa.sendText(WHATSAPP_PERSONAL, `Bot reactivado para ${lead.nombre}.`)
    } else {
      await openwa.sendText(WHATSAPP_PERSONAL, 'No hay leads para reactivar.')
    }
  }
}
