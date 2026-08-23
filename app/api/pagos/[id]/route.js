// app/api/pagos/[id]/route.js — Anular pago (solo owner)
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularEstadoCliente, calcularSaldoPendiente } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { getUtcOffset } from '@/lib/i18n'
import { registrarMovimientoCapital } from '@/lib/capital'
import { sincronizarTabla } from '@/lib/dinero/tabla-sync'
import { refrescarTotalesPrestamo } from '@/lib/prisma-pago-helpers'
import { logActividad } from '@/lib/activity-log'

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

  const fechaAnterior = pago.fechaPago

  await prisma.$transaction(async (tx) => {
    await tx.pago.update({
      where: { id: pagoId },
      data: { fechaPago: nuevaFecha },
    })

    // Refrescar ultimoPagoAt (la fecha cambio).
    await refrescarTotalesPrestamo(tx, pago.prestamoId)

    // Y la tabla: cambiar la FECHA de un pago cambia el orden de la cascada
    // —la cuota mas antigua se cubre primero— asi que el reparto sobre las
    // cuotas puede quedar distinto. Tampoco se tocaba aqui.
    await sincronizarTabla(tx, pago.prestamoId)

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

  logActividad({
    session,
    accion: 'editar_pago',
    entidadTipo: 'pago',
    entidadId: pagoId,
    detalle: `Fecha de pago cambiada de ${new Date(fechaAnterior).toISOString()} a ${nuevaFecha.toISOString()} (préstamo ${pago.prestamoId})`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
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
        include: {
          pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
          cliente: { select: { rutaId: true } },
        },
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

  try {
    await prisma.$transaction(async (tx) => {
    const prestamo = pago.prestamo

    // 1. Eliminar el pago
    await tx.pago.delete({ where: { id: pagoId } })

    // 1b. Refrescar totalPagado/ultimoPagoAt despues de borrar.
    await refrescarTotalesPrestamo(tx, pago.prestamoId)

    // 1b. Si era abono a capital, reversar la reducción de totalAPagar
    // Debe replicar EXACTAMENTE la formula del POST (pagos/route.js) para que
    // el totalAPagar regrese al valor exacto antes del abono.
    // POST usa: ahora = new Date(Date.now() - 5h); inicio = new Date(fechaInicio).
    // Aqui usamos pago.fechaPago con la misma resta de 5h — asi `diasTrans` coincide.
    if (pago.tipo === 'capital') {
      const fechaPagoColombia = new Date(new Date(pago.fechaPago).getTime() - Math.abs(getUtcOffset(session.user.country ?? 'co')) * 60 * 60 * 1000)
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

    // ── 1e. LA TABLA, AL DIA CON LOS PAGOS QUE QUEDAN ──────────────────────
    //
    // Esto NO estaba, y es el fallo que mas filas malas genera hoy.
    //
    // Registrar un pago si actualizaba la tabla de amortizacion. Borrarlo no.
    // Asi que en un prestamo con tabla —Decreciente, Globo, Sobre saldo— las
    // cuotas quedaban marcadas como si el pago siguiera ahi, y nada las volvia
    // a tocar nunca. La mora, el proximo cobro y el desglose de interes salen
    // de esa tabla: los tres se quedaban mintiendo.
    //
    // Medido: los reversos de pago pasaron de 17 en abril a 258 en julio —ocho
    // al dia— y los prestamos desincronizados que hay son TODOS de julio.
    //
    // Va DESPUES de refrescar totales y de reversar el abono, porque recalcula
    // a partir de lo que hay ahora.
    await sincronizarTabla(tx, prestamo.id)

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
    // rutaId del cliente: el reverso debe descontar de la MISMA sub-bolsa de
    // ruta donde el pago original sumo capital. Sin esto, el saldoCapital de la
    // ruta no baja y la caja del cobrador (modo capital=efectivo) deja el monto
    // anulado como "fantasma".
    const rutaIdReverso = prestamo.cliente?.rutaId || null
    if (!['recargo', 'descuento'].includes(pago.tipo)) {
      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'ajuste',
        monto: pago.montoPagado,
        direccion: 'egreso',
        descripcion: `Reverso pago anulado - préstamo`,
        referenciaId: prestamo.id,
        referenciaTipo: 'pago',
        rutaId: rutaIdReverso,
        /* ⚠ POR LA MISMA CUENTA POR LA QUE ENTRÓ.
           Iba sin cuenta, y sin cuenta el libro lo trata como efectivo: anular
           un cobro por Nequi le bajaba el efectivo al cobrador y le dejaba un
           faltante de caja que no existía. También descuadraba la vista de
           «Cuentas», que reparte por aquí. */
        metodoPago: pago.metodoPago || null,
        metodoPagoId: pago.metodoPagoId || null,
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
        rutaId: rutaIdReverso,
        creadoPorId: session.user.id,
      })
    }
    })
  } catch (err) {
    // La transaccion hace rollback automatico, pero el cliente recibia un 500
    // generico sin saber que update fallo. Loggeamos detalle + dejamos rastro
    // en ActividadLog para que soporte pueda investigar al recibir queja.
    console.error('[DELETE /api/pagos/[id]]', {
      pagoId,
      tipoOriginal: pago.tipo,
      organizationId,
      userId,
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 5).join('\n'),
    })
    logActividad({
      session,
      accion: 'anular_pago_fallo',
      entidadTipo: 'pago',
      entidadId: pagoId,
      detalle: `Fallo al anular pago (${pago.tipo}): ${err.message}`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })
    return Response.json({
      error: 'No se pudo anular el pago. El equipo de soporte fue notificado.',
    }, { status: 500 })
  }

  logActividad({
    session,
    accion: 'anular_pago',
    entidadTipo: 'pago',
    entidadId: pagoId,
    detalle: `Anuló pago de ${pago.montoPagado} (${pago.tipo}) del préstamo ${pago.prestamoId}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  return Response.json({ ok: true })
}
