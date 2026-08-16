// lib/calculos.js - Funciones de cálculo reutilizables
import { contarDiasExcluidos, contarFestivosEnRango, esFestivo } from './dias-sin-cobro.js'
import { obtenerDiasPorPeriodo, sumarMeses, fechaDePeriodo, primerCobroMensual, siguientePeriodo } from './dinero/calendario.js'
// La tabla derivada, para que el modo clasico deje de medir la mora con una
// formula plana. `calendario.js` no importa nada, asi que no hay ciclo.
import { tablaDe } from './dinero/tabla.js'

/**
 * Determina el estado del cliente a partir de sus préstamos activos.
 * - mora:      tiene préstamos activos con cuotas vencidas
 * - activo:    tiene préstamos activos sin mora
 * - cancelado: no tiene préstamos activos
 */
export function calcularEstadoCliente(prestamos = [], diasExcluidos = [], festivos = []) {
  // Los prestamos marcados como tarjeta clavo NO cuentan para el estado normal
  // del cliente (van en contabilidad aparte).
  const activos = prestamos.filter((p) => p.estado === 'activo' && !p.esClavo)
  if (!activos.length) return 'activo'
  const enMora = activos.some((p) => calcularDiasMora(p, diasExcluidos, festivos) > 0)
  return enMora ? 'mora' : 'activo'
}

/**
 * Calcula los días de mora de un préstamo activo.
 * Compara lo que debería haber pagado hasta hoy (cuotas esperadas × cuota)
 * vs lo que realmente ha pagado. Si está atrasado, calcula cuántos días
 * de retraso tiene según la frecuencia.
 * 1 día de gracia para cobro diario, 2 para semanal+.
 */
const TIPOS_AJUSTE = ['recargo', 'descuento']

const DAY_MS = 24 * 60 * 60 * 1000

// ── EL CALENDARIO SE FUE A `lib/dinero/calendario.js` ──────────────────────
// `obtenerDiasPorPeriodo`, `sumarMeses` y `fechaDePeriodo` viven ahora en un
// modulo que NO IMPORTA NADA. Sin eso habia un ciclo: `lib/dinero/tabla.js`
// necesita el calendario, y este archivo necesita la tabla derivada para medir
// la mora del modo clasico. Un ciclo de importacion aqui es el fallo
// intermitente que ya nos costo una caida: ESM a veces lo tolera y a veces deja
// un `undefined` segun el orden de resolucion.
//
// Se RE-EXPORTAN para que los que ya los importaban de aqui sigan igual.
export { obtenerDiasPorPeriodo, sumarMeses, fechaDePeriodo, primerCobroMensual, siguientePeriodo }

/**
 * Cuantos cobros tiene el prestamo en total.
 *
 * Se toma el MAYOR entre lo que dice el plazo y lo que exige el dinero. Antes se
 * usaba `porPlazo || porMonto`, o sea el plazo como TOPE absoluto — y eso hacia
 * que un prestamo dejara de aparecer en los cobros aun debiendo plata.
 *
 * En un prestamo sano los dos numeros son IDENTICOS (la cuota sale de repartir el
 * total entre los periodos del plazo), asi que esto no cambia nada para ellos.
 * Se separan cuando el total crece despues de creado:
 *
 *   - RECARGO: sube totalAPagar sin tocar el plazo ni la cuota. Es la causa del
 *     75% de los casos encontrados en produccion (190 de 252 prestamos).
 *   - Cuota manual que auto-extiende el plazo.
 *   - Prestamos migrados con cifras que no cuadran entre si.
 *
 * El prestamo no se acaba cuando se cumple el calendario, se acaba cuando se paga
 * la deuda. Y no hay riesgo de cobrar de mas: el tope real sigue siendo
 * `totalAPagar`, y al llegar a saldo cero el prestamo pasa a 'completado'.
 */
function totalPeriodosDelPrestamo(prestamo, diasPeriodo) {
  const porPlazo = prestamo.diasPlazo
    ? Math.ceil(prestamo.diasPlazo / diasPeriodo)
    : null
  const porMonto = prestamo.totalAPagar && prestamo.cuotaDiaria > 0
    ? Math.ceil(prestamo.totalAPagar / prestamo.cuotaDiaria)
    : null
  if (porPlazo && porMonto) return Math.max(porPlazo, porMonto)
  return porPlazo || porMonto
}

function calcularTotalPagadoReal(prestamo) {
  // Usa el campo denormalizado si existe (mas rapido en listados).
  // Mantenido por lib/prisma-pago-helpers.js en cada cambio de pagos.
  if (typeof prestamo?.totalPagado === 'number') return prestamo.totalPagado
  return (prestamo?.pagos ?? []).reduce(
    (acc, p) => TIPOS_AJUSTE.includes(p.tipo) ? acc : acc + (p.montoPagado ?? 0), 0
  )
}

// Determina si un prestamo usa la tabla de amortizacion (modo lineal) y la
// trae cargada (cuotasAmortizacion via include de Prisma).
export function tieneTablaAmortizacion(prestamo) {
  return ['lineal', 'solo_interes', 'lineal_dinamico', 'saldo'].includes(prestamo?.modoInteres) && Array.isArray(prestamo?.cuotasAmortizacion) && prestamo.cuotasAmortizacion.length > 0
}

/* Un peso de holgura: las cuotas se redondean al guardarlas y no vale la pena
   poner a nadie en mora por el centavo que sobra de una division. */
const TOLERANCIA_PESO = 1

/* Lo que el cliente entrego contra su deuda, y SI LO SABEMOS.
 *
 * La distincion importa: `calcularTotalPagadoReal` devuelve 0 tanto para quien
 * no ha pagado nada como para el objeto al que nadie le pidio `totalPagado` ni
 * `pagos`. Confundir las dos cosas pondria en mora a media cartera por un
 * `select` incompleto — que es exactamente como nacio el bug de «0 en mora»
 * en Analiticas. */
/* ══ EL ABONO A CAPITAL NO PAGA CUOTAS ═══════════════════════════════════════
 *
 * Reportado por PRESTAMOS PEDRO el 14 ago 2026, con el caso al peso:
 *
 *   «Le presté $2.000.000 en abril. Pagó mayo, junio, julio, y en agosto abonó
 *    $500.000 y también pagó el interés que le correspondía, o sea $75.000
 *    porque ya el saldo capital quedaba en $1.500.000. Y veo la pantalla y me
 *    dice que el próximo pago será el 27 de feb del 2027.»
 *
 * Y en la nota de voz dio él mismo el diagnóstico: «como si cogiera ese abono y
 * lo distribuyera en cuotas». Era exactamente eso.
 *
 * David Popayán llevaba $875.000 pagados, de los cuales $500.000 eran el abono.
 * La cascada iba sumando `cuotaTotal` fila por fila mientras cupiera en los
 * $875.000, así que se comió las cuotas de interés de septiembre, octubre,
 * noviembre, diciembre y enero, y se detuvo en la de febrero: el 27/02/2027.
 *
 * Un abono a capital NO es el pago de unas cuotas: baja el saldo, y la tabla se
 * rehace con cuotas más chicas —de $100.000 a $75.000, que es justo lo que él
 * describe—. Contarlo otra vez al recorrer la tabla es cobrárselo dos veces al
 * revés: perdonarle meses que no ha pagado.
 *
 * ⚠ ES LA TERCERA VEZ QUE ESTE MISMO ABONO SE CUELA DONDE NO VA.
 *   `capitalVivoSegunTabla` y `regenerarTablaAmortizacion*` YA lo excluyen, cada
 *   una con su comentario. Esta se quedó atrás. Si aparece una cuarta función
 *   que recorra la tabla, tiene que usar `loPagado`, no `totalPagado` a secas.
 *
 * ⚠ Y SE RESTA DEL CAMPO DENORMALIZADO, no de la lista de pagos: `clientes/
 *   route.js` no carga `pagos` y `prestamos/route.js` trae solo los diez
 *   últimos. Con la lista, la misma deuda daba una fecha en la ficha y otra en
 *   el listado. La lista queda solo de respaldo para quien sí la traiga entera.
 */
function abonosACapitalDe(prestamo) {
  if (typeof prestamo?.abonadoCapital === 'number') return prestamo.abonadoCapital
  if (Array.isArray(prestamo?.pagos)) {
    return prestamo.pagos
      .filter((p) => p.tipo === 'capital')
      .reduce((acc, p) => acc + (p.montoPagado ?? 0), 0)
  }
  return 0
}

/* ⚠ Y NO SE RESTA SIEMPRE: SE PREGUNTA SI EL ABONO SIGUE DENTRO DE LA TABLA.
 *
 * Hay dos finales para un abono a capital, y los dos son correctos:
 *
 *  · Si quedaban cuotas FUTURAS, la tabla se rehace sobre el saldo ya rebajado
 *    y el abono sale de las filas. `totalAPagar` lo vuelve a sumar aparte, así
 *    que `totalAPagar − Σ cuotaTotal` ES el abono. Aquí hay que restarlo (David
 *    Popayán: 2.925.000 − 2.425.000 = 500.000, su abono al peso).
 *
 *  · Si NO quedaban futuras —el abono cae sobre una cuota ya vencida—, no se
 *    rehace nada: el abono paga el capital de esa fila y sigue DENTRO de la
 *    tabla. `totalAPagar − Σ cuotaTotal = 0` y restarlo pondría en mora a
 *    alguien que pagó. Ese caso está fijado en
 *    `mora-el-interes-no-salda-el-capital.test.js` y fue el que cazó mi primera
 *    versión, que restaba a ciegas.
 *
 * Por eso la resta se DERIVA de la propia tabla en vez de decidirse por el tipo
 * de pago: la diferencia tiene que quedar explicada al peso o no se resta nada.
 */
function loPagadoContraLaTabla(prestamo, filas) {
  const { conocido, monto } = loPagado(prestamo)
  if (!conocido) return { conocido, monto }

  const abonos = abonosACapitalDe(prestamo)
  if (abonos <= 0) return { conocido, monto }

  const sumaFilas = filas.reduce((acc, f) => acc + (f.cuotaTotal || 0), 0)
  const total = Number(prestamo?.totalAPagar) || 0
  // Lo que la deuda tiene DE MÁS sobre la tabla es lo que salió de ella. Nunca
  // más que los abonos, y nunca negativo.
  const fueraDeLaTabla = Math.max(0, Math.min(abonos, Math.round(total - sumaFilas)))
  return { conocido, monto: Math.max(0, monto - fueraDeLaTabla) }
}

function loPagado(prestamo) {
  const conocido = typeof prestamo?.totalPagado === 'number' || Array.isArray(prestamo?.pagos)
  return { conocido, monto: conocido ? calcularTotalPagadoReal(prestamo) : 0 }
}

/* El respaldo, fila por fila, para cuando no sabemos el total pagado. */
function cubiertaPorSusPropiosCampos(fila) {
  if ((fila.pagado || 0) >= fila.cuotaTotal) return true
  // Pagar el interes solo salda la cuota cuando la cuota ES interes. En cuanto
  // lleva capital, deberlo es deberlo. Ver la nota larga de `coberturaDeLaTabla`.
  if ((fila.capital || 0) > 0) return false
  return fila.interes > 0 && (fila.interesPagado || 0) >= fila.interes
}

/**
 * COBERTURA DE LA TABLA — hasta que cuota alcanza lo que el cliente ha pagado.
 *
 * ══ POR QUE SE MIDE ACUMULANDO Y NO FILA POR FILA ══════════════════════════
 *
 * «Dice que los prestamos ya deberian tener mora y el sistema no le avisa».
 * Medido contra produccion: 14 prestamos activos en 6 negocios con CERO dias de
 * mora y, a la vez, un «le falta X para ponerse al dia» de $14.664.349. El
 * sistema se contradecia a si mismo en la misma ficha.
 *
 * Dos causas, y las dos vienen de mirar la fila sola:
 *
 *  1 · PAGAR EL INTERES NO SALDA UNA CUOTA QUE LLEVA CAPITAL. La regla era
 *      «interes cubierto = al dia», escrita para los modos de solo interes,
 *      donde el interes ES toda la cuota del mes. Aplicada a `lineal`, `saldo` y
 *      al balloon del globo, un cliente que abonaba los $200.000 de interes y
 *      dejaba $2.000.000 de capital vencido aparecia AL DIA. Para siempre: la
 *      fila nunca vuelve a vencer.
 *  2 · LA FILA NO ES EL LIBRO. `fila.pagado` solo lo llenan los pagos
 *      completo/parcial (ver `regenerarTablaAmortizacion`); los abonos a capital
 *      y los pagos de interes se anotan en otro lado a proposito, para no
 *      contarlos dos veces. Asi que «esta fila no esta pagada» tampoco prueba
 *      que el cliente deba: puede haber pagado por otra via.
 *
 * Por eso la vara es el ACUMULADO: se van sumando las cuotas y se compara con
 * todo lo que el cliente entrego. La primera cuota cuyo acumulado no alcanza es
 * la primera que de verdad debe. Es la MISMA vara que ya usaba
 * `calcularMontoParaPonerseAlDia`, que llevaba meses en produccion dando la
 * respuesta correcta mientras la mora daba otra.
 *
 * Comprobado contra la base de produccion antes de cambiar nada: entran 9
 * prestamos en mora ($11,9M vencidos que nadie marcaba) y salen 3 a los que el
 * propio sistema ya les calculaba $0 para ponerse al dia.
 */
export function coberturaDeLaTabla(prestamo) {
  const filas = [...(prestamo?.cuotasAmortizacion ?? [])].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
  const { conocido, monto } = loPagadoContraLaTabla(prestamo, filas)
  let acumulado = 0
  return filas.map((fila) => {
    acumulado += fila.cuotaTotal || 0
    return {
      fila,
      acumulado,
      cubierta: conocido
        ? acumulado <= monto + TOLERANCIA_PESO
        : cubiertaPorSusPropiosCampos(fila),
    }
  })
}

// Calcula el estado de la tabla de amortizacion para modo 'lineal':
// cuantos periodos vencieron, cuanto se debia haber pagado a la fecha,
// y el monto en mora (lo vencido menos lo pagado).
function calcularEstadoTablaAmortizacion(prestamo) {
  const hoy = inicioDiaColombia()
  const cobertura = coberturaDeLaTabla(prestamo)
  // La MISMA cifra que usó la cobertura: si aquí se leyera `loPagado` a secas,
  // la mora y el próximo cobro volverían a contradecirse en la misma ficha.
  const { conocido, monto } = loPagadoContraLaTabla(prestamo, cobertura.map((c) => c.fila))

  let periodosVencidos = 0
  let esperadoHastaHoy = 0
  let montoPorFila = 0
  let cuotasEnMora = 0
  let primeraVencidaFecha = null

  for (const { fila, cubierta } of cobertura) {
    const fechaEsperada = inicioDiaColombia(fila.fechaEsperada)
    if (fechaEsperada > hoy) continue
    periodosVencidos++
    esperadoHastaHoy += fila.cuotaTotal
    if (!cubierta) {
      montoPorFila += Math.max(0, fila.cuotaTotal - (fila.pagado || 0) - (fila.interesPagado || 0))
      cuotasEnMora++
      if (!primeraVencidaFecha) primeraVencidaFecha = fechaEsperada
    }
  }

  // Lo vencido menos lo pagado. Solo si sabemos lo pagado: si no, se cae a la
  // suma por fila, que es peor pero no inventa una deuda de la nada.
  const montoEnMora = cuotasEnMora === 0
    ? 0
    : conocido ? Math.max(0, esperadoHastaHoy - monto) : montoPorFila

  return {
    filas: cobertura.map((c) => c.fila),
    periodosVencidos, esperadoHastaHoy, montoEnMora, cuotasEnMora, primeraVencidaFecha,
  }
}

