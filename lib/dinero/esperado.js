// ═══════════════════════════════════════════════════════════════════════════
// LO QUE TOCABA COBRAR — una sola respuesta, para cualquier fecha.
//
// ── POR QUE EXISTE ────────────────────────────────────────────────────────
//
// «¿Cuanto tocaba cobrar?» se contesta hoy en CINCO sitios distintos, y los
// cinco dan numeros diferentes:
//
//   app/api/caja/route.js:59        parte de CLIENTES, respeta festivos, usa
//                                   cuotaDelPeriodo. La mejor de las cinco.
//   app/api/caja/route.js:928       parte de RUTAS: un cliente sin ruta es
//                                   invisible.
//   app/api/caja/cuadre/route.js:38 parte de RUTAS, ignora festivos.
//   app/api/caja/cierre-auto:17     `findFirst` de UNA ruta, suma TODAS las
//                                   cuotas sin preguntar si el ciclo toca ese
//                                   dia, e incluye los clavos.
//   app/api/rutas/[id]/route.js:392 unica que respeta el override por prestamo.
//
// Medido en produccion el 1 ago 2026: **1.130 de los 2.728 cierres de caja de
// la plataforma (41%) tienen `totalEsperado = 0`**. En el cliente de 10
// cobradores, 442 de 597 (74%). Sus «cierres exactos» no son exactos: es que
// nunca compararon nada.
//
// ── LA REGLA QUE ORDENA TODO ESTO ─────────────────────────────────────────
//
// Se devuelven DOS numeros y NUNCA SE SUMAN:
//
//   esperado   — lo que el calendario dice que vencia ESE dia.
//   atrasado   — lo que vencio antes y sigue sin pagarse.
//
// Mezclarlos es de donde viene la mitad de las contradicciones. El 58% de la
// cartera del cliente grande es SEMANAL: para una ruta semanal «lo esperado
// hoy» es cero seis dias de cada siete, y sin embargo el cobrador trae plata
// todos esos dias (atrasos, abonos, adelantos). Un solo numero no puede
// describir eso, y al intentarlo el cierre acaba diciendo «diferencia 0».
//
// ── POR QUE RECIBE LA FECHA ───────────────────────────────────────────────
//
// `tienePeriodoEsperadoHoy` (lib/calculos.js:1215) esta cableada a HOY: mira
// `inicioDiaColombia()` sin argumento. Pero el cierre automatico corre pasada
// la medianoche y cierra el dia ANTERIOR, y el cuadre acepta cualquier fecha.
// Los dos preguntan por un dia que ya paso y reciben la respuesta de hoy.
//
// `tocaCobrarEn` es la misma logica con la fecha como parametro. La prueba
// `esperado-vs-calculos.test.js` fija que para `fecha = hoy` responde
// EXACTAMENTE lo mismo que la original, sobre una rejilla de frecuencias y
// anclas: es la red que permite migrar sin cambiar lo que la gente ve hoy.
// ═══════════════════════════════════════════════════════════════════════════

import { obtenerDiasPorPeriodo, cuotaDelPeriodo, inicioDiaLocal } from '@/lib/calculos'
import { obtenerDiasSinCobro, esFestivo } from '@/lib/dias-sin-cobro'

const DIA_MS = 24 * 60 * 60 * 1000

/**
 * Inicio del dia, con el convenio de la casa: medianoche local expresada como
 * T05:00Z. Se reexporta la de `lib/calculos` en vez de escribir otra.
 *
 * ⚠ Escribi una propia y me mordio en la primera prueba. Truncaba a UTC pelado
 * —`Date.UTC(y, m, d)`— y eso NO es idempotente: aplicada sobre una fecha ya
 * normalizada le volvia a restar las cinco horas y la dejaba en el dia
 * anterior. `esDiaSinCobro(ayer, [domingo])` contestaba por el sabado.
 */
export const inicioDia = (valor, offsetHoras = -5) =>
  inicioDiaLocal(valor == null ? Date.now() : valor, offsetHoras)

/** ¿Esa fecha cae en un dia de la semana sin cobro? (0=Dom ... 6=Sab) */
export function esDiaSinCobro(fecha, diasExcluidos) {
  if (!diasExcluidos || !diasExcluidos.length) return false
  return diasExcluidos.includes(inicioDia(fecha).getUTCDay())
}

