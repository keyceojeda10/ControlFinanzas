// app/api/admin/negocio/route.js — Vista de inteligencia comercial del SaaS
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { PLANES_CONFIG }    from '@/lib/planes'

const PRECIO = (plan) => PLANES_CONFIG[plan]?.precio ?? 0
const NOMBRE_PLAN = (plan) => PLANES_CONFIG[plan]?.nombre ?? plan

const EMAILS_INTERNOS = ['keycejob@gmail.com', 'ccaojd@gmail.com', 'owner@test.com', 'controlfinanzasgmail@gmail.com']
const sinInternos = { email: { notIn: EMAILS_INTERNOS } }

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const ahora = new Date()
  const hace15min  = new Date(ahora - 15 * 60 * 1000)
  const hace30min  = new Date(ahora - 30 * 60 * 1000)
  const inicioHoy  = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const inicioAyer = new Date(inicioHoy - 86400000)
  const inicioSemana = new Date(inicioHoy - (inicioHoy.getDay() === 0 ? 6 : inicioHoy.getDay() - 1) * 86400000)
  const inicioMes  = new Date(ahora.getFullYear(), ahora.getMonth(), 1)

  // Activos en tiempo real: owners con lastActivityAt reciente (excluye internos)
  const [activosAhora, activosHoy30min, registrosHoy, registrosAyer, registrosSemana, registrosMes,
         registrosPorDia, orgs] = await Promise.all([
    // Activos últimos 15 min
    prisma.user.count({ where: { rol: 'owner', lastActivityAt: { gte: hace15min }, ...sinInternos } }),
    // Activos últimos 30 min
    prisma.user.count({ where: { rol: 'owner', lastActivityAt: { gte: hace30min }, ...sinInternos } }),
    prisma.organization.count({ where: { createdAt: { gte: inicioHoy },              users: { none: { email: { in: EMAILS_INTERNOS } } } } }),
    prisma.organization.count({ where: { createdAt: { gte: inicioAyer, lt: inicioHoy }, users: { none: { email: { in: EMAILS_INTERNOS } } } } }),
    prisma.organization.count({ where: { createdAt: { gte: inicioSemana },            users: { none: { email: { in: EMAILS_INTERNOS } } } } }),
    prisma.organization.count({ where: { createdAt: { gte: inicioMes },               users: { none: { email: { in: EMAILS_INTERNOS } } } } }),
    // Registros por día últimos 30 días (emails internos excluidos por join)
    prisma.$queryRaw`
      SELECT DATE(o.createdAt) as dia, COUNT(*) as total
      FROM Organization o
      WHERE o.createdAt >= ${new Date(ahora - 30 * 86400000)}
        AND o.id NOT IN (
          SELECT u.organizationId FROM User u
          WHERE u.email IN (${EMAILS_INTERNOS[0]}, ${EMAILS_INTERNOS[1]}, ${EMAILS_INTERNOS[2]}, ${EMAILS_INTERNOS[3]})
            AND u.organizationId IS NOT NULL
        )
      GROUP BY DATE(o.createdAt)
      ORDER BY dia ASC
    `,
    // Orgs completas para el análisis principal
    prisma.organization.findMany({
    where: { activo: true, users: { none: { email: { in: EMAILS_INTERNOS } } } },
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
        where: { OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }] },
        orderBy: { createdAt: 'desc' },
        select: { estado: true, montoCOP: true, fechaInicio: true, fechaVencimiento: true, createdAt: true },
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
    const suscs    = org.suscripciones ?? []
    // La suscripción vigente es la más reciente sin mpStatus pending
    const susc     = suscs[0] ?? null
    // Primera suscripción con pago real (para calcular antigüedad de pago)
    const primerPago = [...suscs].reverse().find(s => s.montoCOP > 0) ?? null
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
    // Calibrado con datos reales: pagantes tienen mediana 53 clientes, 72 préstamos,
    // 0 días sin actividad. El factor #1 es frecuencia de uso (se loguean diario).
    // Para ser "caliente" (>=60) se REQUIERE actividad reciente + datos reales.
    let score = 0
    if (esTrial) {
      // Actividad reciente: hasta 45 pts — sin esto es imposible llegar a 60
      if (diasSinActividad <= 1)       score += 45
      else if (diasSinActividad <= 2)  score += 35
      else if (diasSinActividad <= 3)  score += 25
      else if (diasSinActividad <= 7)  score += 12
      // >7 días = 0 pts (techo ~55 con datos perfectos, nunca "caliente")

      // Préstamos activos: hasta 30 pts
      if (prestamos >= 10)       score += 30
      else if (prestamos >= 5)   score += 25
      else if (prestamos >= 3)   score += 18
      else if (prestamos >= 1)   score += 10

      // Clientes registrados: hasta 20 pts
      if (clientes >= 10)       score += 20
      else if (clientes >= 5)   score += 16
      else if (clientes >= 3)   score += 11
      else if (clientes >= 1)   score += 5

      // Días en plataforma: hasta 5 pts
      score += Math.min(5, Math.floor(diasDesdeRegistro / 2))
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
      const fechaDesde = primerPago ? new Date(primerPago.createdAt) : new Date(susc.fechaInicio)
      pagantes.push({
        ...base,
        fechaInicioPago:  fechaDesde,
        fechaVencimiento: susc.fechaVencimiento,
        mesesPagando: Math.max(1, Math.floor(
          (ahora - fechaDesde) / (1000 * 60 * 60 * 24 * 30)
        )),
      })
    } else if (esChuneado) {
      churneados.push({
        ...base,
        fechaVencimiento: susc.fechaVencimiento,
        diasSinPagar: Math.floor((ahora - new Date(susc.fechaVencimiento)) / 86400000),
      })
    } else if (esTrial) {
      const fechaVencTrial = susc
        ? new Date(susc.fechaVencimiento)
        : new Date(new Date(org.createdAt).getTime() + 14 * 86400000)
      const esMuerto = (clientes === 0 && diasSinActividad > 7)
        || (prestamos === 0 && diasSinActividad > 14)
        || (diasSinActividad > 30)
      if (esMuerto) {
        muertos.push({ ...base, diasRestantesTrial, fechaVencimiento: fechaVencTrial })
      } else {
        trials.push({ ...base, score, diasRestantesTrial, fechaVencimiento: fechaVencTrial })
      }
    }
  }

  // Ordenar
  trials.sort((a, b) => b.score - a.score)
  pagantes.sort((a, b) => b.precio - a.precio)
  churneados.sort((a, b) => a.diasSinPagar - b.diasSinPagar)

  // Proyección: score >= 60 + mínimo de datos reales (3+ clientes o 3+ préstamos)
  const trialsCalientes = trials.filter(t => t.score >= 60 && (t.clientes >= 3 || t.prestamos >= 3))
  const mrrProyectado = trialsCalientes.reduce((acc, t) => acc + PRECIO(t.plan), 0)

  // Calendario de cobros: próximos 30 días — trials que vencen cada día
  const calendarioMap = {}
  for (const t of [...trials, ...muertos]) {
    const fv = new Date(t.fechaVencimiento)
    const diffDias = Math.ceil((fv - ahora) / 86400000)
    if (diffDias < -1 || diffDias > 30) continue // solo próximos 30 días (y vencidos ayer)
    const diaKey = fv.toISOString().slice(0, 10)
    if (!calendarioMap[diaKey]) calendarioMap[diaKey] = { dia: diaKey, usuarios: [], mrrPotencial: 0, mrrCaliente: 0 }
    const esCaliente = (t.score ?? 0) >= 60 && (t.clientes >= 3 || t.prestamos >= 3)
    calendarioMap[diaKey].usuarios.push({
      id:           t.id,
      nombre:       t.nombre,
      ownerNombre:  t.ownerNombre,
      ownerTelefono: t.ownerTelefono,
      plan:         t.plan,
      planNombre:   t.planNombre,
      score:        t.score ?? 0,
      clientes:     t.clientes,
      prestamos:    t.prestamos,
      diasRestantes: diffDias,
    })
    calendarioMap[diaKey].mrrPotencial += PRECIO(t.plan)
    if (esCaliente) calendarioMap[diaKey].mrrCaliente += PRECIO(t.plan)
  }
  const calendario = Object.values(calendarioMap).sort((a, b) => a.dia.localeCompare(b.dia))

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
    calendario,
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
