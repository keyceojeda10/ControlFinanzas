// app/api/caja/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

// Funciones de fecha en timezone Colombia (UTC-5)
const getColombiaDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000)
const inicioHoy    = () => { const d = getColombiaDate(); d.setHours(0,0,0,0); return d }
const inicioManana = () => { const d = getColombiaDate(); d.setDate(d.getDate()+1); d.setHours(0,0,0,0); return d }

// Calcula el total esperado del día para un cobrador
// (suma de cuotaDiaria de todos los préstamos activos de los clientes de su ruta)
async function calcularEsperado(organizationId, cobradorId) {
  const ruta = await prisma.ruta.findFirst({
    where: { organizationId, cobradorId, activo: true },
    select: {
      clientes: {
        select: {
          prestamos: {
            where:  { estado: 'activo' },
            select: { cuotaDiaria: true },
          },
        },
      },
    },
  })

  if (!ruta) return 0
  return ruta.clientes.reduce(
    (total, c) => total + c.prestamos.reduce((a, p) => a + p.cuotaDiaria, 0), 0
  )
}

// ─── GET /api/caja ──────────────────────────────────────────────
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, id: userId } = session.user
  const { searchParams } = new URL(request.url)
  const fechaParam    = searchParams.get('fecha')
  const cobradorParam = searchParams.get('cobradorId')

  let fechaInicio = inicioHoy()
  let fechaFin    = inicioManana()

  if (fechaParam) {
    fechaInicio = new Date(fechaParam)
    fechaInicio.setHours(0,0,0,0)
    fechaFin    = new Date(fechaParam)
    fechaFin.setDate(fechaFin.getDate() + 1)
    fechaFin.setHours(0,0,0,0)
  }

  const where = {
    organizationId,
    fecha: { gte: fechaInicio, lt: fechaFin },
    ...(rol === 'cobrador' && { cobradorId: userId }),
    ...(rol === 'owner' && cobradorParam && { cobradorId: cobradorParam }),
  }

  const cierres = await prisma.cierreCaja.findMany({
    where,
    include: {
      cobrador: { select: { id: true, nombre: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return Response.json(cierres)
}

// ─── POST /api/caja ─────────────────────────────────────────────
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, id: userId } = session.user
  const body = await request.json()

  // Owner puede registrar cierre para cualquier cobrador; cobrador para sí mismo
  const cobradorId = rol === 'owner' ? (body.cobradorId ?? userId) : userId

  // Verificar que el cobrador pertenece a la organización
  const cobrador = await prisma.user.findFirst({
    where: { id: cobradorId, organizationId },
  })
  if (!cobrador) return Response.json({ error: 'Cobrador no encontrado' }, { status: 404 })

  // Solo un cierre por cobrador por día
  const existeCierre = await prisma.cierreCaja.findFirst({
    where: {
      organizationId,
      cobradorId,
      fecha: { gte: inicioHoy(), lt: inicioManana() },
    },
  })
  if (existeCierre) {
    return Response.json({ error: 'Ya existe un cierre de caja para hoy' }, { status: 409 })
  }

  const totalRecogido = Number(body.totalRecogido ?? 0)
  if (totalRecogido < 0) {
    return Response.json({ error: 'El total recogido no puede ser negativo' }, { status: 400 })
  }

  const totalEsperado = await calcularEsperado(organizationId, cobradorId)
  const diferencia    = totalRecogido - totalEsperado

  const cierre = await prisma.cierreCaja.create({
    data: {
      organizationId,
      cobradorId,
      fecha:         new Date(),
      totalEsperado: Math.round(totalEsperado),
      totalRecogido: Math.round(totalRecogido),
      diferencia:    Math.round(diferencia),
    },
    include: { cobrador: { select: { id: true, nombre: true } } },
  })

  return Response.json(cierre, { status: 201 })
}
