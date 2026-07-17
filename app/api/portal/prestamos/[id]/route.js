import { NextResponse } from 'next/server'
import { getPortalSession } from '@/lib/portal-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request, { params }) {
  const session = await getPortalSession(request)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params

  const [prestamo, org] = await Promise.all([
    prisma.prestamo.findFirst({
      where: {
        id,
        clienteId: session.clienteId,
        organizationId: session.organizationId,
      },
      select: {
        id: true,
        montoPrestado: true,
        tasaInteres: true,
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
        modoInteres: true,
        cuotasAmortizacion: {
          select: {
            numeroPeriodo: true,
            cuotaTotal: true,
            pagado: true,
            fechaEsperada: true,
          },
          orderBy: { numeroPeriodo: 'asc' },
        },
        pagos: {
          select: {
            id: true,
            montoPagado: true,
            fechaPago: true,
            tipo: true,
            cuotaNumero: true,
          },
          orderBy: { fechaPago: 'desc' },
        },
      },
    }),
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { portalDatosCompletos: true },
    }),
  ])

  if (!prestamo) {
    return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })
  }

  const completo = org?.portalDatosCompletos ?? false

  const saldo = Math.max(0, prestamo.totalAPagar - prestamo.totalPagado)
  const porcentaje = prestamo.totalAPagar > 0
    ? Math.round((prestamo.totalPagado / prestamo.totalAPagar) * 100)
    : 0

  const cuotas = prestamo.cuotasAmortizacion.map(c => ({
    numero: c.numeroPeriodo,
    monto: c.cuotaTotal,
    pagado: c.pagado >= c.cuotaTotal,
    fechaProgramada: c.fechaEsperada,
    estado: c.pagado >= c.cuotaTotal ? 'pagada' : 'pendiente',
  }))

  const hoy = new Date()
  let diasMora = 0
  if (prestamo.estado === 'activo' && cuotas.length > 0) {
    const cuotasVencidas = cuotas.filter(c =>
      c.estado !== 'pagada' && new Date(c.fechaProgramada) < hoy
    )
    if (cuotasVencidas.length > 0) {
      diasMora = Math.floor((hoy - new Date(cuotasVencidas[0].fechaProgramada)) / (1000 * 60 * 60 * 24))
    }
  }

  let proximaCuota = null
  if (prestamo.estado === 'activo') {
    proximaCuota = cuotas.find(c => c.estado !== 'pagada') || null
  }

  const result = {
    id: prestamo.id,
    saldo,
    porcentaje,
    cuota: prestamo.cuotaDiaria,
    frecuencia: prestamo.frecuencia,
    diasPlazo: prestamo.diasPlazo,
    estado: prestamo.estado,
    nombreProducto: prestamo.nombreProducto,
    totalPagado: prestamo.totalPagado,
    ultimoPagoAt: prestamo.ultimoPagoAt,
    fechaInicio: prestamo.fechaInicio,
    fechaFin: prestamo.fechaFin,
    cuotas,
    pagos: prestamo.pagos,
    diasMora,
    proximaCuota,
  }

  if (completo) {
    result.montoPrestado = prestamo.montoPrestado
    result.totalAPagar = prestamo.totalAPagar
    result.tasaInteres = prestamo.tasaInteres
    result.modoInteres = prestamo.modoInteres
  }

  return result.id ? NextResponse.json(result) : NextResponse.json({ error: 'Error' }, { status: 500 })
}
