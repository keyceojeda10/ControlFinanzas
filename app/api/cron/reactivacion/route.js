// app/api/cron/reactivacion/route.js
// Campaña one-shot: reactivar orgs con trial vencido que SÍ usaron la app.
// Envía WhatsApp personalizado según nivel de uso.
// Ejecutar manualmente: curl -X POST -H "x-cron-secret: $CRON_SECRET" .../api/cron/reactivacion

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as wa from '@/lib/bot/whatsapp-cloud'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'

const CRON_SECRET = process.env.CRON_SECRET
const SOPORTE = '301 199 3001'

function primerNombre(nombre) {
  if (!nombre || nombre === 'Sin nombre') return ''
  const limpio = nombre.trim()
  if (/\d|club|store|shop|tienda|empresa|negocio|corp|sas|ltda|s\.a|inversiones|www|creditos|préstamos/i.test(limpio)) return ''
  const partes = limpio.split(/\s+/)
  if (partes.length > 4) return ''
  return partes[0].charAt(0).toUpperCase() + partes[0].slice(1).toLowerCase()
}

function construirMensaje(nombre, prestamos, clientes, diasVencido) {
  const n = nombre || 'amigo'

  if (prestamos >= 20) {
    return `${n}, le escribimos de Control Finanzas. Tenía ${prestamos} préstamos registrados en el sistema y vimos que se le venció la prueba.\n\nCon ese volumen, llevar la cartera a mano se vuelve un problema. Sus datos siguen guardados — si quiere reactivar, el plan básico son $39.000/mes.\n\nEscríbanos al ${SOPORTE} si tiene alguna duda.`
  }

  if (prestamos >= 5) {
    return `${n}, soy del equipo de Control Finanzas. Vi que registró ${prestamos} préstamos y ${clientes} clientes, pero se venció su prueba.\n\nSus datos siguen guardados. Si quiere seguir usándolo, escríbanos al ${SOPORTE} y le ayudamos a activar su plan.`
  }

  if (prestamos >= 1) {
    return `${n}, soy del equipo de Control Finanzas. Vi que empezó a probar el sistema pero no alcanzó a usarlo completo.\n\nSi quiere, le podemos dar unos días extra de prueba para que lo explore bien. Escríbanos al ${SOPORTE}.`
  }

  return `${n}, vimos que se registró en Control Finanzas pero no alcanzó a probarlo. Si le interesa, le podemos dar unos días extra de prueba.\n\nEscríbanos al ${SOPORTE} y le ayudamos a arrancar.`
}

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
  const res = { enviados: 0, omitidos: 0, errores: 0, detalle: [] }

  const orgs = await prisma.organization.findMany({
    where: {
      activo: true,
      planDemoHasta: { lt: ahora },
      waRecoverySent: false,
    },
    include: {
      users: {
        where: { rol: 'owner' },
        select: { nombre: true, telefono: true },
        take: 1,
      },
      _count: { select: { clientes: true, prestamos: true } },
      suscripciones: {
        where: { montoCOP: { gt: 0 } },
        select: { id: true },
        take: 1,
      },
    },
  })

  for (const org of orgs) {
    const owner = org.users[0]
    if (!owner?.telefono || org.suscripciones.length > 0) {
      res.omitidos++
      continue
    }

    const prestamos = org._count.prestamos
    const clientes = org._count.clientes
    if (prestamos === 0 && clientes === 0) {
      res.omitidos++
      continue
    }

    const diasVencido = Math.floor((ahora.getTime() - new Date(org.planDemoHasta).getTime()) / 86400000)
    const nombre = primerNombre(owner.nombre)
    const msg = construirMensaje(nombre, prestamos, clientes, diasVencido)

    try {
      const botLead = await prisma.botLead.findUnique({ where: { telefono: owner.telefono } })
      let ventana = false
      if (botLead) {
        const ultimo = await prisma.botConversacion.findFirst({
          where: { botLeadId: botLead.id, rol: 'lead' },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        })
        ventana = ultimo && Date.now() - new Date(ultimo.createdAt).getTime() < 24 * 3600000
      }

      if (ventana) {
        await wa.sendText(owner.telefono, msg)
      } else {
        await wa.sendTemplate(owner.telefono, 'onboarding_seguimiento', {
          nombre: nombre || 'amigo',
        })
      }

      await prisma.organization.update({
        where: { id: org.id },
        data: { waRecoverySent: true },
      })
      res.enviados++
      res.detalle.push({ org: org.nombre, prestamos, clientes, diasVencido })
    } catch (e) {
      res.errores++
      console.error(`[Reactivación] Error ${org.nombre}:`, e.message)
    }
  }

  console.log(`[Reactivación] Enviados: ${res.enviados}, Omitidos: ${res.omitidos}, Errores: ${res.errores}`)
  return NextResponse.json({ ok: true, ...res })
}
