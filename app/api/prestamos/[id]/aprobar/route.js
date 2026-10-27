// app/api/prestamos/[id]/aprobar/route.js
// El owner aprueba un préstamo pendiente de aprobación.
// Ejecuta movimientos de capital y activa el préstamo.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { registrarMovimientoCapital, asegurarCapital } from '@/lib/capital'
import { abonoPrevioDe } from '@/lib/dinero/abono-previo'
import { refrescarTotalesPrestamo } from '@/lib/prisma-pago-helpers'
import { logActividad } from '@/lib/activity-log'
import { notificar, plata } from '@/lib/notificar'

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
      pagos: { select: { id: true, montoPagado: true, tipo: true, nota: true } },
    },
  })
  if (!prestamo) {
    return Response.json({ error: 'Préstamo no encontrado o ya fue procesado' }, { status: 404 })
  }

  /* ⚠ SIN CUENTA, LA PLATA CAE EN «SIN REGISTRAR». `resolverKey` (lib/capital.js)
     manda a ese cubo todo movimiento con `metodoPago` en NULL, y aquí no lo
     pasaba NINGUNO de los dos —ni el desembolso—. Desde el 27 oct 2026 la
     cuenta que eligió el cobrador se guarda con la solicitud
     (`Prestamo.cuentaDesembolso`) y sale por ella; la pendiente de antes, sin
     cuenta, va en efectivo, el defecto del resto del sistema. Medido en
     producción: cero préstamos han pasado por aprobación hasta hoy. */
  const CUENTA_AL_APROBAR = prestamo.cuentaDesembolso || 'efectivo'
  const CUENTA_ID_AL_APROBAR = CUENTA_AL_APROBAR === 'transferencia' ? (prestamo.cuentaDesembolsoId || null) : null

  const rutaIdCapital = prestamo.cliente?.rutaId || null
  /* ⚠ POR LA NOTA, NO POR EL TIPO. Buscarlo por `tipo === 'completo'` cogía el
     primer cobro normal del préstamo si ya tenía alguno, y dejaría de
     encontrarlo el día que el abono se pueda marcar como capital o interés.
     `esAbonoPrevio` es el único sitio que decide esto — ver lib/dinero/abono-previo.js. */
  const abonoPrevio = abonoPrevioDe(prestamo)

  // La fila del capital antes de la transacción: dentro, dos a la vez se traban (`asegurarCapital`).
  await asegurarCapital(prisma, organizationId)
  const updated = await prisma.$transaction(async (tx) => {
    const capRow = await tx.$queryRaw`
      SELECT id, saldo FROM Capital WHERE organizationId = ${organizationId} FOR UPDATE
    `
    const tieneCapital = Array.isArray(capRow) && capRow.length > 0

    /* Si el abono previo ya cubre el total, se aprueba COMPLETADO, igual que al
       crearlo sin aprobación (DETALLES-PRESTAMOS #70). */
    const saldoAlAprobar = Math.round((Number(prestamo.totalAPagar) || 0) - (Number(prestamo.totalPagado) || 0))
    /* ⚠ EL PRÉSTAMO NACE EL DÍA QUE SE APRUEBA (27 oct 2026). Mientras espera
       no cuenta en ninguna caja ni informe (todos dejan fuera
       `pendiente_aprobacion`), y la plata sale de la mano del cobrador cuando
       se lo aprueban. Con el `createdAt` de la solicitud, uno pedido ayer y
       aprobado hoy salía en la caja de AYER por su monto (sin asiento ese día)
       y en la de HOY por su asiento: dos veces. */
    await tx.prestamo.update({
      where: { id: prestamoId },
      data: {
        estado: abonoPrevio && saldoAlAprobar <= 0 ? 'completado' : 'activo',
        createdAt: new Date(),
        cuentaDesembolso: null,
        cuentaDesembolsoId: null,
      },
    })

    await tx.cliente.update({
      where: { id: prestamo.clienteId },
      data: { estado: 'activo' },
    })

    await registrarMovimientoCapital(tx, {
      organizationId,
      tipo: 'desembolso',
      // El seguro no toca la plata: sale el monto completo (ver api/prestamos).
      monto: Number(prestamo.montoPrestado),
      descripcion: `Desembolso préstamo a ${prestamo.cliente.nombre}`,
      referenciaId: prestamoId,
      referenciaTipo: 'prestamo',
      rutaId: rutaIdCapital,
      creadoPorId: session.user.id,
      metodoPago: CUENTA_AL_APROBAR,
      metodoPagoId: CUENTA_ID_AL_APROBAR,
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
        metodoPago: CUENTA_AL_APROBAR,
        metodoPagoId: CUENTA_ID_AL_APROBAR,
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

  notificar({
    organizationId, para: prestamo.creadoPorId, tipo: 'prestamo_aprobado',
    titulo: 'Te aprobaron el préstamo',
    mensaje: `Ya puedes entregarle ${plata(prestamo.montoPrestado)} a ${prestamo.cliente.nombre}.`,
    href: `/prestamos/${prestamoId}`, datos: { prestamoId },
  })

  return Response.json(updated)
}
