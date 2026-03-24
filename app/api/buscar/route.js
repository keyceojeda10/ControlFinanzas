// app/api/buscar/route.js — Búsqueda global unificada (clientes, préstamos, rutas)
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buscarLimiter, getClientIp } from '@/lib/rate-limit'

export async function GET(request) {
  const rl = buscarLimiter(getClientIp(request))
  if (!rl.ok) return Response.json({ error: 'Demasiados intentos' }, { status: 429 })

  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return Response.json({ clientes: [], prestamos: [], rutas: [] })
  }

  const { organizationId, rol, rutaId } = session.user

  // Cobrador: solo ve clientes de su ruta
  const filtroRuta = rol === 'cobrador' && rutaId ? { rutaId } : {}

  const [clientes, prestamos, rutas] = await Promise.all([
    // Buscar clientes
    prisma.cliente.findMany({
      where: {
        organizationId,
        estado: { notIn: ['eliminado'] },
        ...filtroRuta,
        OR: [
          { nombre: { contains: q } },
          { cedula: { contains: q } },
          { telefono: { contains: q } },
        ],
      },
      select: {
        id: true,
        nombre: true,
        cedula: true,
        telefono: true,
        estado: true,
      },
      take: 5,
      orderBy: { nombre: 'asc' },
    }),

    // Buscar préstamos por nombre de cliente
    prisma.prestamo.findMany({
      where: {
        organizationId,
        cliente: {
          ...filtroRuta,
          OR: [
            { nombre: { contains: q } },
            { cedula: { contains: q } },
          ],
        },
      },
      select: {
        id: true,
        montoPrestado: true,
        totalAPagar: true,
        estado: true,
        cliente: { select: { nombre: true } },
        pagos: { select: { montoPagado: true, tipo: true } },
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),

    // Buscar rutas (solo owner)
    rol !== 'cobrador'
      ? prisma.ruta.findMany({
          where: {
            organizationId,
            nombre: { contains: q },
          },
          select: {
            id: true,
            nombre: true,
            _count: { select: { clientes: true } },
          },
          take: 5,
          orderBy: { nombre: 'asc' },
        })
      : [],
  ])

  // Enriquecer préstamos con saldo
  const prestamosEnriquecidos = prestamos.map((p) => {
    const totalPagado = p.pagos
      .filter((x) => !['recargo', 'descuento'].includes(x.tipo))
      .reduce((a, x) => a + x.montoPagado, 0)
    return {
      id: p.id,
      clienteNombre: p.cliente.nombre,
      montoPrestado: p.montoPrestado,
      saldoPendiente: p.totalAPagar - totalPagado,
      estado: p.estado,
    }
  })

  return Response.json({
    clientes,
    prestamos: prestamosEnriquecidos,
    rutas,
  })
}
