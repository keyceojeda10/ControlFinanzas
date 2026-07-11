import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUtcOffset, getLocalDayRange } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, id: userId } = session.user
  const url = new URL(request.url)
  const fechaParam = url.searchParams.get('fecha')
  const rutasParam = url.searchParams.get('rutas')

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { nombre: true, country: true },
  })
  const country = org?.country || 'co'
  const { start: inicio, end: fin } = getLocalDayRange(fechaParam || undefined, country)

  let rutaIds = []
  if (rutasParam) {
    rutaIds = rutasParam.split(',').filter(Boolean)
  }

  const rutaWhere = { organizationId }
  if (rol === 'cobrador') {
    rutaWhere.cobradorId = userId
  }
  if (rutaIds.length > 0) {
    rutaWhere.id = { in: rutaIds }
  }

  const rutas = await prisma.ruta.findMany({
    where: rutaWhere,
    select: { id: true, nombre: true, cobrador: { select: { id: true, nombre: true } } },
    orderBy: { nombre: 'asc' },
  })

  if (rutas.length === 0) {
    return Response.json({ error: 'No se encontraron rutas' }, { status: 404 })
  }

  const rutaIdsReal = rutas.map(r => r.id)

  const [pagosRaw, prestamosActivos, gastos] = await Promise.all([
    prisma.pago.findMany({
      where: {
        organizationId,
        fechaPago: { gte: inicio, lt: fin },
        tipo: { notIn: ['recargo', 'descuento'] },
        prestamo: { rutaId: { in: rutaIdsReal } },
      },
      select: {
        id: true,
        montoPagado: true,
        fechaPago: true,
        tipo: true,
        metodoPago: true,
        plataforma: true,
        cobrador: { select: { nombre: true } },
        prestamo: {
          select: {
            rutaId: true,
            cliente: { select: { id: true, nombre: true, cedula: true, telefono: true, direccion: true } },
          },
        },
      },
      orderBy: { fechaPago: 'asc' },
    }),
    prisma.prestamo.findMany({
      where: {
        organizationId,
        estado: 'activo',
        rutaId: { in: rutaIdsReal },
      },
      select: {
        id: true,
        rutaId: true,
        cuotaDiaria: true,
        frecuencia: true,
        fechaInicio: true,
        totalAPagar: true,
        saldoPendiente: true,
        cliente: { select: { id: true, nombre: true, cedula: true, telefono: true, direccion: true } },
      },
    }),
    prisma.gastoMenor.findMany({
      where: {
        organizationId,
        fecha: { gte: inicio, lt: fin },
        ...(rutaIdsReal.length > 0 ? { cobrador: { rutas: { some: { id: { in: rutaIdsReal } } } } } : {}),
      },
      select: {
        id: true, descripcion: true, monto: true, fecha: true, estado: true,
        cobrador: { select: { nombre: true } },
      },
      orderBy: { fecha: 'asc' },
    }),
  ])

  const pagos = pagosRaw.map(p => ({
    id: p.id,
    monto: Math.round(p.montoPagado || 0),
    hora: p.fechaPago,
    tipo: p.tipo,
    metodoPago: p.metodoPago || 'efectivo',
    plataforma: p.plataforma || null,
    cobradorNombre: p.cobrador?.nombre || null,
    rutaId: p.prestamo?.rutaId || null,
    clienteNombre: p.prestamo?.cliente?.nombre || 'Cliente',
    clienteCedula: p.prestamo?.cliente?.cedula || null,
  }))

  const clientesPagaron = new Set(pagosRaw.map(p => p.prestamo?.cliente?.id).filter(Boolean))

  const pendientes = prestamosActivos
    .filter(p => !clientesPagaron.has(p.cliente?.id))
    .map(p => ({
      clienteNombre: p.cliente?.nombre || 'Cliente',
      clienteCedula: p.cliente?.cedula || null,
      clienteTelefono: p.cliente?.telefono || null,
      clienteDireccion: p.cliente?.direccion || null,
      cuota: Math.round(p.cuotaDiaria || 0),
      saldoPendiente: Math.round(p.saldoPendiente || 0),
      rutaId: p.rutaId,
    }))

  const clientesUnicos = new Map()
  for (const p of pendientes) {
    const key = p.clienteNombre + (p.clienteCedula || '')
    if (!clientesUnicos.has(key)) {
      clientesUnicos.set(key, { ...p, cuotaTotal: p.cuota })
    } else {
      clientesUnicos.get(key).cuotaTotal += p.cuota
    }
  }

  const totalRecaudado = pagos.reduce((a, p) => a + p.monto, 0)
  const totalEsperado = prestamosActivos.reduce((a, p) => a + Math.round(p.cuotaDiaria || 0), 0)
  const totalGastos = gastos.reduce((a, g) => a + Math.round(g.monto || 0), 0)

  const porRuta = rutas.map(r => {
    const pagosRuta = pagos.filter(p => p.rutaId === r.id)
    const prestamosRuta = prestamosActivos.filter(p => p.rutaId === r.id)
    const pendientesRuta = [...clientesUnicos.values()].filter(p => p.rutaId === r.id)
    return {
      id: r.id,
      nombre: r.nombre,
      cobrador: r.cobrador?.nombre || null,
      recaudado: pagosRuta.reduce((a, p) => a + p.monto, 0),
      esperado: prestamosRuta.reduce((a, p) => a + Math.round(p.cuotaDiaria || 0), 0),
      pagosCount: pagosRuta.length,
      pendientesCount: pendientesRuta.length,
    }
  })

  return Response.json({
    fecha: (fechaParam || inicio.toISOString().slice(0, 10)),
    organizacion: org?.nombre || '',
    rutas: rutas.map(r => ({ id: r.id, nombre: r.nombre, cobrador: r.cobrador?.nombre })),
    resumen: {
      totalRecaudado,
      totalEsperado,
      totalGastos,
      disponible: totalRecaudado - totalGastos,
      tasaRecaudo: totalEsperado > 0 ? Math.round((totalRecaudado / totalEsperado) * 100) : 0,
      pagosCount: pagos.length,
      pendientesCount: clientesUnicos.size,
    },
    porRuta,
    pagos,
    pendientes: [...clientesUnicos.values()],
    gastos: gastos.map(g => ({
      descripcion: g.descripcion,
      monto: Math.round(g.monto || 0),
      estado: g.estado,
      cobradorNombre: g.cobrador?.nombre || null,
    })),
  })
}
