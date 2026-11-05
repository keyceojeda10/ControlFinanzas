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
  return enApp(enlaceWaMe(numero, texto), app)
}

/** Un `https://wa.me/…` cualquiera, abierto en esa app de Android. */
export function enApp(waMe, app) {
  const paquete = PAQUETE[app]
  if (!paquete || !/^https:\/\/wa\.me\//.test(waMe)) return waMe
  return `${waMe.replace('https://', 'intent://')}#Intent;scheme=https;package=${paquete};S.browser_fallback_url=${encodeURIComponent(waMe)};end`
}

export const esAndroid = (ua) => /android/i.test(String(ua ?? ''))

/**
 * ¿Este navegador está en un Android? Con el `navigator` entero, no solo el texto.
 *
 * ⚠ LA TABLETA NO DICE «ANDROID» (5 nov 2026). En una tableta Chrome abre las
 * páginas en «vista de escritorio» y se presenta como un PC: «X11; Linux
 * x86_64». El dueño abre «Para atender» y el superadmin en su tableta, donde
 * tiene el Business, y le salía el WhatsApp normal: esto contestaba «no es
 * Android» y quedaba el `wa.me` de siempre. La pista que queda es la pantalla
 * táctil: un Linux que no es Chromebook y se toca es un Android en escritorio.
 */
export function esAndroidNavegador(nav) {
  if (!nav) return false
  const ua = String(nav.userAgent ?? '')
  if (esAndroid(ua)) return true
  if (/android/i.test(String(nav.userAgentData?.platform ?? ''))) return true
  return /Linux/i.test(ua) && !/CrOS/i.test(ua) && (Number(nav.maxTouchPoints) || 0) > 0
}
