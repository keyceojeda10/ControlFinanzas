// app/api/prestamos/[id]/aprobar/route.js
// El owner aprueba un préstamo pendiente de aprobación.
// Ejecuta movimientos de capital y activa el préstamo.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { registrarMovimientoCapital } from '@/lib/capital'
import { refrescarTotalesPrestamo } from '@/lib/prisma-pago-helpers'
import { logActividad } from '@/lib/activity-log'
import { enviarPush } from '@/lib/push'

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId || session.user.rol !== 'owner') {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { organizationId } = session.user
  const { id: prestamoId } = await params

  const prestamo = await prisma.prestamo.findFirst({
    where: { id: prestamoId, organizationId, estado: 'pendiente_aprobacion' },
    include: {
      cliente: { select: { id: true, nombre: true, rutaId: true } },
      pagos: { select: { id: true, montoPagado: true, tipo: true } },
    },
  })
  if (!prestamo) {
    return Response.json({ error: 'Préstamo no encontrado o ya fue procesado' }, { status: 404 })
  }

  const rutaIdCapital = prestamo.cliente?.rutaId || null
  const abonoPrevio = prestamo.pagos.find(p => p.tipo === 'completo')

  const updated = await prisma.$transaction(async (tx) => {
    const capRow = await tx.$queryRaw`
      SELECT id, saldo FROM Capital WHERE organizationId = ${organizationId} FOR UPDATE
    `
    const tieneCapital = Array.isArray(capRow) && capRow.length > 0

    await tx.prestamo.update({
      where: { id: prestamoId },
      data: { estado: 'activo' },
    })

    await tx.cliente.update({
      where: { id: prestamo.clienteId },
      data: { estado: 'activo' },
    })

    await registrarMovimientoCapital(tx, {
      organizationId,
      tipo: 'desembolso',
      monto: Number(prestamo.montoPrestado),
      descripcion: `Desembolso préstamo a ${prestamo.cliente.nombre}`,
      referenciaId: prestamoId,
      referenciaTipo: 'prestamo',
      rutaId: rutaIdCapital,
      creadoPorId: session.user.id,
    })

    if (abonoPrevio && Number(abonoPrevio.montoPagado) > 0) {
      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'recaudo',
        monto: Number(abonoPrevio.montoPagado),
        descripcion: `Abono previo préstamo en curso - ${prestamo.cliente.nombre}`,
        referenciaId: prestamoId,
        referenciaTipo: 'prestamo',
        // El desembolso de arriba SÍ la pasa y este no: mismo olvido, misma
        // función, dos llamadas seguidas.
        rutaId: rutaIdCapital,
        creadoPorId: session.user.id,
      })
    }

    return tx.prestamo.findUnique({ where: { id: prestamoId } })
  })

  logActividad({
    session,
    accion: 'aprobar_prestamo',
    entidadTipo: 'prestamo',
    entidadId: prestamoId,
    detalle: `Préstamo aprobado: $${Number(prestamo.montoPrestado).toLocaleString('es-CO')} a ${prestamo.cliente.nombre}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  enviarPush(prestamo.creadoPorId, {
    title: 'Préstamo aprobado',
    body: `Tu préstamo a ${prestamo.cliente.nombre} por $${Number(prestamo.montoPrestado).toLocaleString('es-CO')} fue aprobado.`,
    url: `/prestamos/${prestamoId}`,
  }).catch(() => {})

  return Response.json(updated)
}
