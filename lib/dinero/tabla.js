// lib/dinero/tabla.js — G6.1 · la tabla que los modos clásicos nunca guardaron.
//
// ── QUÉ DESBLOQUEA ─────────────────────────────────────────────────────────
// «¿Cuánto interés lleva devengado este préstamo?» hoy solo se puede contestar
// cuando hay filas en `CuotaAmortizacion`, y `fijo`/`unico`/`manual` solo las
// materializan si el préstamo lleva `capitalExtra`. Es el **8%** de la cartera.
// Con esta función pasa a ser el 100%, y `tieneTablaAmortizacion()` deja de ser
// el punto donde se bifurca la lectura del dinero.
//
// De eso cuelgan la mora del modo clásico —hoy en un préstamo de cuota única no
// hay mora HASTA EL ÚLTIMO DÍA, y entonces aparece entera—, el abono a interés,
// y la columna GANANCIA de la tarjeta, que lleva meses sin poder pintarse
// porque el interés cobrado no se puede medir sin saber cuánto se devengó.
//
// ── LA DECISIÓN QUE MÁS IMPORTA: SE DERIVA DE LO GUARDADO ──────────────────
// Esta función NO recalcula el préstamo. Lee `montoPrestado`, `totalAPagar` y
// el número de cuotas que ya están en la fila, y reparte.
//
// Recalcular con `calcularPrestamo` a partir de la tasa y el plazo habría sido
// lo natural, y es exactamente el error: `manual` tiene la cuota TECLEADA a
// mano, los préstamos viejos se crearon con fórmulas que desde entonces han
// cambiado, y el `legacy_proporcional` ni siquiera es alcanzable hoy. Cualquiera
// de esos casos daría una tabla que contradice el `totalAPagar` que el cliente
// tiene firmado en su cartulina. Derivando de lo guardado, la contradicción es
// IMPOSIBLE: las dos invariantes se cumplen por construcción, no por suerte.
//
// ── EL REDONDEO, QUE ES DONDE ESTO SE ROMPE ────────────────────────────────
// `calcularPrestamo` redondea la cuota HACIA ARRIBA a los $100 (`ceil100`) y
// después hace `totalAPagar = cuota * numPeriodos`. Así que el total ya lleva
// dentro los pesos de más del redondeo, y una tabla que reparta el interés
// teórico no sumará ese total.
//
// La regla es la misma que fijó G3 para el reparto: **se redondea UN lado y el
// otro se deriva por resta.** Aquí el capital se reparte parejo —es lo que se
// prestó, y es exacto— y el interés sale de restar. El sobrante del redondeo
// cae del lado del interés, que es donde de verdad está: el cliente paga unos
// pesos más de los teóricos, y esos pesos son ganancia, no capital.

// ⚠ DEL CALENDARIO, NO DE `calculos.js`. Si esto vuelve a apuntar a
// `calculos.js` reaparece el ciclo —`calculos` importa esta tabla para medir la
// mora del modo clásico— y el ciclo es el fallo que no se ve hasta producción.
import { fechaDePeriodo, obtenerDiasPorPeriodo } from '@/lib/dinero/calendario'

/**
 * ¿Se le puede derivar la tabla a este préstamo?
 *
 * No a los que YA la tienen guardada: ahí manda la fila real, que puede llevar
 * horneados abonos a capital y reprogramaciones que ninguna derivación conoce.
 */
export function sePuedeDerivar(prestamo) {
  if (!prestamo) return false
  if ((prestamo.cuotasAmortizacion?.length || 0) > 0) return false
  return (Number(prestamo.totalAPagar) || 0) > 0 && numeroDeCuotas(prestamo) > 0
}

/** Cuántos cobros tiene pactados. `unico` es uno solo, por definición. */
export function numeroDeCuotas(prestamo) {
  const n = Number(prestamo?.totalCuotas ?? prestamo?.numeroCuotas ?? 0)
  if (n > 0) return Math.round(n)
  if (prestamo?.modoInteres === 'unico') return 1
  const dias = Number(prestamo?.diasPlazo) || 0
  const porPeriodo = obtenerDiasPorPeriodo(prestamo?.frecuencia) || 1
  return dias > 0 ? Math.max(1, Math.round(dias / porPeriodo)) : 0
}

