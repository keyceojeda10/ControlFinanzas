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
import { responder } from '@/lib/bot-v2/agente'
import { alertarLeadCaliente } from '@/lib/bot/alertas'
import { esBotonDeCartera, respuestaDeBoton } from '@/lib/bot/cartera-post-registro'
import {
  esDeAnuncio, esBotonDelFlujo, respuestaDeBoton as respuestaDeAnuncio,
  saludoDeAnuncio, pareceAtascado, respuestaAtasco, datosDeConfianza,
} from '@/lib/bot/flujo-anuncio'
import { guardarMedia } from '@/lib/bot/media-store'
import { notificarEstadoLead } from '@/lib/bot/notificar-meta'
import { enviarGuia } from '@/lib/bot/guias-sender'
import { esMensajeAutomatico } from '@/lib/bot/filtros'
import { accionTrasThrottle, MAX_REBOTES_THROTTLE } from '@/lib/bot-v2/cadencia'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN
const APP_SECRET = process.env.WHATSAPP_APP_SECRET

// Banner para acompanar el link de registro (el preview automatico de la Cloud
// API sale cuadrado; mandamos la imagen aparte para que se vea el banner grande).
const BANNER_URL = (process.env.GUIAS_BASE_URL || 'https://app.control-finanzas.com') + '/og.png'

/* ⚠ `interactive` ES UN TIPO SOPORTADO, Y FALTABA.
 *
 * Aquí se descartan los tipos que el bot no sabe atender —ubicaciones,
 * contactos, stickers—, y `interactive` estaba fuera. O sea: se escribió la
 * rama que lee los botones, y el mensaje moría TRES FUNCIONES ANTES de
 * llegar a ella. Las pruebas de fuente pasaban porque el código existía.
 *
 * Se vio simulando un webhook de verdad contra el espejo: el botón devolvía
 * 200, no dejaba rastro en la conversación y no aparecía en ningún log. */
const TIPOS_SOPORTADOS = new Set(['text', 'audio', 'image', 'interactive'])

// Enfriamiento entre alertas de escalamiento del MISMO lead. Evita el extremo
// de una sola alerta de por vida (leads que insisten quedaban en silencio) y el
// extremo de spamear a soporte con cada mensaje.
const COOLDOWN_ALERTA_MS = 6 * 3600000

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
    await devolverIntentoSiThrottle(wamid, errorEntrega).catch(e =>
      console.error('[WA Cloud] Error devolviendo intento:', e.message)
    )
    await verificarTasaFallos(errorEntrega).catch(e =>
      console.error('[WA Cloud] Error verificando tasa fallos:', e.message)
    )
  }
}

// Meta acepta el envio con HTTP 200 y avisa del rechazo MINUTOS DESPUES por este
// webhook — cuando el sender ya incremento intentosSeguimiento. Resultado medido:
// un mensaje que Meta nunca entrego quemaba un intento como si hubiera llegado, y
const esCorteDeCuenta = (codigo) => Object.hasOwn(CODIGOS_CORTE, String(codigo))

/* Devuelve el intento sin tocar la cuenta de rebotes del lead ni cortarle los
   seguimientos: en cuanto la cuenta vuelva, ese lead sigue en la fila con los
   intentos que tenia. */
async function devolverIntentoPorCorte(wamid, codigo) {
  const conv = await prisma.botConversacion.findFirst({
    where: { wamid }, select: { botLeadId: true },
  })
  if (!conv?.botLeadId) return

  const lead = await prisma.botLead.findUnique({
    where: { id: conv.botLeadId },
    select: { id: true, nombre: true, intentosSeguimiento: true, estado: true },
  })
  if (!lead) return
  if (!['contactado', 'interesado'].includes(lead.estado)) return

  const intentos = Math.max(0, (lead.intentosSeguimiento || 0) - 1)
  await prisma.botLead.update({
    where: { id: lead.id },
    data: {
      intentosSeguimiento: intentos,
      // Media hora: lo justo para no machacar mientras dura el corte, y para
      // que en cuanto se arregle el pago la fila arranque sola.
      proximoSeguimiento: new Date(Date.now() + 30 * 60 * 1000),
    },
  })
  console.warn(`[WA Cloud] Corte ${codigo} en ${lead.nombre}: intento devuelto (${lead.intentosSeguimiento} -> ${intentos}), NO cuenta como rebote suyo`)
}

