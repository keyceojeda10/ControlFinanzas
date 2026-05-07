// lib/rate-limit.js — Rate limiting basado en IP (in-memory)
import { PLANES_CONFIG } from '@/lib/planes'

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
export const loginLimiter = rateLimit('login', 5, 15 * 60 * 1000)         // 5 intentos / 15 min
export const registroLimiter = rateLimit('registro', 3, 60 * 60 * 1000)   // 3 / hora
export const forgotLimiter = rateLimit('forgot', 3, 60 * 60 * 1000)       // 3 / hora
export const scoreLimiter = rateLimit('score', 10, 60 * 60 * 1000)        // 10 / hora
export const referidoLimiter = rateLimit('referido', 20, 60 * 1000)        // 20 / min
export const webhookLimiter = rateLimit('webhook', 100, 60 * 1000)         // 100 / min
export const cronLimiter = rateLimit('cron', 10, 60 * 1000)               // 10 / min
export const buscarLimiter = rateLimit('buscar', 30, 60 * 1000)           // 30 / min

export function getClientIp(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || '127.0.0.1'
}

// 20 mensajes por hora por org (keyed por orgId, not IP)
export const asistenteLimiter = rateLimit('asistente', 20, 60 * 60 * 1000)

// 10 acciones confirmadas por hora por org
export const accionLimiter = rateLimit('accion', 10, 60 * 60 * 1000)

// Limiter dinámico según plan — usa el límite configurado en PLANES_CONFIG

/**
 * Devuelve el resultado del rate-limit para el asistente según el plan de la org.
 * @param {string} orgId
 * @param {string} plan  — clave del plan (growth, standard, professional, etc.)
 * @returns {{ ok: boolean, remaining: number, retryAfter?: number }}
 */
export function getAsistenteLimiter(orgId, plan) {
  const max = PLANES_CONFIG[plan]?.aiMensajesDia ?? 20
  return rateLimit('asistente', max, 60 * 60 * 1000)(orgId)
}

/**
 * Lee el uso actual del rate-limit del asistente para una org sin incrementarlo.
 * @param {string} orgId
 * @returns {{ used: number, resetAt: number|null }}
 */
export function getAsistenteUsage(orgId) {
  const store = getStore('asistente')
  const entry = store.get(orgId)
  if (!entry || Date.now() > entry.resetAt) return { used: 0, resetAt: null }
  return { used: entry.count, resetAt: entry.resetAt }
}
