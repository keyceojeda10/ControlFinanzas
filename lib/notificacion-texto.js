// lib/notificacion-texto.js — cómo se lee una notificación guardada.
//
// La comparten la campana (CosasPorResolver) y el centro de notificaciones
// (NotificationsCenter), como `lib/notificacion-destino.js`: la regla escrita
// dos veces se arregla en una y se queda rota en la otra.
//
// QA, 19 oct 2026 (DETALLES-CAJA #37):
//   · «Camilo Ortiz pide reabrir su caja del 2026-10-18 para seguir registrando
//     abonos»: la fecha en formato de base de datos, dentro de una frase.
//   · La hora decía «18 oct, 19:22» (24 h, `'es'` y la zona del teléfono)
//     cuando el resto de la app dice «7:22 p. m.» en la hora del negocio.

import { getLocale, getTimezone } from '@/lib/i18n'

// Un día de calendario suelto en el texto: 2026-10-18.
const DIA_ISO = /\b(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g

/**
 * «2026-10-18» → «18 de oct». Es un DÍA, no un instante: se lee en UTC al
 * mediodía, así ninguna zona lo corre al día anterior.
 */
export function diaDeCalendario(ymd, locale = 'es-CO') {
  const d = new Date(`${String(ymd).slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return String(ymd)
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/**
 * El mensaje tal cual, con las fechas `AAAA-MM-DD` dichas como se dicen. Los
 * avisos ya guardados las traen así; los nuevos salen bien desde el origen
 * (`/api/caja/reabrir`), y esto los deja iguales a los viejos.
 */
export function mensajeLegible(mensaje, locale = 'es-CO') {
  if (typeof mensaje !== 'string') return mensaje
  return mensaje.replace(DIA_ISO, (m) => diaDeCalendario(m, locale))
}

/**
 * «18 de oct, 7:22 p. m.» — en 12 h y en la zona del negocio, como el resto de
 * la app. `country` y `orgTimezone` salen de la sesión (`useCountry`).
 */
export function cuandoNotificacion(fecha, country, orgTimezone = null) {
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  if (fecha == null || Number.isNaN(d.getTime())) return ''
  const locale = getLocale(country ?? undefined)
  const timeZone = getTimezone(country ?? undefined, orgTimezone)
  const dia = d.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone })
  const hora = d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone })
  return `${dia}, ${hora}`
}
