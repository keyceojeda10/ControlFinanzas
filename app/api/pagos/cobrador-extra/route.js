// app/api/pagos/cobrador-extra/route.js — Crear preferencia para cobrador extra
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { preferenceApi, PLANES, buildBackUrls, webhookUrl } from '@/lib/mercadopago'
import { getCurrency, hasOnlinePayment } from '@/lib/i18n'
import { getPrecioCobradorExtra } from '@/lib/planes'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización asociada' }, { status: 400 })

  const plan = session.user.plan
  const planInfo = PLANES[plan]
  if (!planInfo || planInfo.cobradorExtra <= 0) {
    return NextResponse.json({ error: 'Tu plan no permite agregar cobradores extra' }, { status: 403 })
  }

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { country: true } })
  const country = org?.country ?? 'co'
  if (!hasOnlinePayment(country)) {
    return NextResponse.json({ error: 'Pago en linea no disponible para tu pais. Contacta soporte.' }, { status: 400 })
  }
  const precio = getPrecioCobradorExtra(country)

  const preference = await preferenceApi.create({
    body: {
      items: [
        {
          id:          `cobrador-extra-${orgId}`,
          title:       'Control Finanzas - Cobrador adicional (1 mes)',
          unit_price:  precio,
          quantity:    1,
          currency_id: getCurrency(country),
        },
      ],
      back_urls:   buildBackUrls(),
      auto_return: 'approved',
      metadata: {
        organizationId: orgId,
        tipo:           'cobrador_extra',
        userId:         session.user.id,
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
