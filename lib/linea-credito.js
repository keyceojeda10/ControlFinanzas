// lib/linea-credito.js — Logica de negocio para lineas de credito rotativas.

/**
 * Calcula el saldo actual de una linea de credito.
 * @param {object} linea - LineaCredito con desembolsos[] y pagosLinea[]
 * @returns {{ capitalUsado: number, interesesPendientes: number, saldoTotal: number, cupoDisponible: number }}
 */
export function calcularSaldoLinea(linea) {
  const totalDesembolsado = (linea.desembolsos || []).reduce(
    (sum, d) => sum + d.monto,
    0
  )
  const totalPagadoCapital = (linea.pagosLinea || []).reduce(
    (sum, p) => sum + p.montoACapital,
    0
  )
  const totalPagadoInteres = (linea.pagosLinea || []).reduce(
    (sum, p) => sum + p.montoAInteres,
    0
  )

  const capitalUsado = totalDesembolsado - totalPagadoCapital

  const interesesTotal = calcularInteresAcumulado(linea)
  const interesesPendientes = Math.max(0, interesesTotal - totalPagadoInteres)

  const saldoTotal = capitalUsado + interesesPendientes
  const cupoDisponible = Math.max(0, linea.cupoMaximo - capitalUsado)

  return { capitalUsado, interesesPendientes, saldoTotal, cupoDisponible }
}

/**
 * Calcula el interes acumulado total historico de la linea.
 * Suma intereses de cortes ya generados + interes del periodo actual (sin corte).
 */
function calcularInteresAcumulado(linea) {
  const interesesCortes = (linea.cortesLinea || []).reduce(
    (sum, c) => sum + c.interesesGenerados,
    0
  )

  const ultimoCorte = (linea.cortesLinea || [])
    .sort((a, b) => new Date(b.fechaCorte) - new Date(a.fechaCorte))[0]

  const desde = ultimoCorte ? new Date(ultimoCorte.fechaCorte) : new Date(linea.createdAt)
  const hasta = new Date()

  const interesPeriodoActual = calcularInteresesPeriodo(linea, desde, hasta)

  return interesesCortes + interesPeriodoActual
}

/**
 * Calcula intereses para un periodo segun el modo configurado.
 * @param {object} linea - con desembolsos[], pagosLinea[], modoInteres, tasaInteres
 * @param {Date} desde
 * @param {Date} hasta
 * @returns {number}
 */
export function calcularInteresesPeriodo(linea, desde, hasta) {
  const tasa = linea.tasaInteres / 100

  if (linea.modoInteres === 'fijo_mensual') {
    return calcularInteresFijoMensual(linea, desde, hasta, tasa)
  }

  if (linea.modoInteres === 'diario_saldo') {
    return calcularInteresDiarioSaldo(linea, desde, hasta, tasa)
  }

  if (linea.modoInteres === 'al_corte') {
    return calcularInteresAlCorte(linea, desde, hasta, tasa)
  }

  return 0
}

function calcularInteresFijoMensual(linea, desde, hasta, tasa) {
  const saldoAlFinal = saldoCapitalEnFecha(linea, hasta)
  return Math.round(saldoAlFinal * tasa)
}

function calcularInteresDiarioSaldo(linea, desde, hasta, tasaMensual) {
  const tasaDiaria = tasaMensual / 30
  let total = 0

  const d = new Date(desde)
  while (d < hasta) {
    const saldoDia = saldoCapitalEnFecha(linea, d)
    total += saldoDia * tasaDiaria
    d.setDate(d.getDate() + 1)
  }

  return Math.round(total)
}

function calcularInteresAlCorte(linea, desde, hasta, tasa) {
  const desembolsosPeriodo = (linea.desembolsos || [])
    .filter(d => {
      const f = new Date(d.createdAt)
      return f >= desde && f <= hasta
    })
    .reduce((sum, d) => sum + d.monto, 0)

  const saldoAnterior = saldoCapitalEnFecha(linea, desde)
  return Math.round((saldoAnterior + desembolsosPeriodo) * tasa)
}

/**
 * Retorna el capital usado (desembolsos - pagos a capital) hasta una fecha dada.
 */
function saldoCapitalEnFecha(linea, fecha) {
  const f = new Date(fecha)

  const desembolsos = (linea.desembolsos || [])
    .filter(d => new Date(d.createdAt) <= f)
    .reduce((sum, d) => sum + d.monto, 0)

  const pagosCapital = (linea.pagosLinea || [])
    .filter(p => new Date(p.createdAt) <= f)
    .reduce((sum, p) => sum + p.montoACapital, 0)

  return Math.max(0, desembolsos - pagosCapital)
}

