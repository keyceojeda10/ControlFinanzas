// lib/cartulina-datos.js — las cuentas del lector de cartulinas, SIN transporte.
//
// ══ POR QUÉ ESTÁ SEPARADO DE `lib/cartulina.js` ═══════════════════════════
//
// `lib/cartulina.js` importa `sharp` para redimensionar la foto, y `sharp` es
// código de servidor: en cuanto una pantalla importó de ahí una función de
// cuentas —`montoConTasa`, para rellenar el monto de la ficha— el build se cayó
// entero con «Reading from node:child_process is not handled».
//
// Aquí vive lo que NO toca la red ni el disco: normalizar lo que devolvió el
// modelo, ponerlo en pesos, deducir lo que se pueda deducir y pintar el
// semáforo. Lo usan el servidor y las pantallas por igual, y se puede probar
// sin llamar a Gemini.

/* ── LA NORMALIZACIÓN, EN UN SOLO SITIO ───────────────────────────────────
   El prompt pide «cedula» sin tilde pero el modelo devuelve «cédula» a
   menudo, y la pantalla hacía `d['cédula'] || d.cedula` a mano campo por
   campo. Cada pantalla nueva que lea cartulinas repetiría esas líneas hasta
   que una se olvidara de una tilde y el dato se perdiera en silencio. */
const CLAVES = {
  nombre: ['nombre'],
  cedula: ['cedula', 'cédula'],
  telefono: ['telefono', 'teléfono'],
  direccion: ['direccion', 'dirección'],
  tipoPrestamo: ['tipoPrestamo', 'tipo'],
  montoPrestado: ['montoPrestado', 'monto', 'prestado'],
  totalAPagar: ['totalAPagar', 'total', 'valor'],
  valorCuota: ['valorCuota', 'cuota'],
  numeroCuotas: ['numeroCuotas', 'cuotas', 'cobros'],
  tasaInteres: ['tasaInteres', 'tasa', 'interes', 'interés'],
  frecuencia: ['frecuencia'],
  diasPlazo: ['diasPlazo', 'plazo'],
  fechaInicio: ['fechaInicio', 'fecha'],
  cuotasPagadas: ['cuotasPagadas'],
  montoPagadoHasta: ['montoPagadoHasta', 'abonado', 'pagado'],
  saldoPendiente: ['saldoPendiente', 'saldo', 'debe', 'resta'],
  /* ⚠ EL DÍA DE COBRO NO ES UNA FECHA, y confundirlos costó 19 de 19 fechas
     inventadas en la tabla del 31 ago 2026. La columna «Fecha» de esas hojas
     trae «26/», «16/», «5/»: el día del mes en que pasa a cobrar. El sistema ya
     tiene dónde guardarlo (`Prestamo.diaCobroMes`). */
  diaCobro: ['diaCobro', 'dia', 'día'],
  /* Lo que dice la celda TAL CUAL. No se usa para calcular: se usa para
     enseñárselo al prestamista al lado de lo que entendimos, que es lo único
     que le deja confirmarlo de un vistazo con la foto delante. */
  textoMonto: ['textoMonto', 'montoTexto'],
  textoFecha: ['textoFecha', 'fechaTexto'],
  notas: ['notas', 'nota'],
}

/* ══ LA ESCALA: LO QUE ESTÁ EN MILES ═════════════════════════════════════════
 *
 * «En la cartulina dice 300 y 500 —prestó 500 y va pagado 300—, pero dice
 *  literalmente como si fueran 500 pesos, no 500 mil.»  — el dueño, 17 ago 2026
 *
 * En estas libretas nadie escribe los ceros. La cartulina de Lorena dice 500 y
 * son quinientos mil; los abonos dicen 30 y son treinta mil.
 *
 * ⚠ SE MULTIPLICA AQUÍ Y NO EN EL PROMPT, a propósito. Pedirle al modelo que
 * agregue ceros es pedirle que haga aritmética con plata, y la aritmética de un
 * modelo no es reproducible: un día pone 500000 y otro 5000. El prompt le pide
 * copiar lo que ve —que es lo que sabe hacer— y la multiplicación pasa aquí,
 * donde se puede leer y probar.
 *
 * El umbral es $10.000 porque en Colombia nadie presta menos: el préstamo más
 * chico que hay en producción es de $20.000. Un "8" suelto en un campo de plata
 * son ocho mil, no ocho pesos.
 *
 * ⚠ SOLO A LOS CAMPOS DE PLATA. La tasa (20) y el número de cobros (8) son
 * cifras de verdad: multiplicarlas daría un 20.000 % a 8.000 cobros. */
