// app/api/cron/cierre-recordatorios/route.js - Push para recordar cierres pendientes de caja
// Sugerido: llamar cada 30-60 min entre 20:00 y 23:55 (hora Colombia)

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'
import { enviarPush } from '@/lib/push'

const CRON_SECRET = process.env.CRON_SECRET
const COLOMBIA_OFFSET = 5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_RECORDATORIOS_POR_EJECUCION = 300

const getColombiaDateStr = (valor = new Date()) => {
  const col = new Date(valor.getTime() - COLOMBIA_OFFSET)
  return col.toISOString().slice(0, 10)
}

const getColombiaDayRange = (fechaColombia) => {
  const inicio = new Date(fechaColombia + 'T00:00:00-05:00')
  const fin = new Date(fechaColombia + 'T23:59:59.999-05:00')
  return { inicio, fin }
}

const getFechaAnterior = (fechaColombia) => {
  const base = new Date(fechaColombia + 'T00:00:00-05:00')
  const anterior = new Date(base.getTime() - DAY_MS)
  return anterior.toISOString().slice(0, 10)
}

const makeKey = (organizationId, cobradorId) => `${organizationId}:${cobradorId}`

const roundAmount = (value) => Math.round(value || 0)

function mapRecaudo(rows) {
  const out = new Map()
  for (const row of rows) {
    if (!row.cobradorId) continue
    out.set(makeKey(row.organizationId, row.cobradorId), roundAmount(row._sum?.montoPagado))
  }
  return out
}

function mapCierre(cierres) {
  const out = new Map()
  for (const cierre of cierres) {
    const key = makeKey(cierre.organizationId, cierre.cobradorId)
    const previo = out.get(key)
    if (!previo || cierre.createdAt > previo.createdAt) {
      out.set(key, cierre)
    }
  }
  return out
}

function buildPushPayload({ pendingType, pendingDate, pendingAmount }) {
  const amountLabel = `$${Math.round(pendingAmount || 0).toLocaleString('es-CO')}`

  if (pendingType === 'ajuste_ayer') {
    return {
      title: 'Ajusta tu cierre de ayer',
      body: `Monto sugerido: ${amountLabel}. Confirma tu cierre pendiente.`,
      url: `/caja?fecha=${pendingDate}`,
    }
  }

  return {
    title: 'Tienes recaudo sin cierre',
    body: `Monto sugerido: ${amountLabel}. Registra el cierre de hoy.`,
    url: `/caja?fecha=${pendingDate}`,
  }
}

