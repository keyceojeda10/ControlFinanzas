// app/api/cron/whatsapp-bot-followup/route.js — Cron cada 30 min
import { NextResponse } from 'next/server'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'
import { enviarSeguimientos } from '@/lib/bot-v2/sender'

export async function POST(req) {
  const cronSecret = req.headers.get('x-cron-secret')
  const CRON_SECRET = process.env.CRON_SECRET
  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  try {
    /* 3 leads cada 30 min eran 144 al día: con picos de campaña la fila se
       acumulaba y un lead perdía su ventana de 24 h por congestión (Kimi #7,
       8 sep 2026). Entre envío y envío hay 30-60 s, así que 10 son ≤ 10 min. */
    const resultado = await enviarSeguimientos(Number(process.env.BOT_SEGUIMIENTOS_LOTE) || 10)
    console.log(`[Bot Cron Followup] Resultado:`, resultado)
    return NextResponse.json(resultado)
  } catch (err) {
    console.error('[Bot Cron Followup] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
