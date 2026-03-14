import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const plan = searchParams.get('plan')
  const estado = searchParams.get('estado')
  const fechaDesde = searchParams.get('fechaDesde')
  const fechaHasta = searchParams.get('fechaHasta')
  const suscripcion = searchParams.get('suscripcion')

  const where = {}
  if (q) {
    where.OR = [
      { nombre: { contains: q } },
      { users: { some: { email: { contains: q }, rol: 'owner' } } },
      { users: { some: { nombre: { contains: q }, rol: 'owner' } } },
    ]
  }
  if (plan) where.plan = plan
  if (estado) where.estadoContacto = estado
  if (fechaDesde || fechaHasta) {
    where.createdAt = {}
    if (fechaDesde) where.createdAt.gte = new Date(fechaDesde)
    if (fechaHasta) where.createdAt.lte = new Date(fechaHasta + 'T23:59:59')
  }
  if (suscripcion === 'activa') {
    where.suscripciones = { some: { estado: 'activa' } }
  } else if (suscripcion === 'sin') {
    where.suscripciones = { none: { estado: 'activa' } }
  }

  const orgs = await prisma.organization.findMany({
    where,
    include: {
      users: {
        where: { rol: 'owner' },
        take: 1,
        select: { id: true, nombre: true, email: true, createdAt: true, emailVerificado: true }
      },
      _count: { select: { clientes: true, prestamos: true, notasSeguimiento: true } },
      suscripciones: {
        orderBy: { fechaVencimiento: 'desc' },
        take: 1,
        select: { plan: true, estado: true, fechaVencimiento: true, montoCOP: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  const data = orgs.map(org => {
    const owner = org.users[0] || null
    const sub = org.suscripciones[0] || null
    const diasDesdeRegistro = Math.floor((Date.now() - new Date(org.createdAt).getTime()) / 86400000)
    return {
      id: org.id,
      orgNombre: org.nombre,
      plan: org.plan,
      activo: org.activo,
      estadoContacto: org.estadoContacto,
      fuenteRegistro: org.fuenteRegistro,
      orgTelefono: org.telefono,
      createdAt: org.createdAt,
      diasDesdeRegistro,
      ownerNombre: owner?.nombre || null,
      ownerEmail: owner?.email || null,
      ownerEmailVerificado: owner?.emailVerificado || false,
      suscripcion: sub ? {
        plan: sub.plan,
        estado: sub.estado,
        fechaVencimiento: sub.fechaVencimiento,
        montoCOP: sub.montoCOP
      } : null,
      notasCount: org._count.notasSeguimiento,
      clientesCount: org._count.clientes,
      prestamosCount: org._count.prestamos
    }
  })

  return NextResponse.json(data)
}
