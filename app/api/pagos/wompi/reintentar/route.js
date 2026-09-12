// app/api/pagos/wompi/reintentar/route.js — «Reintentar el cobro» con el medio
// que ya está guardado.
//
// ══ POR QUÉ ════════════════════════════════════════════════════════════════
//
// Desde el 12 sep 2026 un cobro rechazado cierra el acceso al vencer. El dueño:
//
//   «avisarle de que no hay saldo y que la aplicación se cerró. Obviamente, un
//    botón para reintentar ese pago automático, o comunicarse o cambiar el
//    medio de pago, pero no poder darle acceso completo»
//
// Este es ese botón. Recargó el Nequi, pulsa, y se cobra en el acto: no tiene
// que esperar al cron de mañana ni volver a autorizar nada.
//
//   POST → manda el cobro (con el mismo candado que el cron)
//   GET  → ¿en qué va? La pantalla pregunta hasta que la pasarela conteste.
//
// ⚠ AQUÍ NO SE ABRE NADA. El acceso vuelve cuando el pago está APROBADO y
// `activarPlanPagado` mueve la fecha; pulsar el botón no da ni un minuto.

import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { wompiConfigurado } from '@/lib/wompi'
import { cobrarAhoraSiToca, reconciliar, ultimaSuscripcion } from '@/lib/cobro-intento'
import { selectResumenCobro, resumenCobro, vencimientoEfectivo, motivoLegible } from '@/lib/cobro-automatico'

/** Cobrar compromete plata del negocio: solo el dueño. */
async function soloElDueno() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }
  if (session.user.rol !== 'owner') {
    return { error: NextResponse.json({ error: 'Solo el dueño puede reintentar el cobro' }, { status: 403 }) }
  }
  if (!wompiConfigurado()) {
    return { error: NextResponse.json({ error: 'Los pagos no están configurados' }, { status: 503 }) }
  }
  return { session }
}

export async function POST() {
  const { error, session } = await soloElDueno()
  if (error) return error

  let r
  try {
    r = await cobrarAhoraSiToca({
      orgId: session.user.organizationId,
      minutosEntreIntentos: 2,
      origen: 'reintentar',
    })
  } catch (e) {
    console.error('[wompi-reintentar] falló:', e.message)
    return NextResponse.json({ error: 'No pudimos contactar la pasarela. Intenta en unos minutos.' }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    resultado: r.resultado,
    motivo: ['rechazado', 'error'].includes(r.resultado) ? motivoLegible(r.motivo) : null,
    segundos: r.segundos ?? null,
  })
}

export async function GET() {
  const { error, session } = await soloElDueno()
  if (error) return error
  const orgId = session.user.organizationId

  /* Si el webhook no ha llegado, se le pregunta a Wompi: el cliente que pagó no
     puede quedarse fuera esperando a un aviso que se perdió. */
  const enVuelo = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, cobroRefPendiente: true, cobroTxPendiente: true, cobroUltimoIntento: true },
  })
  if (enVuelo?.cobroRefPendiente) {
    await reconciliar(enVuelo).catch((e) => console.error('[wompi-reintentar] reconciliar:', e.message))
  }

  const [org, sub] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: selectResumenCobro }),
    ultimaSuscripcion(orgId),
  ])
  const cobro = resumenCobro(org, sub?.fechaVencimiento ?? null)
  const hasta = sub?.fechaVencimiento ? vencimientoEfectivo(sub.fechaVencimiento, org) : null

  return NextResponse.json({
    ok: true,
    pendiente: cobro.pendiente,
    rechazo: cobro.rechazo,
    /* La misma cuenta que la puerta: si esto dice que sí, el layout deja entrar. */
    alDia: !cobro.pendiente && !cobro.rechazo && Boolean(hasta && new Date(hasta) > new Date()),
  })
}
