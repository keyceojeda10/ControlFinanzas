// app/api/cron/whatsapp-bot-autocritica/route.js — Autocrítica diaria (9pm COL)
import { NextResponse } from 'next/server'
import { ejecutarAutocritica } from '@/lib/bot/autocritica'

export async function POST(req) {
  const cronSecret = req.headers.get('x-cron-secret')
  const CRON_SECRET = process.env.CRON_SECRET
  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const resultado = await ejecutarAutocritica()
    console.log(`[Bot Cron Autocritica] ${resultado.lecciones} lecciones, ${resultado.patrones} patrones`)
    return NextResponse.json(resultado)
  } catch (err) {
    console.error('[Bot Cron Autocritica] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
