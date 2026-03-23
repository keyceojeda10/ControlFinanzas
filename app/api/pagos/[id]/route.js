// app/api/pagos/[id]/route.js — Anular pago (solo owner)
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularEstadoCliente, calcularSaldoPendiente } from '@/lib/calculos'

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede anular pagos' }, { status: 403 })
  }

  const { id: pagoId } = await params
  const { organizationId } = session.user

  const pago = await prisma.pago.findFirst({
    where: { id: pagoId, organizationId },
    include: {
      prestamo: {
        include: { pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } } },
      },
    },
  })

  if (!pago) return Response.json({ error: 'Pago no encontrado' }, { status: 404 })

  await prisma.$transaction(async (tx) => {
    // 1. Eliminar el pago
    await tx.pago.delete({ where: { id: pagoId } })

    // 1b. Si era abono a capital, reversar la reducción de totalAPagar
    if (pago.tipo === 'capital') {
      const ahorroInteres = Math.round(pago.montoPagado * (pago.prestamo.tasaInteres / 100))
      await tx.prestamo.update({
        where: { id: prestamo.id },
        data: { totalAPagar: prestamo.totalAPagar + ahorroInteres },
      })
    }

    // 2. Si el préstamo estaba completado, reactivarlo
    const prestamo = pago.prestamo
    const pagosRestantes = prestamo.pagos.filter((p) => p.id !== pagoId)
    const saldoSinPago = prestamo.totalAPagar - pagosRestantes.reduce((a, p) => a + p.montoPagado, 0)

    if (prestamo.estado === 'completado' && saldoSinPago > 0) {
      await tx.prestamo.update({ where: { id: prestamo.id }, data: { estado: 'activo' } })
    }

    // 3. Recalcular estado del cliente
    const todosLosPrestamos = await tx.prestamo.findMany({
      where: { clienteId: prestamo.clienteId },
      include: { pagos: { select: { montoPagado: true, fechaPago: true } } },
    })
    const nuevoEstado = calcularEstadoCliente(todosLosPrestamos)
    await tx.cliente.update({ where: { id: prestamo.clienteId }, data: { estado: nuevoEstado } })
  })

  return Response.json({ ok: true })
}
