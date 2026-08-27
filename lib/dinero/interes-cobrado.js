/* ══ CUÁNTO INTERÉS SE GANÓ EN UN TRAMO DE FECHAS ════════════════════════════
 *
 * Reportado por Miguel Ángel (Préstamos Rincón) el 12 ago 2026, con las dos
 * cifras copiadas de su pantalla:
 *
 *   «1) Dashboard: intereses cobrado del mes $135.417 […] 2) Cómo va mi
 *    negocio: ganancias del mes $215.019. En estas dos secciones solo la
 *    segunda es correcta.»
 *
 * Tenía razón en cuál, aunque no en el porqué —lo atribuyó a los gastos, y los
 * gastos estaban en cero—. La diferencia es otra:
 *
 *   · El DASHBOARD repartía cada pago por la PROPORCIÓN del préstamo entero,
 *     `(total − prestado) / total`. Sirve para los modos sin tabla.
 *   · ANALÍTICAS hace eso y además CORRIGE los préstamos con tabla de
 *     amortización con el interés que dice la tabla.
 *
 * Y en un préstamo francés («saldo») esa diferencia es enorme: las primeras
 * cuotas son casi todo interés, no la fracción plana del préstamo completo.
 * Reproducido al peso contra su base: $135.417 y $215.019, y los $79.602 de
 * diferencia salen de sus siete préstamos en modo `saldo`.
 *
 * ⚠ POR QUÉ VIVE AQUÍ Y NO EN CADA PANTALLA. La cuenta ya estaba escrita dos
 *   veces —una en analíticas y otra, incompleta, en el dashboard— y por eso la
 *   misma ganancia del mismo mes salía distinta según dónde la mirara. La
 *   fórmula de un solo sitio es lo que impide que vuelvan a separarse; que
 *   digan lo mismo lo fija `dos-pantallas-una-ganancia.test.js`, no la buena
 *   voluntad.
 *
 * Medido: 17 negocios tienen préstamos con tabla cobrando este mes, así que a
 * 17 se les movía la cifra.
 */

import { interesDelPagoSegunTabla } from '@/lib/calculos'
import { fraccionInteres, techoDeInteres } from '@/lib/dinero/reparto'

/** Los modos que llevan tabla de amortización y por tanto se corrigen. */
export const MODOS_CON_TABLA = ['lineal', 'solo_interes', 'lineal_dinamico', 'saldo']

/**
 * Interés ganado por UN préstamo con los pagos que caen dentro de la ventana.
 *
 * ⚠ Los pagos ANTERIORES a la ventana también hacen falta: el interés de un
 *   pago depende de cuánto se llevaba pagado antes (por dónde va la tabla). Si
 *   solo se pasan los del mes, el primero se calcula como si fuera el primero
 *   del préstamo y sale de más.
 *
 * @param {object} p
 * @param {object} p.prestamo   { montoPrestado, totalAPagar, modoInteres }
 * @param {Array}  [p.cuotas]   filas de la tabla, ordenadas por periodo. Sin
 *                              ellas se usa la proporción, que es lo correcto
 *                              para los modos sin tabla.
 * @param {Array}  p.pagos      TODOS sus pagos reales, ordenados por fecha
 * @param {Date}   [p.desde]    inclusive; sin fecha, cuenta todos
 * @param {Date}   [p.hasta]    inclusive
 * @returns {number} interés, sin redondear
 */
export function interesCobradoDelPrestamo({ prestamo, cuotas = null, pagos = [], desde = null, hasta = null }) {
  let interes = 0
  for (const p of interesPagoAPago({ prestamo, cuotas, pagos })) {
    const dentro = (!desde || (p.fecha && p.fecha >= desde)) && (!hasta || (p.fecha && p.fecha <= hasta))
    if (dentro) interes += p.interes
  }
  return interes
}

/**
 * Lo mismo, pero PAGO A PAGO.
 *
 * Hace falta para repartir por días o por meses: un total no se puede volver a
 * partir, porque el interés de cada pago depende de por dónde iba la tabla
 * cuando entró. Con el total del mes no hay forma de saber cuánto puso el día 3
 * y cuánto el día 20.
 *
 * ⚠ VIVE JUNTO AL TOTAL Y ESTE LO USA. Es la misma cuenta: si se escribiera
 *   aparte, el desglose por días podría no sumar el total del mes que se enseña
 *   encima — que es exactamente el error que este archivo existe para no repetir.
 *
 * @returns {Array<{fecha: Date|null, monto: number, interes: number, capital: number}>}
 */
