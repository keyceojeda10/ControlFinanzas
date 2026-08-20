// ═══════════════════════════════════════════════════════════════════════════
// LA CONCILIACION — tres columnas que se comparan, no cinco lineas que se suman
//
// ── LO QUE HABIA, Y POR QUE NO PODIA FUNCIONAR ────────────────────────────
//
// La caja del dia enseña una banda: base + cobrado − prestado − gastos +
// ajustes = saldo. Y «ajustes» se calcula asi (app/api/caja/route.js:660):
//
//     ajustesOperativosDia = (saldoCapitalActual − baseInicialDia)
//                            − recogida + desembolsadoDia + gastos
//
// Sustituye y sale la identidad: la banda CUADRA SIEMPRE, por algebra. No
// porque las cuentas esten bien, sino porque la ultima linea se define como
// exactamente lo que falta para que cuadren. Cualquier error de las otras
// cuatro se traslada integro ahi y nada lo señala.
//
// Por eso el cliente de 10 cobradores dice que su caja no cuadra y la app le
// enseña una banda perfecta. Y por eso alguien de ese negocio acabo asentando
// un «Descuento aplicado (CUADRE)» de $1.178.647.000 el 7 de julio para
// forzarlo a mano, dejandose el capital en −$1.142.705.070 durante dos dias.
// El descuadre existia; lo que faltaba era poder verlo.
//
// ── LA REGLA DE ORO ───────────────────────────────────────────────────────
//
//     `sinExplicar` NO SE SUMA JAMAS AL SALDO.
//
// Si no es cero, la pantalla lo dice. Un cero es una afirmacion; un residuo
// mudo es una mentira. Todo lo demas de este archivo se deduce de ahi.
//
// ── LAS TRES COLUMNAS ─────────────────────────────────────────────────────
//
//   LIBRO        solo `MovimientoCapital`. Cierra por construccion —y esta
//                bien, es su propia aritmetica— pero cada linea es auditable
//                fila por fila, con autor, motivo y hora.
//   OPERACIONES  lo que dicen las tablas de origen: `Pago`, `GastoMenor`, y
//                el efectivo que de verdad salio en los desembolsos.
//   FISICO       el fajo que el administrador conto. `CierreCaja.efectivoRecibido`.
//
// Entre LIBRO y OPERACIONES salen tres diferencias CON NOMBRE, y un cuarto
// numero —`sinExplicar`— que deberia ser cero y que jamas se suma a nada.
//
// ── LA CADENA DE TRES BRECHAS ─────────────────────────────────────────────
//
// Hoy las tres colapsan en un numero, y por eso «no me cuadra» no tiene
// respuesta. Separadas, cada una tiene dueño y accion distinta:
//
//     esperado del dia            ← el calendario decia que tocaba
//       │ INCUMPLIMIENTO            el cliente no pago      → es del cliente
//     recaudado segun operaciones ← los pagos registrados
//       │ DESFASE DE REGISTRO       pago sin asiento        → es del software
//     recaudado segun el libro    ← los asientos
//       │ FALTANTE DE CAJA          plata que no aparecio   → es del cobrador
//     efectivo contado            ← lo que el admin recibio
//
// ⚠ El faltante se compara EFECTIVO CONTRA EFECTIVO. Una caja fisica no
// contiene Nequi: en el cliente grande el 12% del recaudo entra por
// transferencia ($35.261.200), y meterlo en la comparacion hace que el fajo de
// la noche no cuadre nunca.
// ═══════════════════════════════════════════════════════════════════════════

// El vocabulario de alcances vive en el diccionario, no aqui. Tenerlo escrito
// en dos sitios es la misma falta que este modulo vino a arreglar, solo que con
// nombres en vez de con pesos. Se reexporta para no tocar a los que ya lo
// importan de aqui.
export { ALCANCE } from './definiciones.js'

// Los tres niveles a los que se puede conciliar una caja. El diccionario conoce
// dos mas —cliente y prestamo— que no son cajas y por eso no valen aqui.
const ALCANCES_DE_CAJA = Object.freeze(['organizacion', 'ruta', 'cobrador'])

