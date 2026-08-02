// ═══════════════════════════════════════════════════════════════════════════
// CUÁNTO DE LO COBRADO ES GANANCIA Y CUÁNTO ES TU PLATA VOLVIENDO
//
// ── LA PREGUNTA ───────────────────────────────────────────────────────────
//
// Prestaste $500.000 y vas a cobrar $600.000. El cliente te ha pagado
// $300.000. ¿Cuánto de eso era interés y cuánto era tu capital regresando?
//
// De la respuesta salen «capital en la calle» —la cifra con la que decides si
// puedes prestar más—, la ganancia del mes, el ROI y el reparto a los socios.
//
// ── LAS DOS CONVENCIONES, Y POR QUÉ HAY QUE ELEGIR ────────────────────────
//
//   CASCADA       primero se cobra TODO el interés. Hasta que no entren los
//                 $100.000, el capital no baja un peso. → quedan $300.000
//   PROPORCIONAL  cada peso lleva su parte: 5/6 capital, 1/6 interés.
//                 → quedan $250.000
//
// Las dos son defendibles y las dos existían en el código a la vez, bajo el
// MISMO rótulo. Medido sobre la cartera real el 1 ago 2026:
//
//     capital en la calle, proporcional ....  $3.306.304.236
//     capital en la calle, cascada .........  $3.570.918.455   (8,0% más)
//     Σ montoPrestado, la fórmula vieja ....  $4.014.989.950  (21,4% más)
//
// **Decidido: PROPORCIONAL para reportar.** Es lo que dice la tabla de
// amortización que la app ya imprime y el cliente ya firmó; hace que
// «capital pendiente + lo que falta por ganar = cartera» cuadre en todos los
// modos; y no cuenta como ganada plata que todavía no se ganó.
//
// Para LIQUIDAR —qué debe si cierra hoy— el prestamista sigue eligiendo entre
// las dos, que es lo que `calcularLiquidacionAnticipada` ya hace bien
// devolviendo las dos modalidades. Son dos preguntas distintas.
//
// ── LA TABLA MANDA SOBRE LAS DOS ──────────────────────────────────────────
//
// Cuando el préstamo TIENE tabla de amortización, ninguna convención hace
// falta: la tabla dice exactamente cuánto interés lleva cada cuota. En un
// Decreciente el interés del primer periodo se calcula sobre el saldo completo
// y es mucho mayor que el del último, así que repartir proporcionalmente lo
// subestima. Un cliente lo reportó con números: la tabla decía $7.742 de
// interés en el mes 1 y analíticas registraba $6.896.
//
// Medido sobre los 295 préstamos con tabla: el proporcional subestimaba la
// ganancia en $7.690.180, un 27,3%.
//
// ── CUANDO SE COBRÓ MENOS DE LO QUE SE PRESTÓ ─────────────────────────────
//
// Hay 850 préstamos en producción con `totalAPagar < montoPrestado`. No es un
// caso raro y no es una condonación: solo 35 tienen una fila de descuento o
// liquidación. Lo que hay es esto —medido el 1 ago 2026—:
//
//     758 de los 850 tienen `totalPagado == totalAPagar`
//     615 de los 850 son del mismo negocio (el de los 10 cobradores)
//
// O sea: el préstamo se cerró **reescribiendo `totalAPagar` hacia abajo hasta
// lo que el cliente había pagado**. Prestó $1.500.000, recogió $900.000, y
// cerró. Perdió $600.000 de su propia plata.
//
// Los dos repartos que convivían contestaban distinto, y los dos mal:
//
//   el SQL      repartía proporcionalmente con una fracción NEGATIVA, así que
//               registraba **−$118.964.543 de «interés»** repartidos a lo
//               largo de 4.027 pagos
//   el JS       exigía `total > capital` y mandaba el pago entero a capital:
//               **$0**, la pérdida no aparece por ningún lado
//
// **Eso no es interés negativo: es capital que no volvió.** Y disolverlo en el
// interés tiene dos consecuencias feas: la ganancia de meses en los que no
// pasó nada malo baja retroactivamente el día que alguien cierra el préstamo,
// y la pérdida —que es el dato que importa— no tiene nombre en ninguna
// pantalla.
//
// Aquí la fracción de interés se **acota a [0, 1]** y el faltante sale por
// `capitalPerdido()`, con su propio rótulo. Interés es interés; pérdida es
// pérdida.
//
// ── POR QUÉ ESTO ES UN MÓDULO ─────────────────────────────────────────────
//
// Porque el reparto estaba escrito A MANO en NUEVE sitios: cuatro en SQL y
// cinco en JavaScript. Cuatro de ellos aplicaban la corrección por tabla y
// cinco no, así que la misma pregunta daba respuestas distintas en la misma
// pantalla. `repartoSql()` existe para que el sitio que calcula en SQL use LA
// MISMA definición: una fuente, dos lenguajes.
// ═══════════════════════════════════════════════════════════════════════════

import {
  tieneTablaAmortizacion,
  interesAcumuladoTabla,
} from '../calculos.js'

