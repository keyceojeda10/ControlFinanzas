import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { bloquearSiSuscripcionVencida } from '@/lib/suscripcion'
import { interesGanado, fraccionInteres } from '@/lib/dinero/reparto'
import { tieneTablaAmortizacion, interesDelPagoSegunTabla } from '@/lib/calculos'

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
              where: { tipo: { notIn: ['descuento', 'recargo'] } },
              select: { montoPagado: true, tipo: true, fechaPago: true },
              orderBy: { fechaPago: 'desc' },
            },
            // Sin la tabla, el interes de un decreciente sale repartido plano y
            // esta pantalla contradice al reparto de utilidades, que si la lee.
            cuotasAmortizacion: {
              orderBy: { numeroPeriodo: 'asc' },
              select: { numeroPeriodo: true, cuotaTotal: true, interes: true },
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

    // "Cuanto interes ha producido este socio" tenia TRES respuestas: esta, la de
    // la lista (/api/socios) y la del reparto de utilidades — y solo la ultima
    // leia la tabla de amortizacion. Las tres salen ya de lib/dinero/reparto.js.
    const prestamosConInteres = socio.prestamos.map((p) => {
      const interesesCobrados = interesGanado(p)

      // El desglose por anio se recorre pago a pago. Con tabla, cada pago vale
      // lo que la tabla le reconozca —el primer periodo pesa mucho mas que el
      // ultimo—; sin tabla, su parte proporcional.
      const conTabla = tieneTablaAmortizacion(p)
      const fraccion = fraccionInteres(p)
      const enOrden = (p.pagos ?? [])
        .filter(pg => !['recargo', 'descuento', 'capital'].includes(pg.tipo))
        .slice()
        .sort((a, b) => new Date(a.fechaPago) - new Date(b.fechaPago))

      const interesesPorAnio = {}
      let acumulado = 0
      for (const pg of enOrden) {
        const monto = pg.montoPagado ?? 0
        const intPago = conTabla
          ? interesDelPagoSegunTabla(p.cuotasAmortizacion, acumulado, monto)
          : Math.round(monto * fraccion)
        acumulado += monto
        const anio = new Date(pg.fechaPago).getFullYear()
        interesesPorAnio[anio] = (interesesPorAnio[anio] || 0) + intPago
      }

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
        interesesPorAnio,
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
          return Response.json({ error: 'Ya existe un socio con esa cédula' }, { status: 400 })
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
      prisma.prestamo.updateMany({ where: { socioId: id }, data: { socioId: null } }),
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