export function interesPagoAPago({ prestamo, cuotas = null, pagos = [] }) {
  const usaTabla = Array.isArray(cuotas) && cuotas.length > 0
    && MODOS_CON_TABLA.includes(prestamo?.modoInteres)

  /* ── ⚠ LOS DOS TIPOS DECLARADOS NO SE REPARTEN ────────────────────────────
   *
   * Un ABONO A CAPITAL es 100% capital y un pago de SOLO INTERÉS es 100%
   * interés: lo dijo el prestamista al registrarlo, no hay nada que adivinar.
   * No es «inventar el reparto» de `06-ADENDA-modos-sin-tabla.md`: esa regla
   * prohíbe adivinar cuánto de un pago NORMAL fue interés.
   *
   * `repartirPagado` ya los sacaba —es el fallo del abono a capital en Globo,
   * donde la cascada se comía el abono en intereses y el capital casi no
   * bajaba— y esta función nunca se enteró. Por eso las dos pantallas partían
   * el mismo pago de dos formas distintas.
   *
   * Lo cazó Crediya el 25 ago 2026 haciendo la resta a mano: «en los intereses
   * ganados aparecen 1.586.706, en toda tu plata ¿no debería decir
   * 51.586.706?». Le faltaban $597.461, y $97.461 eran justo esto: sus
   * $171.000 de abonos a capital pasando por la tabla y saliendo con interés
   * encima.
   *
   * Medido en el espejo: 49 abonos a capital por $22.875.665 en 16 negocios, y
   * 61 pagos de solo interés por $13.721.200 en 19.
   *
   * ⚠ Y EL ACUMULADO NO AVANZA CON ELLOS. Marca por dónde va la tabla para los
   * pagos corrientes, y `repartirPagado` los deja fuera de `aRepartir` por lo
   * mismo: si avanzaran, empujarían a los siguientes a un tramo de la tabla que
   * no les toca. */
  const soloInteres = pagos
    .filter((g) => g?.tipo === 'intereses')
    .reduce((a, g) => a + (Number(g?.montoPagado) || 0), 0)

  /* La fracción mira el préstamo COMO SE PACTÓ. Sin tabla, cobrar interés
     aparte SUBE `totalAPagar`, y con el total inflado los pagos viejos se
     vuelven a repartir con una fracción que nunca existió. Es la misma resta
     que hacen `repartirPagado` y `repartoSql`. */
  const fraccion = usaTabla
    ? 0
    : fraccionInteres({ ...prestamo, totalAPagar: (Number(prestamo?.totalAPagar) || 0) - soloInteres })

  /* ⚠ EL TECHO DEL PRÉSTAMO, REPARTIDO EN ORDEN. Nadie puede ganar más de lo
     que pactó cobrar por encima de lo prestado, y la tabla puede describir un
     calendario que ya no rige: una LIQUIDACIÓN ANTICIPADA baja `totalAPagar`
     —se le perdona el interés futuro— y no reescribe las cuotas.

     Crediya, 26 ago 2026: prestó $900.000 a Jose Bermejo, le perdonó TODO el
     interés al liquidar, el cliente devolvió $900.000 y el informe le contaba
     $283.479 de ganancia. Ver `techoDeInteres`.

     Se descuenta pago a pago y no al final: este desglose se usa para repartir
     por días y por meses, y un tope aplicado al total no se puede volver a
     partir. */
  let queda = Math.max(0, techoDeInteres(prestamo) - soloInteres)

  let acumulado = 0
  const filas = []
  for (const g of pagos) {
    const monto = Number(g?.montoPagado) || 0
    const declarado = g?.tipo === 'capital' ? 0 : (g?.tipo === 'intereses' ? monto : null)
    let interes = declarado != null
      ? declarado
      : (usaTabla ? interesDelPagoSegunTabla(cuotas, acumulado, monto) : monto * fraccion)
    /* El pago DECLARADO como interés no pasa por el techo: ya se restó de él
       arriba, y volver a toparlo lo dejaría en cero. */
    if (declarado == null) {
      interes = Math.min(interes, queda)
      queda -= interes
    }
    filas.push({
      fecha: g?.fechaPago ? new Date(g.fechaPago) : null,
      monto,
      /* El tipo viaja con la fila para que quien compare este reparto con el
         proporcional no tenga que volver a buscar el pago. Lo usa la corrección
         de analíticas, que enfrenta las dos formas de partir el mismo peso. */
      tipo: g?.tipo ?? null,
      interes,
      // El capital sale POR RESTA, igual que en `repartoSql`: así
      // `interés + capital = lo pagado` siempre, y la plata no se pierde de vista.
      capital: monto - interes,
    })
    // El acumulado avanza esté el pago dentro de la ventana o no, pero SOLO con
    // los pagos corrientes: los declarados no mueven la tabla.
    if (declarado == null) acumulado += monto
  }
  return filas
}

/**
 * Lo mismo para una lista de préstamos ya cargados con sus cuotas y sus pagos.
 * @returns {number} interés redondeado
 */
export function interesCobradoDeLosPrestamos(prestamos = [], { desde = null, hasta = null } = {}) {
  let total = 0
  for (const p of prestamos) {
    total += interesCobradoDelPrestamo({
      prestamo: p,
      cuotas: p.cuotasAmortizacion ?? null,
      pagos: p.pagos ?? [],
      desde, hasta,
    })
  }
  return Math.round(total)
}

/** El `select` de Prisma que esto necesita. Que no se desvíen. */
export const SELECT_PARA_INTERES = {
  id: true,
  montoPrestado: true,
  totalAPagar: true,
  modoInteres: true,
  cuotasAmortizacion: {
    orderBy: { numeroPeriodo: 'asc' },
    select: { numeroPeriodo: true, cuotaTotal: true, interes: true },
  },
  pagos: {
    where: { tipo: { notIn: ['recargo', 'descuento'] } },
    orderBy: { fechaPago: 'asc' },
    /* ⚠ `tipo` NO SE PEDÍA, y sin él `interesPagoAPago` no puede distinguir un
       abono a capital de un cobro corriente: llega `undefined`, el predicado no
       acierta NUNCA y el reparto vuelve a ser el viejo — sin un error, sin un
       log y sin una prueba en rojo. Es la misma trampa que ya dejó cuatro días
       muerta la exclusión de reversos en la caja. */
    select: { montoPagado: true, fechaPago: true, tipo: true },
  },
}
