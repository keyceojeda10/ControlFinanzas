// app/api/pagos/[id]/route.js — Anular pago (solo owner)
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularEstadoCliente, calcularSaldoPendiente } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
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
    include: { prestamo: { select: { clienteId: true } } },
  })
  if (!pago) return Response.json({ error: 'Pago no encontrado' }, { status: 404 })

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { diasSinCobro: true },
  })

  await prisma.$transaction(async (tx) => {
    await tx.pago.update({
      where: { id: pagoId },
      data: { fechaPago: nuevaFecha },
    })

    // Recalcular estado del cliente: cambiar la fecha de un pago altera los
    // dias de mora del prestamo, y por lo tanto el estado agregado del cliente.
    const clienteId = pago.prestamo.clienteId
    const todosLosPrestamos = await tx.prestamo.findMany({
      where: { clienteId },
      include: { pagos: { select: { montoPagado: true, fechaPago: true, tipo: true } } },
    })
    const clienteCfg = await tx.cliente.findUnique({
      where: { id: clienteId },
      select: { diasSinCobro: true, ruta: { select: { diasSinCobro: true } } },
    })
    const diasExcluidos = obtenerDiasSinCobro(clienteCfg, clienteCfg?.ruta, org)
    const nuevoEstado = calcularEstadoCliente(todosLosPrestamos, diasExcluidos)
    await tx.cliente.update({ where: { id: clienteId }, data: { estado: nuevoEstado } })
  })

  return Response.json({ ok: true })
}

// ─── DELETE /api/pagos/[id] — Anular pago (solo owner) ──────────
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  const { id: pagoId } = await params
  const { organizationId, rol, id: userId } = session.user

  const pago = await prisma.pago.findFirst({
    where: { id: pagoId, organizationId },
    include: {
      prestamo: {
        include: { pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } } },
      },
    },
  })

  if (!pago) return Response.json({ error: 'Pago no encontrado' }, { status: 404 })

  // Cobradores pueden deshacer sus propios pagos dentro de 10 minutos.
  // Usa createdAt (no fechaPago): si el owner edita fechaPago a una fecha
  // reciente, el cobrador NO debe poder anular pagos antiguos.
  if (rol !== 'owner') {
    const esSuPago = pago.cobradorId === userId
    const minutos = (Date.now() - new Date(pago.createdAt).getTime()) / 60000
    if (!esSuPago || minutos > 10) {
      return Response.json({ error: 'Solo puedes deshacer tus pagos recientes (hasta 10 min)' }, { status: 403 })
    }
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { diasSinCobro: true },
  })

  await prisma.$transaction(async (tx) => {
    const prestamo = pago.prestamo

    // 1. Eliminar el pago
    await tx.pago.delete({ where: { id: pagoId } })

    // 1b. Si era abono a capital, reversar la reducción de totalAPagar
    // Debe replicar EXACTAMENTE la formula del POST (pagos/route.js) para que
    // el totalAPagar regrese al valor exacto antes del abono.
    // POST usa: ahora = new Date(Date.now() - 5h); inicio = new Date(fechaInicio).
    // Aqui usamos pago.fechaPago con la misma resta de 5h — asi `diasTrans` coincide.
    if (pago.tipo === 'capital') {
      const fechaPagoColombia = new Date(new Date(pago.fechaPago).getTime() - 5 * 60 * 60 * 1000)
      const inicio = new Date(prestamo.fechaInicio)
      const diasTrans = Math.max(0, Math.floor((fechaPagoColombia - inicio) / (1000 * 60 * 60 * 24)))
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
    const clienteCfg = await tx.cliente.findUnique({
      where: { id: prestamo.clienteId },
      select: { diasSinCobro: true, ruta: { select: { diasSinCobro: true } } },
    })
    const diasExcluidos = obtenerDiasSinCobro(clienteCfg, clienteCfg?.ruta, org)
    const nuevoEstado = calcularEstadoCliente(todosLosPrestamos, diasExcluidos)
    await tx.cliente.update({ where: { id: prestamo.clienteId }, data: { estado: nuevoEstado } })

    // 4. Reversar movimiento de capital
    // Pagos reales (completo, parcial, capital): se registro recaudo (ingreso) → reverso con egreso
    // Descuento: se registro ajuste egreso → reverso con ingreso
    // Recargo: no toca capital
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
    } else if (pago.tipo === 'descuento') {
      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'ajuste',
        monto: pago.montoPagado,
        direccion: 'ingreso',
        descripcion: `Reverso descuento anulado - préstamo`,
        referenciaId: prestamo.id,
        referenciaTipo: 'pago',
        creadoPorId: session.user.id,
      })
    }
  })

  return Response.json({ ok: true })
}
