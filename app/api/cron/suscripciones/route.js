// app/api/cron/suscripciones/route.js — Aviso de vencimiento de suscripciones
// Llamar diariamente con: curl -X POST -H "x-cron-secret: $CRON_SECRET" https://app.control-finanzas.com/api/cron/suscripciones

import { NextResponse } from 'next/server'
import { prisma }       from '@/lib/prisma'
import { enviarEmail, emailAvisoVencimiento, emailSuscripcionVencida } from '@/lib/email'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'
import { notificar } from '@/lib/notificar'
import { registrarAdminLog } from '@/lib/admin-log'
import { whereCobroSinRechazo, HORAS_DE_GRACIA } from '@/lib/cobro-automatico'
import { adicionalesAlCambiarA } from '@/lib/planes'

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
        ...adicionalesAlCambiarA(org.planOriginal),
        planOriginal: null,
        planDemoHasta: null,
      },
    })
    await prisma.suscripcion.updateMany({
      where: { organizationId: org.id, plan: org.plan },
      data: { plan: org.planOriginal },
    }).catch(() => {})
    await registrarAdminLog({
      organizacionId: org.id,
      accion: 'revertir_demo',
      detalle: `Demo expirado automáticamente: ${org.plan} → ${org.planOriginal} para "${org.nombre}"`,
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
        /* Con el Nequi o la tarjeta guardados no se avisa mientras la pasarela
           lo intenta (lib/cobro-automatico.js). Con un rechazo apuntado entra
           aquí como cualquiera. */
        organization: { is: { NOT: whereCobroSinRechazo } },
        // No avisar a suscripciones recurrentes autorizadas — MP cobra automáticamente
        NOT: {
          AND: [
            { tipo: 'recurrente' },
            { mpStatus: 'authorized' },
          ],
        },
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

      // Push notification al owner
      notificar({
        organizationId: sub.organizationId, para: 'owners', tipo: 'suscripcion',
        titulo: 'Tu plan vence pronto',
        mensaje: `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}. Renuévalo para no perder el acceso.`,
        href: '/configuracion/plan',
      })
    }
  }

  // 2. Buscar suscripciones que vencieron hoy (marcar como vencidas y notificar)
  // Dar 5 días de gracia a suscripciones recurrentes con mpStatus "authorized"
  // porque MercadoPago puede estar reintentando el cobro
  const inicioHoy = new Date(ahora)
  inicioHoy.setHours(0, 0, 0, 0)

  const cincoAtras = new Date(ahora)
  cincoAtras.setDate(cincoAtras.getDate() - 5)

  const finDeGracia = new Date(ahora.getTime() - HORAS_DE_GRACIA * 3600000)

  const vencidas = await prisma.suscripcion.findMany({
    where: {
      estado: 'activa',
      fechaVencimiento: { lt: inicioHoy },
      /* Con el Nequi o la tarjeta guardados no se marca vencida mientras la
         pasarela lo intenta (lib/cobro-automatico.js). Con un rechazo apuntado
         entra como cualquiera; y pasada la gracia entra igual, por si el cron
         de cobro no llegó a pasar. */
      OR: [
        { organization: { is: { NOT: whereCobroSinRechazo } } },
        { fechaVencimiento: { lt: finDeGracia } },
      ],
      NOT: {
        AND: [
          { tipo: 'recurrente' },
          { mpStatus: 'authorized' },
          { fechaVencimiento: { gte: cincoAtras } },
        ],
      },
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

    // Push notification de suscripción vencida
    notificar({
      organizationId: sub.organizationId, para: 'owners', tipo: 'suscripcion',
      titulo: 'Tu plan se venció',
      mensaje: 'Renuévalo para seguir usando la app.',
      href: '/configuracion/plan',
    })
  }

  return NextResponse.json({
    ok: true,
    ...resultados,
    mensaje: `Avisos: ${resultados.avisos}, Vencidas: ${resultados.vencidas}, Demos revertidos: ${resultados.demosRevertidos}, Errores: ${resultados.errores}`,
  })
}