// offsetHoras: UTC offset en horas (ej: -5 para Colombia, -6 para Mexico)
// Default -5 para retrocompatibilidad con todo el codigo que ya usa esta funcion.
// Se exporta porque `lib/dinero/esperado.js` la necesita y reescribirla alli
// seria empezar el mismo camino que nos dejo cinco «esperado» distintos. El
// convenio que devuelve —medianoche local expresada como T05:00Z— es lo que la
// hace IDEMPOTENTE: volver a aplicarla sobre su propio resultado no corre la
// fecha un dia hacia atras, que es lo que pasa si se trunca a UTC pelado.
export function inicioDiaLocal(valor = Date.now(), offsetHoras = -5) {
  const fecha = valor instanceof Date ? valor : new Date(valor)
  const absOffset = Math.abs(offsetHoras)
  const ms = absOffset * 60 * 60 * 1000
  const local = new Date(fecha.getTime() - ms)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), absOffset, 0, 0, 0))
}

// Alias retrocompatible — los archivos existentes siguen funcionando sin cambios
function inicioDiaColombia(valor = Date.now()) {
  return inicioDiaLocal(valor, -5)
}

/**
 * Normaliza la fechaInicio que llega a calcularPrestamo.
 *
 * Los 13 llamadores no son consistentes: la API y la carga masiva pasan el
 * string 'YYYY-MM-DD' del formulario, otros pasan un Date ya construido.
 * `new Date('2026-07-05')` se interpreta como medianoche UTC, o sea las 7pm
 * del dia ANTERIOR en Bogota — asi que toda la tabla de amortizacion nacia un
 * dia antes de la fecha que el prestamista habia elegido:
 *
 *   prestamo diario que arranca el 5 jul -> 1er cobro 5 jul (debia ser el 6)
 *   semanal   "        "         "       -> 1er cobro 11 jul (debia ser el 12)
 *
 * Se normaliza al MISMO formato que usa el resto del sistema (inicioDiaColombia
 * y la API al guardar): medianoche local expresada en UTC. Ese formato hace que
 * la aritmetica con setDate/setMonth de mas abajo de el mismo resultado tanto si
 * el server corre en Bogota como en UTC.
 */
function normalizarFechaInicio(valor, offsetHoras = -5) {
  if (typeof valor === 'string') {
    const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) {
      return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Math.abs(offsetHoras), 0, 0, 0))
    }
  }
  return inicioDiaLocal(valor, offsetHoras)
}

/**
 * Suma n meses de CALENDARIO a una fecha, fijando el dia ancla y recortando al
 * ultimo dia del mes cuando no existe (31 -> 30 en abril, 28/29 en febrero).
 *
 * Existe por dos razones:
 *
 * 1. "Mensual" significa el mismo dia del mes, no 30 dias. Sumar 30 dias fijos
 *    corre la fecha hacia atras casi todos los meses (julio, agosto y octubre
 *    tienen 31 dias), y el desfase se acumula:
 *      inicio 5 jul -> 4 ago -> 3 sep -> 3 oct -> 2 nov -> 2 dic
 *    Reportado por un cliente que cobra los 5 de cada mes.
 *
 * 2. setMonth() se desborda solo: en JS, 31 de enero + 1 mes da 3 de MARZO
 *    (porque el 31 de febrero no existe y rueda). Por eso se fija el dia 1
 *    antes de mover el mes, y solo despues se aplica el ancla.
 */
// Toda la aritmetica va en UTC a proposito. Las fechas del sistema se guardan
// con el convenio "medianoche de Bogota" = 05:00Z, asi que los getters locales
// (getDate/setMonth) devuelven el dia equivocado en cualquier server al oeste
// de UTC-5: en UTC-6 las 05:00Z son las 23:00 del dia ANTERIOR. Con setUTC* el
// resultado es el mismo corra el server en UTC, en Bogota o en Ciudad de Mexico.
// `sumarMeses` vive en `lib/dinero/calendario.js`. Ver la nota de arriba.

function calcularDiasTranscurridosCobrables(inicio, fecha, diasExcluidos = [], festivos = []) {
  const inicioCol = inicioDiaColombia(inicio)
  const fechaCol = inicioDiaColombia(fecha)
  const diasCalendario = Math.floor((fechaCol - inicioCol) / DAY_MS)
  const diasDescontados = diasExcluidos.length > 0
    ? contarDiasExcluidos(inicioCol, fechaCol, diasExcluidos)
    : 0
  const festivosDescontados = festivos.length > 0
    ? contarFestivosEnRango(inicioCol, fechaCol, festivos)
    : 0
  return Math.max(0, diasCalendario - diasDescontados - festivosDescontados)
}

