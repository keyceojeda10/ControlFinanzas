// lib/i18n.js — Helpers de internacionalizacion parametrizados por pais
// Reemplazan los hardcodes de formatCOP, inicioDiaColombia, es-CO, UTC-5, etc.
// Importable tanto en server como en client.

import { COUNTRIES, DEFAULT_COUNTRY, getCountryConfig } from './countries'

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

export function formatMoney(amount, country = DEFAULT_COUNTRY) {
  const cfg = getCountryConfig(country)
  if (amount == null || isNaN(amount)) return cfg.currencySymbol + '0'
  const formatted = Math.round(Number(amount)).toLocaleString(cfg.locale, {
    minimumFractionDigits: cfg.currencyDecimals,
    maximumFractionDigits: cfg.currencyDecimals,
  })
  return cfg.currencySymbol + formatted
}

export function getCurrency(country = DEFAULT_COUNTRY) {
  return getCountryConfig(country).currency
}

export function getCurrencySymbol(country = DEFAULT_COUNTRY) {
  return getCountryConfig(country).currencySymbol
}

export function getCurrencyDecimals(country = DEFAULT_COUNTRY) {
  return getCountryConfig(country).currencyDecimals
}

export function getRoundingUnit(country = DEFAULT_COUNTRY) {
  return getCountryConfig(country).roundingUnit
}

// ── Timezone ────────────────────────────────────────────

export function getTimezone(country = DEFAULT_COUNTRY, orgTimezone = null) {
  if (orgTimezone) return orgTimezone
  return getCountryConfig(country).timezone
}

export function getUtcOffset(country = DEFAULT_COUNTRY) {
  return getCountryConfig(country).utcOffset
}

export function getTimezones(country = DEFAULT_COUNTRY) {
  const cfg = getCountryConfig(country)
  return cfg.timezones || [cfg.timezone]
}

export function hasMultipleTimezones(country = DEFAULT_COUNTRY) {
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
export function getLocalDateStr(country = DEFAULT_COUNTRY, orgTimezone = null) {
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
export function isHoy(fecha, country = DEFAULT_COUNTRY, orgTimezone = null) {
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
export function getLocalDate(country = DEFAULT_COUNTRY) {
  const offset = getUtcOffset(country)
  return new Date(Date.now() + offset * 60 * 60 * 1000)
}

// Retorna rango UTC de un dia local: { inicio: Date, fin: Date }
export function getLocalDayRange(dateStr, country = DEFAULT_COUNTRY) {
  const absOffset = Math.abs(getUtcOffset(country))
  const pad = (n) => String(n).padStart(2, '0')
  const inicio = new Date(`${dateStr}T${pad(absOffset)}:00:00.000Z`)
  const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1)
  return { inicio, fin }
}

// ── Locale y fechas ─────────────────────────────────────

export function getLocale(country = DEFAULT_COUNTRY) {
  return getCountryConfig(country).locale
}

export function getSpeechLang(country = DEFAULT_COUNTRY) {
  return getCountryConfig(country).speechLang
}

export function formatFechaLocal(fecha, country = DEFAULT_COUNTRY, orgTimezone = null) {
  if (!fecha) return ''
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  return d.toLocaleDateString(getLocale(country), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: getTimezone(country, orgTimezone),
  })
}

export function formatFechaCorta(fecha, country = DEFAULT_COUNTRY, orgTimezone = null) {
  if (!fecha) return 'N/A'
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  return d.toLocaleDateString(getLocale(country), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: getTimezone(country, orgTimezone),
  })
}

export function formatFechaHora(fecha, country = DEFAULT_COUNTRY, orgTimezone = null) {
  if (!fecha) return 'N/A'
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  const tz = getTimezone(country, orgTimezone)
  const locale = getLocale(country)
  const f = d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz })
  const h = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: tz })
  return `${f} ${h}`
}

// ── Validaciones ────────────────────────────────────────

export function validatePhone(phone, country = DEFAULT_COUNTRY) {
  const cfg = getCountryConfig(country)
  const cleaned = String(phone || '').replace(/[\s\-\(\)\.+]/g, '')
  return cfg.phoneRegex.test(cleaned)
}

export function getPhoneConfig(country = DEFAULT_COUNTRY) {
  const cfg = getCountryConfig(country)
  return {
    regex: cfg.phoneRegex,
    digits: cfg.phoneDigits,
    placeholder: cfg.phonePlaceholder,
    label: cfg.phoneLabel,
    prefix: cfg.phonePrefix,
  }
}

export function validateDocument(doc, country = DEFAULT_COUNTRY) {
  const cfg = getCountryConfig(country)
  return cfg.documentRegex.test(String(doc || '').trim())
}

export function getDocumentConfig(country = DEFAULT_COUNTRY) {
  const cfg = getCountryConfig(country)
  return {
    regex: cfg.documentRegex,
    label: cfg.documentLabel,
    abbr: cfg.documentAbbr,
    placeholder: cfg.documentPlaceholder,
  }
}

// ── Telefono internacional (para WhatsApp / llamadas) ───

export function formatearTelefonoIntl(telefono, country = DEFAULT_COUNTRY) {
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

export function getPaymentGateway(country = DEFAULT_COUNTRY) {
  return getCountryConfig(country).paymentGateway
}

export function hasOnlinePayment(country = DEFAULT_COUNTRY) {
  return getCountryConfig(country).paymentGateway !== 'manual'
}

// ── Fecha parsing (carga masiva) ────────────────────────

export function getDateFormat(country = DEFAULT_COUNTRY) {
  return getCountryConfig(country).dateFormat
}

// Parsea una fecha string segun el formato del pais
// Soporta DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
export function parseDateByCountry(dateStr, country = DEFAULT_COUNTRY) {
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
