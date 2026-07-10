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
    const resultado = await enviarSeguimientos(3)
    console.log(`[Bot Cron Followup] Resultado:`, resultado)
    return NextResponse.json(resultado)
  } catch (err) {
    console.error('[Bot Cron Followup] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
