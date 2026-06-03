// app/api/prestamos/[id]/liquidacion/route.js
// GET: calcula el cierre/liquidacion anticipada de un prestamo y devuelve las
// dos modalidades (mes completo / proporcional) para que el prestamista elija.
// Solo lectura: NO modifica nada. El cierre real se hace por POST /pagos tipo 'liquidacion'.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularLiquidacionAnticipada } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const prestamo = await prisma.prestamo.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      pagos: { select: { montoPagado: true, tipo: true, fechaPago: true } },
      cliente: { select: { diasSinCobro: true, ruta: { select: { diasSinCobro: true } } } },
      organization: { select: { diasSinCobro: true } },
    },
  })
  if (!prestamo) {
    return Response.json({ error: 'Prestamo no encontrado' }, { status: 404 })
  }
  if (prestamo.estado !== 'activo') {
    return Response.json({ error: 'El prestamo no esta activo' }, { status: 400 })
  }

  // Dias sin cobro aplicables (cliente > ruta > org > prestamo). Devuelve array.
  let diasExcluidos = []
  try {
    diasExcluidos = obtenerDiasSinCobro(
      prestamo.cliente, prestamo.cliente?.ruta, prestamo.organization, prestamo
    ) || []
  } catch {}

  const calc = calcularLiquidacionAnticipada(prestamo, new Date(), diasExcluidos, [])
  return Response.json(calc)
}
