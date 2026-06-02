// app/api/cron/whatsapp-watchdog/route.js
// Vigía de la WhatsApp Cloud API. Corre por cron (ej. cada 30 min).
//
// Con la Cloud API oficial NO hay sesion ni QR que vigilar (a diferencia de
// OpenWA). Lo que puede fallar es el TOKEN (expira/revocado) o que el numero
// quede inactivo/con baja calidad. Este watchdog hace un health-check y, si el
// token/numero no responde OK, manda UNA alerta por Telegram (canal 'notif',
// independiente del WhatsApp). No repite la alerta hasta que se recupere.

import { NextResponse } from 'next/server'
import fs from 'fs'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'
import { healthCheck } from '@/lib/bot/whatsapp-cloud'
import { sendMessage } from '@/lib/telegram'

const STATE_FILE = '/tmp/wa-cloud-watchdog-state.json'

function leerEstado() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return { alertado: false, ultimoStatus: null }
  }
}

function guardarEstado(s) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(s))
  } catch (e) {
    console.error('[WA Cloud Watchdog] No se pudo guardar estado:', e.message)
  }
}

export async function POST(req) {
  const cronSecret = req.headers.get('x-cron-secret')
  const CRON_SECRET = process.env.CRON_SECRET
  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const st = leerEstado()

  try {
    const health = await healthCheck()

    // No configurado: no alertar (aun no se ha terminado el setup de Meta).
    if (!health.configurado) {
      guardarEstado({ alertado: false, ultimoStatus: 'no_configurado' })
      return NextResponse.json({ ok: false, status: 'no_configurado', accion: 'ninguna' })
    }

    if (health.ok) {
      // Sano: si veniamos de una caida ya alertada, avisar recuperacion.
      if (st.alertado) {
        await sendMessage(
          `✅ <b>WhatsApp Cloud reconectado</b>\n\nEl numero del bot volvio a responder OK${health.phone ? ` (${health.phone})` : ''}.`,
          null,
          'notif'
        ).catch(() => {})
      }
      guardarEstado({ alertado: false, ultimoStatus: 'ok' })
      return NextResponse.json({ ok: true, status: 'ok', phone: health.phone, tier: health.tier })
    }

    // Caido: alertar una sola vez.
    let alertaEnviada = false
    if (!st.alertado) {
      const r = await sendMessage(
        `⚠️ <b>WhatsApp Cloud con problemas</b>\n\n` +
        `El health-check del numero/token fallo: <code>${health.status || 'error'}</code>.\n\n` +
        `Posibles causas: token expirado/revocado, numero inactivo o calidad baja en Meta. ` +
        `Revisar en Meta (WhatsApp Manager / token del System User). Mientras tanto, el bot no envia.`,
        null,
        'notif'
      ).catch(() => null)
      alertaEnviada = Boolean(r && r.ok)
    }

    guardarEstado({ alertado: st.alertado || alertaEnviada, ultimoStatus: health.status })
    return NextResponse.json({ ok: false, status: health.status, alertaEnviada })
  } catch (err) {
    console.error('[WA Cloud Watchdog] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
