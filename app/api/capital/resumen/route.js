// app/api/capital/resumen/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador' }, { status: 403 })
  }

  const { organizationId } = session.user

  const capital = await prisma.capital.findUnique({
    where: { organizationId },
  })

  if (!capital) {
    return Response.json({ configurado: false, saldo: 0, mes: null })
  }

  // Primer día del mes actual (timezone Colombia UTC-5)
  const now = new Date()
  const colombiaOffset = -5
  const colombiaDate = new Date(now.getTime() + colombiaOffset * 60 * 60 * 1000)
  const inicioMes = new Date(Date.UTC(colombiaDate.getUTCFullYear(), colombiaDate.getUTCMonth(), 1) - colombiaOffset * 60 * 60 * 1000)

  const [desembolsos, recaudos, gastos, inyecciones, retiros] = await Promise.all([
    prisma.movimientoCapital.aggregate({
      where: { organizationId, tipo: 'desembolso', createdAt: { gte: inicioMes } },
      _sum: { monto: true },
      _count: true,
    }),
    prisma.movimientoCapital.aggregate({
      where: { organizationId, tipo: 'recaudo', createdAt: { gte: inicioMes } },
      _sum: { monto: true },
      _count: true,
    }),
    prisma.movimientoCapital.aggregate({
      where: { organizationId, tipo: 'gasto', createdAt: { gte: inicioMes } },
      _sum: { monto: true },
      _count: true,
    }),
    prisma.movimientoCapital.aggregate({
      where: { organizationId, tipo: 'inyeccion', createdAt: { gte: inicioMes } },
      _sum: { monto: true },
    }),
    prisma.movimientoCapital.aggregate({
      where: { organizationId, tipo: 'retiro', createdAt: { gte: inicioMes } },
      _sum: { monto: true },
    }),
  ])

  const desembolsado = desembolsos._sum.monto ?? 0
  const recaudado = recaudos._sum.monto ?? 0
  const gastado = gastos._sum.monto ?? 0
  const inyectado = inyecciones._sum.monto ?? 0
  const retirado = retiros._sum.monto ?? 0

  return Response.json({
    configurado: true,
    saldo: capital.saldo,
    mes: {
      desembolsado,
      recaudado,
      gastos: gastado,
      inyectado,
      retirado,
      flujoNeto: recaudado - desembolsado - gastado,
      prestamosOtorgados: desembolsos._count,
      pagosRecibidos: recaudos._count,
    },
  })
}
