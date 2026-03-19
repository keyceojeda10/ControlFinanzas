import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID
const PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN
const FORM_ID = process.env.FB_FORM_ID || '933400739047391'

// Cron que consulta Facebook cada 5 min para capturar leads que el webhook no entregó
export async function POST(req) {
  const cronSecret = req.headers.get('x-cron-secret')
  const CRON_SECRET = process.env.CRON_SECRET
  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (!PAGE_TOKEN) {
    return NextResponse.json({ error: 'FB_PAGE_ACCESS_TOKEN no configurado' }, { status: 500 })
  }

  try {
    // Obtener últimos 10 leads de Facebook
    const fbRes = await fetch(
      `https://graph.facebook.com/v21.0/${FORM_ID}/leads?fields=id,created_time,field_data&access_token=${PAGE_TOKEN}&limit=10`
    )
    const fbData = await fbRes.json()

    if (fbData.error) {
      console.error('[Leads Sync] Facebook API error:', fbData.error.message)
      return NextResponse.json({ error: fbData.error.message }, { status: 502 })
    }

    const leads = fbData.data || []
    let nuevos = 0

    for (const fbLead of leads) {
      // Extraer datos
      const fields = {}
      for (const f of fbLead.field_data || []) {
        const name = f.name?.toLowerCase()
        const val = f.values?.[0] || ''
        if (name === 'full_name' || name === 'nombre') fields.nombre = val
        else if (name === 'phone_number' || name === 'telefono') fields.telefono = val
        else if (name?.includes('client') || name?.includes('cuant')) fields.cantClientes = val
      }

      const nombre = fields.nombre || 'Sin nombre'
      const telefono = fields.telefono || ''

      // Ignorar test leads
      if (nombre.includes('test lead') || nombre.includes('dummy')) continue

      // Verificar si ya existe por teléfono O por leadgen_id en notas
      if (telefono) {
        const exists = await prisma.lead.findFirst({ where: { telefono } })
        if (exists) continue
      }

      // Nuevo lead - guardar
      try {
        await prisma.lead.create({
          data: {
            nombre,
            telefono,
            cantClientes: fields.cantClientes || '',
            anuncioId: 'fb_sync',
            notas: `leadgen_id: ${fbLead.id}`,
          }
        })
        console.log('[Leads Sync] Nuevo lead guardado:', nombre, telefono)
        nuevos++

        // Enviar Telegram
        await sendTelegram(nombre, telefono, fields.cantClientes || '', fbLead.created_time)
      } catch (dbErr) {
        console.error('[Leads Sync] DB error:', dbErr.message)
      }
    }

    console.log(`[Leads Sync] Revisados ${leads.length} leads, ${nuevos} nuevos`)
    return NextResponse.json({ revisados: leads.length, nuevos })
  } catch (err) {
    console.error('[Leads Sync] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function sendTelegram(nombre, telefono, cantClientes, createdTime) {
  if (!BOT_TOKEN || !CHAT_ID) return

  const fechaOpts = { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }
  const fecha = createdTime
    ? new Date(createdTime).toLocaleString('es-CO', fechaOpts)
    : new Date().toLocaleString('es-CO', fechaOpts)

  const tel = telefono ? telefono.replace(/\D/g, '') : ''
  const primerNombre = nombre.split(' ')[0]
  const nombreSaludo = primerNombre.charAt(0).toUpperCase() + primerNombre.slice(1).toLowerCase()

  let whatsappSection = ''
  if (tel) {
    const cant = (cantClientes || '').toLowerCase()
    const esPoco = cant.includes('menos') || cant.includes('20')
    const esMucho = cant.includes('más') || cant.includes('mas') || cant.includes('100')

    let msgTexto = ''
    if (esPoco) {
      msgTexto = `Hola ${nombreSaludo}, ¿cómo estás? 👋\n\nTe saluda Carlos de *Control Finanzas*. Te escribo porque vimos que estás interesado en nuestro sistema de gestión de préstamos.\n\nCon Control Finanzas puedes llevar el control de tus clientes, préstamos, cobros y rutas desde el celular, todo organizado en un solo lugar.\n\n¿Actualmente cómo llevas el control de tu cartera? ¿Cuaderno, Excel o alguna otra forma?`
    } else if (esMucho) {
      msgTexto = `Hola ${nombreSaludo}, ¿cómo estás? 👋\n\nTe saluda Carlos de *Control Finanzas*. Te escribo porque vimos que estás interesado en nuestro sistema y que manejas un volumen considerable de clientes.\n\nCon esa cantidad, llevar el control manual se vuelve complicado. Control Finanzas te permite gestionar préstamos, cobros, rutas y cobradores desde el celular, sin perder el rastro de ningún cliente.\n\n¿Actualmente cómo estás gestionando tu cartera? ¿Cuaderno, Excel o algún sistema?`
    } else {
      msgTexto = `Hola ${nombreSaludo}, ¿cómo estás? 👋\n\nTe saluda Carlos de *Control Finanzas*. Te escribo porque vimos que estás interesado en nuestro sistema de gestión de préstamos.\n\nControl Finanzas te ayuda a organizar tus clientes, préstamos, cobros diarios y rutas de cobradores, todo desde el celular.\n\n¿Actualmente cómo llevas el control de tu cartera? ¿Cuaderno, Excel o alguna otra forma?`
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
    `📢 Nuevo Lead - Facebook Ads (sync)`,
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
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, disable_web_page_preview: true }),
    })
  } catch (err) {
    console.error('[Leads Sync] Telegram error:', err.message)
  }
}
