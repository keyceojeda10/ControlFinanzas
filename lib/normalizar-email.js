// lib/normalizar-email.js
// Normaliza un email a su forma canonica: minusculas, sin espacios y, SOLO en
// Gmail, sin puntos en la parte local (antes del @). Gmail trata los puntos
// como decorativos, asi que carlos.garcia@gmail.com == carlosgarcia@gmail.com.
//
// ⚠ HOTMAIL, OUTLOOK, YAHOO E ICLOUD NO (DETALLES-CAJA-Y-CAPITAL #21, 18 oct
// 2026). Hasta esa fecha se quitaban los puntos en TODOS los dominios:
// «andres.vargas@ejemplo.com» se guardaba como «andresvargas@ejemplo.com», que
// es OTRO buzón, y ahí iban el código de verificación, la bienvenida y el
// enlace para cambiar la contraseña. 155 cuentas fuera de Gmail en producción
// (81 de Hotmail), ninguna con su punto: no se sabe cuáles lo perdieron.
//
// TODOS los puntos de entrada del flujo de autenticacion deben usar esta
// funcion: registro, login, verificar-email y reenviar-verificacion. Para
// BUSCAR una cuenta, `buscarUsuarioPorEmail`: encuentra también las viejas.
const DOMINIOS_SIN_PUNTOS = new Set(['gmail.com', 'googlemail.com'])

function partes(email) {
  if (!email) return null
  const lower = String(email).trim().toLowerCase()
  const atIndex = lower.indexOf('@')
  if (atIndex === -1) return { lower }
  return { lower, local: lower.slice(0, atIndex), domain: lower.slice(atIndex + 1) }
}

export function normalizarEmail(email) {
  const p = partes(email)
  if (!p) return ''
  if (p.domain === undefined) return p.lower
  return DOMINIOS_SIN_PUNTOS.has(p.domain) ? `${p.local.replace(/\./g, '')}@${p.domain}` : p.lower
}

/** Como se guardaba antes del 18 oct 2026: sin puntos en TODOS los dominios.
 *  Solo sirve para ENCONTRAR una cuenta vieja, nunca para guardar ni enviar. */
export function emailComoSeGuardabaAntes(email) {
  const p = partes(email)
  if (!p) return ''
  if (p.domain === undefined) return p.lower
  return `${p.local.replace(/\./g, '')}@${p.domain}`
}

/** Las formas con que puede estar guardado, la de hoy primero y sin repetir. */
export function formasDelEmail(email) {
  const hoy = normalizarEmail(email)
  if (!hoy) return []
  const antes = emailComoSeGuardabaAntes(email)
  return antes === hoy ? [hoy] : [hoy, antes]
}

/**
 * La cuenta de ese correo: primero tal como se guarda hoy y, si no está, como
 * se guardaba antes. En ese orden, porque desde el 18 oct pueden convivir
 * «juan.perez@hotmail.com» y «juanperez@hotmail.com», que son dos personas.
 * ⚠ Lo que se le envíe va a `user.email`, el guardado, nunca al escrito: si no,
 * cualquiera que pusiera un punto de más recibiría el enlace de otra cuenta.
 */
export async function buscarUsuarioPorEmail(db, email, args = {}) {
  for (const forma of formasDelEmail(email)) {
    const user = await db.user.findUnique({ ...args, where: { email: forma } })
    if (user) return user
  }
  return null
}