export function calcularDiasMora(prestamo, diasExcluidos = [], festivos = []) {
  /* ⚠ `undefined` NO ES «no activo»: ES QUE NADIE LO PIDIO.
   *
   * Esto era `prestamo.estado !== 'activo'`, y un campo que no entra en el
   * `select` de Prisma no da error: vale `undefined`. Asi que cualquier consulta
   * que filtrara `where: { estado: 'activo' }` y no pusiera `estado: true` en el
   * `select` recibia CERO DIAS DE MORA en todos sus prestamos, sin un aviso.
   *
   * Le pasaba a las Analiticas y a su PDF: decian «0 en mora» de 984 prestamos
   * mientras el otro reporte, sobre el mismo negocio y el mismo dia, decia 851.
   * Cero mora es la respuesta mas tranquilizadora que puede dar el sistema, asi
   * que nadie la mira dos veces.
   *
   * Ahora solo se sale cuando el estado VIENE y no es activo. Si no viene, se
   * calcula: quien no lo pide es porque ya lo filtro en la consulta. */
  if (prestamo.estado != null && prestamo.estado !== 'activo') return 0
  if (!prestamo.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0
  if (calcularSaldoPendiente(prestamo) <= 0) return 0

  const hoy = inicioDiaColombia()
  const inicio = inicioDiaColombia(prestamo.fechaInicio)

  // Si aún no empieza el préstamo, no hay mora
  if (inicio > hoy) return 0

  const freq = prestamo.frecuencia || 'diario'
  const diasPorPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[freq] || 1

  // Modo lineal: la primera cuota vencida sin cubrir define el inicio de mora.
  // Si el usuario fijó proximoCobroManual y ya pasó, esa fecha tiene prioridad
  // sobre la fechaEsperada de la tabla (el usuario sabe cuándo debía cobrarse).
  if (tieneTablaAmortizacion(prestamo)) {
    const { primeraVencidaFecha } = calcularEstadoTablaAmortizacion(prestamo)
    let fechaReferencia = primeraVencidaFecha
    if (!fechaReferencia && prestamo.proximoCobroManual) {
      const manual = inicioDiaColombia(prestamo.proximoCobroManual)
      if (manual <= hoy) fechaReferencia = manual
    }
    if (!fechaReferencia) return 0
    const manana = new Date(hoy.getTime() + DAY_MS)
    const diasAtraso = calcularDiasTranscurridosCobrables(fechaReferencia, manana, diasExcluidos, festivos)
    return Math.max(0, diasAtraso - 1)
  }

  const proximoCobro = calcularProximoCobro(prestamo, diasExcluidos, festivos)

  if (!proximoCobro) return 0

  const proximoDia = inicioDiaColombia(proximoCobro)
  if (proximoDia > hoy) return 0

  const manana = new Date(hoy.getTime() + DAY_MS)
  const diasAtraso = calcularDiasTranscurridosCobrables(proximoDia, manana, diasExcluidos, festivos)

  // Gracia de 1 día: el mismo día de cobro no cuenta como mora,
  // pero al día siguiente ya está en mora si no pagó.
  return Math.max(0, diasAtraso - 1)
}

/**
 * Calcula el saldo pendiente de un préstamo:
 * totalAPagar - suma de pagos recibidos.
 */
export function calcularSaldoPendiente(prestamo) {
  const pagado = calcularTotalPagadoReal(prestamo)
  return Math.max(0, prestamo.totalAPagar - pagado)
}

/**
 * CAPITAL VIVO SEGUN LA TABLA — la pregunta que hace quien ESCRIBE.
 *
 * ⚠ NO es lo mismo que `calcularCapitalRestante`, y confundirlas destruye plata.
 *
 * Cuando entra un abono a capital, el flujo hace:
 *
 *     capitalAntesDelAbono = <esta funcion>
 *     saldoNuevo           = capitalAntesDelAbono - montoAbonado
 *     <regenerar la tabla sobre saldoNuevo>
 *
 * O sea: el que llama RESTA el abono el mismo. Por eso esta funcion tiene que
 * devolver el capital que dice la tabla **ignorando los abonos a capital**, que
 * ya quedaron horneados en la tabla la vez anterior que se regenero. Si
 * devolviera el capital con los abonos ya descontados, el llamador los restaria
 * DOS VECES y el globo se encogeria de mas: deuda perdonada sin que nadie lo
 * decida.
 *
 * `calcularCapitalRestante` contesta otra pregunta —«cuanto de mi plata sigue
 * afuera», para reportar— y ahi los abonos SI cuentan. Vivian en la misma
 * funcion; separarlas es lo que impide que el proximo cambio de una rompa la
 * otra en silencio.
 */
export function capitalVivoSegunTabla(prestamo) {
  if (!tieneTablaAmortizacion(prestamo)) return calcularCapitalRestante(prestamo)

  const filas = [...prestamo.cuotasAmortizacion].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
  let capitalAcumulado = 0
  for (const f of filas) capitalAcumulado += f.capital

  // Los abonos a capital se sacan del "pagado" que camina las filas: no se
  // reparten por la cascada interes-primero, que es solo para completo/parcial.
  // Sin esto, un abono se comia primero los intereses y casi no bajaba el
  // capital (reportado: 3M a un globo bajaban el capital solo ~525k).
  const abonosCapital = (prestamo.pagos ?? [])
    .filter(p => p.tipo === 'capital')
    .reduce((acc, p) => acc + (p.montoPagado ?? 0), 0)
  const pagadoRegular = Math.max(0, calcularTotalPagadoReal(prestamo) - abonosCapital)

  let restante = pagadoRegular
  let capitalCubierto = 0
  for (const f of filas) {
    if (restante <= 0) break
    const cubierto = Math.min(restante, f.cuotaTotal)
    const interesCubierto = Math.min(cubierto, f.interes)
    capitalCubierto += Math.max(0, cubierto - interesCubierto)
    restante -= cubierto
  }
  return Math.max(0, Math.round(capitalAcumulado - capitalCubierto))
}

/**
 * CUANTO DE TU PLATA SIGUE AFUERA en este prestamo — la cifra de REPORTE.
 *
 * Es lo prestado menos lo que ya volvio, y nunca por encima de lo que falta
 * cobrar. La convencion (proporcional, o la tabla cuando la hay) vive en
 * `lib/dinero/reparto.js`; aqui esta duplicada porque ese modulo importa de este
 * archivo y al reves seria un ciclo. Que las dos digan lo mismo lo fija
 * `lib/__tests__/coherencia-dinero.test.js` sobre una rejilla de 96 casos.
 *
 * Para la pregunta del flujo de escritura, ver `capitalVivoSegunTabla`.
 */
export function calcularCapitalRestante(prestamo) {
  const montoBase = prestamo?.montoPrestado
  if (!montoBase || montoBase <= 0) return null

  const pagadoTotal = calcularTotalPagadoReal(prestamo)
  const saldoTope = (prestamo?.totalAPagar ?? 0) > 0
    ? Math.max(0, prestamo.totalAPagar - pagadoTotal)
    : null

  // Los abonos a capital (tipo 'capital') bajan el capital DIRECTO: el
  // prestamista dijo "esto es capital" y se respeta, no entran al reparto. Sin
  // esto, un abono a capital se comia primero los intereses y casi no bajaba el
  // capital (reportado: 3M a un globo bajaban el capital solo ~525k).
  const abonos = Math.min(
    (prestamo?.pagos ?? [])
      .filter(p => p.tipo === 'capital')
      .reduce((acc, p) => acc + (p.montoPagado ?? 0), 0),
    montoBase,
  )
  const aRepartir = Math.max(0, pagadoTotal - abonos)

  // El saldo pendiente es el techo: no puede haber mas capital vivo en la calle
  // del que falta por cobrar. Un saldo de CERO es un dato —pagado del todo—, no
  // un hueco: la guarda mira si hay total pactado, no si el saldo es truthy.
  const conTope = (restante) => Math.max(
    0,
    Math.round(saldoTope === null ? restante : Math.min(restante, saldoTope)),
  )

  if (tieneTablaAmortizacion(prestamo)) {
    // ── CON TABLA: manda la tabla ──────────────────────────────────────────
    //
    // Aqui habia OTRA aritmetica: partia de `Σ fila.capital` en vez de
    // `montoPrestado`, y no topaba por el saldo. Sobre un negocio real daba
    // $559.999 mas que `capitalEnCalle` para la misma cartera — dos respuestas
    // bajo un rotulo, otra vez. Ahora las dos calculan lo mismo:
    // capital devuelto = lo pagado menos el interes que la tabla reconoce.
    const capitalDevuelto = aRepartir - interesAcumuladoTabla(prestamo.cuotasAmortizacion, aRepartir) + abonos
    return conTope(montoBase - capitalDevuelto)
  }

  // ── SIN TABLA: PROPORCIONAL ──────────────────────────────────────────────
  //
  // Aqui habia una CASCADA: se cobraba TODO el interes primero, asi que hasta
  // que no entraban los $100.000 de interes el capital no bajaba un peso.
  //
  // Convivia con el reparto PROPORCIONAL —cada peso lleva su parte— que estaba
  // escrito en otros nueve sitios del codigo, bajo el mismo rotulo «capital en
  // la calle». Medido sobre la cartera real el 1 ago 2026, la diferencia entre
  // las dos son $264.614.219: un 8% de la cartera, en la cifra con la que el
  // prestamista decide si puede prestar mas.
  //
  // Decidido: proporcional. Es lo que dice la tabla de amortizacion que la app
  // ya imprime y el cliente ya firmo, y no cuenta como ganada plata que
  // todavia no se gano.
  //
  // La casa canonica de esta regla es `lib/dinero/reparto.js` —con sus pruebas
  // y su gemela en SQL—. Vive aqui duplicada por una sola razon: ese modulo
  // importa de este, y al reves seria un ciclo. Si cambia una, cambia la otra.
  // Sin total pactado no hay proporcion que aplicar: todo lo pagado es capital
  // volviendo. Son 56 prestamos en produccion.
  const totalAPagar = prestamo?.totalAPagar ?? montoBase
  if (totalAPagar <= 0) return Math.max(0, Math.round(montoBase - aRepartir - abonos))

  // La fraccion de INTERES va acotada a [0, 1] y el capital sale por resta, que
  // es el orden de `lib/dinero/reparto.js`. Redondear los dos lados por separado
  // inventa pesos. El tope de 0 es lo que impide que los 850 prestamos cerrados
  // por debajo de lo prestado reconozcan interes NEGATIVO.
  const fraccion = Math.min(1, Math.max(0, (totalAPagar - montoBase) / totalAPagar))
  const capitalDevuelto = aRepartir - Math.round(aRepartir * fraccion) + abonos
  return conTope(montoBase - capitalDevuelto)
}

function calcularPeriodosEsperadosHastaHoy(prestamo, diasExcluidos = [], festivos = []) {
  if (!prestamo?.fechaInicio || !prestamo?.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0

  const inicio = inicioDiaColombia(prestamo.fechaInicio)
  const hoy = inicioDiaColombia()
  if (inicio > hoy) return 0

  const freq = prestamo.frecuencia || 'diario'
  const diasPeriodo = obtenerDiasPorPeriodo(freq)
  // diasSinCobro solo aplica a frecuencia diaria. Para semanal/quincenal/mensual
  // un periodo son siempre 7/15/30 dias calendario.
  const diasTranscurridos = freq === 'diario'
    ? calcularDiasTranscurridosCobrables(inicio, hoy, diasExcluidos, festivos)
    : Math.floor((hoy.getTime() - inicio.getTime()) / DAY_MS)
  let periodosEsperados = Math.floor(diasTranscurridos / diasPeriodo)

  const totalPeriodos = totalPeriodosDelPrestamo(prestamo, diasPeriodo)
  if (totalPeriodos) {
    periodosEsperados = Math.min(periodosEsperados, totalPeriodos)
  }

  return Math.max(0, periodosEsperados)
}

/**
 * Cuotas (periodos) que faltan para terminar el préstamo.
 */
export function calcularCuotasPendientes(prestamo) {
  if (tieneTablaAmortizacion(prestamo)) {
    // Mismo criterio que la mora y que el proximo cobro: una cuota deja de estar
    // pendiente cuando lo pagado alcanza a cubrirla, contando desde la primera.
    // Ver `coberturaDeLaTabla` — antes se miraba fila por fila y «cuota 2 de 5»
    // podia salir con la 1 vencida y sin pagar.
    return coberturaDeLaTabla(prestamo).filter((c) => !c.cubierta).length
  }
  if (!prestamo?.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0
  const saldo = calcularSaldoPendiente(prestamo)
  if (saldo <= 0) return 0
  return Math.max(0, Math.ceil(saldo / prestamo.cuotaDiaria))
}

/**
 * Cuotas vencidas en mora (aplica periodo de gracia).
 * Nota: no es lo mismo que "cuotas pendientes".
 */
export function calcularCuotasEnMora(prestamo, diasExcluidos = [], festivos = []) {
  const diasMora = calcularDiasMora(prestamo, diasExcluidos, festivos)
  if (diasMora <= 0) return 0
  if (tieneTablaAmortizacion(prestamo)) {
    return calcularEstadoTablaAmortizacion(prestamo).cuotasEnMora
  }
  const diasPeriodo = obtenerDiasPorPeriodo(prestamo?.frecuencia)
  return Math.max(1, Math.ceil(diasMora / diasPeriodo))
}

/**
 * Monto correspondiente a las cuotas en mora (con tope al saldo pendiente).
 */
export function calcularMontoEnMora(prestamo, diasExcluidos = [], festivos = []) {
  if (tieneTablaAmortizacion(prestamo)) {
    const diasMora = calcularDiasMora(prestamo, diasExcluidos, festivos)
    if (diasMora <= 0) return 0
    const { montoEnMora } = calcularEstadoTablaAmortizacion(prestamo)
    const saldo = calcularSaldoPendiente(prestamo)
    return Math.min(saldo, Math.round(montoEnMora))
  }
  // ── G6.1 · EL MODO CLASICO MIDE CONTRA SU CALENDARIO, NO CONTRA UNA FORMULA
  // Aqui se hacia `cuotasEnMora * cuotaDiaria`: una formula plana que no sabe
  // cuando vence cada cobro. En cuota unica eso reclamaba atraso sobre plata
  // que AUN NO VENCE —el pago es al final— y en `fijo` se quedaba corta porque
  // no mira el calendario real.
  //
  // La tabla derivada da las mismas filas que `calcularPrestamo` calcula por
  // dentro y no guarda, asi que la mora sale de lo VENCIDO Y NO CUBIERTO, igual
  // que en los modos que si tienen tabla. Deja de haber dos formas de medir lo
  // mismo segun el modo.
  const derivada = tablaDe(prestamo)
  if (derivada.length > 0) {
    const hoy = inicioDiaColombia()
    const vencido = derivada
      .filter(f => f.fechaEsperada && inicioDiaColombia(f.fechaEsperada) <= hoy)
      .reduce((a, f) => a + (Number(f.cuotaTotal) || 0), 0)
    if (vencido <= 0) return 0
    // `Real` = sin los tipos de ajuste (descuento, interes perdonado): son
    // correcciones contables, no plata que el cliente entrego contra su deuda.
    const pagado = calcularTotalPagadoReal(prestamo)
    const saldo = calcularSaldoPendiente(prestamo)
    return Math.min(saldo, Math.max(0, Math.round(vencido - pagado)))
  }

  // Sin plazo ni total no se puede derivar nada: se queda la via de siempre.
  if (!prestamo?.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0
  const cuotasEnMora = calcularCuotasEnMora(prestamo, diasExcluidos, festivos)
  if (cuotasEnMora <= 0) return 0
  const saldo = calcularSaldoPendiente(prestamo)
  return Math.min(saldo, Math.round(cuotasEnMora * prestamo.cuotaDiaria))
}

/**
 * Monto que el cliente debe pagar hoy para quedar "al día" según cobertura esperada.
 * Incluye lo atrasado y el cobro esperado al corte de hoy (si aplica).
 */
export function calcularMontoParaPonerseAlDia(prestamo, diasExcluidos = [], festivos = []) {
  if (!prestamo || prestamo.estado !== 'activo') return 0

  const saldo = calcularSaldoPendiente(prestamo)
  if (saldo <= 0) return 0

  if (tieneTablaAmortizacion(prestamo)) {
    const { esperadoHastaHoy } = calcularEstadoTablaAmortizacion(prestamo)
    if (esperadoHastaHoy <= 0) return 0
    const pagado = calcularTotalPagadoReal(prestamo)
    const faltante = Math.max(0, Math.round(esperadoHastaHoy - pagado))
    return Math.min(saldo, faltante)
  }

  if (!prestamo.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0

  const periodosEsperados = calcularPeriodosEsperadosHastaHoy(prestamo, diasExcluidos, festivos)
  if (periodosEsperados <= 0) return 0

  const esperadoPorPeriodo = periodosEsperados * prestamo.cuotaDiaria
  const esperado = prestamo.totalAPagar
    ? Math.min(esperadoPorPeriodo, prestamo.totalAPagar)
    : esperadoPorPeriodo

  const pagado = calcularTotalPagadoReal(prestamo)
  const faltante = Math.max(0, Math.round(esperado - pagado))
  return Math.min(saldo, faltante)
}

/**
 * Total de intereses pendientes de cuotas vencidas (modo lineal).
 * Útil para pre-llenar el monto del pago tipo "intereses".
 */
export function calcularInteresesPendientes(prestamo) {
  if (!tieneTablaAmortizacion(prestamo)) return 0
  const hoy = inicioDiaColombia()
  return prestamo.cuotasAmortizacion.reduce((acc, fila) => {
    if (inicioDiaColombia(fila.fechaEsperada) > hoy) return acc
    if ((fila.pagado || 0) >= fila.cuotaTotal) return acc
    return acc + Math.max(0, fila.interes - (fila.interesPagado || 0))
  }, 0)
}

/**
 * Porcentaje de pago completado (0–100).
 */
export function calcularPorcentajePagado(prestamo) {
  if (!prestamo.totalAPagar) return 0
  const pagado = calcularTotalPagadoReal(prestamo)
  return Math.min(100, Math.round((pagado / prestamo.totalAPagar) * 100))
}

/**
 * Calcula los valores de un préstamo a partir de sus parámetros.
 * tasaInteres: porcentaje total sobre el monto prestado (no diario).
 * frecuencia: diario, semanal, quincenal, mensual
 * Ejemplo: monto=100000, tasa=20, dias=30, frecuencia=diario
 *   totalInteres = 100000 × 0.20 = 20000
 *   totalAPagar  = 120000
 *   cuotaDiaria  = 120000 / 30 = 4000
 */
// Cuotas se redondean SIEMPRE al multiplo de $100 hacia arriba (decision de
// negocio: cuotas parejas, total real mostrado desde el inicio). Antes era una
// opcion del usuario (exacto/redondeado/cerrado); se elimino a favor de modos
// de interes claros.
const REDONDEO_CUOTA = 100

// Cuantos periodos de cobro equivalen a 1 "mes" segun la frecuencia. Es la
// pieza clave del modo fijo: hace que el 20% mensual del prestamista cuadre en
// cualquier frecuencia.
//
// INVARIANTE: periodosPorMes * diasPeriodo === 30.
// Un mes son 30 dias, mirado desde cualquier frecuencia. Por eso se deriva de
// DIAS_POR_PERIODO en vez de escribirse a mano: asi no puede volver a
// desalinearse una frecuencia sin que fallen los tests.
//
// Antes 'semanal' estaba fijo en 4, o sea que un mes duraba 28 dias (4 x 7)
// SOLO en esa frecuencia; las otras tres si daban 30 (30x1, 2x15, 1x30). El
// efecto era que el mismo prestamo, con el mismo plazo, cobraba 6,67% mas de
// interes por el solo hecho de cobrarse semanal:
//
//   $250.000 al 20%, plazo 42 dias
//     diario     dura 42 dias, cobraba 42  -> $320.000
//     semanal    dura 42 dias, cobraba 45  -> $325.000   <-- la anomalia
//     quincenal  dura 45 dias, cobraba 45  -> $325.000   (si dura 45)
//     mensual    dura 60 dias, cobraba 60  -> $350.000   (si dura 60)
//
// En quincenal y mensual el total sube porque numPeriodos redondea hacia arriba
// y el prestamo realmente se alarga. En semanal no se alargaba: cobraba de mas.
//
// OJO: esto cambia SOLO la frecuencia semanal. diario, quincenal y mensual dan
// exactamente los mismos numeros que antes (sus valores ya cumplian el
// invariante). Los prestamos ya creados no se recalculan: guardan su
// totalAPagar y su cuota.
// Cuantos periodos de cobro equivalen a 1 "mes" para el prorrateo del interes.
//
// semanal = 4 (NO 30/7 = 4.2857). Es una CONVENCION del gota a gota, no un
// error: el prestamista cuenta 4 semanas = 1 mes. Asi cotiza y asi cobra.
//   8 semanas = 2 meses -> 15% x 2 = 30% (lo que el cliente espera)
//
// Intente "corregirlo" a 30/7 (mes = 30 dias reales) por consistencia
// matematica con las otras frecuencias. Fue un error: DOS clientes reportaron
// que los calculos "ya no dan". La convencion del negocio manda sobre la
// aritmetica del calendario. Revertido.
//
// Objeto literal plano a proposito (no Object.fromEntries): derivarlo con
// codigo se ejecuta al cargar el modulo y puede disparar un TDZ en este modulo
// tan importado.
const PERIODOS_POR_MES = { diario: 30, semanal: 4, quincenal: 2, mensual: 1 }

/**
 * Calcula los terminos de un prestamo segun el modo de interes elegido.
 *
 * Modos:
 *  - 'fijo'   (default): interes = monto × tasa% × meses, con mes = bloque de
 *              frecuencia (4 semanas / 2 quincenas / 30 dias / 1 mes). El interes
 *              sube proporcional al plazo. Es el clasico gota a gota.
 *  - 'unico':  interes = monto × tasa% UNA sola vez, sin importar el plazo.
 *  - 'saldo':  amortizacion frances (cuota fija, interes sobre saldo decreciente).
 *  - 'manual': el prestamista fija la cuota; el total se deriva. Si llega
 *              `cuotaManual > 0`, este modo gana sin importar `modoInteres`.
 *  - 'proporcional' (legacy): el calculo viejo (monto × tasa% × dias/30). Se usa
 *              para llamadas que pasan `redondeo` y no `modoInteres` (renovar /
 *              carga-masiva / onboarding sin migrar). Retrocompatible.
 *
 * Las cuotas siempre se redondean al multiplo de $100 hacia arriba y son parejas
 * (el total a pagar = cuota × numPeriodos).
 */
export function calcularPrestamo({ montoPrestado, tasaInteres, diasPlazo, fechaInicio: fechaInicioRaw, frecuencia = 'diario', cuotaManual, modoInteres, redondeo, interesAdelantado = false, diaCobroMes, diaCobroMes2, capitalExtra, primerCobro: primerCobroImpuesto }) {
  const monto  = Number(montoPrestado)
  const tasa   = Number(tasaInteres)
  const dias   = Number(diasPlazo)
  const freq   = frecuencia || 'diario'
  // Ver normalizarFechaInicio: los llamadores mezclan string 'YYYY-MM-DD' y Date,
  // y el string se parseaba como medianoche UTC (= dia anterior en Bogota).
  const fechaInicio = normalizarFechaInicio(fechaInicioRaw)

  // Retrocompatibilidad: si llega `redondeo` (firma vieja) y no `modoInteres`,
  // usar el calculo legacy 'proporcional' para no cambiar resultados de las
  // llamadas que aun no migran (renovar, carga masiva, onboarding).
  let modo = modoInteres || (redondeo !== undefined ? 'proporcional' : 'fijo')

  const diasPorPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }
  const diasPeriodo = diasPorPeriodo[freq] || 1
  const numPeriodos = Math.ceil(dias / diasPeriodo)

  // Fecha programada del cobro numero n. Es la fuente unica del calendario:
  // la usan la tabla de amortizacion Y la fechaFin, para que el "Vencimiento"
  // que ve el prestamista no pueda contradecir a su propia ultima cuota.
  // El calendario vive ahora en `fechaDePeriodo`, al final de este archivo, y
  // exportado: la tabla derivada de G6 necesita LAS MISMAS fechas para un
  // prestamo que ya existe, y la alternativa era copiar la regla. Aqui no
  // cambia nada — es la misma logica, con un nombre que se puede importar.
  // ── EL PRIMER PERIODO, CUANDO HAY DIA DE CORTE ───────────────────────────
  // «Nosotros tenemos a todos los clientes cerrados con el dia 30. No podemos
  // tener unos el 13, otros el 15. Entonces en la primera cuota me ha tocado
  // hacerlo manual: solo le cobro los intereses que faltan hasta el 30» — un
  // prestamista, 13 ago 2026, con el caso grabado.
  //
  // Tenia que hacerlo a mano porque el sistema cobraba un mes entero durase lo
  // que durase ese primer tramo. Presta $2.000.000 al 5% el 13 y cobra los 30:
  // son 17 dias, $56.780, y se cobraban $100.000. Y si hubiera usado el dia de
  // corte de la app habria sido peor —la primera cuota se le iba al 30 de
  // SEPTIEMBRE, 48 dias, cobrando los mismos $100.000—.
  //
  // Ahora el primer cobro cae en el primer corte de verdad y su interes se cobra
  // por los dias que pasaron. Del segundo en adelante un mes es un mes: no se
  // prorratea febrero contra enero, que es como piensa el prestamista y como
  // esta escrito en la cartulina del cliente.
  //
  // ⚠ SOLO EN LOS MODOS QUE GUARDAN TABLA. En `fijo`, `unico` y `manual` el
  // interes no se devenga por periodo —es un total pactado repartido en cuotas
  // iguales— y no hay donde escribir un primer periodo distinto: sus fechas se
  // derivan al LEER con `fechaDePeriodo`, y tocarlas moveria el calendario de
  // los prestamos que ya existen. Esos siguen igual, a proposito.
  const MODOS_QUE_PRORRATEAN = ['saldo', 'solo_interes', 'lineal', 'lineal_dinamico']
  const hayCorteMensual = freq === 'mensual' && Number.isInteger(diaCobroMes) && diaCobroMes >= 1
  // Quien LLAMA puede imponer el primer cobro, y entonces manda el suyo aunque
  // sea null. Lo usa la pantalla de «cambiar dia de cobro»: un prestamo que ya
  // tiene pagos encima no puede estrenar calendario, porque su primera cuota
  // esta en el pasado y probablemente cobrada. Al crear no se pasa nada y se
  // deriva del dia de corte, que es el caso normal.
  const primerCobro = primerCobroImpuesto !== undefined
    ? (primerCobroImpuesto ? new Date(primerCobroImpuesto) : null)
    : (hayCorteMensual ? primerCobroMensual(fechaInicio, diaCobroMes) : null)
  const diasPrimerPeriodo = primerCobro
    ? Math.round((primerCobro - fechaInicio) / 86400000)
    : diasPeriodo
  // La FECHA se corrige en todos los modos —«cobro los 30» significa el 30 que
  // viene, y eso no depende de como se calcule el interes—. El PRORRATEO solo
  // donde hay tabla que lo pueda escribir: en `fijo`, `unico` y `manual` el
  // interes es un total pactado repartido en cuotas iguales, no un devengo.
  const prorrateaPrimero = !!primerCobro
    && MODOS_QUE_PRORRATEAN.includes(modo)
    && diasPrimerPeriodo !== diasPeriodo
  const factorPrimerPeriodo = prorrateaPrimero ? diasPrimerPeriodo / diasPeriodo : 1

  // ── LA CUOTA QUE SE ANUNCIA ──────────────────────────────────────────────
  // La primera fila puede venir prorrateada, y ESA no es «la cuota» del
  // prestamo: es la del tramo corto. Guardarla como `cuotaDiaria` haria que la
  // tarjeta del cliente dijera «$56.667 mensuales» en un prestamo de $100.000
  // al mes, y de ahi cuelgan la mora y las cuotas pendientes, que dividen por
  // este numero. Se anuncia el primer periodo COMPLETO.
  const cuotaTitular = (tabla) =>
    tabla[prorrateaPrimero && tabla.length > 1 ? 1 : 0]?.cuotaTotal || 0

  /** El factor del periodo `n`: solo el primero puede no ser un periodo entero. */
  const factorDe = (n) => (n === 1 ? factorPrimerPeriodo : 1)

  const calcFechaEsperada = (n) =>
    fechaDePeriodo(n, { fechaInicio, freq, diasPeriodo, diaCobroMes, diaCobroMes2, primerCobro })

  // El vencimiento es, por definicion, el dia del ultimo cobro programado.
  // Antes era fechaInicio + diasPlazo, que no coincidia con la ultima cuota:
  // en semanal se quedaba 2 dias corto (26 cobros x 7 = 182 dias, no 180) y en
  // mensual, con el calendario de meses, hasta 4 dias.
  const fechaFin = calcFechaEsperada(numPeriodos)

  const ceil100 = (v) => Math.max(REDONDEO_CUOTA, Math.ceil(v / REDONDEO_CUOTA) * REDONDEO_CUOTA)

  const empaquetar = (totalAPagar, cuota, modoUsado) => ({
    totalAPagar,
    cuotaDiaria: cuota,
    ultimaCuota: cuota,
    totalInteres: Math.max(0, totalAPagar - monto),
    fechaFin,
    frecuencia: freq,
    diasPeriodo,
    numPeriodos,
    modoInteres: modoUsado,
    modoManual: modoUsado === 'manual',
    // `primerCobro` sale en TODOS los modos con dia de corte porque es lo que se
    // guarda en la fila: sin el, al leer se volveria a derivar el calendario
    // viejo y el prestamo tendria dos verdades. El resto es para que la pantalla
    // pueda decir POR QUE la primera cuota es distinta: una cuota mas baja sin
    // explicacion se lee como un error del sistema.
    ...(primerCobro ? { primerCobro } : {}),
    ...(prorrateaPrimero ? { prorrateoPrimerPeriodo: true, diasPrimerPeriodo } : {}),
  })

  // ── Modo manual: la cuota la fija el prestamista (gana sobre cualquier modo,
  // excepto modos con tabla que soportan cuotaManual como parametro propio).
  // Si cuota × periodos < capital + interes minimo, auto-extiende el plazo.
  const cuotaManualNum = Number(cuotaManual)
  if (cuotaManualNum && cuotaManualNum > 0 && modo !== 'saldo') {
    const cuota = Math.round(cuotaManualNum)
    const meses = numPeriodos / (PERIODOS_POR_MES[freq] || 1)
    const interesFijo = Math.round(monto * (tasa / 100) * meses)
    const minTotal = monto + interesFijo
    let periodosReales = numPeriodos
    if (cuota * periodosReales < minTotal) {
      periodosReales = Math.ceil(minTotal / cuota)
    }
    const totalReal = cuota * periodosReales
    // Mismo criterio que arriba: el vencimiento es el ultimo cobro programado.
    // Con cuota manual el plazo se auto-extiende, asi que se recalcula sobre
    // periodosReales (que puede ser mayor a numPeriodos).
    const fechaFinManual = calcFechaEsperada(periodosReales)
    return {
      totalAPagar: totalReal,
      cuotaDiaria: cuota,
      ultimaCuota: cuota,
      totalInteres: Math.max(0, totalReal - monto),
      fechaFin: fechaFinManual,
      frecuencia: freq,
      diasPeriodo,
      numPeriodos: periodosReales,
      modoInteres: 'manual',
      modoManual: true,
      // Ver `empaquetar`: sin esto el prestamo se guardaria sin su primer cobro
      // y al leerlo se derivaria otra vez el calendario viejo.
      ...(primerCobro ? { primerCobro } : {}),
      // Tasa + cuota + plazo son tres datos que pueden contradecirse. Cuando la
      // cuota no alcanza para cubrir el interes de la tasa en el plazo pedido, el
      // calculo alarga el plazo (arriba) para no cobrar menos de lo que el
      // prestamista escribio. Eso estaba pasando EN SILENCIO: un caso real fue
      // $3.000.000 al 20% "a 180 dias" con cuota de $300.000 quincenal — el
      // prestamista esperaba 12 x 300.000 = $3.600.000 y el sistema armo 22
      // cuotas por $6.600.000 sin avisar. Estos campos existen para que la UI lo
      // muestre ANTES de confirmar y el pueda subir la cuota o bajar la tasa.
      ...(periodosReales > numPeriodos ? {
        plazoExtendido: true,
        periodosPedidos: numPeriodos,
        periodosReales,
        diasPedidos: dias,
        diasReales: periodosReales * diasPeriodo,
        totalSinExtender: cuota * numPeriodos,
      } : {}),
    }
  }

  // ── Modo lineal: amortizacion con capital fijo por periodo + interes sobre
  // saldo restante (cuota TOTAL decreciente periodo a periodo). A diferencia
  // de los demas modos, aqui no hay una sola "cuota" — se genera una tabla
  // de amortizacion (tablaAmortizacion) que es la fuente de verdad.
  if (modo === 'lineal') {
    const extraMapLineal = new Map()
    if (Array.isArray(capitalExtra)) {
      capitalExtra.forEach(e => {
        if (e.numeroPeriodo > 0 && e.numeroPeriodo <= numPeriodos && Number(e.monto) > 0) {
          extraMapLineal.set(e.numeroPeriodo, Math.round(Number(e.monto)))
        }
      })
    }
    const capitalPorPeriodo = monto / numPeriodos
    const capitalRedondeado = Math.round(capitalPorPeriodo)
    const tablaAmortizacion = []
    let saldoRestante = monto
    for (let n = 1; n <= numPeriodos; n++) {
      if (saldoRestante <= 0) {
        tablaAmortizacion.push({
          numeroPeriodo: n, capital: 0, interes: 0, cuotaTotal: 0,
          saldoRestante: 0, fechaEsperada: calcFechaEsperada(n),
        })
        continue
      }
      const interesPeriodo = saldoRestante * (tasa / 100) * factorDe(n)
      const extra = extraMapLineal.get(n) || 0
      const capitalBase = Math.min(capitalRedondeado, saldoRestante)
      const capitalConExtra = Math.min(capitalBase + extra, saldoRestante)
      saldoRestante = Math.max(0, saldoRestante - capitalConExtra)
      const fechaEsperada = calcFechaEsperada(n)
      tablaAmortizacion.push({
        numeroPeriodo: n,
        capital: Math.round(capitalConExtra),
        interes: Math.round(interesPeriodo),
        cuotaTotal: Math.round(capitalConExtra) + Math.round(interesPeriodo),
        saldoRestante: Math.round(saldoRestante),
        fechaEsperada,
        ...(extra > 0 ? { esExtra: true, montoExtra: extra } : {}),
      })
    }
    const totalAPagar = tablaAmortizacion.reduce((acc, p) => acc + p.cuotaTotal, 0)
    const cuotaInicial = cuotaTitular(tablaAmortizacion)
    const cuotaFinal = tablaAmortizacion[numPeriodos - 1]?.cuotaTotal || 0
    return {
      ...empaquetar(totalAPagar, cuotaInicial, 'lineal'),
      ultimaCuota: cuotaFinal,
      tablaAmortizacion,
      ...(extraMapLineal.size > 0 ? { capitalExtra: [...extraMapLineal.entries()].map(([numeroPeriodo, m]) => ({ numeroPeriodo, monto: m })) } : {}),
    }
  }

  // ── Modo lineal dinamico: la tabla de amortizacion inicial se genera
  // IGUAL que en 'lineal' (capital fijo por periodo + interes sobre saldo
  // restante). La diferencia esta en el post-procesamiento de cada pago
  // (ver app/api/prestamos/[id]/pagos/route.js): tras un pago normal
  // (completo/parcial), las cuotas futuras se recalculan sobre el capital
  // REAL restante (en vez de solo llenar en cascada la cuota fija original).
  if (modo === 'lineal_dinamico') {
    const extraMapLineal = new Map()
    if (Array.isArray(capitalExtra)) {
      capitalExtra.forEach(e => {
        if (e.numeroPeriodo > 0 && e.numeroPeriodo <= numPeriodos && Number(e.monto) > 0) {
          extraMapLineal.set(e.numeroPeriodo, Math.round(Number(e.monto)))
        }
      })
    }
    const capitalPorPeriodo = monto / numPeriodos
    const capitalRedondeado = Math.round(capitalPorPeriodo)
    const tablaAmortizacion = []
    let saldoRestante = monto
    for (let n = 1; n <= numPeriodos; n++) {
      if (saldoRestante <= 0) {
        tablaAmortizacion.push({
          numeroPeriodo: n, capital: 0, interes: 0, cuotaTotal: 0,
          saldoRestante: 0, fechaEsperada: calcFechaEsperada(n),
        })
        continue
      }
      const interesPeriodo = saldoRestante * (tasa / 100) * factorDe(n)
      const extra = extraMapLineal.get(n) || 0
      const capitalBase = Math.min(capitalRedondeado, saldoRestante)
      const capitalConExtra = Math.min(capitalBase + extra, saldoRestante)
      saldoRestante = Math.max(0, saldoRestante - capitalConExtra)
      const fechaEsperada = calcFechaEsperada(n)
      tablaAmortizacion.push({
        numeroPeriodo: n,
        capital: Math.round(capitalConExtra),
        interes: Math.round(interesPeriodo),
        cuotaTotal: Math.round(capitalConExtra) + Math.round(interesPeriodo),
        saldoRestante: Math.round(saldoRestante),
        fechaEsperada,
        ...(extra > 0 ? { esExtra: true, montoExtra: extra } : {}),
      })
    }
    const totalAPagar = tablaAmortizacion.reduce((acc, p) => acc + p.cuotaTotal, 0)
    const cuotaInicial = cuotaTitular(tablaAmortizacion)
    const cuotaFinal = tablaAmortizacion[numPeriodos - 1]?.cuotaTotal || 0
    return {
      ...empaquetar(totalAPagar, cuotaInicial, 'lineal_dinamico'),
      ultimaCuota: cuotaFinal,
      tablaAmortizacion,
      ...(extraMapLineal.size > 0 ? { capitalExtra: [...extraMapLineal.entries()].map(([numeroPeriodo, m]) => ({ numeroPeriodo, monto: m })) } : {}),
    }
  }

  // ── Modo solo interes (globo): el cliente paga solo interes cada periodo,
  // el capital completo se devuelve en la ultima cuota (balloon payment).
  // Con interesAdelantado: el interes se cobra "por adelantado", es decir
  // las cuotas 1..n-1 cobran interes y la ultima cuota es solo capital.
  // capitalExtra: [{numeroPeriodo, monto}] — abonos a capital programados en
  // cuotas intermedias (ej: primas). Reducen saldo y el interes futuro baja.
  if (modo === 'solo_interes') {
    const extraMap = new Map()
    if (Array.isArray(capitalExtra)) {
      capitalExtra.forEach(e => {
        if (e.numeroPeriodo > 0 && e.numeroPeriodo < numPeriodos && e.monto > 0) {
          extraMap.set(e.numeroPeriodo, Math.round(Number(e.monto)))
        }
      })
    }
    const tablaAmortizacion = []
    let saldoRestante = monto
    for (let n = 1; n <= numPeriodos; n++) {
      const esUltimo = n === numPeriodos
      const interesPorPeriodo = saldoRestante * (tasa / 100) * factorDe(n)
      const extra = extraMap.get(n) || 0
      const capitalPeriodo = esUltimo ? saldoRestante : extra
      const interesPeriodo = (interesAdelantado && esUltimo) ? 0 : interesPorPeriodo
      const cuotaTotal = capitalPeriodo + interesPeriodo
      saldoRestante -= capitalPeriodo
      const fechaEsperada = calcFechaEsperada(n)
      tablaAmortizacion.push({
        numeroPeriodo: n,
        capital: Math.round(capitalPeriodo),
        interes: Math.round(interesPeriodo),
        cuotaTotal: Math.round(cuotaTotal),
        saldoRestante: Math.round(saldoRestante),
        fechaEsperada,
      })
    }
    const totalAPagar = tablaAmortizacion.reduce((acc, p) => acc + p.cuotaTotal, 0)
    return {
      ...empaquetar(totalAPagar, cuotaTitular(tablaAmortizacion), 'solo_interes'),
      ultimaCuota: tablaAmortizacion[numPeriodos - 1]?.cuotaTotal || 0,
      tablaAmortizacion,
      interesAdelantado,
    }
  }

  // ── Helper: parsea capitalExtra a un Map { numeroPeriodo -> monto }
  const parseExtras = () => {
    const m = new Map()
    if (!Array.isArray(capitalExtra) || !capitalExtra.length) return m
    capitalExtra.forEach(e => {
      if (e.numeroPeriodo > 0 && e.numeroPeriodo <= numPeriodos && Number(e.monto) > 0) {
        m.set(e.numeroPeriodo, Math.round(Number(e.monto)))
      }
    })
    return m
  }

  // ── Modo sobre saldo: amortizacion frances (cuota fija, interes decreciente)
  // Con capitalExtra: genera tabla donde los periodos con extra inyectan capital
  // adicional que reduce el saldo y el interes futuro. La cuota regular se
  // recalcula mas baja.
  // Con cuotaManual: el usuario define la cuota fija en vez de calcularla con
  // la formula francesa. La ultima cuota ajusta para cerrar el saldo.
  if (modo === 'saldo') {
    const i = (tasa / 100) / (PERIODOS_POR_MES[freq] || 30)
    const extraMap = parseExtras()
    const cuotaManualNum = Number(cuotaManual) || 0

    let cuotaRegular
    if (cuotaManualNum > 0) {
      cuotaRegular = cuotaManualNum
    } else if (extraMap.size === 0) {
      let cuotaTeorica
      if (i <= 0 || numPeriodos <= 0) {
        cuotaTeorica = numPeriodos > 0 ? monto / numPeriodos : monto
      } else {
        const factor = Math.pow(1 + i, numPeriodos)
        cuotaTeorica = monto * (i * factor) / (factor - 1)
      }
      cuotaRegular = ceil100(cuotaTeorica)
    } else {
      // Con extras: busqueda binaria de la cuota regular que amortiza a cero.
      let lo = 0, hi = monto * 2
      for (let iter = 0; iter < 80; iter++) {
        const mid = (lo + hi) / 2
        let saldo = monto
        for (let n = 1; n <= numPeriodos; n++) {
          const intP = saldo * i
          const capP = mid - intP + (extraMap.get(n) || 0)
          saldo -= capP
        }
        if (saldo > 0.5) lo = mid; else hi = mid
      }
      cuotaRegular = ceil100((lo + hi) / 2)
    }

    // Guardia: una cuota que no cubre ni el interes del primer periodo NO
    // amortiza nunca. El capital se queda quieto, el interes se repite igual
    // mes a mes y toda la deuda se apila en la ultima cuota — un frances que
    // degenera en globo. Reportado con datos reales: $7.500.907 al 1,8% mensual
    // a 69 meses con cuota fijada en $110.700, cuando el interes del primer mes
    // son $135.016. El sistema mostraba capital $0 en 68 filas, una ultima cuota
    // de $7.635.923 y un total de $15.163.523 (contra $13.15M del frances real),
    // sin una sola advertencia. Peor: la fila ni siquiera cuadraba, porque
    // mostraba la cuota fijada mientras el interes era otro.
    //
    // No se lanza excepcion porque esta funcion alimenta la vista previa en vivo
    // del formulario; se devuelven los datos para que la UI y la API decidan.
    const interesPrimerPeriodo = Math.round(monto * i)
    if (cuotaManualNum > 0 && cuotaRegular <= interesPrimerPeriodo) {
      let cuotaSugerida
      if (i <= 0 || numPeriodos <= 0) {
        cuotaSugerida = numPeriodos > 0 ? monto / numPeriodos : monto
      } else {
        const factor = Math.pow(1 + i, numPeriodos)
        cuotaSugerida = monto * (i * factor) / (factor - 1)
      }
      return {
        ...empaquetar(0, cuotaRegular, 'saldo'),
        tablaAmortizacion: [],
        cuotaInsuficiente: true,
        interesPrimerPeriodo,
        cuotaMinima: interesPrimerPeriodo + 1,
        cuotaSugerida: ceil100(cuotaSugerida),
      }
    }

    const tablaAmortizacion = []
    let saldoRestante = monto
    for (let n = 1; n <= numPeriodos; n++) {
      // Dos intereses, y la diferencia entre ellos es la decision del prestamista:
      //  · `interesPleno` — el mes entero. Es el que reparte el CAPITAL, para
      //    que prorratear el primer periodo NO reprograme las once cuotas que
      //    vienen detras. El cliente ya tiene «12 cuotas de $225.700» escrito.
      //  · `interesPeriodo` — lo que de verdad se devengo. Solo el primero puede
      //    ser menor, y ese descuento se lo lleva entero la primera cuota.
      // Al reves —dejar que el capital absorbiera el descuento— la primera cuota
      // seguia costando lo mismo y la barata era la ULTIMA, dentro de un año.
      // Lo que el prestamista negocia con su cliente es la primera.
      const interesPleno = Math.round(saldoRestante * i)
      const interesPeriodo = Math.round(saldoRestante * i * factorDe(n))
      const extra = extraMap.get(n) || 0
      const esUltimo = n === numPeriodos
      const capitalRegular = cuotaRegular - interesPleno
      const capitalTotal = capitalRegular + extra
      const capitalReal = esUltimo ? saldoRestante : Math.min(Math.max(0, capitalTotal), saldoRestante)
      // `capitalReal` YA lleva el extra dentro; sumarlo otra vez lo cobraria dos
      // veces. Es la misma cuenta de antes (`cuotaRegular + extra`) escrita de
      // forma que tambien cuadre cuando el saldo topa el capital.
      const interesReal = interesPeriodo
      const cuotaTotal = capitalReal + interesReal
      saldoRestante = Math.max(0, saldoRestante - capitalReal)
      tablaAmortizacion.push({
        numeroPeriodo: n,
        capital: Math.round(capitalReal),
        interes: interesReal,
        cuotaTotal: Math.round(cuotaTotal),
        saldoRestante: Math.round(saldoRestante),
        fechaEsperada: calcFechaEsperada(n),
        esExtra: extra > 0,
        montoExtra: extra,
      })
    }
    const totalAP = tablaAmortizacion.reduce((a, r) => a + r.cuotaTotal, 0)
    return {
      ...empaquetar(totalAP, cuotaRegular, 'saldo'),
      ultimaCuota: tablaAmortizacion[numPeriodos - 1]?.cuotaTotal || 0,
      tablaAmortizacion,
      capitalExtra: [...extraMap.entries()].map(([numeroPeriodo, m]) => ({ numeroPeriodo, monto: m })),
    }
  }

  // ── Modos fijo / unico / proporcional: interes total upfront, cuota pareja
  let interesTotal
  if (modo === 'unico') {
    interesTotal = monto * (tasa / 100)
  } else if (modo === 'proporcional') {
    interesTotal = monto * (tasa / 100) * (dias / 30)
  } else {
    // 'fijo' (default): meses = numPeriodos / periodosPorMes (bloques de frecuencia)
    modo = 'fijo'
    const meses = numPeriodos / (PERIODOS_POR_MES[freq] || 30)
    interesTotal = monto * (tasa / 100) * meses
  }

  const totalTeorico = monto + interesTotal
  const extraMap = parseExtras()

  if (extraMap.size === 0) {
    let cuota, totalAPagar
    if (numPeriodos <= 1) {
      cuota = ceil100(totalTeorico)
      totalAPagar = cuota
    } else {
      cuota = ceil100(totalTeorico / numPeriodos)
      totalAPagar = cuota * numPeriodos
    }
    return empaquetar(totalAPagar, cuota, modo)
  }

  // Con extras: el total a pagar permanece igual. Los abonos extra se restan
  // de la cuota regular para que el usuario pague menos cada periodo normal.
  const sumExtras = [...extraMap.values()].reduce((a, b) => a + b, 0)
  const totalBase = ceil100(totalTeorico / numPeriodos) * numPeriodos
  const cuotaRegular = ceil100((totalBase - sumExtras) / numPeriodos)
  const totalAPagarFinal = cuotaRegular * numPeriodos + sumExtras

  const interesPorPeriodo = Math.round(interesTotal / numPeriodos)
  const capitalRegPorPeriodo = cuotaRegular - interesPorPeriodo
  const tablaAmortizacion = []
  let saldoRestante = monto
  for (let n = 1; n <= numPeriodos; n++) {
    const extra = extraMap.get(n) || 0
    const capitalBase = Math.min(capitalRegPorPeriodo, saldoRestante)
    const capitalConExtra = Math.min(capitalBase + extra, saldoRestante)
    saldoRestante = Math.max(0, saldoRestante - capitalConExtra)
    tablaAmortizacion.push({
      numeroPeriodo: n,
      capital: capitalConExtra,
      interes: interesPorPeriodo,
      cuotaTotal: capitalConExtra + interesPorPeriodo,
      saldoRestante: Math.round(saldoRestante),
      fechaEsperada: calcFechaEsperada(n),
      esExtra: extra > 0,
      montoExtra: extra,
    })
  }

  const totalReal = tablaAmortizacion.reduce((a, r) => a + r.cuotaTotal, 0)

  return {
    ...empaquetar(totalReal, cuotaRegular, modo),
    ultimaCuota: tablaAmortizacion[numPeriodos - 1]?.cuotaTotal || 0,
    tablaAmortizacion,
    capitalExtra: [...extraMap.entries()].map(([numeroPeriodo, m]) => ({ numeroPeriodo, monto: m })),
  }
}

/**
 * Calcula la fecha programada de la próxima cuota pendiente.
 * Se basa en monto pagado real (no en cantidad de pagos) y usa
 * la misma lógica de días sin cobro de calcularDiasMora.
 * Devuelve un Date (medianoche local) o null si no aplica.
 */
export function calcularProximoCobro(prestamo, diasExcluidos = [], festivos = []) {
  if (!prestamo?.fechaInicio) return null
  if (prestamo.estado && prestamo.estado !== 'activo') return null
  if (!prestamo.cuotaDiaria || prestamo.cuotaDiaria <= 0) return null

  if (prestamo.proximoCobroManual) {
    const manual = new Date(prestamo.proximoCobroManual)
    if (!isNaN(manual.getTime())) return manual
  }

  // Modo lineal/solo_interes: la primera cuota que lo pagado no alcanza a
  // cubrir. La tabla es la fuente de verdad para fechas (incluye diaCobroMes).
  //
  // ⚠ ERAN DOS RECORRIDOS: el primero saltaba las cuotas con el interes al dia
  // y el segundo recogia «la primera con capital pendiente». El resultado es que
  // un prestamo `lineal` con el interes de julio pagado y el capital de julio
  // vencido devolvia «proximo cobro: 12 de agosto»: una fecha en el FUTURO
  // mientras el cliente debia plata desde hacia un mes, y por eso tampoco salia
  // en Cobros de hoy. Ver `coberturaDeLaTabla`.
  if (tieneTablaAmortizacion(prestamo)) {
    const pendiente = coberturaDeLaTabla(prestamo).find((c) => !c.cubierta)
    return pendiente ? new Date(pendiente.fila.fechaEsperada) : null
  }

  const freq = prestamo.frecuencia || 'diario'
  const diasPeriodo = obtenerDiasPorPeriodo(freq)

  const inicioMed = inicioDiaColombia(prestamo.fechaInicio)

  // Cobertura por monto real pagado (excluyendo ajustes).
  // Prefiere totalPagado denormalizado; cae a iterar pagos si no esta.
  const pagado = calcularTotalPagadoReal(prestamo)
  const periodosCubiertos = Math.floor(pagado / prestamo.cuotaDiaria)

  const totalPeriodos = totalPeriodosDelPrestamo(prestamo, diasPeriodo)

  // Si ya cubrió todas las cuotas esperadas, no hay próximo cobro.
  if (totalPeriodos && periodosCubiertos >= totalPeriodos) return null

  // Cuota pendiente inmediata: N = cubiertas + 1.
  const proximaCuotaNum = periodosCubiertos + 1
  const diasCobrablesObjetivo = proximaCuotaNum * diasPeriodo

  let fechaBase
  // Para frecuencias no diarias el calendario es simple: cada periodo son N dias
  // calendario (7/15/30). Los diasSinCobro solo aplican para reprogramar dia a
  // dia en frecuencia diaria. Si para semanal interpretaramos diasSinCobro,
  // una ruta con [0..5] (cobra solo sabado) llevaria la 1a cuota a 7 sabados
  // despues — bug reportado por el cliente.
  const tieneExclusiones = (diasExcluidos && diasExcluidos.length > 0) || (festivos && festivos.length > 0)
  if (freq !== 'diario' || !tieneExclusiones) {
    fechaBase = new Date(inicioMed.getTime() + diasCobrablesObjetivo * DAY_MS)
  } else {
    // Diario con diasSinCobro y/o festivos: buscar la fecha cuyo "dia cobrable
    // transcurrido" (descontando excluidos y festivos) coincida con la cuota objetivo.
    fechaBase = new Date(inicioMed.getTime() + diasCobrablesObjetivo * DAY_MS)
    let fecha = new Date(inicioMed)
    const maxIteraciones = 5000
    for (let i = 0; i < maxIteraciones; i++) {
      const diasCobrables = calcularDiasTranscurridosCobrables(inicioMed, fecha, diasExcluidos, festivos)
      if (diasCobrables >= diasCobrablesObjetivo) { fechaBase = fecha; break }
      fecha = new Date(fecha.getTime() + DAY_MS)
    }
  }

  // Mensual va por calendario de meses (mismo dia del mes), no por bloques de 30
  // dias — ver sumarMeses. Sin ancla explicita se usa el dia de la fechaInicio.
  // No pasa por aplicarDiaAncla: sumarMeses ya dejo la fecha en el dia correcto,
  // y re-aplicarlo puede empujar un mes de mas si el server no corre en Bogota.
  // ⚠ EL TERCER SITIO QUE CALCULA FECHAS MENSUALES. Los otros dos son
  // `fechaDePeriodo` y la tabla derivada; si este se queda con el calendario
  // viejo, el prestamo dice una fecha en su tabla y otra en «proximo cobro».
  const anclaMes = Number.isInteger(prestamo?.diaCobroMes) ? prestamo.diaCobroMes : null
  let proximoCobro
  if (freq === 'mensual' && prestamo?.primerCobro) {
    const base = new Date(prestamo.primerCobro)
    proximoCobro = proximaCuotaNum <= 1 ? base : sumarMeses(base, proximaCuotaNum - 1, anclaMes)
  } else if (freq === 'mensual') {
    proximoCobro = sumarMeses(inicioMed, proximaCuotaNum, anclaMes)
  } else {
    proximoCobro = aplicarDiaAncla(fechaBase, prestamo, freq)
  }

  // Saltar festivos en la fecha resultante (para cualquier frecuencia).
  if (festivos && festivos.length > 0 && proximoCobro) {
    let maxIter = 60
    while (maxIter-- > 0 && esFestivo(proximoCobro, festivos)) {
      proximoCobro = new Date(proximoCobro.getTime() + DAY_MS)
    }
  }

  return proximoCobro
}

// Ajusta la fecha base al dia ancla configurado (si existe) segun la frecuencia.
// Para semanal/quincenal: usa diaCobroSemana (0=dom..6=sab) o diaCobroMes (1-31).
// Para mensual: fija diaCobroMes del mes (clamp al ultimo dia del mes si no existe).
// Para diario o sin ancla: devuelve la fecha base sin cambios.
function aplicarDiaAncla(fechaBase, prestamo, freq) {
  if (!fechaBase) return fechaBase

  if ((freq === 'semanal' || freq === 'quincenal') && Number.isInteger(prestamo?.diaCobroSemana)) {
    const target = ((prestamo.diaCobroSemana % 7) + 7) % 7
    // getUTCDay, no getDay: fechaBase lleva las 05:00Z del convenio de
    // medianoche-Bogota, y en un server al oeste de UTC-5 el dia local es el anterior.
    const actual = fechaBase.getUTCDay()
    const delta = (target - actual + 7) % 7
    if (delta === 0) return fechaBase
    return new Date(fechaBase.getTime() + delta * DAY_MS)
  }

  if ((freq === 'mensual' || freq === 'semanal' || freq === 'quincenal') && Number.isInteger(prestamo?.diaCobroMes)) {
    const anclas = [prestamo.diaCobroMes]
    if (freq === 'quincenal' && Number.isInteger(prestamo?.diaCobroMes2)) {
      anclas.push(prestamo.diaCobroMes2)
    }

    // Las candidatas se construyen CLONANDO fechaBase, para que conserven su
    // hora y la comparacion de abajo compare DIAS y no relojes.
    //
    // Antes se creaban con `new Date(y, m, dia)`, o sea medianoche LOCAL del
    // server. fechaBase, en cambio, viene del convenio del sistema: medianoche
    // de Bogota expresada en UTC, o sea las 05:00Z. En un server que corre en
    // UTC — como el de produccion — la medianoche queda ANTES de las 05:00, asi
    // que `fecha >= fechaBase` daba false aun siendo el mismo dia y empujaba el
    // cobro al mes siguiente. Resultado: todo prestamo con dia de cobro fijo
    // mostraba su proximo cobro un mes tarde. En un equipo en Bogota las dos
    // fechas coinciden al milisegundo y el bug es invisible: por eso no salio
    // en tests ni en desarrollo, solo en produccion.
    //
    // setDate(1) antes de mover el mes evita el desborde de setMonth
    // (31 de enero + 1 mes da 3 de marzo en JS, no 28 de febrero).
    const enMes = (offsetMeses, ancla) => {
      const f = new Date(fechaBase)
      f.setUTCDate(1)
      f.setUTCMonth(f.getUTCMonth() + offsetMeses)
      const ultimoDia = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0)).getUTCDate()
      f.setUTCDate(Math.min(Math.max(1, ancla), ultimoDia))
      return f
    }

    const candidatas = []
    for (const ancla of anclas) {
      const esteMes = enMes(0, ancla)
      candidatas.push(esteMes >= fechaBase ? esteMes : enMes(1, ancla))
    }

    candidatas.sort((a, b) => a.getTime() - b.getTime())
    return candidatas[0]
  }

  return fechaBase
}

/**
 * Indica si, al día de hoy (Colombia), el préstamo aún tiene cobro pendiente.
 * Se basa en cobertura esperada por calendario cobrable, no en pagoHoy.
 */
export function tieneCobroPendienteHoy(prestamo, diasExcluidos = [], festivos = []) {
  if (!prestamo || prestamo.estado !== 'activo') return false
  if (!prestamo.cuotaDiaria || prestamo.cuotaDiaria <= 0) return false
  if (calcularSaldoPendiente(prestamo) <= 0) return false

  const inicio = inicioDiaColombia(prestamo.fechaInicio)
  const hoy = inicioDiaColombia()
  if (inicio > hoy) return false

  // La visita reagendada A MANO manda sobre el calendario.
  //
  // calcularProximoCobro ya devolvia proximoCobroManual antes que nada, pero esta
  // funcion lo ignoraba y solo miraba dias transcurridos contra lo pagado. Las dos
  // alimentan la MISMA pantalla: la tarjeta del cliente decia "Cobra hoy" (que sale
  // del proximo cobro) y el agrupador lo mandaba a "Proximos y al dia" (que sale de
  // aca). Reportado por un prestamista que reagendo 4 visitas para hoy y despues no
  // las encontro: su mes arrancaba el 1 y aun no se cumplia, asi que por calendario
  // "no le tocaba", aunque el hubiera dicho que si.
  //
  // Si la movio al futuro, hoy NO hay que cobrarle — es justo para lo que sirve
  // reagendar. Mismo criterio que calcularProximoCobro, para que no se contradigan.
  if (prestamo.proximoCobroManual) {
    return inicioDiaColombia(prestamo.proximoCobroManual) <= hoy
  }

  // Modos con tabla (Decreciente, Globo, Dinamico, Sobre saldo): la TABLA es la
  // fuente de verdad, igual que en calcularDiasMora y calcularProximoCobro.
  //
  // Esta era la ultima funcion de "hoy" que la ignoraba, y por eso se contradecia
  // con la ficha del cliente. Hacia la cuenta ingenua `dias transcurridos /
  // dias por periodo` y comparaba contra `cuotaDiaria`, que en estos modos es
  // solo la PRIMERA cuota. Caso real: un Decreciente quincenal iniciado el 3 de
  // julio con una cuota pagada daba "1 periodo transcurrido, 1 cuota pagada, al
  // dia" — mientras su tabla mostraba la cuota del 24 de julio sin pagar y la
  // tarjeta decia "2d Mora · $75.000". El cliente quedaba en "Proximos y al dia"
  // debiendo plata vencida.
  //
  // Mismo criterio que calcularEstadoTablaAmortizacion y calcularProximoCobro:
  // una cuota ya vencida cuenta como pendiente mientras lo pagado no alcance a
  // cubrirla. Ver `coberturaDeLaTabla`.
  if (tieneTablaAmortizacion(prestamo)) {
    return coberturaDeLaTabla(prestamo).some(({ fila, cubierta }) =>
      !cubierta && inicioDiaColombia(fila.fechaEsperada) <= hoy)
  }

  const freq = prestamo.frecuencia || 'diario'
  const diasPeriodo = obtenerDiasPorPeriodo(freq)
  // diasSinCobro solo aplica a frecuencia diaria.
  const diasTranscurridos = freq === 'diario'
    ? calcularDiasTranscurridosCobrables(inicio, hoy, diasExcluidos, festivos)
    : Math.floor((hoy.getTime() - inicio.getTime()) / DAY_MS)

  let periodosEsperados = Math.floor(diasTranscurridos / diasPeriodo)

  const totalPeriodos = totalPeriodosDelPrestamo(prestamo, diasPeriodo)
  if (totalPeriodos) {
    periodosEsperados = Math.min(periodosEsperados, totalPeriodos)
  }

  if (periodosEsperados <= 0) return false

  const esperadoPorPeriodo = periodosEsperados * prestamo.cuotaDiaria
  const esperado = prestamo.totalAPagar
    ? Math.min(esperadoPorPeriodo, prestamo.totalAPagar)
    : esperadoPorPeriodo

  // Prefiere totalPagado denormalizado; cae a iterar pagos si no esta.
  const pagado = calcularTotalPagadoReal(prestamo)

  return pagado < esperado
}

/**
 * Indica si el prestamo TENIA un periodo de cobro programado para hoy
 * segun frecuencia + fecha inicio + dias excluidos (cliente/ruta/org).
 *
 * Diferencia con tieneCobroPendienteHoy: NO mira pagado vs esperado.
 * Es decir, devuelve true tanto si esta pendiente como si ya se pago.
 *
 * Util para sumar la META del dia (esperadoHoy): debe contar toda cuota
 * que tocaba cobrar hoy, no solo las pendientes.
 *
 * `hoySinCobro` es el resultado precalculado por el llamador de
 * `esHoySinCobro(diasExcluidos) || esHoyFestivo(festivos)` para evitar
 * imports circulares con lib/dias-sin-cobro.
 */
export function tienePeriodoEsperadoHoy(prestamo, hoySinCobro = false, diasExcluidos = [], festivos = []) {
  if (!prestamo) return false
  if (!prestamo.cuotaDiaria || prestamo.cuotaDiaria <= 0) return false

  const inicio = inicioDiaColombia(prestamo.fechaInicio)
  const hoy = inicioDiaColombia()
  if (inicio > hoy) return false

  const freq = prestamo.frecuencia || 'diario'

  // REGLA CLAVE: el primer cobro es fechaInicio + 1 periodo (no el dia de inicio).
  // Un prestamo creado HOY con frecuencia diaria tiene su primer cobro MANANA.
  // Por eso un cliente nuevo NO debe sumar a la meta de su dia de creacion.
  //
  // Para saber si "hoy tocaba cobrar" independiente de si ya se pago, evaluamos
  // calcularProximoCobro sobre una copia del prestamo SIN pagos (pagado = 0).
  // Eso da la fecha del PRIMER cobro programado. Si esa fecha es <= hoy, ya
  // estamos dentro del calendario de cobro.
  const prestamoSinPagos = {
    ...prestamo,
    pagos: [],
    totalPagado: 0,
  }

  if (freq === 'diario') {
    // En diaria, "hoy toca cobrar" si: ya paso al menos 1 dia cobrable desde
    // el inicio Y hoy no es dia sin cobro. El primer cobro nunca es el dia 0.
    if (hoySinCobro) return false
    const primerCobro = calcularProximoCobro(prestamoSinPagos, diasExcluidos, festivos)
    if (!primerCobro) return false
    // Si el primer cobro programado ya llego (es hoy o antes), hoy hay cobro.
    return inicioDiaColombia(primerCobro).getTime() <= hoy.getTime()
  }

  // No diaria: hoy debe ser EXACTAMENTE un dia de cobro del calendario.
  // Generamos las fechas de cobro desde el inicio y vemos si alguna cae hoy.
  const diasPeriodo = obtenerDiasPorPeriodo(freq)

  // Mensual: hoy toca cobrar si es el dia ancla del mes, recortado al ultimo dia
  // cuando ese numero no existe (31 en abril, 30 en febrero). Sin ancla explicita
  // el ancla es el dia de la fechaInicio — el MISMO criterio que calcularProximoCobro,
  // para que la meta del dia en la caja y la fecha de proximo cobro no se contradigan.
  // Antes caia al `diff % 30` del final, que se corre un dia casi cada mes.
  // El guardia `hoy > inicio` mantiene la REGLA CLAVE de arriba: el primer cobro es
  // a un periodo de la fechaInicio, asi que un prestamo creado hoy no suma a la meta de hoy.
  if (freq === 'mensual') {
    if (hoy.getTime() <= inicio.getTime()) return false
    const ancla = Number.isInteger(prestamo.diaCobroMes) ? prestamo.diaCobroMes : inicio.getUTCDate()
    const ultimoDiaMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0)).getUTCDate()
    return hoy.getUTCDate() === Math.min(Math.max(1, ancla), ultimoDiaMes)
  }

  // Dia ancla por dia del mes: aplica a semanal y quincenal cuando
  // el usuario eligio anclar por numero de dia (ej. "cobra los 5 y 20").
  if (prestamo.diaCobroMes != null && prestamo.diaCobroSemana == null) {
    const diaHoy = hoy.getUTCDate()
    if (diaHoy === Number(prestamo.diaCobroMes)) return true
    if (prestamo.diaCobroMes2 != null && diaHoy === Number(prestamo.diaCobroMes2)) return true
    return false
  }
  // Dia ancla semanal/quincenal por dia de la semana (Lunes, Martes, etc.)
  if (prestamo.diaCobroSemana != null && (freq === 'semanal' || freq === 'quincenal')) {
    if (hoy.getUTCDay() !== Number(prestamo.diaCobroSemana)) return false
    // Verificar ciclo: dias desde el primer cobro deben ser multiplo del periodo.
    const primerCobro = calcularProximoCobro(prestamoSinPagos, diasExcluidos, festivos)
    if (!primerCobro) return false
    const diffPrimero = Math.floor((hoy.getTime() - inicioDiaColombia(primerCobro).getTime()) / DAY_MS)
    return diffPrimero >= 0 && diffPrimero % diasPeriodo === 0
  }

  // Sin ancla: ciclo regular desde fechaInicio. El primer cobro es a los
  // `diasPeriodo` dias. Hoy toca si (hoy - inicio) es multiplo positivo del periodo.
  const diff = Math.floor((hoy.getTime() - inicio.getTime()) / DAY_MS)
  return diff > 0 && diff % diasPeriodo === 0
}

