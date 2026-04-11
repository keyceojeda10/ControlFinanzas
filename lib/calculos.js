// lib/calculos.js - Funciones de cálculo reutilizables
import { contarDiasExcluidos } from './dias-sin-cobro'

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
const TIPOS_AJUSTE = ['recargo', 'descuento']

export function calcularDiasMora(prestamo, diasExcluidos = []) {
  if (prestamo.estado !== 'activo') return 0

  const ahora  = new Date(Date.now() - 5 * 60 * 60 * 1000) // Colombia
  const inicio = new Date(prestamo.fechaInicio)

  // Si aún no empieza el préstamo, no hay mora
  if (inicio > ahora) return 0

  const freq = prestamo.frecuencia || 'diario'
  const diasPorPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[freq] || 1

  // Días transcurridos desde el inicio, restando días sin cobro
  const diasCalendario = Math.floor((ahora - inicio) / (1000 * 60 * 60 * 24))
  const diasDescontados = diasExcluidos.length > 0
    ? contarDiasExcluidos(inicio, ahora, diasExcluidos)
    : 0
  const diasTranscurridos = Math.max(0, diasCalendario - diasDescontados)

  // Cuotas que debería haber pagado hasta hoy
  const totalPeriodos  = Math.ceil(prestamo.diasPlazo / diasPorPeriodo)
  const periodosHastaHoy = Math.min(totalPeriodos, Math.floor(diasTranscurridos / diasPorPeriodo))
  const esperadoHastaHoy = periodosHastaHoy * prestamo.cuotaDiaria

  // Lo que realmente ha pagado (excluir ajustes)
  const pagado = (prestamo.pagos ?? []).reduce((a, p) => TIPOS_AJUSTE.includes(p.tipo) ? a : a + (p.montoPagado ?? 0), 0)

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
    (acc, p) => TIPOS_AJUSTE.includes(p.tipo) ? acc : acc + (p.montoPagado ?? 0), 0
  )
  return Math.max(0, prestamo.totalAPagar - pagado)
}

/**
 * Porcentaje de pago completado (0–100).
 */
export function calcularPorcentajePagado(prestamo) {
  if (!prestamo.totalAPagar) return 0
  const pagado = (prestamo.pagos ?? []).reduce(
    (acc, p) => TIPOS_AJUSTE.includes(p.tipo) ? acc : acc + (p.montoPagado ?? 0), 0
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

  // Interes mensual: para cobro diario se calcula proporcional (dias/30).
  // Para semanal/quincenal/mensual se redondea a meses completos (ceil)
  // porque el prestamista cobra interes por mes entero:
  // 8 semanas (56 dias) = 2 meses de interes, no 1.87
  const meses = freq === 'diario' ? dias / 30 : Math.ceil(dias / 30)
  const interesReal = monto * (tasa / 100) * meses
  const totalAPagar = Math.round(monto + interesReal)
  const totalInteres = totalAPagar - monto

  // Cuota redondeada HACIA ABAJO al multiplo de 50 (moneda minima practica en Colombia).
  // Las primeras N-1 cuotas son iguales y la ultima "ajusta" el resto para que el total
  // cierre exactamente. Asi el cobrador nunca pide monedas de 1/3 pesos y el cliente
  // paga el interes real, sin inflar ni subestimar el valor.
  let cuotaDiaria, ultimaCuota
  if (numPeriodos <= 1) {
    cuotaDiaria = Math.max(50, totalAPagar)
    ultimaCuota = cuotaDiaria
  } else {
    const cuotaBase = totalAPagar / numPeriodos
    cuotaDiaria = Math.max(50, Math.floor(cuotaBase / 50) * 50)
    ultimaCuota = totalAPagar - cuotaDiaria * (numPeriodos - 1)
    // Seguridad: si por montos muy pequenos la ultima quedara negativa, igualar a la cuota
    if (ultimaCuota < 0) ultimaCuota = cuotaDiaria
  }

  const fechaFin = new Date(fechaInicio)
  fechaFin.setDate(fechaFin.getDate() + dias)

  return { totalAPagar, cuotaDiaria, ultimaCuota, totalInteres, fechaFin, frecuencia: freq, diasPeriodo, numPeriodos }
}

/**
 * Verifica si un préstamo ya tiene un pago registrado hoy (Colombia).
 */
export function pagoHoy(prestamo) {
  const hoy = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return (prestamo.pagos ?? []).some(
    (p) => !TIPOS_AJUSTE.includes(p.tipo) && new Date(new Date(p.fechaPago).getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10) === hoy
  )
}

/**
 * Calcula el capital (principal) restante del préstamo.
 * Es montoPrestado menos la suma de abonos a capital.
 */
export function calcularCapitalRestante(prestamo) {
  const abonosCapital = (prestamo.pagos ?? [])
    .filter(p => p.tipo === 'capital')
    .reduce((a, p) => a + (p.montoPagado ?? 0), 0)
  return Math.max(0, prestamo.montoPrestado - abonosCapital)
}

/**
 * Límites de clientes por plan.
 */
export { LIMITES_PLAN } from '@/lib/planes'

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
