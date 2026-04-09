// app/api/pagos/[id]/route.js — Anular pago (solo owner)
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularEstadoCliente, calcularSaldoPendiente } from '@/lib/calculos'
import { registrarMovimientoCapital } from '@/lib/capital'

// ─── PATCH /api/pagos/[id] — Editar fecha del pago (solo owner) ──
export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede editar pagos' }, { status: 403 })
  }

  const { id: pagoId } = await params
  const { organizationId } = session.user
  const { fechaPago } = await request.json()

  if (!fechaPago) {
    return Response.json({ error: 'La fecha es requerida' }, { status: 400 })
  }

  const nuevaFecha = new Date(fechaPago)
  if (isNaN(nuevaFecha.getTime())) {
    return Response.json({ error: 'Fecha inválida' }, { status: 400 })
  }

  const pago = await prisma.pago.findFirst({
    where: { id: pagoId, organizationId },
  })
  if (!pago) return Response.json({ error: 'Pago no encontrado' }, { status: 404 })

  await prisma.pago.update({
    where: { id: pagoId },
    data: { fechaPago: nuevaFecha },
  })

  return Response.json({ ok: true })
}

// ─── DELETE /api/pagos/[id] — Anular pago (solo owner) ──────────
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
    const prestamo = pago.prestamo

    // 1. Eliminar el pago
    await tx.pago.delete({ where: { id: pagoId } })

    // 1b. Si era abono a capital, reversar la reducción de totalAPagar
    // Recalcula el ahorro con la misma fórmula proporcional usada al registrarlo
    if (pago.tipo === 'capital') {
      const fechaPago = new Date(new Date(pago.fechaPago).getTime() - 5 * 60 * 60 * 1000)
      const inicio = new Date(prestamo.fechaInicio)
      const diasTrans = Math.max(0, Math.floor((fechaPago - inicio) / (1000 * 60 * 60 * 24)))
      const diasRest = Math.max(0, prestamo.diasPlazo - diasTrans)
      const mesesRest = diasRest / 30
      const ahorroInteres = Math.round(pago.montoPagado * (prestamo.tasaInteres / 100) * mesesRest)
      await tx.prestamo.update({
        where: { id: prestamo.id },
        data: { totalAPagar: prestamo.totalAPagar + ahorroInteres },
      })
    }

    // 1c. Reversar recargo: reducir totalAPagar
    if (pago.tipo === 'recargo') {
      await tx.prestamo.update({
        where: { id: prestamo.id },
        data: { totalAPagar: prestamo.totalAPagar - pago.montoPagado },
      })
    }

    // 1d. Reversar descuento: incrementar totalAPagar
    if (pago.tipo === 'descuento') {
      await tx.prestamo.update({
        where: { id: prestamo.id },
        data: { totalAPagar: prestamo.totalAPagar + pago.montoPagado },
      })
    }

    // 2. Si el préstamo estaba completado, reactivarlo
    const pagosRestantes = prestamo.pagos.filter((p) => p.id !== pagoId && !['recargo', 'descuento'].includes(p.tipo))
    const prestamoActual = await tx.prestamo.findUnique({ where: { id: prestamo.id } })
    const saldoSinPago = (prestamoActual?.totalAPagar ?? prestamo.totalAPagar) - pagosRestantes.reduce((a, p) => a + p.montoPagado, 0)

    if (prestamo.estado === 'completado' && saldoSinPago > 0) {
      await tx.prestamo.update({ where: { id: prestamo.id }, data: { estado: 'activo' } })
    }

    // 3. Recalcular estado del cliente
    const todosLosPrestamos = await tx.prestamo.findMany({
      where: { clienteId: prestamo.clienteId },
      include: { pagos: { select: { montoPagado: true, fechaPago: true, tipo: true } } },
    })
    const nuevoEstado = calcularEstadoCliente(todosLosPrestamos)
    await tx.cliente.update({ where: { id: prestamo.clienteId }, data: { estado: nuevoEstado } })

    // 4. Reversar movimiento de capital (solo pagos reales, no ajustes)
    if (!['recargo', 'descuento'].includes(pago.tipo)) {
      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'ajuste',
        monto: pago.montoPagado,
        direccion: 'egreso',
        descripcion: `Reverso pago anulado - préstamo`,
        referenciaId: prestamo.id,
        referenciaTipo: 'pago',
        creadoPorId: session.user.id,
      })
    }
  })

  return Response.json({ ok: true })
}
