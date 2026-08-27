import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { bloquearSiSuscripcionVencida } from '@/lib/suscripcion'
import { interesGanado, fraccionInteres, capitalEnCalle as capitalEnCalleDe } from '@/lib/dinero/reparto'
import { tieneTablaAmortizacion, interesDelPagoSegunTabla, calcularDiasMora } from '@/lib/calculos'

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
            /* ⚠ SIN ESTO UN PRÉSTAMO ABIERTO SALE «AL DÍA» SIEMPRE: su mora es el
               interés devengado sin pagar, y un campo que no se pide vale `undefined`
               —no da error, decide en silencio—. Ver lib/dinero/devengar.js. */
            devengos: { select: { periodo: true, interes: true } },
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

    /* ⚠ Y «CUÁNTO TIENE ESTE SOCIO EN LA CALLE» TENÍA DOS.
     *
     * Es el mismo cuento del interés que cuenta el comentario de arriba, con el
     * capital: la lista (`/api/socios`) ya lo arregló y esta ficha se quedó
     * sumando `montoPrestado` de TODOS los préstamos no cancelados — incluidos
     * los ya pagados y por su monto original.
     *
     * El comentario de la lista describe literalmente el fallo que seguía aquí:
     * «lo que del socio sigue AFUERA, no lo que salió algún día; con
     * `Σ montoPrestado` la tarjeta decía que tenía en la calle plata que el
     * cliente ya le había devuelto».
     *
     * Medido en producción el 27 ago 2026: 2 socios, 35 préstamos, la ficha
     * inflaba $4.533.334. Uno tiene sus DOS préstamos pagados y su ficha decía
     * $1.800.000 en la calle donde su tarjeta decía $0.
     *
     * Se calcula aquí y no en la pantalla para que haya UNA cuenta, que es lo
     * que ya se hizo con el interés. */
    const activos = socio.prestamos.filter((p) => p.estado === 'activo')
    const capitalEnCalle = Math.round(activos.reduce((acc, p) => acc + capitalEnCalleDe(p), 0))

    /* ⚠ Y «CUÁNTO TIENE EN MORA» DECÍA CERO SIEMPRE.
     *
     * La pantalla filtraba por `p.diasMora > 0` y este API NUNCA ha devuelto
     * `diasMora`: `undefined ?? 0` es 0, el filtro deja la lista vacía y la
     * tarjeta escribe «$0 en mora» tenga lo que tenga. No revienta, no avisa —
     * es la trampa del campo que no se pide, con el socio mirando la cifra.
     *
     * Va con el capital VIVO, no con `montoPrestado`, para que las dos cifras
     * de la misma tarjeta se puedan comparar: con el monto original «en mora»
     * podía salir MAYOR que «en la calle», que no significa nada. */
    const capitalEnMora = Math.round(
      activos
        .filter((p) => calcularDiasMora(p) > 0)
        .reduce((acc, p) => acc + capitalEnCalleDe(p), 0),
    )

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
      capitalEnCalle,
      capitalEnMora,
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
