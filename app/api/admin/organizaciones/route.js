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

  const where = {}
  if (busqueda) where.nombre = { contains: busqueda }
  if (plan)     where.plan   = plan
  if (estado === 'activa')    where.activo = true
  if (estado === 'suspendida') where.activo = false

  const orgs = await prisma.organization.findMany({
    where,
    include: {
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

    return {
      id:              o.id,
      nombre:          o.nombre,
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
