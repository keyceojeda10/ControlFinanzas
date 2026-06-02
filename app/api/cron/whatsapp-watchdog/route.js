// app/api/cron/whatsapp-watchdog/route.js
// Vigía de la sesión de WhatsApp (gateway OpenWA). Corre por cron cada ~4 min.
//
// QUÉ HACE:
//   - Consulta el estado de la sesión (lib/bot/openwa-client.getSessionStatus).
//   - Si está "ready" / "connected" -> todo bien, resetea contador de fallos.
//   - Si NO -> intenta reconectar (POST /start) y cuenta el intento.
//   - Tras MAX_INTENTOS_ANTES_ALERTA fallos seguidos (ya requiere QR humano),
//     manda UNA alerta a Telegram (bot 'notif', canal independiente del WhatsApp
//     que justo estaría caído). No repite la alerta hasta que se recupere.
//
// El estado entre ejecuciones se guarda en un archivo JSON (sin migración de DB).
// El gateway zombie (Puppeteer "Target closed") es el caso típico: PM2 lo ve
// "online" pero la sesión está caída — ver memoria bot_whatsapp_recuperacion.

import { NextResponse } from 'next/server'
import fs from 'fs'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'
import * as openwa from '@/lib/bot/openwa-client'
import { sendMessage } from '@/lib/telegram'

const STATE_FILE = '/tmp/wa-watchdog-state.json'
const MAX_INTENTOS_ANTES_ALERTA = 2 // tras 2 ciclos sin lograr reconectar -> alerta
const ESTADOS_OK = new Set(['ready', 'connected', 'authenticated'])

function leerEstado() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return { fallos: 0, alertado: false, ultimoStatus: null }
  }
}

function guardarEstado(s) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(s))
  } catch (e) {
    console.error('[WA Watchdog] No se pudo guardar estado:', e.message)
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
    const estado = await openwa.getSessionStatus()
    const status = (estado.status || '').toLowerCase()

    // CASO 1: sesión sana
    if (ESTADOS_OK.has(status)) {
      // Si veníamos de una caída ya alertada, avisar que se recuperó
      if (st.alertado) {
        await sendMessage(
          `✅ <b>WhatsApp reconectado</b>\n\nLa sesión del bot volvió a estar activa (status: ${status}). El bot está respondiendo de nuevo.`,
          null,
          'notif'
        ).catch(() => {})
      }
      guardarEstado({ fallos: 0, alertado: false, ultimoStatus: status })
      return NextResponse.json({ ok: true, status, accion: 'ninguna' })
    }

    // CASO 2: sesión caída -> intentar reconectar
    let reconectoIntento = null
    try {
      reconectoIntento = await openwa.startSession()
    } catch (e) {
      reconectoIntento = { error: e.message }
    }

    const fallos = (st.fallos || 0) + 1
    let alertaEnviada = false

    // Solo alertar una vez, tras varios fallos (ya necesita QR humano)
    if (fallos >= MAX_INTENTOS_ANTES_ALERTA && !st.alertado) {
      const r = await sendMessage(
        `⚠️ <b>Bot de WhatsApp CAÍDO</b>\n\n` +
        `La sesión lleva varios minutos sin conectar (status: <code>${status || 'desconocido'}</code>) y los reintentos automáticos no la levantan.\n\n` +
        `<b>Probablemente necesita re-escanear el QR.</b> El gateway (Puppeteer) suele quedar zombie tras un "Target closed".\n\n` +
        `Acción: reconectar la sesión y escanear el QR desde el cel del bot (573011993001). ` +
        `Mientras tanto, los leads que escriban NO reciben respuesta.`,
        null,
        'notif'
      ).catch(() => null)
      alertaEnviada = Boolean(r && r.ok)
    }

    guardarEstado({
      fallos,
      alertado: st.alertado || alertaEnviada,
      ultimoStatus: status,
    })

    return NextResponse.json({
      ok: false,
      status,
      accion: 'intento_reconexion',
      fallos,
      alertaEnviada,
    })
  } catch (err) {
    console.error('[WA Watchdog] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
