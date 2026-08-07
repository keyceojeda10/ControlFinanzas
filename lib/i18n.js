// lib/i18n.js — Helpers de internacionalizacion parametrizados por pais
// Reemplazan los hardcodes de formatCOP, inicioDiaColombia, es-CO, UTC-5, etc.
// Importable tanto en server como en client.

import { COUNTRIES, DEFAULT_COUNTRY, getCountryConfig } from './countries'

// ══ EL PAÍS ACTIVO ═════════════════════════════════════════════════════════
//
// Todas las funciones de aquí reciben el país por parámetro y, si no se lo dan,
// caían a Colombia. Medido: 465 llamadas a `formatMoney` en 49 ficheros lo
// omiten. Para Argentina, Chile o Uruguay no se nota —comparten el símbolo `$`—
// pero un paraguayo vería «$500.000» donde su moneda escribe «₲500.000», y un
// boliviano «$» en vez de «Bs».
//
// Pasar el país en las 465 llamadas sería tocar de golpe todas las pantallas del
// dinero. En vez de eso, el arranque de la app deja aquí el país de la
// organización y esas 465 llamadas empiezan a acertar sin cambiar ni una.
//
// ⚠ ES UN RESPALDO, NO UN ESTADO. Quien tenga el país a mano debe seguir
// pasándolo: en el servidor este valor NO se fija —una petición de un negocio
// argentino y otra de uno colombiano comparten proceso— y ahí sigue mandando
// `DEFAULT_COUNTRY`. Por eso los sitios que ya lo pasan (`useCountry`, los
// endpoints) no se tocan: son los correctos.
let paisActivo = null

/** Lo llama el layout del panel con el país de la organización. */
export function fijarPaisActivo(country) {
  paisActivo = COUNTRIES[country] ? country : null
}

/**
 * El país que se usa cuando la llamada no trae uno.
 * Exportada para que otros ayudantes —`lib/documento.js`— compartan el mismo
 * respaldo en vez de inventarse el suyo.
 */
export function paisDeLaApp() {
  return paisActivo ?? DEFAULT_COUNTRY
}
const paisPorDefecto = paisDeLaApp

// ── Entrada de decimales (tasas) ────────────────────────
// Normaliza lo que el usuario escribe en un campo de porcentaje/decimal.
// Acepta coma O punto como separador (en movil el teclado depende del locale
// del telefono: uno usa "," y otro "."). Con <input type="number"> el navegador
// RECHAZA el separador que no coincide con su locale y el valor llega vacio —
// bug reportado: "no me deja poner 7.5 desde el movil". Por eso los campos de
// tasa usan type="text" inputMode="decimal" y pasan por aqui.
// Devuelve un string con a lo sumo un punto, solo digitos y punto.
export function soloDecimal(v) {
  if (v == null) return ''
  let s = String(v).replace(',', '.').replace(/[^0-9.]/g, '')
  const i = s.indexOf('.')
  if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '')
  return s
}

// ── Moneda ──────────────────────────────────────────────

export function formatMoney(amount, country = paisPorDefecto()) {
  const cfg = getCountryConfig(country)
  if (amount == null || isNaN(amount)) return cfg.currencySymbol + '0'
  const n = Math.round(Number(amount))
  const formatted = Math.abs(n).toLocaleString(cfg.locale, {
    minimumFractionDigits: cfg.currencyDecimals,
    maximumFractionDigits: cfg.currencyDecimals,
  })
  // ⚠ EL MENOS VA ANTES DEL SÍMBOLO: «−$380.000», no «$-380.000».
  //
  // Se pegaba el símbolo a un número que YA traía su signo, y salía el peso
  // separado de su cifra por un guion. Lo vi en una captura del capital
  // negativo; en el código no se nota porque la concatenación parece correcta.
  //
  // Con el menos tipográfico (−, U+2212) y no el guion del teclado: es el que
  // usa el resto de la app para las salidas de dinero y tiene el mismo ancho
  // que el +, así que las columnas de cifras no bailan.
  return (n < 0 ? '−' : '') + cfg.currencySymbol + formatted
}
export function getCurrency(country = paisPorDefecto()) {
  return getCountryConfig(country).currency
}

export function getCurrencySymbol(country = paisPorDefecto()) {
  return getCountryConfig(country).currencySymbol
}

export function getCurrencyDecimals(country = paisPorDefecto()) {
  return getCountryConfig(country).currencyDecimals
}

export function getRoundingUnit(country = paisPorDefecto()) {
  return getCountryConfig(country).roundingUnit
}

// ── Timezone ────────────────────────────────────────────

export function getTimezone(country = paisPorDefecto(), orgTimezone = null) {
  if (orgTimezone) return orgTimezone
  return getCountryConfig(country).timezone
}

