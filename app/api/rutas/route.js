// app/api/rutas/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { LIMITES_RUTAS, PLANES_CONFIG } from '@/lib/planes'

// Funciones de fecha en timezone Colombia (UTC-5)
// Medianoche Colombia = 05:00 UTC
const hoy = () => {
  const now = new Date()
  const col = new Date(now.getTime() - 5 * 60 * 60 * 1000)
  const y = col.getUTCFullYear(), m = col.getUTCMonth(), d = col.getUTCDate()
  return new Date(Date.UTC(y, m, d, 5, 0, 0, 0))
}
const manana = () => new Date(hoy().getTime() + 24 * 60 * 60 * 1000)

// ─── GET /api/rutas ─────────────────────────────────────────────
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, rutaId } = session.user

  // Cobrador sin ruta asignada no debe ver rutas de la organización
  if (rol === 'cobrador' && !rutaId) {
    return Response.json([])
  }

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

  const { organizationId, plan } = session.user
  const { nombre, cobradorId } = await request.json()

  if (!nombre?.trim()) return Response.json({ error: 'El nombre es requerido' }, { status: 400 })

  // Verificar límite de rutas del plan
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { rutasExtra: true },
  })
  const limiteBase = LIMITES_RUTAS[plan] ?? 1
  const limite = limiteBase + (org?.rutasExtra ?? 0)
  const totalRutas = await prisma.ruta.count({ where: { organizationId, activo: true } })
  if (totalRutas >= limite) {
    const puedeComprar = PLANES_CONFIG[plan]?.rutaExtra > 0
    return Response.json(
      { error: `Has alcanzado el límite de ${limite} ruta${limite > 1 ? 's' : ''} de tu plan ${PLANES_CONFIG[plan]?.nombre || plan}. ${puedeComprar ? 'Puedes comprar una ruta adicional.' : 'Actualiza tu plan para más rutas.'}`, limitReached: true, plan },
      { status: 403 }
    )
  }

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

  logActividad({ session, accion: 'crear_ruta', entidadTipo: 'ruta', entidadId: ruta.id, detalle: `Ruta "${ruta.nombre}" creada`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  return Response.json(ruta, { status: 201 })
}
