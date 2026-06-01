// app/api/rutas/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { registrarMovimientoCapital } from '@/lib/capital'
import { LIMITES_RUTAS, PLANES_CONFIG } from '@/lib/planes'
import { getUtcOffset } from '@/lib/i18n'
import { tienePeriodoEsperadoHoy } from '@/lib/calculos'
import { obtenerDiasSinCobro, esHoySinCobro, esHoyFestivo } from '@/lib/dias-sin-cobro'

const hoy = (country = 'co') => {
  const now = new Date()
  const absOffset = Math.abs(getUtcOffset(country))
  const col = new Date(now.getTime() - absOffset * 60 * 60 * 1000)
  const y = col.getUTCFullYear(), m = col.getUTCMonth(), d = col.getUTCDate()
  return new Date(Date.UTC(y, m, d, absOffset, 0, 0, 0))
}
const manana = (country = 'co') => new Date(hoy(country).getTime() + 24 * 60 * 60 * 1000)

// ─── GET /api/rutas ─────────────────────────────────────────────
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id: userId, organizationId, rol } = session.user

  // Cobrador: todas las rutas donde es el cobrador asignado
  const where = rol === 'cobrador'
    ? { organizationId, cobradorId: userId, activo: true }
    : { organizationId, activo: true }

  const rutas = await prisma.ruta.findMany({
    where,
    include: {
      cobrador: { select: { id: true, nombre: true, email: true } },
      // diasSinCobro de la ruta para resolver herencia cliente -> ruta -> org.
      // No es necesario el campo activo aqui porque ya esta en el where.
      clientes: {
        select: {
          id:        true,
          nombre:    true,
          estado:    true,
          diasSinCobro: true,
          prestamos: {
            select:  {
              estado: true,
              cuotaDiaria: true,
              frecuencia: true,
              fechaInicio: true,
              diasPlazo: true,
              diaCobroSemana: true,
              diaCobroMes: true,
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

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { diasSinCobro: true },
  })

  // TODO: festivos por organizacion. Por ahora pasamos array vacio (consistente con otros endpoints).
  const festivos = []

  const resultado = rutas.map((r) => {
    let esperadoHoy    = 0
    let recaudadoHoy   = 0

    for (const cliente of r.clientes) {
      const diasExcluidos = obtenerDiasSinCobro(cliente, r, org)
      const hoySinCobro = esHoySinCobro(diasExcluidos) || esHoyFestivo(festivos)

      for (const prestamo of cliente.prestamos) {
        // Meta: solo cuotas que TOCABA cobrar hoy (segun ciclo de frecuencia
        // y dia ancla). Antes sumaba todas las cuotas activas y inflaba la cifra.
        if (prestamo.estado === 'activo' && tienePeriodoEsperadoHoy(prestamo, hoySinCobro, diasExcluidos, festivos)) {
          esperadoHoy += prestamo.cuotaDiaria
        }
        // Recaudado hoy: incluye pagos de prestamos completados hoy (el pago final cierra)
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
  const { nombre, cobradorId, capitalInicial } = await request.json()

  if (!nombre?.trim()) return Response.json({ error: 'El nombre es requerido' }, { status: 400 })
  const capitalInicialNum = Number(capitalInicial) || 0

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

  // Capital propio de la ruta al crearla (opcional). Si no se asigna, la ruta
  // queda en modo global (saldoCapital 0) como hasta ahora.
  if (capitalInicialNum > 0) {
    await prisma.$transaction(async (tx) => {
      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'inyeccion',
        monto: capitalInicialNum,
        descripcion: `Capital inicial de la ruta ${ruta.nombre}`,
        rutaId: ruta.id,
        creadoPorId: session.user.id,
      })
    })
  }

  logActividad({ session, accion: 'crear_ruta', entidadTipo: 'ruta', entidadId: ruta.id, detalle: `Ruta "${ruta.nombre}" creada${capitalInicialNum > 0 ? ` con capital $${capitalInicialNum.toLocaleString('es-CO')}` : ''}`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  return Response.json(ruta, { status: 201 })
}