/**
 * ¿Este asiento movio EFECTIVO de verdad?
 *
 * El descuento y el interes perdonado se asientan como egreso de capital
 * (app/api/prestamos/[id]/pagos/route.js:639 y :655). Ninguno de los dos es
 * plata que salio de la caja: bajan la CARTERA, no la bolsa. Pero como
 * `disponibleHoy = Capital.saldo`, la resta es permanente y acumulativa.
 *
 * Se deduce de la descripcion en vez de leer una columna porque la columna no
 * existe todavia. Cuando exista (`afectaCaja`), esta funcion es lo que hay que
 * usar para poblarla — y por eso vive aqui y no dentro de una ruta.
 *
 * ⚠ Los «Reverso recaudo» y «Reverso pago anulado» SI afectan la caja: son
 * plata que entro y despues se anulo. Meterlos aqui fue mi primer error
 * midiendo, y daba $2.611 millones de falso fantasma — mas que todo el capital
 * en la calle.
 */
export function afectaCaja(mov) {
  const d = mov?.descripcion || ''
  if (/^Descuento aplicado/i.test(d)) return false
  if (/perdonado/i.test(d)) return false
  if (/^Reverso descuento/i.test(d)) return false

  /* ⚠ UN ASIENTO QUE DEJA EL SALDO DONDE ESTABA NO MOVIÓ EFECTIVO.
   *
   * Reportado por Inversiones L&D el 16 ago 2026, con la captura de su caja del
   * día 15 y un «¿qué pasa aquí?»:
   *
   *     Con lo que amaneciste   $1.000.000
   *     Lo que entró          + $2.952.000
   *     Lo que prestaste      − $4.150.000
   *     ⚠ Hoy la cuenta no cierra: $1.200.000 sin explicación
   *     SALDO EN CAJA           $1.002.000
   *
   * Reconstruido contra su base: ese día prestó $2.950.000 de verdad, no
   * $4.150.000. La diferencia son DOS asientos de $600.000 con la descripción
   * «Reserva de capital por préstamo de cliente asignado a la ruta», que salen
   * al asignarle clientes a una ruta con capital: llevan `ajusteArranqueRuta` y
   * **mueven la bolsa de la ruta, no la caja del negocio**. Se ve en el propio
   * asiento — `saldoAnterior` y `saldoNuevo` son idénticos—.
   *
   * Y esos $1.200.000 son, al peso, el «sin explicación» que la propia pantalla
   * ya estaba denunciando. O sea: la conciliación tenía razón y el que estaba
   * mal era el renglón de arriba.
   *
   * ⚠ NO se mira `ajusteArranqueRuta` sino el saldo, a propósito: la regla que
   *   importa es «no movió la caja», y así vale para cualquier asiento futuro
   *   que tampoco la mueva sin tener que acordarse de añadirlo aquí.
   *
   * ⚠ Y solo cuando los dos saldos son NÚMEROS. Un `select` de Prisma que no
   *   los pida los deja en `undefined`, y `undefined === undefined` habría
   *   escondido TODOS los movimientos sin un solo error. Ver los dos sitios que
   *   llaman a esto: los dos los piden, y así queda fijado.
   */
  const antes = mov?.saldoAnterior
  const despues = mov?.saldoNuevo
  if (typeof antes === 'number' && typeof despues === 'number' && Math.round(antes) === Math.round(despues)) {
    return false
  }

  return true
}

/* ══ EL FAJO NO ES EL LIBRO ═══════════════════════════════════════════════════
 *
 * Estos son los asientos que el SISTEMA escribe para corregirse a sí mismo. La
 * bolsa cambia; el fajo que el cobrador lleva encima, no.
 *
 * Reportado por PRESTA MIL el 20 ago 2026: «cuando yo elimino un préstamo dice
 * corrección a favor, entonces me aparecieron 40 mil pesos. Ya las cuentas no
 * van a cuadrar».
 *
 * Su caso, al peso, reconstruido de su base:
 *
 *   14 ago 21:28  desembolso a MARIA GÓMEZ   −$50.000   (salió de su fajo ESE día)
 *   20 ago 00:29  pago recibido                +$10.000  (entró a su fajo HOY)
 *   20 ago 00:40  se elimina el préstamo
 *                   Reverso desembolso        +$50.000
 *                   Reverso recaudo           −$10.000
 *
 * Y la caja de esa mañana le pedía $40.000 de más: los $50.000 volvían a entrar
 * seis días después de haber salido, y los $10.000 se restaban DOS VECES —una
 * al borrarse el pago, que desaparece de «Cobró en efectivo», y otra por el
 * reverso—.
 *
 * ⚠ NO ES EL CASO RARO. Medido sobre 30 días en producción: 291 asientos así en
 * 122 cajas de cobrador-día. La peor, la ruta #10 el 14 de agosto, con
 * $18.839.800 de «correcciones a favor» que nunca fueron billetes — casi todos
 * de la cancelación «devolver todo a caja», la misma que ya se retiró el 15.
 *
 * El asiento está BIEN y se queda: el capital de la ruta sí tiene que volver a
 * su sitio. Lo que estaba mal era contarlo como plata en la mano.
 */