/**
 * Formatea una fecha como "mar 31 mar" o "lun 7 abr" — corto y con día.
 */
export function formatFechaCobro(fecha, country = 'co') {
  if (!fecha) return ''
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  const { getLocale, getTimezone } = require('@/lib/i18n')
  return d.toLocaleDateString(getLocale(country), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: getTimezone(country),
  })
}

/**
 * Formato contextual para cobro: Hoy / Mañana / Ayer o fecha corta.
 */
export function formatFechaCobroRelativa(fecha) {
  if (!fecha) return ''
  const objetivo = inicioDiaColombia(fecha)
  const hoy = inicioDiaColombia()
  const diff = Math.round((objetivo.getTime() - hoy.getTime()) / DAY_MS)

  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  return formatFechaCobro(objetivo)
}

/**
 * Formato contextual con contexto de acción: "Cobra hoy", "Cobra mañana", "Venció ayer", etc.
 * Reemplaza el label crudo "Hoy"/"Mañana"/"Ayer" por texto auto-explicativo.
 */
export function formatFechaCobroContextual(fecha, diasMora = 0) {
  const label = formatFechaCobroRelativa(fecha)
  if (!label) return ''

  // "Ayer" siempre implica cobro pendiente del día anterior
  if (label === 'Ayer') return 'Debió cobrarse ayer'

  if (diasMora > 0) {
    if (label === 'Hoy') return 'Debió cobrarse hoy'
    return `Debió cobrarse el ${label}`
  }

  if (label === 'Hoy') return 'Cobra hoy'
  if (label === 'Mañana') return 'Cobra mañana'
  return `Cobra el ${label}`
}

