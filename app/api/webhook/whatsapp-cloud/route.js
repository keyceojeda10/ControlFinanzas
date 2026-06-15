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
import { notificarEstadoLead } from '@/lib/bot/notificar-meta'
import { enviarGuia } from '@/lib/bot/guias-sender'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN
const APP_SECRET = process.env.WHATSAPP_APP_SECRET

// Banner para acompanar el link de registro (el preview automatico de la Cloud
// API sale cuadrado; mandamos la imagen aparte para que se vea el banner grande).
const BANNER_URL = (process.env.GUIAS_BASE_URL || 'https://app.control-finanzas.com') + '/og.png'

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
      const contacts = value.contacts || []
      const profileName = contacts[0]?.profile?.name || ''
      for (const msg of mensajes) {
        msg.profile_name = profileName
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
      // Acks de entrega/lectura/fallo de mensajes salientes del bot.
      const statuses = value.statuses || []
      for (const status of statuses) {
        await procesarStatus(status).catch(e =>
          console.error('[WA Cloud Webhook] Error en status:', e.message)
        )
      }
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

// Procesa un ack de estado de un mensaje saliente del bot/admin:
// status.status -> "sent" | "delivered" | "read" | "failed"
// status.id     -> wamid del mensaje (lo guardamos al enviar, ver wamidDe()).
// Solo nos interesa "guardar lo peor/mas reciente conocido"; Meta puede
// reenviar sent->delivered->read en eventos separados.
const ESTADO_MAP = { sent: 'enviado', delivered: 'entregado', read: 'leido', failed: 'fallido' }

async function procesarStatus(status) {
  const wamid = status.id || null
  const estado = ESTADO_MAP[status.status] || status.status
  if (!wamid || !estado) return

  const errores = status.errors || []
  const errorEntrega = errores.length
    ? errores.map(e => `${e.code}: ${e.title || e.message || ''}`).join('; ')
    : null

  const data = { estadoEntrega: estado, estadoEntregaEn: new Date() }
  if (errorEntrega) data.errorEntrega = errorEntrega

  const res = await prisma.botConversacion.updateMany({
    where: { wamid },
    data,
  })

  if (res.count === 0) {
    console.log(`[WA Cloud] Status '${estado}' para wamid desconocido: ${wamid}`)
  } else if (estado === 'fallido') {
    console.error(`[WA Cloud] Mensaje fallido (wamid ${wamid}): ${errorEntrega}`)
  }
}

async function procesarMensaje(msg) {
  const messageId = msg.id || null
  const fromRaw = msg.from || '' // E.164 plano en Cloud API
  const tipo = (msg.type || 'text').toLowerCase()

  if (!TIPOS_SOPORTADOS.has(tipo)) return

  await _procesarMensajeInternal(msg, fromRaw, tipo, messageId)
}

// Resuelve (o crea) el BotLead para este numero de forma atomica. El
// constraint @@unique([telefono]) en BotLead es quien arbitra la concurrencia
// entre workers del cluster PM2 (Meta puede reentregar el mismo evento y un
// segundo worker llegaria aqui con `lead === null` tambien). Si el create()
// choca, recuperamos el registro que gano la carrera.
async function resolverOCrearLead(telefono, fromRaw, msg) {
  const existente = await buscarLeadPorTelefono(telefono || fromRaw)
  if (existente) return existente

  const referral = msg.referral || null
  const nombrePerfil = msg.profile_name || msg.from_name || ''
  const desdeAnuncio = Boolean(referral)
  try {
    const lead = await prisma.botLead.create({
      data: {
        nombre: nombrePerfil || 'Lead WhatsApp',
        telefono: telefono || fromRaw,
        anuncioId: desdeAnuncio ? (referral.source_id || '') : undefined,
        estado: 'interesado',
        temperatura: desdeAnuncio ? 50 : 40,
        fechaContacto: new Date(),
      },
    })
    console.log(`[WA Cloud] Lead nuevo${desdeAnuncio ? ' (CTWA ad: ' + (referral.source_id || 'unknown') + ')' : ' (directo)'}: ${fromRaw} (${telefono})`)
    return lead
  } catch (e) {
    if (e.code === 'P2002') {
      return prisma.botLead.findUnique({ where: { telefono: telefono || fromRaw } })
    }
    throw e
  }
}

async function _procesarMensajeInternal(msg, fromRaw, tipo, messageId) {
  const telefono = await wa.resolverTelefono(fromRaw)
  const lead = await resolverOCrearLead(telefono, fromRaw, msg)
  if (!lead) return

  const botApagado = !lead.botActivo || lead.estado === 'cerrado'

  await _responderAlLead(msg, lead, tipo, messageId, botApagado)
}

// Inserta el mensaje entrante de forma atomica. El constraint @unique en
// BotConversacion.messageId es el "claim" real: solo el primer worker que
// logre el create() continua y responde; si otro worker recibe el mismo
// evento reentregado por Meta, su create() choca con P2002 y sale en silencio
// (evita el "doble saludo" — los locks en memoria no sirven en cluster mode).
async function guardarEntranteAtomico(data) {
  try {
    await prisma.botConversacion.create({ data })
    return true
  } catch (e) {
    if (e.code === 'P2002') return false
    throw e
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
      await guardarEntranteAtomico({ botLeadId: lead.id, rol: 'lead', texto: '[nota de voz]', tipoMensaje: 'audio', messageId, ...media })
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
      await guardarEntranteAtomico({ botLeadId: lead.id, rol: 'lead', texto: texto || '[imagen no legible]', tipoMensaje: 'image', messageId, ...media })
      return
    }
  }

  // Guardar mensaje entrante. Si otro worker ya lo reclamo (mismo messageId
  // reentregado por Meta), salimos en silencio: ese worker ya respondio.
  const reclamado = await guardarEntranteAtomico({ botLeadId: lead.id, rol: 'lead', texto, tipoMensaje, messageId, ...media })
  if (!reclamado) return

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

  // Debounce: esperar 3s para agrupar mensajes rapidos del lead.
  // Si llegan mas mensajes en ese lapso, este handler se descarta y
  // el handler del ultimo mensaje responde con todo el historial.
  const DEBOUNCE_MS = 3000
  await new Promise(r => setTimeout(r, DEBOUNCE_MS))

  const mensajesRecientes = await prisma.botConversacion.findMany({
    where: {
      botLeadId: lead.id,
      rol: 'lead',
      createdAt: { gte: new Date(Date.now() - DEBOUNCE_MS - 500) },
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  })
  if (mensajesRecientes.length > 0 && mensajesRecientes[0].messageId !== messageId) {
    console.log(`[WA Cloud] Debounce: ${lead.nombre} envio otro mensaje, este handler se descarta.`)
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
      // Si el mensaje incluye el link de registro, el preview automatico de la
      // Cloud API sale cuadrado/pequeno (Meta no respeta el banner grande en
      // mensajes salientes de API). Para que se vea bien, mandamos el banner
      // og.png como imagen ANTES del texto. Solo una vez por mensaje.
      const mandaLinkRegistro = /app\.control-finanzas\.com\/registro/i.test(decision.mensaje)
      if (mandaLinkRegistro) {
        try {
          await wa.sendImageLink(lead.telefono, BANNER_URL, 'Control Finanzas — Gestiona tu cartera de préstamos')
        } catch (e) {
          console.error(`[WA Cloud] No se pudo enviar el banner de registro:`, e.message)
        }
      }
      // Si ya mandamos el banner, apagamos el preview del texto para no duplicar
      // la imagen (saldria el banner + la tarjeta cuadrada del preview).
      const envio = await wa.sendText(lead.telefono, decision.mensaje, !mandaLinkRegistro)
      await prisma.botConversacion.create({
        data: { botLeadId: lead.id, rol: 'bot', texto: decision.mensaje, wamid: wa.wamidDe(envio) },
      })
      console.log(`[WA Cloud] -> ${lead.nombre}: ${decision.mensaje.slice(0, 70)}`)
    } catch (e) {
      console.error(`[WA Cloud] Error enviando a ${lead.nombre}:`, e.message)
    }
  }

  // Guia visual: el agente decidio enviar capturas (el usuario ya las acepto).
  // Se mandan despues del texto, como imagenes con caption "Paso N de M".
  if (decision.enviarGuia) {
    try {
      const res = await enviarGuia(lead.telefono, decision.enviarGuia)
      if (res.ok) {
        await prisma.botConversacion.create({
          data: { botLeadId: lead.id, rol: 'bot', texto: `[Guia enviada: ${res.slug} — ${res.enviadas}/${res.total} imagenes]`, tipoMensaje: 'image' },
        }).catch(() => {})
        console.log(`[WA Cloud] -> ${lead.nombre}: guia ${res.slug} (${res.enviadas}/${res.total})`)
      } else {
        console.error(`[WA Cloud] Guia no enviada a ${lead.nombre}: ${res.error}`)
      }
    } catch (e) {
      console.error(`[WA Cloud] Error enviando guia a ${lead.nombre}:`, e.message)
    }
  }

  // Actualizar estado
  if (decision.escalar) {
    if (lead.estado !== 'cerrado') {
      await prisma.botLead.update({
        where: { id: lead.id },
        data: { estado: 'interesado', proximoSeguimiento: null },
      })
      if (lead.estado !== 'interesado') notificarEstadoLead(lead.id, 'qualified').catch(() => {})
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
      notificarEstadoLead(lead.id, 'qualified').catch(() => {})
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
