import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendLeadNotification } from '@/lib/telegram'
import { parseFieldData } from '@/lib/fb-leads'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'

const PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN
/* ⚠ EL FORMULARIO NO SE ADIVINA. Aquí iba un id fijo de marzo (el v1, con 0
   leads en toda su vida) y desde el 28 de agosto los leads entran por otro:
   el cron decía «0 leads, 0 nuevos» 288 veces al día mirando un formulario
   vacío. Como red de seguridad no protegía nada. Ahora recorre TODOS los
   formularios de la página que tienen leads; `FB_FORM_ID` lo restringe a uno
   si hace falta. */
const FORM_ID = process.env.FB_FORM_ID || null

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
    let formIds = FORM_ID ? [FORM_ID] : []
    if (formIds.length === 0) {
      const fRes = await fetch(`https://graph.facebook.com/v21.0/me/leadgen_forms?fields=id,leads_count&limit=100&access_token=${PAGE_TOKEN}`)
      const fData = await fRes.json()
      if (fData.error) {
        console.error('[Leads Sync] Facebook API error (formularios):', fData.error.message)
        return NextResponse.json({ error: fData.error.message }, { status: 502 })
      }
      formIds = (fData.data || []).filter((f) => Number(f.leads_count) > 0).map((f) => f.id)
    }

    const leads = []
    for (const formId of formIds) {
      const fbRes = await fetch(
        `https://graph.facebook.com/v21.0/${formId}/leads?fields=id,created_time,field_data&access_token=${PAGE_TOKEN}&limit=10`
      )
      const fbData = await fbRes.json()
      if (fbData.error) {
        console.error(`[Leads Sync] Facebook API error (formulario ${formId}):`, fbData.error.message)
        continue
      }
      leads.push(...(fbData.data || []))
    }
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

      // Crear de forma atomica con leadgenId unico: el constraint @unique en
      // Lead.leadgenId es quien arbitra la concurrencia entre este cron y el
      // webhook (ambos pueden procesar el mismo lead en paralelo). Si el
      // create() choca contra un registro existente, ya fue procesado por el
      // webhook (o por una corrida previa de este cron) — no notificar de nuevo.
      let lead
      try {
        const notasJson = JSON.stringify({ leadgen_id: fbLead.id, metodoActual, planInteres, consent })
        lead = await prisma.lead.create({
          data: {
            nombre,
            telefono,
            leadgenId: fbLead.id || undefined,
            cantClientes,
            esPrestamista,
            anuncioId: 'fb_sync',
            notas: notasJson,
          }
        })
      } catch (createErr) {
        if (createErr.code === 'P2002') continue // ya existe (leadgenId o telefono unico) — no duplicar
        console.error('[Leads Sync] DB error:', createErr.message)
        continue
      }

      console.log('[Leads Sync] Nuevo lead guardado:', nombre, telefono)
      nuevos++

      try {
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
      } catch (notifErr) {
        console.error('[Leads Sync] Error notificando:', notifErr.message)
      }
    }

    // Solo cuando hay algo: corría cada 5 min y escribía 288 líneas al día
    // de «0 leads, 0 nuevos». Los leads entran por el webhook; esto es la red.
    if (leads.length > 0 || nuevos > 0) console.log(`[Leads Sync] Revisados ${leads.length} leads, ${nuevos} nuevos`)
    return NextResponse.json({ revisados: leads.length, nuevos })
  } catch (err) {
    console.error('[Leads Sync] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
