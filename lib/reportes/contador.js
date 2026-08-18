/* ══ EL INFORME PARA EL CONTADOR ═════════════════════════════════════════════
 *
 * Pedido por Miguel Ángel (Préstamos Rincón) por el banner, 15 ago 2026:
 *
 *   «Sería bueno tener un extracto de gastos contra utilidad y utilidades
 *    contra capital recuperado, para quienes estamos cerca a topes de declarar
 *    y así poder saber cuál es el capital recuperado y las utilidades
 *    obtenidas.»
 *
 * ── LA CUENTA, Y POR QUÉ NO ES LA OBVIA ─────────────────────────────────────
 *
 * ⚠ LA UTILIDAD NO ES «LO RECAUDADO MENOS LOS GASTOS». Es la regla más cara de
 *   esta base y ya se rompió una vez: analíticas inflaba la ganancia 7,9 veces
 *   y escondía cinco negocios que en realidad iban en pérdida. De lo que entra
 *   por la ventanilla, la mayor parte es CAPITAL que ya era del prestamista y
 *   está volviendo; ganancia es solo el interés.
 *
 *       utilidad = interés cobrado − gastos       ← esto
 *       utilidad = recaudado − gastos             ← nunca
 *
 * ⚠ Y EL INTERÉS NO SE REPARTE POR PROPORCIÓN. `interesPagoAPago` le pregunta a
 *   la tabla de amortización cuánto interés reconoce cada pago. En «sobre
 *   saldo» las primeras cuotas son casi todo interés, y repartir a prorrata se
 *   queda corto — en el negocio de Rincón, $141.889 contra $232.119 reales.
 *
 * ⚠ HACEN FALTA TODOS LOS PAGOS DEL PRÉSTAMO, no solo los del período: el
 *   interés de un pago depende de por dónde iba la tabla cuando entró. Con solo
 *   los del mes, el primero se calcula como si fuera el primero de todos.
 *
 * Aquí no se toca la base: entra lo ya leído y sale la cuenta, para poder
 * comprobarla con números a mano.
 */

import { interesPagoAPago } from '@/lib/dinero/interes-cobrado'
import { calcularGananciaNeta } from '@/lib/calculos'

/** Los períodos que ofrece el informe, y cuántos meses ocupa cada uno. */
export const PERIODOS_CONTADOR = {
  mes:       { meses: 1,  rotulo: 'Mes' },
  trimestre: { meses: 3,  rotulo: 'Trimestre' },
  semestre:  { meses: 6,  rotulo: 'Semestre' },
  anio:      { meses: 12, rotulo: 'Año' },
}

/**
 * De qué día a qué día va el período, cortado en la hora del país.
 *
 * ⚠ LOS MESES SE CORTAN EN BOGOTÁ, NO EN UTC. Producción va en UTC y el
 * portátil en Bogotá: si se corta con los métodos locales, un pago del 1 a las
 * 00:30 cae en el mes anterior en una máquina y no en la otra, y el fallo es
 * invisible en local. La aritmética va en UTC sobre el instante ya corrido.
 *
 * @param {string} periodo   clave de PERIODOS_CONTADOR
 * @param {number} offsetHoras  horas que hay que restar (5 en Colombia)
 * @param {Date}   ahora
 */
export function rangoDePeriodo(periodo, offsetHoras = 5, ahora = new Date()) {
  const meses = PERIODOS_CONTADOR[periodo]?.meses ?? 1
  const ms = Math.abs(offsetHoras) * 3600000
  const local = new Date(ahora.getTime() - ms)

  // El primero del mes en que estamos, a las 00:00 del país.
  const finLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1)
  const iniLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1 - meses, 1)

  return { desde: new Date(iniLocal + ms), hasta: new Date(finLocal + ms) }
}

