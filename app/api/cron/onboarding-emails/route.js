// app/api/cron/onboarding-emails/route.js — Emails de onboarding secuenciados
// Llamar diariamente con: curl -X POST https://app.control-finanzas.com/api/cron/onboarding-emails?secret=CRON_SECRET

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enviarEmail, emailOnboardingDia1, emailOnboardingDia3, emailOnboardingDia5 } from '@/lib/email'

const CRON_SECRET = process.env.CRON_SECRET || 'cron_controlfinanzas_2026'

export async function POST(req) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const ahora = new Date()
  const results = { dia1: 0, dia3: 0, dia5: 0 }

  // Helper: rango de fechas para "exactamente N días atrás" (medianoche a medianoche)
  const rangoDelDia = (diasAtras) => {
    const inicio = new Date(ahora)
    inicio.setDate(inicio.getDate() - diasAtras)
    inicio.setHours(0, 0, 0, 0)
    const fin = new Date(inicio)
    fin.setHours(23, 59, 59, 999)
    return { inicio, fin }
  }

  // ─── Día 1: bienvenida con guía de primeros pasos ───────────────────────────
  const { inicio: i1, fin: f1 } = rangoDelDia(1)
  const orgs1 = await prisma.organization.findMany({
    where: { createdAt: { gte: i1, lte: f1 } },
    include: {
      users: { where: { rol: 'owner' }, select: { nombre: true, email: true } },
    },
  })
  for (const org of orgs1) {
    const owner = org.users[0]
    if (owner) {
      const { subject, html } = emailOnboardingDia1({ nombre: owner.nombre })
      await enviarEmail({ to: owner.email, subject, html }).catch(() => {})
      results.dia1++
    }
  }

  // ─── Día 3: seguimiento adaptado al progreso (clientes creados) ─────────────
  const { inicio: i3, fin: f3 } = rangoDelDia(3)
  const orgs3 = await prisma.organization.findMany({
    where: { createdAt: { gte: i3, lte: f3 } },
    include: {
      users: { where: { rol: 'owner' }, select: { nombre: true, email: true } },
      _count: { select: { clientes: true } },
    },
  })
  for (const org of orgs3) {
    const owner = org.users[0]
    if (owner) {
      const { subject, html } = emailOnboardingDia3({
        nombre: owner.nombre,
        clientesCreados: org._count.clientes,
      })
      await enviarEmail({ to: owner.email, subject, html }).catch(() => {})
      results.dia3++
    }
  }

  // ─── Día 5: aviso de fin de prueba gratuita (vence en 2 días) ───────────────
  const { inicio: i5, fin: f5 } = rangoDelDia(5)
  const orgs5 = await prisma.organization.findMany({
    where: { createdAt: { gte: i5, lte: f5 } },
    include: {
      users: { where: { rol: 'owner' }, select: { nombre: true, email: true } },
    },
  })
  for (const org of orgs5) {
    const owner = org.users[0]
    if (owner) {
      const { subject, html } = emailOnboardingDia5({ nombre: owner.nombre })
      await enviarEmail({ to: owner.email, subject, html }).catch(() => {})
      results.dia5++
    }
  }

  return NextResponse.json({ ok: true, enviados: results })
}
