/* ── EL ENLACE «PARA ATENDER HOY» (2 nov 2026) ───────────────────────────────
 *
 * La lista la abren el dueño y un familiar que le ayuda, desde el WhatsApp de
 * las 9 a. m., SIN iniciar sesión: el familiar no tiene cuenta, y darle una de
 * superadmin le abriría todo el sistema. El enlace va firmado por persona y por
 * día, y vale el día del aviso y el siguiente. Si se reenvía, deja de servir
 * en dos días y el registro dice quién marcó cada cosa.
 *
 * Quién lo recibe: `ATENDER_WHATSAPP` en el .env del servidor, como
 *   «Carlos:573008875156,Fulano:573001112233». El nombre es el que firma los
 *   mensajes y el que queda en el registro.
 */

import crypto from 'node:crypto'

const secreto = () => process.env.ATENDER_SECRETO || process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET || ''

/** «YYYY-MM-DD» de Bogotá. */
export const diaBogota = (d = new Date()) => new Date(d.getTime() - 5 * 3600000).toISOString().slice(0, 10)

export function firmar(quien, dia) {
  return crypto.createHmac('sha256', secreto()).update(`atender:${dia}:${quien}`).digest('base64url').slice(0, 24)
}

/** Las personas que reciben el aviso, leídas del .env. */
export function destinatarios(env = process.env.ATENDER_WHATSAPP) {
  return String(env ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [quien, numero] = p.split(':').map((x) => x.trim())
      return { quien, numero: String(numero ?? '').replace(/\D/g, '') }
    })
    .filter((d) => d.quien && d.numero.length >= 10)
}

/** El enlace de hoy para una persona. */
export function enlace(base, quien, ahora = new Date()) {
  const dia = diaBogota(ahora)
  return `${base}/atender?q=${encodeURIComponent(quien)}&d=${dia}&k=${firmar(quien, dia)}`
}

/** ¿Vale este enlace? Solo el día del aviso y el siguiente, y solo para quien está en la lista. */
export function valido({ q, d, k }, ahora = new Date(), lista = destinatarios()) {
  if (!q || !d || !k || !secreto()) return false
  if (!lista.some((x) => x.quien === q)) return false
  const hoy = diaBogota(ahora)
  const ayer = diaBogota(new Date(ahora.getTime() - 86400000))
  if (d !== hoy && d !== ayer) return false
  const esperado = firmar(q, d)
  return esperado.length === k.length && crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(k))
}
