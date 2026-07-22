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

export function obtenerDiasPorPeriodo(frecuencia = 'diario') {
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

// Determina si un prestamo usa la tabla de amortizacion (modo lineal) y la
// trae cargada (cuotasAmortizacion via include de Prisma).
export function tieneTablaAmortizacion(prestamo) {
  return ['lineal', 'solo_interes', 'lineal_dinamico', 'saldo'].includes(prestamo?.modoInteres) && Array.isArray(prestamo?.cuotasAmortizacion) && prestamo.cuotasAmortizacion.length > 0
}

// Calcula el estado de la tabla de amortizacion para modo 'lineal':
// cuantos periodos vencieron, cuanto se debia haber pagado a la fecha,
// y el monto en mora (suma de cuotas vencidas no cubiertas por `pagado`).
function calcularEstadoTablaAmortizacion(prestamo) {
  const hoy = inicioDiaColombia()
  const filas = [...prestamo.cuotasAmortizacion].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)

  let periodosVencidos = 0
  let esperadoHastaHoy = 0
  let montoEnMora = 0
  let cuotasEnMora = 0
  let primeraVencidaFecha = null

  for (const fila of filas) {
    const fechaEsperada = inicioDiaColombia(fila.fechaEsperada)
    if (fechaEsperada > hoy) continue
    periodosVencidos++
    esperadoHastaHoy += fila.cuotaTotal
    const pagadaCompleta = (fila.pagado || 0) >= fila.cuotaTotal
    const interesAlDia = (fila.interesPagado || 0) >= fila.interes
    if (!pagadaCompleta && !interesAlDia) {
      const faltanteInteres = Math.max(0, fila.interes - (fila.interesPagado || 0))
      montoEnMora += faltanteInteres
      cuotasEnMora++
      if (!primeraVencidaFecha) primeraVencidaFecha = fechaEsperada
    }
  }

  return { filas, periodosVencidos, esperadoHastaHoy, montoEnMora, cuotasEnMora, primeraVencidaFecha }
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

  // Modo lineal: la primera cuota vencida sin cubrir define el inicio de mora.
  // Si el usuario fijó proximoCobroManual y ya pasó, esa fecha tiene prioridad
  // sobre la fechaEsperada de la tabla (el usuario sabe cuándo debía cobrarse).
  if (tieneTablaAmortizacion(prestamo)) {
    const { primeraVencidaFecha } = calcularEstadoTablaAmortizacion(prestamo)
    let fechaReferencia = primeraVencidaFecha
    if (!fechaReferencia && prestamo.proximoCobroManual) {
      const manual = inicioDiaColombia(prestamo.proximoCobroManual)
      if (manual <= hoy) fechaReferencia = manual
    }
    if (!fechaReferencia) return 0
    const manana = new Date(hoy.getTime() + DAY_MS)
    const diasAtraso = calcularDiasTranscurridosCobrables(fechaReferencia, manana, diasExcluidos, festivos)
    return Math.max(0, diasAtraso - 1)
  }

  const proximoCobro = calcularProximoCobro(prestamo, diasExcluidos, festivos)

  if (!proximoCobro) return 0

  const proximoDia = inicioDiaColombia(proximoCobro)
  if (proximoDia > hoy) return 0

  const manana = new Date(hoy.getTime() + DAY_MS)
  const diasAtraso = calcularDiasTranscurridosCobrables(proximoDia, manana, diasExcluidos, festivos)

  // Gracia de 1 día: el mismo día de cobro no cuenta como mora,
  // pero al día siguiente ya está en mora si no pagó.
  return Math.max(0, diasAtraso - 1)
}

/**
 * Calcula el saldo pendiente de un préstamo:
 * totalAPagar - suma de pagos recibidos.
 */
export function calcularSaldoPendiente(prestamo) {
  const pagado = calcularTotalPagadoReal(prestamo)
  return Math.max(0, prestamo.totalAPagar - pagado)
}

/**
 * Capital restante de un prestamo con tabla de amortizacion.
 * Es lo que el cliente debe SIN contar intereses futuros no devengados.
 * Para prestamos sin tabla retorna null (usar calcularSaldoPendiente).
 */
export function calcularCapitalRestante(prestamo) {
  if (tieneTablaAmortizacion(prestamo)) {
    const filas = [...prestamo.cuotasAmortizacion].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
    const pagado = calcularTotalPagadoReal(prestamo)
    let capitalAcumulado = 0
    for (const f of filas) capitalAcumulado += f.capital
    let restante = pagado
    let capitalCubierto = 0
    for (const f of filas) {
      if (restante <= 0) break
      const cubierto = Math.min(restante, f.cuotaTotal)
      const interesCubierto = Math.min(cubierto, f.interes)
      capitalCubierto += Math.max(0, cubierto - interesCubierto)
      restante -= cubierto
    }
    return Math.max(0, Math.round(capitalAcumulado - capitalCubierto))
  }

  const monto = prestamo?.montoPrestado
  if (!monto || monto <= 0) return null
  const totalAPagar = prestamo?.totalAPagar ?? monto
  const interesTotal = totalAPagar - monto
  const pagado = calcularTotalPagadoReal(prestamo)
  if (interesTotal <= 0) return Math.max(0, Math.round(monto - pagado))
  const capitalPagado = Math.max(0, pagado - interesTotal)
  return Math.max(0, Math.round(monto - capitalPagado))
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
  if (tieneTablaAmortizacion(prestamo)) {
    return prestamo.cuotasAmortizacion.filter(f => (f.pagado || 0) < f.cuotaTotal).length
  }
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
  if (tieneTablaAmortizacion(prestamo)) {
    return calcularEstadoTablaAmortizacion(prestamo).cuotasEnMora
  }
  const diasPeriodo = obtenerDiasPorPeriodo(prestamo?.frecuencia)
  return Math.max(1, Math.ceil(diasMora / diasPeriodo))
}

/**
 * Monto correspondiente a las cuotas en mora (con tope al saldo pendiente).
 */
