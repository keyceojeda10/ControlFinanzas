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
import { fraccionInteres } from '@/lib/dinero/reparto'

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
  const fraccion = fraccionInteres(prestamo)

  let acumulado = 0
  const filas = []
  for (const g of pagos) {
    const monto = Number(g?.montoPagado) || 0
    const interes = usaTabla
      ? interesDelPagoSegunTabla(cuotas, acumulado, monto)
      : monto * fraccion
    filas.push({
      fecha: g?.fechaPago ? new Date(g.fechaPago) : null,
      monto,
      interes,
      // El capital sale POR RESTA, igual que en `repartoSql`: así
      // `interés + capital = lo pagado` siempre, y la plata no se pierde de vista.
      capital: monto - interes,
    })
    // El acumulado avanza SIEMPRE, esté el pago dentro de la ventana o no.
    acumulado += monto
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
    select: { montoPagado: true, fechaPago: true },
  },
}
