// app/api/caja/warning/route.js - Endpoint para advertiencia de cierre de caja

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUtcOffset, getLocalDateStr, getLocalDayRange } from '@/lib/i18n'

const DAY_MS = 24 * 60 * 60 * 1000

const getLocalDateStrFromDate = (valor = new Date(), country = 'co') => {
  const absOffset = Math.abs(getUtcOffset(country))
  const col = new Date(valor.getTime() - absOffset * 60 * 60 * 1000)
  return col.toISOString().slice(0, 10)
}

const getDayRange = (fechaLocal, country = 'co') => getLocalDayRange(fechaLocal, country)

const getFechaAnterior = (fechaLocal, country = 'co') => {
  const absOffset = Math.abs(getUtcOffset(country))
  const pad = (n) => String(n).padStart(2, '0')
  const base = new Date(fechaLocal + `T00:00:00-${pad(absOffset)}:00`)
  const anterior = new Date(base.getTime() - DAY_MS)
  return anterior.toISOString().slice(0, 10)
}

// Retorna si hay una advertencia activa de cierre de caja
// y los minutos restantes hasta el cierre automático
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (session.user.rol !== 'cobrador') {
    return Response.json({
      showWarning: false,
      minutesUntilClose: 0,
      autoCloseTime: '23:59',
      showPendingReminder: false,
      pendingType: null,
      pendingDate: null,
      pendingAmount: 0,
    })
  }

  const now = new Date()
  const { organizationId, id: cobradorId } = session.user
  
  const country = session.user.country ?? 'co'
  const absOffset = Math.abs(getUtcOffset(country))
  const localNow = new Date(now.getTime() - absOffset * 60 * 60 * 1000)
  const hour = localNow.getHours()
  const minutes = localNow.getMinutes()

  // Si es entre las 11:45 PM y 11:59 PM (hora Colombia), mostrar advertencia
  // 23:45 = 23*60 + 45 = 1385 minutos
  // 23:59 = 23*60 + 59 = 1439 minutos
  const currentMinutes = hour * 60 + minutes
  
  // Advertencia entre 23:45 y 23:59 (15 minutos antes de medianoche)
  const showWarning = currentMinutes >= 1385 && currentMinutes < 1440
  
  // Minutos restantes hasta cierre (a las 23:59 = 1440 minutos)
  const minutesUntilClose = showWarning ? (1440 - currentMinutes) : 0

  const fechaHoy = getLocalDateStrFromDate(now, country)
  const fechaAyer = getFechaAnterior(fechaHoy)
  const { inicio: inicioHoy, fin: finHoy } = getDayRange(fechaHoy)
  const { inicio: inicioAyer, fin: finAyer } = getDayRange(fechaAyer)

  const [pagosHoy, pagosAyer, cierreHoy, cierreAyer] = await Promise.all([
    prisma.pago.aggregate({
      where: {
        organizationId,
        cobradorId,
        fechaPago: { gte: inicioHoy, lt: finHoy },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      _sum: { montoPagado: true },
    }),
    prisma.pago.aggregate({
      where: {
        organizationId,
        cobradorId,
        fechaPago: { gte: inicioAyer, lt: finAyer },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      _sum: { montoPagado: true },
    }),
    prisma.cierreCaja.findFirst({
      where: {
        organizationId,
        cobradorId,
        fecha: { gte: inicioHoy, lt: finHoy },
      },
      select: { id: true, totalRecogido: true },
    }),
    prisma.cierreCaja.findFirst({
      where: {
        organizationId,
        cobradorId,
        fecha: { gte: inicioAyer, lt: finAyer },
      },
      select: { id: true, totalRecogido: true },
    }),
  ])

  const recaudadoHoy = Math.round(pagosHoy._sum?.montoPagado || 0)
  const recaudadoAyer = Math.round(pagosAyer._sum?.montoPagado || 0)
  const cierreAyerMonto = Math.round(cierreAyer?.totalRecogido || 0)

  const pendienteHoy = recaudadoHoy > 0 && !cierreHoy
  const pendienteAyer = recaudadoAyer > 0 && (!cierreAyer || cierreAyerMonto !== recaudadoAyer)

  const pendingType = pendienteAyer
    ? 'ajuste_ayer'
    : (pendienteHoy ? 'pendiente_hoy' : null)
  const showPendingReminder = !!pendingType
  const pendingDate = pendingType === 'ajuste_ayer' ? fechaAyer : (pendingType === 'pendiente_hoy' ? fechaHoy : null)
  const pendingAmount = pendingType === 'ajuste_ayer' ? recaudadoAyer : (pendingType === 'pendiente_hoy' ? recaudadoHoy : 0)

  return Response.json({
    showWarning,
    minutesUntilClose: showWarning ? Math.max(1, minutesUntilClose) : 0,
    autoCloseTime: '23:59', // Colombia
    showPendingReminder,
    pendingType,
    pendingDate,
    pendingAmount,
  })
}

// POST protegido — solo con CRON_SECRET via header
export async function POST(request) {
  const CRON_SECRET = process.env.CRON_SECRET
  const cronSecret = request.headers.get('x-cron-secret')

  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  return Response.json({ success: true })
}
