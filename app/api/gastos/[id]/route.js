// app/api/gastos/[id]/route.js
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarMovimientoCapital } from '@/lib/capital'
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
      })
    }

    // Si estaba aprobado y ahora se rechaza, reversar el egreso previo
    if (estado === 'rechazado' && gastoExistente.estado === 'aprobado') {
      await registrarMovimientoCapital(tx, {
        organizationId: session.user.organizationId,
        tipo: 'ajuste',
        monto: gastoExistente.monto,
        direccion: 'ingreso',
        descripcion: `Reverso gasto rechazado: ${gastoExistente.description}`,
        referenciaId: id,
        referenciaTipo: 'gasto',
        rutaId,
        creadoPorId: session.user.id,
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
    // Si estaba aprobado, revertir el egreso de capital con un movimiento opuesto
    if (gasto.estado === 'aprobado') {
      await registrarMovimientoCapital(tx, {
        organizationId: session.user.organizationId,
        tipo: 'ajuste',
        monto: gasto.monto,
        descripcion: `Reverso gasto eliminado: ${gasto.description}`,
        referenciaId: id,
        referenciaTipo: 'gasto',
        rutaId,
        creadoPorId: session.user.id,
        direccion: 'ingreso',
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
