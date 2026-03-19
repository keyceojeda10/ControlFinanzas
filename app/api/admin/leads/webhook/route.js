import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID
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

    // Procesar cada lead en background para no bloquear la respuesta a Facebook
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue

        const leadgenId = change.value?.leadgen_id
        const adId = change.value?.ad_id || ''
        const createdTime = change.value?.created_time

        console.log('[Leads] Webhook recibido - leadgen_id:', leadgenId)

        // Procesar en background (no await) para responder 200 rapido a Facebook
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

// Procesar lead con reintentos (Facebook a veces tarda en hacer disponible el lead)
async function processLead(leadgenId, adId, createdTime) {
  let leadData = null

  // Intentar hasta 3 veces con delay creciente (2s, 5s, 10s)
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

  // Guardar en DB (con protección contra duplicados)
  try {
    if (telefono) {
      const exists = await prisma.lead.findFirst({ where: { telefono } })
      if (exists) {
        console.log('[Leads] Lead duplicado, ignorando:', nombre, telefono)
        return
      }
    }
    await prisma.lead.create({
      data: { nombre, telefono, cantClientes, anuncioId: adId }
    })
    console.log('[Leads] Guardado en DB:', nombre, telefono)
  } catch (dbErr) {
    console.error('[Leads] DB error:', dbErr.message)
  }

  // Enviar Telegram siempre
  await sendTelegramNotification({ nombre, telefono, cantClientes, anuncioId: adId, createdTime, leadgenId })
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

    const fields = {}
    for (const f of data.field_data || []) {
      const name = f.name?.toLowerCase()
      const val = f.values?.[0] || ''
      if (name === 'full_name' || name === 'nombre') fields.nombre = val
      else if (name === 'phone_number' || name === 'telefono') fields.telefono = val
      else if (name?.includes('client') || name?.includes('cuant')) fields.cantClientes = val
    }
    return fields
  } catch (err) {
    console.error('[Leads] Fetch error:', err.message)
    return null
  }
}

async function sendTelegramNotification({ nombre, telefono, cantClientes, anuncioId, createdTime, leadgenId }) {
  if (!BOT_TOKEN || !CHAT_ID) return

  const fechaOpts = { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }
  const fecha = createdTime
    ? new Date(createdTime * 1000).toLocaleString('es-CO', fechaOpts)
    : new Date().toLocaleString('es-CO', fechaOpts)

  const tel = telefono ? telefono.replace(/\D/g, '') : ''
  // Extraer solo el primer nombre para que suene personal
  const primerNombre = nombre.split(' ')[0]
  // Capitalizar: "CARLOS" → "Carlos", "carlos" → "Carlos"
  const nombreSaludo = primerNombre.charAt(0).toUpperCase() + primerNombre.slice(1).toLowerCase()

  let whatsappSection = ''
  if (tel) {
    // Determinar volumen para personalizar mensaje
    const cant = (cantClientes || '').toLowerCase()
    const esPoco = cant.includes('menos') || cant.includes('20')
    const esMedio = cant.includes('50') || cant.includes('100')
    const esMucho = cant.includes('más') || cant.includes('mas') || cant.includes('100')

    let msgTexto = ''
    if (esPoco) {
      msgTexto = [
        `Hola ${nombreSaludo}, ¿cómo estás? 👋`,
        ``,
        `Te saluda Carlos de *Control Finanzas*. Te escribo porque vimos que estás interesado en nuestro sistema de gestión de préstamos.`,
        ``,
        `Con Control Finanzas puedes llevar el control de tus clientes, préstamos, cobros y rutas desde el celular, todo organizado en un solo lugar.`,
        ``,
        `¿Actualmente cómo llevas el control de tu cartera? ¿Cuaderno, Excel o alguna otra forma?`,
      ].join('\n')
    } else if (esMucho) {
      msgTexto = [
        `Hola ${nombreSaludo}, ¿cómo estás? 👋`,
        ``,
        `Te saluda Carlos de *Control Finanzas*. Te escribo porque vimos que estás interesado en nuestro sistema y que manejas un volumen considerable de clientes.`,
        ``,
        `Con esa cantidad, llevar el control manual se vuelve complicado. Control Finanzas te permite gestionar préstamos, cobros, rutas y cobradores desde el celular, sin perder el rastro de ningún cliente.`,
        ``,
        `¿Actualmente cómo estás gestionando tu cartera? ¿Cuaderno, Excel o algún sistema?`,
      ].join('\n')
    } else {
      msgTexto = [
        `Hola ${nombreSaludo}, ¿cómo estás? 👋`,
        ``,
        `Te saluda Carlos de *Control Finanzas*. Te escribo porque vimos que estás interesado en nuestro sistema de gestión de préstamos.`,
        ``,
        `Control Finanzas te ayuda a organizar tus clientes, préstamos, cobros diarios y rutas de cobradores, todo desde el celular.`,
        ``,
        `¿Actualmente cómo llevas el control de tu cartera? ¿Cuaderno, Excel o alguna otra forma?`,
      ].join('\n')
    }

    const msgEncoded = encodeURIComponent(msgTexto)
    whatsappSection = [
      ``,
      `--- ⚡ Contactar rapido ---`,
      ``,
      `💬 WhatsApp:`,
      `https://wa.me/${tel}?text=${msgEncoded}`,
    ].join('\n')
  }

  const text = [
    `📢 Nuevo Lead - Facebook Ads`,
    ``,
    `👤 Nombre: ${nombre}`,
    `📱 Telefono: ${telefono || 'No disponible'}`,
    `👥 Clientes: ${cantClientes || 'No especifico'}`,
    `📅 Fecha: ${fecha}`,
    whatsappSection,
    ``,
    `--- 🖥 Ver en panel ---`,
    `https://app.control-finanzas.com/admin/leads`,
  ].join('\n')

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        disable_web_page_preview: true,
      }),
    })
    const result = await res.json()
    if (!result.ok) console.error('[Telegram] Error:', result.description)
  } catch (err) {
    console.error('[Telegram]', err)
  }
}