// 35 personas se quedaron sin recibir NADA (5 de ellas ya nos habian escrito).
// Si el fallo es por throttle/politica, se devuelve el intento y se reprograma.
async function devolverIntentoSiThrottle(wamid, errorEntrega) {
  const codigo = Number((String(errorEntrega || '').match(/^(\d+)/) || [])[1])

  /* ⚠ UN CORTE DE LA CUENTA NO ES CULPA DEL LEAD, Y NO PUEDE GASTARLE INTENTOS.
   *
   * Los codigos de CORTE —131042 facturacion, 131031 restringida, 368
   * bloqueada— no estaban aqui, asi que cada mensaje que rebotaba durante un
   * corte quemaba un intento como si hubiera llegado. Medido el 30 ago 2026, en
   * pleno corte por facturacion: el bot llevaba 16 horas mudo, 25 de 25
   * mensajes fallando, y cada media hora un lead perdia otro de sus tres
   * intentos contra un muro. Cuando el pago se arregle, esos leads ya no
   * tendrian a quien escribirles.
   *
   * Se devuelve el intento SIEMPRE y no se cuenta como rebote suyo: el numero
   * del lead esta perfecto, la que esta cortada es nuestra cuenta. */
  if (esCorteDeCuenta(codigo)) return devolverIntentoPorCorte(wamid, codigo)

  if (!CODIGOS_THROTTLE.has(codigo)) return

  const conv = await prisma.botConversacion.findFirst({
    where: { wamid },
    select: { botLeadId: true },
  })
  if (!conv?.botLeadId) return

  const lead = await prisma.botLead.findUnique({
    where: { id: conv.botLeadId },
    select: { id: true, nombre: true, intentosSeguimiento: true, estado: true },
  })
  if (!lead) return
  // Solo tiene sentido en leads todavia en juego.
  if (!['contactado', 'interesado'].includes(lead.estado)) return

  // Cuantas veces Meta ya rechazo un mensaje a ESTA persona por throttle. El
  // rebote de ahora ya esta guardado, asi que cuenta.
  const rebotes = await prisma.botConversacion.count({
    where: {
      botLeadId: lead.id,
      estadoEntrega: 'fallido',
      OR: [...CODIGOS_THROTTLE].map((c) => ({ errorEntrega: { startsWith: String(c) } })),
    },
  })

  if (accionTrasThrottle(rebotes, codigo) === 'dejar-de-insistir') {
    // Meta ya lo dijo dos veces: a esta persona no le llegan mensajes de
    // marketing. Se dejan de programar seguimientos PROACTIVOS, pero botActivo
    // queda true — si algun dia escribe, el bot le contesta normal (esa via es
    // respuesta dentro de la ventana de 24h, no plantilla, y no la limita Meta).
    await prisma.botLead.update({
      where: { id: lead.id },
      data: { proximoSeguimiento: null, botActivo: true },
    })
    console.warn(`[WA Cloud] Throttle ${codigo} en ${lead.nombre}: ${rebotes}º rebote, se deja de insistir (sigue atendido si escribe)`)
    return
  }

  const intentos = Math.max(0, (lead.intentosSeguimiento || 0) - 1)
  await prisma.botLead.update({
    where: { id: lead.id },
    data: {
      intentosSeguimiento: intentos,
      // Reintentar mañana, no de una: el throttle de Meta es por usuario y
      // reintentar en minutos lo vuelve a gatillar (y castiga la reputacion).
      proximoSeguimiento: new Date(Date.now() + 24 * 3600000),
    },
  })
  console.warn(`[WA Cloud] Throttle ${codigo} en ${lead.nombre}: intento devuelto (${lead.intentosSeguimiento} -> ${intentos}), reintento en 24h (rebote ${rebotes}/${MAX_REBOTES_THROTTLE})`)
}

