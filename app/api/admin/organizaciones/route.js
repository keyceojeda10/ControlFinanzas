// app/api/admin/organizaciones/route.js — Lista de organizaciones
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const busqueda = searchParams.get('q')       ?? ''
  const plan     = searchParams.get('plan')     ?? ''
  const estado   = searchParams.get('estado')   ?? '' // activa, suspendida

  const fechaDesde = searchParams.get('desde') ?? ''
  const fechaHasta = searchParams.get('hasta') ?? ''

  const where = { AND: [] }

  // Búsqueda por nombre de org, email de usuario o teléfono de usuario
  if (busqueda && busqueda.trim()) {
    const q = busqueda.trim()
    where.AND.push({
      OR: [
        { nombre: { contains: q } },
        { users: { some: { email: { contains: q } } } },
        { users: { some: { nombre: { contains: q } } } },
      ],
    })
  }

  if (plan)     where.AND.push({ plan })
  if (estado === 'activa')     where.AND.push({ activo: true })
  if (estado === 'suspendida') where.AND.push({ activo: false })

  // Filtro por fecha de registro (UTC-safe: margen amplio)
  if (fechaDesde) {
    where.AND.push({ createdAt: { gte: new Date(fechaDesde + 'T00:00:00.000Z') } })
  }
  if (fechaHasta) {
    const siguiente = new Date(fechaHasta + 'T00:00:00.000Z')
    siguiente.setDate(siguiente.getDate() + 1)
    where.AND.push({ createdAt: { lt: siguiente } })
  }

  // Si no hay filtros, quitar AND vacío
  if (where.AND.length === 0) delete where.AND

  const orgs = await prisma.organization.findMany({
    where,
    include: {
      users: {
        select: { email: true, nombre: true },
        where: { rol: 'owner' },
        take: 1,
      },
      _count: {
        select: {
          users:     true,
          clientes:  true,
          prestamos: true,
        },
      },
      suscripciones: {
        orderBy: { fechaVencimiento: 'desc' },
        take: 1,
        select: {
          id: true,
          plan: true,
          estado: true,
          fechaVencimiento: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const resultado = orgs.map((o) => {
    const sub = o.suscripciones[0]
    const ahora = new Date()
    let diasRestantes = null
    if (sub?.fechaVencimiento) {
      diasRestantes = Math.ceil((new Date(sub.fechaVencimiento) - ahora) / (1000 * 60 * 60 * 24))
    }

    const owner = o.users?.[0]
    return {
      id:              o.id,
      nombre:          o.nombre,
      ownerEmail:      owner?.email ?? '',
      ownerNombre:     owner?.nombre ?? '',
      plan:            o.plan,
      activo:          o.activo,
      createdAt:       o.createdAt,
      usuarios:        o._count.users,
      clientes:        o._count.clientes,
      prestamosActivos: o._count.prestamos,
      suscripcion:     sub ? {
        id:               sub.id,
        estado:           sub.estado,
        fechaVencimiento: sub.fechaVencimiento,
        diasRestantes,
      } : null,
    }
  })

  return NextResponse.json(resultado)
}