/**
 * Las filas que `calcularPrestamo` calcula por dentro y no guarda.
 *
 * Mismo contrato que `CuotaAmortizacion`, para que quien las consuma no tenga
 * que saber si vienen de la base o de aquí:
 * `{ numeroPeriodo, capital, interes, cuotaTotal, saldoRestante, fechaEsperada }`
 *
 * Más `derivada: true`, que NO es decoración: quien las escriba en la base
 * tiene que saber que no vienen de ahí, y la pantalla que las enseñe debería
 * poder decir de dónde salen. Es la misma regla de «¿de dónde sale?» de G1.5.
 */
export function derivarTabla(prestamo) {
  if (!sePuedeDerivar(prestamo)) return []

  const n = numeroDeCuotas(prestamo)
  const monto = Math.round(Number(prestamo.montoPrestado) || 0)
  const total = Math.round(Number(prestamo.totalAPagar) || 0)

  const freq = prestamo.frecuencia || 'diario'
  // ⚠ EL PASO DE LOS PERIODOS SALE DEL PLAZO PARTIDO POR LOS COBROS, no de la
  // frecuencia a secas. Lo cazó la medición contra el espejo, no las pruebas:
  // en `unico` hay UN solo cobro y `obtenerDiasPorPeriodo('diario')` da 1, así
  // que la única cuota vencía AL DÍA SIGUIENTE del desembolso en vez de al
  // final del plazo. Resultado: la mora de los 956 préstamos de cuota única
  // saltaba de $192M a $488M, y no por el fallo que G6 vino a arreglar sino
  // por mi propia derivación.
  //
  // Partir el plazo entre los cobros da lo mismo en las frecuencias normales
  // —diario 30/30=1, semanal 84/12=7— y lo correcto en cuota única. En mensual
  // da igual: esa rama va por `sumarMeses`, no por días.
  const diasPlazo = Number(prestamo.diasPlazo) || 0
  const opciones = {
    fechaInicio: prestamo.fechaInicio,
    freq,
    diasPeriodo: diasPlazo > 0 ? Math.max(1, Math.round(diasPlazo / n)) : obtenerDiasPorPeriodo(freq),
    diaCobroMes: Number.isInteger(prestamo.diaCobroMes) ? prestamo.diaCobroMes : null,
    diaCobroMes2: Number.isInteger(prestamo.diaCobroMes2) ? prestamo.diaCobroMes2 : null,
  }

  // Se reparte parejo y la ÚLTIMA fila se lleva el residuo. No es un apaño: es
  // lo que hace que las dos sumas den exactas en vez de aproximadas, y es lo
  // que el prestamista ya espera —la última cuota siempre es la rara—.
  const capitalBase = Math.floor(monto / n)
  const cuotaBase = Math.floor(total / n)
  const fin = prestamo.fechaFin ? new Date(prestamo.fechaFin) : null

  const filas = []
  let saldo = monto
  for (let i = 1; i <= n; i++) {
    const ultimo = i === n
    const capital = ultimo ? saldo : Math.min(capitalBase, saldo)
    const cuotaTotal = ultimo ? total - cuotaBase * (n - 1) : cuotaBase
    saldo = Math.max(0, saldo - capital)
    filas.push({
      numeroPeriodo: i,
      capital,
      // Derivado por RESTA, nunca calculado aparte: es lo que garantiza que
      // `capital + interes === cuotaTotal` en todas las filas sin excepción.
      interes: cuotaTotal - capital,
      cuotaTotal,
      saldoRestante: saldo,
      // LA ÚLTIMA FILA CAE EN EL VENCIMIENTO GUARDADO, no en lo que salga de
      // sumar periodos. La aritmética de periodos y el vencimiento pueden no
      // coincidir —en cuota única mensual el calendario da +1 mes y el plazo
      // son 6— y de las dos manda la que el cliente tiene firmada. Así la
      // propiedad «la última cuota es el día del vencimiento» se cumple por
      // construcción en vez de por suerte.
      fechaEsperada: (ultimo && fin) ? fin : fechaDePeriodo(i, opciones),
      derivada: true,
    })
  }
  return filas
}

