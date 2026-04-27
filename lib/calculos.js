// lib/calculos.js - Funciones de cálculo reutilizables
import { contarDiasExcluidos } from './dias-sin-cobro'

/**
 * Determina el estado del cliente a partir de sus préstamos activos.
 * - mora:      tiene préstamos activos con cuotas vencidas
 * - activo:    tiene préstamos activos sin mora
 * - cancelado: no tiene préstamos activos
 */
export function calcularEstadoCliente(prestamos = [], diasExcluidos = []) {
  const activos = prestamos.filter((p) => p.estado === 'activo')
  if (!activos.length) return 'cancelado'
  const enMora = activos.some((p) => calcularDiasMora(p, diasExcluidos) > 0)
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

const DAY_MS = 24 * 60 * 60 * 1000

function obtenerDiasPorPeriodo(frecuencia = 'diario') {
  return { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[frecuencia] || 1
}

function calcularTotalPagadoReal(prestamo) {
  return (prestamo?.pagos ?? []).reduce(
    (acc, p) => TIPOS_AJUSTE.includes(p.tipo) ? acc : acc + (p.montoPagado ?? 0), 0
  )
}

function inicioDiaColombia(valor = Date.now()) {
  const fecha = valor instanceof Date ? valor : new Date(valor)
  const col = new Date(fecha.getTime() - 5 * 60 * 60 * 1000)
  return new Date(Date.UTC(col.getUTCFullYear(), col.getUTCMonth(), col.getUTCDate(), 5, 0, 0, 0))
}

function calcularDiasTranscurridosCobrables(inicio, fecha, diasExcluidos = []) {
  const inicioCol = inicioDiaColombia(inicio)
  const fechaCol = inicioDiaColombia(fecha)
  const diasCalendario = Math.floor((fechaCol - inicioCol) / DAY_MS)
  const diasDescontados = diasExcluidos.length > 0
    ? contarDiasExcluidos(inicioCol, fechaCol, diasExcluidos)
    : 0
  return Math.max(0, diasCalendario - diasDescontados)
}

export function calcularDiasMora(prestamo, diasExcluidos = []) {
  if (prestamo.estado !== 'activo') return 0
  if (!prestamo.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0
  if (calcularSaldoPendiente(prestamo) <= 0) return 0

  const hoy = inicioDiaColombia()
  const inicio = inicioDiaColombia(prestamo.fechaInicio)

  // Si aún no empieza el préstamo, no hay mora
  if (inicio > hoy) return 0

  const freq = prestamo.frecuencia || 'diario'
  const diasPorPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[freq] || 1
  const proximoCobro = calcularProximoCobro(prestamo, diasExcluidos)

  if (!proximoCobro) return 0

  const proximoDia = inicioDiaColombia(proximoCobro)
  if (proximoDia > hoy) return 0

  const manana = new Date(hoy.getTime() + DAY_MS)
  const diasAtraso = calcularDiasTranscurridosCobrables(proximoDia, manana, diasExcluidos)

  // Período de gracia: 1 día para diario, 2 para semanal+.
  // Se descuenta sobre días cobrables vencidos desde la primera cuota pendiente.
  const gracia = diasPorPeriodo === 1 ? 1 : 2
  return Math.max(0, diasAtraso - gracia)
}

/**
 * Calcula el saldo pendiente de un préstamo:
 * totalAPagar - suma de pagos recibidos.
 */
export function calcularSaldoPendiente(prestamo) {
  const pagado = calcularTotalPagadoReal(prestamo)
  return Math.max(0, prestamo.totalAPagar - pagado)
}

function calcularPeriodosEsperadosHastaHoy(prestamo, diasExcluidos = []) {
  if (!prestamo?.fechaInicio || !prestamo?.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0

  const inicio = inicioDiaColombia(prestamo.fechaInicio)
  const hoy = inicioDiaColombia()
  if (inicio > hoy) return 0

  const freq = prestamo.frecuencia || 'diario'
  const diasPeriodo = obtenerDiasPorPeriodo(freq)
  // diasSinCobro solo aplica a frecuencia diaria. Para semanal/quincenal/mensual
  // un periodo son siempre 7/15/30 dias calendario.
  const diasTranscurridos = freq === 'diario'
    ? calcularDiasTranscurridosCobrables(inicio, hoy, diasExcluidos)
    : Math.floor((hoy.getTime() - inicio.getTime()) / DAY_MS)
  let periodosEsperados = Math.floor(diasTranscurridos / diasPeriodo)

  const totalPeriodosPorPlazo = prestamo.diasPlazo
    ? Math.ceil(prestamo.diasPlazo / diasPeriodo)
    : null
  const totalPeriodosPorMonto = prestamo.totalAPagar
    ? Math.ceil(prestamo.totalAPagar / prestamo.cuotaDiaria)
    : null
  const totalPeriodos = totalPeriodosPorPlazo || totalPeriodosPorMonto
  if (totalPeriodos) {
    periodosEsperados = Math.min(periodosEsperados, totalPeriodos)
  }

  return Math.max(0, periodosEsperados)
}

/**
 * Cuotas (periodos) que faltan para terminar el préstamo.
 */
export function calcularCuotasPendientes(prestamo) {
  if (!prestamo?.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0
  const saldo = calcularSaldoPendiente(prestamo)
  if (saldo <= 0) return 0
  return Math.max(0, Math.ceil(saldo / prestamo.cuotaDiaria))
}

/**
 * Cuotas vencidas en mora (aplica periodo de gracia).
 * Nota: no es lo mismo que "cuotas pendientes".
 */
export function calcularCuotasEnMora(prestamo, diasExcluidos = []) {
  const diasMora = calcularDiasMora(prestamo, diasExcluidos)
  if (diasMora <= 0) return 0
  const diasPeriodo = obtenerDiasPorPeriodo(prestamo?.frecuencia)
  return Math.max(1, Math.ceil(diasMora / diasPeriodo))
}

/**
 * Monto correspondiente a las cuotas en mora (con tope al saldo pendiente).
 */
export function calcularMontoEnMora(prestamo, diasExcluidos = []) {
  if (!prestamo?.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0
  const cuotasEnMora = calcularCuotasEnMora(prestamo, diasExcluidos)
  if (cuotasEnMora <= 0) return 0
  const saldo = calcularSaldoPendiente(prestamo)
  return Math.min(saldo, Math.round(cuotasEnMora * prestamo.cuotaDiaria))
}

/**
 * Monto que el cliente debe pagar hoy para quedar "al día" según cobertura esperada.
 * Incluye lo atrasado y el cobro esperado al corte de hoy (si aplica).
 */
export function calcularMontoParaPonerseAlDia(prestamo, diasExcluidos = []) {
  if (!prestamo || prestamo.estado !== 'activo') return 0
  if (!prestamo.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0

  const saldo = calcularSaldoPendiente(prestamo)
  if (saldo <= 0) return 0

  const periodosEsperados = calcularPeriodosEsperadosHastaHoy(prestamo, diasExcluidos)
  if (periodosEsperados <= 0) return 0

  const esperadoPorPeriodo = periodosEsperados * prestamo.cuotaDiaria
  const esperado = prestamo.totalAPagar
    ? Math.min(esperadoPorPeriodo, prestamo.totalAPagar)
    : esperadoPorPeriodo

  const pagado = calcularTotalPagadoReal(prestamo)
  const faltante = Math.max(0, Math.round(esperado - pagado))
  return Math.min(saldo, faltante)
}

/**
 * Porcentaje de pago completado (0–100).
 */
export function calcularPorcentajePagado(prestamo) {
  if (!prestamo.totalAPagar) return 0
  const pagado = calcularTotalPagadoReal(prestamo)
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
export function calcularPrestamo({ montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia = 'diario', cuotaManual }) {
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

  // Modo manual: el prestamista fija la cuota que quiere cobrar (redonda).
  // El total a pagar se vuelve cuota * numPeriodos y el interes efectivo
  // se deriva del total. La tasa ingresada se ignora en este modo.
  const cuotaManualNum = Number(cuotaManual)
  if (cuotaManualNum && cuotaManualNum > 0) {
    const cuotaDiaria = Math.round(cuotaManualNum)
    const totalAPagar = cuotaDiaria * numPeriodos
    const totalInteres = Math.max(0, totalAPagar - monto)
    const fechaFin = new Date(fechaInicio)
    fechaFin.setDate(fechaFin.getDate() + dias)
    return {
      totalAPagar,
      cuotaDiaria,
      ultimaCuota: cuotaDiaria,
      totalInteres,
      fechaFin,
      frecuencia: freq,
      diasPeriodo,
      numPeriodos,
      modoManual: true,
    }
  }

  // Interes proporcional al tiempo real del prestamo, sin importar la frecuencia
  // de cobro. La tasa esta expresada como porcentaje mensual (cada 30 dias).
  // Si el prestamista quiere cobrar mas, puede usar el modo manual de cuota
  // o subir la tasa.
  const meses = dias / 30
  const interesReal = monto * (tasa / 100) * meses
  const totalAPagar = Math.round(monto + interesReal)

  // Cuota redondeada al multiplo de $1.000 mas cercano (moneda minima
  // practica en Colombia — nadie paga con monedas de 50/100/500). Todas
  // las cuotas son iguales y el totalAPagar se ajusta a cuota * numPeriodos.
  // El interes efectivo cambia ligeramente respecto al teorico, pero no
  // queda ninguna cuota rara con digitos sueltos.
  let cuotaDiaria, ultimaCuota, totalAPagarFinal
  if (numPeriodos <= 1) {
    cuotaDiaria = Math.max(1000, Math.round(totalAPagar / 1000) * 1000)
    ultimaCuota = cuotaDiaria
    totalAPagarFinal = cuotaDiaria
  } else {
    const cuotaBase = totalAPagar / numPeriodos
    cuotaDiaria = Math.max(1000, Math.round(cuotaBase / 1000) * 1000)
    ultimaCuota = cuotaDiaria
    totalAPagarFinal = cuotaDiaria * numPeriodos
  }
  const totalInteresFinal = Math.max(0, totalAPagarFinal - monto)

  const fechaFin = new Date(fechaInicio)
  fechaFin.setDate(fechaFin.getDate() + dias)

  return {
    totalAPagar: totalAPagarFinal,
    cuotaDiaria,
    ultimaCuota,
    totalInteres: totalInteresFinal,
    fechaFin,
    frecuencia: freq,
    diasPeriodo,
    numPeriodos,
    modoManual: false,
  }
}

/**
 * Calcula la fecha programada de la próxima cuota pendiente.
 * Se basa en monto pagado real (no en cantidad de pagos) y usa
 * la misma lógica de días sin cobro de calcularDiasMora.
 * Devuelve un Date (medianoche local) o null si no aplica.
 */
export function calcularProximoCobro(prestamo, diasExcluidos = []) {
  if (!prestamo?.fechaInicio) return null
  if (prestamo.estado && prestamo.estado !== 'activo') return null
  if (!prestamo.cuotaDiaria || prestamo.cuotaDiaria <= 0) return null

  const freq = prestamo.frecuencia || 'diario'
  const diasPeriodo = obtenerDiasPorPeriodo(freq)

  const inicioMed = inicioDiaColombia(prestamo.fechaInicio)

  // Cobertura por monto real pagado (excluyendo ajustes).
  const pagado = Array.isArray(prestamo.pagos)
    ? calcularTotalPagadoReal(prestamo)
    : 0
  const periodosCubiertos = Math.floor(pagado / prestamo.cuotaDiaria)

  const totalPeriodosPorPlazo = prestamo.diasPlazo
    ? Math.ceil(prestamo.diasPlazo / diasPeriodo)
    : null
  const totalPeriodosPorMonto = prestamo.totalAPagar
    ? Math.ceil(prestamo.totalAPagar / prestamo.cuotaDiaria)
    : null
  const totalPeriodos = totalPeriodosPorPlazo || totalPeriodosPorMonto

  // Si ya cubrió todas las cuotas esperadas, no hay próximo cobro.
  if (totalPeriodos && periodosCubiertos >= totalPeriodos) return null

  // Cuota pendiente inmediata: N = cubiertas + 1.
  const proximaCuotaNum = periodosCubiertos + 1
  const diasCobrablesObjetivo = proximaCuotaNum * diasPeriodo

  let fechaBase
  // Para frecuencias no diarias el calendario es simple: cada periodo son N dias
  // calendario (7/15/30). Los diasSinCobro solo aplican para reprogramar dia a
  // dia en frecuencia diaria. Si para semanal interpretaramos diasSinCobro,
  // una ruta con [0..5] (cobra solo sabado) llevaria la 1a cuota a 7 sabados
  // despues — bug reportado por el cliente.
  if (freq !== 'diario' || !diasExcluidos || diasExcluidos.length === 0) {
    fechaBase = new Date(inicioMed.getTime() + diasCobrablesObjetivo * DAY_MS)
  } else {
    // Diario con diasSinCobro: buscar la fecha cuyo "dia cobrable transcurrido"
    // coincida con la cuota objetivo.
    fechaBase = new Date(inicioMed.getTime() + diasCobrablesObjetivo * DAY_MS)
    let fecha = new Date(inicioMed)
    const maxIteraciones = 5000
    for (let i = 0; i < maxIteraciones; i++) {
      const diasCobrables = calcularDiasTranscurridosCobrables(inicioMed, fecha, diasExcluidos)
      if (diasCobrables >= diasCobrablesObjetivo) { fechaBase = fecha; break }
      fecha = new Date(fecha.getTime() + DAY_MS)
    }
  }

  return aplicarDiaAncla(fechaBase, prestamo, freq)
}

// Ajusta la fecha base al dia ancla configurado (si existe) segun la frecuencia.
// Para semanal/quincenal: avanza al proximo diaCobroSemana (0=dom..6=sab).
// Para mensual: fija diaCobroMes del mes (clamp al ultimo dia del mes si no existe).
// Para diario o sin ancla: devuelve la fecha base sin cambios.
function aplicarDiaAncla(fechaBase, prestamo, freq) {
  if (!fechaBase) return fechaBase

  if ((freq === 'semanal' || freq === 'quincenal') && Number.isInteger(prestamo?.diaCobroSemana)) {
    const target = ((prestamo.diaCobroSemana % 7) + 7) % 7
    const actual = fechaBase.getDay()
    const delta = (target - actual + 7) % 7
    if (delta === 0) return fechaBase
    return new Date(fechaBase.getTime() + delta * DAY_MS)
  }

  if (freq === 'mensual' && Number.isInteger(prestamo?.diaCobroMes)) {
    const y = fechaBase.getFullYear()
    const m = fechaBase.getMonth()
    const ultimoDia = new Date(y, m + 1, 0).getDate()
    const target = Math.min(Math.max(1, prestamo.diaCobroMes), ultimoDia)
    const ajustada = new Date(y, m, target)
    // Si el ajuste cae antes de la fecha base, avanzar al mes siguiente
    if (ajustada < fechaBase) {
      const ultimoDiaNext = new Date(y, m + 2, 0).getDate()
      const targetNext = Math.min(Math.max(1, prestamo.diaCobroMes), ultimoDiaNext)
      return new Date(y, m + 1, targetNext)
    }
    return ajustada
  }

  return fechaBase
}

/**
 * Indica si, al día de hoy (Colombia), el préstamo aún tiene cobro pendiente.
 * Se basa en cobertura esperada por calendario cobrable, no en pagoHoy.
 */
export function tieneCobroPendienteHoy(prestamo, diasExcluidos = []) {
  if (!prestamo || prestamo.estado !== 'activo') return false
  if (!prestamo.cuotaDiaria || prestamo.cuotaDiaria <= 0) return false
  if (calcularSaldoPendiente(prestamo) <= 0) return false

  const inicio = inicioDiaColombia(prestamo.fechaInicio)
  const hoy = inicioDiaColombia()
  if (inicio > hoy) return false

  const freq = prestamo.frecuencia || 'diario'
  const diasPeriodo = obtenerDiasPorPeriodo(freq)
  // diasSinCobro solo aplica a frecuencia diaria.
  const diasTranscurridos = freq === 'diario'
    ? calcularDiasTranscurridosCobrables(inicio, hoy, diasExcluidos)
    : Math.floor((hoy.getTime() - inicio.getTime()) / DAY_MS)

  let periodosEsperados = Math.floor(diasTranscurridos / diasPeriodo)

  const totalPeriodosPorPlazo = prestamo.diasPlazo
    ? Math.ceil(prestamo.diasPlazo / diasPeriodo)
    : null
  const totalPeriodosPorMonto = prestamo.totalAPagar
    ? Math.ceil(prestamo.totalAPagar / prestamo.cuotaDiaria)
    : null
  const totalPeriodos = totalPeriodosPorPlazo || totalPeriodosPorMonto
  if (totalPeriodos) {
    periodosEsperados = Math.min(periodosEsperados, totalPeriodos)
  }

  if (periodosEsperados <= 0) return false

  const esperadoPorPeriodo = periodosEsperados * prestamo.cuotaDiaria
  const esperado = prestamo.totalAPagar
    ? Math.min(esperadoPorPeriodo, prestamo.totalAPagar)
    : esperadoPorPeriodo

  const pagado = Array.isArray(prestamo.pagos)
    ? calcularTotalPagadoReal(prestamo)
    : 0

  return pagado < esperado
}

/**
 * Formatea una fecha como "mar 31 mar" o "lun 7 abr" — corto y con día.
 */
export function formatFechaCobro(fecha) {
  if (!fecha) return ''
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  return d.toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Bogota',
  })
}

/**
 * Formato contextual para cobro: Hoy / Mañana / Ayer o fecha corta.
 */
export function formatFechaCobroRelativa(fecha) {
  if (!fecha) return ''
  const objetivo = inicioDiaColombia(fecha)
  const hoy = inicioDiaColombia()
  const diff = Math.round((objetivo.getTime() - hoy.getTime()) / DAY_MS)

  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  return formatFechaCobro(objetivo)
}

/**
 * Verifica si un préstamo ya tiene un pago registrado hoy (Colombia).
 */
export function pagoHoy(prestamo) {
  const hoy = inicioDiaColombia().toISOString().slice(0, 10)
  return (prestamo.pagos ?? []).some(
    (p) => !TIPOS_AJUSTE.includes(p.tipo) && inicioDiaColombia(p.fechaPago).toISOString().slice(0, 10) === hoy
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
