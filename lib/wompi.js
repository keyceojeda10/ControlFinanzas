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

/* ══ COBRO RECURRENTE ═══════════════════════════════════════════════════════
 *
 * Hasta ahora Wompi solo servía para el checkout suelto: el cliente entraba,
 * pagaba, y al mes siguiente había que volver a convencerle. Medido el 1 sep
 * 2026: de 653 suscripciones 648 eran `pago_unico`, había UNA sola recurrente
 * en todo el sistema, y 83 de los 117 pagos entraron a mano.
 *
 * La «fuente de pago» es el permiso —dado una vez por el cliente, con su
 * autenticación— para cobrarle después sin que esté delante. Wompi lo soporta
 * con TARJETA y con NEQUI; para este público Nequi pesa más que la tarjeta.
 *
 * ⚠ LOS DATOS DE LA TARJETA NO PASAN POR AQUÍ, NUNCA. El widget de Wompi los
 * tokeniza dentro de su propio iframe y a nosotros nos llega un token. Si algún
 * día alguien manda un número de tarjeta a este servidor, el error no es de
 * código: es de diseño, y nos mete en una obligación legal que hoy no tenemos.
 */

/** Los dos permisos que Wompi exige que el cliente acepte antes de guardar nada. */
export async function tokensDeAceptacion() {
  const pub = wompiPublicKey()
  if (!pub) throw new Error('WOMPI_PUBLIC_KEY no configurada')
  const res = await fetch(`${WOMPI_BASE}/merchants/${pub}`)
  if (!res.ok) throw new Error(`Wompi /merchants respondió ${res.status}`)
  const d = (await res.json())?.data ?? {}
  const politica = d?.presigned_acceptance?.acceptance_token
  const datos    = d?.presigned_personal_data_auth?.acceptance_token
  if (!politica || !datos) throw new Error('Wompi no devolvió los tokens de aceptación')
  return {
    politica,
    datos,
    enlacePolitica: d?.presigned_acceptance?.permalink ?? null,
    enlaceDatos:    d?.presigned_personal_data_auth?.permalink ?? null,
  }
}

/**
 * Convierte un token de un solo uso en una fuente de pago reutilizable.
 * @param {object} p
 * @param {string} p.token   el que devolvió la tokenización (tarjeta o Nequi)
 * @param {string} p.tipo    'CARD' | 'NEQUI'
 * @param {string} p.email   el del dueño; Wompi lo exige y lo pedirá en cada cobro
 */
/* ══ NEQUI: EL CAMINO QUE SÍ FUNCIONA EN COLOMBIA ══════════════════════════
 *
 * ⚠ EL WIDGET EN MODO TOKENIZACIÓN NO CERRABA EL CÍRCULO. Se probó el 1 sep
 * 2026 con un Nequi de verdad: el push le llegó al teléfono del dueño, pero el
 * POST que el widget debía hacer a `/api/pagos/wompi/token` **nunca llegó** —
 * cero registros en los logs. No está documentado para Colombia (solo para
 * Panamá) y no hay forma de saber qué hace por dentro.
 *
 * Esto, en cambio, es API pública y documentada, y va entera por el servidor:
 *
 *   1. `POST /v1/tokens/nequi` con el número        → token en estado PENDING,
 *                                                     y a la persona le llega
 *                                                     el push en su app
 *   2. la persona aprueba en Nequi
 *   3. `GET /v1/tokens/nequi/{id}` hasta APPROVED
 *   4. `POST /v1/payment_sources` con ese token     → medio de pago guardado
 *
 * ⚠ Y ES EL CAMINO QUE IMPORTA: de las últimas doce suscripciones cobradas por
 * Wompi, **ocho fueron con Nequi**, dos con transferencia de Bancolombia, una
 * con Daviplata y una sola con tarjeta. Un cobro recurrente que solo entienda
 * de tarjetas no le sirve a dos tercios de quien paga. */

/** Pide el token y dispara el push a la app de Nequi. Devuelve el id del token,
 *  que nace en PENDING: todavía no sirve para cobrar. */
export async function pedirTokenNequi(telefono) {
  /* ⚠ EL NÚMERO SE MIRA PRIMERO, ANTES QUE NADA MÁS. Cada llamada buena manda
     un push al teléfono de una persona: un dedazo no puede convertirse en una
     notificación a quien no la pidió. Y comprobarlo aquí no depende de que el
     entorno esté configurado. */
  const digitos = String(telefono ?? '').replace(/\D/g, '').slice(-10)
  if (digitos.length !== 10) throw new Error('El número de Nequi debe tener diez dígitos')

  const pub = wompiPublicKey()
  if (!pub) throw new Error('WOMPI_PUBLIC_KEY no configurada')

  const res = await fetch(`${WOMPI_BASE}/tokens/nequi`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pub}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: digitos }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const motivo = json?.error?.messages
      ? Object.values(json.error.messages).flat().join('. ')
      : (json?.error?.reason || `HTTP ${res.status}`)
    throw new Error(motivo)
  }
  const d = json?.data ?? {}
  return { id: d.id, estado: d.status, telefono: digitos }
}

