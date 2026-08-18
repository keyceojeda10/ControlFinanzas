// El libro mayor esperado. PURO: no toca red ni base.
//
// Es la parte que encarna «ya sé cuál debería ser el resultado». Todo lo demás
// del guion solo va a comprobar contra esto.
//
// ── LA REGLA QUE NO SE ROMPE ────────────────────────────────────────────────
//
// NUNCA se predice con una regla de tres. `calcularPrestamo` hace `ceil100`
// POR CUOTA y luego multiplica, así que:
//
//   347.000 al 20% a 30 días  ->  417.000, y no 416.400
//   200.000 al 20% a 20 días  ->  228.000, y no 240.000
//   1.000.000 al 10% a 90d semanal -> 1.326.000, y no 1.100.000
//
// Medido ejecutándolo. Si el libro tecleara la fórmula a mano, la prueba
// reportaría descuadres que no existen — que es justo lo que viene a evitar.

import { calcularPrestamo, calcularSaldoPendiente, calcularCapitalRestante, tieneTablaAmortizacion } from '../../lib/calculos.js'

/* Los acumuladores salen de las fórmulas de la caja (`app/api/caja/route.js`),
   no de mi cabeza:

     recogida            = recogidaEfectivo + recogidaDigital
     disponibleOperativo = recogida − gastos
     saldoRealCaja       = disponibleOperativo − desembolsado

   `desembolsado` y `valorPrestado` van SEPARADOS a propósito: en la renovación
   se separan, y llevarlos aparte es lo que convierte «la caja no cuadra» en
   «la caja no cuadra POR la renovación». */
export function libroNuevo() {
  return {
    recogidaEfectivo: 0,
    recogidaDigital: 0,
    desembolsado: 0,          // lo que salió por préstamos, por cualquier vía
    desembolsadoEfectivo: 0,  // ⚠ SOLO lo que salió DEL FAJO del cobrador
    valorPrestado: 0,         // el valor de las cartulinas
    gastos: 0,                // solo los APROBADOS
    capital: 0,               // el saldo del ledger
    asientos: [],
  }
}

export function anotar(libro, asiento) {
  for (const clave of ['recogidaEfectivo', 'recogidaDigital', 'desembolsado', 'desembolsadoEfectivo', 'valorPrestado', 'gastos', 'capital']) {
    libro[clave] += asiento.delta?.[clave] ?? 0
  }
  libro.asientos.push(asiento)
  return libro
}

export function totales(libro) {
  const recogida = libro.recogidaEfectivo + libro.recogidaDigital
  const disponibleOperativo = recogida - libro.gastos
  return {
    recogida,
    recogidaEfectivo: libro.recogidaEfectivo,
    recogidaDigital: libro.recogidaDigital,
    gastos: libro.gastos,
    desembolsado: libro.desembolsado,
    valorPrestado: libro.valorPrestado,
    disponibleOperativo,
    saldoRealCaja: disponibleOperativo - libro.desembolsado,
    capital: libro.capital,
  }
}

/* Lo que el préstamo VA a costar, preguntándoselo a la aplicación.
   No se teclea la fórmula: ver la cabecera del fichero. */
export function preverPrestamo({ monto, tasa, dias, frecuencia, modoInteres, fechaInicio, sinPlazo }) {
  const r = calcularPrestamo({
    montoPrestado: monto, tasaInteres: tasa, diasPlazo: dias,
    fechaInicio, frecuencia, modoInteres,
    // El abierto no tiene plazo; la bandera es lo único que lo distingue.
    ...(sinPlazo ? { sinPlazo: true } : {}),
  })
  return {
    totalAPagar: r.totalAPagar,
    cuota: r.cuotaDiaria,
    periodos: r.numPeriodos,
    conTabla: Array.isArray(r.tablaAmortizacion) && r.tablaAmortizacion.length > 0,
    tabla: r.tablaAmortizacion ?? null,
  }
}

/* ⚠ EL REDONDEO DE LA RENOVACIÓN.
   `renovar/route.js:198-201` redondea la diferencia AL CENTENAR SUPERIOR:

     diferenciaExacta = montoNuevo − minimoRenovacion
     diferencia       = ceil(diferenciaExacta / 100) × 100

   y el `MovimientoCapital` se asienta por esa cifra redondeada, que es la que
   `desembolsadoDia` lee. Un libro que calculara `montoNuevo − saldoViejo` a
   secas se desviaría hasta 99 pesos POR RENOVACIÓN. */
export function preverRenovacion({ montoNuevo, prestamoViejo }) {
  const conTabla = tieneTablaAmortizacion(prestamoViejo)
  const capital = calcularCapitalRestante(prestamoViejo)
  const saldo = calcularSaldoPendiente(prestamoViejo)

  // La misma rama que `renovar/route.js:117-120`: con tabla manda el capital
  // (el interés futuro no está devengado); sin tabla, la deuda.
  const absorbido = conTabla && capital != null ? capital : saldo

  const exacta = montoNuevo - absorbido
  const entregada = exacta > 0 ? Math.ceil(exacta / 100) * 100 : exacta

  return { conTabla, absorbido, saldoPendiente: saldo, capitalRestante: capital, exacta, entregada }
}

/* ── EL FAJO DEL COBRADOR, CONTADO A MANO ──────────────────────────────────
 *
 * Esto es lo que de verdad pidió el dueño: no que la caja cuadre consigo misma
 * —eso ya lo hacía— sino que cuadre «como debería cuadrarle al cliente y
 * matemáticamente como debería ser».
 *
 * La cuenta es la del cobrador con los billetes en la mano:
 *
 *   lo que traía
 *   + lo que cobró EN EFECTIVO
 *   − lo que prestó EN EFECTIVO
 *   − lo que gastó
 *   = lo que le queda en el bolsillo
 *
 * Lo que se movió por transferencia NO toca el fajo: ni el cobro que entró a la
 * cuenta de la oficina, ni el préstamo que se desembolsó por transferencia.
 */
export function fajoEsperado(libro) {
  return libro.recogidaEfectivo - libro.desembolsadoEfectivo - libro.gastos
}

/* Compara el libro con lo que dice la caja. Devuelve SOLO los renglones que no
   cuadran, para que el informe pueda señalar el culpable en vez de imprimir
   una tabla entera de ceros. */
export function comparar(libro, cajaDia) {
  const esp = totales(libro)
  const filas = [
    ['recogida', esp.recogida, cajaDia?.recogida],
    ['  efectivo', esp.recogidaEfectivo, cajaDia?.recogidaEfectivo],
    ['  digital', esp.recogidaDigital, cajaDia?.recogidaDigital],
    ['gastos', esp.gastos, cajaDia?.gastos],
    ['desembolsado', esp.desembolsado, cajaDia?.desembolsadoDia],
    ['valorPrestado', esp.valorPrestado, cajaDia?.valorPrestadoDia],
    ['saldoRealCaja', esp.saldoRealCaja, cajaDia?.saldoRealCaja],
    ['capital', esp.capital, cajaDia?.disponibleHoy],
  ].map(([nombre, esperado, obtenido]) => ({
    nombre,
    esperado: Math.round(esperado ?? 0),
    obtenido: Math.round(obtenido ?? 0),
    diferencia: Math.round((obtenido ?? 0) - (esperado ?? 0)),
  }))

  return { filas, descuadres: filas.filter((f) => f.diferencia !== 0) }
}
