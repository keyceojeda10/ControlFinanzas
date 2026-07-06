import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLANES_CONFIG, PLANES_VALIDOS } from '@/lib/planes'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return NextResponse.json({ error: 'Solo el administrador puede cambiar de plan' }, { status: 403 })
  }

  const { plan } = await request.json().catch(() => ({}))
  if (!plan || !PLANES_VALIDOS.includes(plan)) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { plan: true, onboardingStep: true },
  })

  if (!org) {
    return NextResponse.json({ error: 'Organizacion no encontrada' }, { status: 404 })
  }

  // Solo permitir cambio durante onboarding (step < 99)
  if ((org.onboardingStep ?? 0) >= 99) {
    return NextResponse.json({ error: 'El onboarding ya fue completado. Cambia de plan desde la página de planes.' }, { status: 400 })
  }

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { plan },
  })

  return NextResponse.json({
    ok: true,
    plan,
    nombre: PLANES_CONFIG[plan]?.nombre ?? plan,
  })
}
