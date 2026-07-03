import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { bloquearSiSuscripcionVencida } from '@/lib/suscripcion'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el owner puede ver socios' }, { status: 403 })
  }

  const { id } = await params

  const socio = await prisma.socio.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      aportes: { orderBy: { fecha: 'desc' } },
      prestamos: {
        where: { estado: { not: 'cancelado' } },
        include: {
          cliente: { select: { nombre: true } },
          pagos: {
            where: { tipo: { not: 'descuento' } },
            select: { monto: true, tipo: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  })

  if (!socio) {
    return Response.json({ error: 'Socio no encontrado' }, { status: 404 })
  }

  const totalAportes = socio.aportes.reduce((acc, a) => acc + a.monto, 0)

  const prestamosConInteres = socio.prestamos.map((p) => {
    const fraccion = p.totalAPagar > 0 ? (p.totalAPagar - p.montoPrestado) / p.totalAPagar : 0
    const interesesCobrados = Math.round((p.totalPagado || 0) * fraccion)
    const capitalCobrado = Math.round((p.totalPagado || 0) - interesesCobrados)
    return {
      id: p.id,
      clienteNombre: p.cliente?.nombre,
      montoPrestado: p.montoPrestado,
      tasaInteres: p.tasaInteres,
      totalAPagar: p.totalAPagar,
      totalPagado: p.totalPagado,
      estado: p.estado,
      frecuencia: p.frecuencia,
      modoInteres: p.modoInteres,
      fechaInicio: p.fechaInicio,
      interesesCobrados,
      capitalCobrado,
      saldoPendiente: Math.round(p.totalAPagar - (p.totalPagado || 0)),
    }
  })

  const interesesTotales = prestamosConInteres.reduce((acc, p) => acc + p.interesesCobrados, 0)

  return Response.json({
    id: socio.id,
    nombre: socio.nombre,
    cedula: socio.cedula,
    telefono: socio.telefono,
    notas: socio.notas,
    activo: socio.activo,
    createdAt: socio.createdAt,
    totalAportes: Math.round(totalAportes),
    interesesCobrados: interesesTotales,
    aportes: socio.aportes,
    prestamos: prestamosConInteres,
  })
}

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el owner puede editar socios' }, { status: 403 })
  }
  await bloquearSiSuscripcionVencida(session)

  const { id } = await params
  const body = await request.json()

  const socio = await prisma.socio.findFirst({
    where: { id, organizationId: session.user.organizationId },
  })
  if (!socio) {
    return Response.json({ error: 'Socio no encontrado' }, { status: 404 })
  }

  const data = {}
  if (body.nombre !== undefined) data.nombre = body.nombre.trim()
  if (body.cedula !== undefined) data.cedula = body.cedula?.trim() || null
  if (body.telefono !== undefined) data.telefono = body.telefono?.trim() || null
  if (body.notas !== undefined) data.notas = body.notas?.trim() || null
  if (body.activo !== undefined) data.activo = Boolean(body.activo)

  const actualizado = await prisma.socio.update({ where: { id }, data })

  logActividad({
    session,
    accion: 'editar_socio',
    entidadTipo: 'socio',
    entidadId: id,
    detalle: `Socio editado: ${actualizado.nombre}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  return Response.json(actualizado)
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el owner puede eliminar socios' }, { status: 403 })
  }

  const { id } = await params

  const socio = await prisma.socio.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: { prestamos: { where: { estado: 'activo' }, select: { id: true } } },
  })
  if (!socio) {
    return Response.json({ error: 'Socio no encontrado' }, { status: 404 })
  }
  if (socio.prestamos.length > 0) {
    return Response.json({ error: 'No se puede eliminar un socio con prestamos activos' }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.aporteSocio.deleteMany({ where: { socioId: id } }),
    prisma.socio.delete({ where: { id } }),
  ])

  logActividad({
    session,
    accion: 'eliminar_socio',
    entidadTipo: 'socio',
    entidadId: id,
    detalle: `Socio eliminado: ${socio.nombre}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  return Response.json({ ok: true })
}
