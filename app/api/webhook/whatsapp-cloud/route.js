// app/api/webhook/whatsapp-cloud/route.js
// Webhook de la WhatsApp Cloud API oficial (Meta) para el bot COMERCIAL.
// Reemplaza a app/api/webhook/whatsapp-bot/route.js (que era para OpenWA).
//
// GET  -> handshake de verificacion de Meta (devuelve hub.challenge).
// POST -> mensajes entrantes en formato Meta. Reutiliza toda la logica del bot
//         (responder() de sales-agent, transcripcion, temperatura, escalado),
//         solo cambia el parseo de entrada y que la salida va por whatsapp-cloud.
//
// Las alertas al admin (lead caliente) van por Telegram (lib/bot/alertas), no
// por WhatsApp, porque el bot comercial es un numero distinto al personal.

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import * as wa from '@/lib/bot/whatsapp-cloud'
import { transcribirAudio } from '@/lib/bot/transcribe'
import { responder } from '@/lib/bot/sales-agent'
import { alertarLeadCaliente } from '@/lib/bot/alertas'
import { guardarMedia } from '@/lib/bot/media-store'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN
const APP_SECRET = process.env.WHATSAPP_APP_SECRET

// Lock para evitar procesamiento concurrente del mismo mensaje o lead
const processingMessages = new Set()
const processingLeads = new Set()

const TIPOS_SOPORTADOS = new Set(['text', 'audio', 'image'])

// --- GET: verificacion del webhook (Meta lo llama una vez al configurar) ---
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token && token === VERIFY_TOKEN) {
    return new NextResponse(challenge || '', { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// Valida la firma X-Hub-Signature-256 de Meta usando el App Secret.
function firmaValida(rawBody, firma) {
  if (!APP_SECRET) return true // si no hay secret configurado, no bloquear
  if (!firma) return false
  const esperada = 'sha256=' + crypto
    .createHmac('sha256', APP_SECRET)
    .update(rawBody)
    .digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))
  } catch {
    return false
  }
}

// --- POST: mensajes entrantes ---
export async function POST(request) {
  const rawBody = await request.text()
  const firma = request.headers.get('x-hub-signature-256') || ''

  if (!firmaValida(rawBody, firma)) {
    return NextResponse.json({ error: 'Firma invalida.' }, { status: 401 })
  }

  let body
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: true })
  }

  // Responder rapido a Meta y procesar async (Meta reintenta si tardamos)
  procesarEventos(body).catch(e => {
    console.error('[WA Cloud Webhook] Error procesando:', e.message)
  })

  return NextResponse.json({ ok: true })
}

// Recorre la estructura entry[].changes[].value.messages[] de Meta.
async function procesarEventos(body) {
  const entries = body.entry || []
  for (const entry of entries) {
    const changes = entry.changes || []
    for (const change of changes) {
      const value = change.value || {}
      const mensajes = value.messages || []
      for (const msg of mensajes) {
        await procesarMensaje(msg).catch(e =>
          console.error('[WA Cloud Webhook] Error en mensaje:', e.message)
        )
      }
      // Llamadas entrantes (Business Calling API): solo NOTIFICAR, no contestar.
      const llamadas = value.calls || []
      for (const call of llamadas) {
        await procesarLlamada(call).catch(e =>
          console.error('[WA Cloud Webhook] Error en llamada:', e.message)
        )
      }
      // value.statuses[] (acks de entrega/lectura): se ignoran por ahora.
    }
  }
}

// Registra una llamada entrante y notifica (sin contestar en el panel).
async function procesarLlamada(call) {
  const fromRaw = call.from || ''
  const telefono = await wa.resolverTelefono(fromRaw)
  const lead = await buscarLeadPorTelefono(telefono || fromRaw)
  const evento = (call.event || call.status || 'llamada').toLowerCase()
  // Solo nos interesa el inicio de la llamada
  if (evento && !['connect', 'ringing', 'offer', 'initiated', 'llamada'].includes(evento)) return

  if (lead) {
    await prisma.botConversacion.create({
      data: { botLeadId: lead.id, rol: 'lead', texto: '[Llamada entrante de WhatsApp]', tipoMensaje: 'call' },
    }).catch(() => {})
    await alertarLeadCaliente(lead, 'Llamada entrante de WhatsApp — el lead intento llamar.', []).catch(() => {})
  } else {
    console.log(`[WA Cloud] Llamada entrante de ${fromRaw} (no es lead conocido).`)
  }
}

