// app/api/cron/recovery-whatsapp/route.js
// Envia plantilla de recuperacion por WhatsApp a owners de trials vencidos
// que usaron la app de verdad (>=5 prestamos, login reciente).
// Corre diariamente. Solo envia una vez por org (waRecoverySent).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as wa from '@/lib/bot/whatsapp-cloud'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'

const CRON_SECRET = process.env.CRON_SECRET
const TEMPLATE = process.env.WHATSAPP_TEMPLATE_RECUPERACION || 'recuperacion_trial'
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'es'

export async function POST(req) {
  const secret = req.headers.get('x-cron-secret')
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  if (!wa.configurado()) {
    return NextResponse.json({ error: 'WhatsApp Cloud API no configurado' }, { status: 500 })
  }

  const ahora = new Date()
  const hace30d = new Date(ahora.getTime() - 30 * 86400000)
  const resultados = { candidatos: 0, enviados: 0, sinTelefono: 0, errores: 0 }

  try {
    const orgs = await prisma.organization.findMany({
      where: {
        activo: true,
        waRecoverySent: false,
        suscripciones: {
          every: {
            OR: [
              { fechaVencimiento: { lt: ahora } },
              { estado: { not: 'activa' } },
            ],
          },
        },
      },
      include: {
        users: {
          where: { rol: 'owner' },
          select: { id: true, nombre: true, telefono: true, lastLoginAt: true },
          take: 1,
        },
        _count: { select: { prestamos: true, clientes: true } },
        suscripciones: {
          orderBy: { fechaVencimiento: 'desc' },
          take: 1,
          select: { fechaVencimiento: true, montoCOP: true },
        },
      },
    })

    for (const org of orgs) {
      const owner = org.users[0]
      if (!owner) continue

      // Filtro: actividad real
      if (org._count.prestamos < 5) continue

      // Filtro: login en los ultimos 30 dias
      if (!owner.lastLoginAt || new Date(owner.lastLoginAt) < hace30d) continue

      // Filtro: nunca pago (montoCOP = 0 o null en todas las subs)
      const pagaron = org.suscripciones.some(s => s.montoCOP && s.montoCOP > 0)
      if (pagaron) continue

      resultados.candidatos++

      if (!owner.telefono) {
        resultados.sinTelefono++
        continue
      }

      try {
        const nombre = (owner.nombre || 'amigo').split(' ')[0]
        await wa.sendTemplate(owner.telefono, TEMPLATE, { nombre }, TEMPLATE_LANG)

        await prisma.organization.update({
          where: { id: org.id },
          data: { waRecoverySent: true },
        })

        resultados.enviados++
        console.log(`[Recovery WA] Enviado a ${owner.nombre} (${org.nombre})`)
      } catch (e) {
        resultados.errores++
        console.error(`[Recovery WA] Error ${owner.nombre}: ${e.message}`)
      }
    }

    return NextResponse.json({ ok: true, ...resultados })
  } catch (error) {
    console.error('[CRON recovery-whatsapp]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
