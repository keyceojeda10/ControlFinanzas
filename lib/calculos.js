// lib/calculos.js - Funciones de cálculo reutilizables
import { contarDiasExcluidos, contarFestivosEnRango, esFestivo } from './dias-sin-cobro'

/**
 * Determina el estado del cliente a partir de sus préstamos activos.
 * - mora:      tiene préstamos activos con cuotas vencidas
 * - activo:    tiene préstamos activos sin mora
 * - cancelado: no tiene préstamos activos
 */
export function calcularEstadoCliente(prestamos = [], diasExcluidos = [], festivos = []) {
  // Los prestamos marcados como tarjeta clavo NO cuentan para el estado normal
  // del cliente (van en contabilidad aparte).
  const activos = prestamos.filter((p) => p.estado === 'activo' && !p.esClavo)
  if (!activos.length) return 'activo'
  const enMora = activos.some((p) => calcularDiasMora(p, diasExcluidos, festivos) > 0)
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
  // Usa el campo denormalizado si existe (mas rapido en listados).
  // Mantenido por lib/prisma-pago-helpers.js en cada cambio de pagos.
  if (typeof prestamo?.totalPagado === 'number') return prestamo.totalPagado
  return (prestamo?.pagos ?? []).reduce(
    (acc, p) => TIPOS_AJUSTE.includes(p.tipo) ? acc : acc + (p.montoPagado ?? 0), 0
  )
}

// offsetHoras: UTC offset en horas (ej: -5 para Colombia, -6 para Mexico)
// Default -5 para retrocompatibilidad con todo el codigo que ya usa esta funcion.
function inicioDiaLocal(valor = Date.now(), offsetHoras = -5) {
  const fecha = valor instanceof Date ? valor : new Date(valor)
  const absOffset = Math.abs(offsetHoras)
  const ms = absOffset * 60 * 60 * 1000
  const local = new Date(fecha.getTime() - ms)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), absOffset, 0, 0, 0))
}

// Alias retrocompatible — los archivos existentes siguen funcionando sin cambios
function inicioDiaColombia(valor = Date.now()) {
  return inicioDiaLocal(valor, -5)
}

function calcularDiasTranscurridosCobrables(inicio, fecha, diasExcluidos = [], festivos = []) {
  const inicioCol = inicioDiaColombia(inicio)
  const fechaCol = inicioDiaColombia(fecha)
  const diasCalendario = Math.floor((fechaCol - inicioCol) / DAY_MS)
  const diasDescontados = diasExcluidos.length > 0
    ? contarDiasExcluidos(inicioCol, fechaCol, diasExcluidos)
    : 0
  const festivosDescontados = festivos.length > 0
    ? contarFestivosEnRango(inicioCol, fechaCol, festivos)
    : 0
  return Math.max(0, diasCalendario - diasDescontados - festivosDescontados)
}