/** En qué va la autorización: PENDING (aún no ha aprobado), APPROVED (listo),
 *  DECLINED o VOIDED (dijo que no, o caducó). */
export async function estadoTokenNequi(tokenId) {
  const pub = wompiPublicKey()
  if (!pub) throw new Error('WOMPI_PUBLIC_KEY no configurada')
  const res = await fetch(`${WOMPI_BASE}/tokens/nequi/${encodeURIComponent(tokenId)}`, {
    headers: { Authorization: `Bearer ${pub}` },
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error?.reason || `HTTP ${res.status}`)
  return json?.data?.status ?? 'DESCONOCIDO'
}

export async function crearFuenteDePago({ token, tipo, email }) {
  const priv = process.env.WOMPI_PRIVATE_KEY
  if (!priv) throw new Error('WOMPI_PRIVATE_KEY no configurada')
  if (!['CARD', 'NEQUI'].includes(tipo)) throw new Error(`Tipo de fuente no soportado: ${tipo}`)

  const aceptacion = await tokensDeAceptacion()
  const res = await fetch(`${WOMPI_BASE}/payment_sources`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${priv}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: tipo,
      token,
      customer_email: email,
      acceptance_token: aceptacion.politica,
      accept_personal_auth: aceptacion.datos,
    }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    /* El motivo de Wompi se conserva entero: «tarjeta declinada» y «token ya
       usado» piden cosas distintas del cliente, y sin el texto original la
       pantalla solo puede decir «algo salió mal». */
    const motivo = json?.error?.messages ? JSON.stringify(json.error.messages) : (json?.error?.reason ?? `HTTP ${res.status}`)
    throw new Error(`Wompi rechazó la fuente de pago: ${motivo}`)
  }
  const d = json?.data ?? {}
  if (!d.id) throw new Error('Wompi no devolvió el id de la fuente de pago')
  return {
    id: d.id,
    estado: d.status,
    publico: d.public_data ?? {},
  }
}

/**
 * El cobro que ocurre solo, sin el cliente delante.
 *
 * ⚠ `recurrent: true` NO es cosmético: es lo que le dice a la franquicia que
 * este cobro está autorizado de antemano (Credential On File). Sin él, el banco
 * puede rechazarlo por venir sin titular presente.
 */
export async function cobrarConFuente({ fuenteId, montoCOP, email, referencia }) {
  const priv = process.env.WOMPI_PRIVATE_KEY
  if (!priv) throw new Error('WOMPI_PRIVATE_KEY no configurada')
  const centavos = Math.round(montoCOP * 100)
  const res = await fetch(`${WOMPI_BASE}/transactions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${priv}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount_in_cents: centavos,
      currency: 'COP',
      customer_email: email,
      payment_source_id: fuenteId,
      reference: referencia,
      payment_method: { installments: 1 },
      recurrent: true,
      signature: firmaIntegridad(referencia, centavos, 'COP'),
    }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const motivo = json?.error?.messages ? JSON.stringify(json.error.messages) : (json?.error?.reason ?? `HTTP ${res.status}`)
    return { ok: false, motivo, estado: null, id: null }
  }
  const d = json?.data ?? {}
  /* ⚠ NO SE ACTIVA NADA AQUÍ. La transacción nace PENDING y quien activa el
     plan es el webhook, igual que en el pago manual — un solo camino para
     activar es la única forma de que no se active dos veces ni ninguna. */
  return { ok: true, id: d.id, estado: d.status, motivo: null }
}

/* ══ LA REFERENCIA, CONSTRUIDA Y LEÍDA EN EL MISMO SITIO ════════════════════
 *
 * La referencia es lo ÚNICO que une un cobro aprobado con la organización a la
 * que hay que activarle el plan. El webhook la lee; el checkout y el cobro
 * recurrente la escriben. Si las dos formas se separan —una añade un guion, la
 * otra no— entra plata que no se puede aplicar, y eso solo se descubre cuando
 * el cliente reclama que pagó y sigue bloqueado.
 *
 * Por eso viven pegadas: cambiar una obliga a mirar la otra.
 *
 * ⚠ EL ID DE ORGANIZACIÓN NO PUEDE LLEVAR GUIONES. Son cuid (`cmm7iigyr0001…`)
 * y no los llevan; el lector cuenta las piezas desde el final justamente para
 * aguantar si algún día los llevara. */
export function referenciaDeCobro(orgId, plan, periodo = 'mensual') {
  return `cf-${orgId}-${plan}-${periodo}-${Date.now()}`
}

export function leerReferencia(ref) {
  if (!ref || !ref.startsWith('cf-')) return null
  const partes = ref.split('-')
  if (partes.length < 5) return null
  const ts = partes[partes.length - 1]
  const periodo = partes[partes.length - 2]
  const plan = partes[partes.length - 3]
  const orgId = partes.slice(1, partes.length - 3).join('-')
  if (!orgId || !plan || !periodo) return null
  return { orgId, plan, periodo, ts }
}
