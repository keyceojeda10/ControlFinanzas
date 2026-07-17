import { NextResponse } from 'next/server'
import { getPortalSession } from '@/lib/portal-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  const session = await getPortalSession(request)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const prestamos = await prisma.prestamo.findMany({
    where: {
      clienteId: session.clienteId,
      organizationId: session.organizationId,
      estado: { in: ['activo', 'completado', 'pendiente_aprobacion'] },
    },
    select: {
      id: true,
      montoPrestado: true,
      totalAPagar: true,
      totalPagado: true,
      cuotaDiaria: true,
      frecuencia: true,
      fechaInicio: true,
      fechaFin: true,
      diasPlazo: true,
      estado: true,
      nombreProducto: true,
      ultimoPagoAt: true,
      _count: { select: { pagos: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const result = prestamos.map(p => {
    const saldo = Math.max(0, p.totalAPagar - p.totalPagado)
    const porcentaje = p.totalAPagar > 0 ? Math.round((p.totalPagado / p.totalAPagar) * 100) : 0
    return {
      id: p.id,
      montoPrestado: p.montoPrestado,
      totalAPagar: p.totalAPagar,
      totalPagado: p.totalPagado,
      saldo,
      porcentaje,
      cuotaDiaria: p.cuotaDiaria,
      frecuencia: p.frecuencia,
      fechaInicio: p.fechaInicio,
      fechaFin: p.fechaFin,
      diasPlazo: p.diasPlazo,
      estado: p.estado,
      nombreProducto: p.nombreProducto,
      ultimoPagoAt: p.ultimoPagoAt,
      totalPagos: p._count.pagos,
    }
  })

  return NextResponse.json(result)
}
