import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendLeadNotification } from '@/lib/telegram'
import { parseFieldData } from '@/lib/fb-leads'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'

const PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN
const FORM_ID = process.env.FB_FORM_ID || '933400739047391'

// Cron que consulta Facebook cada 5 min para capturar leads que el webhook no entregó
export async function POST(req) {
  const cronSecret = req.headers.get('x-cron-secret')
  const CRON_SECRET = process.env.CRON_SECRET
  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  if (!PAGE_TOKEN) {
    return NextResponse.json({ error: 'FB_PAGE_ACCESS_TOKEN no configurado' }, { status: 500 })
  }

  try {
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
      const fields = parseFieldData(fbLead.field_data)

      const nombre = fields.nombre || 'Sin nombre'
      const telefono = fields.telefono || ''
      const esPrestamista = fields.esPrestamista || ''
      const cantClientes = fields.cantClientes || ''
      const metodoActual = fields.metodoActual || ''
      const planInteres = fields.planInteres || ''
      const consent = fields.consent || ''

      if (nombre.includes('test lead') || nombre.includes('dummy')) continue

      // Dedup por leadgen_id primero
      const existsLg = await prisma.lead.findFirst({ where: { notas: { contains: fbLead.id } } })
      if (existsLg) continue

      // Dedup por teléfono
      if (telefono) {
        const exists = await prisma.lead.findFirst({ where: { telefono } })
        if (exists) continue
      }

      try {
        const notasJson = JSON.stringify({ leadgen_id: fbLead.id, metodoActual, planInteres, consent })
        const lead = await prisma.lead.create({
          data: {
            nombre,
            telefono,
            cantClientes,
            esPrestamista,
            anuncioId: 'fb_sync',
            notas: notasJson,
          }
        })
        console.log('[Leads Sync] Nuevo lead guardado:', nombre, telefono)
        nuevos++

        // Enviar Telegram con botones interactivos
        const createdTime = fbLead.created_time
          ? Math.floor(new Date(fbLead.created_time).getTime() / 1000)
          : null
        const messageId = await sendLeadNotification(
          { nombre, telefono, cantClientes, esPrestamista, metodoActual, planInteres, consent, anuncioId: 'fb_sync', createdTime, leadgenId: fbLead.id },
          lead.id
        )

        if (messageId) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { telegramMessageId: messageId },
          }).catch(() => {})
        }
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