const CORRIGEN_EL_LIBRO = [
  /^Reverso/i,
  /^Cancelaci[óo]n pr[ée]stamo/i,
  /^Tarjeta clavo/i,
  /^Correcci[óo]n renovaci[óo]n/i,
]

/**
 * ¿Este asiento movió BILLETES en la mano del cobrador ese día?
 *
 * Es la pregunta de «tiene que entregar», que son billetes contados, y NO la de
 * `afectaCaja`, que es la de la bolsa del negocio. Un asiento puede mover la
 * bolsa sin mover el fajo: eso es justo lo que hace un reverso.
 *
 * La lista de arriba es negra a propósito, no blanca: las descripciones que
 * empiezan por esos prefijos las escribe el CÓDIGO y por eso son fiables. Todo
 * lo que teclea una persona —un cuadre, una reposición de base— se queda como
 * efectivo, que es lo que es.
 */
/* ── ⚠ LA EXCEPCIÓN: EDITAR UN PRÉSTAMO SÍ MUEVE BILLETES ────────────────────
 *
 * Editar el monto de un préstamo escribe DOS asientos en el mismo instante:
 *
 *     Desembolso préstamo a ALEXYA               −$250.000   (al crearlo)
 *     Reverso desembolso - edición préstamo      +$250.000   ┐ misma
 *     Desembolso actualizado - edición préstamo  −$300.000   ┘ milésima
 *
 * Los dos últimos son UNA PAREJA cuyo neto es la diferencia que de verdad
 * cambió de manos. Con el reverso excluido y el actualizado dentro, el fajo
 * veía −$550.000 donde salieron $300.000: le restaba al cobrador el préstamo
 * entero DOS VECES.
 *
 * Medido en producción sobre 60 días: 39 parejas así, en 26 días distintos y
 * **15 organizaciones**. No es el caso raro.
 *
 * Sale bien en los tres escenarios reales:
 *   · se entregó más (250 → 300):        −250 +250 −300 = −300  ✓
 *   · se tecleó mal (581 → 581.000):     −581 +581 −581.000     ✓
 *   · se corrige días después:           +250 −300 = −50, la diferencia  ✓
 *
 * ⚠ Queda un caso torcido y conocido: corregir días después un monto que nunca
 *   cambió de manos mueve el fajo del día de la CORRECCIÓN, no el del préstamo.
 *   El capital total sigue cuadrando; lo que se desplaza es la fecha. */
const AUNQUE_EMPIECEN_POR_REVERSO = [
  /^Reverso desembolso - edici[óo]n/i,
]

export function afectaElFajo(mov) {
  if (!afectaCaja(mov)) return false
  // Un movimiento por transferencia baja la bolsa pero no el fajo.
  if (mov?.metodoPago === 'transferencia') return false
  const d = mov?.descripcion || ''
  if (AUNQUE_EMPIECEN_POR_REVERSO.some((re) => re.test(d))) return true
  return !CORRIGEN_EL_LIBRO.some((re) => re.test(d))
}

/** Direccion real de un asiento: el libro la guarda en los saldos, no en una columna. */
export function esIngreso(mov) {
  return Number(mov?.saldoNuevo ?? 0) >= Number(mov?.saldoAnterior ?? 0)
}

const redondo = (n) => Math.round(Number(n) || 0)

