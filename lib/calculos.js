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
