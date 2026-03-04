// app/api/clientes/[id]/historial/route.js
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params

  const cliente = await prisma.cliente.findFirst({
    where: { id, organizationId: session.user.organizationId },
  })

  if (!cliente) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  const prestamos = await prisma.prestamo.findMany({
    where: { clienteId: id },
    select: {
      id: true,
      montoPrestado: true,
      cuotaDiaria: true,
      fechaInicio: true,
      fechaFin: true,
      estado: true,
      pagos: {
        select: {
          id: true,
          montoPagado: true,
          fechaPago: true,
          tipo: true,
          cobrador: { select: { nombre: true } },
        },
        orderBy: { fechaPago: 'desc' },
      },
    },
  })

  const historial = prestamos.flatMap((p) =>
    p.pagos.map((pg) => ({
      id: pg.id,
      prestamoId: p.id,
      montoPrestamo: p.montoPrestado,
      cuotaDiaria: p.cuotaDiaria,
      fechaInicio: p.fechaInicio,
      fechaFin: p.fechaFin,
      estadoPrestamo: p.estado,
      montoPagado: pg.montoPagado,
      fechaPago: pg.fechaPago,
      tipo: pg.tipo,
      cobrador: pg.cobrador?.nombre,
    }))
  )

  historial.sort((a, b) => new Date(b.fechaPago) - new Date(a.fechaPago))

  return NextResponse.json(historial)
}
