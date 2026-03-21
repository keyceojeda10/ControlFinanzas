// app/api/prestamos/[id]/trasladar/route.js
// Trasladar un préstamo (con todo su historial de pagos) a otro cliente

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

  // Trasladar: cambiar clienteId del préstamo
  const actualizado = await prisma.prestamo.update({
    where: { id },
    data: { clienteId: clienteDestinoId },
  })

  return Response.json({
    ok: true,
    message: `Préstamo trasladado a ${clienteDestino.nombre}`,
    prestamo: actualizado,
  })
}