/** ¿Ese dia no se cobra, ni por dia de la semana ni por festivo? */
export function esDiaMuerto(fecha, diasExcluidos, festivos = []) {
  return esDiaSinCobro(fecha, diasExcluidos) || esFestivo(inicioDia(fecha), festivos)
}

/**
 * ¿El calendario de este prestamo tenia un cobro programado ESA fecha?
 *
 * Contesta por el CALENDARIO, no por si se pago: sirve para sumar la meta del
 * dia, que debe contar toda cuota que vencia, esta pagada o no.
 *
 * Es `tienePeriodoEsperadoHoy` (lib/calculos.js:1215) con la fecha por
 * parametro. Se mantiene la estructura a proposito, rama por rama, para que la
 * prueba de equivalencia signifique algo.
 */
export function tocaCobrarEn(prestamo, fecha, diasExcluidos = [], festivos = []) {
  if (!prestamo) return false
  if (!prestamo.cuotaDiaria || prestamo.cuotaDiaria <= 0) return false

  const dia = inicioDia(fecha)
  const inicio = inicioDia(prestamo.fechaInicio)
  if (inicio > dia) return false

  // REGLA CLAVE: el primer cobro es fechaInicio + 1 periodo, no el dia de
  // inicio. Un prestamo diario creado hoy cobra por primera vez MAÑANA, asi
  // que un cliente nuevo no suma a la meta del dia en que se le presto.
  const freq = prestamo.frecuencia || 'diario'
  const diasPeriodo = obtenerDiasPorPeriodo(freq)

  if (freq === 'diario') {
    // En diario toca todos los dias cobrables desde el primero.
    if (esDiaMuerto(dia, diasExcluidos, festivos)) return false
    return dia.getTime() > inicio.getTime()
  }

  // Mensual: el dia ancla del mes, recortado al ultimo dia cuando ese numero
  // no existe (31 en abril). Mismo criterio que `calcularProximoCobro`, para
  // que la meta del dia y la fecha de proximo cobro no se contradigan.
  if (freq === 'mensual') {
    if (dia.getTime() <= inicio.getTime()) return false
    const ancla = Number.isInteger(prestamo.diaCobroMes) ? prestamo.diaCobroMes : inicio.getUTCDate()
    const ultimoDiaMes = new Date(Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth() + 1, 0)).getUTCDate()
    return dia.getUTCDate() === Math.min(Math.max(1, ancla), ultimoDiaMes)
  }

  // Ancla por numero de dia del mes: semanal/quincenal cuando el prestamista
  // eligio «cobra los 5 y los 20».
  if (prestamo.diaCobroMes != null && prestamo.diaCobroSemana == null) {
    if (dia.getTime() <= inicio.getTime()) return false
    const n = dia.getUTCDate()
    if (n === Number(prestamo.diaCobroMes)) return true
    if (prestamo.diaCobroMes2 != null && n === Number(prestamo.diaCobroMes2)) return true
    return false
  }

  // Ancla por dia de la semana.
  if (prestamo.diaCobroSemana != null && (freq === 'semanal' || freq === 'quincenal')) {
    if (dia.getUTCDay() !== Number(prestamo.diaCobroSemana)) return false
    if (dia.getTime() <= inicio.getTime()) return false
    // El ciclo se cuenta desde el PRIMER dia de la semana ancla posterior al
    // inicio, no desde el inicio: si no, un quincenal anclado en martes cuyo
    // prestamo empezo un viernes nunca cuadraria el modulo.
    const primero = new Date(inicio.getTime())
    do { primero.setUTCDate(primero.getUTCDate() + 1) }
    while (primero.getUTCDay() !== Number(prestamo.diaCobroSemana))
    const diff = Math.floor((dia.getTime() - primero.getTime()) / DIA_MS)
    return diff >= 0 && diff % diasPeriodo === 0
  }

  // Sin ancla: ciclo regular desde fechaInicio.
  const diff = Math.floor((dia.getTime() - inicio.getTime()) / DIA_MS)
  return diff > 0 && diff % diasPeriodo === 0
}

