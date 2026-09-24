// lib/dispositivo.js — «iPhone · Safari», lo que se enseña en sesiones y cuentas guardadas.

export function parseDispositivo(ua) {
  if (!ua) return 'Desconocido'
  const lower = ua.toLowerCase()
  if (lower.includes('iphone')) return 'iPhone'
  if (lower.includes('ipad')) return 'iPad'
  if (lower.includes('android')) {
    if (lower.includes('mobile')) return 'Android'
    return 'Tablet Android'
  }
  if (lower.includes('macintosh') || lower.includes('mac os')) return 'Mac'
  if (lower.includes('windows')) return 'Windows'
  if (lower.includes('linux')) return 'Linux'
  return 'Otro'
}

export function parseBrowser(ua) {
  if (!ua) return ''
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera'
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome'
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari'
  if (ua.includes('Firefox/')) return 'Firefox'
  return ''
}

/** «iPhone · Safari», «Android · Chrome»: lo que se enseña en la lista de aparatos. */
export function etiquetaDispositivo(ua) {
  const d = parseDispositivo(ua)
  const b = parseBrowser(ua)
  return b ? `${d} · ${b}` : d
}
