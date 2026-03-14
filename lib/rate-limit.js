// lib/rate-limit.js — Rate limiting basado en IP (in-memory)

const stores = new Map()

function getStore(name) {
  if (!stores.has(name)) stores.set(name, new Map())
  return stores.get(name)
}

// Limpiar entradas expiradas cada 5 minutos
setInterval(() => {
  const now = Date.now()
  for (const [, store] of stores) {
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * @param {string} name - Nombre del limiter (ej: 'login', 'registro')
 * @param {number} maxAttempts - Máximo de intentos permitidos
 * @param {number} windowMs - Ventana de tiempo en ms
 */
export function rateLimit(name, maxAttempts, windowMs) {
  const store = getStore(name)

  return function check(ip) {
    const now = Date.now()
    const entry = store.get(ip)

    if (!entry || now > entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs })
      return { ok: true, remaining: maxAttempts - 1 }
    }

    entry.count++
    if (entry.count > maxAttempts) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      return { ok: false, remaining: 0, retryAfter }
    }

    return { ok: true, remaining: maxAttempts - entry.count }
  }
}

// Limiters pre-configurados
export const loginLimiter = rateLimit('login', 5, 15 * 60 * 1000)       // 5 intentos / 15 min
export const registroLimiter = rateLimit('registro', 3, 60 * 60 * 1000) // 3 / hora
export const forgotLimiter = rateLimit('forgot', 3, 60 * 60 * 1000)     // 3 / hora
export const scoreLimiter = rateLimit('score', 10, 60 * 60 * 1000)      // 10 / hora

export function getClientIp(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || '127.0.0.1'
}
