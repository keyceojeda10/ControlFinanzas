// app/api/admin/whatsapp-bot/route.js — Dashboard metricas del bot
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { healthCheck } from '@/lib/bot/whatsapp-cloud'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const ahora = new Date()
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())

  const [
    totalLeads,
    leadsHoy,
    porEstado,
    gastoHoy,
    gastoTotal,
    config,
    ultimosLeads,
  ] = await Promise.all([
    prisma.botLead.count(),
    prisma.botLead.count({ where: { createdAt: { gte: inicioHoy } } }),
    prisma.botLead.groupBy({ by: ['estado'], _count: true }),
    prisma.botGastoApi.aggregate({ where: { createdAt: { gte: inicioHoy } }, _sum: { costoUsd: true } }),
    prisma.botGastoApi.aggregate({ _sum: { costoUsd: true } }),
    prisma.botConfig.findFirst(),
    prisma.botLead.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
  ])

  const estados = Object.fromEntries(porEstado.map(e => [e.estado, e._count]))
  const contactados = (estados.contactado || 0) + (estados.interesado || 0) + (estados.no_interesado || 0) + (estados.cerrado || 0)
  const respondieron = (estados.interesado || 0) + (estados.cerrado || 0)
  const tasaRespuesta = contactados > 0 ? +(respondieron / contactados * 100).toFixed(1) : 0

  // Estado de la WhatsApp Cloud API (no bloquear si falla)
  let whatsappCloud = { ok: false, status: 'desconocido' }
  try {
    whatsappCloud = await healthCheck()
  } catch {}

  return NextResponse.json({
    totalLeads,
    leadsHoy,
    estados,
    tasaRespuesta,
    gastoHoy: +(gastoHoy._sum.costoUsd || 0).toFixed(4),
    gastoTotal: +(gastoTotal._sum.costoUsd || 0).toFixed(4),
    botActivo: config?.botActivo ?? true,
    whatsappCloud,
    ultimosLeads,
  })
}
