// app/api/pagos/crear-preferencia/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { preferenceApi, PLANES, buildBackUrls, webhookUrl } from '@/lib/mercadopago'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { plan } = await req.json()
  const planInfo = PLANES[plan]
  if (!planInfo) return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })

  const preference = await preferenceApi.create({
    body: {
      items: [
        {
          id:          `plan-${plan}`,
          title:       `Control Finanzas - Plan ${planInfo.nombre}`,
          unit_price:  planInfo.precio,
          quantity:    1,
          currency_id: 'COP',
        },
      ],
      back_urls:   buildBackUrls(),
      auto_return: 'approved',
      metadata: {
        organizationId: session.user.organizationId,
        plan,
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
