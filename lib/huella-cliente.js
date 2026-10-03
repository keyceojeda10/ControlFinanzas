/* ENTRAR CON HUELLA O CARA — el lado del teléfono (3 oct 2026). El servidor, en
 * lib/huella.js. Aquí solo se le pide al teléfono que cree o use su llave. */
import { startRegistration, startAuthentication, browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser'

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
    await pedir('/api/huella/activar', { paso: 'guardar', sello, respuesta, dispositivo: nombreDelTelefono() })
    return { ok: true }
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
    const { pase } = await pedir('/api/huella/entrar', { paso: 'verificar', sello, respuesta })
    return { pase }
  } catch (e) {
    if (cancelado(e)) return { cancelado: true }
    return { error: e?.message || 'No se pudo entrar con la huella. Vuelve a intentarlo.' }
  }
}
