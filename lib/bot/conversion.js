// lib/bot/conversion.js — Cruce de leads del bot con usuarios registrados.
// Un BotLead "convirtio" si su telefono (ultimos 10 digitos) coincide con el
// telefono de un User registrado en la plataforma.

import { prisma } from '@/lib/prisma'

const ult10 = (t) => (t || '').replace(/\D/g, '').slice(-10)

// Devuelve un Set con los ultimos-10-digitos de todos los usuarios registrados.
export async function getTelefonosRegistrados() {
  const users = await prisma.user.findMany({ select: { telefono: true } })
  const set = new Set()
  for (const u of users) {
    const d = ult10(u.telefono)
    if (d) set.add(d)
  }
  return set
}

export function estaRegistrado(telefono, setRegistrados) {
  const d = ult10(telefono)
  return Boolean(d && setRegistrados.has(d))
}