export function calcularDiasMora(prestamo, diasExcluidos = [], festivos = []) {
  if (prestamo.estado !== 'activo') return 0
  if (!prestamo.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0
  if (calcularSaldoPendiente(prestamo) <= 0) return 0

  const hoy = inicioDiaColombia()
  const inicio = inicioDiaColombia(prestamo.fechaInicio)

  // Si aún no empieza el préstamo, no hay mora
  if (inicio > hoy) return 0

  const freq = prestamo.frecuencia || 'diario'
  const diasPorPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[freq] || 1
  const proximoCobro = calcularProximoCobro(prestamo, diasExcluidos, festivos)

  if (!proximoCobro) return 0

  const proximoDia = inicioDiaColombia(proximoCobro)
  if (proximoDia > hoy) return 0

  const manana = new Date(hoy.getTime() + DAY_MS)
  const diasAtraso = calcularDiasTranscurridosCobrables(proximoDia, manana, diasExcluidos, festivos)

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

function calcularPeriodosEsperadosHastaHoy(prestamo, diasExcluidos = [], festivos = []) {
  if (!prestamo?.fechaInicio || !prestamo?.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0

  const inicio = inicioDiaColombia(prestamo.fechaInicio)
  const hoy = inicioDiaColombia()
  if (inicio > hoy) return 0

  const freq = prestamo.frecuencia || 'diario'
  const diasPeriodo = obtenerDiasPorPeriodo(freq)
  // diasSinCobro solo aplica a frecuencia diaria. Para semanal/quincenal/mensual
  // un periodo son siempre 7/15/30 dias calendario.
  const diasTranscurridos = freq === 'diario'
    ? calcularDiasTranscurridosCobrables(inicio, hoy, diasExcluidos, festivos)
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
export function calcularCuotasEnMora(prestamo, diasExcluidos = [], festivos = []) {
  const diasMora = calcularDiasMora(prestamo, diasExcluidos, festivos)
  if (diasMora <= 0) return 0
  const diasPeriodo = obtenerDiasPorPeriodo(prestamo?.frecuencia)
  return Math.max(1, Math.ceil(diasMora / diasPeriodo))
}

/**
 * Monto correspondiente a las cuotas en mora (con tope al saldo pendiente).
 */
export function calcularMontoEnMora(prestamo, diasExcluidos = [], festivos = []) {
  if (!prestamo?.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0
  const cuotasEnMora = calcularCuotasEnMora(prestamo, diasExcluidos, festivos)
  if (cuotasEnMora <= 0) return 0
  const saldo = calcularSaldoPendiente(prestamo)
  return Math.min(saldo, Math.round(cuotasEnMora * prestamo.cuotaDiaria))
}

/**
 * Monto que el cliente debe pagar hoy para quedar "al día" según cobertura esperada.
 * Incluye lo atrasado y el cobro esperado al corte de hoy (si aplica).
 */
export function calcularMontoParaPonerseAlDia(prestamo, diasExcluidos = [], festivos = []) {
  if (!prestamo || prestamo.estado !== 'activo') return 0
  if (!prestamo.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0

  const saldo = calcularSaldoPendiente(prestamo)
  if (saldo <= 0) return 0

  const periodosEsperados = calcularPeriodosEsperadosHastaHoy(prestamo, diasExcluidos, festivos)
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
// Cuotas se redondean SIEMPRE al multiplo de $100 hacia arriba (decision de
// negocio: cuotas parejas, total real mostrado desde el inicio). Antes era una
// opcion del usuario (exacto/redondeado/cerrado); se elimino a favor de modos
// de interes claros.
const REDONDEO_CUOTA = 100

// Cuantos periodos de cobro equivalen a 1 "mes" segun la frecuencia. Esta es la
// pieza clave del modo fijo: hace que el 20% mensual del prestamista cuadre en
// cualquier frecuencia. 8 semanas = 2 meses (no 56/30 = 1.87).
const PERIODOS_POR_MES = {
  diario:    30,
  semanal:   4,
  quincenal: 2,
  mensual:   1,
}

/**
 * Calcula los terminos de un prestamo segun el modo de interes elegido.
 *
 * Modos:
 *  - 'fijo'   (default): interes = monto × tasa% × meses, con mes = bloque de
 *              frecuencia (4 semanas / 2 quincenas / 30 dias / 1 mes). El interes
 *              sube proporcional al plazo. Es el clasico gota a gota.
 *  - 'unico':  interes = monto × tasa% UNA sola vez, sin importar el plazo.
 *  - 'saldo':  amortizacion frances (cuota fija, interes sobre saldo decreciente).
 *  - 'manual': el prestamista fija la cuota; el total se deriva. Si llega
 *              `cuotaManual > 0`, este modo gana sin importar `modoInteres`.
 *  - 'proporcional' (legacy): el calculo viejo (monto × tasa% × dias/30). Se usa
 *              para llamadas que pasan `redondeo` y no `modoInteres` (renovar /
 *              carga-masiva / onboarding sin migrar). Retrocompatible.
 *
 * Las cuotas siempre se redondean al multiplo de $100 hacia arriba y son parejas
 * (el total a pagar = cuota × numPeriodos).
 */
export function calcularPrestamo({ montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia = 'diario', cuotaManual, modoInteres, redondeo }) {
  const monto  = Number(montoPrestado)
  const tasa   = Number(tasaInteres)
  const dias   = Number(diasPlazo)
  const freq   = frecuencia || 'diario'

  // Retrocompatibilidad: si llega `redondeo` (firma vieja) y no `modoInteres`,
  // usar el calculo legacy 'proporcional' para no cambiar resultados de las
  // llamadas que aun no migran (renovar, carga masiva, onboarding).
  let modo = modoInteres || (redondeo !== undefined ? 'proporcional' : 'fijo')

  const diasPorPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }
  const diasPeriodo = diasPorPeriodo[freq] || 1
  const numPeriodos = Math.ceil(dias / diasPeriodo)

  const fechaFin = new Date(fechaInicio)
  fechaFin.setDate(fechaFin.getDate() + dias)

  const ceil100 = (v) => Math.max(REDONDEO_CUOTA, Math.ceil(v / REDONDEO_CUOTA) * REDONDEO_CUOTA)

  const empaquetar = (totalAPagar, cuota, modoUsado) => ({
    totalAPagar,
    cuotaDiaria: cuota,
    ultimaCuota: cuota,
    totalInteres: Math.max(0, totalAPagar - monto),
    fechaFin,
    frecuencia: freq,
    diasPeriodo,
    numPeriodos,
    modoInteres: modoUsado,
    modoManual: modoUsado === 'manual',
  })

  // ── Modo manual: la cuota la fija el prestamista (gana sobre cualquier modo)
  const cuotaManualNum = Number(cuotaManual)
  if (cuotaManualNum && cuotaManualNum > 0) {
    const cuota = Math.round(cuotaManualNum)
    return empaquetar(cuota * numPeriodos, cuota, 'manual')
  }

  // ── Modo sobre saldo: amortizacion frances (cuota fija, interes decreciente)
  if (modo === 'saldo') {
    const i = (tasa / 100) / (PERIODOS_POR_MES[freq] || 30) // tasa por periodo
    let cuotaTeorica
    if (i <= 0 || numPeriodos <= 0) {
      cuotaTeorica = numPeriodos > 0 ? monto / numPeriodos : monto
    } else {
      const factor = Math.pow(1 + i, numPeriodos)
      cuotaTeorica = monto * (i * factor) / (factor - 1)
    }
    const cuota = ceil100(cuotaTeorica)
    return empaquetar(cuota * numPeriodos, cuota, 'saldo')
  }

  // ── Modos fijo / unico / proporcional: interes total upfront, cuota pareja
  let interesTotal
  if (modo === 'unico') {
    interesTotal = monto * (tasa / 100)
  } else if (modo === 'proporcional') {
    interesTotal = monto * (tasa / 100) * (dias / 30)
  } else {
    // 'fijo' (default): meses = numPeriodos / periodosPorMes (bloques de frecuencia)
    modo = 'fijo'
    const meses = numPeriodos / (PERIODOS_POR_MES[freq] || 30)
    interesTotal = monto * (tasa / 100) * meses
  }

  const totalTeorico = monto + interesTotal
  let cuota, totalAPagar
  if (numPeriodos <= 1) {
    cuota = ceil100(totalTeorico)
    totalAPagar = cuota
  } else {
    cuota = ceil100(totalTeorico / numPeriodos)
    totalAPagar = cuota * numPeriodos
  }
  return empaquetar(totalAPagar, cuota, modo)
}

/**
 * Calcula la fecha programada de la próxima cuota pendiente.
 * Se basa en monto pagado real (no en cantidad de pagos) y usa
 * la misma lógica de días sin cobro de calcularDiasMora.
 * Devuelve un Date (medianoche local) o null si no aplica.
 */
export function calcularProximoCobro(prestamo, diasExcluidos = [], festivos = []) {
  if (!prestamo?.fechaInicio) return null
  if (prestamo.estado && prestamo.estado !== 'activo') return null
  if (!prestamo.cuotaDiaria || prestamo.cuotaDiaria <= 0) return null

  const freq = prestamo.frecuencia || 'diario'
  const diasPeriodo = obtenerDiasPorPeriodo(freq)

  const inicioMed = inicioDiaColombia(prestamo.fechaInicio)

  // Cobertura por monto real pagado (excluyendo ajustes).
  // Prefiere totalPagado denormalizado; cae a iterar pagos si no esta.
  const pagado = calcularTotalPagadoReal(prestamo)
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
  const tieneExclusiones = (diasExcluidos && diasExcluidos.length > 0) || (festivos && festivos.length > 0)
  if (freq !== 'diario' || !tieneExclusiones) {
    fechaBase = new Date(inicioMed.getTime() + diasCobrablesObjetivo * DAY_MS)
  } else {
    // Diario con diasSinCobro y/o festivos: buscar la fecha cuyo "dia cobrable
    // transcurrido" (descontando excluidos y festivos) coincida con la cuota objetivo.
    fechaBase = new Date(inicioMed.getTime() + diasCobrablesObjetivo * DAY_MS)
    let fecha = new Date(inicioMed)
    const maxIteraciones = 5000
    for (let i = 0; i < maxIteraciones; i++) {
      const diasCobrables = calcularDiasTranscurridosCobrables(inicioMed, fecha, diasExcluidos, festivos)
      if (diasCobrables >= diasCobrablesObjetivo) { fechaBase = fecha; break }
      fecha = new Date(fecha.getTime() + DAY_MS)
    }
  }

  let proximoCobro = aplicarDiaAncla(fechaBase, prestamo, freq)

  // Saltar festivos en la fecha resultante (para cualquier frecuencia).
  if (festivos && festivos.length > 0 && proximoCobro) {
    let maxIter = 60
    while (maxIter-- > 0 && esFestivo(proximoCobro, festivos)) {
      proximoCobro = new Date(proximoCobro.getTime() + DAY_MS)
    }
  }

  return proximoCobro
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
export function tieneCobroPendienteHoy(prestamo, diasExcluidos = [], festivos = []) {
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
    ? calcularDiasTranscurridosCobrables(inicio, hoy, diasExcluidos, festivos)
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

  // Prefiere totalPagado denormalizado; cae a iterar pagos si no esta.
  const pagado = calcularTotalPagadoReal(prestamo)

  return pagado < esperado
}

/**
 * Indica si el prestamo TENIA un periodo de cobro programado para hoy
 * segun frecuencia + fecha inicio + dias excluidos (cliente/ruta/org).
 *
 * Diferencia con tieneCobroPendienteHoy: NO mira pagado vs esperado.
 * Es decir, devuelve true tanto si esta pendiente como si ya se pago.
 *
 * Util para sumar la META del dia (esperadoHoy): debe contar toda cuota
 * que tocaba cobrar hoy, no solo las pendientes.
 *
 * `hoySinCobro` es el resultado precalculado por el llamador de
 * `esHoySinCobro(diasExcluidos) || esHoyFestivo(festivos)` para evitar
 * imports circulares con lib/dias-sin-cobro.
 */
export function tienePeriodoEsperadoHoy(prestamo, hoySinCobro = false, diasExcluidos = [], festivos = []) {
  if (!prestamo) return false
  if (!prestamo.cuotaDiaria || prestamo.cuotaDiaria <= 0) return false

  const inicio = inicioDiaColombia(prestamo.fechaInicio)
  const hoy = inicioDiaColombia()
  if (inicio > hoy) return false

  const freq = prestamo.frecuencia || 'diario'

  // REGLA CLAVE: el primer cobro es fechaInicio + 1 periodo (no el dia de inicio).
  // Un prestamo creado HOY con frecuencia diaria tiene su primer cobro MANANA.
  // Por eso un cliente nuevo NO debe sumar a la meta de su dia de creacion.
  //
  // Para saber si "hoy tocaba cobrar" independiente de si ya se pago, evaluamos
  // calcularProximoCobro sobre una copia del prestamo SIN pagos (pagado = 0).
  // Eso da la fecha del PRIMER cobro programado. Si esa fecha es <= hoy, ya
  // estamos dentro del calendario de cobro.
  const prestamoSinPagos = {
    ...prestamo,
    pagos: [],
    totalPagado: 0,
  }

  if (freq === 'diario') {
    // En diaria, "hoy toca cobrar" si: ya paso al menos 1 dia cobrable desde
    // el inicio Y hoy no es dia sin cobro. El primer cobro nunca es el dia 0.
    if (hoySinCobro) return false
    const primerCobro = calcularProximoCobro(prestamoSinPagos, diasExcluidos, festivos)
    if (!primerCobro) return false
    // Si el primer cobro programado ya llego (es hoy o antes), hoy hay cobro.
    return inicioDiaColombia(primerCobro).getTime() <= hoy.getTime()
  }

  // No diaria: hoy debe ser EXACTAMENTE un dia de cobro del calendario.
  // Generamos las fechas de cobro desde el inicio y vemos si alguna cae hoy.
  const diasPeriodo = obtenerDiasPorPeriodo(freq)

  // Dia ancla mensual: hoy debe ser el dia del mes configurado.
  if (prestamo.diaCobroMes != null && freq === 'mensual') {
    return hoy.getUTCDate() === Number(prestamo.diaCobroMes)
  }
  // Dia ancla semanal/quincenal: hoy debe ser el dia de la semana configurado
  // Y caer en un ciclo valido (cada 7 o 15 dias desde el primer cobro).
  if (prestamo.diaCobroSemana != null && (freq === 'semanal' || freq === 'quincenal')) {
    if (hoy.getUTCDay() !== Number(prestamo.diaCobroSemana)) return false
    // Verificar ciclo: dias desde el primer cobro deben ser multiplo del periodo.
    const primerCobro = calcularProximoCobro(prestamoSinPagos, diasExcluidos, festivos)
    if (!primerCobro) return false
    const diffPrimero = Math.floor((hoy.getTime() - inicioDiaColombia(primerCobro).getTime()) / DAY_MS)
    return diffPrimero >= 0 && diffPrimero % diasPeriodo === 0
  }

  // Sin ancla: ciclo regular desde fechaInicio. El primer cobro es a los
  // `diasPeriodo` dias. Hoy toca si (hoy - inicio) es multiplo positivo del periodo.
  const diff = Math.floor((hoy.getTime() - inicio.getTime()) / DAY_MS)
  return diff > 0 && diff % diasPeriodo === 0
}

/**
 * Formatea una fecha como "mar 31 mar" o "lun 7 abr" — corto y con día.
 */
export function formatFechaCobro(fecha, country = 'co') {
  if (!fecha) return ''
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  const { getLocale, getTimezone } = require('@/lib/i18n')
  return d.toLocaleDateString(getLocale(country), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: getTimezone(country),
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
 * Formato contextual con contexto de acción: "Cobra hoy", "Cobra mañana", "Venció ayer", etc.
 * Reemplaza el label crudo "Hoy"/"Mañana"/"Ayer" por texto auto-explicativo.
 */
export function formatFechaCobroContextual(fecha, diasMora = 0) {
  const label = formatFechaCobroRelativa(fecha)
  if (!label) return ''

  // "Ayer" siempre implica cobro pendiente del día anterior
  if (label === 'Ayer') return 'Debió cobrarse ayer'

  if (diasMora > 0) {
    if (label === 'Hoy') return 'Debió cobrarse hoy'
    return `Debió cobrarse el ${label}`
  }

  if (label === 'Hoy') return 'Cobra hoy'
  if (label === 'Mañana') return 'Cobra mañana'
  return `Cobra el ${label}`
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

// Alias retrocompatible de formatMoney para Colombia.
// Los 47+ archivos que importan formatCOP siguen funcionando sin cambios.
// Codigo nuevo debe usar formatMoney(valor, country) de lib/i18n.js.
export { formatMoney } from '@/lib/i18n'
export function formatCOP(valor) {
  if (valor == null) return '$0'
  return '$' + Math.round(valor).toLocaleString('es-CO')
}

/**
 * Opciones de días para abono rápido.
 */
export const DIAS_ABONO = [1, 2, 3, 5, 10]

/**
 * Liquidacion / cierre anticipado de un prestamo.
 *
 * Cuando el cliente paga TODO antes del plazo, solo debe capital + el interes
 * de los meses que YA transcurrieron (no el interes futuro no devengado).
 * Devuelve el calculo en dos modalidades para que el prestamista elija:
 *   - mesCompleto:  el mes en curso cuenta completo (ceil de meses)
 *   - proporcional: interes exacto por los dias transcurridos
 *
 * Para 'fijo'/'proporcional': interesDevengado = capital * tasa% * mesesTranscurridos.
 * Para 'unico': el interes se devenga completo al prestar (no se prorratea).
 * Para 'saldo'/'manual': no se puede recalcular limpio -> aproxima y marca ajustable.
 *
 * Campos clave que devuelve por modalidad:
 *   - interesDevengado, totalCierre (capital+interesDevengado),
 *   - restanteHoy (lo que falta pagar hoy = totalCierre - totalPagadoReal, >=0),
 *   - interesPerdonado (saldoActual - restanteHoy, >=0)
 */
export function calcularLiquidacionAnticipada(prestamo, fechaLiquidacion = new Date(), diasExcluidos = [], festivos = []) {
  const capital = Number(prestamo.montoPrestado) || 0
  const tasa = Number(prestamo.tasaInteres) || 0
  const freq = prestamo.frecuencia || 'diario'
  const modo = prestamo.modoInteres || 'fijo'

  const totalPagadoReal = calcularTotalPagadoReal(prestamo)
  const saldoActual = calcularSaldoPendiente(prestamo)
  const interesTotalPactado = Math.max(0, (Number(prestamo.totalAPagar) || 0) - capital)

  // Dias y meses transcurridos (respetando dias sin cobro / festivos)
  const diasTranscurridos = calcularDiasTranscurridosCobrables(
    prestamo.fechaInicio, fechaLiquidacion, diasExcluidos, festivos
  )
  const periodosPorMes = PERIODOS_POR_MES[freq] || 30
  const diasPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[freq] || 1
  const periodosTranscurridos = Math.ceil(diasTranscurridos / diasPeriodo)

  // meses transcurridos en cada modalidad
  const mesesMesCompleto = Math.max(1, Math.ceil(periodosTranscurridos / periodosPorMes))
  const mesesProporcional = Math.max(0, diasTranscurridos / 30)

  function interesPara(meses) {
    let interes
    if (modo === 'unico') {
      interes = capital * (tasa / 100) // se devengo completo al prestar
    } else if (modo === 'manual' || modo === 'saldo') {
      // No recalculable limpio: aproximar con lo ya pagado como interes devengado
      interes = Math.max(0, totalPagadoReal - 0) >= capital
        ? Math.max(0, totalPagadoReal - capital)
        : interesTotalPactado * Math.min(1, meses / Math.max(1, (prestamo.diasPlazo || 30) / 30))
    } else {
      // fijo / proporcional
      interes = capital * (tasa / 100) * meses
    }
    // El interes devengado nunca supera el interes total pactado
    return Math.min(interes, interesTotalPactado || interes)
  }

  function modalidad(meses, etiqueta) {
    const interesDevengado = Math.round(interesPara(meses))
    const totalCierre = capital + interesDevengado
    const restanteHoy = Math.max(0, Math.round(totalCierre - totalPagadoReal))
    const interesPerdonado = Math.max(0, Math.round(saldoActual - restanteHoy))
    return {
      modalidad: etiqueta,
      mesesTranscurridos: Math.round(meses * 100) / 100,
      interesDevengado,
      totalCierre: Math.round(totalCierre),
      restanteHoy,
      interesPerdonado,
    }
  }

  const noRecalculable = (modo === 'manual' || modo === 'saldo')

  return {
    modo,
    aproximado: noRecalculable,
    capital,
    tasa,
    frecuencia: freq,
    diasTranscurridos,
    totalPagadoReal: Math.round(totalPagadoReal),
    saldoActual: Math.round(saldoActual),
    interesTotalPactado: Math.round(interesTotalPactado),
    mesCompleto: modalidad(mesesMesCompleto, 'mesCompleto'),
    proporcional: modalidad(mesesProporcional, 'proporcional'),
  }
}