export async function POST(req) {
  const secret = req.headers.get('x-cron-secret')
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const now = new Date()
  const fechaHoy = getColombiaDateStr(now)
  const fechaAyer = getFechaAnterior(fechaHoy)

  const { inicio: inicioHoy, fin: finHoy } = getColombiaDayRange(fechaHoy)
  const { inicio: inicioAyer, fin: finAyer } = getColombiaDayRange(fechaAyer)

  const cobradores = await prisma.user.findMany({
    where: {
      rol: 'cobrador',
      activo: true,
      organization: { activo: true },
    },
    select: {
      id: true,
      nombre: true,
      organizationId: true,
      organization: { select: { nombre: true } },
    },
  })

  if (cobradores.length === 0) {
    return NextResponse.json({ ok: true, mensaje: 'No hay cobradores activos', totalCobradores: 0 })
  }

  const cobradorIds = cobradores.map((c) => c.id)
  const organizationIds = [...new Set(cobradores.map((c) => c.organizationId))]

  const [pagosHoy, pagosAyer, cierresHoy, cierresAyer, remindersHoy] = await Promise.all([
    prisma.pago.groupBy({
      by: ['organizationId', 'cobradorId'],
      where: {
        organizationId: { in: organizationIds },
        cobradorId: { in: cobradorIds },
        fechaPago: { gte: inicioHoy, lte: finHoy },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      _sum: { montoPagado: true },
    }),
    prisma.pago.groupBy({
      by: ['organizationId', 'cobradorId'],
      where: {
        organizationId: { in: organizationIds },
        cobradorId: { in: cobradorIds },
        fechaPago: { gte: inicioAyer, lte: finAyer },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      _sum: { montoPagado: true },
    }),
    prisma.cierreCaja.findMany({
      where: {
        organizationId: { in: organizationIds },
        cobradorId: { in: cobradorIds },
        fecha: { gte: inicioHoy, lte: finHoy },
      },
      select: {
        organizationId: true,
        cobradorId: true,
        totalRecogido: true,
        createdAt: true,
      },
    }),
    prisma.cierreCaja.findMany({
      where: {
        organizationId: { in: organizationIds },
        cobradorId: { in: cobradorIds },
        fecha: { gte: inicioAyer, lte: finAyer },
      },
      select: {
        organizationId: true,
        cobradorId: true,
        totalRecogido: true,
        createdAt: true,
      },
    }),
    prisma.actividadLog.findMany({
      where: {
        organizationId: { in: organizationIds },
        userId: { in: cobradorIds },
        accion: 'push_recordatorio_cierre',
        entidadTipo: 'caja',
        createdAt: { gte: inicioHoy, lte: finHoy },
      },
      select: {
        organizationId: true,
        userId: true,
        entidadId: true,
      },
    }),
  ])

  const recaudadoHoyMap = mapRecaudo(pagosHoy)
  const recaudadoAyerMap = mapRecaudo(pagosAyer)
  const cierreHoyMap = mapCierre(cierresHoy)
  const cierreAyerMap = mapCierre(cierresAyer)
  const remindersEnviadosHoy = new Set(
    remindersHoy.map((row) => `${row.organizationId}:${row.userId}:${row.entidadId || ''}`)
  )

  const resumen = {
    totalCobradores: cobradores.length,
    pendientesDetectados: 0,
    pendientesHoy: 0,
    ajustesAyer: 0,
    usuariosNotificados: 0,
    suscripcionesExitosas: 0,
    sinSuscripcion: 0,
    yaNotificadosHoy: 0,
    erroresPush: 0,
    limiteEjecucion: MAX_RECORDATORIOS_POR_EJECUCION,
    limiteAlcanzado: false,
  }

  for (const cobrador of cobradores) {
    if (resumen.usuariosNotificados >= MAX_RECORDATORIOS_POR_EJECUCION) {
      resumen.limiteAlcanzado = true
      break
    }

    const key = makeKey(cobrador.organizationId, cobrador.id)
    const recaudadoHoy = recaudadoHoyMap.get(key) || 0
    const recaudadoAyer = recaudadoAyerMap.get(key) || 0
    const cierreHoy = cierreHoyMap.get(key) || null
    const cierreAyer = cierreAyerMap.get(key) || null
    const cierreAyerMonto = roundAmount(cierreAyer?.totalRecogido)

    const pendienteHoy = recaudadoHoy > 0 && !cierreHoy
    const pendienteAyer = recaudadoAyer > 0 && (!cierreAyer || cierreAyerMonto !== recaudadoAyer)

    const pendingType = pendienteAyer
      ? 'ajuste_ayer'
      : (pendienteHoy ? 'pendiente_hoy' : null)

    if (!pendingType) continue

    resumen.pendientesDetectados += 1
    if (pendingType === 'ajuste_ayer') resumen.ajustesAyer += 1
    if (pendingType === 'pendiente_hoy') resumen.pendientesHoy += 1

    const pendingDate = pendingType === 'ajuste_ayer' ? fechaAyer : fechaHoy
    const pendingAmount = pendingType === 'ajuste_ayer' ? recaudadoAyer : recaudadoHoy
    const reminderId = `recordatorio_cierre:${pendingType}:${pendingDate}`
    const reminderKey = `${cobrador.organizationId}:${cobrador.id}:${reminderId}`

    if (remindersEnviadosHoy.has(reminderKey)) {
      resumen.yaNotificadosHoy += 1
      continue
    }

    const payload = buildPushPayload({ pendingType, pendingDate, pendingAmount })

    try {
      const pushResults = await enviarPush(cobrador.id, payload)
      if (!Array.isArray(pushResults)) {
        continue
      }

      if (pushResults.length === 0) {
        resumen.sinSuscripcion += 1
        continue
      }

      const exitosas = pushResults.filter((r) => r.status === 'fulfilled').length
      const fallidas = pushResults.length - exitosas

      if (fallidas > 0) {
        resumen.erroresPush += fallidas
      }

      if (exitosas <= 0) {
        continue
      }

      resumen.usuariosNotificados += 1
      resumen.suscripcionesExitosas += exitosas
      remindersEnviadosHoy.add(reminderKey)

      await prisma.actividadLog.create({
        data: {
          organizationId: cobrador.organizationId,
          userId: cobrador.id,
          accion: 'push_recordatorio_cierre',
          entidadTipo: 'caja',
          entidadId: reminderId,
          detalle: `Push recordatorio de cierre (${pendingType}) para ${pendingDate}. Monto sugerido: ${Math.round(pendingAmount).toLocaleString('es-CO')}`,
          ip: getClientIp(req),
        },
      })
    } catch (error) {
      resumen.erroresPush += 1
      console.error('[cron/cierre-recordatorios] Error push', {
        organizationId: cobrador.organizationId,
        cobradorId: cobrador.id,
        message: error?.message,
      })
    }
  }

  return NextResponse.json({
    ok: true,
    fechaHoy,
    fechaAyer,
    ...resumen,
    mensaje: `Pendientes: ${resumen.pendientesDetectados}. Usuarios notificados: ${resumen.usuariosNotificados}.`,
  })
}
