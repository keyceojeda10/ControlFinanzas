import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { bloquearSiSuscripcionVencida } from '@/lib/suscripcion'

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (session.user.rol !== 'owner') {
      return Response.json({ error: 'Solo el owner puede ver socios' }, { status: 403 })
    }

    const { id } = await params
    const orgId = session.user.organizationId

    const socio = await prisma.socio.findFirst({
      where: { id, organizationId: orgId },
      include: {
        aportes: { orderBy: { fecha: 'desc' } },
        prestamos: {
          where: { estado: { not: 'cancelado' }, organizationId: orgId },
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

    const aportesArr = socio.aportes.filter((a) => a.tipo !== 'retiro')
    const retirosArr = socio.aportes.filter((a) => a.tipo === 'retiro')
    const totalAportes = aportesArr.reduce((acc, a) => acc + a.monto, 0)
    const totalRetiros = retirosArr.reduce((acc, a) => acc + a.monto, 0)

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
      totalRetiros: Math.round(totalRetiros),
      balanceNeto: Math.round(totalAportes - totalRetiros),
      interesesCobrados: interesesTotales,
      aportes: socio.aportes,
      prestamos: prestamosConInteres,
    })
  } catch (e) {
    console.error('[GET /api/socios/[id]] error:', e)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (session.user.rol !== 'owner') {
      return Response.json({ error: 'Solo el owner puede editar socios' }, { status: 403 })
    }
    const bloqueoSub = await bloquearSiSuscripcionVencida(session)
    if (bloqueoSub) return bloqueoSub

    const { id } = await params
    const orgId = session.user.organizationId
    const body = await request.json()

    const socio = await prisma.socio.findFirst({
      where: { id, organizationId: orgId },
    })
    if (!socio) {
      return Response.json({ error: 'Socio no encontrado' }, { status: 404 })
    }

    const data = {}
    if (typeof body.nombre === 'string') data.nombre = body.nombre.trim()
    if (body.cedula !== undefined) {
      const nuevaCedula = typeof body.cedula === 'string' ? body.cedula.trim() : null
      if (nuevaCedula && nuevaCedula !== socio.cedula) {
        const existe = await prisma.socio.findFirst({
          where: { organizationId: orgId, cedula: nuevaCedula, id: { not: id } },
        })
        if (existe) {
          return Response.json({ error: 'Ya existe un socio con esa cedula' }, { status: 400 })
        }
      }
      data.cedula = nuevaCedula || null
    }
    if (body.telefono !== undefined) data.telefono = typeof body.telefono === 'string' ? body.telefono.trim() || null : null
    if (body.notas !== undefined) data.notas = typeof body.notas === 'string' ? body.notas.trim() || null : null
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
  } catch (e) {
    console.error('[PATCH /api/socios/[id]] error:', e)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (session.user.rol !== 'owner') {
      return Response.json({ error: 'Solo el owner puede eliminar socios' }, { status: 403 })
    }

    const { id } = await params
    const orgId = session.user.organizationId

    const socio = await prisma.socio.findFirst({
      where: { id, organizationId: orgId },
      include: {
        prestamos: {
          where: { estado: { in: ['activo', 'completado'] } },
          select: { id: true, estado: true },
        },
      },
    })
    if (!socio) {
      return Response.json({ error: 'Socio no encontrado' }, { status: 404 })
    }
    const activos = socio.prestamos.filter((p) => p.estado === 'activo')
    if (activos.length > 0) {
      return Response.json({ error: 'No se puede eliminar un socio con prestamos activos' }, { status: 400 })
    }
    const completados = socio.prestamos.filter((p) => p.estado === 'completado')
    if (completados.length > 0) {
      return Response.json({ error: 'Este socio tiene prestamos completados. Si lo eliminas se pierde el historial de intereses. Desactivalo en vez de eliminarlo.' }, { status: 400 })
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
  } catch (e) {
    console.error('[DELETE /api/socios/[id]] error:', e)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
