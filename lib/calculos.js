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
  const enMora = activos.some((p) => calcularDiasMora(p) > 0)
  return enMora ? 'mora' : 'activo'
}

/**
 * Calcula los días de mora de un préstamo activo.
 * Compara lo que debería haber pagado hasta hoy (cuotas esperadas × cuota)
 * vs lo que realmente ha pagado. Si está atrasado, calcula cuántos días
 * de retraso tiene según la frecuencia.
 * 1 día de gracia para cobro diario, 2 para semanal+.
 */
export function calcularDiasMora(prestamo) {
  if (prestamo.estado !== 'activo') return 0

  const ahora  = new Date(Date.now() - 5 * 60 * 60 * 1000) // Colombia
  const inicio = new Date(prestamo.fechaInicio)

  // Si aún no empieza el préstamo, no hay mora
  if (inicio > ahora) return 0

  const freq = prestamo.frecuencia || 'diario'
  const diasPorPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[freq] || 1

  // Días transcurridos desde el inicio
  const diasTranscurridos = Math.floor((ahora - inicio) / (1000 * 60 * 60 * 24))

  // Cuotas que debería haber pagado hasta hoy
  const totalPeriodos  = Math.ceil(prestamo.diasPlazo / diasPorPeriodo)
  const periodosHastaHoy = Math.min(totalPeriodos, Math.floor(diasTranscurridos / diasPorPeriodo))
  const esperadoHastaHoy = periodosHastaHoy * prestamo.cuotaDiaria

  // Lo que realmente ha pagado
  const pagado = (prestamo.pagos ?? []).reduce((a, p) => a + (p.montoPagado ?? 0), 0)

  // Si ha pagado lo esperado o más, no hay mora
  if (pagado >= esperadoHastaHoy) return 0

  // Cuántas cuotas de atraso tiene (protección contra cuotaDiaria=0)
  if (!prestamo.cuotaDiaria) return 0
  const cuotasAtrasadas = Math.floor((esperadoHastaHoy - pagado) / prestamo.cuotaDiaria)
  const diasMora = cuotasAtrasadas * diasPorPeriodo

  // Período de gracia: 1 día para diario, 2 para semanal+
  const gracia = diasPorPeriodo === 1 ? 1 : 2
  return Math.max(0, diasMora - gracia)
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
 * frecuencia: diario, semanal, quincenal, mensual
 * Ejemplo: monto=100000, tasa=20, dias=30, frecuencia=diario
 *   totalInteres = 100000 × 0.20 = 20000
 *   totalAPagar  = 120000
 *   cuotaDiaria  = 120000 / 30 = 4000
 */
export function calcularPrestamo({ montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia = 'diario' }) {
  const monto  = Number(montoPrestado)
  const tasa   = Number(tasaInteres)
  const dias   = Number(diasPlazo)
  const freq   = frecuencia || 'diario'

  const diasPorPeriodo = {
    diario:    1,
    semanal:   7,
    quincenal: 15,
    mensual:   30,
  }

  const diasPeriodo = diasPorPeriodo[freq] || 1
  const numPeriodos = Math.ceil(dias / diasPeriodo)

  const totalInteres = Math.round(monto * (tasa / 100))
  const totalAPagar  = Math.round(monto + totalInteres)
  const cuotaDiaria  = Math.round(totalAPagar / numPeriodos)

  const fechaFin = new Date(fechaInicio)
  fechaFin.setDate(fechaFin.getDate() + dias)

  return { totalAPagar, cuotaDiaria, totalInteres, fechaFin, frecuencia: freq, diasPeriodo }
}

/**
 * Verifica si un préstamo ya tiene un pago registrado hoy (Colombia).
 */
export function pagoHoy(prestamo) {
  const hoy = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return (prestamo.pagos ?? []).some(
    (p) => new Date(new Date(p.fechaPago).getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10) === hoy
  )
}

/**
 * Límites de clientes por plan.
 */
export const LIMITES_PLAN = {
  basic:        50,
  standard:     300,
  professional: Infinity,
}

/**
 * Formatea número como moneda colombiana.
 */
export function formatCOP(valor) {
  if (valor == null) return '$0'
  return '$' + Math.round(valor).toLocaleString('es-CO')
}

/**
 * Opciones de días para abono rápido.
 */
export const DIAS_ABONO = [1, 2, 3, 5, 10]
