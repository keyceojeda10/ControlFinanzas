/* ── ¿CON CUÁL WHATSAPP SE ABRE? (2 nov 2026) ───────────────────────────────
 *
 * El dueño tiene en el teléfono el WhatsApp normal y el Business, y el de
 * Control Finanzas es el Business. `wa.me` abre el que Android tenga por
 * defecto —el normal— y desde ahí no le sirve escribirle a un cliente.
 *
 * En Android un enlace `intent://` con `package=` elige la app. Es el mismo
 * truco que ya usa el aviso de Telegram (app/api/telegram/wa-redirect), que
 * lleva meses abriendo el Business. Si esa app no está instalada,
 * `S.browser_fallback_url` cae a `wa.me` y abre el que haya.
 *
 * En iPhone no se puede elegir: los dos WhatsApp responden al mismo enlace.
 */

export const PAQUETE = { business: 'com.whatsapp.w4b', normal: 'com.whatsapp' }

/** `wa.me` de siempre: el que el teléfono tenga por defecto. */
export function enlaceWaMe(numero, texto = '') {
  return `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}

/**
 * @param {string} numero  solo dígitos, con indicativo (573001112233)
 * @param {string} texto
 * @param {'business'|'normal'} app
 */
export function enlaceWhatsApp(numero, texto, app) {
  const waMe = enlaceWaMe(numero, texto)
  const paquete = PAQUETE[app]
  if (!paquete) return waMe
  return `${waMe.replace('https://', 'intent://')}#Intent;scheme=https;package=${paquete};S.browser_fallback_url=${encodeURIComponent(waMe)};end`
}

export const esAndroid = (ua) => /android/i.test(String(ua ?? ''))
