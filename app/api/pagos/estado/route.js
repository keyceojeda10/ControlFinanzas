// app/api/pagos/estado/route.js — Estado de suscripción actual
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización' }, { status: 400 })

  const [sub, org] = await Promise.all([
    prisma.suscripcion.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { descuento: true },
    }),
  ])

  const descuento = org?.descuento ?? 0

  if (!sub) {
    return NextResponse.json({
      plan:             session.user.plan ?? 'basic',
      estado:           'pendiente',
      fechaVencimiento: null,
      diasRestantes:    0,
      mercadopagoId:    null,
      descuento,
    })
  }

  const diasRestantes = Math.ceil(
    (new Date(sub.fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24)
  )

  return NextResponse.json({
    plan:             sub.plan,
    estado:           sub.estado,
    fechaVencimiento: sub.fechaVencimiento,
    diasRestantes,
    mercadopagoId:    sub.mercadopagoId,
    descuento,
  })
}
