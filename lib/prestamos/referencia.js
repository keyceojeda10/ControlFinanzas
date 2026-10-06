/* CÓMO SE NOMBRA UN CRÉDITO ANTE EL CLIENTE (6 oct 2026).
 *
 * Lo que el deudor reconoce es cuánto le prestaron y cuándo: «Crédito de
 * $500.000 del 7 sep». Si tiene más de uno, va también el número que ve el
 * prestamista en la app (lib/prestamos/numero.js): «Crédito #2 · $500.000 del
 * 7 sep». La usan TODAS las plantillas de WhatsApp y el comprobante. */
import { formatMoney } from '@/lib/i18n'

const fechaCorta = (d) => {
  const f = d ? new Date(d) : null
  if (!f || Number.isNaN(f.getTime())) return null
  // El «de» que mete el ICU nuevo («7 de sept») se quita: ver bug_icu_de_en_fecha_corta.
  return f.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' }).replace('.', '').replace(' de ', ' ')
}

/** @returns {string|null} «Crédito #2 · $500.000 del 7 sep», o null sin préstamo. */
export function referenciaDelCredito(prestamo, pais) {
  if (!prestamo || !(Number(prestamo.montoPrestado) > 0)) return null
  const monto = formatMoney(Math.round(Number(prestamo.montoPrestado)), pais)
  const fecha = fechaCorta(prestamo.fechaInicio)
  const cuando = fecha ? ` del ${fecha}` : ''
  return Number(prestamo.creditosCliente) > 1 && Number(prestamo.numeroCliente) > 0
    ? `Crédito #${prestamo.numeroCliente} · ${monto}${cuando}`
    : `Crédito de ${monto}${cuando}`
}
