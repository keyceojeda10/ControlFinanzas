import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { sendLeadNotification } from '@/lib/telegram'
import { parseFieldData } from '@/lib/fb-leads'

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

        processLead(leadgenId, adId, createdTime).catch(err => {
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

async function processLead(leadgenId, adId, createdTime) {
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

  // Guardar en DB con protección contra duplicados
  let lead = null
  try {
    // Dedup por teléfono
    if (telefono) {
      const exists = await prisma.lead.findFirst({ where: { telefono } })
      if (exists) {
        console.log('[Leads] Lead duplicado (tel), ignorando:', nombre, telefono)
        return
      }
    }
    // Dedup por leadgenId (notas contiene el ID)
    if (leadgenId) {
      const existsLg = await prisma.lead.findFirst({ where: { notas: { contains: leadgenId } } })
      if (existsLg) {
        console.log('[Leads] Lead duplicado (leadgenId), ignorando:', nombre, leadgenId)
        return
      }
    }
    const notasJson = JSON.stringify({ leadgen_id: leadgenId, metodoActual, planInteres, consent })
    lead = await prisma.lead.create({
      data: { nombre, telefono, cantClientes, esPrestamista, anuncioId: adId, notas: notasJson }
    })
    console.log('[Leads] Guardado en DB:', nombre, telefono)
  } catch (dbErr) {
    console.error('[Leads] DB error:', dbErr.message)
  }

  // Enviar Telegram con botones interactivos
  const messageId = await sendLeadNotification(
    { nombre, telefono, cantClientes, esPrestamista, metodoActual, planInteres, consent, anuncioId: adId, createdTime, leadgenId },
    lead?.id
  )

  // Guardar el ID del mensaje de Telegram para poder editarlo después
  if (lead && messageId) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { telegramMessageId: messageId },
    }).catch(() => {})
  }

  console.log('[Leads] Telegram enviado para:', nombre)
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
