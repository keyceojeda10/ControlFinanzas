/* ══ UN REVERSO SOLO DESHACE LO DE HOY ═══════════════════════════════════════
 *
 * Reportado por el dueño de PRESTA MIL el 21 ago 2026, sobre la ruta 8:
 *
 *   «El saldo general está malo, está sumando algo que no debe sumar. El valor
 *    de lo que debe entregar es totalmente correcto, que son 589 mil pesos. Ese
 *    saldo debería ser el que apareciera como base en caja.»
 *
 * La ruta decía **$775.000** y el cobrador entregaba **$589.000**. La diferencia
 * eran exactamente **$186.000**: el reverso del desembolso de JESÚS MALDONADO,
 * borrado esa noche.
 *
 * ── POR QUÉ ESTABA MAL ──────────────────────────────────────────────────────
 *
 * Ese préstamo se desembolsó el **24 de junio**. La plata salió hace dos meses,
 * se cuadró en su día, y el cliente se quedó con ella. Al borrar el préstamo,
 * el reverso la devolvía al capital **con fecha de hoy** — un dinero que no está
 * en ninguna parte: ni en la calle (el préstamo ya no existe) ni en la mano del
 * cobrador.
 *
 * Y la caja YA lo decía con todas las letras, en su propia pantalla:
 *
 *   «Volvió al capital de la ruta — No entra en la cuenta de arriba: esa plata
 *    no pasó por las manos del cobrador hoy.»
 *
 * O sea: la caja lo excluía bien y el capital de la ruta lo sumaba igual. Una de
 * las dos tenía que ceder, y la que sabía era la caja.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Un reverso deshace un movimiento del día ABIERTO. Los días cerrados ya se
 * contaron, se cuadraron y se entregaron: no se tocan hacia atrás.
 *
 * Vale para los dos lados y por eso vive en una sola función:
 *   · el desembolso que se devuelve al borrar,
 *   · y el recaudo que se quita.
 * Si un préstamo es de junio y le entró un pago hoy, al borrarlo se quita el
 * pago de hoy y NO se devuelve el desembolso de junio. Cada día responde por lo
 * suyo.
 *
 * ── LO QUE NO CAMBIA ────────────────────────────────────────────────────────
 *
 * Borrar el préstamo que se acaba de crear —el error de tecleo, que es el 55% de
 * los casos medidos— sigue devolviendo todo, porque todo pasó hoy.
 *
 * Medido en producción ese día: de 717 borrados con desembolso localizable, 383
 * eran del mismo día (correctos) y **296 de días anteriores** (metían plata que
 * ya había salido), repartidos en 36 negocios. En las rutas de PRESTA MIL pasaba
 * en 8 de las 10.
 */
import { getLocalDayRange, getUtcOffset } from '@/lib/i18n'

/**
 * ¿Ese movimiento ocurrió dentro del día que todavía está abierto?
 *
 * ⚠ El día local se calcula aquí con `getUtcOffset` en vez de llamar a
 *   `getLocalDate`, que lee `Date.now()` por dentro y no deja fijar el día. Sin
 *   poder fijarlo, la prueba pasaría hoy y fallaría mañana — ya me pasó esta
 *   semana con `calcularDiasMora`, que ignoraba el `HOY` que la prueba le daba.
 *
 * @param {Date|string|number} fecha  cuándo se registró el movimiento
 * @param {string} pais               país de la organización (define el corte)
 * @param {number} [ahora]            para poder fijar el día en las pruebas
 */
export function esDelDiaAbierto(fecha, pais, ahora = Date.now()) {
  if (!fecha) return false
  const hoy = new Date(ahora + getUtcOffset(pais) * 3600000).toISOString().slice(0, 10)
  const { inicio, fin } = getLocalDayRange(hoy, pais)
  const t = new Date(fecha).getTime()
  return t >= inicio.getTime() && t <= fin.getTime()
}

/**
 * De una lista de movimientos, los que un reverso puede deshacer hoy.
 * Los de días cerrados se devuelven aparte para poder DECIRLO, no para
 * esconderlos: el prestamista tiene que saber por qué su capital no subió.
 */
export function partirPorDia(movimientos = [], pais, ahora = Date.now()) {
  const deHoy = []
  const deAntes = []
  for (const m of movimientos) {
    /* Tres nombres para la misma pregunta: `createdAt` en los movimientos de
       capital, `fecha` en los gastos y `fechaPago` en los pagos. Quedarse con
       uno dejaba fuera a los otros dos EN SILENCIO — todos irían al montón de
       «días cerrados» sin que nada reventara. */
    const cuando = m?.createdAt ?? m?.fecha ?? m?.fechaPago
    ;(esDelDiaAbierto(cuando, pais, ahora) ? deHoy : deAntes).push(m)
  }
  return { deHoy, deAntes }
}