const CAMPOS_DE_PLATA = ['montoPrestado', 'totalAPagar', 'valorCuota', 'montoPagadoHasta', 'saldoPendiente']
export const UMBRAL_MILES = 10000

/* Lo que NO puede ser un préstamo. Medido, no supuesto: en los 11.565 préstamos
   de producción el más grande es de $300.000.000 y ninguno pasa de mil millones.
   Solo se usa para desmentir una escala mal declarada, nunca para rechazar lo
   que el prestamista escriba a mano. */
export const TECHO_PRESTAMO = 1000000000

export function aPesos(valor, escala = null) {
  const n = Number(valor)
  if (!Number.isFinite(n) || n <= 0) return valor
  /* ⚠ SI EL PAPEL DICE EN QUÉ ESCALA ESTÁ, MANDA ÉL.
   *
   * El umbral no puede distinguir «14500» —que en una tabla escrita en pesos es
   * catorce mil quinientos— de «14500» escrito por un modelo que abrevió
   * 14.500.000. Los dos superan los 10.000, así que los dos se quedaban igual:
   * un préstamo de catorce millones guardado como catorce mil. Pasó con la
   * tabla del 31 ago 2026.
   *
   * Cuando el lector dice que la hoja está en pesos completos, no hay nada que
   * escalar. Cuando dice miles, se escala aunque supere el umbral. El umbral
   * queda solo para las cartulinas viejas, que no traen esa marca. */
  if (escala === 'pesos') return n

  /* ⚠ LA ESCALA LA DICE EL MODELO, Y EL MODELO SE EQUIVOCA.
   *
   * Todo este fichero evita preguntarle cuentas al modelo… menos esta etiqueta,
   * que también es un juicio suyo. Probando el respaldo con la tabla real del 31
   * ago 2026: los dos lectores sacaron los mismos montos exactos —14500000, con
   * `textoMonto: "14.500.000"`, todos los ceros escritos— y aun así uno declaró
   * la hoja `"miles"`. Multiplicado, ese préstamo salía por 14.500 MILLONES.
   *
   * El desmentido no es otra opinión, es el tamaño: medido contra los 11.565
   * préstamos de producción, el mayor de la historia es de 300 millones y
   * NINGUNO llega a mil. Así que se escala mientras el resultado siga siendo un
   * préstamo posible; si se sale del mundo, la etiqueta estaba mal y el número
   * ya traía sus ceros puestos.
   *
   * El techo va holgado a propósito —3,3 veces el récord— porque quien deja
   * fuera un préstamo bueno hace más daño que quien deja pasar uno absurdo: lo
   * absurdo se ve de un vistazo en la ficha, lo que falta no se ve. */
  if (escala === 'miles') return n * 1000 <= TECHO_PRESTAMO ? n * 1000 : n

  return n < UMBRAL_MILES ? n * 1000 : n
}

/**
 * ⚠ LA ESCALA SE DECIDE MIRANDO LA HOJA, NO CREYÉNDOLE AL LECTOR.
 *
 * `escala` es el único juicio del modelo que quedaba mandando sobre las cuentas,
 * y falló en la primera prueba seria: simulando a Google caído para ver entrar
 * el respaldo, los dos lectores devolvieron los MISMOS montos —14500000, con
 * `textoMonto: "14.500.000"`— y uno declaró la hoja «miles». Multiplicando,
 * catorce millones y medio pasaban a catorce mil quinientos MILLONES.
 *
 * El techo de arriba atrapa ese disparate, pero no el fallo: en la misma hoja
 * los préstamos de $500.000 se convertían en 500 millones, que cabe bajo el
 * techo y no canta. Quedaban 15 de 21 montos buenos y ninguno avisaba.
 *
 * La hoja ya dice en qué escala está: sus propias cifras. Nadie abrevia
 * escribiendo «14500000» para decir catorce mil millones — si la cifra más
 * grande de la tabla ya está en el millón, la hoja está en pesos completos y no
 * hay nada que escalar, diga lo que diga la etiqueta.
 *
 * Solo desmiente hacia «pesos», nunca al revés: los cuadernos de verdad —los de
 * Cristian y Lorena, «Valor 1200», «abono 30»— siguen dependiendo de la etiqueta
 * y del umbral, y esos números pequeños no disparan esta regla.
 *
 * @param {Array}  crudos     los clientes tal cual los devolvió el lector
 * @param {string} declarada  'miles' | 'pesos' | null
 */
