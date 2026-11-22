/* ══ COBRAR MORA SIN HABERLA CONFIGURADO (21 nov 2026) ═══════════════════════
 *
 * Un prestamista, con un quincenal vencido el 20 sep: «62 días de mora… pero yo
 * necesito es en peso. ¿Cuánto debe pagar en total a la fecha?». La ficha decía
 * $170.000 —lo que le falta de las cuotas— y la mora no aparecía porque nunca
 * configuró una tasa. Medido el mismo día: 4.410 préstamos activos con más de
 * una semana pasados de su fecha final, y de 181 negocios activos solo 6 tienen
 * el interés moratorio puesto. Estaba en Configuración y casi nadie lo encuentra.
 *
 * El dueño pidió las DOS formas que se usan en la calle:
 *   1 · un % al mes sobre lo atrasado, contado por días. Es el interés moratorio
 *       de siempre (`calcularInteresMoratorio`), con la tasa que se elija ahí.
 *   2 · cada período de más cobra otro período de interés: «se tomó una quincena
 *       más». El interés de un período es el PACTADO —cuota × cuotas − prestado,
 *       entre las cuotas—, no el de `totalAPagar`: cada recargo sube ese total y
 *       la segunda quincena saldría más cara que la primera.
 *
 * Las dos se apuntan como recargo (sube la deuda, el cliente lo debe) y su nota
 * es la llave para no cobrar dos veces lo mismo:
 *   · «Interés moratorio: …» la reconoce `moratorioYaAplicado`.
 *   · «Interés de N quincenas de más …» la cuenta `periodosYaCobrados`.
 */
import { numeroDeCuotas } from '@/lib/dinero/tabla'
import { obtenerDiasPorPeriodo } from '@/lib/dinero/calendario'

const DIA = 86400000

/* ⚠ SOLO DONDE LA CUOTA ES PAREJA (21 nov 2026). «El interés de una cuota» y
   «la tasa del préstamo» salen de cuota × cuotas − prestado, y eso solo vale si
   todas las cuotas son iguales: clásico (fijo), de una vez, proporcional y
   manual. En saldo, lineal y lineal dinámico el interés baja cada cuota y la
   cuota guardada es la primera (medido en producción: un lineal daba 450 % al
   mes). En solo interés la cuota es el interés y el capital va aparte, así que
   la cuenta no aplica. Ahí queda el «% al mes», que vale para todos. */
export const MODOS_CUOTA_PAREJA = new Set(['fijo', 'unico', 'proporcional', 'manual'])
const cuotaPareja = (p) => MODOS_CUOTA_PAREJA.has(p?.modoInteres || 'fijo') && p?.sinPlazo !== true

/** Lo que se ofrece de moratorio con una `tasa` (% al mes) sobre las piezas que
 *  ya calculó `calcularInteresMoratorio`: lo que falta, nunca más del tope. */
export function montoMoratorioCon({ montoBase = 0, diasMoraEfectivos = 0, tope = 0, yaAplicado = 0 } = {}, tasa = 0) {
  if (!(tasa > 0) || !(montoBase > 0) || !(diasMoraEfectivos > 0)) return 0
  const calculado = Math.round(montoBase * (tasa / 100 / 30) * diasMoraEfectivos)
  return Math.max(0, Math.min(calculado, tope) - (Number(yaAplicado) || 0))
}

export const NOMBRE_PERIODO = {
  diario: ['día', 'días'],
  semanal: ['semana', 'semanas'],
  quincenal: ['quincena', 'quincenas'],
  mensual: ['mes', 'meses'],
}

const RE_PERIODOS = /^inter[eé]s de (\d+) (?:d[ií]as?|semanas?|quincenas?|mes(?:es)?) de m[aá]s/i

const RE_MORATORIO = /^inter[eé]s moratorio/i

/** ¿Este pago es un recargo de mora (por % o por períodos de más)? */
export function esRecargoDeMora(pg) {
  if (pg?.tipo !== 'recargo') return false
  const nota = String(pg.nota || '').trim()
  return RE_MORATORIO.test(nota) || RE_PERIODOS.test(nota)
}

/**
 * ⚠ LA MORA NO COBRA MORA (21 nov 2026, prueba exhaustiva en el espejo).
 * Un recargo sube `totalAPagar`, y en los modos de cuota pareja eso subía «lo que
 * está en mora»: cobrar $259.200 de mora por 64 días y la hoja ofrecía enseguida
 * $82.944 más por los MISMOS días (y el lote del moratorio igual, de antes). La
 * base del % se calcula sobre el préstamo sin sus recargos de mora; así da lo
 * mismo en todos los modos, incluya o no su «en mora» los recargos.
 */
export function sinRecargosDeMora(prestamo) {
  const pagos = prestamo?.pagos || []
  const mora = pagos.filter(esRecargoDeMora)
  if (!mora.length) return prestamo
  const suma = mora.reduce((a, pg) => a + (Number(pg.montoPagado) || 0), 0)
  return { ...prestamo, totalAPagar: (Number(prestamo.totalAPagar) || 0) - suma, pagos: pagos.filter((pg) => !esRecargoDeMora(pg)) }
}

