import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendFollowupReminder } from '@/lib/telegram'

// Cron cada 30 min — envía recordatorios de leads sin atender
export async function POST(req) {
  const cronSecret = req.headers.get('x-cron-secret')
  const CRON_SECRET = process.env.CRON_SECRET
  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const now = Date.now()
    const h2ago = new Date(now - 2 * 3600000)
    const h24ago = new Date(now - 24 * 3600000)
    const h48ago = new Date(now - 48 * 3600000)
    const d7ago = new Date(now - 7 * 24 * 3600000)

    let enviados = 0

    // 1. Urgente: estado=nuevo, >2h, 0 recordatorios
    const urgentes = await prisma.lead.findMany({
      where: {
        estado: 'nuevo',
        createdAt: { lt: h2ago },
        recordatoriosEnviados: 0,
      },
      take: 10,
    })
    for (const lead of urgentes) {
      await sendFollowupReminder(lead, 'urgente')
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          recordatoriosEnviados: { increment: 1 },
          ultimoRecordatorio: new Date(),
        },
      })
      enviados++
    }

    // 2. 24h: estado=nuevo, >24h, 1 recordatorio
    const leads24h = await prisma.lead.findMany({
      where: {
        estado: 'nuevo',
        createdAt: { lt: h24ago },
        recordatoriosEnviados: 1,
      },
      take: 10,
    })
    for (const lead of leads24h) {
      await sendFollowupReminder(lead, '24h')
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          recordatoriosEnviados: { increment: 1 },
          ultimoRecordatorio: new Date(),
        },
      })
      enviados++
    }

    // 3. 48h: estado=contactado, >48h, <=2 recordatorios
    const leads48h = await prisma.lead.findMany({
      where: {
        estado: 'contactado',
        createdAt: { lt: h48ago },
        recordatoriosEnviados: { lte: 2 },
      },
      take: 10,
    })
    for (const lead of leads48h) {
      await sendFollowupReminder(lead, '48h')
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          recordatoriosEnviados: { increment: 1 },
          ultimoRecordatorio: new Date(),
        },
      })
      enviados++
    }

    // 4. 7d: estado=registrado, >7d, <=3 recordatorios
    const leads7d = await prisma.lead.findMany({
      where: {
        estado: 'registrado',
        createdAt: { lt: d7ago },
        recordatoriosEnviados: { lte: 3 },
      },
      take: 10,
    })
    for (const lead of leads7d) {
      await sendFollowupReminder(lead, '7d')
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          recordatoriosEnviados: { increment: 1 },
          ultimoRecordatorio: new Date(),
        },
      })
      enviados++
    }

    console.log(`[Leads Followup] ${enviados} recordatorios enviados`)
    return NextResponse.json({ enviados })
  } catch (err) {
    console.error('[Leads Followup] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
