// app/api/cron/celebraciones/route.js — Push positivas: hitos y logros
// Llamar cada 2-3h durante horario laboral (7am-9pm):
// curl -X POST -H "x-cron-secret: $CRON_SECRET" https://app.control-finanzas.com/api/cron/celebraciones

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'
import { enviarPush } from '@/lib/push'
import { getUtcOffset, getLocalDayRange, formatMoney } from '@/lib/i18n'

const CRON_SECRET = process.env.CRON_SECRET
const MAX_PUSH_DIA = 3

function getLocalDateStr(country = 'co') {
  const offset = Math.abs(getUtcOffset(country))
  return new Date(Date.now() - offset * 3600000).toISOString().slice(0, 10)
}

export async function POST(req) {
  const secret = req.headers.get('x-cron-secret')
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const orgs = await prisma.organization.findMany({
    where: { activo: true },
    select: { id: true, country: true },
  })

  let totalEnviadas = 0
  const detalles = []
  const errores = []

  for (const org of orgs) {
   // Aislar cada org: si una falla, el cron sigue con las demas (antes una sola
   // excepcion mataba la corrida completa).
   try {
    const country = org.country || 'co'
    const hoyStr = getLocalDateStr(country)
    const { inicio, fin } = getLocalDayRange(hoyStr, country)

    const pushHoy = await prisma.pushLog.count({
      where: { organizationId: org.id, tipo: 'celebracion', createdAt: { gte: inicio, lte: fin } },
    })
    if (pushHoy >= MAX_PUSH_DIA) continue

    const remaining = MAX_PUSH_DIA - pushHoy
    const notificaciones = []

    const cobradores = await prisma.user.findMany({
      where: { organizationId: org.id, rol: 'cobrador', activo: true },
      select: { id: true, nombre: true },
    })
    const owners = await prisma.user.findMany({
      where: { organizationId: org.id, rol: 'owner' },
      select: { id: true },
    })
    if (owners.length === 0) continue

    const todosUserIds = [...owners.map(o => o.id), ...cobradores.map(c => c.id)]

    // --- Hito 1: Cierre perfecto ($0 diferencia) ---
    const cierresPerfectos = await prisma.cierreCaja.findMany({
      where: {
        organizationId: org.id,
        fecha: { gte: inicio, lte: fin },
        diferencia: 0,
      },
      select: { cobradorId: true },
    })
    for (const cierre of cierresPerfectos) {
      const cobrador = cobradores.find(c => c.id === cierre.cobradorId)
      if (!cobrador) continue
      const key = `cierre-perfecto-${cierre.cobradorId}-${hoyStr}`
      notificaciones.push({
        key,
        destinatarios: owners.map(o => o.id),
        title: 'Cierre perfecto',
        body: `${cobrador.nombre} cerro caja con $0 de diferencia`,
        url: '/caja',
      })
    }

    // --- Hito 2: Mejor dia que el promedio de la semana ---
    const pagosHoy = await prisma.pago.aggregate({
      where: {
        organizationId: org.id,
        fechaPago: { gte: inicio, lte: fin },
        prestamo: { estado: { not: 'cancelado' } },
      },
      _sum: { montoPagado: true },
      _count: { id: true },
    })
    const recaudadoHoy = pagosHoy._sum.montoPagado || 0
    const cantidadPagos = pagosHoy._count.id || 0

    if (cantidadPagos >= 5 && recaudadoHoy > 0) {
      const sieteDiasAtras = new Date(inicio.getTime() - 7 * 86400000)
      const pagosSemana = await prisma.pago.aggregate({
        where: {
          organizationId: org.id,
          fechaPago: { gte: sieteDiasAtras, lt: inicio },
          prestamo: { estado: { not: 'cancelado' } },
          },
        _sum: { montoPagado: true },
      })
      const promedioSemanal = (pagosSemana._sum.montoPagado || 0) / 7
      if (promedioSemanal > 0 && recaudadoHoy >= promedioSemanal * 1.2) {
        const pct = Math.round((recaudadoHoy / promedioSemanal) * 100)
        notificaciones.push({
          key: `mejor-dia-${hoyStr}`,
          destinatarios: todosUserIds,
          title: 'Gran dia de recaudo',
          body: `${formatMoney(recaudadoHoy, country)} hoy — ${pct - 100}% por encima del promedio semanal`,
          url: '/caja',
        })
      }
    }

    // --- Hito 3: Racha sin mora nueva (5+ dias) ---
    const cincoDiasAtras = new Date(inicio.getTime() - 5 * 86400000)
    const prestamosNuevosMora = await prisma.prestamo.count({
      where: {
        organizationId: org.id,
        estado: 'activo',
        diasMora: { gt: 0, lte: 5 },
        updatedAt: { gte: cincoDiasAtras },
      },
    })
    if (prestamosNuevosMora === 0) {
      const totalActivos = await prisma.prestamo.count({
        where: { organizationId: org.id, estado: 'activo' },
      })
      if (totalActivos >= 5) {
        notificaciones.push({
          key: `racha-sin-mora-${hoyStr}`,
          destinatarios: todosUserIds,
          title: 'Racha de 5 dias sin mora nueva',
          body: `${totalActivos} prestamos activos y ningun cliente nuevo en mora`,
          url: '/prestamos',
        })
      }
    }

    // --- Hito 4: Capital milestone ---
    // `saldoPendiente` NO es una columna: siempre se calcula (totalAPagar - totalPagado).
    // Pedirlo en _sum tiraba PrismaClientValidationError y mataba el cron completo.
    const capitalResult = await prisma.prestamo.aggregate({
      where: { organizationId: org.id, estado: 'activo' },
      _sum: { totalAPagar: true, totalPagado: true },
    })
    const capitalActivo = Math.max(
      0,
      (capitalResult._sum.totalAPagar || 0) - (capitalResult._sum.totalPagado || 0)
    )
    const milestones = [50000000, 30000000, 20000000, 10000000, 5000000]
    for (const ms of milestones) {
      if (capitalActivo >= ms) {
        notificaciones.push({
          key: `capital-${ms}-${hoyStr}`,
          destinatarios: owners.map(o => o.id),
          title: 'Hito de cartera',
          body: `Tu cartera activa supero ${formatMoney(ms, country)}`,
          url: '/dashboard',
        })
        break
      }
    }

    // Dedup: solo enviar las que no se hayan enviado hoy
    const keysExistentes = new Set(
      (await prisma.pushLog.findMany({
        where: { organizationId: org.id, tipo: 'celebracion', createdAt: { gte: inicio, lte: fin } },
        select: { clave: true },
      })).map(l => l.clave)
    )

    const pendientes = notificaciones.filter(n => !keysExistentes.has(n.key))
    const aEnviar = pendientes.slice(0, remaining)

    for (const notif of aEnviar) {
      for (const userId of notif.destinatarios) {
        await enviarPush(userId, {
          title: notif.title,
          body: notif.body,
          url: notif.url,
        }).catch(() => {})
      }
      await prisma.pushLog.create({
        data: {
          organizationId: org.id,
          tipo: 'celebracion',
          clave: notif.key,
          titulo: notif.title,
          cuerpo: notif.body,
        },
      }).catch(() => {})
      totalEnviadas++
    }

    if (aEnviar.length > 0) {
      detalles.push({ orgId: org.id, enviadas: aEnviar.length, tipos: aEnviar.map(n => n.key) })
    }
   } catch (e) {
     console.error(`[Celebraciones] Error en org ${org.id}:`, e?.message || e)
     errores.push({ orgId: org.id, error: e?.message || String(e) })
   }
  }

  return NextResponse.json({ ok: true, totalEnviadas, detalles, errores: errores.length, detalleErrores: errores.slice(0, 5) })
}
