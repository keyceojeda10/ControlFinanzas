// app/api/admin/negocio/route.js — Vista de inteligencia comercial del SaaS
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { PLANES_CONFIG }    from '@/lib/planes'

const PRECIO = (plan) => PLANES_CONFIG[plan]?.precio ?? 0
const NOMBRE_PLAN = (plan) => PLANES_CONFIG[plan]?.nombre ?? plan

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const ahora = new Date()
  const hace5min   = new Date(ahora - 5  * 60 * 1000)
  const hace30min  = new Date(ahora - 30 * 60 * 1000)
  const inicioHoy  = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const inicioAyer = new Date(inicioHoy - 86400000)
  const inicioSemana = new Date(inicioHoy - (inicioHoy.getDay() === 0 ? 6 : inicioHoy.getDay() - 1) * 86400000)
  const inicioMes  = new Date(ahora.getFullYear(), ahora.getMonth(), 1)

  // Activos en tiempo real: owners con lastActivityAt reciente
  const [activosAhora, activosHoy30min, registrosHoy, registrosAyer, registrosSemana, registrosMes,
         registrosPorDia, orgs] = await Promise.all([
    // Activos últimos 5 min (prácticamente "en línea ahora")
    prisma.user.count({ where: { rol: 'owner', lastActivityAt: { gte: hace5min } } }),
    // Activos últimos 30 min
    prisma.user.count({ where: { rol: 'owner', lastActivityAt: { gte: hace30min } } }),
    // Registros de hoy
    prisma.organization.count({ where: { createdAt: { gte: inicioHoy } } }),
    // Registros de ayer
    prisma.organization.count({ where: { createdAt: { gte: inicioAyer, lt: inicioHoy } } }),
    // Registros esta semana
    prisma.organization.count({ where: { createdAt: { gte: inicioSemana } } }),
    // Registros este mes
    prisma.organization.count({ where: { createdAt: { gte: inicioMes } } }),
    // Registros por día últimos 30 días (para mini gráfico)
    prisma.$queryRaw`
      SELECT DATE(createdAt) as dia, COUNT(*) as total
      FROM Organization
      WHERE createdAt >= ${new Date(ahora - 30 * 86400000)}
      GROUP BY DATE(createdAt)
      ORDER BY dia ASC
    `,
    // Orgs completas para el análisis principal
    prisma.organization.findMany({
    where: { activo: true },
    select: {
      id:         true,
      nombre:     true,
      plan:       true,
      country:    true,
      createdAt:  true,
      users: {
        where: { rol: 'owner' },
        select: { nombre: true, email: true, telefono: true, lastLoginAt: true, lastActivityAt: true },
        take: 1,
      },
      suscripciones: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { estado: true, montoCOP: true, fechaInicio: true, fechaVencimiento: true },
      },
      _count: { select: { clientes: true, prestamos: true } },
    },
    orderBy: { createdAt: 'desc' },
  }),
  ])

  const pagantes  = []
  const trials    = []
  const muertos   = []
  const churneados = []

  let mrrTotal = 0

  for (const org of orgs) {
    const owner    = org.users[0] ?? {}
    const susc     = org.suscripciones[0] ?? null
    const clientes = org._count.clientes
    const prestamos = org._count.prestamos

    const diasDesdeRegistro = Math.floor((ahora - new Date(org.createdAt)) / 86400000)
    const ultimaActividad   = owner.lastActivityAt ?? owner.lastLoginAt ?? null
    const diasSinActividad  = ultimaActividad
      ? Math.floor((ahora - new Date(ultimaActividad)) / 86400000)
      : diasDesdeRegistro

    const esTrial    = !susc || susc.montoCOP === 0
    const esPagante  = susc && susc.montoCOP > 0 && susc.estado === 'activa'
    const esChuneado = susc && susc.estado === 'vencida' && !esTrial
    const precio     = esPagante ? (susc.montoCOP ?? PRECIO(org.plan)) : 0

    const diasRestantesTrial = susc
      ? Math.max(0, Math.ceil((new Date(susc.fechaVencimiento) - ahora) / 86400000))
      : Math.max(0, 14 - diasDesdeRegistro)

    // Score de conversión para trials (0-100)
    // Factores: clientes creados, préstamos, días en plataforma, actividad reciente
    let score = 0
    if (esTrial) {
      // Clientes: hasta 40 puntos (4+ clientes = máximo)
      score += Math.min(40, clientes * 10)
      // Préstamos: hasta 20 puntos
      score += Math.min(20, prestamos * 4)
      // Actividad reciente: hasta 30 puntos
      if (diasSinActividad <= 1)       score += 30
      else if (diasSinActividad <= 3)  score += 20
      else if (diasSinActividad <= 7)  score += 10
      else if (diasSinActividad <= 14) score += 5
      // Días en plataforma: hasta 10 puntos (más tiempo = más comprometido)
      score += Math.min(10, diasDesdeRegistro)
    }

    const base = {
      id:               org.id,
      nombre:           org.nombre,
      plan:             org.plan,
      planNombre:       NOMBRE_PLAN(org.plan),
      country:          org.country ?? 'co',
      ownerNombre:      owner.nombre ?? '',
      ownerEmail:       owner.email ?? '',
      ownerTelefono:    owner.telefono ?? '',
      clientes,
      prestamos,
      createdAt:        org.createdAt,
      diasDesdeRegistro,
      ultimaActividad,
      diasSinActividad,
      precio,
    }

    if (esPagante) {
      mrrTotal += precio
      pagantes.push({
        ...base,
        fechaInicioPago: susc.fechaInicio,
        fechaVencimiento: susc.fechaVencimiento,
        mesesPagando: Math.max(1, Math.floor(
          (ahora - new Date(susc.fechaInicio)) / (1000 * 60 * 60 * 24 * 30)
        )),
      })
    } else if (esChuneado) {
      churneados.push({
        ...base,
        fechaVencimiento: susc.fechaVencimiento,
        diasSinPagar: Math.floor((ahora - new Date(susc.fechaVencimiento)) / 86400000),
      })
    } else if (esTrial) {
      // Muerto: trial, nunca creó cliente, inactivo por más de 7 días
      const esMuerto = clientes === 0 && diasSinActividad > 7
      if (esMuerto) {
        muertos.push({ ...base, diasRestantesTrial })
      } else {
        trials.push({ ...base, score, diasRestantesTrial })
      }
    }
  }

  // Ordenar
  trials.sort((a, b) => b.score - a.score)
  pagantes.sort((a, b) => b.precio - a.precio)
  churneados.sort((a, b) => a.diasSinPagar - b.diasSinPagar) // más recientes primero

  // Proyección: qué MRR adicional si convierten los trials con score > 40
  const trialsCalientes = trials.filter(t => t.score >= 40)
  const mrrProyectado = trialsCalientes.reduce((acc, t) => acc + PRECIO(t.plan), 0)

  return NextResponse.json({
    resumen: {
      mrrActual:       mrrTotal,
      mrrProyectado:   mrrTotal + mrrProyectado,
      pagantes:        pagantes.length,
      trials:          trials.length,
      trialsCalientes: trialsCalientes.length,
      muertos:         muertos.length,
      churneados:      churneados.length,
      // Activos en tiempo real
      activosAhora,
      activosHoy30min,
      // Registros por período
      registrosHoy,
      registrosAyer,
      registrosSemana,
      registrosMes,
    },
    registrosPorDia: registrosPorDia.map(r => ({
      dia:   r.dia instanceof Date ? r.dia.toISOString().slice(0, 10) : String(r.dia),
      total: Number(r.total),
    })),
    pagantes,
    trials,
    muertos,
    churneados,
  })
}
