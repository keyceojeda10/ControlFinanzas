// app/api/admin/whatsapp-bot/route.js — Dashboard metricas del bot
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { healthCheck } from '@/lib/bot/whatsapp-cloud'
import { getTelefonosRegistrados, estaRegistrado } from '@/lib/bot/conversion'

const TEMP_CALIENTE = 60

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

  // Leads calientes (temperatura alta) y conversion real (cruce con User registrado)
  const leadsCalientes = await prisma.botLead.count({
    where: { temperatura: { gte: TEMP_CALIENTE }, estado: { notIn: ['bloqueado', 'no_interesado'] } },
  })

  let registrados = 0
  let tasaConversion = 0
  try {
    const setReg = await getTelefonosRegistrados()
    const todos = await prisma.botLead.findMany({ select: { telefono: true } })
    registrados = todos.filter(l => estaRegistrado(l.telefono, setReg)).length
    tasaConversion = totalLeads > 0 ? +(registrados / totalLeads * 100).toFixed(1) : 0
  } catch {}

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
    leadsCalientes,
    registrados,
    tasaConversion,
  })
}
