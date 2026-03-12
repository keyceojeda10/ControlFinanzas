// app/api/pagos/crear-preferencia/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { preferenceApi, PLANES, buildBackUrls, webhookUrl } from '@/lib/mercadopago'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización asociada' }, { status: 400 })

  const { plan, periodo = 'mensual' } = await req.json()
  const planInfo = PLANES[plan]
  if (!planInfo) return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })

  // Consultar descuento de la organización
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { descuento: true },
  })

  const descuentoOrg       = org?.descuento ?? 0
  const esAnual            = periodo === 'anual'
  const esTrimestral       = periodo === 'trimestral'
  const descuentoPeriodo   = esAnual ? 17 : esTrimestral ? 10 : 0
  const descuentoFinal     = esAnual ? 0 : Math.max(descuentoOrg, descuentoPeriodo)
  const meses              = esAnual ? 12 : esTrimestral ? 3 : 1
  const mesesCobrados      = esAnual ? 10 : meses
  const precioBase         = planInfo.precio * meses
  const precioFinal        = esAnual
    ? planInfo.precio * mesesCobrados
    : Math.round(precioBase * (1 - descuentoFinal / 100))

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
          currency_id: 'COP',
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