/* ⚠ LA MARCA NO PUEDE VIVIR EN MEMORIA: HAY DOS INSTANCIAS.
 *
 * `pm2` corre `cf` con dos procesos, y cada uno tenía su propia variable. La
 * primera alerta la mandaba una instancia y ocho minutos después la otra
 * mandaba la MISMA, porque su reloj estaba a cero. Pasó el 29 de agosto de
 * 2026: dos avisos idénticos a las 7:11 y las 7:19.
 *
 * Es el mismo patrón que el `connection_limit`: lo que se cuenta por proceso se
 * MULTIPLICA por el número de instancias.
 *
 * Se guarda en disco, que las dos instancias comparten. Un fichero es
 * proporcional al problema —una tabla nueva para deduplicar avisos sería
 * pagar una migración por esto— y si algún día hay dos servidores, entonces sí
 * tocará la tabla. */
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const marcaDe = (nombre) => join(tmpdir(), `cf-alerta-${nombre}.txt`)

function ultimaVez(nombre) {
  try { return Number(readFileSync(marcaDe(nombre), 'utf8')) || 0 } catch { return 0 }
}
function apuntarVez(nombre) {
  try { writeFileSync(marcaDe(nombre), String(Date.now())) } catch { /* sin disco, se avisa de más: mejor que de menos */ }
}

// Umbrales de la alerta de fallos de entrega. Se dispara por cualquiera de los dos.
const UMBRAL_TASA_FALLOS = 0.15    // 15% en 24h (antes 30%: inalcanzable)
const UMBRAL_FALLOS_ABSOLUTO = 15  // o 15 mensajes perdidos en 24h, sin importar %

// Codigos de Meta que significan "no lo entregue por politica/throttle", NO "el
// numero no existe". El mensaje se puede volver a intentar mas adelante, asi que
// NO debe consumir un intento de seguimiento.
/* ⚠ EL 131026 ENTRA AQUI, Y NO ESTABA. «Message undeliverable»: el numero no
   tiene WhatsApp o no acepta mensajes de empresas. Al quedarse fuera de esta
   lista NO se le aplicaba ningun freno, asi que el lead seguia recibiendo la
   secuencia entera de seguimientos: 105 reintentos en 30 dias para acertar 15
   (14 %), y 90 rebotes que degradan la reputacion del numero para todos los
   demas. Dentro de la lista, se planta a los dos rebotes como el resto. */
const CODIGOS_THROTTLE = new Set([131049, 130472, 131050, 131026])

// Codigos que significan "Meta te corto", no "ese numero no existe".
// Estos NO pueden esperar a que falle el 30% del trafico: cuando aparecen, el
// bot ya esta mudo. El corte de facturacion del 4 al 10 de julio bloqueo 229
// mensajes durante seis dias sin que saltara una sola alerta, justamente
// porque la regla de abajo pide 30% de fallos en 24h.
const CODIGOS_CORTE = {
  131042: 'Meta bloqueo los envios por FACTURACION (payment issue)',
  131031: 'La cuenta esta RESTRINGIDA por Meta',
  368: 'La cuenta esta BLOQUEADA temporalmente por Meta',
}

async function verificarCorte(errorEntrega) {
  const codigo = (String(errorEntrega || '').match(/^(\d+)/) || [])[1]
  const motivo = CODIGOS_CORTE[codigo]
  if (!motivo) return

  // Una alerta por hora: suficiente para enterarse el mismo dia, sin inundar.
  if (Date.now() - ultimaVez('corte') < 3600000) return
  apuntarVez('corte')

  const { alertarCorteMeta } = await import('@/lib/bot/alertas')
  await alertarCorteMeta(codigo, motivo).catch(() => {})
}

