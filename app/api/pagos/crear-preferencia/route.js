// app/api/pagos/crear-preferencia/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { preferenceApi, PLANES, buildBackUrls, webhookUrl } from '@/lib/mercadopago'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { plan, periodo = 'mensual' } = await req.json()
  const planInfo = PLANES[plan]
  if (!planInfo) return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })

  // Consultar descuento de la organización
  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { descuento: true },
  })

  const descuentoOrg       = org?.descuento ?? 0
  const esTrimestral       = periodo === 'trimestral'
  const descuentoTrimestral = esTrimestral ? 10 : 0
  const descuentoFinal     = Math.max(descuentoOrg, descuentoTrimestral)
  const meses              = esTrimestral ? 3 : 1
  const precioBase         = planInfo.precio * meses
  const precioFinal        = Math.round(precioBase * (1 - descuentoFinal / 100))

  const tituloItem = esTrimestral
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
          currency_id: 'COP',
        },
      ],
      back_urls:   buildBackUrls(),
      auto_return: 'approved',
      metadata: {
        organizationId: session.user.organizationId,
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
