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

  const ruta = await prisma.ruta.findFirst({
    where: { id, organizationId },
    select: { id: true, cobradorId: true },
  })
  if (!ruta) return Response.json({ error: 'Ruta no encontrada' }, { status: 404 })

  // Clientes en esta ruta con sus cuotas
  const clientes = await prisma.cliente.findMany({
    where: { rutaId: id, organizationId },
    select: {
      id: true,
      nombre: true,
      prestamos: {
        where: { estado: 'activo' },
        select: { id: true, cuotaDiaria: true },
      },
    },
  })
  const clienteIds = clientes.map(c => c.id)
  const clienteMap = Object.fromEntries(clientes.map(c => [c.id, {
    nombre: c.nombre,
    cuota: c.prestamos.reduce((a, p) => a + p.cuotaDiaria, 0),
  }]))
  const prestamoClienteMap = {}
  for (const c of clientes) {
    for (const p of c.prestamos) {
      prestamoClienteMap[p.id] = c.id
    }
  }

  if (clienteIds.length === 0) {
    return Response.json({ dias: [] })
  }

  // Pagos últimos 30 días
  const hace30 = new Date()
  hace30.setDate(hace30.getDate() - 30)

  const pagos = await prisma.pago.findMany({
    where: {
      organizationId,
      prestamo: { clienteId: { in: clienteIds } },
      fechaPago: { gte: hace30 },
      tipo: { notIn: ['recargo', 'descuento'] },
    },
    select: {
      montoPagado: true,
      fechaPago: true,
      tipo: true,
      prestamoId: true,
    },
    orderBy: { fechaPago: 'desc' },
  })

  // Agrupar por día Colombia
  const porDia = {}
  for (const p of pagos) {
    const col = new Date(p.fechaPago.getTime() - 5 * 60 * 60 * 1000)
    const key = col.toISOString().slice(0, 10)
    if (!porDia[key]) porDia[key] = { cobrado: 0, clientes: {} }
    porDia[key].cobrado += p.montoPagado

    const clienteId = prestamoClienteMap[p.prestamoId]
    if (clienteId) {
      if (!porDia[key].clientes[clienteId]) {
        porDia[key].clientes[clienteId] = { monto: 0, tipo: p.tipo }
      }
      porDia[key].clientes[clienteId].monto += p.montoPagado
    }
  }

  const dias = Object.keys(porDia)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 15)
    .map(fecha => {
      const dia = porDia[fecha]
      // Lista de quién pagó
      const pagaron = Object.entries(dia.clientes).map(([cId, info]) => ({
        nombre: clienteMap[cId]?.nombre || 'Cliente',
        monto: Math.round(info.monto),
        tipo: info.tipo,
      })).sort((a, b) => b.monto - a.monto)

      // Lista de quién NO pagó (clientes con cuota > 0 que no aparecen)
      const noPagaron = clientes
        .filter(c => c.prestamos.length > 0 && !dia.clientes[c.id])
        .map(c => clienteMap[c.id].nombre)

      return {
        fecha,
        cobrado: Math.round(dia.cobrado),
        pagaron,
        noPagaron,
        totalClientes: clientes.filter(c => c.prestamos.length > 0).length,
      }
    })

  return Response.json({ dias })
}
