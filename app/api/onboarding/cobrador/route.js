// app/api/onboarding/cobrador/route.js
// Dismiss persistente del onboarding de cobradores.
// Usa el campo User.onboardingCompletado (reutilizado) para sincronizar
// el estado entre dispositivos en vez de depender solo de localStorage.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ dismissed: true })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompletado: true, rol: true },
  })

  // Solo cobradores ven este onboarding; para otros, ocultar siempre
  if (user?.rol !== 'cobrador') {
    return NextResponse.json({ dismissed: true })
  }

  return NextResponse.json({ dismissed: Boolean(user?.onboardingCompletado) })
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { onboardingCompletado: true },
  })

  return NextResponse.json({ ok: true })
}