/**
 * Verifica si un préstamo ya tiene un pago registrado hoy (Colombia).
 */
export function pagoHoy(prestamo) {
  const hoy = inicioDiaColombia().toISOString().slice(0, 10)
  return (prestamo.pagos ?? []).some(
    (p) => !TIPOS_AJUSTE.includes(p.tipo) && inicioDiaColombia(p.fechaPago).toISOString().slice(0, 10) === hoy
  )
}


/**
 * Límites de clientes por plan.
 */
export { LIMITES_PLAN } from '@/lib/planes'

// Alias retrocompatible de formatMoney para Colombia.
// Los 47+ archivos que importan formatCOP siguen funcionando sin cambios.
// Codigo nuevo debe usar formatMoney(valor, country) de lib/i18n.js.
export { formatMoney } from '@/lib/i18n'
export function formatCOP(valor) {
  if (valor == null) return '$0'
  return '$' + Math.round(valor).toLocaleString('es-CO')
}

/**
 * Opciones de días para abono rápido.
 */
export const DIAS_ABONO = [1, 2, 3, 5, 10]

/**
 * Recalcula el campo `pagado` de cada fila de la tabla de amortizacion
 * (modo 'lineal') a partir del total pagado real del prestamo, distribuyendo
 * en cascada: la cuota mas antigua se llena primero.
 *
 * Devuelve un array [{ numeroPeriodo, pagado }] listo para persistir con
 * updates individuales (CuotaAmortizacion.pagado).
 */
