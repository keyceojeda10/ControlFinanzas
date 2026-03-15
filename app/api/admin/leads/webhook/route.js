import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID
const VERIFY_TOKEN = process.env.FB_LEADS_VERIFY_TOKEN || 'cf_leads_2026_verify'

// Facebook webhook verification (GET)
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Facebook webhook lead event (POST)
export async function POST(request) {
  try {
    const body = await request.json()

    // Facebook sends { object: 'page', entry: [...] }
    if (body.object !== 'page') {
      return NextResponse.json({ status: 'ignored' })
    }

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue

        const leadgenId = change.value?.leadgen_id
        const adId = change.value?.ad_id || ''
        const createdTime = change.value?.created_time

        // Fetch lead data from Facebook Graph API
        const leadData = await fetchLeadFromFacebook(leadgenId)

        const nombre = leadData?.nombre || 'Sin nombre'
        const telefono = leadData?.telefono || ''
        const cantClientes = leadData?.cantClientes || ''

        // Save to DB
        try {
          await prisma.lead.create({
            data: { nombre, telefono, cantClientes, anuncioId: adId }
          })
        } catch (dbErr) {
          console.error('[Leads] DB error:', dbErr.message)
        }

        // Send Telegram notification (always, even if FB API failed)
        await sendTelegramNotification({ nombre, telefono, cantClientes, anuncioId: adId, createdTime, leadgenId })
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[Webhook leads]', error)
    return NextResponse.json({ status: 'ok' }) // Always 200 to Facebook
  }
}

async function fetchLeadFromFacebook(leadgenId) {
  if (!leadgenId) return null
  const pageToken = process.env.FB_PAGE_ACCESS_TOKEN
  if (!pageToken) {
    console.warn('[Leads] No FB_PAGE_ACCESS_TOKEN, cannot fetch lead data')
    return null
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${pageToken}`
    )
    const data = await res.json()
    if (data.error) {
      console.error('[Leads] Facebook API error:', data.error)
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
    console.error('[Leads] Error fetching from Facebook:', err)
    return null
  }
}

async function sendTelegramNotification({ nombre, telefono, cantClientes, anuncioId, createdTime, leadgenId }) {
  if (!BOT_TOKEN || !CHAT_ID) return

  const fecha = createdTime
    ? new Date(createdTime * 1000).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const tel = telefono.replace(/\D/g, '')

  // Mensaje corto para <50 clientes
  const msgCorto = encodeURIComponent(
    `Hola ${nombre}! Soy Carlos de Control Finanzas 👋\n\nVi que te interesó el sistema para manejar tu cartera de préstamos.\n\n¿Actualmente cómo llevas el control? ¿Cuaderno, Excel o alguna app?`
  )

  // Mensaje para 50+ clientes
  const cantLabel = cantClientes || 'varios'
  const msgLargo = encodeURIComponent(
    `Hola ${nombre}! Soy Carlos de Control Finanzas 👋\n\nVi que manejas más de ${cantLabel} clientes. Con ese volumen, un sistema te ahorra horas al día y evita errores en los cobros.\n\n¿Actualmente cómo llevas el control de tu cartera?`
  )

  const text = `🚨 *Nuevo Lead — Facebook Ads*

👤 *Nombre:* ${nombre}
📱 *Teléfono:* ${telefono}
👥 *Clientes:* ${cantClientes || 'No especificó'}
📢 *Anuncio:* ${anuncioId || 'N/A'}
📅 ${fecha}

──────────────────
💬 *WhatsApp (<50 clientes):*
https://wa.me/${tel}?text=${msgCorto}

💬 *WhatsApp (50+ clientes):*
https://wa.me/${tel}?text=${msgLargo}`

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    })
  } catch (err) {
    console.error('[Telegram]', err)
  }
}
