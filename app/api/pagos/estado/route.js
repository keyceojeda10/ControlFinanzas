// app/api/pagos/estado/route.js — Estado de suscripción actual
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { cuposDe, selectCupos } from '@/lib/planes'
import { selectResumenCobro, resumenCobro, vencimientoEfectivo } from '@/lib/cobro-automatico'
import { selectPrecio, montoDelCobro, estadoPreferencial } from '@/lib/precio-plan'
import { ultimoPago } from '@/lib/cobro-intento'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización' }, { status: 400 })

  const [sub, org, subRecurrente, pagada] = await Promise.all([
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
      select: { ...selectCupos, planOriginal: true, planDemoHasta: true, ...selectResumenCobro, ...selectPrecio },
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
    ultimoPago(orgId),
  ])

  /* ══ LO QUE PAGA, DICHO COMO LO COBRA EL SISTEMA ══════════════════════════
     La pantalla del plan calculaba su propio precio con `descuento` %, que el
     cobro automático no usaba: podía enseñar $39.000 y cobrar otra cosa. Ahora
     las dos preguntan a lib/precio-plan.js. `preferencial` va sin la nota
     interna del panel, y solo mientras dura. */
  const planDelCobro = pagada?.plan ?? org?.planOriginal ?? org?.plan ?? null
  const precio = org && planDelCobro ? montoDelCobro({ org, plan: planDelCobro, pagada, ultima: sub }) : null
  const estadoPref = estadoPreferencial(org)
  const preferencial = estadoPref === 'definitivo' || estadoPref === 'temporal'
    ? { plan: org.precioPreferencialPlan, monto: org.precioPreferencial, hasta: org.precioPreferencialHasta }
    : null
  const proximoCobro = precio
    ? { plan: planDelCobro, monto: precio.monto, montoPlan: precio.montoPlan, adicionales: precio.adicionales, lista: precio.lista, preferencial: precio.preferencial, hasta: precio.hasta }
    : null
  const inicioPeriodo = precio?.inicio ?? null
  const cobradoresExtra = org?.cobradoresExtra ?? 0
  /* Los que paga con el plan: la pantalla del plan los suma al precio de cada
     pago (`precioCheckout`), igual que el servidor. */
  const adicionales = { cobradores: org?.cobradoresAdicionales ?? 0, rutas: org?.rutasAdicionales ?? 0 }
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
      preferencial,
      proximoCobro,
      inicioPeriodo,
      tipo:             null,
      mpStatus:         null,
      proximoCobroAt:   null,
      preapprovalId:    null,
      canceladaAt:      null,
      tieneRecurrenteActiva: false,
      cobradoresExtra,
      adicionales,
      limiteUsuarios: cuposDe(org, enTrial ? org.plan : plan).usuarios,
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
    preferencial,
    proximoCobro,
    inicioPeriodo,
    tipo:             subPrincipal.tipo,
    mpStatus:         subPrincipal.mpStatus,
    proximoCobroAt:   subPrincipal.proximoCobroAt,
    preapprovalId:    subPrincipal.preapprovalId,
    canceladaAt:      subPrincipal.canceladaAt,
    tieneRecurrenteActiva: !!subRecurrente && !subRecurrente.canceladaAt,
    cobradoresExtra,
    adicionales,
    limiteUsuarios: cuposDe(org, enTrial ? org.plan : subPrincipal.plan).usuarios,
    enTrial,
    diasTrial,
    planAlTerminar: enTrial ? org.planOriginal : null,
    cobroAutomatico,
  })
}