/**
 * Resume los movimientos de un dia como los ve el LIBRO.
 *
 * `apertura` sale del `saldoAnterior` del primer asiento, no de re-derivarlo
 * sumando: el libro ya lo guarda y re-calcularlo es como se cuelan los errores.
 *
 * ⚠ EL DIA SIN MOVIMIENTOS. Si no hay ni un asiento no hay «primer asiento», y
 * la apertura salia en CERO: la pantalla decia «con lo que amaneciste $0»
 * mientras su propio titular decia «saldo en caja $3.895.947». Reportado en
 * produccion con esas dos cifras en la misma tarjeta.
 *
 * Y no es un cero cosmetico: la cuenta entera queda «$0 + $0 − $0 = $0», o sea
 * el desglose CONTRADICE al titular que tiene encima. Es el mismo patron que
 * ya me costo una pantalla vacia: optimizar para el dia lleno y romper el dia
 * en blanco, que es justo como se abre la caja cada mañana.
 *
 * `saldoPrevio` es el saldo con el que se llega al dia —el `saldoNuevo` del
 * ultimo asiento ANTERIOR—. Se PASA, no se deduce: deducirlo aqui seria
 * re-derivar, que es lo que este comentario lleva advirtiendo desde arriba.
 * Solo se usa cuando el dia no tiene asientos propios; en cuanto hay uno, manda
 * el libro.
 */
/* ══ UN REVERSO DE GASTO NO ES UN AJUSTE DE CAJA ═════════════════════════════
 *
 * Cuando se borra o se rechaza un gasto ya asentado, el libro escribe un
 * movimiento contrario. Ese movimiento es de tipo `ajuste` —para que devuelva la
 * plata— pero NO es un ajuste de caja: es la anulación de un gasto.
 *
 * ⚠ CONTARLO COMO AJUSTE DEJABA EL DÍA ROTO PARA SIEMPRE. La conciliación
 *   compara los gastos del LIBRO contra los gastos de la TABLA. Al borrar el
 *   gasto, la tabla baja a cero y el libro se quedaba con el egreso entero,
 *   porque su reverso estaba contado en otro renglón. Resultado: «$282.000 de
 *   gastos que no cuadran», sin nada que el prestamista pudiera hacer.
 *
 * Lo destapó Oswaldo Castilla el 16 ago 2026, que se pasó la mañana
 * registrando, ajustando y borrando el mismo gasto contra ese aviso.
 *
 * Se reconoce por la referencia, no por el texto: la descripción se puede
 * cambiar sin que nadie se acuerde de esta función. */
export function esReversoDeGasto(m) {
  return m?.tipo === 'ajuste' && m?.referenciaTipo === 'gasto'
}

export function resumirLibro(movimientos = [], saldoPrevio = null) {
  const orden = [...movimientos].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  const vivos = orden.filter(afectaCaja)

  const previo = saldoPrevio == null ? 0 : redondo(saldoPrevio)

  const r = {
    apertura: orden.length ? redondo(orden[0].saldoAnterior) : previo,
    // Un dia sin movimientos cierra donde abrio: es lo que hace que
    // `sinExplicar` siga dando cero y no aparezca un descuadre inventado.
    cierre: orden.length ? redondo(orden[orden.length - 1].saldoNuevo) : previo,
    recaudo: 0, recaudoEfectivo: 0, recaudoDigital: 0,
    desembolsos: 0, gastos: 0, inyecciones: 0, retiros: 0,
    ajustes: 0,
    // Los asientos que NO movieron efectivo se cuentan aparte y con su nombre,
    // para poder enseñarle al prestamista cuanta de «su plata» nunca salio.
    sinEfecto: 0, sinEfectoCantidad: 0,
    cantidad: vivos.length,
  }

  for (const m of orden) {
    const monto = redondo(m.monto)
    if (!afectaCaja(m)) { r.sinEfecto += monto; r.sinEfectoCantidad += 1; continue }

    switch (m.tipo) {
      case 'recaudo':
        r.recaudo += monto
        if (m.metodoPago === 'transferencia') r.recaudoDigital += monto
        else r.recaudoEfectivo += monto
        break
      case 'desembolso': r.desembolsos += monto; break
      case 'gasto': r.gastos += monto; break
      case 'inyeccion':
      case 'capital_inicial': r.inyecciones += monto; break
      case 'retiro': r.retiros += monto; break
      default:
        // Anular un gasto RESTA de los gastos del día, no suma a los ajustes.
        if (esReversoDeGasto(m)) { r.gastos -= monto; break }
        r.ajustes += esIngreso(m) ? monto : -monto
    }
  }
  return r
}

