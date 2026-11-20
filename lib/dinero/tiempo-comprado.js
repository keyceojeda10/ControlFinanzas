/* ══ EL TIEMPO QUE COMPRÓ EL INTERÉS (19 nov 2026) ══════════════════════════════
 *
 * «Tengo clientes que en la quincena no me pueden dar la cuota, pero me dan el
 *  interés. Recibo el interés hoy y la cuota queda para la próxima quincena, pero
 *  sigue siendo igual.» — un prestamista, 16 ago 2026.
 *
 * Eso es, exactamente, EL MISMO PRÉSTAMO CORRIDO UN PERÍODO, con la plata del
 * interés aparte: las cuotas no cambian, ninguna se da por pagada con ese interés,
 * y todo el calendario (primer cobro, vencimiento, cuotas) llega un período más
 * tarde. Así se calcula aquí, una sola vez, y todas las cuentas del calendario
 * (próximo cobro, días y plata en mora, ponerse al día, la tabla) leen el
 * préstamo ya corrido.
 *
 * ANTES era una sola fecha (`proximoCobroManual` + `proximoCobroPorInteres`):
 *   · el segundo interés volvía a comprar el MISMO período (Vladimir, Leyder);
 *   · el siguiente pago NORMAL la borraba (`refrescarTotalesPrestamo`), y el
 *     cliente que había comprado tres semanas volvía a salir tres cuotas atrás
 *     (Jhon Jairo, Prestamos juan). 69 préstamos, 18 activos;
 *   · el interés se sumaba a lo pagado y al total, y la tabla derivada partía
 *     ese total inflado entre las cuotas.
 *
 * Solo corre en los préstamos con `periodosComprados > 0`: para todos los demás
 * devuelve el MISMO objeto, sin copiar. Es idempotente (la marca evita correrlo
 * dos veces cuando una cuenta llama a otra). */
import { siguientePeriodo, fechaDePeriodo, obtenerDiasPorPeriodo } from './calendario.js'

const MARCA = '__tiempoComprado'

export function conTiempoComprado(prestamo) {
  const n = Math.max(0, Math.trunc(Number(prestamo?.periodosComprados) || 0))
  if (n === 0 || prestamo[MARCA]) return prestamo
  const freq = prestamo.frecuencia || 'diario'
  /* N COBROS DE SU PROPIO CALENDARIO, no N veces «+15 días». Con días fijos del
   * mes (quincenal del 10, mensual del 5) correr la fecha de inicio a mano se
   * salía de la cuadrícula: lo midió el espejo con Geovanny (Leyder). El
   * calendario que arma las cuotas es `fechaDePeriodo`; la fecha del cobro N es
   * el nuevo inicio, y el cobro 1 del préstamo corrido cae en el N+1 del
   * original. En diario, un período es un día. */
  const opciones = {
    fechaInicio: prestamo.fechaInicio, freq, diasPeriodo: obtenerDiasPorPeriodo(freq),
    diaCobroMes: Number.isInteger(prestamo.diaCobroMes) ? prestamo.diaCobroMes : null,
    diaCobroMes2: Number.isInteger(prestamo.diaCobroMes2) ? prestamo.diaCobroMes2 : null,
    diaCobroSemana: Number.isInteger(prestamo.diaCobroSemana) ? prestamo.diaCobroSemana : null,
    primerCobro: prestamo.primerCobro ? new Date(prestamo.primerCobro) : null,
  }
  const enSuCalendario = (k) => fechaDePeriodo(k, opciones)
  const corre = (fecha) => {
    if (!fecha) return fecha
    let x = new Date(fecha)
    if (Number.isNaN(x.getTime())) return fecha
    for (let i = 0; i < n; i++) x = siguientePeriodo(x, freq, prestamo.diaCobroMes, prestamo) ?? x
    return x
  }
  /* El inicio se corre lo que hay entre su cobro 1 y su cobro 1+N, y así
   * conserva la MISMA distancia a su primer cobro: puesto justo encima de un
   * cobro, las cuentas que cuentan días desde el inicio («ponerse al día»)
   * daban un período de más (Samuel Acosta, D&B, días 5 y 20). Mensual va por
   * meses del calendario, no por días. */
  const DIA = 86400000
  let inicio = corre(prestamo.fechaInicio)
  if (prestamo.fechaInicio && freq !== 'diario') {
    if (freq === 'mensual' && !opciones.primerCobro) inicio = enSuCalendario(n)
    else inicio = new Date(new Date(prestamo.fechaInicio).getTime() + Math.round((enSuCalendario(1 + n) - enSuCalendario(1)) / DIA) * DIA)
  }
  const interes = Math.max(0, Number(prestamo.interesComprado) || 0)
  return {
    ...prestamo,
    [MARCA]: true,
    fechaInicio: inicio,
    fechaFin: corre(prestamo.fechaFin),
    primerCobro: prestamo.primerCobro ? enSuCalendario(n + 1) : prestamo.primerCobro,
    // La plata del interés comprado queda fuera de las cuotas, en los dos lados:
    // el saldo (total − pagado) no cambia.
    totalAPagar: typeof prestamo.totalAPagar === 'number' ? prestamo.totalAPagar - interes : prestamo.totalAPagar,
    totalPagado: typeof prestamo.totalPagado === 'number' ? prestamo.totalPagado - interes : prestamo.totalPagado,
    pagos: Array.isArray(prestamo.pagos) ? prestamo.pagos.filter((p) => !p?.compraPeriodo) : prestamo.pagos,
    // La fecha que guardaba el modelo viejo ya está dentro del corrimiento.
    proximoCobroManual: prestamo.proximoCobroPorInteres ? null : prestamo.proximoCobroManual,
    proximoCobroPorInteres: false,
  }
}

/** Los campos que tiene que pedir cualquier `select` de Prisma que vaya a pasar
 *  el préstamo por las cuentas del calendario. Sin ellos `conTiempoComprado` no
 *  hace nada y el cliente vuelve a salir atrasado EN SILENCIO. */
export const SELECT_TIEMPO_COMPRADO = { periodosComprados: true, interesComprado: true }
