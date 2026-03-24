import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendFollowupReminder } from '@/lib/telegram'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'

// Cron cada 30 min — envía recordatorios escalonados de leads sin atender
//
// FLUJO LEADS NUEVOS (no contactados):
//   2h  → alerta + copy primer mensaje    (recordatorio 1)
//   6h  → alerta urgente + copy            (recordatorio 2)
//   24h → alerta + copy seguimiento 24h    (recordatorio 3)
//   48h → alerta último intento + copy     (recordatorio 4) → marca "perdido"
//
// FLUJO LEADS CONTACTADOS (sin respuesta del lead):
//   24h después de contactar → seguimiento  (recordatorio según contador)
//   48h después de contactar → último       → marca "sin_respuesta"
//
// LEADS REGISTRADOS:
//   7d  → check-in único                   → y ya no más
//
// LÍMITE: máximo 5 días desde creación. Después no se envían más alertas.

export async function POST(req) {
  const cronSecret = req.headers.get('x-cron-secret')
  const CRON_SECRET = process.env.CRON_SECRET
  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  try {
    const now = Date.now()
    const h2ago = new Date(now - 2 * 3600000)
    const h6ago = new Date(now - 6 * 3600000)
    const h24ago = new Date(now - 24 * 3600000)
    const h48ago = new Date(now - 48 * 3600000)
    const d5ago = new Date(now - 5 * 24 * 3600000)
    const d7ago = new Date(now - 7 * 24 * 3600000)

    let enviados = 0

    // ── LEADS NUEVOS (no contactados) ──────────────────────

    // 1. Primera alerta: >2h sin contactar, 0 recordatorios
    const leads2h = await prisma.lead.findMany({
      where: {
        estado: 'nuevo',
        createdAt: { lt: h2ago, gt: d5ago },
        recordatoriosEnviados: 0,
      },
      take: 10,
    })
    for (const lead of leads2h) {
      await sendFollowupReminder(lead, '2h')
      await prisma.lead.update({
        where: { id: lead.id },
        data: { recordatoriosEnviados: 1, ultimoRecordatorio: new Date() },
      })
      enviados++
    }

    // 2. Segunda alerta urgente: >6h sin contactar, 1 recordatorio
    const leads6h = await prisma.lead.findMany({
      where: {
        estado: 'nuevo',
        createdAt: { lt: h6ago, gt: d5ago },
        recordatoriosEnviados: 1,
      },
      take: 10,
    })
    for (const lead of leads6h) {
      await sendFollowupReminder(lead, '6h')
      await prisma.lead.update({
        where: { id: lead.id },
        data: { recordatoriosEnviados: 2, ultimoRecordatorio: new Date() },
      })
      enviados++
    }

    // 3. Tercera alerta: >24h sin contactar, 2 recordatorios
    const leads24hNuevo = await prisma.lead.findMany({
      where: {
        estado: 'nuevo',
        createdAt: { lt: h24ago, gt: d5ago },
        recordatoriosEnviados: 2,
      },
      take: 10,
    })
    for (const lead of leads24hNuevo) {
      await sendFollowupReminder(lead, '24h')
      await prisma.lead.update({
        where: { id: lead.id },
        data: { recordatoriosEnviados: 3, ultimoRecordatorio: new Date() },
      })
      enviados++
    }

    // 4. Último intento: >48h sin contactar, 3 recordatorios → marca perdido
    const leads48hNuevo = await prisma.lead.findMany({
      where: {
        estado: 'nuevo',
        createdAt: { lt: h48ago },
        recordatoriosEnviados: 3,
      },
      take: 10,
    })
    for (const lead of leads48hNuevo) {
      await sendFollowupReminder(lead, '48h')
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          estado: 'perdido',
          recordatoriosEnviados: 4,
          ultimoRecordatorio: new Date(),
        },
      })
      enviados++
    }

    // ── LEADS CONTACTADOS (esperando respuesta) ────────────

    // 5. Contactado hace >24h sin avance, máximo 1 followup de contactado
    const leadsContactado24h = await prisma.lead.findMany({
      where: {
        estado: 'contactado',
        updatedAt: { lt: h24ago },
        createdAt: { gt: d5ago },
        recordatoriosEnviados: { lt: 5 },
      },
      take: 10,
    })
    for (const lead of leadsContactado24h) {
      // Solo enviar si el último recordatorio fue hace >24h
      if (lead.ultimoRecordatorio && (now - new Date(lead.ultimoRecordatorio).getTime()) < 24 * 3600000) continue
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

    // 6. Contactado hace >48h → último intento, marca sin_respuesta
    const leadsContactado48h = await prisma.lead.findMany({
      where: {
        estado: 'contactado',
        updatedAt: { lt: h48ago },
        recordatoriosEnviados: { gte: 5 },
      },
      take: 10,
    })
    for (const lead of leadsContactado48h) {
      await sendFollowupReminder(lead, '48h')
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          estado: 'sin_respuesta',
          recordatoriosEnviados: { increment: 1 },
          ultimoRecordatorio: new Date(),
        },
      })
      enviados++
    }

    // ── LEADS REGISTRADOS ──────────────────────────────────

    // 7. Registrado hace >7d, check-in único (recordatorios < 10 como flag)
    const leads7d = await prisma.lead.findMany({
      where: {
        estado: 'registrado',
        createdAt: { lt: d7ago },
        recordatoriosEnviados: { lt: 10 },
      },
      take: 10,
    })
    for (const lead of leads7d) {
      await sendFollowupReminder(lead, '7d')
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          recordatoriosEnviados: 10, // flag: ya se hizo check-in
          ultimoRecordatorio: new Date(),
        },
      })
      enviados++
    }

    // ── LIMPIEZA: leads viejos que quedaron como "nuevo" >5 días ──
    const leadsViejos = await prisma.lead.updateMany({
      where: {
        estado: 'nuevo',
        createdAt: { lt: d5ago },
        recordatoriosEnviados: { gte: 4 },
      },
      data: { estado: 'perdido' },
    })

    console.log(`[Leads Followup] ${enviados} recordatorios enviados, ${leadsViejos.count} leads marcados perdidos`)
    return NextResponse.json({ enviados, limpios: leadsViejos.count })
  } catch (err) {
    console.error('[Leads Followup] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
