// app/api/capital/movimientos/[id]/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'

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

      const esIngreso = movimiento.tipo === 'ajuste'
        ? movimiento.saldoNuevo >= movimiento.saldoAnterior
        : ['capital_inicial', 'inyeccion'].includes(movimiento.tipo)
      const delta = esIngreso ? -movimiento.monto : movimiento.monto
      const nuevoSaldo = capital.saldo + delta

      if (nuevoSaldo < 0) {
        throw new Error('Eliminar este movimiento dejaría el capital en negativo')
      }

      await tx.capital.update({
        where: { id: capital.id },
        data: { saldo: nuevoSaldo },
      })
      await tx.movimientoCapital.delete({ where: { id } })
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