async function verificarTasaFallos(errorEntrega) {
  // Primero lo urgente: un corte se avisa al primer mensaje bloqueado.
  await verificarCorte(errorEntrega).catch(e =>
    console.error('[WA Cloud] Error alertando corte:', e.message)
  )

  if (Date.now() - ultimaVez('fallos') < 6 * 3600000) return

  const hace24h = new Date(Date.now() - 24 * 3600000)
  const [fallidos, total] = await Promise.all([
    prisma.botConversacion.count({
      where: { rol: 'bot', createdAt: { gte: hace24h }, estadoEntrega: 'fallido' },
    }),
    prisma.botConversacion.count({
      where: { rol: 'bot', createdAt: { gte: hace24h }, estadoEntrega: { not: null } },
    }),
  ])

  if (total < 5) return
  const tasaFallo = fallidos / total
  // La regla era "solo si falla el 30% en 24h". Medido, la tasa real ronda el
  // 8-10%, asi que la alerta NUNCA se disparo (cero invocaciones en todo el
  // historial) ni siquiera con 61 mensajes perdidos en una semana. Ahora salta
  // por tasa O por volumen absoluto: 15 fallos en un dia ya es algo que mirar.
  if (tasaFallo < UMBRAL_TASA_FALLOS && fallidos < UMBRAL_FALLOS_ABSOLUTO) return

  apuntarVez('fallos')
  const pct = Math.round(tasaFallo * 100)
  const { alertarFallosEntrega } = await import('@/lib/bot/alertas')
  await alertarFallosEntrega(fallidos, total, pct, errorEntrega)
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
  if (existente) {
    /* ⚠ Si ya existía y ahora escribe DESDE UN ANUNCIO, hay que apuntarlo:
       `desdeAnuncioWa` es lo único que separa el tráfico entre los dos bots, y
       sin esto alguien que ya estaba en la base seguiría cayendo en el flujo
       viejo aunque hubiera llegado por la campaña nueva. */
    const ref = msg.referral || null
    if (ref && !existente.desdeAnuncioWa) {
      const anuncioId = ref.source_id || ''
      await prisma.botLead.update({
        where: { id: existente.id },
        data: { desdeAnuncioWa: true, ...(anuncioId ? { anuncioId } : {}) },
      }).catch(e => console.error('[WA Cloud] no pude marcar el anuncio:', e.message))
      console.log(`[WA Cloud] lead existente marcado como CTWA (ad: ${anuncioId || 'unknown'})`)
      return { ...existente, desdeAnuncioWa: true, anuncioId: anuncioId || existente.anuncioId }
    }
    return existente
  }

  const referral = msg.referral || null
  const nombrePerfil = msg.profile_name || msg.from_name || ''
  const desdeAnuncio = Boolean(referral)
  try {
    const lead = await prisma.botLead.create({
      data: {
        nombre: nombrePerfil || 'Lead WhatsApp',
        telefono: telefono || fromRaw,
        anuncioId: desdeAnuncio ? (referral.source_id || '') : undefined,
        /* ⚠ Esto, y no `anuncioId`, es lo que dice «escribió desde un anuncio»:
           `anuncioId` lo escriben también el formulario y el sync de leads. */
        desdeAnuncioWa: desdeAnuncio,
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
  /* Qué botón pulsó, si pulsó alguno. Sin esto un botón llega como un mensaje
     vacío: `msg.text` no existe en los mensajes interactivos. */
  let botonId = null
  let imagenBase64 = null
  let imagenMime = null
  // Campos de media a persistir (ruta en disco) para verlos luego en el panel.
  let media = { mediaPath: null, mediaTipo: null, mediaMime: null }

  if (tipo === 'text') {
    texto = msg.text?.body || ''
  } else if (tipo === 'interactive') {
    /* ⚠ UN BOTÓN NO VIENE EN `text.body`. Llega en
       `interactive.button_reply` (o `list_reply` en las listas), y hasta hoy
       este webhook no lo miraba: el mensaje se guardaba vacío y el bot se
       quedaba callado justo con la persona que había hecho el gesto más claro
       de todos. El título se usa como texto porque es, literalmente, lo que la
       persona dijo. */
    const pulsado = wa.botonPulsado(msg)
    const deLista = msg.interactive?.list_reply
    botonId = pulsado?.id || (deLista?.id ? String(deLista.id) : null)
    texto = pulsado?.titulo || deLista?.title || ''
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

  /* ══ EL BOT DE LOS ANUNCIOS ══════════════════════════════════════════════
     Solo para quien llega desde Click-to-WhatsApp (`anuncioId`). Todo lo demás
     —el formulario, quien escribe por su cuenta— sigue por el camino de
     siempre, intacto: si esto no rinde se apaga y no se ha perdido nada. */
  if (esDeAnuncio(lead) && botonId) {
    const atendido = await atenderDesdeAnuncio(lead, { botonId, texto })
    if (atendido) return
  }

  /* ⚠ EL CAMINO CONOCIDO SE CONTESTA SOLO, SIN MODELO NI ESPERA.
     Los botones del momento post-registro tienen respuesta fija: no hay nada
     que interpretar, así que ni se llama al modelo ni se aguantan los cinco
     segundos del debounce. El modelo sigue atendiendo todo lo que sea texto
     libre. */
  if (botonId && esBotonDeCartera(botonId)) {
    const r = respuestaDeBoton(botonId)
    try {
      const envio = await wa.sendText(lead.telefono, r.texto)
      await prisma.botConversacion.create({
        data: { botLeadId: lead.id, rol: 'bot', texto: r.texto, tipoMensaje: 'chat', wamid: wa.wamidDe(envio) },
      }).catch(() => {})
    } catch (e) {
      console.error('[WA Cloud] no pude contestar el botón:', e.message)
    }
    if (r.avisar) {
      /* «Necesito ayuda» es de los que más pagan: quien escribe «no pude» se
         registra en el 44 % de los casos y paga en el 10 %. No se le da un
         teléfono, se avisa a un humano por el mismo camino de los leads
         calientes. */
      await alertarLeadCaliente(lead, 'pidió ayuda con la cartera tras registrarse', [])
        .catch(e => console.error('[WA Cloud] no pude avisar:', e.message))
      await prisma.botLead.update({
        where: { id: lead.id }, data: { alertado: true, alertadoEn: new Date() },
      }).catch(() => {})
    }
    console.log(`[WA Cloud] botón ${botonId} de ${lead.nombre} — contestado sin modelo`)
    return
  }

  if (botApagado) {
    console.log(`[WA Cloud] Lead ${lead.nombre} con bot apagado — mensaje guardado.`)
    return
  }

  // Filtrar mensajes automaticos de empresa (bienvenida, autorespuesta, etc.)
  // Estos llegan cuando el lead tiene su propio bot/negocio en WhatsApp.
  // Se guardan en historial pero el bot NO responde.
  if (esMensajeAutomatico(texto)) {
    console.log(`[WA Cloud] Mensaje automatico detectado de ${lead.nombre} — guardado, no se responde.`)
    return
  }

  const config = await prisma.botConfig.findFirst()
  if (config && !config.botActivo) {
    console.log('[WA Cloud] Bot global apagado — mensaje guardado.')
    return
  }

  // Debounce: esperar 5s para agrupar mensajes rapidos del lead.
  // Si llegan mas mensajes en ese lapso, este handler se descarta y
  // el handler del ultimo mensaje responde con todo el historial.
  const DEBOUNCE_MS = 5000
  await new Promise(r => setTimeout(r, DEBOUNCE_MS))

  // Buscar el ultimo mensaje del lead en la ventana de debounce.
  // Si llego otro despues del nuestro, este handler se descarta.
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

  // Anti-doble: si el bot ya respondio despues de nuestro mensaje, no
  // responder de nuevo (otro worker o handler anterior ya lo hizo).
  const ultimoBot = await prisma.botConversacion.findFirst({
    where: { botLeadId: lead.id, rol: 'bot' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  const miMsg = mensajesRecientes[0] || null
  if (ultimoBot && miMsg && ultimoBot.createdAt > miMsg.createdAt) {
    console.log(`[WA Cloud] Anti-doble: ${lead.nombre} ya tiene respuesta reciente, este handler se descarta.`)
    return
  }

  /* ⚠ EL SALUDO Y EL ATASCO VAN AQUÍ, NO ARRIBA. Un botón no llega en ráfaga,
     pero el texto sí: quien escribe «hola» y «buenas» seguidos recibiría dos
     saludos con botones si esto se resolviera antes del debounce. Aquí ya pasó
     el agrupado de cinco segundos y el anti-doble. */
  if (esDeAnuncio(lead)) {
    const atendido = await atenderDesdeAnuncio(lead, { botonId: null, texto })
    if (atendido) return
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

  if (!decision) {
    console.log(`[WA Cloud] Ignorado: ${lead.nombre} (mensaje automatico o vacio)`)
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
      // og.png como imagen CON el mensaje del bot de caption: asi van juntos en
      // una sola burbuja (imagen grande arriba, texto + link debajo).
      const mandaLinkRegistro = /app\.control-finanzas\.com\/registro/i.test(decision.mensaje)
      let envio
      if (mandaLinkRegistro) {
        envio = await wa.sendImageLink(lead.telefono, BANNER_URL, decision.mensaje)
      } else {
        envio = await wa.sendText(lead.telefono, decision.mensaje)
      }
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
  const mandoLinkRegistro = decision.mensaje && /app\.control-finanzas\.com\/registro/i.test(decision.mensaje)

  if (decision.escalar) {
    if (lead.estado !== 'cerrado') {
      await prisma.botLead.update({
        where: { id: lead.id },
        data: { estado: 'interesado', proximoSeguimiento: null },
      })
      if (lead.estado !== 'interesado') notificarEstadoLead(lead.id, 'qualified').catch(() => {})
    }
  } else if (mandoLinkRegistro) {
    // Seguimiento rapido post-link: 2 horas para preguntar si pudo registrarse
    await prisma.botLead.update({
      where: { id: lead.id },
      data: {
        estado: 'interesado',
        proximoSeguimiento: new Date(Date.now() + 2 * 3600000),
        intentosSeguimiento: 0,
      },
    })
    notificarEstadoLead(lead.id, 'qualified').catch(() => {})
    console.log(`[WA Cloud] Seguimiento rapido (2h) programado para ${lead.nombre}`)
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

  // Alertar si hay que escalar (WhatsApp a soporte + Telegram, ver lib/bot/alertas).
  //
  // Antes la condicion era `!lead.alertado`, o sea UNA sola alerta por lead en
  // toda su vida: el lead que mas insistia (el mas caliente) era justo el que
  // mas silencio generaba. Ahora se re-alerta pasado un enfriamiento, para no
  // caer en el extremo opuesto de spamear a soporte.
  const ultimaAlerta = lead.alertadoEn ? new Date(lead.alertadoEn).getTime() : 0
  const debeAlertar = decision.escalar &&
    (!lead.alertado || Date.now() - ultimaAlerta > COOLDOWN_ALERTA_MS)

  if (debeAlertar) {
    await alertarLeadCaliente(lead, decision.motivo, historial)
    await prisma.botLead.update({
      where: { id: lead.id },
      data: { alertado: true, alertadoEn: new Date() },
    })
  }
}

/* Devuelve `true` si ya contestó y no hay que seguir al modelo.
 *
 * Tres cosas y en este orden: el botón que pulsó, el saludo si es lo primero
 * que dice, y la señal de atasco. Cualquier otra cosa es texto libre y la
 * atiende el modelo como siempre. */
async function atenderDesdeAnuncio(lead, { botonId, texto }) {
  let salida = null
  let motivoAviso = null

  if (botonId && esBotonDelFlujo(botonId)) {
    const confianza = botonId === 'cf_confiable' ? await datosDeConfianza() : null
    salida = respuestaDeAnuncio(botonId, { confianza })
  } else if (!botonId) {
    /* ¿Es lo primero que le decimos? Se mira si el bot ya habló, no si el lead
       escribió: puede haber mandado tres mensajes seguidos antes de que
       contestáramos. */
    const yaHablamos = await prisma.botConversacion.count({
      where: { botLeadId: lead.id, rol: 'bot' },
    })
    if (yaHablamos === 0) salida = saludoDeAnuncio()
    else if (pareceAtascado(texto)) salida = respuestaAtasco()
  }

  if (!salida) return false
  motivoAviso = salida.avisar || null

  try {
    const envio = salida.botones?.length
      ? await wa.sendButtons(lead.telefono, salida.texto, salida.botones)
      : await wa.sendText(lead.telefono, salida.texto)
    await prisma.botConversacion.create({
      data: { botLeadId: lead.id, rol: 'bot', texto: salida.texto, tipoMensaje: 'chat', wamid: wa.wamidDe(envio) },
    }).catch(() => {})
  } catch (e) {
    console.error('[WA Cloud] flujo de anuncio, no pude contestar:', e.message)
    /* Si no se pudo mandar, NO se da por atendido: que lo intente el modelo
       antes que dejar a la persona sin respuesta. */
    return false
  }

  if (motivoAviso) {
    /* «No pude» y «quiero hablar con alguien» son de lo que más paga: 44 % de
       registro y 10 % de pago. Se avisa a un humano por el mismo camino de los
       leads calientes, en vez de darle un teléfono al que nadie escribe. */
    await alertarLeadCaliente(lead, motivoAviso, []).catch(e => console.error('[WA Cloud] no pude avisar:', e.message))
    await prisma.botLead.update({
      where: { id: lead.id }, data: { alertado: true, alertadoEn: new Date(), temperatura: 80 },
    }).catch(() => {})
  }

  console.log(`[WA Cloud] anuncio → ${lead.nombre}: ${botonId || (motivoAviso ? 'atasco' : 'saludo')}`)
  return true
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