export function regenerarTablaAmortizacion(prestamo) {
  const filas = [...(prestamo.cuotasAmortizacion || [])].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
  // Los abonos a capital ya reducen el saldo (y recalculan las cuotas futuras
  // aparte) — no deben contarse de nuevo aqui o se "duplicaria" el abono como
  // pago de cuota. Solo pagos normales (completo/parcial) llenan la cascada.
  const restantePagosNormales = (prestamo.pagos ?? [])
    .filter(p => p.tipo === 'completo' || p.tipo === 'parcial')
    .reduce((acc, p) => acc + (p.montoPagado ?? 0), 0)
  let restante = restantePagosNormales
  return filas.map((fila) => {
    const pagado = Math.min(fila.cuotaTotal, Math.max(0, restante))
    restante -= pagado
    return { numeroPeriodo: fila.numeroPeriodo, pagado: Math.round(pagado) }
  })
}

/**
 * Recalcula la tabla de amortizacion para modo 'lineal_dinamico' tras CADA
 * pago normal (completo/parcial) — a diferencia de 'lineal', donde la tabla
 * se mantiene fija y los pagos solo se distribuyen en cascada.
 *
 * Regla de negocio (definida por el cliente):
 *  1. El pago cubre primero el interes de la cuota mas antigua no pagada,
 *     el resto va a capital de esa misma cuota.
 *  2. El capital REAL restante (monto original - capital efectivamente
 *     cubierto por todos los pagos, incluida la cuota en curso) se reparte
 *     de nuevo entre los periodos que faltan: capitalPorPeriodo = saldo /
 *     periodosRestantes.
 *  3. El interes de cada periodo futuro se recalcula sobre el saldo vigente
 *     en ese punto (saldo * tasa%), igual que en 'lineal'.
 *
 * Las fechaEsperada de cada periodo NO cambian (el calendario de cobro es
 * fijo); solo se recalculan capital/interes/cuotaTotal/saldoRestante.
 *
 * Devuelve un array de actualizaciones [{ numeroPeriodo, capital, interes,
 * cuotaTotal, saldoRestante, pagado }] listo para persistir con updates
 * individuales (CuotaAmortizacion), y `totalAPagar` recalculado.
 */
export function regenerarTablaAmortizacionDinamica(prestamo) {
  const filas = [...(prestamo.cuotasAmortizacion || [])].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
  const tasa = Number(prestamo.tasaInteres) || 0
  const montoOriginal = Number(prestamo.montoPrestado) || 0

  // Total efectivamente pagado por pagos normales (completo/parcial). Los
  // ajustes (recargo/descuento) y otros tipos no entran en la cascada de capital.
  const totalPagosNormales = (prestamo.pagos ?? [])
    .filter(p => p.tipo === 'completo' || p.tipo === 'parcial')
    .reduce((acc, p) => acc + (p.montoPagado ?? 0), 0)

  let restante = totalPagosNormales
  let capitalCubiertoTotal = 0
  const actualizaciones = []
  let filaCorteIdx = -1

  // 1) Cascada: llenar cada cuota (interes primero, luego capital) en orden,
  // usando los valores YA calculados de esa fila (aun no tocados). Se detiene
  // en la primera fila que no queda completamente cubierta (fila "en curso"),
  // esa es la que ancla el recalculo de las futuras.
  for (let idx = 0; idx < filas.length; idx++) {
    const fila = filas[idx]
    if (fila.cuotaTotal <= 0) {
      // Fila ya vacia (saldo agotado antes de tiempo): no aporta ni consume.
      actualizaciones.push({ numeroPeriodo: fila.numeroPeriodo, pagado: 0 })
      continue
    }
    const aplicado = Math.max(0, Math.min(restante, fila.cuotaTotal))
    const interesCubierto = Math.min(aplicado, fila.interes)
    const capitalCubierto = Math.max(0, aplicado - interesCubierto)
    capitalCubiertoTotal += capitalCubierto
    restante -= aplicado

    actualizaciones.push({ numeroPeriodo: fila.numeroPeriodo, pagado: Math.round(aplicado) })

    if (aplicado < fila.cuotaTotal) {
      // Cuota parcialmente pagada (o nada): aqui corta la cascada.
      filaCorteIdx = idx
      break
    }
  }

  // Si todas las filas quedaron completamente pagadas, no hay futuras que recalcular.
  if (filaCorteIdx === -1) {
    return {
      actualizaciones,
      totalAPagar: Math.round(filas.reduce((acc, f) => acc + f.cuotaTotal, 0)),
      soloPagado: true,
    }
  }

  const capitalRestante = Math.max(0, Math.round(montoOriginal - capitalCubiertoTotal))
  const filasFuturas = filas.slice(filaCorteIdx + 1)
  const numPeriodosRestantes = filasFuturas.length

  // Si no quedan periodos futuros (la fila en curso era la ultima), no hay
  // nada que redistribuir: la cuota en curso simplemente absorbe todo el saldo.
  if (numPeriodosRestantes === 0 || capitalRestante <= 0) {
    return {
      actualizaciones: actualizaciones.map(a => ({ numeroPeriodo: a.numeroPeriodo, pagado: a.pagado })),
      totalAPagar: Math.round(
        filas.slice(0, filaCorteIdx).reduce((acc, f) => acc + f.cuotaTotal, 0) +
        (filas[filaCorteIdx]?.cuotaTotal || 0) +
        filasFuturas.reduce((acc, f) => acc + f.cuotaTotal, 0)
      ),
      soloPagado: numPeriodosRestantes === 0,
    }
  }

  // 2) Recalcular las filas futuras sobre el capital real restante.
  const capitalPorPeriodo = capitalRestante / numPeriodosRestantes
  const capitalRedondeado = Math.round(capitalPorPeriodo)
  let saldoRestante = capitalRestante
  let capitalAsignado = 0
  const filasRecalculadas = []
  for (let i = 0; i < numPeriodosRestantes; i++) {
    const fila = filasFuturas[i]
    const interesPeriodo = saldoRestante * (tasa / 100)
    const esUltimo = i === numPeriodosRestantes - 1
    const capital = esUltimo ? Math.round(capitalRestante - capitalAsignado) : capitalRedondeado
    capitalAsignado += capital
    const cuotaTotal = capital + Math.round(interesPeriodo)
    saldoRestante = Math.max(0, saldoRestante - capitalPorPeriodo)
    filasRecalculadas.push({
      numeroPeriodo: fila.numeroPeriodo,
      capital,
      interes: Math.round(interesPeriodo),
      cuotaTotal,
      saldoRestante: Math.round(saldoRestante),
      pagado: 0,
    })
  }

  const totalPagadoOFilasAntes = filas.slice(0, filaCorteIdx).reduce((acc, f) => acc + f.cuotaTotal, 0)
  const cuotaEnCurso = filas[filaCorteIdx]
  const totalAPagar = Math.round(
    totalPagadoOFilasAntes +
    cuotaEnCurso.cuotaTotal +
    filasRecalculadas.reduce((acc, f) => acc + f.cuotaTotal, 0)
  )

  return {
    actualizaciones: [
      ...actualizaciones.slice(0, filaCorteIdx + 1),
      ...filasRecalculadas,
    ],
    totalAPagar,
    soloPagado: false,
  }
}

