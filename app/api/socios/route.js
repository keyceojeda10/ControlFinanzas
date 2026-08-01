import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { interesGanado, capitalEnCalle as capitalEnCalleDe } from '@/lib/dinero/reparto'
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
            // Los dos hacen falta para `interesGanado` y `capitalEnCalle`: sin
            // la tabla un decreciente reparte plano, y sin los abonos el
            // capital no baja lo que el prestamista dijo que bajaba.
            cuotasAmortizacion: {
              orderBy: { numeroPeriodo: 'asc' },
              select: { numeroPeriodo: true, cuotaTotal: true, interes: true },
            },
            pagos: { where: { tipo: 'capital' }, select: { tipo: true, montoPagado: true } },
          },
        },
      },
      orderBy: { nombre: 'asc' },
    })

    const result = socios.map((s) => {
      // `aportes` = todo lo que suma al balance del socio: el capital que metio
      // (tipo 'aporte') MAS las utilidades que se le repartieron (tipo 'utilidad').
      // Se desglosan aparte porque no son lo mismo para el socio: una es plata que
      // puso, la otra es lo que gano y reinvirtio. El balance manda el % de
      // participacion, asi que las utilidades repartidas suben su porcentaje.
      const aportes = s.aportes.filter((a) => a.tipo !== 'retiro')
      const retiros = s.aportes.filter((a) => a.tipo === 'retiro')
      const totalAportes = aportes.reduce((acc, a) => acc + a.monto, 0)
      const totalRetiros = retiros.reduce((acc, a) => acc + a.monto, 0)
      const capitalAportado = s.aportes.filter((a) => a.tipo === 'aporte').reduce((acc, a) => acc + a.monto, 0)
      const utilidadesAsignadas = s.aportes.filter((a) => a.tipo === 'utilidad').reduce((acc, a) => acc + a.monto, 0)
      const prestamosActivos = s.prestamos.filter((p) => p.estado === 'activo')
      // Lo que del socio sigue AFUERA, no lo que salio algun dia. Con
      // `Σ montoPrestado` la tarjeta del socio decia que tenia en la calle plata
      // que el cliente ya le habia devuelto.
      const capitalEnCalle = prestamosActivos.reduce((acc, p) => acc + capitalEnCalleDe(p), 0)

      // Misma respuesta que la ficha del socio y que el reparto de utilidades.
      const interesesTotales = s.prestamos.reduce((acc, p) => acc + interesGanado(p), 0)

      return {
        id: s.id,
        nombre: s.nombre,
        cedula: s.cedula,
        telefono: s.telefono,
        notas: s.notas,
        activo: s.activo,
        createdAt: s.createdAt,
        totalAportes: Math.round(totalAportes),
        capitalAportado: Math.round(capitalAportado),
        utilidadesAsignadas: Math.round(utilidadesAsignadas),
        totalRetiros: Math.round(totalRetiros),
        balanceNeto: Math.round(totalAportes - totalRetiros),
        prestamosActivos: prestamosActivos.length,
        capitalEnCalle: Math.round(capitalEnCalle),
        interesesCobrados: interesesTotales,
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
        return Response.json({ error: 'Ya existe un socio con esa cédula' }, { status: 400 })
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