/**
 * Compone la conciliacion. Es una funcion PURA: recibe cifras ya leidas y no
 * toca la base. Asi se puede probar sin servidor y, sobre todo, se puede
 * comprobar la identidad sin depender de que Prisma devuelva algo.
 *
 * @param alcance     uno de ALCANCE. Obligatorio y explicito.
 * @param libro       salida de `resumirLibro`
 * @param operaciones { pagos, pagosEfectivo, pagosDigital, gastos, desembolsos }
 * @param fisico      { contado } o null si nadie ha contado todavia
 * @param esperado    { esperado, atrasado } de lib/dinero/esperado.js
 */
export function conciliar({ alcance, libro, operaciones, fisico = null, esperado = null }) {
  if (!ALCANCES_DE_CAJA.includes(alcance)) {
    throw new Error(`Alcance desconocido: ${alcance}`)
  }

  // ── Las cuatro diferencias, tres con nombre y una que debe ser cero ──
  const difRecaudo = redondo(libro.recaudo - operaciones.pagos)
  const difGastos = redondo(libro.gastos - operaciones.gastos)
  const difDesembolsos = redondo(libro.desembolsos - operaciones.desembolsos)

  // ── `sinExplicar`: EL LIBRO CONTRA SI MISMO ──────────────────────────────
  //
  // ⚠ La primera version que escribi era «lo que sobra tras descontar las tres
  // diferencias con nombre». Sustituyendo sale que es CERO POR ALGEBRA: el
  // mismo pecado que la linea «Ajustes» que vengo a quitar. Un residuo que no
  // puede ser distinto de cero no comprueba nada.
  //
  // La comprobacion de verdad enfrenta dos cosas que el libro guarda POR
  // SEPARADO y que tienen que coincidir:
  //
  //   · la suma de los `monto` de cada asiento, uno a uno
  //   · el `saldoAnterior` del primero y el `saldoNuevo` del ultimo
  //
  // Si divergen, algo reescribio la historia —`recalcularSaldosCapital` lo hace
  // con cada movimiento retroactivo—, o se infirio mal la direccion de un
  // ajuste, o se colo un asiento fuera de orden. Cualquiera de las tres es un
  // descuadre real, y ninguna se puede tapar sumandola.
  const netoLibro = redondo(
    libro.recaudo + libro.inyecciones - libro.desembolsos - libro.gastos - libro.retiros + libro.ajustes,
  )
  const sinExplicar = redondo(libro.apertura + netoLibro - libro.cierre)

  // ── La cadena de brechas ──
  const brechas = {}
  if (esperado) {
    // Es del CLIENTE: el calendario pedia y no entro.
    brechas.incumplimiento = redondo(esperado.esperado - operaciones.pagos)
  }
  // Es del SOFTWARE: se registro un pago y el libro no lo asento (o al reves).
  brechas.desfaseRegistro = redondo(operaciones.pagos - libro.recaudo)
  if (fisico && fisico.contado != null) {
    // Es del COBRADOR: efectivo contra efectivo. Nequi no va en el fajo.
    brechas.faltanteCaja = redondo(fisico.contado - libro.recaudoEfectivo)
  }

  return {
    alcance,
    libro,
    operaciones: {
      pagos: redondo(operaciones.pagos),
      pagosEfectivo: redondo(operaciones.pagosEfectivo),
      pagosDigital: redondo(operaciones.pagosDigital),
      gastos: redondo(operaciones.gastos),
      desembolsos: redondo(operaciones.desembolsos),
    },
    fisico: fisico ? { contado: fisico.contado == null ? null : redondo(fisico.contado) } : null,
    esperado: esperado ? { esperado: redondo(esperado.esperado), atrasado: redondo(esperado.atrasado) } : null,
    diferencias: { recaudo: difRecaudo, gastos: difGastos, desembolsos: difDesembolsos, sinExplicar },
    brechas,
    // Lo unico que la pantalla puede pintar como «saldo». Sale del libro y de
    // nada mas: NO se le suma ningun residuo para hacerlo cuadrar.
    saldo: libro.cierre,
    cuadra: difRecaudo === 0 && difGastos === 0 && difDesembolsos === 0 && sinExplicar === 0,
  }
}

