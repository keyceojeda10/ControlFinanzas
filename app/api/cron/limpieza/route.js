// app/api/cron/limpieza/route.js — Limpieza de datos viejos + fotos de pagos
// Llamar diariamente a las 3am: curl -X POST -H "x-cron-secret: $CRON_SECRET" https://app.control-finanzas.com/api/cron/limpieza

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'
import { unlink } from 'fs/promises'
import path from 'path'

const CRON_SECRET = process.env.CRON_SECRET
const DIAS_RETENCION = 90
const DIAS_RETENCION_FOTOS = 30

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

  // Fotos de pagos >30 días: borrar archivo del disco + limpiar campo en DB
  const limiteFotos = new Date()
  limiteFotos.setDate(limiteFotos.getDate() - DIAS_RETENCION_FOTOS)
  let fotosEliminadas = 0

  while (true) {
    const pagos = await prisma.pago.findMany({
      where: { fotoUrl: { not: null }, createdAt: { lt: limiteFotos } },
      select: { id: true, fotoUrl: true },
      take: 100,
    })
    if (pagos.length === 0) break
    for (const p of pagos) {
      try {
        const filePath = path.join(process.cwd(), 'public', p.fotoUrl)
        await unlink(filePath)
      } catch {}
    }
    await prisma.pago.updateMany({
      where: { id: { in: pagos.map(p => p.id) } },
      data: { fotoUrl: null },
    })
    fotosEliminadas += pagos.length
    if (pagos.length < 100) break
  }

  return NextResponse.json({
    ok: true,
    eventosEliminados: eventosTotal,
    actividadEliminada: actividadTotal,
    fotosEliminadas,
    mensaje: `Limpieza: ${eventosTotal} eventos + ${actividadTotal} logs (>${DIAS_RETENCION}d) + ${fotosEliminadas} fotos (>${DIAS_RETENCION_FOTOS}d)`,
  })
}
