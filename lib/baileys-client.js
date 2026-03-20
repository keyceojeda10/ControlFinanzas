// lib/baileys-client.js — Cliente HTTP para comunicar con el servicio Baileys
// Fire-and-forget: si falla, loguea y continúa sin bloquear

const BAILEYS_API_URL = process.env.BAILEYS_API_URL || 'http://localhost:3003'
const BAILEYS_SECRET = process.env.BAILEYS_SECRET || ''
const BAILEYS_ENABLED = process.env.BAILEYS_ENABLED === 'true'

export async function sendWhatsApp(telefono, mensaje) {
  if (!BAILEYS_ENABLED) {
    console.log('[Baileys] Deshabilitado (BAILEYS_ENABLED != true)')
    return { sent: false, reason: 'disabled' }
  }

  if (!telefono) {
    console.log('[Baileys] Sin teléfono, omitiendo')
    return { sent: false, reason: 'no_phone' }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const res = await fetch(`${BAILEYS_API_URL}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-baileys-secret': BAILEYS_SECRET,
      },
      body: JSON.stringify({ telefono, mensaje }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    const data = await res.json()

    if (!res.ok) {
      console.warn(`[Baileys] Error ${res.status}:`, data.error || data.reason)
      return { sent: false, reason: data.error || data.reason }
    }

    console.log(`[Baileys] Mensaje encolado para ${telefono}`)
    return { sent: true, ...data }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('[Baileys] Timeout (30s) — el servicio no respondió')
    } else {
      console.warn('[Baileys] Error conectando al servicio:', err.message)
    }
    return { sent: false, reason: 'service_error' }
  }
}