export const PISO_PESOS_COMPLETOS = 1000000

export function escalaDeLaHoja(crudos = [], declarada = null) {
  if (declarada !== 'miles') return declarada

  const cifras = []
  for (const c of crudos ?? []) {
    for (const alias of ['montoPrestado', 'monto', 'prestado', 'totalAPagar', 'total', 'valor']) {
      const n = Number(String(c?.[alias] ?? '').replace(/[^\d]/g, ''))
      if (Number.isFinite(n) && n > 0) { cifras.push(n); break }
    }
  }
  if (!cifras.length) return declarada
  return Math.max(...cifras) >= PISO_PESOS_COMPLETOS ? 'pesos' : 'miles'
}

const FRECUENCIAS = ['diario', 'semanal', 'quincenal', 'mensual']

/** Un cliente crudo del modelo → la forma que usa la app. Sin inventar nada. */
/**
 * @param {object} crudo
 * @param {string|null} escala  'pesos' | 'miles', si el lector supo decirlo.
 *   ⚠ Va como parámetro y no dentro del cliente porque la escala es de la HOJA
 *   entera, no de cada renglón: una tabla no está medio en miles.
 */
export function normalizarCliente(crudo = {}, escala = null) {
  const out = {}
  for (const [campo, alias] of Object.entries(CLAVES)) {
    for (const a of alias) {
      const v = crudo[a]
      if (v !== undefined && v !== null && v !== '') { out[campo] = v; break }
    }
  }
  // Los números llegan como texto con puntos más veces de las que uno querría.
  const NUMEROS = ['montoPrestado', 'totalAPagar', 'valorCuota', 'numeroCuotas', 'tasaInteres',
    'diasPlazo', 'cuotasPagadas', 'montoPagadoHasta', 'saldoPendiente']
  for (const n of NUMEROS) {
    if (out[n] != null) {
      const limpio = Number(String(out[n]).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
      if (Number.isFinite(limpio) && limpio !== 0) out[n] = limpio
      else delete out[n]
    }
  }
  for (const n of CAMPOS_DE_PLATA) if (out[n] != null) out[n] = aPesos(out[n], escala)

  /* El día de cobro es 1-31 y nada más. Un «26/» mal leído como 260 pondría el
     préstamo en un día que no existe y el calendario entero se iría al garete. */
  if (out.diaCobro != null) {
    const d = Number(String(out.diaCobro).replace(/\D/g, ''))
    if (Number.isInteger(d) && d >= 1 && d <= 31) out.diaCobro = d
    else delete out.diaCobro
  }

  if (out.frecuencia && !FRECUENCIAS.includes(String(out.frecuencia).toLowerCase())) delete out.frecuencia
  else if (out.frecuencia) out.frecuencia = String(out.frecuencia).toLowerCase()
  if (out.tipoPrestamo) {
    const t = String(out.tipoPrestamo).toLowerCase()
    out.tipoPrestamo = t.startsWith('merc') ? 'mercancia' : t.startsWith('plat') ? 'plata' : undefined
    if (!out.tipoPrestamo) delete out.tipoPrestamo
  }
  for (const t of ['cedula', 'telefono']) {
    if (out[t]) out[t] = String(out[t]).replace(/\D/g, '') || undefined
  }
  return completar(out)
}

/* ══ LO QUE SE PUEDE DEDUCIR, SE DEDUCE ══════════════════════════════════════
 *
 * La cartulina de Cristian dice «Valor 1200» y «8 x 150», y eso alcanza para
 * saber TODO el préstamo: son 8 cobros de $150.000, el total es $1.200.000 y con
 * una tasa del 20% lo entregado fue $1.000.000. El lector devolvía «monto 1200,
 * plazo 8» —el total tomado por capital y los cobros tomados por días— y esa
 * ficha nace mintiendo: infla la cartera y calcula mal el interés.
 *
 * Aquí no se adivina nada: cada línea es una identidad aritmética entre cifras
 * que el papel ya trae. Si faltan los datos, el campo se queda vacío. */
export function completar(c = {}) {
  const out = { ...c }
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null)

  const cuota = num(out.valorCuota)
  const cuantas = num(out.numeroCuotas)
  const total = num(out.totalAPagar)
  const monto = num(out.montoPrestado)

  // «8 x 150» dice el total sin que nadie lo escriba.
  if (!total && cuota && cuantas) out.totalAPagar = cuota * cuantas
  // Y al revés: con el total y los cobros sale la cuota.
  if (!cuota && total && cuantas) out.valorCuota = Math.round(total / cuantas)
  if (!cuantas && total && cuota) out.numeroCuotas = Math.round(total / cuota)

  /* ⚠ NADIE DEBE MÁS DE LO QUE VALE SU PRÉSTAMO.
   *
   * La cartulina de Lorena lleva DOS préstamos seguidos: uno de 240 ya saldado y
   * otro de 600 en curso. El lector sacó bien el saldo (375) y lo abonado (225)
   * —los dos del préstamo vivo— pero puso de total el 240 del viejo, que es el
   * que está escrito arriba en grande.
   *
   * Se ve sin mirar la foto: el saldo era MAYOR que el total. Cuando eso pasa,
   * las dos cifras de la tabla mandan sobre la de la cabecera, porque la tabla
   * es lo que se ha estado cobrando. 375 + 225 = 600, que es el préstamo de
   * verdad, al peso. */
  {
    const saldoT = num(out.saldoPendiente)
    const pagadoT = num(out.montoPagadoHasta)
    const totalT = num(out.totalAPagar)

    /* ⚠ SOLO CUANDO ES IMPOSIBLE: que se deba MÁS de lo que vale el préstamo.
     *
     * La primera versión saltaba con `saldo + pagado > total`, y eso también se
     * cumple cuando el modelo cuenta un abono de más — que es lo que hacía con
     * Lorena: contaba como abono el renglón donde se ENTREGÓ la plata. Con
     * total 600, saldo 375 y un pagado inflado a 300, mi reparación subía el
     * préstamo a 675 y estropeaba una lectura que estaba bien.
     *
     * `saldo > total` no tiene otra explicación posible: o hay dos préstamos en
     * el papel, o el total es el del viejo. */
    if (saldoT && pagadoT && (!totalT || saldoT > totalT)) {
      out.totalAPagar = saldoT + pagadoT
      if (totalT && totalT !== out.totalAPagar) {
        out._avisoTotal = `En el papel hay dos préstamos: el de ${totalT.toLocaleString('es-CO')} ya está saldado. Se tomó el que sigue vivo, de ${out.totalAPagar.toLocaleString('es-CO')}.`
      }
    }
  }

  /* ══ LA COLUMNA DE SALDOS MANDA SOBRE LA DE ABONOS ══════════════════════════
   *
   * Con el total y el saldo, lo abonado es una resta y no hace falta contar
   * renglones. Y contar renglones es justo lo que el modelo hace mal: en la
   * cartulina de Lorena, el renglón donde el prestamista ENTREGÓ los 500 está en
   * la columna «abono», así que lo cuenta como un pago más (300 en vez de 225).
   *
   * El saldo es la cuenta que el prestamista lleva a mano cobro a cobro: es el
   * número más fiable del papel. 600 − 375 = 225, al peso. */
  {
    const totalT = num(out.totalAPagar)
    const saldoT = num(out.saldoPendiente)
    const pagadoT = num(out.montoPagadoHasta)
    if (totalT && saldoT && totalT > saldoT) {
      const porResta = totalT - saldoT
      if (pagadoT && pagadoT !== porResta) {
        out._avisoAbonado = `Los abonos sumaban ${pagadoT.toLocaleString('es-CO')}, pero según el saldo van ${porResta.toLocaleString('es-CO')}. Se tomó el saldo.`
      }
      out.montoPagadoHasta = porResta
      // Y las cuotas pagadas se recuentan con la cuota real, no a ojo.
      const cuotaT = num(out.valorCuota)
      if (cuotaT) out.cuotasPagadas = Math.round(porResta / cuotaT)
    }
  }

  const total2 = num(out.totalAPagar)
  const tasa = num(out.tasaInteres)

  /* ⚠ EL TOTAL NO ES LO PRESTADO. Es la confusión que más caro sale: registrar
     $1.200.000 de capital donde se entregó $1.000.000 infla la cartera y hace
     que el sistema cobre interés sobre el interés. */
  if (!monto && total2 && tasa) out.montoPrestado = Math.round(total2 / (1 + tasa / 100))
  // Con los dos, la tasa sale sola y no hay que preguntarla.
  if (!tasa && total2 && monto && total2 > monto) {
    out.tasaInteres = Math.round(((total2 / monto) - 1) * 100)
  }

  // El plazo en días sale de cuántos cobros son y cada cuánto se cobra.
  const DIAS = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }
  const cuantas2 = num(out.numeroCuotas)
  if (!num(out.diasPlazo) && cuantas2 && DIAS[out.frecuencia]) {
    out.diasPlazo = cuantas2 * DIAS[out.frecuencia]
  }

  // Lo abonado sale del total menos lo que queda debiendo.
  const saldo = num(out.saldoPendiente)
  if (!num(out.montoPagadoHasta) && total2 && saldo && total2 > saldo) {
    out.montoPagadoHasta = total2 - saldo
  }
  return out
}

