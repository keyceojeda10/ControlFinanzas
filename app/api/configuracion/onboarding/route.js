import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ step: 99 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { onboardingStep: true },
  })

  return NextResponse.json({ step: org?.onboardingStep ?? 0 })
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { step } = await request.json().catch(() => ({}))
  const stepValue = typeof step === 'number' ? step : 99

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { onboardingStep: stepValue },
  })

  // Also mark user's old field for backwards compat
  if (stepValue >= 99) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { onboardingCompletado: true },
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, step: stepValue })
}
