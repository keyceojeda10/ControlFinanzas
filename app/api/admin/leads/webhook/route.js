import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { sendLeadNotification } from '@/lib/telegram'
import { parseFieldData } from '@/lib/fb-leads'
import { procesarNuevoLead } from '@/lib/bot/bridge'

const VERIFY_TOKEN = process.env.FB_LEADS_VERIFY_TOKEN
const FB_APP_SECRET = process.env.FB_APP_SECRET

// Facebook webhook verification (GET)
export async function GET(request) {
  if (!VERIFY_TOKEN) {
    console.error('[Leads] FB_LEADS_VERIFY_TOKEN no configurado')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Validate X-Hub-Signature-256 from Facebook
function verifyFacebookSignature(rawBody, signature) {
  if (!FB_APP_SECRET) {
    console.warn('[Leads] FB_APP_SECRET no configurado - aceptando sin validar firma')
    return true
  }
  if (!signature) {
    console.warn('[Leads] Sin header X-Hub-Signature-256 - aceptando igual')
    return true
  }

  const expectedSig = 'sha256=' + crypto
    .createHmac('sha256', FB_APP_SECRET)
    .update(rawBody)
    .digest('hex')

  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    )
    if (!valid) {
      console.warn('[Leads] Firma no coincide - aceptando de todas formas')
    }
    return true
  } catch {
    return true
  }
}

// Facebook webhook lead event (POST)
export async function POST(request) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-hub-signature-256')

    if (!verifyFacebookSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)

    if (body.object !== 'page') {
      return NextResponse.json({ status: 'ignored' })
    }

    // Deduplicar leadgen_ids en el mismo request (Facebook a veces envía duplicados)
    const processedIds = new Set()
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue

        const leadgenId = change.value?.leadgen_id
        if (!leadgenId || processedIds.has(leadgenId)) continue
        processedIds.add(leadgenId)

        const adId = change.value?.ad_id || ''
        const createdTime = change.value?.created_time

        console.log('[Leads] Webhook recibido - leadgen_id:', leadgenId)

        _processLeadInternal(leadgenId, adId, createdTime).catch(err => {
          console.error('[Leads] Error procesando lead:', err)
        })
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[Webhook leads]', error)
    return NextResponse.json({ status: 'ok' })
  }
}

async function _processLeadInternal(leadgenId, adId, createdTime) {
  let leadData = null

  const delays = [2000, 5000, 10000]
  for (let i = 0; i < delays.length; i++) {
    await sleep(delays[i])
    leadData = await fetchLeadFromFacebook(leadgenId)
    if (leadData && leadData.nombre) {
      console.log('[Leads] Datos obtenidos al intento', i + 1, '- nombre:', leadData.nombre)
      break
    }
    console.log('[Leads] Intento', i + 1, 'sin datos, reintentando...')
  }

  const nombre = leadData?.nombre || 'Sin nombre'
  const telefono = leadData?.telefono || ''
  const cantClientes = leadData?.cantClientes || ''
  const esPrestamista = leadData?.esPrestamista || ''
  const metodoActual = leadData?.metodoActual || ''
  const planInteres = leadData?.planInteres || ''
  const consent = leadData?.consent || ''

  // Guardar en DB con protección contra duplicados exactos (mismo leadgenId)
  let lead = null
  let esRetorno = false
  let yaNotificado = false
  try {
    // Crear de forma atomica con leadgenId unico: el constraint @unique en
    // Lead.leadgenId es quien arbitra la concurrencia entre workers del
    // cluster PM2 y reintentos de Facebook (los locks en memoria no sirven
    // porque cada worker tiene su propio proceso/heap). Si dos requests
    // llegan en paralelo para el mismo leadgen_id, solo uno logra el create();
    // el otro recibe P2002, recupera el lead ya creado y NO vuelve a notificar
    // ni a disparar el bot — asi se evita el doble mensaje al lead.
    const notasJson = JSON.stringify({ leadgen_id: leadgenId, metodoActual, planInteres, consent })
    try {
      lead = await prisma.lead.create({
        data: { nombre, telefono, leadgenId: leadgenId || undefined, cantClientes, esPrestamista, anuncioId: adId, notas: notasJson }
      })
      console.log('[Leads] Guardado en DB:', nombre, telefono)
    } catch (createErr) {
      if (createErr.code === 'P2002' && leadgenId) {
        const existsLg = await prisma.lead.findUnique({ where: { leadgenId } })
        if (existsLg) {
          console.log('[Leads] Lead duplicado (leadgenId), ignorando notificacion repetida:', nombre, leadgenId)
          yaNotificado = true
          lead = existsLg
        } else {
          throw createErr
        }
      } else {
        throw createErr
      }
    }

    // Verificar retorno (mismo telefono, leadgen_id distinto = volvio a llenar el form)
    if (!yaNotificado && telefono) {
      const previo = await prisma.lead.findFirst({
        where: { telefono, id: { not: lead.id } },
        orderBy: { createdAt: 'desc' },
      })
      if (previo) {
        esRetorno = true
        console.log('[Leads] Lead RETORNO detectado:', nombre, telefono, '- volvió a llenar formulario')
      }
    }
  } catch (dbErr) {
    console.error('[Leads] DB error:', dbErr.message)
    return
  }

  // Si el leadgen_id ya existia, otro worker/intento ya proceso este evento
  // por completo (Telegram + bot). No repetir nada.
  if (yaNotificado) return

  // Enviar Telegram con botones interactivos
  const messageId = await sendLeadNotification(
    { nombre, telefono, cantClientes, esPrestamista, metodoActual, planInteres, consent, anuncioId: adId, createdTime, leadgenId, esRetorno },
    lead?.id
  )

  // Guardar el ID del mensaje de Telegram para poder editarlo después
  if (lead && messageId) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { telegramMessageId: messageId },
    }).catch(() => {})
  }

  console.log('[Leads] Telegram enviado para:', nombre, esRetorno ? '(RETORNO)' : '')

  // Validar teléfono antes de enviar al bot
  const telDigitos = (telefono || '').replace(/\D/g, '')
  if (/[a-zA-Z]/.test(telefono)) {
    console.warn('[Leads] Teléfono con letras, no enviar al bot:', nombre, telefono)
  } else if (telDigitos.length < 10) {
    console.warn('[Leads] Teléfono muy corto (<10 dígitos), no enviar al bot:', nombre, telefono)
  }

  // Enviar lead al bot de WhatsApp (integrado)
  const telValido = telDigitos.length >= 10 && !/[a-zA-Z]/.test(telefono)
  if (telValido && telefono && lead) {
    procesarNuevoLead({
      cfLeadId: lead.id, nombre, telefono, cantClientes, esPrestamista, metodoActual, planInteres, anuncioId: adId, esRetorno,
    }).catch(err => console.error('[Leads] Error procesando lead en bot WhatsApp:', err.message))
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchLeadFromFacebook(leadgenId) {
  if (!leadgenId) return null
  const pageToken = process.env.FB_PAGE_ACCESS_TOKEN
  if (!pageToken) {
    console.warn('[Leads] No FB_PAGE_ACCESS_TOKEN')
    return null
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${pageToken}`
    )
    const data = await res.json()
    if (data.error) {
      console.error('[Leads] FB API error (intento):', data.error.message)
      return null
    }

    return parseFieldData(data.field_data)
  } catch (err) {
    console.error('[Leads] Fetch error:', err.message)
    return null
  }
}