export function getUtcOffset(country = paisPorDefecto()) {
  return getCountryConfig(country).utcOffset
}

export function getTimezones(country = paisPorDefecto()) {
  const cfg = getCountryConfig(country)
  return cfg.timezones || [cfg.timezone]
}

export function hasMultipleTimezones(country = paisPorDefecto()) {
  const cfg = getCountryConfig(country)
  return Array.isArray(cfg.timezones) && cfg.timezones.length > 1
}

// Reemplazo de inicioDiaColombia(). Retorna inicio del dia local como Date UTC.
// offsetHoras: offset UTC en horas (ej: -5 para Colombia, -6 para Mexico)
export function inicioDiaLocal(valor = Date.now(), offsetHoras = -5) {
  const fecha = valor instanceof Date ? valor : new Date(valor)
  const absOffset = Math.abs(offsetHoras)
  const ms = absOffset * 60 * 60 * 1000
  const local = new Date(fecha.getTime() - ms)
  return new Date(Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    absOffset, 0, 0, 0
  ))
}

// Retorna la fecha actual en la timezone del pais como string YYYY-MM-DD
export function getLocalDateStr(country = paisPorDefecto(), orgTimezone = null) {
  const tz = getTimezone(country, orgTimezone)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find(p => p.type === 'year').value
  const m = parts.find(p => p.type === 'month').value
  const d = parts.find(p => p.type === 'day').value
  return `${y}-${m}-${d}`
}

// True si la fecha cae en el mismo dia local que hoy en el pais del usuario.
export function isHoy(fecha, country = paisPorDefecto(), orgTimezone = null) {
  if (!fecha) return false
  const tz = getTimezone(country, orgTimezone)
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const aStr = fmt.format(new Date(fecha))
  const bStr = fmt.format(new Date())
  return aStr === bStr
}

// Retorna Date actual ajustada a la timezone del pais (como si fuera UTC)
export function getLocalDate(country = paisPorDefecto()) {
  const offset = getUtcOffset(country)
  return new Date(Date.now() + offset * 60 * 60 * 1000)
}

/* ══ CUÁNDO EMPEZÓ EL DÍA DE HOY, EN UTC ═══════════════════════════════════
 *
 * Existe para que nadie vuelva a escribir a mano las dos líneas de convertir
 * «ahora» al día local y pedir su rango. Estaban duplicadas en `/api/clientes`
 * y a punto de duplicarse otra vez en `/api/prestamos`, y en este proyecto las
 * fechas duplicadas se separan: el servidor corre en UTC y el desarrollo en
 * Bogotá, así que un día de diferencia no se ve hasta que está desplegado.
 *
 * Es la MISMA frontera que usan la caja, el cierre y «cobrar hoy»: 05:00Z en
 * Colombia. Si el filtro de «lo de hoy» usara otra, el número de préstamos que
 * salieron hoy no cuadraría con los desembolsos de la caja — dos cifras para lo
 * mismo, que es como se pierde la confianza en la app. */
export function inicioDelDiaLocal(country = paisPorDefecto()) {
  const hoy = getLocalDate(country).toISOString().slice(0, 10)
  return getLocalDayRange(hoy, country).inicio
}

// Retorna rango UTC de un dia local: { inicio: Date, fin: Date }
export function getLocalDayRange(dateStr, country = paisPorDefecto()) {
  const absOffset = Math.abs(getUtcOffset(country))
  const pad = (n) => String(n).padStart(2, '0')
  const inicio = new Date(`${dateStr}T${pad(absOffset)}:00:00.000Z`)
  const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1)
  return { inicio, fin }
}

// ── Locale y fechas ─────────────────────────────────────

export function getLocale(country = paisPorDefecto()) {
  return getCountryConfig(country).locale
}

export function getSpeechLang(country = paisPorDefecto()) {
  return getCountryConfig(country).speechLang
}

export function formatFechaLocal(fecha, country = paisPorDefecto(), orgTimezone = null) {
  if (!fecha) return ''
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  return d.toLocaleDateString(getLocale(country), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: getTimezone(country, orgTimezone),
  })
}

export function formatFechaCorta(fecha, country = paisPorDefecto(), orgTimezone = null) {
  if (!fecha) return 'N/A'
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  return d.toLocaleDateString(getLocale(country), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: getTimezone(country, orgTimezone),
  })
}