/* ══ LA FECHA DE CADA CUOTA QUE SE REHACE TRAS UN ABONO ══════════════════════
 *
 * ⚠ MENSUAL NO ES «+30 DÍAS». Es el mismo día del mes, que es la regla de toda
 *   la app (ver `sumarMeses` en lib/dinero/calendario.js).
 *
 * Las tres funciones de abajo hacían `fecha.setUTCDate(+ n × diasPeriodo)`, y
 * con `diasPeriodo = 30` un préstamo mensual del día 1 salía así en cuanto
 * entraba un abono a capital:
 *
 *     1 ago → 31 ago → 30 sep → 30 oct → 29 nov → 29 dic → 28 ene → 27 feb
 *
 * Es el caso de David Popayán (PRESTAMOS PEDRO, 14 ago 2026), y el «27 de
 * febrero» que él vio en pantalla sale literalmente de esta cuenta. Medido en
 * producción ese día: **63 préstamos mensuales vivos** con las cuotas
 * desperdigadas por el mes, 8 de ellos con abono a capital.
 *
 * El comentario de `calcularProximoCobro` ya avisaba de que este es el tercer
 * sitio que calcula fechas mensuales y de que quedarse con el calendario viejo
 * hace que la tabla diga una fecha y el «próximo cobro» otra. Pues era esto.
 */
function fechaDeCuotaRecalculada(fechaBase, i, diasPeriodo, frecuencia, diaCobroMes = null) {
  if (frecuencia === 'mensual') {
    const ancla = Number.isInteger(diaCobroMes) ? diaCobroMes : null
    return sumarMeses(new Date(fechaBase), i + 1, ancla)
  }
  const f = new Date(fechaBase)
  f.setUTCDate(f.getUTCDate() + (i + 1) * diasPeriodo)
  return f
}

/**
 * Genera la tabla de amortizacion (modo 'lineal') para el saldo restante a
 * partir de un periodo dado — usada al recalcular cuotas futuras tras un
 * abono a capital. `saldoInicial` es el capital que queda por amortizar en
 * los `numPeriodosRestantes` periodos que faltan.
 */
export function recalcularTablaDesdeSaldo({ saldoInicial, tasaInteres, numPeriodosRestantes, primerNumeroPeriodo, fechaBase, diasPeriodo, frecuencia, diaCobroMes = null }) {
  const tasa = Number(tasaInteres)
  const capitalPorPeriodo = saldoInicial / numPeriodosRestantes
  const capitalRedondeado = Math.round(capitalPorPeriodo)
  const tabla = []
  let saldoRestante = saldoInicial
  let capitalAsignado = 0
  for (let i = 0; i < numPeriodosRestantes; i++) {
    const interesPeriodo = saldoRestante * (tasa / 100)
    const esUltimo = i === numPeriodosRestantes - 1
    const capital = esUltimo ? saldoInicial - capitalAsignado : capitalRedondeado
    capitalAsignado += capital
    const cuotaTotal = capital + Math.round(interesPeriodo)
    saldoRestante = Math.max(0, saldoRestante - capitalPorPeriodo)
    const fechaEsperada = fechaDeCuotaRecalculada(fechaBase, i, diasPeriodo, frecuencia, diaCobroMes)
    tabla.push({
      numeroPeriodo: primerNumeroPeriodo + i,
      capital,
      interes: Math.round(interesPeriodo),
      cuotaTotal,
      saldoRestante: Math.round(saldoRestante),
      fechaEsperada,
      pagado: 0,
    })
  }
  return tabla
}

/**
 * Recalcula la tabla FRANCESA (modo 'saldo') para el saldo restante tras un abono
 * a capital. A diferencia de recalcularTablaDesdeSaldo (que genera una tabla
 * LINEAL con interes = saldo × tasa%), aca:
 *   - la tasa es POR MES: i = (tasa/100) / PERIODOS_POR_MES[frecuencia]
 *     (sin esto, un saldo semanal/quincenal cobraba 4×/2× de mas — bug reportado)
 *   - la cuota es FIJA (formula de anualidad), el interes decrece cada periodo
 *   - la ultima cuota cierra el saldo exacto
 */
export function recalcularTablaSaldoDesdeSaldo({ saldoInicial, tasaInteres, numPeriodosRestantes, primerNumeroPeriodo, fechaBase, diasPeriodo, frecuencia, diaCobroMes = null }) {
  const tasa = Number(tasaInteres)
  const n = numPeriodosRestantes
  const i = (tasa / 100) / (PERIODOS_POR_MES[frecuencia] || 30)

  // ceil100 es local a calcularPrestamo; aca redondeamos la cuota igual (hacia
  // arriba al siguiente REDONDEO_CUOTA) para que la cuota "quede pareja".
  const ceilCuota = (v) => Math.max(REDONDEO_CUOTA, Math.ceil(v / REDONDEO_CUOTA) * REDONDEO_CUOTA)
  let cuotaRegular
  if (i <= 0 || n <= 0) {
    cuotaRegular = n > 0 ? saldoInicial / n : saldoInicial
  } else {
    const factor = Math.pow(1 + i, n)
    cuotaRegular = ceilCuota(saldoInicial * (i * factor) / (factor - 1))
  }

  const tabla = []
  let saldoRestante = saldoInicial
  for (let k = 0; k < n; k++) {
    const esUltimo = k === n - 1
    const interesPeriodo = Math.round(saldoRestante * i)
    const capitalReal = esUltimo
      ? saldoRestante
      : Math.min(Math.max(0, cuotaRegular - interesPeriodo), saldoRestante)
    const cuotaTotal = esUltimo ? capitalReal + interesPeriodo : cuotaRegular
    saldoRestante = Math.max(0, saldoRestante - capitalReal)
    const fechaEsperada = fechaDeCuotaRecalculada(fechaBase, k, diasPeriodo, frecuencia, diaCobroMes)
    tabla.push({
      numeroPeriodo: primerNumeroPeriodo + k,
      capital: Math.round(capitalReal),
      interes: interesPeriodo,
      cuotaTotal: Math.round(cuotaTotal),
      saldoRestante: Math.round(saldoRestante),
      fechaEsperada,
      pagado: 0,
    })
  }
  return tabla
}

/**
 * Recalcula la tabla de amortizacion para modo 'solo_interes' tras un abono
 * a capital. Misma firma que recalcularTablaDesdeSaldo pero el capital se
 * concentra en la ultima cuota (balloon) en vez de repartirse.
 */
export function recalcularTablaSoloInteresDesdeSaldo({ saldoInicial, tasaInteres, numPeriodosRestantes, primerNumeroPeriodo, fechaBase, diasPeriodo, frecuencia, diaCobroMes = null, interesAdelantado = false }) {
  const tasa = Number(tasaInteres)
  const tabla = []
  let saldoRestante = saldoInicial
  const interesPorPeriodo = saldoRestante * (tasa / 100)
  for (let i = 0; i < numPeriodosRestantes; i++) {
    const esUltimo = i === numPeriodosRestantes - 1
    const capitalPeriodo = esUltimo ? saldoRestante : 0
    const interesPeriodo = (interesAdelantado && esUltimo) ? 0 : interesPorPeriodo
    const cuotaTotal = capitalPeriodo + interesPeriodo
    if (esUltimo) saldoRestante = 0
    const fechaEsperada = fechaDeCuotaRecalculada(fechaBase, i, diasPeriodo, frecuencia, diaCobroMes)
    tabla.push({
      numeroPeriodo: primerNumeroPeriodo + i,
      capital: Math.round(capitalPeriodo),
      interes: Math.round(interesPeriodo),
      cuotaTotal: Math.round(cuotaTotal),
      saldoRestante: Math.round(saldoRestante),
      fechaEsperada,
      pagado: 0,
    })
  }
  return tabla
}

/**
 * Obtiene la proxima cuota pendiente de la tabla de amortizacion.
 * Retorna la primera fila no completamente pagada, o null si todas estan pagadas.
 * Tambien marca si es la ultima cuota (balloon en solo_interes).
 */
export function obtenerProximaCuotaTabla(prestamo) {
  if (!tieneTablaAmortizacion(prestamo)) return null
  const filas = [...prestamo.cuotasAmortizacion].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
  const totalFilas = filas.length
  for (const fila of filas) {
    const pagadaCompleta = (fila.pagado || 0) >= fila.cuotaTotal
    if (!pagadaCompleta) {
      const faltante = Math.max(0, fila.cuotaTotal - (fila.pagado || 0))
      const interesFaltante = Math.max(0, fila.interes - (fila.interesPagado || 0))
      return {
        ...fila,
        faltante: Math.round(faltante),
        interesFaltante: Math.round(interesFaltante),
        esUltima: fila.numeroPeriodo === totalFilas,
        esBalloon: prestamo.modoInteres === 'solo_interes' && fila.numeroPeriodo === totalFilas,
      }
    }
  }
  return null
}

/**
 * Obtiene la cuota del periodo actual para cobros en ruta.
 * Para prestamos con tabla de amortizacion, retorna la cuota de la proxima fila pendiente.
 * Para prestamos simples, retorna cuotaDiaria.
 */
export function obtenerCuotaPeriodoActual(prestamo) {
  if (!tieneTablaAmortizacion(prestamo)) return prestamo.cuotaDiaria || 0
  const proxima = obtenerProximaCuotaTabla(prestamo)
  if (!proxima) return 0
  if (prestamo.modoInteres === 'solo_interes' && !proxima.esUltima) {
    return proxima.interes
  }
  return proxima.cuotaTotal
}

/**
 * Cuota REAL del proximo cobro, para mostrar en notificaciones y listas de cobro.
 * A diferencia de cuotaDiaria (la cuota pactada fija), esta refleja lo que de verdad
 * toca cobrar la proxima vez:
 *  - Modos con tabla: la cuota de la proxima fila pendiente (ya recalculada tras abonos).
 *  - Modo fijo/clasico: la cuota pactada, PERO topada al saldo pendiente. Asi, tras un
 *    abono a capital o un pago excedente, la ultima cuota (mas pequeña) se muestra con su
 *    valor real y no la cuota fija completa. Reportado por cliente: "la notificacion muestra
 *    la cuota fija aun despues de un abono, deberia actualizarse".
 */
export function cuotaProximoCobro(prestamo) {
  if (!prestamo) return 0
  if (tieneTablaAmortizacion(prestamo)) return obtenerCuotaPeriodoActual(prestamo)
  const cuota = prestamo.cuotaDiaria || 0
  if (cuota <= 0) return 0
  const saldo = Number.isFinite(prestamo.saldoPendiente)
    ? prestamo.saldoPendiente
    : calcularSaldoPendiente(prestamo)
  if (saldo <= 0) return 0
  return Math.min(cuota, Math.round(saldo))
}

/**
 * Calcula el interes moratorio acumulado de un prestamo.
 * tasaMoratorio: % mensual (ej: 3 = 3% mensual)
 * diasGracia: dias de gracia configurados por la org (default 5).
 *   Se escala automaticamente segun la frecuencia del prestamo:
 *     diario: diasGracia tal cual
 *     semanal: max(diasGracia, 7)
 *     quincenal: max(diasGracia, 10)
 *     mensual: max(diasGracia, 15)
 *
 * La base del moratorio depende del modo:
 *   - fijo/proporcional/unico: cuotas vencidas completas (capital+interes
 *     ya estan embebidos en la cuota, no se pueden separar)
 *   - lineal/solo_interes: solo el interes vencido no pagado (el capital
 *     vencido ya genera interes en cuotas futuras recalculadas, cobrar
 *     moratorio sobre el tambien seria doble castigo)
 *
 * Tope: nunca puede exceder 50% del saldo pendiente.
 */
export function calcularInteresMoratorio(prestamo, diasExcluidos = [], festivos = [], tasaMoratorio = 0, diasGracia = 5) {
  const nulo = { diasMoraEfectivos: 0, montoBase: 0, montoMoratorio: 0, tope: 0, aplicable: false }
  if (!tasaMoratorio || tasaMoratorio <= 0) return nulo
  if (!prestamo || prestamo.estado !== 'activo') return nulo

  const freq = prestamo.frecuencia || 'diario'
  const graciaMinima = { diario: 0, semanal: 7, quincenal: 10, mensual: 15 }[freq] || 0
  const graciaEfectiva = Math.max(diasGracia, graciaMinima)

  const diasMora = calcularDiasMora(prestamo, diasExcluidos, festivos)
  const diasMoraEfectivos = Math.max(0, diasMora - graciaEfectiva)
  if (diasMoraEfectivos <= 0) return nulo

  let montoBase
  if (tieneTablaAmortizacion(prestamo)) {
    const { montoEnMora } = calcularEstadoTablaAmortizacion(prestamo)
    montoBase = montoEnMora
  } else {
    montoBase = calcularMontoEnMora(prestamo, diasExcluidos, festivos)
  }
  if (!montoBase || montoBase <= 0) return nulo

  const tasaDiaria = tasaMoratorio / 100 / 30
  const montoCalculado = Math.round(montoBase * tasaDiaria * diasMoraEfectivos)

  const saldo = calcularSaldoPendiente(prestamo)
  const tope = Math.round(saldo * 0.5)
  const montoMoratorio = Math.min(montoCalculado, tope)

  return { diasMoraEfectivos, montoBase, montoMoratorio, tope, aplicable: montoMoratorio > 0 }
}

