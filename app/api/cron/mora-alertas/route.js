// app/api/cron/mora-alertas/route.js — Push notifications para clientes en mora (>3 días sin pagar)
// Llamar diariamente a las 8am: curl -X POST -H "x-cron-secret: $CRON_SECRET" https://app.control-finanzas.com/api/cron/mora-alertas

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'
import { enviarPush, enviarPushOrg } from '@/lib/push'

const CRON_SECRET = process.env.CRON_SECRET
const MAX_PUSH_POR_ORG = 10

export async function POST(req) {
  const secret = req.headers.get('x-cron-secret')
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const tresDiasAtras = new Date()
  tresDiasAtras.setDate(tresDiasAtras.getDate() - 3)
  tresDiasAtras.setHours(0, 0, 0, 0)

  // Buscar préstamos activos sin pago en los últimos 3 días
  const prestamosEnMora = await prisma.prestamo.findMany({
    where: {
      estado: 'activo',
      OR: [
        // Nunca se ha pagado y fue creado hace >3 días
        { pagos: { none: {} }, createdAt: { lt: tresDiasAtras } },
        // Tiene pagos pero ninguno en los últimos 3 días
        {
          pagos: {
            some: {},
            none: { fechaPago: { gte: tresDiasAtras } },
          },
        },
      ],
    },
    include: {
      cliente: { select: { id: true, nombre: true } },
      ruta: { select: { cobradorId: true } },
    },
  })

  if (prestamosEnMora.length === 0) {
    return NextResponse.json({ ok: true, mensaje: 'No hay préstamos en mora', total: 0 })
  }

  // Agrupar por organización
  const porOrg = {}
  for (const p of prestamosEnMora) {
    if (!porOrg[p.organizationId]) porOrg[p.organizationId] = []
    porOrg[p.organizationId].push(p)
  }

  const resultados = { orgs: 0, pushEnviados: 0 }

  for (const [orgId, prestamos] of Object.entries(porOrg)) {
    resultados.orgs++
    let pushCount = 0

    // 1. Push consolidado al owner: "Tienes X clientes en mora"
    const nombres = prestamos.slice(0, 3).map(p => p.cliente.nombre)
    const extra = prestamos.length > 3 ? ` y ${prestamos.length - 3} más` : ''
    await enviarPushOrg(orgId, {
      title: `${prestamos.length} cliente${prestamos.length > 1 ? 's' : ''} en mora`,
      body: `${nombres.join(', ')}${extra}`,
      url: '/prestamos?estado=activo',
    }).catch(() => {})
    pushCount++

    // 2. Push individual al cobrador asignado (si tiene ruta con cobrador)
    const cobradorIds = new Set()
    for (const p of prestamos) {
      if (pushCount >= MAX_PUSH_POR_ORG) break
      const cobradorId = p.ruta?.cobradorId
      if (cobradorId && !cobradorIds.has(cobradorId)) {
        cobradorIds.add(cobradorId)
        const prestamosDelCobrador = prestamos.filter(x => x.ruta?.cobradorId === cobradorId)
        await enviarPush(cobradorId, {
          title: `${prestamosDelCobrador.length} cliente${prestamosDelCobrador.length > 1 ? 's' : ''} en mora`,
          body: prestamosDelCobrador.slice(0, 3).map(x => x.cliente.nombre).join(', '),
          url: '/prestamos?estado=activo',
        }).catch(() => {})
        pushCount++
      }
    }

    resultados.pushEnviados += pushCount
  }

  return NextResponse.json({
    ok: true,
    ...resultados,
    totalPrestamosEnMora: prestamosEnMora.length,
    mensaje: `${resultados.orgs} org(s), ${prestamosEnMora.length} préstamo(s) en mora, ${resultados.pushEnviados} push enviado(s)`,
  })
}
