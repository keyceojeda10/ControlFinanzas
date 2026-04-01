// app/api/rutas/[id]/clientes/route.js - Asignar / quitar clientes de una ruta

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

async function verificarRuta(id, organizationId) {
  return prisma.ruta.findFirst({ where: { id, organizationId } })
}

// ─── POST /api/rutas/[id]/clientes ──────────────────────────────
// Body: { clienteIds: string[] }
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede asignar clientes a rutas' }, { status: 403 })
  }

  const { id } = await params
  const { organizationId } = session.user
  const ruta = await verificarRuta(id, organizationId)
  if (!ruta) return Response.json({ error: 'Ruta no encontrada' }, { status: 404 })

  const { clienteIds, forzar } = await request.json()
  if (!Array.isArray(clienteIds) || !clienteIds.length) {
    return Response.json({ error: 'clienteIds debe ser un array no vacío' }, { status: 400 })
  }

  // Verificar que todos los clientes pertenecen a la organización
  const clientes = await prisma.cliente.findMany({
    where: { id: { in: clienteIds }, organizationId, estado: { notIn: ['eliminado'] } },
    select: { id: true, nombre: true, rutaId: true },
  })
  if (clientes.length !== clienteIds.length) {
    return Response.json({ error: 'Uno o más clientes no son válidos' }, { status: 400 })
  }

  // Verificar si algún cliente ya está en otra ruta
  const enOtraRuta = clientes.filter((c) => c.rutaId && c.rutaId !== id)
  if (enOtraRuta.length > 0 && !forzar) {
    const nombres = enOtraRuta.map((c) => c.nombre).join(', ')
    return Response.json(
      { error: `Estos clientes ya están en otra ruta: ${nombres}. Usa la opción de mover para reasignarlos.` },
      { status: 409 }
    )
  }

  // Asignar clientes en transaccion atomica (max orden + updates juntos)
  await prisma.$transaction(async (tx) => {
    const maxOrden = await tx.cliente.aggregate({
      where: { rutaId: id, organizationId },
      _max: { ordenRuta: true },
    })
    const nextOrden = (maxOrden._max.ordenRuta ?? -1) + 1

    for (let i = 0; i < clienteIds.length; i++) {
      await tx.cliente.update({
        where: { id: clienteIds[i] },
        data: { rutaId: id, ordenRuta: nextOrden + i },
      })
    }
  })

  return Response.json({ asignados: clienteIds.length })
}

// ─── DELETE /api/rutas/[id]/clientes ────────────────────────────
// Body: { clienteId: string }
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede gestionar rutas' }, { status: 403 })
  }

  const { id } = await params
  const { organizationId } = session.user
  const ruta = await verificarRuta(id, organizationId)
  if (!ruta) return Response.json({ error: 'Ruta no encontrada' }, { status: 404 })

  const { clienteId } = await request.json()
  if (!clienteId) return Response.json({ error: 'clienteId es requerido' }, { status: 400 })

  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, organizationId, rutaId: id },
  })
  if (!cliente) return Response.json({ error: 'Cliente no encontrado en esta ruta' }, { status: 404 })

  await prisma.cliente.update({ where: { id: clienteId }, data: { rutaId: null, ordenRuta: null } })

  return Response.json({ quitado: clienteId })
}