export function calcularMontoEnMora(prestamo, diasExcluidos = [], festivos = []) {
  if (tieneTablaAmortizacion(prestamo)) {
    const diasMora = calcularDiasMora(prestamo, diasExcluidos, festivos)
    if (diasMora <= 0) return 0
    const { montoEnMora } = calcularEstadoTablaAmortizacion(prestamo)
    const saldo = calcularSaldoPendiente(prestamo)
    return Math.min(saldo, Math.round(montoEnMora))
  }
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

  const saldo = calcularSaldoPendiente(prestamo)
  if (saldo <= 0) return 0

  if (tieneTablaAmortizacion(prestamo)) {
    const { esperadoHastaHoy } = calcularEstadoTablaAmortizacion(prestamo)
    if (esperadoHastaHoy <= 0) return 0
    const pagado = calcularTotalPagadoReal(prestamo)
    const faltante = Math.max(0, Math.round(esperadoHastaHoy - pagado))
    return Math.min(saldo, faltante)
  }

  if (!prestamo.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0

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
 * Total de intereses pendientes de cuotas vencidas (modo lineal).
 * Útil para pre-llenar el monto del pago tipo "intereses".
 */
export function calcularInteresesPendientes(prestamo) {
  if (!tieneTablaAmortizacion(prestamo)) return 0
  const hoy = inicioDiaColombia()
  return prestamo.cuotasAmortizacion.reduce((acc, fila) => {
    if (inicioDiaColombia(fila.fechaEsperada) > hoy) return acc
    if ((fila.pagado || 0) >= fila.cuotaTotal) return acc
    return acc + Math.max(0, fila.interes - (fila.interesPagado || 0))
  }, 0)
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

// Cuantos periodos de cobro equivalen a 1 "mes" segun la frecuencia. Es la
// pieza clave del modo fijo: hace que el 20% mensual del prestamista cuadre en
// cualquier frecuencia.
//
// INVARIANTE: periodosPorMes * diasPeriodo === 30.
// Un mes son 30 dias, mirado desde cualquier frecuencia. Por eso se deriva de
// DIAS_POR_PERIODO en vez de escribirse a mano: asi no puede volver a
// desalinearse una frecuencia sin que fallen los tests.
//
// Antes 'semanal' estaba fijo en 4, o sea que un mes duraba 28 dias (4 x 7)
// SOLO en esa frecuencia; las otras tres si daban 30 (30x1, 2x15, 1x30). El
// efecto era que el mismo prestamo, con el mismo plazo, cobraba 6,67% mas de
// interes por el solo hecho de cobrarse semanal:
//
//   $250.000 al 20%, plazo 42 dias
//     diario     dura 42 dias, cobraba 42  -> $320.000
//     semanal    dura 42 dias, cobraba 45  -> $325.000   <-- la anomalia
//     quincenal  dura 45 dias, cobraba 45  -> $325.000   (si dura 45)
//     mensual    dura 60 dias, cobraba 60  -> $350.000   (si dura 60)
//
// En quincenal y mensual el total sube porque numPeriodos redondea hacia arriba
// y el prestamo realmente se alarga. En semanal no se alargaba: cobraba de mas.
//
// OJO: esto cambia SOLO la frecuencia semanal. diario, quincenal y mensual dan
// exactamente los mismos numeros que antes (sus valores ya cumplian el
// invariante). Los prestamos ya creados no se recalculan: guardan su
// totalAPagar y su cuota.
const DIAS_POR_PERIODO_MES = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }
const DIAS_POR_MES = 30
const PERIODOS_POR_MES = Object.fromEntries(
  Object.entries(DIAS_POR_PERIODO_MES).map(([freq, dias]) => [freq, DIAS_POR_MES / dias])
)

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
export function calcularPrestamo({ montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia = 'diario', cuotaManual, modoInteres, redondeo, interesAdelantado = false, diaCobroMes, diaCobroMes2, capitalExtra }) {
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

  // ── Modo manual: la cuota la fija el prestamista (gana sobre cualquier modo,
  // excepto modos con tabla que soportan cuotaManual como parametro propio).
  // Si cuota × periodos < capital + interes minimo, auto-extiende el plazo.
  const cuotaManualNum = Number(cuotaManual)
  if (cuotaManualNum && cuotaManualNum > 0 && modo !== 'saldo') {
    const cuota = Math.round(cuotaManualNum)
    const meses = numPeriodos / (PERIODOS_POR_MES[freq] || 1)
    const interesFijo = Math.round(monto * (tasa / 100) * meses)
    const minTotal = monto + interesFijo
    let periodosReales = numPeriodos
    if (cuota * periodosReales < minTotal) {
      periodosReales = Math.ceil(minTotal / cuota)
    }
    const totalReal = cuota * periodosReales
    const fechaFinManual = new Date(fechaInicio)
    fechaFinManual.setDate(fechaFinManual.getDate() + periodosReales * diasPeriodo)
    return {
      totalAPagar: totalReal,
      cuotaDiaria: cuota,
      ultimaCuota: cuota,
      totalInteres: Math.max(0, totalReal - monto),
      fechaFin: fechaFinManual,
      frecuencia: freq,
      diasPeriodo,
      numPeriodos: periodosReales,
      modoInteres: 'manual',
      modoManual: true,
    }
  }

  // Helper: calcula la fechaEsperada del periodo n respetando diaCobroMes.
  // Sin diaCobroMes: fechaInicio + n * diasPeriodo (comportamiento original).
  // Con diaCobroMes (mensual): avanza n meses desde fechaInicio, fija el dia del mes.
  const calcFechaEsperada = (n) => {
    if (Number.isInteger(diaCobroMes) && diaCobroMes >= 1 && freq === 'mensual') {
      const base = new Date(fechaInicio)
      base.setMonth(base.getMonth() + n)
      const ultimoDia = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
      base.setDate(Math.min(diaCobroMes, ultimoDia))
      return base
    }
    if (Number.isInteger(diaCobroMes) && diaCobroMes >= 1 && freq === 'quincenal') {
      const anclas = [diaCobroMes]
      if (Number.isInteger(diaCobroMes2) && diaCobroMes2 >= 1) anclas.push(diaCobroMes2)
      anclas.sort((a, b) => a - b)
      const base = new Date(fechaInicio)
      let count = 0
      let cursor = new Date(base)
      while (count < n) {
        cursor.setDate(cursor.getDate() + 1)
        for (const ancla of anclas) {
          if (cursor.getDate() === Math.min(ancla, new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate())) {
            count++
            if (count === n) return new Date(cursor)
          }
        }
      }
      return cursor
    }
    const f = new Date(fechaInicio)
    f.setDate(f.getDate() + n * diasPeriodo)
    return f
  }

  // ── Modo lineal: amortizacion con capital fijo por periodo + interes sobre
  // saldo restante (cuota TOTAL decreciente periodo a periodo). A diferencia
  // de los demas modos, aqui no hay una sola "cuota" — se genera una tabla
  // de amortizacion (tablaAmortizacion) que es la fuente de verdad.
  if (modo === 'lineal') {
    const extraMapLineal = new Map()
    if (Array.isArray(capitalExtra)) {
      capitalExtra.forEach(e => {
        if (e.numeroPeriodo > 0 && e.numeroPeriodo <= numPeriodos && Number(e.monto) > 0) {
          extraMapLineal.set(e.numeroPeriodo, Math.round(Number(e.monto)))
        }
      })
    }
    const capitalPorPeriodo = monto / numPeriodos
    const capitalRedondeado = Math.round(capitalPorPeriodo)
    const tablaAmortizacion = []
    let saldoRestante = monto
    for (let n = 1; n <= numPeriodos; n++) {
      if (saldoRestante <= 0) {
        tablaAmortizacion.push({
          numeroPeriodo: n, capital: 0, interes: 0, cuotaTotal: 0,
          saldoRestante: 0, fechaEsperada: calcFechaEsperada(n),
        })
        continue
      }
      const interesPeriodo = saldoRestante * (tasa / 100)
      const extra = extraMapLineal.get(n) || 0
      const capitalBase = Math.min(capitalRedondeado, saldoRestante)
      const capitalConExtra = Math.min(capitalBase + extra, saldoRestante)
      saldoRestante = Math.max(0, saldoRestante - capitalConExtra)
      const fechaEsperada = calcFechaEsperada(n)
      tablaAmortizacion.push({
        numeroPeriodo: n,
        capital: Math.round(capitalConExtra),
        interes: Math.round(interesPeriodo),
        cuotaTotal: Math.round(capitalConExtra) + Math.round(interesPeriodo),
        saldoRestante: Math.round(saldoRestante),
        fechaEsperada,
        ...(extra > 0 ? { esExtra: true, montoExtra: extra } : {}),
      })
    }
    const totalAPagar = tablaAmortizacion.reduce((acc, p) => acc + p.cuotaTotal, 0)
    const cuotaInicial = tablaAmortizacion[0]?.cuotaTotal || 0
    const cuotaFinal = tablaAmortizacion[numPeriodos - 1]?.cuotaTotal || 0
    return {
      ...empaquetar(totalAPagar, cuotaInicial, 'lineal'),
      ultimaCuota: cuotaFinal,
      tablaAmortizacion,
      ...(extraMapLineal.size > 0 ? { capitalExtra: [...extraMapLineal.entries()].map(([numeroPeriodo, m]) => ({ numeroPeriodo, monto: m })) } : {}),
    }
  }

  // ── Modo lineal dinamico: la tabla de amortizacion inicial se genera
  // IGUAL que en 'lineal' (capital fijo por periodo + interes sobre saldo
  // restante). La diferencia esta en el post-procesamiento de cada pago
  // (ver app/api/prestamos/[id]/pagos/route.js): tras un pago normal
  // (completo/parcial), las cuotas futuras se recalculan sobre el capital
  // REAL restante (en vez de solo llenar en cascada la cuota fija original).
  if (modo === 'lineal_dinamico') {
    const extraMapLineal = new Map()
    if (Array.isArray(capitalExtra)) {
      capitalExtra.forEach(e => {
        if (e.numeroPeriodo > 0 && e.numeroPeriodo <= numPeriodos && Number(e.monto) > 0) {
          extraMapLineal.set(e.numeroPeriodo, Math.round(Number(e.monto)))
        }
      })
    }
    const capitalPorPeriodo = monto / numPeriodos
    const capitalRedondeado = Math.round(capitalPorPeriodo)
    const tablaAmortizacion = []
    let saldoRestante = monto
    for (let n = 1; n <= numPeriodos; n++) {
      if (saldoRestante <= 0) {
        tablaAmortizacion.push({
          numeroPeriodo: n, capital: 0, interes: 0, cuotaTotal: 0,
          saldoRestante: 0, fechaEsperada: calcFechaEsperada(n),
        })
        continue
      }
      const interesPeriodo = saldoRestante * (tasa / 100)
      const extra = extraMapLineal.get(n) || 0
      const capitalBase = Math.min(capitalRedondeado, saldoRestante)
      const capitalConExtra = Math.min(capitalBase + extra, saldoRestante)
      saldoRestante = Math.max(0, saldoRestante - capitalConExtra)
      const fechaEsperada = calcFechaEsperada(n)
      tablaAmortizacion.push({
        numeroPeriodo: n,
        capital: Math.round(capitalConExtra),
        interes: Math.round(interesPeriodo),
        cuotaTotal: Math.round(capitalConExtra) + Math.round(interesPeriodo),
        saldoRestante: Math.round(saldoRestante),
        fechaEsperada,
        ...(extra > 0 ? { esExtra: true, montoExtra: extra } : {}),
      })
    }
    const totalAPagar = tablaAmortizacion.reduce((acc, p) => acc + p.cuotaTotal, 0)
    const cuotaInicial = tablaAmortizacion[0]?.cuotaTotal || 0
    const cuotaFinal = tablaAmortizacion[numPeriodos - 1]?.cuotaTotal || 0
    return {
      ...empaquetar(totalAPagar, cuotaInicial, 'lineal_dinamico'),
      ultimaCuota: cuotaFinal,
      tablaAmortizacion,
      ...(extraMapLineal.size > 0 ? { capitalExtra: [...extraMapLineal.entries()].map(([numeroPeriodo, m]) => ({ numeroPeriodo, monto: m })) } : {}),
    }
  }

  // ── Modo solo interes (globo): el cliente paga solo interes cada periodo,
  // el capital completo se devuelve en la ultima cuota (balloon payment).
  // Con interesAdelantado: el interes se cobra "por adelantado", es decir
  // las cuotas 1..n-1 cobran interes y la ultima cuota es solo capital.
  // capitalExtra: [{numeroPeriodo, monto}] — abonos a capital programados en
  // cuotas intermedias (ej: primas). Reducen saldo y el interes futuro baja.
  if (modo === 'solo_interes') {
    const extraMap = new Map()
    if (Array.isArray(capitalExtra)) {
      capitalExtra.forEach(e => {
        if (e.numeroPeriodo > 0 && e.numeroPeriodo < numPeriodos && e.monto > 0) {
          extraMap.set(e.numeroPeriodo, Math.round(Number(e.monto)))
        }
      })
    }
    const tablaAmortizacion = []
    let saldoRestante = monto
    for (let n = 1; n <= numPeriodos; n++) {
      const esUltimo = n === numPeriodos
      const interesPorPeriodo = saldoRestante * (tasa / 100)
      const extra = extraMap.get(n) || 0
      const capitalPeriodo = esUltimo ? saldoRestante : extra
      const interesPeriodo = (interesAdelantado && esUltimo) ? 0 : interesPorPeriodo
      const cuotaTotal = capitalPeriodo + interesPeriodo
      saldoRestante -= capitalPeriodo
      const fechaEsperada = calcFechaEsperada(n)
      tablaAmortizacion.push({
        numeroPeriodo: n,
        capital: Math.round(capitalPeriodo),
        interes: Math.round(interesPeriodo),
        cuotaTotal: Math.round(cuotaTotal),
        saldoRestante: Math.round(saldoRestante),
        fechaEsperada,
      })
    }
    const totalAPagar = tablaAmortizacion.reduce((acc, p) => acc + p.cuotaTotal, 0)
    return {
      ...empaquetar(totalAPagar, tablaAmortizacion[0]?.cuotaTotal || 0, 'solo_interes'),
      ultimaCuota: tablaAmortizacion[numPeriodos - 1]?.cuotaTotal || 0,
      tablaAmortizacion,
      interesAdelantado,
    }
  }

  // ── Helper: parsea capitalExtra a un Map { numeroPeriodo -> monto }
  const parseExtras = () => {
    const m = new Map()
    if (!Array.isArray(capitalExtra) || !capitalExtra.length) return m
    capitalExtra.forEach(e => {
      if (e.numeroPeriodo > 0 && e.numeroPeriodo <= numPeriodos && Number(e.monto) > 0) {
        m.set(e.numeroPeriodo, Math.round(Number(e.monto)))
      }
    })
    return m
  }

  // ── Modo sobre saldo: amortizacion frances (cuota fija, interes decreciente)
  // Con capitalExtra: genera tabla donde los periodos con extra inyectan capital
  // adicional que reduce el saldo y el interes futuro. La cuota regular se
  // recalcula mas baja.
  // Con cuotaManual: el usuario define la cuota fija en vez de calcularla con
  // la formula francesa. La ultima cuota ajusta para cerrar el saldo.
  if (modo === 'saldo') {
    const i = (tasa / 100) / (PERIODOS_POR_MES[freq] || 30)
    const extraMap = parseExtras()
    const cuotaManualNum = Number(cuotaManual) || 0

    let cuotaRegular
    if (cuotaManualNum > 0) {
      cuotaRegular = cuotaManualNum
    } else if (extraMap.size === 0) {
      let cuotaTeorica
      if (i <= 0 || numPeriodos <= 0) {
        cuotaTeorica = numPeriodos > 0 ? monto / numPeriodos : monto
      } else {
        const factor = Math.pow(1 + i, numPeriodos)
        cuotaTeorica = monto * (i * factor) / (factor - 1)
      }
      cuotaRegular = ceil100(cuotaTeorica)
    } else {
      // Con extras: busqueda binaria de la cuota regular que amortiza a cero.
      let lo = 0, hi = monto * 2
      for (let iter = 0; iter < 80; iter++) {
        const mid = (lo + hi) / 2
        let saldo = monto
        for (let n = 1; n <= numPeriodos; n++) {
          const intP = saldo * i
          const capP = mid - intP + (extraMap.get(n) || 0)
          saldo -= capP
        }
        if (saldo > 0.5) lo = mid; else hi = mid
      }
      cuotaRegular = ceil100((lo + hi) / 2)
    }

    const tablaAmortizacion = []
    let saldoRestante = monto
    for (let n = 1; n <= numPeriodos; n++) {
      const interesPeriodo = Math.round(saldoRestante * i)
      const extra = extraMap.get(n) || 0
      const esUltimo = n === numPeriodos
      const capitalRegular = cuotaRegular - interesPeriodo
      const capitalTotal = capitalRegular + extra
      const capitalReal = esUltimo ? saldoRestante : Math.min(Math.max(0, capitalTotal), saldoRestante)
      const interesReal = esUltimo ? Math.round(saldoRestante * i) : interesPeriodo
      const cuotaTotal = esUltimo ? capitalReal + interesReal : cuotaRegular + extra
      saldoRestante = Math.max(0, saldoRestante - capitalReal)
      tablaAmortizacion.push({
        numeroPeriodo: n,
        capital: Math.round(capitalReal),
        interes: interesReal,
        cuotaTotal: Math.round(cuotaTotal),
        saldoRestante: Math.round(saldoRestante),
        fechaEsperada: calcFechaEsperada(n),
        esExtra: extra > 0,
        montoExtra: extra,
      })
    }
    const totalAP = tablaAmortizacion.reduce((a, r) => a + r.cuotaTotal, 0)
    return {
      ...empaquetar(totalAP, cuotaRegular, 'saldo'),
      ultimaCuota: tablaAmortizacion[numPeriodos - 1]?.cuotaTotal || 0,
      tablaAmortizacion,
      capitalExtra: [...extraMap.entries()].map(([numeroPeriodo, m]) => ({ numeroPeriodo, monto: m })),
    }
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
  const extraMap = parseExtras()

  if (extraMap.size === 0) {
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

  // Con extras: el total a pagar permanece igual. Los abonos extra se restan
  // de la cuota regular para que el usuario pague menos cada periodo normal.
  const sumExtras = [...extraMap.values()].reduce((a, b) => a + b, 0)
  const totalBase = ceil100(totalTeorico / numPeriodos) * numPeriodos
  const cuotaRegular = ceil100((totalBase - sumExtras) / numPeriodos)
  const totalAPagarFinal = cuotaRegular * numPeriodos + sumExtras

  const interesPorPeriodo = Math.round(interesTotal / numPeriodos)
  const capitalRegPorPeriodo = cuotaRegular - interesPorPeriodo
  const tablaAmortizacion = []
  let saldoRestante = monto
  for (let n = 1; n <= numPeriodos; n++) {
    const extra = extraMap.get(n) || 0
    const capitalBase = Math.min(capitalRegPorPeriodo, saldoRestante)
    const capitalConExtra = Math.min(capitalBase + extra, saldoRestante)
    saldoRestante = Math.max(0, saldoRestante - capitalConExtra)
    tablaAmortizacion.push({
      numeroPeriodo: n,
      capital: capitalConExtra,
      interes: interesPorPeriodo,
      cuotaTotal: capitalConExtra + interesPorPeriodo,
      saldoRestante: Math.round(saldoRestante),
      fechaEsperada: calcFechaEsperada(n),
      esExtra: extra > 0,
      montoExtra: extra,
    })
  }

  const totalReal = tablaAmortizacion.reduce((a, r) => a + r.cuotaTotal, 0)

  return {
    ...empaquetar(totalReal, cuotaRegular, modo),
    ultimaCuota: tablaAmortizacion[numPeriodos - 1]?.cuotaTotal || 0,
    tablaAmortizacion,
    capitalExtra: [...extraMap.entries()].map(([numeroPeriodo, m]) => ({ numeroPeriodo, monto: m })),
  }
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

  if (prestamo.proximoCobroManual) {
    const manual = new Date(prestamo.proximoCobroManual)
    if (!isNaN(manual.getTime())) return manual
  }

  // Modo lineal/solo_interes: buscar la primera cuota no pagada en la tabla.
  // La tabla es la fuente de verdad para fechas (incluye diaCobroMes).
  if (tieneTablaAmortizacion(prestamo)) {
    const filas = [...prestamo.cuotasAmortizacion].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
    for (const fila of filas) {
      const pagadaCompleta = (fila.pagado || 0) >= fila.cuotaTotal
      const interesAlDia = (fila.interesPagado || 0) >= fila.interes
      if (!pagadaCompleta && !interesAlDia) {
        return new Date(fila.fechaEsperada)
      }
    }
    // Todas las cuotas con interes pagado — buscar primera con capital pendiente
    for (const fila of filas) {
      if ((fila.pagado || 0) < fila.cuotaTotal) {
        return new Date(fila.fechaEsperada)
      }
    }
    return null
  }

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
// Para semanal/quincenal: usa diaCobroSemana (0=dom..6=sab) o diaCobroMes (1-31).
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

  if ((freq === 'mensual' || freq === 'semanal' || freq === 'quincenal') && Number.isInteger(prestamo?.diaCobroMes)) {
    const anclas = [prestamo.diaCobroMes]
    if (freq === 'quincenal' && Number.isInteger(prestamo?.diaCobroMes2)) {
      anclas.push(prestamo.diaCobroMes2)
    }

    const candidatas = []
    for (const ancla of anclas) {
      const y = fechaBase.getFullYear()
      const m = fechaBase.getMonth()
      const ultimoDia = new Date(y, m + 1, 0).getDate()
      const target = Math.min(Math.max(1, ancla), ultimoDia)
      const fecha = new Date(y, m, target)
      if (fecha >= fechaBase) {
        candidatas.push(fecha)
      } else {
        const ultimoDiaNext = new Date(y, m + 2, 0).getDate()
        const targetNext = Math.min(Math.max(1, ancla), ultimoDiaNext)
        candidatas.push(new Date(y, m + 1, targetNext))
      }
    }

    candidatas.sort((a, b) => a.getTime() - b.getTime())
    return candidatas[0]
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

  // Dia ancla por dia del mes: aplica a mensual, semanal y quincenal cuando
  // el usuario eligio anclar por numero de dia (ej. "cobra los 5 y 20").
  if (prestamo.diaCobroMes != null && prestamo.diaCobroSemana == null) {
    const diaHoy = hoy.getUTCDate()
    if (diaHoy === Number(prestamo.diaCobroMes)) return true
    if (prestamo.diaCobroMes2 != null && diaHoy === Number(prestamo.diaCobroMes2)) return true
    return false
  }
  // Dia ancla semanal/quincenal por dia de la semana (Lunes, Martes, etc.)
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
 * Recalcula el campo `pagado` de cada fila de la tabla de amortizacion
 * (modo 'lineal') a partir del total pagado real del prestamo, distribuyendo
 * en cascada: la cuota mas antigua se llena primero.
 *
 * Devuelve un array [{ numeroPeriodo, pagado }] listo para persistir con
 * updates individuales (CuotaAmortizacion.pagado).
 */
export function regenerarTablaAmortizacion(prestamo) {
  const filas = [...(prestamo.cuotasAmortizacion || [])].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
  // Los abonos a capital ya reducen el saldo (y recalculan las cuotas futuras
  // aparte) — no deben contarse de nuevo aqui o se "duplicaria" el abono como
  // pago de cuota. Solo pagos normales (completo/parcial) llenan la cascada.
  const restantePagosNormales = (prestamo.pagos ?? [])
    .filter(p => p.tipo === 'completo' || p.tipo === 'parcial')
    .reduce((acc, p) => acc + (p.montoPagado ?? 0), 0)
  let restante = restantePagosNormales
  return filas.map((fila) => {
    const pagado = Math.min(fila.cuotaTotal, Math.max(0, restante))
    restante -= pagado
    return { numeroPeriodo: fila.numeroPeriodo, pagado: Math.round(pagado) }
  })
}

/**
 * Recalcula la tabla de amortizacion para modo 'lineal_dinamico' tras CADA
 * pago normal (completo/parcial) — a diferencia de 'lineal', donde la tabla
 * se mantiene fija y los pagos solo se distribuyen en cascada.
 *
 * Regla de negocio (definida por el cliente):
 *  1. El pago cubre primero el interes de la cuota mas antigua no pagada,
 *     el resto va a capital de esa misma cuota.
 *  2. El capital REAL restante (monto original - capital efectivamente
 *     cubierto por todos los pagos, incluida la cuota en curso) se reparte
 *     de nuevo entre los periodos que faltan: capitalPorPeriodo = saldo /
 *     periodosRestantes.
 *  3. El interes de cada periodo futuro se recalcula sobre el saldo vigente
 *     en ese punto (saldo * tasa%), igual que en 'lineal'.
 *
 * Las fechaEsperada de cada periodo NO cambian (el calendario de cobro es
 * fijo); solo se recalculan capital/interes/cuotaTotal/saldoRestante.
 *
 * Devuelve un array de actualizaciones [{ numeroPeriodo, capital, interes,
 * cuotaTotal, saldoRestante, pagado }] listo para persistir con updates
 * individuales (CuotaAmortizacion), y `totalAPagar` recalculado.
 */
export function regenerarTablaAmortizacionDinamica(prestamo) {
  const filas = [...(prestamo.cuotasAmortizacion || [])].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
  const tasa = Number(prestamo.tasaInteres) || 0
  const montoOriginal = Number(prestamo.montoPrestado) || 0

  // Total efectivamente pagado por pagos normales (completo/parcial). Los
  // ajustes (recargo/descuento) y otros tipos no entran en la cascada de capital.
  const totalPagosNormales = (prestamo.pagos ?? [])
    .filter(p => p.tipo === 'completo' || p.tipo === 'parcial')
    .reduce((acc, p) => acc + (p.montoPagado ?? 0), 0)

  let restante = totalPagosNormales
  let capitalCubiertoTotal = 0
  const actualizaciones = []
  let filaCorteIdx = -1

  // 1) Cascada: llenar cada cuota (interes primero, luego capital) en orden,
  // usando los valores YA calculados de esa fila (aun no tocados). Se detiene
  // en la primera fila que no queda completamente cubierta (fila "en curso"),
  // esa es la que ancla el recalculo de las futuras.
  for (let idx = 0; idx < filas.length; idx++) {
    const fila = filas[idx]
    if (fila.cuotaTotal <= 0) {
      // Fila ya vacia (saldo agotado antes de tiempo): no aporta ni consume.
      actualizaciones.push({ numeroPeriodo: fila.numeroPeriodo, pagado: 0 })
      continue
    }
    const aplicado = Math.max(0, Math.min(restante, fila.cuotaTotal))
    const interesCubierto = Math.min(aplicado, fila.interes)
    const capitalCubierto = Math.max(0, aplicado - interesCubierto)
    capitalCubiertoTotal += capitalCubierto
    restante -= aplicado

    actualizaciones.push({ numeroPeriodo: fila.numeroPeriodo, pagado: Math.round(aplicado) })

    if (aplicado < fila.cuotaTotal) {
      // Cuota parcialmente pagada (o nada): aqui corta la cascada.
      filaCorteIdx = idx
      break
    }
  }

  // Si todas las filas quedaron completamente pagadas, no hay futuras que recalcular.
  if (filaCorteIdx === -1) {
    return {
      actualizaciones,
      totalAPagar: Math.round(filas.reduce((acc, f) => acc + f.cuotaTotal, 0)),
      soloPagado: true,
    }
  }

  const capitalRestante = Math.max(0, Math.round(montoOriginal - capitalCubiertoTotal))
  const filasFuturas = filas.slice(filaCorteIdx + 1)
  const numPeriodosRestantes = filasFuturas.length

  // Si no quedan periodos futuros (la fila en curso era la ultima), no hay
  // nada que redistribuir: la cuota en curso simplemente absorbe todo el saldo.
  if (numPeriodosRestantes === 0 || capitalRestante <= 0) {
    return {
      actualizaciones: actualizaciones.map(a => ({ numeroPeriodo: a.numeroPeriodo, pagado: a.pagado })),
      totalAPagar: Math.round(
        filas.slice(0, filaCorteIdx).reduce((acc, f) => acc + f.cuotaTotal, 0) +
        (filas[filaCorteIdx]?.cuotaTotal || 0) +
        filasFuturas.reduce((acc, f) => acc + f.cuotaTotal, 0)
      ),
      soloPagado: numPeriodosRestantes === 0,
    }
  }

  // 2) Recalcular las filas futuras sobre el capital real restante.
  const capitalPorPeriodo = capitalRestante / numPeriodosRestantes
  const capitalRedondeado = Math.round(capitalPorPeriodo)
  let saldoRestante = capitalRestante
  let capitalAsignado = 0
  const filasRecalculadas = []
  for (let i = 0; i < numPeriodosRestantes; i++) {
    const fila = filasFuturas[i]
    const interesPeriodo = saldoRestante * (tasa / 100)
    const esUltimo = i === numPeriodosRestantes - 1
    const capital = esUltimo ? Math.round(capitalRestante - capitalAsignado) : capitalRedondeado
    capitalAsignado += capital
    const cuotaTotal = capital + Math.round(interesPeriodo)
    saldoRestante = Math.max(0, saldoRestante - capitalPorPeriodo)
    filasRecalculadas.push({
      numeroPeriodo: fila.numeroPeriodo,
      capital,
      interes: Math.round(interesPeriodo),
      cuotaTotal,
      saldoRestante: Math.round(saldoRestante),
      pagado: 0,
    })
  }

  const totalPagadoOFilasAntes = filas.slice(0, filaCorteIdx).reduce((acc, f) => acc + f.cuotaTotal, 0)
  const cuotaEnCurso = filas[filaCorteIdx]
  const totalAPagar = Math.round(
    totalPagadoOFilasAntes +
    cuotaEnCurso.cuotaTotal +
    filasRecalculadas.reduce((acc, f) => acc + f.cuotaTotal, 0)
  )

  return {
    actualizaciones: [
      ...actualizaciones.slice(0, filaCorteIdx + 1),
      ...filasRecalculadas,
    ],
    totalAPagar,
    soloPagado: false,
  }
}

/**
 * Genera la tabla de amortizacion (modo 'lineal') para el saldo restante a
 * partir de un periodo dado — usada al recalcular cuotas futuras tras un
 * abono a capital. `saldoInicial` es el capital que queda por amortizar en
 * los `numPeriodosRestantes` periodos que faltan.
 */
export function recalcularTablaDesdeSaldo({ saldoInicial, tasaInteres, numPeriodosRestantes, primerNumeroPeriodo, fechaBase, diasPeriodo }) {
  const tasa = Number(tasaInteres)
  const capitalPorPeriodo = saldoInicial / numPeriodosRestantes
  const capitalRedondeado = Math.round(capitalPorPeriodo)
  const tabla = []
  let saldoRestante = saldoInicial
  let capitalAsignado = 0
  for (let i = 0; i < numPeriodosRestantes; i++) {
    const interesPeriodo = saldoRestante * (tasa / 100)
    const esUltimo = i === numPeriodosRestantes - 1
    const capital = esUltimo ? saldoInicial - capitalAsignado : capitalRedondeado
    capitalAsignado += capital
    const cuotaTotal = capital + Math.round(interesPeriodo)
    saldoRestante = Math.max(0, saldoRestante - capitalPorPeriodo)
    const fechaEsperada = new Date(fechaBase)
    fechaEsperada.setDate(fechaEsperada.getDate() + (i + 1) * diasPeriodo)
    tabla.push({
      numeroPeriodo: primerNumeroPeriodo + i,
      capital,
      interes: Math.round(interesPeriodo),
      cuotaTotal,
      saldoRestante: Math.round(saldoRestante),
      fechaEsperada,
      pagado: 0,
    })
  }
  return tabla
}

/**
 * Recalcula la tabla de amortizacion para modo 'solo_interes' tras un abono
 * a capital. Misma firma que recalcularTablaDesdeSaldo pero el capital se
 * concentra en la ultima cuota (balloon) en vez de repartirse.
 */
export function recalcularTablaSoloInteresDesdeSaldo({ saldoInicial, tasaInteres, numPeriodosRestantes, primerNumeroPeriodo, fechaBase, diasPeriodo, interesAdelantado = false }) {
  const tasa = Number(tasaInteres)
  const tabla = []
  let saldoRestante = saldoInicial
  const interesPorPeriodo = saldoRestante * (tasa / 100)
  for (let i = 0; i < numPeriodosRestantes; i++) {
    const esUltimo = i === numPeriodosRestantes - 1
    const capitalPeriodo = esUltimo ? saldoRestante : 0
    const interesPeriodo = (interesAdelantado && esUltimo) ? 0 : interesPorPeriodo
    const cuotaTotal = capitalPeriodo + interesPeriodo
    if (esUltimo) saldoRestante = 0
    const fechaEsperada = new Date(fechaBase)
    fechaEsperada.setDate(fechaEsperada.getDate() + (i + 1) * diasPeriodo)
    tabla.push({
      numeroPeriodo: primerNumeroPeriodo + i,
      capital: Math.round(capitalPeriodo),
      interes: Math.round(interesPeriodo),
      cuotaTotal: Math.round(cuotaTotal),
      saldoRestante: Math.round(saldoRestante),
      fechaEsperada,
      pagado: 0,
    })
  }
  return tabla
}

/**
 * Obtiene la proxima cuota pendiente de la tabla de amortizacion.
 * Retorna la primera fila no completamente pagada, o null si todas estan pagadas.
 * Tambien marca si es la ultima cuota (balloon en solo_interes).
 */
export function obtenerProximaCuotaTabla(prestamo) {
  if (!tieneTablaAmortizacion(prestamo)) return null
  const filas = [...prestamo.cuotasAmortizacion].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
  const totalFilas = filas.length
  for (const fila of filas) {
    const pagadaCompleta = (fila.pagado || 0) >= fila.cuotaTotal
    if (!pagadaCompleta) {
      const faltante = Math.max(0, fila.cuotaTotal - (fila.pagado || 0))
      const interesFaltante = Math.max(0, fila.interes - (fila.interesPagado || 0))
      return {
        ...fila,
        faltante: Math.round(faltante),
        interesFaltante: Math.round(interesFaltante),
        esUltima: fila.numeroPeriodo === totalFilas,
        esBalloon: prestamo.modoInteres === 'solo_interes' && fila.numeroPeriodo === totalFilas,
      }
    }
  }
  return null
}

/**
 * Obtiene la cuota del periodo actual para cobros en ruta.
 * Para prestamos con tabla de amortizacion, retorna la cuota de la proxima fila pendiente.
 * Para prestamos simples, retorna cuotaDiaria.
 */
export function obtenerCuotaPeriodoActual(prestamo) {
  if (!tieneTablaAmortizacion(prestamo)) return prestamo.cuotaDiaria || 0
  const proxima = obtenerProximaCuotaTabla(prestamo)
  if (!proxima) return 0
  if (prestamo.modoInteres === 'solo_interes' && !proxima.esUltima) {
    return proxima.interes
  }
  return proxima.cuotaTotal
}

/**
 * Calcula el interes moratorio acumulado de un prestamo.
 * tasaMoratorio: % mensual (ej: 3 = 3% mensual)
 * diasGracia: dias de gracia configurados por la org (default 5).
 *   Se escala automaticamente segun la frecuencia del prestamo:
 *     diario: diasGracia tal cual
 *     semanal: max(diasGracia, 7)
 *     quincenal: max(diasGracia, 10)
 *     mensual: max(diasGracia, 15)
 *
 * La base del moratorio depende del modo:
 *   - fijo/proporcional/unico: cuotas vencidas completas (capital+interes
 *     ya estan embebidos en la cuota, no se pueden separar)
 *   - lineal/solo_interes: solo el interes vencido no pagado (el capital
 *     vencido ya genera interes en cuotas futuras recalculadas, cobrar
 *     moratorio sobre el tambien seria doble castigo)
 *
 * Tope: nunca puede exceder 50% del saldo pendiente.
 */
export function calcularInteresMoratorio(prestamo, diasExcluidos = [], festivos = [], tasaMoratorio = 0, diasGracia = 5) {
  const nulo = { diasMoraEfectivos: 0, montoBase: 0, montoMoratorio: 0, tope: 0, aplicable: false }
  if (!tasaMoratorio || tasaMoratorio <= 0) return nulo
  if (!prestamo || prestamo.estado !== 'activo') return nulo

  const freq = prestamo.frecuencia || 'diario'
  const graciaMinima = { diario: 0, semanal: 7, quincenal: 10, mensual: 15 }[freq] || 0
  const graciaEfectiva = Math.max(diasGracia, graciaMinima)

  const diasMora = calcularDiasMora(prestamo, diasExcluidos, festivos)
  const diasMoraEfectivos = Math.max(0, diasMora - graciaEfectiva)
  if (diasMoraEfectivos <= 0) return nulo

  let montoBase
  if (tieneTablaAmortizacion(prestamo)) {
    const { montoEnMora } = calcularEstadoTablaAmortizacion(prestamo)
    montoBase = montoEnMora
  } else {
    montoBase = calcularMontoEnMora(prestamo, diasExcluidos, festivos)
  }
  if (!montoBase || montoBase <= 0) return nulo

  const tasaDiaria = tasaMoratorio / 100 / 30
  const montoCalculado = Math.round(montoBase * tasaDiaria * diasMoraEfectivos)

  const saldo = calcularSaldoPendiente(prestamo)
  const tope = Math.round(saldo * 0.5)
  const montoMoratorio = Math.min(montoCalculado, tope)

  return { diasMoraEfectivos, montoBase, montoMoratorio, tope, aplicable: montoMoratorio > 0 }
}

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

  // Modo lineal/solo_interes con tabla: calculo exacto desde las cuotas.
  // El capital restante sale de la tabla, el interes devengado es la suma
  // de intereses de cuotas ya vencidas + proporcional del periodo en curso.
  if (tieneTablaAmortizacion(prestamo)) {
    const hoy = inicioDiaColombia(fechaLiquidacion)
    const filas = [...prestamo.cuotasAmortizacion].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)

    let interesVencido = 0
    let capitalPagadoEnTabla = 0
    let ultimaVencida = null
    let primeraPendiente = null

    for (const f of filas) {
      const fVence = inicioDiaColombia(f.fechaEsperada)
      if (fVence <= hoy) {
        interesVencido += f.interes
        capitalPagadoEnTabla += f.capital
        ultimaVencida = f
      } else if (!primeraPendiente) {
        primeraPendiente = f
      }
    }

    let pagosRestante = totalPagadoReal
    let capitalCubierto = 0
    for (const f of filas) {
      if (pagosRestante <= 0) break
      const aplicado = Math.min(pagosRestante, f.cuotaTotal)
      const intCubierto = Math.min(aplicado, f.interes)
      capitalCubierto += Math.max(0, aplicado - intCubierto)
      pagosRestante -= aplicado
    }
    let capitalRestante = capital - capitalCubierto
    if (modo === 'lineal_dinamico' && primeraPendiente) {
      const interesRealProximo = capitalRestante * (tasa / 100)
      primeraPendiente = { ...primeraPendiente, interes: interesRealProximo, cuotaTotal: (capitalRestante / Math.max(1, filas.filter(f => inicioDiaColombia(f.fechaEsperada) > hoy).length)) + interesRealProximo }
    }

    // Interes proporcional del periodo en curso (entre la ultima cuota vencida y la proxima)
    let interesProporcional = 0
    if (primeraPendiente) {
      const inicioP = ultimaVencida
        ? inicioDiaColombia(ultimaVencida.fechaEsperada)
        : inicioDiaColombia(prestamo.fechaInicio)
      const finP = inicioDiaColombia(primeraPendiente.fechaEsperada)
      const duracionPeriodo = Math.max(1, (finP - inicioP) / DAY_MS)
      const diasEnPeriodo = Math.max(0, (hoy - inicioP) / DAY_MS)
      const fraccion = Math.min(1, diasEnPeriodo / duracionPeriodo)
      interesProporcional = primeraPendiente.interes * fraccion
    }

    const intMesCompleto = interesVencido + (primeraPendiente ? primeraPendiente.interes : 0)
    const intProporcional = interesVencido + interesProporcional

    function modalidadTabla(interesDevengado, etiqueta, meses) {
      const totalCierre = capital + interesDevengado
      const restanteHoy = Math.max(0, Math.round(totalCierre - totalPagadoReal))
      const interesPerdonado = Math.max(0, Math.round(saldoActual - restanteHoy))
      return {
        modalidad: etiqueta,
        mesesTranscurridos: Math.round(meses * 100) / 100,
        interesDevengado: Math.round(interesDevengado),
        totalCierre: Math.round(totalCierre),
        restanteHoy,
        interesPerdonado,
      }
    }

    return {
      modo,
      aproximado: false,
      capital,
      capitalRestante: Math.round(capitalRestante),
      tasa,
      frecuencia: freq,
      diasTranscurridos,
      totalPagadoReal: Math.round(totalPagadoReal),
      saldoActual: Math.round(saldoActual),
      interesTotalPactado: Math.round(interesTotalPactado),
      mesCompleto: modalidadTabla(intMesCompleto, 'mesCompleto', mesesMesCompleto),
      proporcional: modalidadTabla(intProporcional, 'proporcional', mesesProporcional),
    }
  }

  function interesPara(meses) {
    let interes
    if (modo === 'unico') {
      interes = capital * (tasa / 100)
    } else if (modo === 'manual' || modo === 'saldo') {
      interes = Math.max(0, totalPagadoReal - 0) >= capital
        ? Math.max(0, totalPagadoReal - capital)
        : interesTotalPactado * Math.min(1, meses / Math.max(1, (prestamo.diasPlazo || 30) / 30))
    } else {
      interes = capital * (tasa / 100) * meses
    }
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

/**
 * Patrimonio del negocio = lo que te deben + lo que tienes en caja.
 *
 * NO se restan los gastos. `capital.saldo` YA los descontó: en lib/capital.js
 * el tipo 'gasto' esta en la lista de egresos, asi que cada gasto aprobado ya
 * bajo el saldo. El dashboard los restaba otra vez y subestimaba el patrimonio
 * exactamente en los gastos del mes — y ese es el numero por el que el dueño
 * decide si retira utilidades.
 */
export function calcularPatrimonio({ saldoPorCobrar = 0, cajaDisponible = 0 } = {}) {
  return (saldoPorCobrar || 0) + (cajaDisponible || 0)
}
