// lib/tarjeta/enlace.js — EL ENLACE A LA TARJETA DEL CLIENTE.
//
// Va por cliente y no por préstamo: sobrevive a una renovación y muestra todos sus
// créditos vivos. Es lo único que protege la página (se abre sin clave), así que
// son 144 bits al azar: no se adivina ni se deriva de ningún dato del cliente.

import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'

export const OPCIONES_RECIBO = ['tarjeta', 'comprobante', 'nada']

const FORMA_TOKEN = /^[A-Za-z0-9_-]{24}$/

export const generarToken = () => randomBytes(18).toString('base64url')

/** Antes de ir a la base: lo que no tiene la forma de un enlace ni se busca. */
export const tokenValido = (token) => FORMA_TOKEN.test(String(token ?? ''))

export const urlDeTarjeta = (token, base = process.env.NEXTAUTH_URL) =>
  `${String(base ?? '').replace(/\/+$/, '')}/t/${token}`

/**
 * El token del cliente, creándolo si no tiene.
 * ⚠ Con `updateMany` sobre `tarjetaToken: null`: si dos cobros lo piden a la vez,
 * gana uno y el otro lee el ganador. Con `update` el segundo pisaría al primero y
 * el enlace que ya salió dejaría de abrir.
 */
export async function asegurarToken(clienteId) {
  const actual = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { tarjetaToken: true } })
  if (!actual) return null
  if (actual.tarjetaToken) return actual.tarjetaToken
  await prisma.cliente.updateMany({
    where: { id: clienteId, tarjetaToken: null },
    data: { tarjetaToken: generarToken() },
  })
  const leido = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { tarjetaToken: true } })
  return leido?.tarjetaToken ?? null
}
