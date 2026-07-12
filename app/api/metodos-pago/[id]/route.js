import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { organizationId, rol } = session.user
    if (rol === 'cobrador') {
      return Response.json({ error: 'Sin permiso' }, { status: 403 })
    }

    const { id } = await params
    const metodo = await prisma.metodoPago.findUnique({ where: { id } })

    if (!metodo || metodo.organizationId !== organizationId) {
      return Response.json({ error: 'No encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const data = {}

    if (body.nombre !== undefined) data.nombre = body.nombre.trim()
    if (body.orden !== undefined) data.orden = body.orden
    if (body.activo !== undefined) data.activo = body.activo

    const actualizado = await prisma.metodoPago.update({
      where: { id },
      data,
    })

    return Response.json(actualizado)
  } catch (err) {
    console.error('[PATCH /api/metodos-pago/[id]]', err)
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { organizationId, rol } = session.user
    if (rol === 'cobrador') {
      return Response.json({ error: 'Sin permiso' }, { status: 403 })
    }

    const { id } = await params
    const metodo = await prisma.metodoPago.findUnique({ where: { id } })

    if (!metodo || metodo.organizationId !== organizationId) {
      return Response.json({ error: 'No encontrado' }, { status: 404 })
    }

    const pagosUsando = await prisma.pago.count({ where: { metodoPagoId: id } })

    if (pagosUsando > 0) {
      await prisma.metodoPago.update({
        where: { id },
        data: { activo: false },
      })
      return Response.json({ desactivado: true })
    }

    await prisma.metodoPago.delete({ where: { id } })
    return Response.json({ eliminado: true })
  } catch (err) {
    console.error('[DELETE /api/metodos-pago/[id]]', err)
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