/* ══ EL RANGO QUE ESCRIBE EL PRESTAMISTA ═════════════════════════════════════
 *
 * «Cómo ver cuánto gané de interés de una fecha a otra fecha.» — Crediya.
 *
 * Los períodos armados (mes, trimestre, semestre, año) TODOS acaban hoy: no se
 * podía pedir «del 1 al 15 de julio» ni «el mes pasado». Esto lee `desde`/`hasta`
 * de la petición y devuelve null si no vienen los dos, para que el llamador caiga
 * en su período de siempre.
 *
 * ⚠ `hasta` SE CIERRA AL DÍA SIGUIENTE. Las consultas usan `lt: hasta`, así que
 * pasar el día tal cual dejaría fuera todo lo cobrado ESE día: pedir «del 1 al
 * 15» perdería el 15 entero. Es el mismo convenio del resto del proyecto —los
 * días empiezan a las 00:00 del país— y por eso vive aquí y no copiado en cada
 * informe. */
export function rangoManual(searchParams, offsetHoras = 5) {
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')
  const bien = (t) => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t)
  if (!bien(desde) || !bien(hasta)) return null

  const ms = Math.abs(offsetHoras) * 3600000
  const d = new Date(`${desde}T00:00:00.000Z`).getTime() + ms
  const h = new Date(`${hasta}T00:00:00.000Z`).getTime() + ms + 86400000
  if (!Number.isFinite(d) || !Number.isFinite(h) || h <= d) return null
  return { desde: new Date(d), hasta: new Date(h) }
}

/** La clave del mes al que pertenece un instante, en la hora del país. */
export function claveMes(fecha, offsetHoras = 5) {
  const d = new Date(new Date(fecha).getTime() - Math.abs(offsetHoras) * 3600000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * La cuenta del contador.
 *
 * @param {object} e
 * @param {Array}  e.prestamos  con `cuotasAmortizacion` y TODOS sus `pagos`
 * @param {Array}  e.gastos     `{ monto, fecha }`, ya filtrados a aprobados
 * @param {Date}   e.desde
 * @param {Date}   e.hasta      exclusivo
 * @param {number} e.offsetHoras
 */
export function calcularContador({ prestamos = [], gastos = [], desde, hasta, offsetHoras = 5 }) {
  const meses = new Map()
  const mesDe = (k) => {
    if (!meses.has(k)) meses.set(k, { mes: k, interes: 0, capital: 0, gastos: 0 })
    return meses.get(k)
  }

  let interes = 0, capitalRecuperado = 0
  for (const pr of prestamos) {
    for (const fila of interesPagoAPago({ prestamo: pr, cuotas: pr.cuotasAmortizacion, pagos: pr.pagos })) {
      // Los de fuera del período ya cumplieron su papel: mover el acumulado.
      if (!fila.fecha || fila.fecha < desde || fila.fecha >= hasta) continue
      interes += fila.interes
      capitalRecuperado += fila.capital
      const m = mesDe(claveMes(fila.fecha, offsetHoras))
      m.interes += fila.interes
      m.capital += fila.capital
    }
  }

  let totalGastos = 0
  for (const g of gastos) {
    const f = new Date(g.fecha)
    if (f < desde || f >= hasta) continue
    totalGastos += g.monto || 0
    mesDe(claveMes(f, offsetHoras)).gastos += g.monto || 0
  }

  const utilidad = calcularGananciaNeta({ interesCobrado: interes, gastos: totalGastos })

  return {
    // Lo que entró por la ventanilla, partido en sus dos mitades.
    recaudado: Math.round(interes + capitalRecuperado),
    interes: Math.round(interes),
    capitalRecuperado: Math.round(capitalRecuperado),

    gastos: Math.round(totalGastos),
    utilidad,

    /* ⚠ LOS DOS PORCENTAJES DEVUELVEN `null`, NO CERO, CUANDO NO SE PUEDEN
       CALCULAR. Un mes sin interés cobrado no es «los gastos fueron el 0% de la
       utilidad»: es que la pregunta no tiene respuesta. Escribir 0% en un papel
       que va al contador es peor que dejar el hueco. */
    porcentajeGastos: interes > 0 ? Math.round((totalGastos / interes) * 1000) / 10 : null,
    utilidadSobreCapital: capitalRecuperado > 0
      ? Math.round((utilidad / capitalRecuperado) * 1000) / 10
      : null,

    meses: [...meses.values()]
      .map((m) => ({
        ...m,
        interes: Math.round(m.interes),
        capital: Math.round(m.capital),
        gastos: Math.round(m.gastos),
        utilidad: calcularGananciaNeta({ interesCobrado: m.interes, gastos: m.gastos }),
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes)),
  }
}
