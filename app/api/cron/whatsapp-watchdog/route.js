// app/api/cron/whatsapp-watchdog/route.js
// Vigía de la WhatsApp Cloud API Y del modelo del bot. Corre cada 10 min.
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
import { prisma } from '@/lib/prisma'
import { saludDelModelo, avisoDelModelo, RECUPERADO } from '@/lib/bot-v2/salud-modelo'

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

/* ══ Y EL MODELO DEL BOT, QUE ES LO OTRO QUE SE CAE ═══════════════════════
 *
 * Vive aquí y no en un cron nuevo a propósito: éste ya corre cada 10 minutos,
 * ya tiene su secreto y ya sabe avisar UNA vez y otra al recuperarse. Un cron
 * más es una línea más de crontab que hay que poner a mano en el VPS y que se
 * olvida — pasó con el del devengo.
 *
 * Comparte el fichero de estado, con sus propias claves: así el aviso de
 * WhatsApp y el del modelo no se pisan. */
async function vigilarElModelo(st) {
  let salud
  try {
    salud = await saludDelModelo(prisma)
  } catch (e) {
    console.error('[Watchdog modelo] no se pudo mirar:', e.message)
    return { estado: 'error', alertaEnviada: false, estadoNuevo: {} }
  }

  // Hora sin movimiento: no es noticia y no se toca el estado.
  if (salud.estado === 'quieto') return { ...salud, alertaEnviada: false, estadoNuevo: {} }

  if (salud.estado === 'sano') {
    if (st.modeloAlertado) {
      await sendMessage(
        `${RECUPERADO}\n\nEn la última hora: ${salud.principal} llamadas al principal.`,
        null, 'notif',
      ).catch(() => {})
    }
    return { ...salud, alertaEnviada: false, estadoNuevo: { modeloAlertado: false, modeloEstado: 'sano' } }
  }

  /* Caído. Se avisa una vez por incidente — 147 avisos en tres días no los lee
     nadie— pero SÍ se vuelve a avisar si empeora: pasar de «con respaldo» a
     «mudo» es una noticia distinta y más grave. */
  const empeoro = st.modeloEstado === 'respaldo' && salud.estado === 'mudo'
  let alertaEnviada = false
  if (!st.modeloAlertado || empeoro) {
    const r = await sendMessage(avisoDelModelo(salud), null, 'notif').catch(() => null)
    alertaEnviada = Boolean(r && r.ok)
  }
  return {
    ...salud, alertaEnviada,
    estadoNuevo: { modeloAlertado: st.modeloAlertado || alertaEnviada, modeloEstado: salud.estado },
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

  /* Se mira ANTES del health-check de WhatsApp y fuera de su `try`: si Meta no
     responde, el modelo hay que vigilarlo igual. Son dos averías distintas. */
  const modelo = await vigilarElModelo(st)
  Object.assign(st, modelo.estadoNuevo)

  try {
    const health = await healthCheck()

    // No configurado: no alertar (aun no se ha terminado el setup de Meta).
    if (!health.configurado) {
      guardarEstado({ ...st, alertado: false, ultimoStatus: 'no_configurado' })
      return NextResponse.json({ ok: false, status: 'no_configurado', accion: 'ninguna', modelo: modelo.estado })
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
      guardarEstado({ ...st, alertado: false, ultimoStatus: 'ok' })
      return NextResponse.json({ ok: true, status: 'ok', phone: health.phone, tier: health.tier, modelo: modelo.estado })
    }

    // Caido: alertar una sola vez.
    let alertaEnviada = false
    if (!st.alertado) {
      const r = await sendMessage(
        `⚠️ <b>WhatsApp Cloud con problemas</b>\n\n` +
        `El health-check del número/token fallo: <code>${health.status || 'error'}</code>.\n\n` +
        `Posibles causas: token expirado/revocado, número inactivo o calidad baja en Meta. ` +
        `Revisar en Meta (WhatsApp Manager / token del System User). Mientras tanto, el bot no envia.`,
        null,
        'notif'
      ).catch(() => null)
      alertaEnviada = Boolean(r && r.ok)
    }

    guardarEstado({ ...st, alertado: st.alertado || alertaEnviada, ultimoStatus: health.status })
    return NextResponse.json({ ok: false, status: health.status, alertaEnviada, modelo: modelo.estado })
  } catch (err) {
    /* Aunque Meta reviente, lo que ya sabemos del modelo se guarda: si no, el
       aviso se repetiría en la vuelta siguiente. */
    guardarEstado(st)
    console.error('[WA Cloud Watchdog] Error:', err.message)
    return NextResponse.json({ error: err.message, modelo: modelo.estado }, { status: 500 })
  }
}
