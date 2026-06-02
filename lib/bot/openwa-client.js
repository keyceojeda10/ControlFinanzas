// lib/bot/openwa-client.js — Cliente REST para OpenWA

const OPENWA_URL = process.env.OPENWA_URL || 'http://localhost:2785/api'
const OPENWA_API_KEY = process.env.OPENWA_API_KEY || ''
const OPENWA_SESSION_ID = process.env.OPENWA_SESSION_ID || 'default'

function headers() {
  return {
    'X-API-Key': OPENWA_API_KEY,
    'Content-Type': 'application/json',
  }
}

export function configurado() {
  return Boolean(OPENWA_API_KEY && OPENWA_SESSION_ID)
}

export function toChatId(phone) {
  let digitos = (phone || '').replace(/\D/g, '')
  // Números colombianos: si tiene 10 dígitos y empieza con 3, agregar código de país
  if (digitos.length === 10 && digitos.startsWith('3')) {
    digitos = '57' + digitos
  }
  return `${digitos}@c.us`
}

export async function sendText(phone, text) {
  if (!configurado()) {
    throw new Error('OpenWA no configurado. Define OPENWA_API_KEY y OPENWA_SESSION_ID.')
  }
  const res = await fetch(
    `${OPENWA_URL}/sessions/${OPENWA_SESSION_ID}/messages/send-text`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ chatId: toChatId(phone), text }),
      signal: AbortSignal.timeout(20000),
    }
  )
  return res.json()
}

export async function getSessionStatus() {
  if (!OPENWA_API_KEY || !OPENWA_SESSION_ID) {
    return { configurado: false, status: 'no_configurado' }
  }
  try {
    const res = await fetch(
      `${OPENWA_URL}/sessions/${OPENWA_SESSION_ID}`,
      { headers: headers(), signal: AbortSignal.timeout(10000) }
    )
    const resp = await res.json()
    const info = resp.data || resp
    return { configurado: true, status: info.status || 'desconocido', raw: info }
  } catch (e) {
    return { configurado: true, status: 'error', error: e.message }
  }
}

export async function startSession() {
  if (!configurado()) {
    throw new Error('OpenWA no configurado. Define OPENWA_API_KEY y OPENWA_SESSION_ID.')
  }
  const res = await fetch(
    `${OPENWA_URL}/sessions/${OPENWA_SESSION_ID}/start`,
    { method: 'POST', headers: headers(), signal: AbortSignal.timeout(15000) }
  )
  return res.json()
}

export async function getQR() {
  if (!configurado()) return null
  try {
    const res = await fetch(
      `${OPENWA_URL}/sessions/${OPENWA_SESSION_ID}/qr`,
      { headers: headers(), signal: AbortSignal.timeout(10000) }
    )
    const resp = await res.json()
    const info = resp.data || resp
    return info.qrCode || info.image || info.code || info.qr || null
  } catch {
    return null
  }
}

export async function resolverTelefono(fromRaw) {
  if (!fromRaw) return ''
  if (fromRaw.includes('@c.us')) {
    return fromRaw.split('@')[0].replace(/\D/g, '')
  }
  if (!configurado()) return fromRaw.replace(/\D/g, '')
  try {
    const res = await fetch(
      `${OPENWA_URL}/sessions/${OPENWA_SESSION_ID}/contacts/${encodeURIComponent(fromRaw)}`,
      { headers: headers(), signal: AbortSignal.timeout(10000) }
    )
    const data = await res.json()
    const info = data.data || data
    if (info.id && info.id.includes('@c.us')) {
      return info.id.split('@')[0].replace(/\D/g, '')
    }
    return (info.number || '').replace(/\D/g, '')
  } catch (e) {
    console.error('No se pudo resolver telefono de', fromRaw, '-', e.message)
    return fromRaw.replace(/\D/g, '')
  }
}

export async function tieneWhatsApp(phone) {
  if (!configurado()) return null
  const digitos = (phone || '').replace(/\D/g, '')
  if (!digitos) return false
  try {
    const res = await fetch(
      `${OPENWA_URL}/sessions/${OPENWA_SESSION_ID}/contacts/check/${digitos}`,
      { headers: headers(), signal: AbortSignal.timeout(10000) }
    )
    if (res.status === 404) return false
    const data = await res.json()
    const info = data.data || data
    if (typeof info.exists === 'boolean') return info.exists
    if (typeof info.numberExists === 'boolean') return info.numberExists
    if (typeof info.isRegistered === 'boolean') return info.isRegistered
    if (info.id || info.jid) return true
    return null
  } catch {
    return null
  }
}
