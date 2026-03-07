// app/api/rutas/[id]/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularDiasMora } from '@/lib/calculos'

// Funciones de fecha en timezone Colombia (UTC-5)
const getColombiaDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000)
const hoy    = () => { const d = getColombiaDate(); d.setHours(0,0,0,0); return d }
const manana = () => { const d = getColombiaDate(); d.setDate(d.getDate()+1); d.setHours(0,0,0,0); return d }

// ─── GET /api/rutas/[id] ────────────────────────────────────────
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const { organizationId, rol, rutaId } = session.user

  // Cobrador solo puede ver su propia ruta
  if (rol === 'cobrador' && id !== rutaId) {
    return Response.json({ error: 'No tienes acceso a esta ruta' }, { status: 403 })
  }

  const ruta = await prisma.ruta.findFirst({
    where: { id, organizationId },
    include: {
      cobrador: { select: { id: true, nombre: true, email: true } },
      clientes: {
        include: {
          prestamos: {
            where:   { estado: 'activo' },
            include: {
              pagos: {
                select:  { montoPagado: true, fechaPago: true },
                orderBy: { fechaPago: 'desc' },
              },
            },
          },
        },
        orderBy: { nombre: 'asc' },
      },
    },
  })

  if (!ruta) return Response.json({ error: 'Ruta no encontrada' }, { status: 404 })

  // Calcular métricas del día
  let esperadoHoy  = 0
  let recaudadoHoy = 0
  let pendientesHoy = 0
  let enMora = 0

  const clientesEnriquecidos = ruta.clientes.map((c) => {
    let cuotaCliente = 0
    let pagadoHoy    = 0
    let mora         = 0

    for (const p of c.prestamos) {
      cuotaCliente  += p.cuotaDiaria
      esperadoHoy   += p.cuotaDiaria
      const pagosHoy = p.pagos.filter(
        (pg) => new Date(pg.fechaPago) >= hoy() && new Date(pg.fechaPago) < manana()
      )
      const montoPagadoHoy = pagosHoy.reduce((a, pg) => a + pg.montoPagado, 0)
      pagadoHoy    += montoPagadoHoy
      recaudadoHoy += montoPagadoHoy
      mora = Math.max(mora, calcularDiasMora(p))
    }

    const yaPageHoy = pagadoHoy > 0
    if (!yaPageHoy && c.prestamos.length > 0) pendientesHoy++
    if (mora > 0) enMora++

    return {
      id:       c.id,
      nombre:   c.nombre,
      cedula:   c.cedula,
      estado:   c.estado,
      pagoHoy:  yaPageHoy,
      diasMora: mora,
    }
  })

  // Cierre de caja del día
  const cierre = await prisma.cierreCaja.findFirst({
    where: {
      organizationId,
      cobradorId: ruta.cobradorId ?? undefined,
      fecha:      { gte: hoy(), lt: manana() },
    },
  })

  return Response.json({
    id:          ruta.id,
    nombre:      ruta.nombre,
    cobrador:    ruta.cobrador,
    clientes:    clientesEnriquecidos,
    esperadoHoy: Math.round(esperadoHoy),
    recaudadoHoy: Math.round(recaudadoHoy),
    pendientesHoy,
    enMora,
    cierre,
  })
}

// ─── PATCH /api/rutas/[id] ──────────────────────────────────────
export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede modificar rutas' }, { status: 403 })
  }

  const { id } = await params
  const ruta = await prisma.ruta.findFirst({
    where: { id, organizationId: session.user.organizationId },
  })
  if (!ruta) return Response.json({ error: 'Ruta no encontrada' }, { status: 404 })

  const { nombre, cobradorId } = await request.json()

  const actualizada = await prisma.ruta.update({
    where: { id },
    data: {
      ...(nombre      !== undefined && { nombre:      nombre.trim()   }),
      ...(cobradorId  !== undefined && { cobradorId:  cobradorId || null }),
    },
    include: { cobrador: { select: { id: true, nombre: true } } },
  })

  return Response.json(actualizada)
}