/**
 * Cuánto interés se ha DEVENGADO a una fecha, según el calendario pactado.
 *
 * Es la pregunta que no se podía contestar en el modo clásico, y la que
 * convierte «no hay mora hasta el último día» en «lleva N días de atraso». No
 * es lo mismo que el interés COBRADO —eso sale de los pagos— sino lo que a esta
 * fecha ya se había ganado por el paso del tiempo.
 *
 * Cuenta la fila del día: si hoy vence un cobro, ese interés ya se devengó.
 */
/**
 * El interés devengado en CUOTA ÚNICA, lineal por días.
 *
 * ── LA DECISIÓN, TOMADA EL 2 DE AGOSTO DE 2026 ─────────────────────────────
 * Hoy `interesPara(meses)` en `lib/calculos.js` recibe los meses y **para
 * `unico` no los usa**: devuelve `capital * tasa`. Todo el interés se devenga el
 * día del desembolso, y por eso la liquidación anticipada nunca perdona nada en
 * ese modo, y por eso «abono a interés» ahí no significaría nada.
 *
 * El dueño decidió dos cosas, y las dos importan:
 *
 *   1 · La curva es **lineal por días**. Se explica por teléfono sin esfuerzo:
 *       «lleva 20 de 40 días, va por la mitad».
 *
 *   2 · **SOLO MIDE. No cambia lo que el cliente paga.** Lo pactado sigue
 *       siendo lo pactado: quien cancela antes paga exactamente lo mismo que
 *       hoy.
 *
 * ⚠ POR ESO ESTA FUNCIÓN NO SE LLAMA DESDE `calcularLiquidacionAnticipada` NI
 * DESDE `interesPara`, y no debe llamarse desde ahí sin volver a decidirlo.
 * Medido contra el espejo: si la curva tocara el cobro, movería **$59.886.827
 * en 734 préstamos vivos** y bajaría la deuda de clientes reales de un día para
 * otro. Eso es categoría «consentimiento» de G8 —cliente por cliente—, no un
 * cambio de fórmula que se despliega un martes.
 *
 * Lo que sí alimenta: la mora gradual —hoy en cuota única no hay mora HASTA EL
 * ÚLTIMO DÍA y entonces aparece entera—, la ganancia del mes, y el abono a
 * interés de G6.3.
 */
export function devengadoLineal(prestamo, hasta = Date.now()) {
  const capital = Number(prestamo?.montoPrestado) || 0
  const total = Number(prestamo?.totalAPagar) || 0
  const interes = Math.max(0, total - capital)
  if (interes <= 0) return 0

  const inicio = prestamo?.fechaInicio ? new Date(prestamo.fechaInicio).getTime() : null
  if (inicio == null || Number.isNaN(inicio)) return 0

  const fin = prestamo?.fechaFin
    ? new Date(prestamo.fechaFin).getTime()
    : inicio + (Number(prestamo?.diasPlazo) || 30) * 86400000
  const largo = Math.max(1, fin - inicio)

  // Se acota a [0,1] a los dos lados. Pasado el vencimiento está TODO ganado —
  // el interés no sigue creciendo solo, para eso está el recargo, que es otra
  // cosa y la decide el prestamista. Ver `plazo_no_es_tope`.
  const fraccion = Math.min(1, Math.max(0, (new Date(hasta).getTime() - inicio) / largo))
  return Math.round(interes * fraccion)
}

export function interesDevengadoA(filas = [], hasta = Date.now()) {
  const corte = new Date(hasta).getTime()
  return (filas || [])
    .filter((f) => f.fechaEsperada && new Date(f.fechaEsperada).getTime() <= corte)
    .reduce((a, f) => a + (Number(f.interes) || 0), 0)
}

/**
 * La tabla del préstamo, venga de donde venga.
 *
 * Éste es el punto que hace que el resto de la app deje de preguntar «¿tiene
 * tabla?». Si la tiene guardada, manda la guardada — lleva los abonos y las
 * reprogramaciones reales. Si no, se deriva.
 */
export function tablaDe(prestamo) {
  const guardadas = prestamo?.cuotasAmortizacion
  if (guardadas?.length) {
    return [...guardadas].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
  }
  return derivarTabla(prestamo)
}
