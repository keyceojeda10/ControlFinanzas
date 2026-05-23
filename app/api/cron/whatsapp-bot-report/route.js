// app/api/cron/whatsapp-bot-report/route.js — Reporte diario (8pm COL)
import { NextResponse } from 'next/server'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import { alertarReporteDiario } from '@/lib/bot/alertas'

export async function POST(req) {
  const cronSecret = req.headers.get('x-cron-secret')
  const CRON_SECRET = process.env.CRON_SECRET
  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  try {
    const total = await prisma.botLead.count()
    const porEstado = await prisma.botLead.groupBy({ by: ['estado'], _count: true })
    const estados = Object.fromEntries(porEstado.map(e => [e.estado, e._count]))

    const contactados = (estados.contactado || 0) + (estados.interesado || 0) + (estados.no_interesado || 0) + (estados.cerrado || 0)
    const respondieron = (estados.interesado || 0) + (estados.cerrado || 0)
    const tasaRespuesta = contactados > 0 ? +(respondieron / contactados * 100).toFixed(1) : 0

    const ahora = new Date()
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())

    const gastoHoy = await prisma.botGastoApi.aggregate({
      where: { createdAt: { gte: inicioHoy } },
      _sum: { costoUsd: true },
    })
    const gastoTotal = await prisma.botGastoApi.aggregate({ _sum: { costoUsd: true } })

    const metricas = { total, porEstado: estados, contactados, tasaRespuesta }
    const gasto = {
      hoyUsd: +(gastoHoy._sum.costoUsd || 0).toFixed(4),
      totalUsd: +(gastoTotal._sum.costoUsd || 0).toFixed(4),
    }

    const enviado = await alertarReporteDiario(metricas, gasto)
    console.log(`[Bot Cron Report] Reporte ${enviado ? 'enviado' : 'no enviado'}`)
    return NextResponse.json({ enviado, metricas, gasto })
  } catch (err) {
    console.error('[Bot Cron Report] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
