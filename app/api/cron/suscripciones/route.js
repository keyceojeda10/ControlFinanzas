// app/api/cron/suscripciones/route.js — Aviso de vencimiento de suscripciones
// Llamar diariamente con: curl -X POST -H "x-cron-secret: $CRON_SECRET" https://app.control-finanzas.com/api/cron/suscripciones

import { NextResponse } from 'next/server'
import { prisma }       from '@/lib/prisma'
import { enviarEmail, emailAvisoVencimiento, emailSuscripcionVencida } from '@/lib/email'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(req) {
  const secret = req.headers.get('x-cron-secret')
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const ahora = new Date()
  const resultados = { avisos: 0, vencidas: 0, demosRevertidos: 0, errores: 0 }

  // 0. Revertir demos expirados
  const demosExpirados = await prisma.organization.findMany({
    where: {
      planDemoHasta: { lt: ahora },
      planOriginal: { not: null },
    },
  })
  for (const org of demosExpirados) {
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        plan: org.planOriginal,
        planOriginal: null,
        planDemoHasta: null,
      },
    })
    await prisma.adminLog.create({
      data: {
        adminId: 'system',
        organizacionId: org.id,
        accion: 'revertir_demo',
        detalle: `Demo expirado automáticamente: ${org.plan} → ${org.planOriginal} para "${org.nombre}"`,
      },
    })
    resultados.demosRevertidos++
  }

  // 1. Buscar suscripciones que vencen en 3 días o en 1 día
  for (const dias of [3, 1]) {
    const desde = new Date(ahora)
    desde.setDate(desde.getDate() + dias)
    desde.setHours(0, 0, 0, 0)

    const hasta = new Date(desde)
    hasta.setHours(23, 59, 59, 999)

    const suscripciones = await prisma.suscripcion.findMany({
      where: {
        estado: 'activa',
        fechaVencimiento: { gte: desde, lte: hasta },
      },
      include: {
        organization: {
          include: {
            users: {
              where: { rol: 'owner', activo: true },
              select: { nombre: true, email: true },
              take: 1,
            },
          },
        },
      },
    })

    for (const sub of suscripciones) {
      const owner = sub.organization?.users?.[0]
      if (!owner) continue

      const { subject, html } = emailAvisoVencimiento({
        nombre: owner.nombre,
        plan: sub.plan,
        diasRestantes: dias,
        fechaVencimiento: sub.fechaVencimiento,
      })

      const res = await enviarEmail({ to: owner.email, subject, html })
      if (res.ok) resultados.avisos++
      else resultados.errores++
    }
  }

  // 2. Buscar suscripciones que vencieron hoy (marcar como vencidas y notificar)
  const inicioHoy = new Date(ahora)
  inicioHoy.setHours(0, 0, 0, 0)

  const vencidas = await prisma.suscripcion.findMany({
    where: {
      estado: 'activa',
      fechaVencimiento: { lt: inicioHoy },
    },
    include: {
      organization: {
        include: {
          users: {
            where: { rol: 'owner', activo: true },
            select: { nombre: true, email: true },
            take: 1,
          },
        },
      },
    },
  })

  for (const sub of vencidas) {
    // Marcar como vencida
    await prisma.suscripcion.update({
      where: { id: sub.id },
      data: { estado: 'vencida' },
    })

    const owner = sub.organization?.users?.[0]
    if (!owner) continue

    const { subject, html } = emailSuscripcionVencida({
      nombre: owner.nombre,
      plan: sub.plan,
    })

    const res = await enviarEmail({ to: owner.email, subject, html })
    if (res.ok) resultados.vencidas++
    else resultados.errores++
  }

  return NextResponse.json({
    ok: true,
    ...resultados,
    mensaje: `Avisos: ${resultados.avisos}, Vencidas: ${resultados.vencidas}, Demos revertidos: ${resultados.demosRevertidos}, Errores: ${resultados.errores}`,
  })
}
