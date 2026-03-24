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

  const [eventos, actividad] = await Promise.all([
    prisma.evento.deleteMany({ where: { createdAt: { lt: limite } } }),
    prisma.actividadLog.deleteMany({ where: { createdAt: { lt: limite } } }),
  ])

  return NextResponse.json({
    ok: true,
    eventosEliminados: eventos.count,
    actividadEliminada: actividad.count,
    mensaje: `Limpieza completada: ${eventos.count} eventos + ${actividad.count} logs eliminados (>${DIAS_RETENCION} días)`,
  })
}
