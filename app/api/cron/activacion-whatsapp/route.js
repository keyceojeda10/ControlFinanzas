// Envia plantilla de WhatsApp a usuarios que se registraron hace 24h+
// y no han creado ningun prestamo (pueden tener clientes pero no operaron).
// Usa plantilla distinta segun si crearon clientes o no.
// Corre diariamente. Solo envia una vez por org (waActivacionSent).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as wa from '@/lib/bot/whatsapp-cloud'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'

const CRON_SECRET = process.env.CRON_SECRET
const TEMPLATE_SIN_NADA = 'activacion_sin_actividad'
const TEMPLATE_CON_CLIENTES = 'activacion_con_clientes'
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
  const res = { candidatos: 0, enviados: 0, sinNada: 0, conClientes: 0, sinTelefono: 0, errores: 0 }

  try {
    const orgs = await prisma.organization.findMany({
      where: {
        activo: true,
        waActivacionSent: false,
        waOnboardingStep: { lt: 1 },
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

        if (clientes > 0) {
          await wa.sendTemplate(tel, TEMPLATE_CON_CLIENTES, {
            nombre,
            clientes: String(clientes),
            soporte: SOPORTE,
          }, TEMPLATE_LANG)
          res.conClientes++
        } else {
          await wa.sendTemplate(tel, TEMPLATE_SIN_NADA, {
            nombre,
            soporte: SOPORTE,
          }, TEMPLATE_LANG)
          res.sinNada++
        }

        await prisma.organization.update({
          where: { id: org.id },
          data: { waActivacionSent: true, waOnboardingStep: 1 },
        })

        res.enviados++
        console.log(`[Activacion WA] Enviado a ${owner.nombre} (${org.nombre}) — ${clientes > 0 ? 'con clientes' : 'sin nada'}`)
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
