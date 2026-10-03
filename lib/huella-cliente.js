/* ENTRAR CON HUELLA O CARA — el lado del teléfono (3 oct 2026). El servidor, en
 * lib/huella.js. Aquí solo se le pide al teléfono que cree o use su llave. */
import { startRegistration, startAuthentication, browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser'

/* ── LO QUE RECUERDA ESTE TELÉFONO ────────────────────────────────────────
   ⚠ El botón «Entrar con huella» salía en todo teléfono que PODÍA, aunque no la
   hubiera activado, y Android contestaba «No hay llaves de acceso disponibles»
   (el dueño, 3 oct 2026: «realmente no sirve»). Ahora sale solo donde se
   activó, y la activación se OFRECE al entrar con la contraseña. */
const AQUI = 'cf-huella'          // el id de la llave creada en este teléfono
const CUENTA = 'cf-huella-cuenta' // el userId de la cuenta de esa llave (la tarjeta guardada lleva el mismo)
const NO_AHORA = 'cf-huella-no'   // cuándo dijo «Ahora no»
const NO_PREGUNTAR_MS = 30 * 24 * 60 * 60 * 1000

const leerLocal = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const ponerLocal = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch {} }

/** El id de la llave activada en este teléfono, o null. */
export const huellaDeEsteTelefono = () => leerLocal(AQUI)
export const olvidarHuellaDeEsteTelefono = () => { ponerLocal(AQUI, null); ponerLocal(CUENTA, null) }
const recordarCuenta = (userId) => { if (userId) ponerLocal(CUENTA, String(userId)) }
/** ¿La huella de este teléfono es de ESTA cuenta? Tocar su tarjeta guardada pide
 *  entonces la huella y no el PIN (el dueño, 3 oct 2026: «cerré sesión, volví a
 *  entrar y no me pidió ni huella ni cara: me pidió el PIN»). */
export function huellaEsDe(userId) {
  const mia = leerLocal(CUENTA)
  return Boolean(huellaDeEsteTelefono() && mia && userId && mia === String(userId))
}
/** ¿Se le ofrece activarla al entrar? Si ya la tiene o dijo «Ahora no» hace menos de 30 días, no. */
export function tocaOfrecerHuella(ahora = Date.now()) {
  if (huellaDeEsteTelefono()) return false
  const no = Number(leerLocal(NO_AHORA))
  return !(no && ahora - no < NO_PREGUNTAR_MS)
}
export const noOfrecerHuellaPorAhora = (ahora = Date.now()) => ponerLocal(NO_AHORA, String(ahora))

/** ¿Este teléfono puede? (huella, cara o, sin lector, su patrón de pantalla) */
export async function hayHuella() {
  try { return browserSupportsWebAuthn() && await platformAuthenticatorIsAvailable() } catch { return false }
}

/** «Android», «iPhone», «Windows»… para reconocer el teléfono en la lista. */
export function nombreDelTelefono(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) return 'Android'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Mac OS X/i.test(ua)) return 'Mac'
  return 'Este dispositivo'
}

/* Si la persona cancela el cuadro del teléfono, no es un error: no se le grita. */
const cancelado = (e) => e?.name === 'NotAllowedError' || e?.name === 'AbortError'

async function pedir(url, cuerpo) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || 'No se pudo. Vuelve a intentarlo.')
  return d
}

/** Activa la huella en ESTE teléfono para la cuenta con sesión. → { ok } | { error } | { cancelado } */
export async function activarHuella() {
  try {
    const { opciones, sello } = await pedir('/api/huella/activar', { paso: 'opciones' })
    const respuesta = await startRegistration({ optionsJSON: opciones })
    const d = await pedir('/api/huella/activar', { paso: 'guardar', sello, respuesta, dispositivo: nombreDelTelefono() })
    ponerLocal(AQUI, respuesta.id)
    recordarCuenta(d.userId)
    return { ok: true, credencialId: respuesta.id }
  } catch (e) {
    if (cancelado(e)) return { cancelado: true }
    if (e?.name === 'InvalidStateError') return { error: 'Este teléfono ya tiene la huella activada para esta cuenta.' }
    return { error: e?.message || 'No se pudo activar. Vuelve a intentarlo.' }
  }
}

/** Pide la huella y devuelve el pase para `signIn('huella', { pase })`. → { pase } | { error } | { cancelado } */
export async function paseConHuella() {
  try {
    const { opciones, sello } = await pedir('/api/huella/entrar', { paso: 'opciones' })
    const respuesta = await startAuthentication({ optionsJSON: opciones })
    const { pase, userId } = await pedir('/api/huella/entrar', { paso: 'verificar', sello, respuesta })
    // Las huellas activadas antes de que se guardara la cuenta la aprenden aquí.
    if (!huellaDeEsteTelefono()) ponerLocal(AQUI, respuesta.id)
    recordarCuenta(userId)
    return { pase }
  } catch (e) {
    if (cancelado(e)) return { cancelado: true }
    // La llave ya no está en el servidor (se quitó o se cambió la clave): este
    // teléfono deja de ofrecer el botón.
    if (/no tiene la huella activada/.test(e?.message ?? '')) olvidarHuellaDeEsteTelefono()
    return { error: e?.message || 'No se pudo entrar con la huella. Vuelve a intentarlo.' }
  }
}
