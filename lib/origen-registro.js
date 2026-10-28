/* ══ DE DÓNDE VINO QUIEN SE REGISTRA (28 oct 2026) ══════════════════════════
 *
 * `fuenteRegistro` lo deduce el servidor cruzando el teléfono con los leads
 * (facebook_ads, whatsapp_bot, referido) y todo lo demás caía en «organico»:
 * de los registros de octubre, 39 «orgánicos» sin saber si venían de Google, de
 * ChatGPT o de un anuncio que no dejó lead. Nadie guardaba el referrer, las UTM
 * ni el gclid.
 *
 * Ahora la web (control-finanzas.com) guarda la primera visita —y la última que
 * trajo campaña— y la pasa en `?o=` al enlace de /registro. El formulario la
 * junta con lo que ve él mismo (un anuncio que apunta directo a la app) y el
 * servidor la guarda en `Organization.origenRegistro`. `fuenteRegistro` no se
 * toca: el panel y las métricas la leen tal cual.
 */

export const CLAVES_ORIGEN = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'gclid', 'gbraid', 'wbraid', 'fbclid',
  'referrer', 'landing', 'primeraVisita',
]

/** Solo las claves conocidas, como texto corto. Lo demás se tira. */
export function limpiarOrigen(o) {
  if (!o || typeof o !== 'object') return null
  const out = {}
  for (const k of CLAVES_ORIGEN) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 300)
  }
  return Object.keys(out).length ? out : null
}

/** El `?o=` que manda la web: JSON en base64url. Si no se entiende, nada. */
export function leerOrigenParam(s) {
  if (!s || typeof s !== 'string' || s.length > 3000) return null
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(escape(atob(b64)))
    return limpiarOrigen(JSON.parse(json))
  } catch { return null }
}

const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }
const NUESTROS = /(^|\.)control-finanzas\.com$/

/**
 * El canal en una palabra, para contar sin leer el JSON:
 * google_ads · facebook_ads · campana · chatgpt · perplexity · gemini ·
 * copilot · claude · google · bing · youtube · facebook · whatsapp · otro_sitio · directo
 */
export function canalDeOrigen(o) {
  if (!o) return 'directo'
  const fuente = (o.utm_source || '').toLowerCase()
  const medio = (o.utm_medium || '').toLowerCase()
  if (o.gclid || o.gbraid || o.wbraid || (fuente === 'google' && /cpc|ppc|paid/.test(medio))) return 'google_ads'
  if (o.fbclid || /^(facebook|fb|instagram|ig|meta)$/.test(fuente)) return 'facebook_ads'
  if (fuente) return 'campana'
  const h = host(o.referrer)
  if (!h || NUESTROS.test(h)) return 'directo'
  if (/(^|\.)(chatgpt\.com|openai\.com)$/.test(h)) return 'chatgpt'
  if (/perplexity\.ai$/.test(h)) return 'perplexity'
  if (h === 'gemini.google.com' || h === 'bard.google.com') return 'gemini'
  if (/copilot\.microsoft\.com$/.test(h)) return 'copilot'
  if (/claude\.ai$/.test(h)) return 'claude'
  if (/(^|\.)google\.[a-z.]+$/.test(h)) return 'google'
  if (/(^|\.)bing\.com$/.test(h)) return 'bing'
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(h)) return 'youtube'
  if (/(^|\.)(facebook\.com|instagram\.com|fb\.com|l\.facebook\.com)$/.test(h)) return 'facebook'
  if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(h)) return 'whatsapp'
  return 'otro_sitio'
}

/** En el navegador, al registrarse: lo que mandó la web, o lo que ve esta página. */
export function origenDelRegistro(param) {
  const deLaWeb = leerOrigenParam(param)
  if (typeof window === 'undefined') return deLaWeb
  const q = new URLSearchParams(window.location.search)
  const aqui = {}
  for (const k of CLAVES_ORIGEN) if (q.get(k)) aqui[k] = q.get(k)
  if (document.referrer && !NUESTROS.test(host(document.referrer))) aqui.referrer = document.referrer
  aqui.landing = window.location.pathname
  // La campaña que trajo a ESTA página manda sobre la de la web (fue el último clic pagado).
  const tieneCampana = (x) => !!(x && (x.gclid || x.gbraid || x.wbraid || x.fbclid || x.utm_source))
  if (deLaWeb && !tieneCampana(aqui)) return deLaWeb
  return limpiarOrigen(deLaWeb ? { ...deLaWeb, ...aqui } : aqui)
}
