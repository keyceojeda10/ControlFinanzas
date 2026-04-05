// app/api/rutas/[id]/historial/route.js
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const { organizationId, rol, rutaId } = session.user

  if (rol === 'cobrador' && id !== rutaId) {
    return Response.json({ error: 'No tienes acceso' }, { status: 403 })
  }

  // Verificar que la ruta existe y pertenece a la org
  const ruta = await prisma.ruta.findFirst({
    where: { id, organizationId },
    select: { id: true, cobradorId: true },
  })
  if (!ruta) return Response.json({ error: 'Ruta no encontrada' }, { status: 404 })

  // Obtener IDs de clientes en esta ruta
  const clientes = await prisma.cliente.findMany({
    where: { rutaId: id, organizationId },
    select: { id: true },
  })
  const clienteIds = clientes.map(c => c.id)

  if (clienteIds.length === 0) {
    return Response.json({ dias: [] })
  }

  // Pagos de los últimos 30 días de préstamos activos de estos clientes
  const hace30 = new Date()
  hace30.setDate(hace30.getDate() - 30)

  const pagos = await prisma.pago.findMany({
    where: {
      organizationId,
      prestamo: { clienteId: { in: clienteIds }, estado: 'activo' },
      fechaPago: { gte: hace30 },
      tipo: { notIn: ['recargo', 'descuento'] },
    },
    select: { montoPagado: true, fechaPago: true },
    orderBy: { fechaPago: 'desc' },
  })

  // Cierres de caja del cobrador de esta ruta (últimos 30 días)
  const cierres = ruta.cobradorId
    ? await prisma.cierreCaja.findMany({
        where: {
          organizationId,
          cobradorId: ruta.cobradorId,
          fecha: { gte: hace30 },
        },
        select: {
          fecha: true,
          totalEsperado: true,
          totalRecogido: true,
          diferencia: true,
        },
        orderBy: { fecha: 'desc' },
      })
    : []

  // Agrupar pagos por día Colombia (UTC-5)
  const porDia = {}
  for (const p of pagos) {
    const col = new Date(p.fechaPago.getTime() - 5 * 60 * 60 * 1000)
    const key = col.toISOString().slice(0, 10) // YYYY-MM-DD Colombia
    if (!porDia[key]) porDia[key] = { fecha: key, cobrado: 0, pagos: 0 }
    porDia[key].cobrado += p.montoPagado
    porDia[key].pagos += 1
  }

  // Index cierres por fecha
  const cierresPorDia = {}
  for (const c of cierres) {
    const col = new Date(c.fecha.getTime() - 5 * 60 * 60 * 1000)
    const key = col.toISOString().slice(0, 10)
    cierresPorDia[key] = {
      esperado: Math.round(c.totalEsperado),
      entregado: Math.round(c.totalRecogido),
      diferencia: Math.round(c.diferencia),
    }
  }

  // Merge — incluir días con pagos O con cierre
  const allDays = new Set([...Object.keys(porDia), ...Object.keys(cierresPorDia)])
  const hoyCol = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const dias = Array.from(allDays)
    .filter(d => d !== hoyCol) // excluir hoy (ya se muestra arriba)
    .sort((a, b) => b.localeCompare(a)) // más reciente primero
    .slice(0, 15) // máximo 15 días
    .map(fecha => ({
      fecha,
      cobrado: Math.round(porDia[fecha]?.cobrado || 0),
      pagos: porDia[fecha]?.pagos || 0,
      cierre: cierresPorDia[fecha] || null,
    }))

  return Response.json({ dias })
}
