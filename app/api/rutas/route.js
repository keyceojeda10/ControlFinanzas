// app/api/rutas/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

// Funciones de fecha en timezone Colombia (UTC-5)
const getColombiaDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000)
const hoy    = () => { const d = getColombiaDate(); d.setHours(0,0,0,0); return d }
const manana = () => { const d = getColombiaDate(); d.setDate(d.getDate()+1); d.setHours(0,0,0,0); return d }

// ─── GET /api/rutas ─────────────────────────────────────────────
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, rutaId } = session.user

  // Cobrador: solo su ruta
  const where = rol === 'cobrador' && rutaId
    ? { id: rutaId, organizationId }
    : { organizationId, activo: true }

  const rutas = await prisma.ruta.findMany({
    where,
    include: {
      cobrador: { select: { id: true, nombre: true, email: true } },
      clientes: {
        select: {
          id:        true,
          nombre:    true,
          estado:    true,
          prestamos: {
            where:   { estado: 'activo' },
            select:  {
              cuotaDiaria: true,
              pagos: {
                where:  { fechaPago: { gte: hoy(), lt: manana() } },
                select: { montoPagado: true, tipo: true },
              },
            },
          },
        },
      },
    },
    orderBy: { nombre: 'asc' },
  })

  const resultado = rutas.map((r) => {
    let esperadoHoy    = 0
    let recaudadoHoy   = 0

    for (const cliente of r.clientes) {
      for (const prestamo of cliente.prestamos) {
        esperadoHoy  += prestamo.cuotaDiaria
        recaudadoHoy += prestamo.pagos.filter(p => !['recargo', 'descuento'].includes(p.tipo)).reduce((a, p) => a + p.montoPagado, 0)
      }
    }

    return {
      id:              r.id,
      nombre:          r.nombre,
      cobrador:        r.cobrador,
      cantidadClientes: r.clientes.length,
      esperadoHoy:     Math.round(esperadoHoy),
      recaudadoHoy:    Math.round(recaudadoHoy),
    }
  })

  return Response.json(resultado)
}

// ─── POST /api/rutas ────────────────────────────────────────────
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede crear rutas' }, { status: 403 })
  }

  const { organizationId } = session.user
  const { nombre, cobradorId } = await request.json()

  if (!nombre?.trim()) return Response.json({ error: 'El nombre es requerido' }, { status: 400 })

  // Verificar cobrador si se envía
  if (cobradorId) {
    const cobrador = await prisma.user.findFirst({
      where: { id: cobradorId, organizationId, rol: 'cobrador' },
    })
    if (!cobrador) return Response.json({ error: 'Cobrador no válido' }, { status: 400 })
  }

  const ruta = await prisma.ruta.create({
    data: {
      organizationId,
      nombre:    nombre.trim(),
      cobradorId: cobradorId || null,
    },
  })

  return Response.json(ruta, { status: 201 })
}
