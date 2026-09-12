// app/api/pagos/estado/route.js — Estado de suscripción actual
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { LIMITES_USUARIOS }  from '@/lib/planes'
import { selectResumenCobro, resumenCobro, vencimientoEfectivo } from '@/lib/cobro-automatico'

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
      select: { descuento: true, cobradoresExtra: true, plan: true, planOriginal: true, planDemoHasta: true, ...selectResumenCobro },
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
  const enTrial = !!(org?.planOriginal && org?.planDemoHasta && new Date(org.planDemoHasta) > new Date())
  const diasTrial = enTrial ? Math.ceil((new Date(org.planDemoHasta) - new Date()) / (1000 * 60 * 60 * 24)) : 0
  /* El Nequi o la tarjeta guardados en Wompi. Sin esto los avisos de «tu plan
     vence» solo reconocían la recurrencia vieja de MercadoPago, y le pedían
     pagar cada rato a quien ya había dejado el cobro puesto (12 sep 2026).
     ⚠ Se mide contra `sub`, la misma suscripción que mira la puerta de acceso,
     no contra `subPrincipal`: el rechazo decide si se cierra, y tiene que
     decirlo igual aquí que allí. */
  const cobroAutomatico = {
    ...resumenCobro(org, sub?.fechaVencimiento ?? null),
    esDueno: session.user.rol === 'owner',
  }

  if (!sub) {
    const plan = session.user.plan ?? 'starter'
    return NextResponse.json({
      plan: enTrial ? org.plan : plan,
      estado:           'pendiente',
      fechaVencimiento: null,
      diasRestantes:    0,
      accesoHasta:      null,
      mercadopagoId:    null,
      descuento,
      tipo:             null,
      mpStatus:         null,
      proximoCobroAt:   null,
      preapprovalId:    null,
      canceladaAt:      null,
      tieneRecurrenteActiva: false,
      cobradoresExtra,
      limiteUsuarios: (LIMITES_USUARIOS[enTrial ? org.plan : plan] ?? 1) + cobradoresExtra,
      enTrial,
      diasTrial,
      planAlTerminar: enTrial ? org.planOriginal : null,
      cobroAutomatico,
    })
  }

  // Usar la suscripción recurrente si existe, si no la más reciente
  const subPrincipal = subRecurrente || sub

  const diasRestantes = Math.ceil(
    (new Date(subPrincipal.fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24)
  )

  return NextResponse.json({
    plan:             enTrial ? org.plan : subPrincipal.plan,
    estado:           subPrincipal.estado,
    fechaVencimiento: subPrincipal.fechaVencimiento,
    diasRestantes,
    /* Hasta cuándo deja entrar la puerta: el vencimiento más la gracia, y sin
       gracia si la pasarela rechazó el cobro. */
    accesoHasta:      vencimientoEfectivo(sub.fechaVencimiento, org),
    mercadopagoId:    subPrincipal.mercadopagoId,
    descuento,
    tipo:             subPrincipal.tipo,
    mpStatus:         subPrincipal.mpStatus,
    proximoCobroAt:   subPrincipal.proximoCobroAt,
    preapprovalId:    subPrincipal.preapprovalId,
    canceladaAt:      subPrincipal.canceladaAt,
    tieneRecurrenteActiva: !!subRecurrente && !subRecurrente.canceladaAt,
    cobradoresExtra,
    limiteUsuarios: (LIMITES_USUARIOS[enTrial ? org.plan : subPrincipal.plan] ?? 1) + cobradoresExtra,
    enTrial,
    diasTrial,
    planAlTerminar: enTrial ? org.planOriginal : null,
    cobroAutomatico,
  })
}
