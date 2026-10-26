import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enviarEmail, emailOnboardingDia12, emailOnboardingDia14 } from '@/lib/email'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'
import { whereSinPruebaSiete } from '@/lib/seguimiento/prueba'

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(req) {
  const secret = req.headers.get('x-cron-secret')
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const ahora = new Date()
  const resultados = { dia12: 0, dia14: 0, errors: 0 }

  try {
    // Find orgs that haven't received trial reminder yet
    const orgs = await prisma.organization.findMany({
      where: {
        ...whereSinPruebaSiete, // los de 7 + 7: el motor de seguimiento
        trialReminderSent: false,
        users: { some: { rol: 'owner' } },
      },
      include: {
        users: {
          where: { rol: 'owner' },
          select: { nombre: true, email: true },
          take: 1,
        },
        _count: { select: { clientes: true, prestamos: true } },
        suscripciones: {
          orderBy: { fechaVencimiento: 'desc' }, take: 1,
          select: { montoCOP: true, estado: true, fechaVencimiento: true },
        },
      },
    })

    for (const org of orgs) {
      const owner = org.users[0]
      if (!owner?.email) continue

      /* ⚠ QUIEN YA PAGÓ NO RECIBE «SE ACABA TU PRUEBA» (26 oct 2026).
         Oscar (CREDITOS E y M) pagó el 25 y el 26 le llegó «último día de
         prueba»: esto contaba días desde el registro y no miraba el pago. Se
         da por avisado y no se le escribe más. */
      const sub = org.suscripciones[0]
      if (sub && sub.montoCOP > 0 && sub.estado === 'activa') {
        await prisma.organization.update({ where: { id: org.id }, data: { trialReminderSent: true } }).catch(() => {})
        continue
      }
      /* Y los días se cuentan hasta el VENCIMIENTO real, no desde el registro:
         una prueba extendida (premio, o los 3 días devueltos tras el corte de
         Meta del 23-26 oct) recibía «último día» con días por delante. Sin
         suscripción, los 14 de siempre desde el registro. */
      const diasParaVencer = sub
        ? (new Date(sub.fechaVencimiento).getTime() - ahora.getTime()) / 86400000
        : 14 - (ahora.getTime() - org.createdAt.getTime()) / 86400000

      // Vencida hace más de 2 días: el aviso ya no es noticia. Se da por
      // avisado sin escribir (había 29 así el 26 oct; les habría llegado tarde).
      if (diasParaVencer <= -2) {
        await prisma.organization.update({ where: { id: org.id }, data: { trialReminderSent: true } }).catch(() => {})
        continue
      }

      // Quedan 2 días (era el día 12 de 14)
      if (diasParaVencer > 0 && diasParaVencer <= 2) {
        try {
          const { subject, html } = emailOnboardingDia12({ nombre: owner.nombre })
          await enviarEmail({ to: owner.email, subject, html })
          resultados.dia12++
        } catch {
          resultados.errors++
        }
      }

      // Se acabó (era el día 14)
      if (diasParaVencer <= 0) {
        try {
          const { subject, html } = emailOnboardingDia14({ nombre: owner.nombre })
          await enviarEmail({ to: owner.email, subject, html })
          await prisma.organization.update({
            where: { id: org.id },
            data: { trialReminderSent: true },
          })
          resultados.dia14++
        } catch {
          resultados.errors++
        }
      }
    }

    return NextResponse.json({ ok: true, ...resultados })
  } catch (error) {
    console.error('[CRON trial-reminder]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