/**
 * Los DOS numeros de un prestamo para una fecha.
 *
 * `esperado` es lo que vencia ese dia. `atrasado` es lo que vencio antes y no
 * se ha pagado — se deriva de lo que el calendario pedia hasta la vispera
 * contra lo que realmente entro, y se topa al saldo pendiente porque nadie
 * puede deber mas de lo que debe.
 */
export function esperadoDePrestamo(prestamo, fecha, diasExcluidos = [], festivos = []) {
  const cuota = cuotaDelPeriodo(prestamo)
  const esperado = tocaCobrarEn(prestamo, fecha, diasExcluidos, festivos) ? cuota : 0

  const dia = inicioDia(fecha)
  const inicio = inicioDia(prestamo.fechaInicio)
  const total = Number(prestamo.totalAPagar) || 0
  const pagado = Number(prestamo.totalPagado) || 0
  const saldo = Math.max(0, total - pagado)

  // Cuantos cobros pedia el calendario ANTES de esa fecha. Se recorre dia a
  // dia y no con una formula: las frecuencias con ancla, los dias sin cobro y
  // los festivos no forman una progresion que se pueda dividir. El recorrido
  // se corta en un año, que es mas plazo del que tiene ningun prestamo vivo.
  let vencidoAntes = 0
  const tope = Math.min(370, Math.floor((dia.getTime() - inicio.getTime()) / DIA_MS))
  for (let i = 1; i <= tope; i++) {
    const d = new Date(inicio.getTime() + i * DIA_MS)
    if (tocaCobrarEn(prestamo, d, diasExcluidos, festivos)) vencidoAntes += cuota
  }

  const atrasado = Math.max(0, Math.min(saldo, vencidoAntes - pagado))
  return { esperado: Math.round(esperado), atrasado: Math.round(atrasado), cuota: Math.round(cuota) }
}

/**
 * Suma los dos numeros sobre una cartera ya cargada.
 *
 * Recibe CLIENTES, no rutas, y ese detalle no es un capricho: el calculo de la
 * caja arrancaba en `ruta.findMany`, asi que un cliente sin ruta era invisible
 * para la meta. Con cero rutas —el estado normal de la mayoria de negocios,
 * porque el onboarding no crea ninguna— la caja decia «Esperado $0» mientras
 * el panel mostraba la meta de verdad. Dos pantallas de la misma app
 * contradiciendose el mismo dia.
 *
 * `clientes` viene con `{ diasSinCobro, ruta: { diasSinCobro }, prestamos: [] }`.
 */
export function esperadoDeCartera({ clientes = [], org = null, festivos = [] }, fecha) {
  let esperado = 0
  let atrasado = 0
  let conCobro = 0

  for (const c of clientes) {
    for (const p of (c.prestamos || [])) {
      // El override por prestamo manda sobre el del cliente, la ruta y la
      // organizacion. Solo la ficha de ruta lo respetaba; el resto lo ignoraba.
      const dias = obtenerDiasSinCobro(c, c.ruta, org, p)
      const r = esperadoDePrestamo(p, fecha, dias, festivos)
      esperado += r.esperado
      atrasado += r.atrasado
      if (r.esperado > 0) conCobro += 1
    }
  }

  return {
    fecha: inicioDia(fecha).toISOString().slice(0, 10),
    esperado: Math.round(esperado),
    atrasado: Math.round(atrasado),
    conCobro,
  }
}

/**
 * Lo que hay que pedirle a Prisma para poder contestar. Se exporta para que
 * los cinco llamadores no se inventen cada uno su `select` — que es como
 * empezaron a divergir. Ojo con `modoInteres` y `cuotasAmortizacion`: sin
 * ellos `cuotaDelPeriodo` cae a `cuotaDiaria`, que en Decreciente es la cuota
 * MAS ALTA y en Globo es solo el interes.
 */
export const SELECT_PRESTAMO = {
  id: true,
  cuotaDiaria: true,
  frecuencia: true,
  fechaInicio: true,
  diasPlazo: true,
  diaCobroSemana: true,
  diaCobroMes: true,
  diaCobroMes2: true,
  diasSinCobro: true,
  totalAPagar: true,
  totalPagado: true,
  modoInteres: true,
  cuotasAmortizacion: {
    orderBy: { numeroPeriodo: 'asc' },
    select: { numeroPeriodo: true, cuotaTotal: true, interes: true, pagado: true, interesPagado: true },
  },
}