/* ══ EL CAPITAL, CON LA TASA QUE PONE EL PRESTAMISTA ═════════════════════════
 *
 * Las cartulinas de verdad casi nunca dicen cuánto se entregó: dicen el TOTAL y
 * el plan de cobro. La de Cristian dice «Valor 1200» y «8 x 150»; la de Lorena,
 * saldo 375 y abonos de 75. El capital no está escrito en ninguna de las dos.
 *
 * Pero el prestamista sí lo sabe, porque la tasa es SUYA y es la misma para toda
 * su cartera — por eso la pantalla del lote ya la pide una vez arriba («INTERÉS
 * 20»). Con esa tasa el capital sale de una división: 1.200.000 / 1,20 =
 * 1.000.000. Y en Lorena da 500.000, que es exactamente lo que le prestó.
 *
 * Sin esto, la lectura sale perfecta y la ficha llega igual de vacía, porque
 * `montoPrestado` es el único campo que la pantalla mira. */
export function montoConTasa(c = {}, tasaPorDefecto) {
  if (Number(c.montoPrestado) > 0) return Number(c.montoPrestado)
  const tasa = Number(c.tasaInteres) > 0 ? Number(c.tasaInteres) : Number(tasaPorDefecto)
  const total = Number(c.totalAPagar)
  if (total > 0 && tasa > 0) return Math.round(total / (1 + tasa / 100))
  // Sin tasa no se puede separar capital de interés: mejor el total que nada,
  // y el prestamista lo corrige de un toque viendo su propia cartulina.
  return total > 0 ? total : null
}