async function procesarMensaje(msg) {
  const messageId = msg.id || null
  const fromRaw = msg.from || '' // E.164 plano en Cloud API
  const tipo = (msg.type || 'text').toLowerCase()

  if (!TIPOS_SOPORTADOS.has(tipo)) return

  // Lock por messageId
  if (messageId && processingMessages.has(messageId)) return
  if (messageId) processingMessages.add(messageId)

  try {
    await _procesarMensajeInternal(msg, fromRaw, tipo, messageId)
  } finally {
    if (messageId) setTimeout(() => processingMessages.delete(messageId), 30000)
  }
}

async function _procesarMensajeInternal(msg, fromRaw, tipo, messageId) {
  const telefono = await wa.resolverTelefono(fromRaw)

  const lead = await buscarLeadPorTelefono(telefono || fromRaw)
  if (!lead) {
    console.log(`[WA Cloud] Mensaje de ${fromRaw} (${telefono}) — no es lead conocido.`)
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

  // Lock por lead
  if (processingLeads.has(lead.id)) {
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
  let texto = ''
  let tipoMensaje = 'chat'
  let imagenBase64 = null
  let imagenMime = null
  // Campos de media a persistir (ruta en disco) para verlos luego en el panel.
  let media = { mediaPath: null, mediaTipo: null, mediaMime: null }

  if (tipo === 'text') {
    texto = msg.text?.body || ''
  } else if (tipo === 'audio') {
    tipoMensaje = 'audio'
    const dl = await wa.downloadMedia(msg.audio?.id)
    if (dl) {
      // Guardar el audio en disco para reproducirlo en el panel
      const saved = guardarMedia(dl.base64, dl.mimetype)
      if (saved) media = { mediaPath: saved.path, mediaTipo: saved.tipo, mediaMime: saved.mime }
    }
    const trans = dl ? await transcribirAudio(dl.base64, dl.mimetype) : { texto: '', costoUsd: 0 }
    if (trans.costoUsd > 0) {
      await prisma.botGastoApi.create({
        data: { proveedor: 'groq', modelo: 'whisper-large-v3-turbo', costoUsd: trans.costoUsd },
      }).catch(() => {})
    }
    if (!trans.texto) {
      await prisma.botConversacion.create({
        data: { botLeadId: lead.id, rol: 'lead', texto: '[nota de voz]', tipoMensaje: 'audio', messageId, ...media },
      })
      return
    }
    texto = trans.texto
  } else if (tipo === 'image') {
    tipoMensaje = 'image'
    const dl = await wa.downloadMedia(msg.image?.id)
    imagenBase64 = dl?.base64 || null
    imagenMime = dl?.mimetype || 'image/jpeg'
    if (dl) {
      const saved = guardarMedia(dl.base64, dl.mimetype)
      if (saved) media = { mediaPath: saved.path, mediaTipo: saved.tipo, mediaMime: saved.mime }
    }
    if (msg.image?.caption) texto = msg.image.caption
    if (!imagenBase64) {
      await prisma.botConversacion.create({
        data: { botLeadId: lead.id, rol: 'lead', texto: texto || '[imagen no legible]', tipoMensaje: 'image', messageId, ...media },
      })
      return
    }
  }

  // Guardar mensaje entrante
  await prisma.botConversacion.create({
    data: { botLeadId: lead.id, rol: 'lead', texto, tipoMensaje, messageId, ...media },
  })

  // Marcar leido (no critico)
  wa.markRead(messageId).catch(() => {})

  if (botApagado) {
    console.log(`[WA Cloud] Lead ${lead.nombre} con bot apagado — mensaje guardado.`)
    return
  }

  const config = await prisma.botConfig.findFirst()
  if (config && !config.botActivo) {
    console.log('[WA Cloud] Bot global apagado — mensaje guardado.')
    return
  }

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
    console.error('[WA Cloud] Error del agente:', e.message)
    return
  }

  await prisma.botLead.update({
    where: { id: lead.id },
    data: { temperatura: decision.temperatura },
  })

  if (decision.mensaje) {
    try {
      await wa.sendText(lead.telefono, decision.mensaje)
      await prisma.botConversacion.create({
        data: { botLeadId: lead.id, rol: 'bot', texto: decision.mensaje },
      })
      console.log(`[WA Cloud] -> ${lead.nombre}: ${decision.mensaje.slice(0, 70)}`)
    } catch (e) {
      console.error(`[WA Cloud] Error enviando a ${lead.nombre}:`, e.message)
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

  // Alertar si hay que escalar (via Telegram, ver lib/bot/alertas)
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

  let lead = await prisma.botLead.findFirst({
    where: { telefono: digitos, estado: { not: 'bloqueado' } },
  })
  if (lead) return lead

  lead = await prisma.botLead.findFirst({
    where: {
      telefono: { endsWith: ultimos10 },
      estado: { not: 'bloqueado' },
    },
    orderBy: { createdAt: 'desc' },
  })
  return lead
}