/** El total pactado, sin ningún recargo: con él se cuentan las cuotas de «de una
 *  vez» (total ÷ cuota). Con los recargos dentro, cobrar quincenas de más
 *  subía las cuotas y encarecía la siguiente quincena ($3.000 → $5.900). */
function sinRecargos(prestamo) {
  const suma = (prestamo?.pagos || []).filter((pg) => pg?.tipo === 'recargo').reduce((a, pg) => a + (Number(pg.montoPagado) || 0), 0)
  return suma > 0 ? { ...prestamo, totalAPagar: (Number(prestamo.totalAPagar) || 0) - suma } : prestamo
}

/** La nota con la que se apunta: empieza siempre igual, que es lo que se lee después. */
export function notaPeriodos(n, frecuencia, vencio) {
  const [uno, varios] = NOMBRE_PERIODO[frecuencia] ?? NOMBRE_PERIODO.diario
  const cuando = vencio ? ` (venció el ${new Date(vencio).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })})` : ''
  return `Interés de ${n} ${n === 1 ? uno : varios} de más${cuando}`
}

/** Cuántos períodos de más ya se cobraron con la opción 2, desde `desde`. */
export function periodosYaCobrados(pagos = [], desde = null) {
  const limite = desde ? new Date(desde).getTime() : -Infinity
  let n = 0
  for (const pg of pagos || []) {
    if (pg?.tipo !== 'recargo') continue
    const m = RE_PERIODOS.exec(String(pg.nota || '').trim())
    if (!m) continue
    if (new Date(pg.fechaPago).getTime() < limite) continue
    n += Number(m[1]) || 0
  }
  return n
}

/**
 * La tasa mensual con la que se prestó, sacada de lo PACTADO y no de
 * `tasaInteres` (que tiene tres semánticas según `modoInteres`): interés
 * pactado ÷ prestado ÷ meses del plazo. «Yo presto al 15 %», dijo el cliente
 * que pidió la mora, y quiere cobrarla con ese mismo número. Con un decimal;
 * null si no se puede saber.
 */
export function tasaMensualPactada(prestamo) {
  if (!cuotaPareja(prestamo)) return null
  const cuotas = numeroDeCuotas(sinRecargos(prestamo))
  const prestado = Number(prestamo?.montoPrestado) || 0
  const interes = (Number(prestamo?.cuotaDiaria) || 0) * cuotas - prestado
  const meses = (Number(prestamo?.diasPlazo) || 0) / 30
  if (!(prestado > 0) || !(interes > 0) || !(meses > 0)) return null
  const t = Math.round((interes / prestado / meses) * 1000) / 10
  // Más de 50 % al mes no es una tasa: es un préstamo de prueba o una cuota escrita a mano rara.
  return t > 0 && t <= 50 ? t : null
}

/**
 * La opción 2 para un préstamo: cuántos períodos completos lleva desde que
 * venció, cuántos ya se cobraron y cuánto vale cada uno.
 * `disponible` es false si no venció, si es un abierto (ya devenga solo) o si
 * su cuota no lleva interés que se pueda separar (solo interés, cuota rara).
 */
export function periodosDeMas(prestamo, { ahora = new Date(), esAbierto = false } = {}) {
  const frecuencia = prestamo?.frecuencia || 'diario'
  const nombre = NOMBRE_PERIODO[frecuencia] ?? NOMBRE_PERIODO.diario
  const nulo = { disponible: false, frecuencia, nombre, cumplidos: 0, yaCobrados: 0, porCobrar: 0, interesPorPeriodo: 0, diasDesdeFin: 0 }
  if (!prestamo || prestamo.estado !== 'activo' || esAbierto || !cuotaPareja(prestamo)) return nulo
  const fin = prestamo.fechaFin ? new Date(prestamo.fechaFin) : null
  if (!fin || !(new Date(ahora) > fin)) return nulo
  const cuotas = numeroDeCuotas(sinRecargos(prestamo))
  const cuota = Number(prestamo.cuotaDiaria) || 0
  const prestado = Number(prestamo.montoPrestado) || 0
  const interesPactado = cuota * cuotas - prestado
  if (!(cuotas > 0) || !(interesPactado > 0)) return { ...nulo, diasDesdeFin: Math.floor((new Date(ahora) - fin) / DIA) }
  // Redondeado a $100, como el resto de cifras que el sistema propone.
  const interesPorPeriodo = Math.round(interesPactado / cuotas / 100) * 100
  const diasDesdeFin = Math.floor((new Date(ahora) - fin) / DIA)
  const cumplidos = Math.floor(diasDesdeFin / (obtenerDiasPorPeriodo(frecuencia) || 1))
  const yaCobrados = periodosYaCobrados(prestamo.pagos, fin)
  return {
    disponible: interesPorPeriodo > 0,
    frecuencia, nombre, cumplidos, yaCobrados,
    porCobrar: Math.max(0, cumplidos - yaCobrados),
    interesPorPeriodo, diasDesdeFin, vencio: fin,
  }
}
