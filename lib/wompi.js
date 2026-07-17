import crypto from 'crypto'

const ENV = process.env.WOMPI_ENV || 'sandbox'

export const WOMPI_BASE = ENV === 'produccion'
  ? 'https://production.wompi.co/v1'
  : 'https://sandbox.wompi.co/v1'

export const WOMPI_CHECKOUT_URL = 'https://checkout.wompi.co/p/'

export function wompiPublicKey() {
  return process.env.WOMPI_PUBLIC_KEY || ''
}

export function wompiConfigurado() {
  return Boolean(
    process.env.WOMPI_PUBLIC_KEY &&
    process.env.WOMPI_PRIVATE_KEY &&
    process.env.WOMPI_INTEGRITY_KEY &&
    process.env.WOMPI_EVENTS_KEY
  )
}

export function firmaIntegridad(referencia, montoCentavos, moneda = 'COP') {
  const secret = process.env.WOMPI_INTEGRITY_KEY
  if (!secret) throw new Error('WOMPI_INTEGRITY_KEY no configurada')
  const cadena = `${referencia}${montoCentavos}${moneda}${secret}`
  return crypto.createHash('sha256').update(cadena).digest('hex')
}

export function validarFirmaEvento(body) {
  const secret = process.env.WOMPI_EVENTS_KEY
  if (!secret) return false
  const sig = body?.signature
  const checksumRecibido = sig?.checksum
  const properties = sig?.properties
  const timestamp = body?.timestamp
  if (!checksumRecibido || !Array.isArray(properties) || timestamp == null) return false

  let concatenado = ''
  for (const prop of properties) {
    const valor = prop.split('.').reduce((obj, key) => (obj == null ? undefined : obj[key]), body.data)
    if (valor === undefined || valor === null) return false
    concatenado += String(valor)
  }
  concatenado += String(timestamp)
  concatenado += secret

  const calculado = crypto.createHash('sha256').update(concatenado).digest('hex')

  try {
    const a = Buffer.from(calculado, 'hex')
    const b = Buffer.from(String(checksumRecibido).toLowerCase(), 'hex')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function consultarTransaccion(transactionId) {
  const priv = process.env.WOMPI_PRIVATE_KEY
  if (!priv) throw new Error('WOMPI_PRIVATE_KEY no configurada')
  const res = await fetch(`${WOMPI_BASE}/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${priv}` },
  })
  if (!res.ok) return null
  const json = await res.json().catch(() => null)
  return json?.data ?? null
}
