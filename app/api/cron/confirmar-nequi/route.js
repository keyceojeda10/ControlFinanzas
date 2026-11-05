// app/api/cron/confirmar-nequi/route.js — LAS AUTORIZACIONES DE NEQUI QUE LA PANTALLA NO ALCANZÓ A GUARDAR.
//
// Cada diez minutos (crontab del VPS). Pregunta a Wompi por cada pedido apuntado
// en `Organization.nequiTokenPendiente` y, si el cliente ya lo aprobó, hace lo
// mismo que la pantalla: guarda el Nequi, aplica la oferta y cobra si toca. Ver
// lib/pagos/confirmar-nequi.js, donde está el porqué (5 nov 2026: 7 negocios
// aprobaron y nunca quedaron guardados).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { wompiConfigurado } from '@/lib/wompi'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'
import { confirmarNequi } from '@/lib/pagos/confirmar-nequi'

const CRON_SECRET = process.env.CRON_SECRET
/** Un pedido que nadie aprobó en 30 días ya no va a servir: se olvida. */
const DIAS_DE_VIDA = 30
/** Una vía que reclamó el pedido y no terminó (se cayó a mitad): se devuelve. */
const MINUTOS_GUARDANDO = 30

export async function POST(req) {
  const secret = req.headers.get('x-cron-secret')
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  if (!wompiConfigurado()) return NextResponse.json({ error: 'Wompi no configurado' }, { status: 500 })

  /* `?soloGuardar=1`: guarda y aplica la oferta, sin cobrar en el momento. Para
     recuperar autorizaciones viejas (las 7 del 5 nov 2026): el cobro lo hace el
     proceso diario en la fecha de cada uno, como habría pasado. */
  const soloGuardar = new URL(req.url).searchParams.get('soloGuardar') === '1'
  const ahora = Date.now()
  const res = { pendientes: 0, guardados: 0, esperando: 0, cerrados: 0, olvidados: 0, errores: 0 }

  // Los muy viejos se olvidan; los que se quedaron «guardando» se devuelven.
  const viejos = await prisma.organization.updateMany({
    where: { nequiTokenPendiente: { not: null }, nequiTokenPedidoAt: { lt: new Date(ahora - DIAS_DE_VIDA * 86400000) } },
    data: { nequiTokenPendiente: null, nequiTokenPedidoAt: null, nequiPlanElegido: null },
  })
  res.olvidados = viejos.count
  const atascados = await prisma.organization.findMany({
    where: { nequiTokenPendiente: { startsWith: 'guardando:' }, nequiTokenPedidoAt: { lt: new Date(ahora - MINUTOS_GUARDANDO * 60000) } },
    select: { id: true, nequiTokenPendiente: true },
  })
  for (const o of atascados) {
    await prisma.organization.updateMany({
      where: { id: o.id, nequiTokenPendiente: o.nequiTokenPendiente },
      data: { nequiTokenPendiente: o.nequiTokenPendiente.slice('guardando:'.length) },
    })
  }

  const orgs = await prisma.organization.findMany({
    where: { nequiTokenPendiente: { not: null, startsWith: 'nequi_' } },
    select: { id: true, nequiTokenPendiente: true, nequiPlanElegido: true },
  })
  res.pendientes = orgs.length

  // Uno por uno: cada aprobado puede cobrar, y el candado del cobro va por organización.
  for (const o of orgs) {
    try {
      const r = await confirmarNequi({
        organizationId: o.id, tokenId: o.nequiTokenPendiente,
        planElegido: o.nequiPlanElegido, origen: 'confirmar-nequi-cron', cobrar: !soloGuardar,
      })
      if (r.guardado) res.guardados++
      else if (r.estado === 'PENDING') res.esperando++
      else res.cerrados++
    } catch (e) {
      res.errores++
      console.error(`[confirmar-nequi] org ${o.id}:`, e.message)
    }
  }

  if (res.guardados || res.errores) console.log('[confirmar-nequi]', JSON.stringify(res))
  return NextResponse.json({ ok: true, ...res })
}
