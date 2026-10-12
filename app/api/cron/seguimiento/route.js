// app/api/cron/seguimiento/route.js — el motor de seguimiento, cada hora.
//
// Reenganche de quien se fue, aviso a quien paga y dejó de usar la app, la
// campaña del 35 % por Nequi guardado y los avisos a Carlos. Las reglas están
// en lib/seguimiento/. Solo escribe de 8 a. m. a 7 p. m. hora de Bogotá; fuera
// de ese horario responde sin hacer nada.
//
// En el VPS: `0 * * * * curl -s -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:3002/api/cron/seguimiento`

import { NextResponse } from 'next/server'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'
import { correrSeguimiento } from '@/lib/seguimiento/motor'
import { vueltaDeCargas } from '@/lib/carga-asesor/solicitud'

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(req) {
  const secret = req.headers.get('x-cron-secret')
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  try {
    const r = await correrSeguimiento()
    /* La carga con asesor (bloque 4), a cualquier hora: lee lo que se quedó sin
       leer y recuerda a Carlos lo que lleva 20 h sin aprobar. */
    r.cargas = await vueltaDeCargas().catch((e) => ({ error: e?.message }))
    console.log('[CRON seguimiento]', JSON.stringify(r))
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    console.error('[CRON seguimiento]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
