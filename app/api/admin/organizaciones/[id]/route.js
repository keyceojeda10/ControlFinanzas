// app/api/admin/organizaciones/[id]/route.js — Detalle y gestión de organización
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      users: {
        select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
      suscripciones: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, plan: true, estado: true,
          fechaInicio: true, fechaVencimiento: true, montoCOP: true,
        },
      },
      referidoPor: { select: { id: true, nombre: true } },
      referidos:   { select: { id: true, nombre: true, createdAt: true } },
      _count: {
        select: { clientes: true, prestamos: true },
      },
      adminLogs: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { admin: { select: { nombre: true } } },
      },
    },
  })

  if (!org) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  // Cartera activa
  const cartera = await prisma.prestamo.aggregate({
    where: { organizationId: id, estado: 'activo' },
    _sum: { totalAPagar: true },
    _count: true,
  })

  return NextResponse.json({
    ...org,
    prestamosActivos: cartera._count,
    carteraActiva:    cartera._sum.totalAPagar ?? 0,
  })
}

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const body   = await req.json()
  const { accion, plan } = body // accion: suspender | activar | cambiarPlan

  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  if (accion === 'suspender') {
    await prisma.organization.update({ where: { id }, data: { activo: false } })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'suspender',
        detalle:        `Organización "${org.nombre}" suspendida`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: 'Organización suspendida' })
  }

  if (accion === 'activar') {
    await prisma.organization.update({ where: { id }, data: { activo: true } })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'activar',
        detalle:        `Organización "${org.nombre}" reactivada`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: 'Organización activada' })
  }

  const PLANES_VALIDOS = ['test', 'basic', 'standard', 'professional']
  if (accion === 'cambiarPlan' && plan) {
    if (!PLANES_VALIDOS.includes(plan)) {
      return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })
    }
    const planAnterior = org.plan
    await prisma.organization.update({ where: { id }, data: { plan } })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'cambiar_plan',
        detalle:        `Plan cambiado de ${planAnterior} a ${plan}`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: `Plan cambiado a ${plan}` })
  }

  if (accion === 'cambiarDescuento') {
    const descuento = parseInt(body.descuento)
    if (isNaN(descuento) || descuento < 0 || descuento > 100) {
      return NextResponse.json({ error: 'Descuento debe ser entre 0 y 100' }, { status: 400 })
    }
    await prisma.organization.update({ where: { id }, data: { descuento } })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'cambiar_descuento',
        detalle:        `Descuento cambiado a ${descuento}% para "${org.nombre}"`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: `Descuento actualizado a ${descuento}%` })
  }

  if (accion === 'toggleUsuario' && body.userId) {
    const user = await prisma.user.findFirst({
      where: { id: body.userId, organizationId: id },
    })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const nuevoEstado = !user.activo
    await prisma.user.update({
      where: { id: body.userId },
      data: { activo: nuevoEstado },
    })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         nuevoEstado ? 'activar_usuario' : 'desactivar_usuario',
        detalle:        `Usuario "${user.nombre}" (${user.email}) ${nuevoEstado ? 'activado' : 'desactivado'}`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: `Usuario ${nuevoEstado ? 'activado' : 'desactivado'}` })
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}
