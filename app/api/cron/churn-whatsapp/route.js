// Envia plantilla de WhatsApp cuando el plan vence.
// Corre diariamente. Solo envia una vez por org (waChurnSent).
// Cubre trials Y pagantes con uso real (>=1 prestamo).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as wa from '@/lib/bot/whatsapp-cloud'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'

const CRON_SECRET = process.env.CRON_SECRET
const TEMPLATE = 'plan_vencido'
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'es'
const LINK_PLANES = 'https://app.control-finanzas.com/configuracion/plan'

export async function POST(req) {
  const secret = req.headers.get('x-cron-secret')
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  if (!wa.configurado()) {
    return NextResponse.json({ error: 'WhatsApp no configurado' }, { status: 500 })
  }

  const ahora = new Date()
  const hace7d = new Date(ahora.getTime() - 7 * 86400000)
  const res = { candidatos: 0, enviados: 0, sinTelefono: 0, errores: 0 }

  try {
    const orgs = await prisma.organization.findMany({
      where: {
        activo: true,
        waChurnSent: false,
        suscripciones: {
          some: {
            fechaVencimiento: { lt: ahora, gte: hace7d },
          },
        },
      },
      include: {
        users: {
          where: { rol: 'owner' },
          select: { nombre: true, telefono: true },
          take: 1,
        },
        _count: { select: { prestamos: true, clientes: true } },
        suscripciones: {
          orderBy: { fechaVencimiento: 'desc' },
          take: 1,
          select: { fechaVencimiento: true, plan: true },
        },
      },
    })

    for (const org of orgs) {
      const owner = org.users[0]
      if (!owner) continue
      if (org._count.prestamos < 1 && org._count.clientes < 1) continue

      res.candidatos++

      const tel = owner.telefono ?? org.telefono
      if (!tel) {
        res.sinTelefono++
        continue
      }

      try {
        const nombre = (owner.nombre || 'amigo').split(' ')[0]
        await wa.sendTemplate(tel, TEMPLATE, {
          nombre,
          link: LINK_PLANES,
        }, TEMPLATE_LANG)

        await prisma.organization.update({
          where: { id: org.id },
          data: { waChurnSent: true },
        })

        res.enviados++
        console.log(`[Churn WA] Enviado a ${owner.nombre} (${org.nombre})`)
      } catch (e) {
        res.errores++
        console.error(`[Churn WA] Error ${org.nombre}: ${e.message}`)
      }
    }

    return NextResponse.json({ ok: true, ...res })
  } catch (error) {
    console.error('[CRON churn-whatsapp]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
