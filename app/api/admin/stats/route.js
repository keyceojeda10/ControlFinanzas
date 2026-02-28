// app/api/admin/stats/route.js — Métricas globales de la plataforma
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

const PRECIOS = { basic: 80000, standard: 150000, professional: 250000 }

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const ahora = new Date()
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const en7Dias   = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [
    orgsPorPlan,
    totalOrgs,
    orgsNuevas,
    totalClientes,
    prestamosActivos,
    cartera,
    suscVencidas,
    suscPorVencer,
    // MRR histórico (últimos 6 meses)
    orgsAll,
  ] = await Promise.all([
    // Orgs activas por plan
    prisma.organization.groupBy({
      by: ['plan'],
      where: { activo: true },
      _count: true,
    }),
    prisma.organization.count({ where: { activo: true } }),
    prisma.organization.count({
      where: { activo: true, createdAt: { gte: inicioMes } },
    }),
    prisma.cliente.count(),
    prisma.prestamo.count({ where: { estado: 'activo' } }),
    prisma.prestamo.aggregate({
      where: { estado: 'activo' },
      _sum: { totalAPagar: true },
    }),
    // Suscripciones vencidas
    prisma.suscripcion.count({
      where: { estado: 'vencida' },
    }),
    // Suscripciones por vencer en 7 días
    prisma.suscripcion.count({
      where: { estado: 'activa', fechaVencimiento: { lte: en7Dias, gte: ahora } },
    }),
    // Todas las orgs con fecha de creación para MRR histórico
    prisma.organization.findMany({
      where: { activo: true },
      select: { plan: true, createdAt: true },
    }),
  ])

  // Calcular MRR
  const planes = {}
  for (const g of orgsPorPlan) {
    planes[g.plan] = g._count
  }
  const mrr = (planes.basic ?? 0) * PRECIOS.basic
            + (planes.standard ?? 0) * PRECIOS.standard
            + (planes.professional ?? 0) * PRECIOS.professional

  // MRR histórico: últimos 6 meses
  const mrrHistorico = []
  for (let i = 5; i >= 0; i--) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
    const label = fecha.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
    // Contar orgs que existían en esa fecha
    let mrrMes = 0
    for (const org of orgsAll) {
      if (new Date(org.createdAt) <= new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0)) {
        mrrMes += PRECIOS[org.plan] ?? 0
      }
    }
    mrrHistorico.push({ mes: label, mrr: mrrMes })
  }

  return NextResponse.json({
    mrr,
    totalOrgs,
    orgsNuevas,
    suscVencidas,
    suscPorVencer,
    planes: {
      basic:        { cantidad: planes.basic ?? 0,        mrr: (planes.basic ?? 0) * PRECIOS.basic },
      standard:     { cantidad: planes.standard ?? 0,     mrr: (planes.standard ?? 0) * PRECIOS.standard },
      professional: { cantidad: planes.professional ?? 0, mrr: (planes.professional ?? 0) * PRECIOS.professional },
    },
    totalClientes,
    prestamosActivos,
    carteraTotal: cartera._sum.totalAPagar ?? 0,
    mrrHistorico,
  })
}
