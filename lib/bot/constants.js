// lib/bot/constants.js — Constantes del bot de WhatsApp

export const ESTADOS = ['pendiente', 'contactado', 'interesado', 'no_interesado', 'cerrado', 'bloqueado']

// Dias entre seguimientos automaticos
export const ESPACIADO_SEGUIMIENTO = [1, 3, 7]
export const MAX_INTENTOS = ESPACIADO_SEGUIMIENTO.length

// Precios Claude Sonnet por millon de tokens (USD)
export const PRECIOS = {
  INPUT: 3.0,
  CACHE_WRITE: 3.75,
  CACHE_READ: 0.30,
  OUTPUT: 15.0,
}

export function calcularCosto(usage) {
  const u = usage || {}
  const inNormal = (u.input_tokens || 0) / 1e6 * PRECIOS.INPUT
  const cacheWrite = (u.cache_creation_input_tokens || 0) / 1e6 * PRECIOS.CACHE_WRITE
  const cacheRead = (u.cache_read_input_tokens || 0) / 1e6 * PRECIOS.CACHE_READ
  const out = (u.output_tokens || 0) / 1e6 * PRECIOS.OUTPUT
  return +(inNormal + cacheWrite + cacheRead + out).toFixed(6)
}

export function delayAleatorio(minMs = 30000, maxMs = 60000) {
  return minMs + Math.random() * Math.max(0, maxMs - minMs)
}