// ── ⚠ UNA FECHA DE CALENDARIO NO SE LEE EN NINGUNA ZONA: SE LEE EN UTC ────
//
// `Prestamo.fechaInicio` y `fechaFin` NO son instantes. Son días del calendario
// que el sistema calcula EN UTC (`fechaDePeriodo` usa `setUTCDate` y
// `Date.UTC`), así que hay que leerlos igual.
//
// Si se formatean con la zona del negocio —o peor, con la del teléfono— un
// `2026-07-31T00:00:00Z` sale como **30 de julio**: en Bogotá ese instante es
// el 30 a las 19:00. Un prestamista lo reportó con el comprobante impreso.
//
// Medido en producción: `fechaFin` está a las 00:00Z en **7.418 de 8.696
// préstamos (85%)**. `fechaInicio`, a las 05:00Z en el 100% — por eso el inicio
// salía bien y el fin no.
//
// ⚠ NO usar esto para `fechaPago`: un pago SÍ es un instante (97% guardados a
// horas variadas) y va con `formatFechaCorta`, en la zona del negocio. Leer un
// cobro de las 7 de la noche en UTC lo pondría al día siguiente.
export function formatFechaCalendario(fecha, country = paisPorDefecto()) {
  if (!fecha) return 'N/A'
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  return d.toLocaleDateString(getLocale(country), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatFechaHora(fecha, country = paisPorDefecto(), orgTimezone = null) {
  if (!fecha) return 'N/A'
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  const tz = getTimezone(country, orgTimezone)
  const locale = getLocale(country)
  const f = d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz })
  const h = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: tz })
  return `${f} ${h}`
}

// ── Validaciones ────────────────────────────────────────

export function validatePhone(phone, country = paisPorDefecto()) {
  const cfg = getCountryConfig(country)
  const cleaned = String(phone || '').replace(/[\s\-\(\)\.+]/g, '')
  return cfg.phoneRegex.test(cleaned)
}

export function getPhoneConfig(country = paisPorDefecto()) {
  const cfg = getCountryConfig(country)
  return {
    regex: cfg.phoneRegex,
    digits: cfg.phoneDigits,
    placeholder: cfg.phonePlaceholder,
    label: cfg.phoneLabel,
    prefix: cfg.phonePrefix,
  }
}

export function validateDocument(doc, country = paisPorDefecto()) {
  const cfg = getCountryConfig(country)
  return cfg.documentRegex.test(String(doc || '').trim())
}

export function getDocumentConfig(country = paisPorDefecto()) {
  const cfg = getCountryConfig(country)
  return {
    regex: cfg.documentRegex,
    label: cfg.documentLabel,
    abbr: cfg.documentAbbr,
    placeholder: cfg.documentPlaceholder,
  }
}

// ── Telefono internacional (para WhatsApp / llamadas) ───

export function formatearTelefonoIntl(telefono, country = paisPorDefecto()) {
  if (!telefono) return null
  const cfg = getCountryConfig(country)
  let limpio = String(telefono).replace(/[\s\-\(\)\.+]/g, '')

  // Si ya tiene el prefijo del pais (sin +), retornar directo
  const prefixDigits = cfg.phonePrefix.replace('+', '')
  if (limpio.startsWith(prefixDigits) && limpio.length === prefixDigits.length + cfg.phoneDigits) {
    return limpio
  }

  // Quitar 0 inicial si existe (comun en Ecuador, algunos paises)
  if (limpio.startsWith('0')) limpio = limpio.slice(1)

  // Si tiene la cantidad correcta de digitos, agregar prefijo
  if (limpio.length === cfg.phoneDigits) {
    return prefixDigits + limpio
  }

  // Fallback: si tiene un digito mas que phoneDigits (por 0 inicial ya quitado), intentar
  if (limpio.length === cfg.phoneDigits + 1 && limpio.startsWith('0')) {
    return prefixDigits + limpio.slice(1)
  }

  return null
}

// ── Pagos ───────────────────────────────────────────────

export function getPaymentGateway(country = paisPorDefecto()) {
  return getCountryConfig(country).paymentGateway
}

export function hasOnlinePayment(country = paisPorDefecto()) {
  return getCountryConfig(country).paymentGateway !== 'manual'
}

// ── Fecha parsing (carga masiva) ────────────────────────

export function getDateFormat(country = paisPorDefecto()) {
  return getCountryConfig(country).dateFormat
}

// Parsea una fecha string segun el formato del pais
// Soporta DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
export function parseDateByCountry(dateStr, country = paisPorDefecto()) {
  if (!dateStr) return null
  const s = String(dateStr).trim()

  // ISO format siempre se acepta
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  }

  const dmy = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/)
  if (dmy) {
    const format = getDateFormat(country)
    if (format === 'MM/DD/YYYY') {
      const [, mm, dd, yyyy] = dmy
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    }
    // DD/MM/YYYY (default LATAM)
    const [, dd, mm, yyyy] = dmy
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }

  return null
}

// Re-export getCountryConfig para conveniencia
export { getCountryConfig, COUNTRIES, DEFAULT_COUNTRY, COUNTRY_CODES } from './countries'
