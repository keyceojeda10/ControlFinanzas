'use client'
// hooks/useCountry.js — Expone config del pais de la organizacion del usuario
// Centraliza formateo de moneda, validaciones, timezone, etc. para componentes client.

import { useAuth } from './useAuth'
import {
  formatMoney,
  getCountryConfig,
  validatePhone,
  validateDocument,
  getDocumentConfig,
  getPhoneConfig,
  getLocale,
  getTimezone,
  getSpeechLang,
  formatFechaCorta,
  formatFechaHora,
  formatearTelefonoIntl,
  hasOnlinePayment,
  getDateFormat,
} from '@/lib/i18n'

export function useCountry() {
  const { session } = useAuth()
  const country = session?.user?.country ?? 'co'
  const orgTimezone = session?.user?.timezone ?? null
  const cfg = getCountryConfig(country)

  return {
    country,
    config: cfg,
    formatMoney: (amount) => formatMoney(amount, country),
    formatFecha: (fecha) => formatFechaCorta(fecha, country, orgTimezone),
    formatFechaHora: (fecha) => formatFechaHora(fecha, country, orgTimezone),
    formatTelefono: (tel) => formatearTelefonoIntl(tel, country),
    locale: cfg.locale,
    timezone: getTimezone(country, orgTimezone),
    speechLang: getSpeechLang(country),
    currency: cfg.currency,
    currencySymbol: cfg.currencySymbol,
    currencyDecimals: cfg.currencyDecimals,
    validatePhone: (phone) => validatePhone(phone, country),
    validateDocument: (doc) => validateDocument(doc, country),
    documentConfig: getDocumentConfig(country),
    phoneConfig: getPhoneConfig(country),
    dateFormat: getDateFormat(country),
    hasOnlinePayment: hasOnlinePayment(country),
  }
}
