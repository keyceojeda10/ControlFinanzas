import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { bloquearSiSuscripcionVencida } from '@/lib/suscripcion'

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (session.user.rol !== 'owner') {
      return Response.json({ error: 'Solo el owner puede ver socios' }, { status: 403 })
    }

    const orgId = session.user.organizationId

    const socios = await prisma.socio.findMany({
      where: { organizationId: orgId },
      include: {
        aportes: { orderBy: { fecha: 'desc' } },
        prestamos: {
          where: { estado: { not: 'cancelado' }, organizationId: orgId },
          select: {
            id: true,
            montoPrestado: true,
            tasaInteres: true,
            totalAPagar: true,
            totalPagado: true,
            estado: true,
            frecuencia: true,
            modoInteres: true,
            fechaInicio: true,
            cliente: { select: { nombre: true } },
          },
        },
      },
      orderBy: { nombre: 'asc' },
    })

    const result = socios.map((s) => {
      const totalAportes = s.aportes.reduce((acc, a) => acc + a.monto, 0)
      const prestamosActivos = s.prestamos.filter((p) => p.estado === 'activo')
      const capitalEnCalle = prestamosActivos.reduce((acc, p) => acc + p.montoPrestado, 0)

      let interesesTotales = 0
      for (const p of s.prestamos) {
        const fraccion = p.totalAPagar > 0 ? (p.totalAPagar - p.montoPrestado) / p.totalAPagar : 0
        interesesTotales += Math.round((p.totalPagado || 0) * fraccion)
      }

      return {
        id: s.id,
        nombre: s.nombre,
        cedula: s.cedula,
        telefono: s.telefono,
        notas: s.notas,
        activo: s.activo,
        createdAt: s.createdAt,
        totalAportes: Math.round(totalAportes),
        prestamosActivos: prestamosActivos.length,
        capitalEnCalle: Math.round(capitalEnCalle),
        interesesCobrados: interesesTotales,
        prestamos: s.prestamos,
        aportes: s.aportes,
      }
    })

    return Response.json(result)
  } catch (e) {
    console.error('[GET /api/socios] error:', e)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (session.user.rol !== 'owner') {
      return Response.json({ error: 'Solo el owner puede crear socios' }, { status: 403 })
    }
    const bloqueoSub = await bloquearSiSuscripcionVencida(session)
    if (bloqueoSub) return bloqueoSub

    const body = await request.json()
    const { nombre, cedula, telefono, notas } = body

    if (!nombre?.trim()) {
      return Response.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const orgId = session.user.organizationId

    if (cedula?.trim()) {
      const existe = await prisma.socio.findFirst({
        where: { organizationId: orgId, cedula: cedula.trim() },
      })
      if (existe) {
        return Response.json({ error: 'Ya existe un socio con esa cedula' }, { status: 400 })
      }
    }

    const socio = await prisma.socio.create({
      data: {
        organizationId: orgId,
        nombre: nombre.trim(),
        cedula: cedula?.trim() || null,
        telefono: telefono?.trim() || null,
        notas: notas?.trim() || null,
      },
    })

    logActividad({
      session,
      accion: 'crear_socio',
      entidadTipo: 'socio',
      entidadId: socio.id,
      detalle: `Socio creado: ${socio.nombre}`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })

    return Response.json(socio, { status: 201 })
  } catch (e) {
    console.error('[POST /api/socios] error:', e)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