export const METODO = Object.freeze({
  TABLA: 'tabla',
  PROPORCIONAL: 'proporcional',
})

const redondo = (n) => Math.round(Number(n) || 0)

/** Con qué método se reparte este préstamo. La tabla manda si la hay. */
export function metodoDe(prestamo) {
  return tieneTablaAmortizacion(prestamo) ? METODO.TABLA : METODO.PROPORCIONAL
}

/**
 * Qué parte de cada peso cobrado es interés. Entre 0 y 1, SIEMPRE.
 *
 * El tope de 1 y el suelo de 0 no son paranoia defensiva: los dos casos existen
 * en producción y cada uno tenía su propia respuesta escrita a mano.
 *
 *   totalAPagar <= 0 ......... 56 préstamos, 8 pagos, $793.000. El SQL los
 *                              excluía del capital recuperado —esa plata
 *                              desaparecía de la cifra— y el JS los contaba
 *                              enteros como capital. Lo correcto es capital.
 *   totalAPagar < monto ...... 850 préstamos, 4.027 pagos. Ver la cabecera:
 *                              es capital perdido, no interés negativo.
 */
export function fraccionInteres(prestamo) {
  const total = Number(prestamo?.totalAPagar) || 0
  const monto = Number(prestamo?.montoPrestado) || 0
  if (total <= 0) return 0
  return Math.min(1, Math.max(0, (total - monto) / total))
}

/**
 * LO QUE YA SE SABE QUE NO VUELVE.
 *
 * Cuando el préstamo se cerró cobrando menos de lo prestado, la diferencia no
 * es «interés negativo»: es plata del prestamista que se quedó en la calle y ya
 * nadie va a traer. Tiene que poder decirse así, con su rótulo, en vez de
 * restarse en silencio de la ganancia de un mes cualquiera.
 */
export function capitalPerdido(prestamo) {
  if (!prestamo) return 0
  const total = Number(prestamo.totalAPagar) || 0
  const monto = Number(prestamo.montoPrestado) || 0
  if (total <= 0 || total >= monto) return 0
  return redondo(monto - total)
}

/**
 * De TODO lo pagado hasta hoy, cuánto fue interés y cuánto capital devuelto.
 *
 * Los pagos que el prestamista ETIQUETÓ van aparte, los dos: dijo «esto es
 * capital» o «esto es interés» y se respeta. Sólo se reparte lo demás.
 */
export function repartirPagado(prestamo) {
  if (!prestamo) return { capital: 0, interes: 0, metodo: METODO.PROPORCIONAL }

  const monto = Number(prestamo.montoPrestado) || 0
  const pagadoTotal = Number(prestamo.totalPagado) || 0
  const pagos = prestamo.pagos ?? []

  // Los abonos a capital bajan capital directo, sin repartirse.
  const abonos = Math.min(
    pagos
      .filter((p) => p.tipo === 'capital')
      .reduce((a, p) => a + (Number(p.montoPagado) || 0), 0),
    monto,
  )

  // ── Y LOS PAGOS DE SOLO INTERÉS, IGUAL PERO DEL OTRO LADO ────────────────
  //
  // Un pago de interés es 100% interés POR DEFINICIÓN — el prestamista lo dijo
  // al registrarlo. Si entrara al reparto proporcional, de $100.000 de puro
  // interés el sistema anotaría ~83.000 como «capital devuelto» y la cartera
  // diría que salió plata a la calle que sigue afuera. Es el espejo exacto del
  // fallo que obligó a sacar los abonos a capital de la cascada.
  //
  // NO es «inventar el reparto» de `06-ADENDA-modos-sin-tabla.md`: esa regla
  // prohíbe ADIVINAR cuánto de un pago normal fue interés. Aquí no se adivina
  // nada, está declarado — el mismo motivo por el que `capital` ya se respeta
  // sin tabla.
  const soloInteres = pagos
    .filter((p) => p.tipo === 'intereses')
    .reduce((a, p) => a + (Number(p.montoPagado) || 0), 0)

  const aRepartir = Math.max(0, pagadoTotal - abonos - soloInteres)

  if (tieneTablaAmortizacion(prestamo)) {
    const interes = interesAcumuladoTabla(prestamo.cuotasAmortizacion, aRepartir)
    return {
      capital: redondo(aRepartir - interes + abonos),
      interes: redondo(interes + soloInteres),
      metodo: METODO.TABLA,
    }
  }

  // Cada peso lleva su parte.
  //
  // ⚠ SE REDONDEA UNA SOLA VEZ Y LA OTRA SALE POR RESTA.
  //
  // Redondear las dos por separado INVENTA PESOS: con $12.345 pagados de un
  // 500.000/600.000, el capital da 10.287,5 y el interes 2.057,5; redondeando
  // los dos hacia arriba salen 10.288 + 2.058 = 12.346. Un peso de la nada, en
  // una cifra que se suma sobre miles de pagos.
  //
  // Se redondea el INTERES y el capital sale por resta, que es el mismo orden
  // que usa `repartoSql()`. Si cada lenguaje redondeara por su lado, las dos
  // pantallas volverían a diferir por pesos sueltos.
  //
  // Lo cazo la prueba «capital + interés es exactamente lo pagado».
  const interes = redondo(aRepartir * fraccionInteres(prestamo))
  return {
    capital: aRepartir - interes + abonos,
    interes: interes + soloInteres,
    metodo: METODO.PROPORCIONAL,
  }
}

