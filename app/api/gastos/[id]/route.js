// app/api/gastos/[id]/route.js
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarMovimientoCapital, gastoAsentadoSinRevertir } from '@/lib/capital'
import { logActividad } from '@/lib/activity-log'

// Ruta a la que se imputa el gasto (sub-bolsa de capital): la primera ruta
// activa del cobrador. Sin esto, el gasto baja el capital global pero NO el
// saldoCapital de la ruta, y la caja del cobrador (modo capital=efectivo)
// queda sin descontar el gasto.
async function rutaDelGasto(client, organizationId, cobradorId) {
  if (!cobradorId) return null
  const ruta = await client.ruta.findFirst({
    where: { organizationId, cobradorId, activo: true },
    orderBy: { orden: 'asc' },
    select: { id: true },
  })
  return ruta?.id || null
}

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') {
    return NextResponse.json({ error: 'Solo el administrador puede aprobar/rechazar gastos' }, { status: 403 })
  }

  const { id } = params
  const body = await req.json()
  const { estado } = body

  if (!['aprobado', 'rechazado'].includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  // Verificar que el gasto pertenece a la organización del usuario
  const gastoExistente = await prisma.gastoMenor.findFirst({
    where: { id, organizationId: session.user.organizationId },
  })
  if (!gastoExistente) {
    return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })
  }

  // Guard: si ya estaba aprobado, evitar registrar segundo egreso de capital.
  if (estado === 'aprobado' && gastoExistente.estado === 'aprobado') {
    return NextResponse.json({ error: 'Este gasto ya fue aprobado' }, { status: 409 })
  }

  const rutaId = await rutaDelGasto(prisma, session.user.organizationId, gastoExistente.cobradorId)

  const gasto = await prisma.$transaction(async (tx) => {
    const gastoActualizado = await tx.gastoMenor.update({
      where: { id },
      data: { estado },
    })

    // Si se aprueba, registrar en capital
    if (estado === 'aprobado') {
      await registrarMovimientoCapital(tx, {
        organizationId: session.user.organizationId,
        tipo: 'gasto',
        monto: gastoExistente.monto,
        descripcion: `Gasto: ${gastoExistente.description}`,
        referenciaId: id,
        referenciaTipo: 'gasto',
        rutaId,
        creadoPorId: session.user.id,
        // Los gastos de ruta se pagan casi siempre en efectivo (caja del cobrador).
        metodoPago: 'efectivo',
        /* ⚠ LA FECHA DEL GASTO, NO LA DE HOY.
           Un gasto de ayer registrado hoy dejaba el gasto en el día 15 y su
           movimiento en el 16. La conciliación compara día contra día, así que
           los DOS días salían descuadrados y el prestamista no tenía forma de
           cuadrarlos. Reportado por Oswaldo Castilla: «se me olvidó cerrar
           anoche». Medido: 20 gastos así en 6 negocios, $956.000. */
        fecha: gastoExistente.fecha,
      })
    }

    // Si estaba aprobado y ahora se rechaza, reversar el egreso previo
    /* ⚠ SE LE PREGUNTA AL LIBRO, NO AL ESTADO. Ver `gastoAsentadoSinRevertir`:
       si el estado y el libro se separan, el movimiento se quedaba dentro para
       siempre y la caja de ese día no cuadraba nunca. */
    const debeDevolverAlRechazar = estado === 'rechazado'
      ? await gastoAsentadoSinRevertir(tx, session.user.organizationId, id)
      : 0
    if (debeDevolverAlRechazar > 0) {
      await registrarMovimientoCapital(tx, {
        organizationId: session.user.organizationId,
        tipo: 'ajuste',
        monto: debeDevolverAlRechazar,
        direccion: 'ingreso',
        descripcion: `Reverso gasto rechazado: ${gastoExistente.description}`,
        referenciaId: id,
        referenciaTipo: 'gasto',
        rutaId,
        creadoPorId: session.user.id,
        /* ⚠ EL DÍA DEL GASTO, no el de hoy. Anular un gasto de ayer con fecha de
           hoy deja el gasto en un día y su anulación en otro: se rompen LOS DOS
           en vez de arreglar uno. */
        fecha: gastoExistente.fecha,
      })
    }

    return gastoActualizado
  })

  return NextResponse.json(gasto)
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') {
    return NextResponse.json({ error: 'Solo el administrador puede eliminar gastos' }, { status: 403 })
  }

  const { id } = await params

  const gasto = await prisma.gastoMenor.findFirst({
    where: { id, organizationId: session.user.organizationId },
  })
  if (!gasto) {
    return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })
  }

  const rutaId = await rutaDelGasto(prisma, session.user.organizationId, gasto.cobradorId)

  await prisma.$transaction(async (tx) => {
    /* ⚠ LO QUE EL LIBRO TENGA ASENTADO, no lo que diga `estado`.
       Con `if (gasto.estado === 'aprobado')`, cualquier desajuste entre el
       estado y el libro dejaba el egreso dentro para siempre. Medido: 3 gastos
       así en 3 negocios, $2.020.000, el mayor de julio. */
    const debeDevolver = await gastoAsentadoSinRevertir(tx, session.user.organizationId, id)
    if (debeDevolver > 0) {
      await registrarMovimientoCapital(tx, {
        organizationId: session.user.organizationId,
        tipo: 'ajuste',
        monto: debeDevolver,
        descripcion: `Reverso gasto eliminado: ${gasto.description}`,
        referenciaId: id,
        referenciaTipo: 'gasto',
        rutaId,
        creadoPorId: session.user.id,
        direccion: 'ingreso',
        // El día del gasto, por lo mismo que arriba.
        fecha: gasto.fecha,
      })
    }
    await tx.gastoMenor.delete({ where: { id } })
  })

  logActividad({
    session,
    accion: 'eliminar_gasto',
    entidadTipo: 'gasto',
    entidadId: id,
    detalle: `Gasto eliminado: ${gasto.description} ($${gasto.monto.toLocaleString('es-CO')})`,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  return NextResponse.json({ eliminado: true })
}
