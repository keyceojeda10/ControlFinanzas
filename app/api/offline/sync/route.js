// app/api/offline/sync/route.js — Descarga TODOS los datos para modo offline
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularDiasMora, calcularSaldoPendiente, calcularPorcentajePagado, pagoHoy } from '@/lib/calculos'

function getColombiaDate() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const orgId = session.user.organizationId
  const userId = session.user.id
  const rol = session.user.rol
  const rutaId = session.user.rutaId

  // ── Filtro base: cobrador solo ve su ruta ──
  const clienteWhere = {
    organizationId: orgId,
    estado: { not: 'eliminado' },
    ...(rol === 'cobrador' && rutaId ? { rutaId } : {}),
  }

  // ── 1. Todos los clientes con sus préstamos y pagos ──
  const clientesRaw = await prisma.cliente.findMany({
    where: clienteWhere,
    include: {
      ruta: { select: { id: true, nombre: true } },
      prestamos: {
        orderBy: { createdAt: 'desc' },
        include: {
          pagos: {
            orderBy: { fechaPago: 'desc' },
            include: { cobrador: { select: { id: true, nombre: true } } },
          },
        },
      },
    },
    orderBy: { nombre: 'asc' },
  })

  // Enriquecer préstamos con cálculos
  const clientes = clientesRaw.map((c) => ({
    ...c,
    prestamos: c.prestamos.map((p) => ({
      ...p,
      totalPagado: p.pagos.filter(x => !['recargo', 'descuento'].includes(x.tipo)).reduce((a, x) => a + x.montoPagado, 0),
      diasMora: calcularDiasMora(p),
      saldoPendiente: calcularSaldoPendiente(p),
      porcentajePagado: calcularPorcentajePagado(p),
      pagoHoy: pagoHoy(p),
    })),
  }))

  // ── 2. Rutas ──
  const rutasRaw = await prisma.ruta.findMany({
    where: {
      organizationId: orgId,
      ...(rol === 'cobrador' && rutaId ? { id: rutaId } : {}),
    },
    include: {
      cobrador: { select: { id: true, nombre: true } },
      clientes: {
        where: { estado: { not: 'eliminado' } },
        select: { id: true, nombre: true, cedula: true, telefono: true, direccion: true, latitud: true, longitud: true, orden: true },
        orderBy: { orden: 'asc' },
      },
    },
  })

  // Calcular recaudado/esperado por ruta
  const hoy = getColombiaDate()
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const finHoy = new Date(inicioHoy.getTime() + 86400000)

  const rutas = await Promise.all(rutasRaw.map(async (r) => {
    const clienteIds = r.clientes.map(c => c.id)
    const prestamosRuta = await prisma.prestamo.findMany({
      where: { clienteId: { in: clienteIds }, estado: 'activo', organizationId: orgId },
      include: { pagos: { where: { fechaPago: { gte: inicioHoy, lt: finHoy } } } },
    })
    const esperadoHoy = prestamosRuta.reduce((s, p) => s + (p.cuotaDiaria || 0), 0)
    const recaudadoHoy = prestamosRuta.reduce((s, p) => s + p.pagos.reduce((a, pg) => a + pg.montoPagado, 0), 0)
    return { ...r, cantidadClientes: r.clientes.length, esperadoHoy, recaudadoHoy }
  }))

  // ── 3. Dashboard resumen simple ──
  const prestamosActivos = clientes.flatMap(c => c.prestamos.filter(p => p.estado === 'activo'))
  const prestamosCompletados = clientes.flatMap(c => c.prestamos.filter(p => p.estado === 'completado'))
  const clientesActivos = clientes.filter(c => c.prestamos.some(p => p.estado === 'activo'))
  const clientesEnMora = clientesActivos.filter(c => c.prestamos.some(p => p.estado === 'activo' && p.diasMora > 0))

  const dashboard = {
    clientes: { total: clientesActivos.length, enMora: clientesEnMora.length },
    prestamos: {
      activos: prestamosActivos.length,
      completados: prestamosCompletados.length,
      carteraActiva: prestamosActivos.reduce((s, p) => s + (p.saldoPendiente || 0), 0),
      capitalPrestado: prestamosActivos.reduce((s, p) => s + p.montoPrestado, 0),
      cuotaDiariaTotal: prestamosActivos.reduce((s, p) => s + (p.cuotaDiaria || 0), 0),
    },
  }

  return Response.json({
    syncedAt: new Date().toISOString(),
    clientes,
    rutas,
    dashboard,
    userId,
    rol,
  })
}
