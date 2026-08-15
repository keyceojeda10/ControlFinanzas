import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getLocalDayRange } from '@/lib/i18n'
import { exigeNivelReportes } from '@/lib/plan-servidor'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, id: userId } = session.user

  /* Decia «Disponible desde el plan Crecimiento» mientras cerraba en
     BASICO: el mensaje mandaba al cliente a un plan mas caro del que
     necesitaba. Ahora el texto lo pone un solo sitio. */
  const veto = await exigeNivelReportes(session, 1)
  if (veto) return veto
  const url = new URL(request.url)
  const fechaParam = url.searchParams.get('fecha')
  const rutasParam = url.searchParams.get('rutas')

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { nombre: true, country: true },
  })
  const country = org?.country || 'co'
  const { inicio, fin } = getLocalDayRange(fechaParam || undefined, country)

  let rutaIds = []
  if (rutasParam) {
    rutaIds = rutasParam.split(',').filter(Boolean)
  }

  const rutaWhere = { organizationId, activo: true }
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

  /* ⚠ QUIEN NO HA CREADO NINGUNA RUTA NO SE QUEDA SIN REPORTE.
   *
   * Esto devolvia un 404 «No se encontraron rutas». Medido el 8 ago 2026:
   * 160 de 223 negocios con prestamos activos NO tienen ninguna ruta —el 72 %—,
   * asi que a la mayoria el reporte del dia le contestaba con un error. Y aun
   * teniendo rutas, el cliente que todavia no esta asignado a ninguna no salia:
   * no aparece en el papel del dia y no se le cobra.
   *
   * Es el mismo fallo que ya se corrigio en «Quien me debe» y en la cartera.
   *
   * ⚠ Los sueltos SOLO se anaden cuando el reporte no viene filtrado por rutas
   * concretas y quien pregunta NO es un cobrador: a un cobrador se le enseñan
   * sus rutas, y un cliente sin asignar no es de nadie todavia. */
  const puedeVerSueltos = rol !== 'cobrador' && rutaIds.length === 0

  if (rutas.length === 0 && !puedeVerSueltos) {
    return Response.json({ error: 'No se encontraron rutas' }, { status: 404 })
  }

  const rutaIdsReal = rutas.map(r => r.id)

  const clientesDeRutas = await prisma.cliente.findMany({
    where: {
      organizationId,
      OR: [
        { rutaId: { in: rutaIdsReal } },
        // `rutaId: null` no cubre al que esta en una ruta DESACTIVADA: esa ruta
        // no entra en `rutaIdsReal` y su gente desaparecia igual.
        ...(puedeVerSueltos ? [{ rutaId: null }, { ruta: { activo: false } }] : []),
      ],
    },
    select: { id: true, nombre: true, cedula: true, telefono: true, direccion: true, rutaId: true },
  })
  const clienteIds = clientesDeRutas.map(c => c.id)
  const clienteMap = new Map(clientesDeRutas.map(c => [c.id, c]))

  const prestamosDeClientes = await prisma.prestamo.findMany({
    where: { organizationId, clienteId: { in: clienteIds } },
    select: { id: true, clienteId: true, cuotaDiaria: true, totalAPagar: true, totalPagado: true, abonadoCapital: true, estado: true,
      cliente: { select: { id: true, nombre: true, cedula: true, telefono: true, direccion: true, rutaId: true } },
    },
  })
  const prestamoIds = prestamosDeClientes.map(p => p.id)
  const prestamosActivos = prestamosDeClientes.filter(p => p.estado === 'activo')

  const [pagosRaw, gastos] = await Promise.all([
    prisma.pago.findMany({
      where: {
        organizationId,
        prestamoId: { in: prestamoIds },
        fechaPago: { gte: inicio, lt: fin },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      select: {
        id: true,
        montoPagado: true,
        fechaPago: true,
        tipo: true,
        metodoPago: true,
        plataforma: true,
        prestamoId: true,
        cobrador: { select: { nombre: true } },
      },
      orderBy: { fechaPago: 'asc' },
    }),
    prisma.gastoMenor.findMany({
      where: {
        organizationId,
        fecha: { gte: inicio, lt: fin },
      },
      select: {
        id: true, description: true, monto: true, fecha: true, estado: true,
        cobrador: { select: { nombre: true } },
      },
      orderBy: { fecha: 'asc' },
    }),
  ])

  const prestamoMap = new Map(prestamosDeClientes.map(p => [p.id, p]))

  const pagos = pagosRaw.map(p => {
    const prest = prestamoMap.get(p.prestamoId)
    const cli = prest?.cliente
    return {
      id: p.id,
      monto: Math.round(p.montoPagado || 0),
      hora: p.fechaPago,
      tipo: p.tipo,
      metodoPago: p.metodoPago || 'efectivo',
      plataforma: p.plataforma || null,
      cobradorNombre: p.cobrador?.nombre || null,
      rutaId: cli?.rutaId || null,
      clienteNombre: cli?.nombre || 'Cliente',
      clienteCedula: cli?.cedula || null,
    }
  })

  const clientesPagaron = new Set(pagosRaw.map(p => prestamoMap.get(p.prestamoId)?.clienteId).filter(Boolean))

  const pendientes = prestamosActivos
    .filter(p => !clientesPagaron.has(p.clienteId))
    .map(p => ({
      clienteNombre: p.cliente?.nombre || 'Cliente',
      clienteCedula: p.cliente?.cedula || null,
      clienteTelefono: p.cliente?.telefono || null,
      clienteDireccion: p.cliente?.direccion || null,
      cuota: Math.round(p.cuotaDiaria || 0),
      saldoPendiente: Math.round((p.totalAPagar || 0) - (p.totalPagado || 0)),
      rutaId: p.cliente?.rutaId || null,
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

  /* «Sin ruta» se comporta como una ruta mas para que el bucle, los totales y
     el papel no tengan que saber que existe. Solo aparece si hay alguien. */
  const sueltos = puedeVerSueltos
    ? [...clientesUnicos.values()].filter((x) => !rutaIdsReal.includes(x.rutaId))
    : []
  const gruposRuta = sueltos.length
    ? [...rutas, { id: null, nombre: 'Sin ruta', cobrador: null }]
    : rutas

  /* ⚠ «Sin ruta» NO es `rutaId === null`. Quien esta en una ruta DESACTIVADA
     conserva su `rutaId` —un id de verdad— pero esa ruta no entra en la lista,
     asi que con la comparacion contra `null` se quedaba sin grupo: cargado,
     contando en los totales de arriba, y en ninguna fila de abajo. */
  const esDeEsteGrupo = (rutaIdDelCliente, r) => r.id === null
    ? !rutaIdsReal.includes(rutaIdDelCliente ?? null)
    : rutaIdDelCliente === r.id

  const porRuta = gruposRuta.map(r => {
    const pagosRuta = pagos.filter(p => esDeEsteGrupo(p.rutaId, r))
    const prestamosRuta = prestamosActivos.filter(p => esDeEsteGrupo(p.cliente?.rutaId ?? null, r))
    const pendientesRuta = [...clientesUnicos.values()].filter(p => esDeEsteGrupo(p.rutaId, r))
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
    rutas: gruposRuta.map(r => ({ id: r.id, nombre: r.nombre, cobrador: r.cobrador?.nombre })),
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
      descripcion: g.description,
      monto: Math.round(g.monto || 0),
      estado: g.estado,
      cobradorNombre: g.cobrador?.nombre || null,
    })),
  })
}