/**
 * Suma una lista de lineas con signo.
 *
 * ⚠ EL `signo: 0` SE SUMA IGUAL.
 *
 * Es la linea de apertura: se pinta SIN signo —«con lo que amaneciste» no es un
 * ingreso del dia— pero por supuesto entra en la cuenta. Multiplicarla por su
 * signo la borra.
 *
 * Me mordio TRES VECES en la misma tanda, y las tres en pantalla: «726.000 +
 * 161.000 = 161.000». Por eso esto vive aqui y no suelto en una ruta de API,
 * donde ninguna prueba lo alcanza.
 */
export function sumarLineas(lineas = []) {
  return Math.round(lineas.reduce((a, l) => a + (l.signo === 0 ? l.monto : l.signo * l.monto), 0))
}

/**
 * La cuenta de un dia: las lineas que existen, en orden, y su suma.
 *
 * Solo aparecen las lineas que tienen algo —salvo la apertura, que sale aunque
 * sea cero porque es el punto de partida y sin ella la cuenta no se entiende—.
 */
export function cuentaDelDia({ apertura = 0, entradas = [], salidas = [] }) {
  const lineas = [
    { id: 'apertura', rotulo: 'Con lo que salió', monto: redondo(apertura), signo: 0 },
    ...entradas.filter((l) => l.monto).map((l) => ({ ...l, monto: redondo(l.monto), signo: 1 })),
    ...salidas.filter((l) => l.monto).map((l) => ({ ...l, monto: redondo(l.monto), signo: -1 })),
  ]
  // ── LOS DOS SUBTOTALES ────────────────────────────────────────────────────
  //
  // Sin ellos hay que sumar de cabeza. El dueño lo dijo con la calculadora en
  // la mano: «estos dos números me toca a mí ponerme a sumarlos con la
  // calculadora y después compararlos con lo que ha prestado».
  //
  // Y dicto la cuenta que espera, que da EXACTA con nuestras cifras:
  //   352.000 + 428.000 − 40.000 − 485.215 = 254.785
  //
  // `entro` incluye la apertura: es plata con la que cuenta, aunque no sea un
  // ingreso del día. Así los dos subtotales se restan entre sí y dan el
  // resultado, sin líneas sueltas que haya que encajar mentalmente.
  const entro = redondo(
    apertura + entradas.filter((l) => l.monto).reduce((a, l) => a + l.monto, 0)
  )
  const salio = redondo(salidas.filter((l) => l.monto).reduce((a, l) => a + l.monto, 0))
  return { lineas, suma: sumarLineas(lineas), entro, salio }
}

/**
 * Las lineas de la banda, ya listas para pintar, con su signo y su nombre.
 *
 * A diferencia de la banda vieja, esta NO incluye ninguna linea calculada como
 * «lo que falta para cuadrar». Si la suma no da el saldo, la pantalla enseña la
 * discrepancia en vez de esconderla.
 */
export function lineasDeLaBanda(c) {
  const l = [
    { id: 'apertura', rotulo: 'Con lo que amaneciste', monto: c.libro.apertura, signo: 0 },
    { id: 'recaudo', rotulo: 'Lo que entró', monto: c.libro.recaudo, signo: 1 },
  ]
  if (c.libro.inyecciones) l.push({ id: 'inyecciones', rotulo: 'Plata que metiste', monto: c.libro.inyecciones, signo: 1 })
  l.push({ id: 'desembolsos', rotulo: 'Lo que prestaste', monto: c.libro.desembolsos, signo: -1 })
  l.push({ id: 'gastos', rotulo: 'Gastos', monto: c.libro.gastos, signo: -1 })
  if (c.libro.retiros) l.push({ id: 'retiros', rotulo: 'Plata que sacaste', monto: c.libro.retiros, signo: -1 })
  if (c.libro.ajustes) l.push({ id: 'ajustes', rotulo: 'Correcciones', monto: Math.abs(c.libro.ajustes), signo: c.libro.ajustes >= 0 ? 1 : -1 })

  // La apertura entra como semilla, no como sumando con signo: en la banda se
  // lee como punto de partida, no como un ingreso del dia.
  const suma = Math.round(l.reduce((a, x) => a + x.signo * x.monto, c.libro.apertura))
  return { lineas: l, suma, saldo: c.saldo, cuadra: suma === c.saldo }
}
