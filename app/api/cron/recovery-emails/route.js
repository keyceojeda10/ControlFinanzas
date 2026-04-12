// app/api/cron/recovery-emails/route.js — Emails de recuperación post-expiración
// Secuencia: día 17 (amigable), día 21 (oferta extensión), día 30 (último aviso)
// Llamar diariamente: curl -X POST -H "x-cron-secret: $CRON_SECRET" https://app.control-finanzas.com/api/cron/recovery-emails

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  enviarEmail,
  emailRecuperacionDia17,
  emailRecuperacionDia21,
  emailRecuperacionDia30,
} from '@/lib/email'
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
  const resultados = { dia17: 0, dia21: 0, dia30: 0, errors: 0 }

  try {
    // Find expired trial orgs that haven't completed recovery sequence
    // Only target orgs that never paid (montoCOP = 0 or no active subscription)
    const orgs = await prisma.organization.findMany({
      where: {
        trialReminderSent: true,     // trial sequence already completed
        recoveryEmailStep: { lt: 3 }, // hasn't received all 3 recovery emails
        suscripciones: {
          none: {
            montoCOP: { gt: 0 },     // never paid
          },
        },
      },
      include: {
        users: {
          where: { rol: 'owner' },
          select: { id: true, nombre: true, email: true, emailsMarketing: true },
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
      if (!owner.emailsMarketing) continue

      // Day 17: friendly reminder (step 0 → 1)
      if (diasDesdeRegistro >= 17 && org.recoveryEmailStep === 0) {
        try {
          const { subject, html } = emailRecuperacionDia17({
            nombre: owner.nombre,
            clientesCreados: org._count.clientes,
            prestamosCreados: org._count.prestamos,
            userId: owner.id,
          })
          await enviarEmail({ to: owner.email, subject, html })
          await prisma.organization.update({
            where: { id: org.id },
            data: { recoveryEmailStep: 1 },
          })
          resultados.dia17++
        } catch {
          resultados.errors++
        }
      }

      // Day 21: offer extension (step 1 → 2)
      if (diasDesdeRegistro >= 21 && org.recoveryEmailStep === 1) {
        try {
          const { subject, html } = emailRecuperacionDia21({
            nombre: owner.nombre,
            userId: owner.id,
          })
          await enviarEmail({ to: owner.email, subject, html })
          await prisma.organization.update({
            where: { id: org.id },
            data: { recoveryEmailStep: 2 },
          })
          resultados.dia21++
        } catch {
          resultados.errors++
        }
      }

      // Day 30: final notice (step 2 → 3)
      if (diasDesdeRegistro >= 30 && org.recoveryEmailStep === 2) {
        try {
          const { subject, html } = emailRecuperacionDia30({
            nombre: owner.nombre,
            clientesCreados: org._count.clientes,
            prestamosCreados: org._count.prestamos,
            userId: owner.id,
          })
          await enviarEmail({ to: owner.email, subject, html })
          await prisma.organization.update({
            where: { id: org.id },
            data: { recoveryEmailStep: 3 },
          })
          resultados.dia30++
        } catch {
          resultados.errors++
        }
      }
    }

    return NextResponse.json({ ok: true, ...resultados })
  } catch (error) {
    console.error('[CRON recovery-emails]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
