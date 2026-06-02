// lib/wompi.js — Cliente de Wompi (pasarela de pago Colombia, soporta Nequi)
//
// Wompi cobra via Checkout Web. Flujo:
//  1. Backend genera una firma de integridad SHA256(referencia + monto_centavos +
//     moneda + WOMPI_INTEGRITY_KEY).
//  2. Frontend abre el checkout con llave publica + referencia + monto + firma.
//  3. Usuario paga (Nequi -> aprueba push en su cel).
//  4. Wompi envia evento 'transaction.updated' al webhook con status APPROVED.
//  5. El webhook valida la firma del evento y activa el plan.
//
// Variables de entorno requeridas:
//   WOMPI_PUBLIC_KEY      (pub_test_... / pub_prod_...)
//   WOMPI_PRIVATE_KEY     (prv_test_... / prv_prod_...)  — para consultar transacciones
//   WOMPI_INTEGRITY_KEY   (test_integrity_... / prod_integrity_...) — firma del checkout
//   WOMPI_EVENTS_KEY      (test_events_... / prod_events_...) — firma de los webhooks
//   WOMPI_ENV             'sandbox' | 'produccion' (default sandbox)

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

/**
 * Firma de integridad para abrir el checkout.
 * SHA256 de: referencia + montoEnCentavos + moneda + llaveIntegridad
 * @param {string} referencia  referencia unica de la transaccion
 * @param {number} montoCentavos  monto en CENTAVOS (COP * 100)
 * @param {string} [moneda]  'COP'
 * @returns {string} hash hex
 */
export function firmaIntegridad(referencia, montoCentavos, moneda = 'COP') {
  const secret = process.env.WOMPI_INTEGRITY_KEY
  if (!secret) throw new Error('WOMPI_INTEGRITY_KEY no configurada')
  const cadena = `${referencia}${montoCentavos}${moneda}${secret}`
  return crypto.createHash('sha256').update(cadena).digest('hex')
}

/**
 * Valida la firma de un evento (webhook) de Wompi.
 * Wompi firma el evento con SHA256 de: la concatenacion de los valores de las
 * propiedades indicadas en signature.properties (en orden) + el timestamp +
 * la WOMPI_EVENTS_KEY. El resultado debe igualar signature.checksum.
 *
 * @param {object} body  el JSON completo del evento recibido
 * @returns {boolean}
 */
export function validarFirmaEvento(body) {
  const secret = process.env.WOMPI_EVENTS_KEY
  if (!secret) return false
  const sig = body?.signature
  const checksumRecibido = sig?.checksum
  const properties = sig?.properties
  const timestamp = body?.timestamp
  if (!checksumRecibido || !Array.isArray(properties) || timestamp == null) return false

  // Concatenar los valores de las propiedades indicadas, en orden.
  // Las properties vienen como rutas tipo "transaction.id", "transaction.status",
  // "transaction.amount_in_cents" — se resuelven dentro de body.data.
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

/**
 * Consulta el estado real de una transaccion en Wompi (no confiar solo en el
 * body del webhook). Devuelve el objeto transaction o null.
 * @param {string} transactionId
 */
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
