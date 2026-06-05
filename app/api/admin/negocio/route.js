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

  // Traer todas las orgs con sus datos clave en una sola query
  const orgs = await prisma.organization.findMany({
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
  })

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
      mrrActual:      mrrTotal,
      mrrProyectado:  mrrTotal + mrrProyectado,
      pagantes:       pagantes.length,
      trials:         trials.length,
      trialsCalientes: trialsCalientes.length,
      muertos:        muertos.length,
      churneados:     churneados.length,
    },
    pagantes,
    trials,
    muertos,
    churneados,
  })
}
