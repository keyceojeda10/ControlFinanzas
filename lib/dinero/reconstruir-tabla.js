/**
 * Reconstruye la tabla de amortización de un préstamo que se quedó sin ella.
 *
 * ══ EL CASO ══════════════════════════════════════════════════════════════════
 *
 * 12 préstamos activos en modo «saldo» no tienen NI UNA FILA de tabla: se
 * crearon antes de que la vía de creación se arreglara (todos de junio-julio;
 * desde el 18 jul los 53 nuevos salen con tabla). Sin ella la pantalla reventaba
 * y el prestamista no podía cobrar — eso ya está arreglado en `modos.js`.
 *
 * Lo que sigue faltando es el CALENDARIO: fechas y reparto capital/interés por
 * cuota. Esta función lo devuelve.
 *
 * ══ POR QUÉ NO SE RECALCULA CON `calcularPrestamo` ═══════════════════════════
 *
 * Porque daría otras cifras. Medido sobre los 12: solo 2 reproducen su
 * `totalAPagar`; el resto se desvía entre −$53 y −$3.154. La causa no es un
 * fallo del cálculo, es que esos préstamos se guardaron con CUOTAS PAREJAS
 * —`total = cuota × períodos`, comprobado exacto en 11 de los 12— mientras que
 * `calcularPrestamo` ajusta la última cuota para cerrar el saldo en cero.
 *
 * Las dos formas son legítimas y las dos existen en la base. Pero la deuda que
 * el cliente firmó es la que está guardada, así que la tabla se construye PARA
 * QUE SUME ESO, no al revés. Es la misma invariante que cumplen los préstamos
 * que sí tienen tabla: los 8 revisados suman su `totalAPagar` al peso.
 *
 * ⚠ Reconstruir una tabla NO cambia lo que el cliente debe: `totalAPagar` y
 * `totalPagado` no se tocan. Solo se añade el desglose que faltaba.
 */

/** Interés por período, desde la tasa mensual y la frecuencia. */
const PERIODOS_POR_MES = { diario: 30, semanal: 4, quincenal: 2, mensual: 1 }

/**
 * @returns {{ filas: Array, cuadra: boolean, motivo: string|null }}
 *   `cuadra: false` significa NO ESCRIBIR: la tabla no reproduce lo pactado y
 *   escribirla inventaría un calendario que no cuadra con la deuda.
 */
export function reconstruirTabla(prestamo) {
  const total = Math.round(Number(prestamo?.totalAPagar) || 0)
  const monto = Math.round(Number(prestamo?.montoPrestado) || 0)
  const cuota = Math.round(Number(prestamo?.cuotaDiaria) || 0)
  const freq = prestamo?.frecuencia || 'mensual'
  const tasa = Number(prestamo?.tasaInteres) || 0

  if (!total || !monto || !cuota) {
    return { filas: [], cuadra: false, motivo: 'faltan monto, total o cuota' }
  }

  // Los períodos salen de la propia deuda: `total / cuota`. No se recalculan
  // desde el plazo, porque es justo ahí donde los dos criterios divergen.
  const periodos = total / cuota
  if (!Number.isInteger(periodos) || periodos < 1) {
    // Es el caso de Leydi: ya tiene un abono a capital que le movió las cuotas,
    // así que su total ya no es múltiplo de su cuota. Reconstruir aquí sería
    // adivinar cómo se repartió ese abono.
    return {
      filas: [], cuadra: false,
      motivo: `el total (${total}) no es múltiplo de la cuota (${cuota}): el préstamo ya tuvo movimientos que cambiaron el calendario`,
    }
  }

  const i = (tasa / 100) / (PERIODOS_POR_MES[freq] || 30)
  const dias = Math.round((Number(prestamo?.diasPlazo) || 0) / periodos) || 30
  const inicio = prestamo?.fechaInicio ? new Date(prestamo.fechaInicio) : null

  /* ⚠ LAS CUOTAS SON PAREJAS, Y ESO MANDA.
     Estos préstamos se pactaron con `total = cuota × períodos` —comprobado
     exacto en 11 de los 12— así que TODAS las cuotas valen lo mismo, incluida
     la última. Lo que se reparte dentro de cada una es capital e interés.

     Mi primer intento cerró el saldo en la última fila, como hace
     `calcularPrestamo`, y la tabla salía entre $53 y $3.154 por debajo de la
     deuda: el prestamista habría visto un calendario que no cuadra con lo que
     le debe su cliente. La guardia de abajo lo cazó antes de escribir nada. */
  const filas = []
  let saldo = monto
  let capitalAcumulado = 0
  for (let n = 1; n <= periodos; n++) {
    // El interés del período sale del saldo vivo — es lo que significa «sobre
    // saldo». El capital es el resto de la cuota.
    const interesTeorico = Math.round(saldo * i)
    // La última fila devuelve TODO el capital que quede: el préstamo tiene que
    // amortizar exactamente lo prestado, ni un peso más ni menos. El interés de
    // esa cuota es lo que sobra, que es donde caen los redondeos de los
    // períodos anteriores.
    const capital = n === periodos ? (monto - capitalAcumulado) : Math.min(saldo, cuota - interesTeorico)
    const interes = cuota - capital
    capitalAcumulado += capital
    saldo = Math.max(0, saldo - capital)

    filas.push({
      numeroPeriodo: n,
      capital,
      interes,
      cuotaTotal: cuota,
      saldoRestante: saldo,
      fechaEsperada: inicio
        ? new Date(inicio.getTime() + n * dias * 86400000)
        : null,
      pagado: 0,
    })
  }

  /* LAS DOS COMPROBACIONES QUE DECIDEN SI SE ESCRIBE.
     Si cualquiera falla NO se escribe: una tabla que no cuadra con la deuda o
     que no devuelve lo prestado es peor que no tener tabla. */
  const suma = filas.reduce((a, f) => a + f.cuotaTotal, 0)
  if (Math.abs(suma - total) > 1) {
    return { filas, cuadra: false, motivo: `la tabla suma ${suma} y la deuda es ${total} (dif ${suma - total})` }
  }
  const sumaCapital = filas.reduce((a, f) => a + f.capital, 0)
  if (Math.abs(sumaCapital - monto) > 1) {
    return { filas, cuadra: false, motivo: `el capital de la tabla suma ${sumaCapital} y se prestaron ${monto}` }
  }
  // Un interés negativo significaría que la cuota no cubre ni el interés del
  // período: la tabla estaría diciendo que el cliente devuelve más capital del
  // que pidió en esa cuota.
  const negativa = filas.find((f) => f.interes < 0 || f.capital < 0)
  if (negativa) {
    return { filas, cuadra: false, motivo: `la cuota ${negativa.numeroPeriodo} sale con capital o interés negativo` }
  }

  return { filas, cuadra: true, motivo: null }
}

/**
 * Reparte lo ya pagado sobre las filas, en cascada.
 *
 * Solo para pagos NORMALES (completo/parcial). Los de tipo `intereses` o
 * `capital` no entran: un abono a capital recalcula las cuotas futuras y
 * meterlo en la cascada haría que apareciera como cuotas pagadas que no lo
 * están — que es exactamente cómo se infló la deuda de un cliente antes.
 */
export function repartirPagado(filas, pagosNormales = 0) {
  let restante = Math.round(Number(pagosNormales) || 0)
  return filas.map((f) => {
    const pagado = Math.min(f.cuotaTotal, Math.max(0, restante))
    restante -= pagado
    return { ...f, pagado: Math.round(pagado) }
  })
}