/* ── EL SEMÁFORO ──
   Se calcula CONTANDO qué llegó, no preguntándole al modelo. Ver la nota de
   arriba sobre por qué no se pide «confianza».

     verde  — se puede crear el cliente Y su préstamo sin tocar nada
     ámbar  — se crea, pero falta algo que conviene revisar
     rojo   — sin nombre o sin monto no hay préstamo que crear */
export function semaforo(c = {}) {
  /* ⚠ EL TOTAL TAMBIÉN VALE COMO CIFRA DE PARTIDA, y antes no.
   *
   * La cartulina de Cristian no dice el capital ni la tasa: dice «Valor 1200» y
   * «8 x 150». Con eso hay préstamo de sobra —ocho cobros de $150.000— pero el
   * semáforo la pintaba ROJA por no traer `montoPrestado`, y en rojo la ficha se
   * manda a escribir a mano. Se descartaba una lectura buena por pedirle al
   * papel un dato que el papel no tiene: la tasa la sabe el prestamista y la
   * pone una vez para toda la tanda. */
  const hayCifra = c.montoPrestado > 0 || c.totalAPagar > 0 || (c.valorCuota > 0 && c.numeroCuotas > 0)
  if (!c.nombre || !hayCifra) return 'rojo'
  if (!c.frecuencia || !(c.tasaInteres > 0) || !(c.diasPlazo > 0)) return 'ambar'
  return 'verde'
}

