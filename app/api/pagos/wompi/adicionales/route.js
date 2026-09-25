// app/api/pagos/wompi/adicionales/route.js — agregar cobradores o rutas con el
// plan ya pagado: el checkout de Wompi por los días que faltan para renovar.
//
// El cupo NO se abre aquí: lo abre el webhook cuando Wompi aprueba
// (`aplicarCompraAdicionales`). Desde la renovación van con el plan.

import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { estadoAdicionales, leerCantidad, MAX_ADICIONALES } from '@/lib/adicionales'
import { prorrateoAdicionales } from '@/lib/precio-plan'
import { firmaIntegridad, wompiPublicKey, wompiConfigurado, WOMPI_CHECKOUT_URL, referenciaDeAdicionales } from '@/lib/wompi'

const BASE = process.env.NEXTAUTH_URL || 'https://app.control-finanzas.com'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') {
    return NextResponse.json({ error: 'Solo el dueño de la cuenta puede agregar cobradores o rutas' }, { status: 403 })
  }
  if (!wompiConfigurado()) {
    return NextResponse.json({ error: 'Pagos con Wompi no estan configurados. Contacta soporte.' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const cobradores = leerCantidad(body?.cobradores ?? 0)
  const rutas = leerCantidad(body?.rutas ?? 0)
  if (cobradores == null || rutas == null || cobradores + rutas <= 0) {
    return NextResponse.json({ error: 'Elige cuántos cobradores o rutas agregar' }, { status: 400 })
  }

  const orgId = session.user.organizationId
  const e = await estadoAdicionales(orgId)
  if (!e) return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
  if (e.gateway !== 'wompi') {
    return NextResponse.json({ error: 'En tu país los adicionales se piden por WhatsApp.' }, { status: 403 })
  }
  if (!e.admite) {
    return NextResponse.json({ error: 'Tu plan no admite cobradores ni rutas adicionales. Crecimiento en adelante sí.' }, { status: 400 })
  }
  if (e.adicionales.cobradores + cobradores > MAX_ADICIONALES || e.adicionales.rutas + rutas > MAX_ADICIONALES) {
    return NextResponse.json({ error: `Máximo ${MAX_ADICIONALES} de cada uno. Escríbenos si necesitas más.` }, { status: 400 })
  }
  if (!e.pagado) {
    /* Sin plan pagado no hay «días que faltan»: se eligen y van con el plan. */
    return NextResponse.json({ error: 'Todavía no tienes un plan pagado: los adicionales se pagan junto con el plan.', sinPlanPagado: true }, { status: 409 })
  }

  if (e.cobrandoPlan) {
    /* El cobro del plan va con los adicionales de ahora; uno comprado mientras
       tanto quedaría fuera de la renovación. */
    return NextResponse.json({ error: 'Estamos cobrando tu plan en este momento. Intenta de nuevo en unos minutos.' }, { status: 409 })
  }

  const p = prorrateoAdicionales({ cobradores, rutas }, e.plan, e.country, e.vence)
  if (!(p.monto > 0)) {
    return NextResponse.json({ error: 'Tu plan vence hoy: agrégalos al renovar.', sinPlanPagado: true }, { status: 409 })
  }

  const referencia = referenciaDeAdicionales(orgId, e.plan, { cobradores, rutas })
  const montoCentavos = Math.round(p.monto * 100)
  const moneda = 'COP'
  return NextResponse.json({
    publicKey:   wompiPublicKey(),
    referencia,
    montoCentavos,
    moneda,
    firma:       firmaIntegridad(referencia, montoCentavos, moneda),
    checkoutUrl: WOMPI_CHECKOUT_URL,
    /* `antes`: cuántos tenía al pagar. La pantalla dice «listo» cuando la base
       pasa de ahí; guardado en el navegador se perdía si Wompi volvía a otro. */
    redirectUrl: `${BASE}/configuracion/plan?wompi=adicionales&antes=${e.adicionales.cobradores + e.adicionales.rutas}`,
    dias:        p.dias,
    monto:       p.monto,
    mensual:     p.mensual,
  })
}
