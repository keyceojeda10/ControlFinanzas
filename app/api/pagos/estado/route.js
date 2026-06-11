// app/api/pagos/estado/route.js — Estado de suscripción actual
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { LIMITES_USUARIOS }  from '@/lib/planes'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización' }, { status: 400 })

  const [sub, org, subRecurrente] = await Promise.all([
    // Suscripcion mas reciente, ignorando las pending (pago iniciado pero no completado)
    prisma.suscripcion.findFirst({
      where: {
        organizationId: orgId,
        OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
      },
      orderBy: { fechaVencimiento: 'desc' },
    }),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { descuento: true, cobradoresExtra: true },
    }),
    prisma.suscripcion.findFirst({
      where: {
        organizationId: orgId,
        tipo: 'recurrente',
        estado: 'activa',
        mpStatus: 'authorized',
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const descuento = org?.descuento ?? 0
  const cobradoresExtra = org?.cobradoresExtra ?? 0

  if (!sub) {
    const plan = session.user.plan ?? 'starter'
    return NextResponse.json({
      plan,
      estado:           'pendiente',
      fechaVencimiento: null,
      diasRestantes:    0,
      mercadopagoId:    null,
      descuento,
      tipo:             null,
      mpStatus:         null,
      proximoCobroAt:   null,
      preapprovalId:    null,
      canceladaAt:      null,
      tieneRecurrenteActiva: false,
      cobradoresExtra,
      limiteUsuarios: (LIMITES_USUARIOS[plan] ?? 1) + cobradoresExtra,
    })
  }

  // Usar la suscripción recurrente si existe, si no la más reciente
  const subPrincipal = subRecurrente || sub

  const diasRestantes = Math.ceil(
    (new Date(subPrincipal.fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24)
  )

  return NextResponse.json({
    plan:             subPrincipal.plan,
    estado:           subPrincipal.estado,
    fechaVencimiento: subPrincipal.fechaVencimiento,
    diasRestantes,
    mercadopagoId:    subPrincipal.mercadopagoId,
    descuento,
    tipo:             subPrincipal.tipo,
    mpStatus:         subPrincipal.mpStatus,
    proximoCobroAt:   subPrincipal.proximoCobroAt,
    preapprovalId:    subPrincipal.preapprovalId,
    canceladaAt:      subPrincipal.canceladaAt,
    tieneRecurrenteActiva: !!subRecurrente && !subRecurrente.canceladaAt,
    cobradoresExtra,
    limiteUsuarios: (LIMITES_USUARIOS[subPrincipal.plan] ?? 1) + cobradoresExtra,
  })
}
