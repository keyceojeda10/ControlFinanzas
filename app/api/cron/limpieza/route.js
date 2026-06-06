// app/api/cron/limpieza/route.js — Limpieza de datos >90 días (eventos analytics + activity logs)
// Llamar diariamente a las 3am: curl -X POST -H "x-cron-secret: $CRON_SECRET" https://app.control-finanzas.com/api/cron/limpieza

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'

const CRON_SECRET = process.env.CRON_SECRET
const DIAS_RETENCION = 90

export async function POST(req) {
  const secret = req.headers.get('x-cron-secret')
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const limite = new Date()
  limite.setDate(limite.getDate() - DIAS_RETENCION)

  // Borrar en chunks de 2000 filas para evitar bloqueos de tabla prolongados.
  // Un DELETE masivo en MySQL puede bloquear la tabla por segundos/minutos
  // cuando hay millones de filas, afectando a todos los usuarios simultáneos.
  const CHUNK = 2000
  let eventosTotal = 0
  let actividadTotal = 0

  // Chunk loop para eventos
  while (true) {
    const ids = await prisma.evento.findMany({
      where: { createdAt: { lt: limite } },
      select: { id: true },
      take: CHUNK,
    })
    if (ids.length === 0) break
    const { count } = await prisma.evento.deleteMany({
      where: { id: { in: ids.map(r => r.id) } },
    })
    eventosTotal += count
    if (ids.length < CHUNK) break
  }

  // Chunk loop para actividadLog
  while (true) {
    const ids = await prisma.actividadLog.findMany({
      where: { createdAt: { lt: limite } },
      select: { id: true },
      take: CHUNK,
    })
    if (ids.length === 0) break
    const { count } = await prisma.actividadLog.deleteMany({
      where: { id: { in: ids.map(r => r.id) } },
    })
    actividadTotal += count
    if (ids.length < CHUNK) break
  }

  return NextResponse.json({
    ok: true,
    eventosEliminados: eventosTotal,
    actividadEliminada: actividadTotal,
    mensaje: `Limpieza completada: ${eventosTotal} eventos + ${actividadTotal} logs eliminados (>${DIAS_RETENCION} días)`,
  })
}
