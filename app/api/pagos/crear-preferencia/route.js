// app/api/pagos/crear-preferencia/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { preferenceApi, PLANES, buildBackUrls, webhookUrl } from '@/lib/mercadopago'
import { getCurrency, hasOnlinePayment } from '@/lib/i18n'
import { precioPeriodo, inicioDelPeriodo, selectPrecio } from '@/lib/precio-plan'
import { ultimaSuscripcion } from '@/lib/cobro-intento'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización asociada' }, { status: 400 })

  const { plan, periodo = 'mensual' } = await req.json()
  const planInfo = PLANES[plan]
  if (!planInfo) return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: selectPrecio,
  })

  const country = org?.country ?? 'co'
  if (!hasOnlinePayment(country)) {
    return NextResponse.json({ error: 'Pago en línea no disponible para tu país. Contacta soporte.' }, { status: 400 })
  }

  /* ⚠ EL PRECIO LO DICE lib/precio-plan.js, igual que al cobro automático.
     Aquí vivía `lista × (1 − descuento %)`, un campo que no usaba nadie,
     mientras el panel ponía precios a mano que ninguna pantalla conocía. El
     periodo empieza donde lo extendería el pago: si el preferencial termina a
     mitad de un trimestre, cada mes paga lo suyo. */
  const ultima           = await ultimaSuscripcion(orgId)
  const esAnual          = periodo === 'anual'
  const esTrimestral     = periodo === 'trimestral'
  const precioFinal      = precioPeriodo(org, plan, periodo, inicioDelPeriodo(ultima)).total

  const tituloItem = esAnual
    ? `Control Finanzas - Plan ${planInfo.nombre} (12 meses — 2 gratis)`
    : esTrimestral
    ? `Control Finanzas - Plan ${planInfo.nombre} (3 meses)`
    : `Control Finanzas - Plan ${planInfo.nombre}`

  const preference = await preferenceApi.create({
    body: {
      items: [
        {
          id:          `plan-${plan}-${periodo}`,
          title:       tituloItem,
          unit_price:  precioFinal,
          quantity:    1,
          currency_id: getCurrency(country),
        },
      ],
      back_urls:   buildBackUrls(),
      auto_return: 'approved',
      metadata: {
        organizationId: orgId,
        plan,
        periodo,
        userId: session.user.id,
      },
      notification_url: webhookUrl(),
      statement_descriptor: 'Control Finanzas',
    },
  })

  return NextResponse.json({
    preferenceId: preference.id,
    initPoint:    preference.init_point,
  })
}
