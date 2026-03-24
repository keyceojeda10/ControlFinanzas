import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enviarEmail, emailOnboardingDia12, emailOnboardingDia14 } from '@/lib/email'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'

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
      },
    })

    for (const org of orgs) {
      const diasDesdeRegistro = Math.floor(
        (ahora.getTime() - org.createdAt.getTime()) / 86400000
      )
      const owner = org.users[0]
      if (!owner?.email) continue

      // Day 12 = 2 days left
      if (diasDesdeRegistro >= 12 && diasDesdeRegistro < 14) {
        try {
          const { subject, html } = emailOnboardingDia12({ nombre: owner.nombre })
          await enviarEmail({ to: owner.email, subject, html })
          resultados.dia12++
        } catch {
          resultados.errors++
        }
      }

      // Day 14 = last day
      if (diasDesdeRegistro >= 14) {
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
