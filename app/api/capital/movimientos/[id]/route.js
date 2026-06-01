// app/api/capital/movimientos/[id]/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { recalcularSaldosCapital } from '@/lib/capital'

// Solo se pueden eliminar movimientos MANUALES. Los automáticos (desembolso,
// recaudo, gasto) reflejan préstamos/pagos/gastos y deben gestionarse desde
// su propia entidad.
const TIPOS_MANUALES = ['capital_inicial', 'inyeccion', 'retiro', 'ajuste']

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede eliminar movimientos' }, { status: 403 })
  }

  const { id } = await params
  const { organizationId } = session.user

  const movimiento = await prisma.movimientoCapital.findFirst({
    where: { id, organizationId },
  })
  if (!movimiento) {
    return Response.json({ error: 'Movimiento no encontrado' }, { status: 404 })
  }

  if (!TIPOS_MANUALES.includes(movimiento.tipo)) {
    return Response.json({
      error: `No se puede eliminar un movimiento de tipo "${movimiento.tipo}". Gestiona la entidad original (préstamo, pago o gasto).`,
    }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const capital = await tx.capital.findUnique({ where: { organizationId } })
      if (!capital) throw new Error('Capital no configurado')

      await tx.movimientoCapital.delete({ where: { id } })

      const capitalRecalculado = await recalcularSaldosCapital(tx, { organizationId })
      if (capitalRecalculado.saldo < 0) {
        throw new Error('Eliminar este movimiento dejaría el capital en negativo')
      }
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 })
  }

  logActividad({
    session,
    accion: 'eliminar_movimiento_capital',
    entidadTipo: 'capital',
    entidadId: id,
    detalle: `Movimiento ${movimiento.tipo} $${movimiento.monto.toLocaleString('es-CO')} eliminado${movimiento.descripcion ? ` (${movimiento.descripcion})` : ''}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  return Response.json({ eliminado: true })
}

// PATCH — corregir el monto/descripcion de un movimiento MANUAL.
// Util cuando se escribio mal el monto (ej. 1.000.000 en vez de 10.000.000).
// Recalcula saldos global y de rutas tras el cambio.
export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede editar movimientos' }, { status: 403 })
  }

  const { id } = await params
  const { organizationId } = session.user
  const body = await request.json()
  const nuevoMonto = Number(body.monto)
  const nuevaDesc = typeof body.descripcion === 'string' ? body.descripcion.trim() : undefined

  if (!Number.isFinite(nuevoMonto) || nuevoMonto <= 0) {
    return Response.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
  }

  const movimiento = await prisma.movimientoCapital.findFirst({
    where: { id, organizationId },
  })
  if (!movimiento) {
    return Response.json({ error: 'Movimiento no encontrado' }, { status: 404 })
  }
  if (!TIPOS_MANUALES.includes(movimiento.tipo)) {
    return Response.json({
      error: `No se puede editar un movimiento de tipo "${movimiento.tipo}". Gestiona la entidad original (préstamo, pago o gasto).`,
    }, { status: 400 })
  }

  const montoAnterior = movimiento.monto

  try {
    await prisma.$transaction(async (tx) => {
      const capital = await tx.capital.findUnique({ where: { organizationId } })
      if (!capital) throw new Error('Capital no configurado')

      await tx.movimientoCapital.update({
        where: { id },
        data: {
          monto: nuevoMonto,
          ...(nuevaDesc !== undefined && { descripcion: nuevaDesc || null }),
        },
      })

      const capitalRecalculado = await recalcularSaldosCapital(tx, { organizationId })
      if (capitalRecalculado.saldo < 0) {
        throw new Error('Editar este movimiento dejaría el capital en negativo')
      }
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 })
  }

  logActividad({
    session,
    accion: 'editar_movimiento_capital',
    entidadTipo: 'capital',
    entidadId: id,
    detalle: `Movimiento ${movimiento.tipo} corregido: $${montoAnterior.toLocaleString('es-CO')} -> $${nuevoMonto.toLocaleString('es-CO')}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  return Response.json({ editado: true })
}
