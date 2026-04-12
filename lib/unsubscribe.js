// lib/unsubscribe.js — Token HMAC para link de unsubscribe en emails

import crypto from 'crypto'

const SECRET = process.env.NEXTAUTH_SECRET || 'dev-secret-change-me'

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  return Buffer.from(str, 'base64')
}

export function generarTokenUnsubscribe(userId) {
  const payload = b64url(JSON.stringify({ uid: userId, t: Date.now() }))
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(payload).digest())
  return `${payload}.${sig}`
}

export function verificarTokenUnsubscribe(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [payload, sig] = token.split('.')
  const expected = b64url(crypto.createHmac('sha256', SECRET).update(payload).digest())
  if (sig !== expected) return null
  try {
    const data = JSON.parse(b64urlDecode(payload).toString())
    return data.uid || null
  } catch {
    return null
  }
}
