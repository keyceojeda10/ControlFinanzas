// lib/bot/filtros.js — Filtros pre-agente para mensajes entrantes.
// Detecta mensajes que NO deben generar respuesta del bot.

const PATRONES_AUTO = [
  /bienvenido.*gracias.*comunica/i,
  /gracias por comunica.*en breve/i,
  /en breve.*asesor.*atender/i,
  /ofrecemos cr[eé]ditos/i,
  /planes de pago.*semanales/i,
  /gracias por escribir.*atender/i,
  /horario de atenci[oó]n/i,
  /respuesta autom[aá]tica/i,
  /mensaje autom[aá]tico/i,
  /fuera de.*horario/i,
  /nos comunicaremos.*brevemente/i,
  /gracias por contactar/i,
  /estamos atendiendo.*mensaje/i,
  /hola.*somos.*ya te atendemos/i,
  /nuestro horario.*de \d/i,
  /te responderemos.*pronto/i,
  /gracias por su mensaje/i,
  /un asesor.*comunicar/i,
]

const EMOJIS_NEGOCIO = /[\u{1F44B}\u{1F4B0}\u{1F4B5}\u{1F3E6}\u{1F4DE}\u{1F44D}\u{270C}\u{1F4B3}\u{1F911}\u{1F4E9}\u{2705}\u{1F4AC}\u{1F4F2}\u{1F3E0}\u{1F4BC}]/u

export function esMensajeAutomatico(texto) {
  if (!texto || texto.length < 20) return false
  const matches = PATRONES_AUTO.filter(p => p.test(texto)).length
  if (matches >= 2) return true
  if (matches >= 1 && EMOJIS_NEGOCIO.test(texto)) return true
  return false
}
