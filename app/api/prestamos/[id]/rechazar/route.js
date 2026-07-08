// app/api/prestamos/[id]/rechazar/route.js
// El owner rechaza un préstamo pendiente de aprobación.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { enviarPush } from '@/lib/push'

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId || session.user.rol !== 'owner') {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { organizationId } = session.user
  const { id: prestamoId } = await params
  const body = await request.json().catch(() => ({}))
  const motivo = typeof body.motivo === 'string' ? body.motivo.trim().slice(0, 500) : ''

  const prestamo = await prisma.prestamo.findFirst({
    where: { id: prestamoId, organizationId, estado: 'pendiente_aprobacion' },
    include: {
      cliente: { select: { id: true, nombre: true } },
    },
  })
  if (!prestamo) {
    return Response.json({ error: 'Préstamo no encontrado o ya fue procesado' }, { status: 404 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.pago.deleteMany({ where: { prestamoId } })
    await tx.cuotaAmortizacion.deleteMany({ where: { prestamoId } })
    await tx.prestamo.delete({ where: { id: prestamoId } })
  })

  logActividad({
    session,
    accion: 'rechazar_prestamo',
    entidadTipo: 'prestamo',
    entidadId: prestamoId,
    detalle: `Préstamo rechazado: $${Number(prestamo.montoPrestado).toLocaleString('es-CO')} a ${prestamo.cliente.nombre}${motivo ? ` — ${motivo}` : ''}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  enviarPush(prestamo.creadoPorId, {
    title: 'Préstamo rechazado',
    body: `Tu préstamo a ${prestamo.cliente.nombre} por $${Number(prestamo.montoPrestado).toLocaleString('es-CO')} fue rechazado.${motivo ? ` Motivo: ${motivo}` : ''}`,
    url: '/prestamos',
  }).catch(() => {})

  return Response.json({ ok: true })
}
