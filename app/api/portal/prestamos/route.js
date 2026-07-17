import { NextResponse } from 'next/server'
import { getPortalSession } from '@/lib/portal-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  const session = await getPortalSession(request)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { portalDatosCompletos: true },
  })
  const completo = org?.portalDatosCompletos ?? false

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
      estado: true,
      nombreProducto: true,
      ultimoPagoAt: true,
      tasaInteres: true,
      cuotasAmortizacion: {
        select: { cuotaTotal: true, fechaEsperada: true, numeroPeriodo: true, pagado: true },
        orderBy: { numeroPeriodo: 'asc' },
      },
      _count: { select: { pagos: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const result = prestamos.map(p => {
    const saldo = Math.max(0, p.totalAPagar - p.totalPagado)
    const porcentaje = p.totalAPagar > 0 ? Math.round((p.totalPagado / p.totalAPagar) * 100) : 0
    const proxCuota = p.cuotasAmortizacion.find(c => c.pagado < c.cuotaTotal) || null

    const base = {
      id: p.id,
      saldo,
      porcentaje,
      cuota: p.cuotaDiaria,
      frecuencia: p.frecuencia,
      estado: p.estado,
      nombreProducto: p.nombreProducto,
      ultimoPagoAt: p.ultimoPagoAt,
      totalPagos: p._count.pagos,
      proximoPago: proxCuota ? {
        fecha: proxCuota.fechaEsperada,
        monto: proxCuota.cuotaTotal,
        numero: proxCuota.numeroPeriodo,
      } : null,
    }

    if (completo) {
      base.montoPrestado = p.montoPrestado
      base.totalAPagar = p.totalAPagar
      base.totalPagado = p.totalPagado
      base.tasaInteres = p.tasaInteres
      base.fechaInicio = p.fechaInicio
      base.fechaFin = p.fechaFin
    }

    return base
  })

  return NextResponse.json(result)
}
