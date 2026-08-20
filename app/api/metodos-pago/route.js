import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DEFAULTS = [
  { nombre: 'Nequi', orden: 0 },
  { nombre: 'Daviplata', orden: 1 },
  { nombre: 'Bancolombia', orden: 2 },
]

async function asegurarDefaults(organizationId) {
  const existentes = await prisma.metodoPago.count({ where: { organizationId } })
  if (existentes > 0) return

  await prisma.metodoPago.createMany({
    data: DEFAULTS.map(d => ({
      organizationId,
      nombre: d.nombre,
      orden: d.orden,
      esPredeterminado: true,
    })),
    skipDuplicates: true,
  })
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { organizationId } = session.user

    await asegurarDefaults(organizationId)

    const metodos = await prisma.metodoPago.findMany({
      where: { organizationId, activo: true },
      orderBy: { orden: 'asc' },
      select: { id: true, nombre: true, orden: true, esPredeterminado: true, esDelCobrador: true },
    })

    return Response.json(metodos)
  } catch (err) {
    console.error('[GET /api/metodos-pago]', err)
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { organizationId, rol } = session.user
    if (rol === 'cobrador') {
      return Response.json({ error: 'Sin permiso' }, { status: 403 })
    }

    const { nombre, esDelCobrador } = await request.json()
    if (!nombre?.trim()) {
      return Response.json({ error: 'Nombre requerido' }, { status: 400 })
    }

    const existe = await prisma.metodoPago.findUnique({
      where: { organizationId_nombre: { organizationId, nombre: nombre.trim() } },
    })
    if (existe) {
      if (!existe.activo) {
        const reactivado = await prisma.metodoPago.update({
          where: { id: existe.id },
          data: { activo: true },
        })
        return Response.json(reactivado)
      }
      return Response.json({ error: 'Ya existe un metodo con ese nombre' }, { status: 409 })
    }

    const maxOrden = await prisma.metodoPago.aggregate({
      where: { organizationId },
      _max: { orden: true },
    })

    const metodo = await prisma.metodoPago.create({
      data: {
        organizationId,
        nombre: nombre.trim(),
        orden: (maxOrden._max.orden ?? -1) + 1,
        esDelCobrador: Boolean(esDelCobrador),
      },
    })

    return Response.json(metodo, { status: 201 })
  } catch (err) {
    console.error('[POST /api/metodos-pago]', err)
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
