// app/api/prestamos/[id]/trasladar/route.js
// Trasladar un préstamo (con todo su historial de pagos) a otro cliente

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularEstadoCliente } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede trasladar préstamos' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const { clienteDestinoId } = body

  if (!clienteDestinoId) {
    return Response.json({ error: 'Debes seleccionar un cliente destino' }, { status: 400 })
  }

  const orgId = session.user.organizationId

  // Verificar que el préstamo existe y pertenece a la organización
  const prestamo = await prisma.prestamo.findFirst({
    where: { id, organizationId: orgId },
  })
  if (!prestamo) {
    return Response.json({ error: 'Préstamo no encontrado' }, { status: 404 })
  }

  // Verificar que el cliente destino existe, pertenece a la org y no está eliminado
  const clienteDestino = await prisma.cliente.findFirst({
    where: { id: clienteDestinoId, organizationId: orgId, estado: { notIn: ['eliminado'] } },
  })
  if (!clienteDestino) {
    return Response.json({ error: 'Cliente destino no encontrado' }, { status: 404 })
  }

  // No trasladar al mismo cliente
  if (prestamo.clienteId === clienteDestinoId) {
    return Response.json({ error: 'El préstamo ya pertenece a este cliente' }, { status: 400 })
  }

  const clienteOrigenId = prestamo.clienteId
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { diasSinCobro: true },
  })

  // Trasladar y recalcular estados de ambos clientes en transacción
  const actualizado = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.prestamo.update({
      where: { id },
      data: { clienteId: clienteDestinoId },
    })

    // Recalcular estado de ambos clientes según sus préstamos resultantes
    for (const clienteId of [clienteOrigenId, clienteDestinoId]) {
      const prestamosCliente = await tx.prestamo.findMany({
        where: { clienteId },
        include: { pagos: { select: { montoPagado: true, fechaPago: true, tipo: true } } },
      })
      const clienteCfg = await tx.cliente.findUnique({
        where: { id: clienteId },
        select: { diasSinCobro: true, ruta: { select: { diasSinCobro: true } } },
      })
      const diasExcluidos = obtenerDiasSinCobro(clienteCfg, clienteCfg?.ruta, org)
      const nuevoEstado = calcularEstadoCliente(prestamosCliente, diasExcluidos)
      await tx.cliente.update({
        where: { id: clienteId },
        data: { estado: nuevoEstado },
      })
    }

    return nuevo
  })

  return Response.json({
    ok: true,
    message: `Préstamo trasladado a ${clienteDestino.nombre}`,
    prestamo: actualizado,
  })
}