/**
 * Liquidacion / cierre anticipado de un prestamo.
 *
 * Cuando el cliente paga TODO antes del plazo, solo debe capital + el interes
 * de los meses que YA transcurrieron (no el interes futuro no devengado).
 * Devuelve el calculo en dos modalidades para que el prestamista elija:
 *   - mesCompleto:  el mes en curso cuenta completo (ceil de meses)
 *   - proporcional: interes exacto por los dias transcurridos
 *
 * Para 'fijo'/'proporcional': interesDevengado = capital * tasa% * mesesTranscurridos.
 * Para 'unico': el interes se devenga completo al prestar (no se prorratea).
 * Para 'saldo'/'manual': no se puede recalcular limpio -> aproxima y marca ajustable.
 *
 * Campos clave que devuelve por modalidad:
 *   - interesDevengado, totalCierre (capital+interesDevengado),
 *   - restanteHoy (lo que falta pagar hoy = totalCierre - totalPagadoReal, >=0),
 *   - interesPerdonado (saldoActual - restanteHoy, >=0)
 */
export function calcularLiquidacionAnticipada(prestamo, fechaLiquidacion = new Date(), diasExcluidos = [], festivos = []) {
  const capital = Number(prestamo.montoPrestado) || 0
  const tasa = Number(prestamo.tasaInteres) || 0
  const freq = prestamo.frecuencia || 'diario'
  const modo = prestamo.modoInteres || 'fijo'

  const totalPagadoReal = calcularTotalPagadoReal(prestamo)
  const saldoActual = calcularSaldoPendiente(prestamo)
  const interesTotalPactado = Math.max(0, (Number(prestamo.totalAPagar) || 0) - capital)

  // Dias y meses transcurridos (respetando dias sin cobro / festivos)
  const diasTranscurridos = calcularDiasTranscurridosCobrables(
    prestamo.fechaInicio, fechaLiquidacion, diasExcluidos, festivos
  )
  const periodosPorMes = PERIODOS_POR_MES[freq] || 30
  const diasPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[freq] || 1
  const periodosTranscurridos = Math.ceil(diasTranscurridos / diasPeriodo)

  // meses transcurridos en cada modalidad
  const mesesMesCompleto = Math.max(1, Math.ceil(periodosTranscurridos / periodosPorMes))
  // El "mes" del modo = periodos por mes × dias por periodo. Para semanal son
  // 4×7=28 dias (convencion semanal=4), no 30. Prorratear contra 30 hacia el
  // interes hacia abajo en semanal (cobraba ~6.67% menos). Los demas dan 30.
  const diasPorMesModo = periodosPorMes * diasPeriodo
  const mesesProporcional = Math.max(0, diasTranscurridos / (diasPorMesModo || 30))

  // Modo lineal/solo_interes con tabla: calculo exacto desde las cuotas.
  // El capital restante sale de la tabla, el interes devengado es la suma
  // de intereses de cuotas ya vencidas + proporcional del periodo en curso.
  if (tieneTablaAmortizacion(prestamo)) {
    const hoy = inicioDiaColombia(fechaLiquidacion)
    const filas = [...prestamo.cuotasAmortizacion].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)

    let interesVencido = 0
    let capitalPagadoEnTabla = 0
    let ultimaVencida = null
    let primeraPendiente = null

    for (const f of filas) {
      const fVence = inicioDiaColombia(f.fechaEsperada)
      if (fVence <= hoy) {
        interesVencido += f.interes
        capitalPagadoEnTabla += f.capital
        ultimaVencida = f
      } else if (!primeraPendiente) {
        primeraPendiente = f
      }
    }

    let pagosRestante = totalPagadoReal
    let capitalCubierto = 0
    for (const f of filas) {
      if (pagosRestante <= 0) break
      const aplicado = Math.min(pagosRestante, f.cuotaTotal)
      const intCubierto = Math.min(aplicado, f.interes)
      capitalCubierto += Math.max(0, aplicado - intCubierto)
      pagosRestante -= aplicado
    }
    let capitalRestante = capital - capitalCubierto
    if (modo === 'lineal_dinamico' && primeraPendiente) {
      const interesRealProximo = capitalRestante * (tasa / 100)
      primeraPendiente = { ...primeraPendiente, interes: interesRealProximo, cuotaTotal: (capitalRestante / Math.max(1, filas.filter(f => inicioDiaColombia(f.fechaEsperada) > hoy).length)) + interesRealProximo }
    }

    // Interes proporcional del periodo en curso (entre la ultima cuota vencida y la proxima)
    let interesProporcional = 0
    if (primeraPendiente) {
      const inicioP = ultimaVencida
        ? inicioDiaColombia(ultimaVencida.fechaEsperada)
        : inicioDiaColombia(prestamo.fechaInicio)
      const finP = inicioDiaColombia(primeraPendiente.fechaEsperada)
      const duracionPeriodo = Math.max(1, (finP - inicioP) / DAY_MS)
      const diasEnPeriodo = Math.max(0, (hoy - inicioP) / DAY_MS)
      const fraccion = Math.min(1, diasEnPeriodo / duracionPeriodo)
      interesProporcional = primeraPendiente.interes * fraccion
    }

    const intMesCompleto = interesVencido + (primeraPendiente ? primeraPendiente.interes : 0)
    const intProporcional = interesVencido + interesProporcional

    function modalidadTabla(interesDevengado, etiqueta, meses) {
      const totalCierre = capital + interesDevengado
      const restanteHoy = Math.max(0, Math.round(totalCierre - totalPagadoReal))
      const interesPerdonado = Math.max(0, Math.round(saldoActual - restanteHoy))
      return {
        modalidad: etiqueta,
        mesesTranscurridos: Math.round(meses * 100) / 100,
        interesDevengado: Math.round(interesDevengado),
        totalCierre: Math.round(totalCierre),
        restanteHoy,
        interesPerdonado,
      }
    }

    return {
      modo,
      aproximado: false,
      capital,
      capitalRestante: Math.round(capitalRestante),
      tasa,
      frecuencia: freq,
      diasTranscurridos,
      totalPagadoReal: Math.round(totalPagadoReal),
      saldoActual: Math.round(saldoActual),
      interesTotalPactado: Math.round(interesTotalPactado),
      mesCompleto: modalidadTabla(intMesCompleto, 'mesCompleto', mesesMesCompleto),
      proporcional: modalidadTabla(intProporcional, 'proporcional', mesesProporcional),
    }
  }

  function interesPara(meses) {
    let interes
    if (modo === 'unico') {
      interes = capital * (tasa / 100)
    } else if (modo === 'manual' || modo === 'saldo') {
      interes = Math.max(0, totalPagadoReal - 0) >= capital
        ? Math.max(0, totalPagadoReal - capital)
        : interesTotalPactado * Math.min(1, meses / Math.max(1, (prestamo.diasPlazo || 30) / 30))
    } else {
      interes = capital * (tasa / 100) * meses
    }
    return Math.min(interes, interesTotalPactado || interes)
  }

  function modalidad(meses, etiqueta) {
    const interesDevengado = Math.round(interesPara(meses))
    const totalCierre = capital + interesDevengado
    const restanteHoy = Math.max(0, Math.round(totalCierre - totalPagadoReal))
    const interesPerdonado = Math.max(0, Math.round(saldoActual - restanteHoy))
    return {
      modalidad: etiqueta,
      mesesTranscurridos: Math.round(meses * 100) / 100,
      interesDevengado,
      totalCierre: Math.round(totalCierre),
      restanteHoy,
      interesPerdonado,
    }
  }

  const noRecalculable = (modo === 'manual' || modo === 'saldo')

  return {
    modo,
    aproximado: noRecalculable,
    capital,
    tasa,
    frecuencia: freq,
    diasTranscurridos,
    totalPagadoReal: Math.round(totalPagadoReal),
    saldoActual: Math.round(saldoActual),
    interesTotalPactado: Math.round(interesTotalPactado),
    mesCompleto: modalidad(mesesMesCompleto, 'mesCompleto'),
    proporcional: modalidad(mesesProporcional, 'proporcional'),
  }
}

/**
 * Patrimonio del negocio = lo que te deben + lo que tienes en caja.
 *
 * NO se restan los gastos. `capital.saldo` YA los descontó: en lib/capital.js
 * el tipo 'gasto' esta en la lista de egresos, asi que cada gasto aprobado ya
 * bajo el saldo. El dashboard los restaba otra vez y subestimaba el patrimonio
 * exactamente en los gastos del mes — y ese es el numero por el que el dueño
 * decide si retira utilidades.
 */
export function calcularPatrimonio({ saldoPorCobrar = 0, cajaDisponible = 0 } = {}) {
  return (saldoPorCobrar || 0) + (cajaDisponible || 0)
}

/**
 * ¿El prestamo devuelve MENOS de lo que se presta?
 *
 * Nadie presta $400.000 para recibir $40.000. Si el calculo da eso, lo que hay
 * es un dato mal entendido, no una decision de negocio: prestar a perdida no
 * existe. Un prestamo sin interes da totalAPagar == montoPrestado, nunca menos.
 *
 * DE DONDE SALE: 98 prestamos en produccion tienen totalAPagar = montoPrestado/10
 * exacto, 95 creados en junio de 2026 por el mismo negocio. En 95 de ellos
 * `cuotaDiaria == totalAPagar`, o sea UNA sola cuota: pusieron frecuencia
 * quincenal con plazo 15 *dias*, que son 15/15 = 1 periodo. Querian decir 15
 * quincenas. La cuenta estaba bien; lo que faltaba era que alguien dijera que el
 * resultado es imposible. Suman $56.723.400 de "perdida" que no ocurrio.
 *
 * OJO — no confundir con las perdidas REALES: cuando se liquida o se cancela un
 * prestamo, `totalAPagar` se reescribe con lo que de verdad se pago, y ahi si
 * puede quedar por debajo del capital. Eso es correcto y no se toca: esta guarda
 * es solo para el momento de CREAR o EDITAR.
 */
export function prestamoDevuelveMenosDeLoPrestado({ totalAPagar = 0, montoPrestado = 0 } = {}) {
  if (!(totalAPagar > 0) || !(montoPrestado > 0)) return false
  // margen de un peso por el redondeo
  return totalAPagar < montoPrestado - 1
}

export function mensajePrestamoConPerdida({ totalAPagar = 0, montoPrestado = 0, numPeriodos = 0, frecuencia = '' } = {}) {
  const $ = (n) => '$' + Math.round(n).toLocaleString('es-CO')
  const periodo = { diario: 'días', semanal: 'semanas', quincenal: 'quincenas', mensual: 'meses' }[frecuencia] || 'cuotas'
  const cola = numPeriodos === 1
    ? ` Con esos datos queda **una sola cuota**: revisa el plazo, que se cuenta en días, no en ${periodo}.`
    : ''
  return `Con estos datos prestarías ${$(montoPrestado)} y recibirías ${$(totalAPagar)}: ${$(montoPrestado - totalAPagar)} menos de lo que entregas.${cola}`
}

/**
 * INTERES reconocido cuando se llevan pagados `totalPagado` pesos sobre una
 * tabla de amortizacion.
 *
 * La cascada va de la cuota mas vieja a la mas nueva, y dentro de cada cuota el
 * dinero cubre primero el interes y despues el capital. Es la misma regla con
 * la que se presenta la tabla al usuario ("Capital | Interes | Cuota") y la que
 * usa su propia contabilidad.
 *
 * POR QUE EXISTE: el reparto proporcional (`desglosarPago`) reconoce la misma
 * fraccion de interes en cada peso cobrado. Eso es correcto para los modos SIN
 * tabla, pero falso cuando la hay: en un prestamo lineal el interes del primer
 * periodo se calcula sobre el saldo completo y es mucho mayor que el del
 * ultimo. Un cliente lo reporto con numeros exactos: la tabla decia $7.742 de
 * interes en el mes 1 y analiticas registraba $6.896, $846 menos. Medido sobre
 * los 295 prestamos activos con tabla, el metodo proporcional subestimaba la
 * ganancia en $7.690.180 — un 27,3%.
 *
 * LIMITE CONOCIDO: si el prestamo tuvo un abono a capital, la tabla se
 * reconstruye desde el saldo nuevo (`recalcularTablaDesdeSaldo`), asi que las
 * filas describen el calendario vigente y no el historico. En ese caso el
 * reparto es aproximado. Sigue siendo mucho mas cercano que el proporcional.
 */
export function interesAcumuladoTabla(cuotasAmortizacion, totalPagado = 0) {
  if (!Array.isArray(cuotasAmortizacion) || !cuotasAmortizacion.length) return 0
  if (!(totalPagado > 0)) return 0

  const filas = [...cuotasAmortizacion].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
  let restante = totalPagado
  let interes = 0
  for (const fila of filas) {
    if (restante <= 0) break
    const aplicado = Math.min(restante, fila.cuotaTotal || 0)
    interes += Math.min(aplicado, fila.interes || 0)
    restante -= aplicado
  }
  // Lo que sobre por encima del total de la tabla es capital devuelto de mas,
  // no ganancia: se descarta a proposito.
  return Math.round(interes)
}

/**
 * Interes que le corresponde a UN pago concreto, dado lo que ya se habia pagado
 * antes. Es la diferencia entre el interes acumulado antes y despues del pago,
 * asi que la suma de todos los pagos reconstruye exactamente el acumulado.
 */
export function interesDelPagoSegunTabla(cuotasAmortizacion, pagadoAntes = 0, montoPagado = 0) {
  const antes = interesAcumuladoTabla(cuotasAmortizacion, pagadoAntes)
  const despues = interesAcumuladoTabla(cuotasAmortizacion, (pagadoAntes || 0) + (montoPagado || 0))
  return Math.max(0, despues - antes)
}

/**
 * Parte de INTERES y parte de CAPITAL de un pago.
 *
 * Cada peso que entra es en parte ganancia y en parte devolucion del capital
 * que el prestamista habia puesto. Se reparte en la misma proporcion que tiene
 * el prestamo completo: si de $120.000 a pagar $20.000 son interes, entonces
 * 1/6 de cada pago es ganancia.
 *
 * Vale para los modos SIN tabla de amortizacion (fijo, unico, manual,
 * proporcional), que son el 93,7% de la cartera. Cuando hay tabla, la fuente
 * correcta es `interesDelPagoSegunTabla`.
 *
 * ⚠ LA CONVENCION VIVE EN `lib/dinero/reparto.js`. Aqui esta duplicada porque
 * importarla crearia un ciclo (reparto.js importa de este archivo), y por el
 * mismo motivo que `calcularCapitalRestante`. Que las dos digan lo mismo lo fija
 * `lib/__tests__/coherencia-dinero.test.js`, no la buena voluntad.
 */
export function desglosarPago({ montoPagado = 0, totalAPagar = 0, montoPrestado = 0 } = {}) {
  if (!totalAPagar || totalAPagar <= 0 || !montoPagado) {
    return { interes: 0, capital: Math.round(montoPagado || 0) }
  }
  // Acotada a [0, 1]: hay 850 prestamos cerrados por debajo de lo prestado y sin
  // el tope reconocerian interes NEGATIVO. Eso es capital que no volvio, y tiene
  // su propia funcion (`capitalPerdido`), no se disuelve en la ganancia.
  const fraccionInteres = Math.min(1, Math.max(0, (totalAPagar - montoPrestado) / totalAPagar))
  const interes = Math.round(montoPagado * fraccionInteres)
  return { interes, capital: Math.round(montoPagado) - interes }
}

/**
 * Ganancia neta de un periodo = INTERES cobrado - gastos.
 *
 * NUNCA `recaudado - gastos`. `recaudado` es todo lo que entro por caja, y la
 * mayor parte es el capital propio volviendo: recuperar tu propia plata no es
 * ganancia. Con $10M cobrados ($8M capital + $2M interes) y $150k de gastos, la
 * ganancia real son $1.850.000 — la formula con recaudado daba $9.850.000, mas
 * de 5 veces inflada, y de ahi salia tambien el ROI del reporte en PDF.
 *
 * El dashboard principal ya lo separaba bien; la pantalla de analiticas y su PDF
 * habian quedado atras. Por eso la regla ahora tiene un nombre.
 */
export function calcularGananciaNeta({ interesCobrado = 0, gastos = 0 } = {}) {
  return Math.round((interesCobrado || 0) - (gastos || 0))
}
