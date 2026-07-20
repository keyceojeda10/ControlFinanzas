// Envia plantilla de WhatsApp a usuarios que se registraron hace 24h+
// y no han creado ningun prestamo (pueden tener clientes pero no operaron).
// Corre diariamente. Solo envia una vez por org (waActivacionSent).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as wa from '@/lib/bot/whatsapp-cloud'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'

const CRON_SECRET = process.env.CRON_SECRET
const TEMPLATE = 'activacion_registro'
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'es'
const SOPORTE = '301 199 3001'

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
  const hace24h = new Date(ahora.getTime() - 24 * 3600000)
  const hace72h = new Date(ahora.getTime() - 72 * 3600000)
  const res = { candidatos: 0, enviados: 0, sinTelefono: 0, errores: 0 }

  try {
    const orgs = await prisma.organization.findMany({
      where: {
        activo: true,
        waActivacionSent: false,
        createdAt: { gte: hace72h, lte: hace24h },
        prestamos: { none: {} },
      },
      include: {
        users: {
          where: { rol: 'owner' },
          select: { nombre: true, telefono: true },
          take: 1,
        },
        _count: { select: { clientes: true } },
      },
    })

    for (const org of orgs) {
      const owner = org.users[0]
      if (!owner) continue

      res.candidatos++

      const tel = owner.telefono ?? org.telefono
      if (!tel) {
        res.sinTelefono++
        continue
      }

      try {
        const nombre = (owner.nombre || 'amigo').split(' ')[0]
        const clientes = org._count.clientes
        await wa.sendTemplate(tel, TEMPLATE, {
          nombre,
          soporte: SOPORTE,
          clientes: String(clientes),
        }, TEMPLATE_LANG)

        await prisma.organization.update({
          where: { id: org.id },
          data: { waActivacionSent: true },
        })

        res.enviados++
        console.log(`[Activacion WA] Enviado a ${owner.nombre} (${org.nombre})`)
      } catch (e) {
        res.errores++
        console.error(`[Activacion WA] Error ${org.nombre}: ${e.message}`)
      }
    }

    return NextResponse.json({ ok: true, ...res })
  } catch (error) {
    console.error('[CRON activacion-whatsapp]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
