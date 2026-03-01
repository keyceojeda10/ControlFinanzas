// lib/calculos.js - Funciones de cálculo reutilizables

/**
 * Determina el estado del cliente a partir de sus préstamos activos.
 * - mora:      tiene préstamos activos con cuotas vencidas
 * - activo:    tiene préstamos activos sin mora
 * - cancelado: no tiene préstamos activos
 */
export function calcularEstadoCliente(prestamos = []) {
  const activos = prestamos.filter((p) => p.estado === 'activo')
  if (!activos.length) return 'cancelado'

  const hoy = new Date()
  const enMora = activos.some((p) => {
    const fechaFin = new Date(p.fechaFin)
    return fechaFin < hoy
  })

  return enMora ? 'mora' : 'activo'
}

/**
 * Calcula los días de mora de un préstamo activo.
 * Retorna 0 si está al día.
 */
export function calcularDiasMora(prestamo) {
  if (prestamo.estado !== 'activo') return 0
  const hoy = new Date()
  const fin = new Date(prestamo.fechaFin)
  if (fin >= hoy) return 0
  return Math.floor((hoy - fin) / (1000 * 60 * 60 * 24))
}

/**
 * Calcula el saldo pendiente de un préstamo:
 * totalAPagar - suma de pagos recibidos.
 */
export function calcularSaldoPendiente(prestamo) {
  const pagado = (prestamo.pagos ?? []).reduce(
    (acc, p) => acc + (p.montoPagado ?? 0), 0
  )
  return Math.max(0, prestamo.totalAPagar - pagado)
}

/**
 * Porcentaje de pago completado (0–100).
 */
export function calcularPorcentajePagado(prestamo) {
  if (!prestamo.totalAPagar) return 0
  const pagado = (prestamo.pagos ?? []).reduce(
    (acc, p) => acc + (p.montoPagado ?? 0), 0
  )
  return Math.min(100, Math.round((pagado / prestamo.totalAPagar) * 100))
}

/**
 * Calcula los valores de un préstamo a partir de sus parámetros.
 * tasaInteres: porcentaje total sobre el monto prestado (no diario).
 * Ejemplo: monto=100000, tasa=20, dias=30
 *   totalInteres = 100000 × 0.20 = 20000
 *   totalAPagar  = 120000
 *   cuotaDiaria  = 120000 / 30 = 4000
 */
export function calcularPrestamo({ montoPrestado, tasaInteres, diasPlazo, fechaInicio }) {
  const monto  = Number(montoPrestado)
  const tasa   = Number(tasaInteres)
  const dias   = Number(diasPlazo)

  const totalInteres = Math.round(monto * (tasa / 100))
  const totalAPagar  = Math.round(monto + totalInteres)
  const cuotaDiaria  = Math.round(totalAPagar / dias)

  const fechaFin = new Date(fechaInicio)
  fechaFin.setDate(fechaFin.getDate() + dias)

  return { totalAPagar, cuotaDiaria, totalInteres, fechaFin }
}

/**
 * Verifica si un préstamo ya tiene un pago registrado hoy (UTC).
 */
export function pagoHoy(prestamo) {
  const hoy = new Date().toISOString().slice(0, 10)
  return (prestamo.pagos ?? []).some(
    (p) => new Date(p.fechaPago).toISOString().slice(0, 10) === hoy
  )
}

/**
 * Límites de clientes por plan.
 */
export const LIMITES_PLAN = {
  basic:        50,
  standard:     200,
  professional: Infinity,
}

/**
 * Formatea número como moneda colombiana.
 */
export function formatCOP(valor) {
  if (valor == null) return '$0'
  return '$' + Math.round(valor).toLocaleString('es-CO')
}