/**
 * Aplica un pago a la linea. Primero cubre intereses, luego capital.
 * @param {object} linea - con desembolsos[], pagosLinea[], cortesLinea[]
 * @param {number} monto - monto total del pago
 * @returns {{ montoAInteres: number, montoACapital: number, saldoRestante: number }}
 */
export function aplicarPago(linea, monto) {
  const { capitalUsado, interesesPendientes } = calcularSaldoLinea(linea)

  let montoAInteres = Math.min(monto, interesesPendientes)
  let montoACapital = Math.min(monto - montoAInteres, capitalUsado)

  return {
    montoAInteres: Math.round(montoAInteres),
    montoACapital: Math.round(montoACapital),
    saldoRestante: Math.round(capitalUsado - montoACapital + (interesesPendientes - montoAInteres)),
  }
}

/**
 * Genera los datos para un corte mensual (estado de cuenta).
 * @param {object} linea - con desembolsos[], pagosLinea[], cortesLinea[]
 * @param {Date} fechaCorte
 * @returns {object} datos del corte (sin guardar en DB)
 */
export function generarCorte(linea, fechaCorte) {
  const periodo = `${fechaCorte.getFullYear()}-${String(fechaCorte.getMonth() + 1).padStart(2, '0')}`

  const cortesAnteriores = (linea.cortesLinea || [])
    .sort((a, b) => new Date(b.fechaCorte) - new Date(a.fechaCorte))
  const ultimoCorte = cortesAnteriores[0]

  const saldoAnterior = ultimoCorte ? ultimoCorte.saldoNuevo : 0
  const desde = ultimoCorte ? new Date(ultimoCorte.fechaCorte) : new Date(linea.createdAt)

  const desembolsosPeriodo = (linea.desembolsos || [])
    .filter(d => {
      const f = new Date(d.createdAt)
      return f > desde && f <= fechaCorte
    })

  const pagosPeriodo = (linea.pagosLinea || [])
    .filter(p => {
      const f = new Date(p.createdAt)
      return f > desde && f <= fechaCorte
    })

  const totalDesembolsos = desembolsosPeriodo.reduce((s, d) => s + d.monto, 0)
  const totalPagado = pagosPeriodo.reduce((s, p) => s + p.montoTotal, 0)
  const interesesGenerados = calcularInteresesPeriodo(linea, desde, fechaCorte)

  const totalCargos = saldoAnterior + totalDesembolsos + interesesGenerados
  const saldoNuevo = Math.max(0, totalCargos - totalPagado)

  const pagoMinimo = linea.pagoMinimoPct > 0
    ? Math.round(saldoNuevo * (linea.pagoMinimoPct / 100))
    : 0

  return {
    lineaCreditoId: linea.id,
    organizationId: linea.organizationId,
    periodo,
    fechaCorte,
    saldoAnterior: Math.round(saldoAnterior),
    totalDesembolsos: Math.round(totalDesembolsos),
    interesesGenerados: Math.round(interesesGenerados),
    totalCargos: Math.round(totalCargos),
    totalPagado: Math.round(totalPagado),
    saldoNuevo: Math.round(saldoNuevo),
    pagoMinimo,
  }
}

/**
 * Verifica si un desembolso es posible (cupo disponible y linea activa).
 * @param {object} linea - con desembolsos[], pagosLinea[]
 * @param {number} monto
 * @returns {{ puede: boolean, razon?: string, cupoDisponible: number }}
 */
export function puedeDesembolsar(linea, monto) {
  if (linea.estado !== 'activa') {
    return { puede: false, razon: 'La linea no esta activa', cupoDisponible: 0 }
  }

  const { cupoDisponible } = calcularSaldoLinea(linea)

  if (monto > cupoDisponible) {
    return {
      puede: false,
      razon: `El monto excede el cupo disponible (${cupoDisponible})`,
      cupoDisponible,
    }
  }

  return { puede: true, cupoDisponible: cupoDisponible - monto }
}

export const MODOS_INTERES = [
  {
    value: 'fijo_mensual',
    label: 'Tasa fija mensual',
    descripcion: 'El interes se calcula sobre lo que el cliente debe al dia del corte. Ejemplo: si debe $200.000 y la tasa es 10%, paga $20.000 de interes ese mes.',
  },
  {
    value: 'diario_saldo',
    label: 'Interes diario sobre saldo',
    descripcion: 'El interes se calcula cada dia sobre lo que debe ese dia. Si paga rapido, paga menos interes. Si pide mas plata durante el mes, el interes sube proporcionalmente.',
  },
  {
    value: 'al_corte',
    label: 'Interes al corte (sobre todo lo usado)',
    descripcion: 'El interes se calcula sobre todo lo que se uso en el mes: lo que ya debia + lo que pidio nuevo. Genera mas interes que los otros metodos.',
  },
]