/**
 * TU PLATA QUE SIGUE EN LA CALLE. Lo prestado menos lo que ya volvió.
 *
 * Nunca por encima de lo que falta cobrar: si un préstamo lleva recargos, el
 * capital vivo no puede pasarse del saldo pendiente.
 */
export function capitalEnCalle(prestamo) {
  if (!prestamo) return 0
  const monto = Number(prestamo.montoPrestado) || 0
  const total = Number(prestamo.totalAPagar) || 0
  const { capital } = repartirPagado(prestamo)
  const restante = Math.max(0, monto - capital)

  // ⚠ El tope se aplica SIEMPRE que haya un total pactado, y la guarda mira
  // `total`, no el saldo.
  //
  // Aqui decia `Math.min(restante, saldo || restante)`, y un saldo de CERO
  // —que es lo que tiene un prestamo pagado del todo— es falsy: caia al
  // `restante` y el prestamo cerrado seguia declarando capital en la calle.
  // Sobre los 758 cerrados por debajo de lo prestado eso son cientos de
  // millones de capital fantasma. Es el mismo fallo que la guarda que comparaba
  // el texto "$0": un cero de verdad tratado como «no hay dato».
  if (total <= 0) return redondo(restante)
  const saldo = Math.max(0, total - (Number(prestamo.totalPagado) || 0))
  return redondo(Math.min(restante, saldo))
}

/** Lo que ya ganaste de este préstamo: el interés efectivamente cobrado. */
export function interesGanado(prestamo) {
  return repartirPagado(prestamo).interes
}

/**
 * LO QUE FALTA POR GANAR si el cliente termina de pagar.
 *
 * Con esto se cumple la identidad que la ficha de ruta ya usa y que hasta
 * ahora solo cuadraba de casualidad:
 *
 *     capital en la calle + por ganar = saldo pendiente
 */
export function porGanar(prestamo) {
  if (!prestamo) return 0
  const saldo = Math.max(0, (Number(prestamo.totalAPagar) || 0) - (Number(prestamo.totalPagado) || 0))
  return redondo(Math.max(0, saldo - capitalEnCalle(prestamo)))
}

/**
 * El MISMO reparto, en SQL, para el sitio que agrega en la base.
 *
 * Analíticas, el PDF y el reparto a socios calculan con `SUM(...)` sobre miles
 * de filas y traerlas a JavaScript sería absurdo. Pero tener la fórmula escrita
 * dos veces es como empezó todo esto, así que sale de aquí.
 *
 * ⚠ Es el reparto PROPORCIONAL puro. Los préstamos con tabla necesitan la
 * corrección aparte —el SQL no puede recorrer las cuotas— y por eso los
 * llamadores le suman `correccionTablaPorMes`. Que la corrección se aplicara en
 * unos sitios sí y en otros no es lo que hacía que la misma pantalla enseñara
 * dos «ganancia del mes» distintas.
 *
 * Dos cosas que las copias a mano hacían distinto, y aquí no:
 *
 *   1. `GREATEST(0, LEAST(1, ...))` — la misma cota que `fraccionInteres`. Sin
 *      ella, los 850 préstamos cerrados por debajo de lo prestado metían
 *      −$118.964.543 de «interés» en la ganancia.
 *   2. El capital sale POR RESTA del pago, no de una segunda división. Así
 *      `interes + capital = montoPagado` siempre —incluido `totalAPagar <= 0`,
 *      donde las copias devolvían capital CERO y perdían la plata de vista— y
 *      el redondeo cae del mismo lado que en JavaScript.
 *
 * @param pago      alias de la tabla Pago
 * @param prestamo  alias de la tabla Prestamo
 */
export function repartoSql({ pago = 'p', prestamo = 'pr', monto = 'montoPagado' } = {}) {
  const frac = `GREATEST(0, LEAST(1, (${prestamo}.totalAPagar - ${prestamo}.montoPrestado) / ${prestamo}.totalAPagar))`
  // Un pago ETIQUETADO como interés es 100% interés y no se reparte, igual que
  // en `repartirPagado`. Aquí sale más limpio porque el SQL va fila por fila:
  // no hay que restarlo del total, se contesta en la propia fila.
  //
  // Si esto faltara, la ganancia del mes en analíticas y en el PDF diría una
  // cosa y la ficha del préstamo otra, sobre el mismo pago.
  const interes = `CASE WHEN ${pago}.tipo = 'intereses' THEN ${pago}.${monto} `
    + `WHEN ${prestamo}.totalAPagar > 0 THEN ${pago}.${monto} * ${frac} ELSE 0 END`
  return {
    interes,
    capital: `(${pago}.${monto} - (${interes}))`,
  }
}
