// app/api/cron/onboarding-emails/route.js — Emails de onboarding secuenciados (14 días)
// Llamar diariamente con: curl -X POST https://app.control-finanzas.com/api/cron/onboarding-emails?secret=CRON_SECRET

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  enviarEmail,
  emailOnboardingDia1,
  emailOnboardingDia3,
  emailOnboardingDia7,
  emailOnboardingDia12,
  emailOnboardingDia14,
} from '@/lib/email'

const CRON_SECRET = process.env.CRON_SECRET || 'cron_controlfinanzas_2026'

export async function POST(req) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const ahora = new Date()
  const results = { dia1: 0, dia3: 0, dia7: 0, dia12: 0, dia14: 0 }

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

  // ─── Día 7: tip avanzado + recordatorio mitad de prueba ─────────────────────
  const { inicio: i7, fin: f7 } = rangoDelDia(7)
  const orgs7 = await prisma.organization.findMany({
    where: { createdAt: { gte: i7, lte: f7 } },
    include: {
      users: { where: { rol: 'owner' }, select: { nombre: true, email: true } },
    },
  })
  for (const org of orgs7) {
    const owner = org.users[0]
    if (owner) {
      const { subject, html } = emailOnboardingDia7({ nombre: owner.nombre })
      await enviarEmail({ to: owner.email, subject, html }).catch(() => {})
      results.dia7++
    }
  }

  // ─── Día 12: aviso de fin de prueba (vence en 2 días) ───────────────────────
  const { inicio: i12, fin: f12 } = rangoDelDia(12)
  const orgs12 = await prisma.organization.findMany({
    where: { createdAt: { gte: i12, lte: f12 } },
    include: {
      users: { where: { rol: 'owner' }, select: { nombre: true, email: true } },
    },
  })
  for (const org of orgs12) {
    const owner = org.users[0]
    if (owner) {
      const { subject, html } = emailOnboardingDia12({ nombre: owner.nombre })
      await enviarEmail({ to: owner.email, subject, html }).catch(() => {})
      results.dia12++
    }
  }

  // ─── Día 14: último día de prueba ───────────────────────────────────────────
  const { inicio: i14, fin: f14 } = rangoDelDia(14)
  const orgs14 = await prisma.organization.findMany({
    where: { createdAt: { gte: i14, lte: f14 } },
    include: {
      users: { where: { rol: 'owner' }, select: { nombre: true, email: true } },
    },
  })
  for (const org of orgs14) {
    const owner = org.users[0]
    if (owner) {
      const { subject, html } = emailOnboardingDia14({ nombre: owner.nombre })
      await enviarEmail({ to: owner.email, subject, html }).catch(() => {})
      results.dia14++
    }
  }

  return NextResponse.json({ ok: true, enviados: results })
}
