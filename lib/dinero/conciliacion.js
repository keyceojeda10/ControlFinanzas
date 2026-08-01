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

export const ALCANCE = Object.freeze({
  ORGANIZACION: 'organizacion',
  RUTA: 'ruta',
  COBRADOR: 'cobrador',
})

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
  return true
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
 */
export function resumirLibro(movimientos = []) {
  const orden = [...movimientos].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  const vivos = orden.filter(afectaCaja)

  const r = {
    apertura: orden.length ? redondo(orden[0].saldoAnterior) : 0,
    cierre: orden.length ? redondo(orden[orden.length - 1].saldoNuevo) : 0,
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
      default: r.ajustes += esIngreso(m) ? monto : -monto
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
  if (!Object.values(ALCANCE).includes(alcance)) {
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
  return { lineas, suma: sumarLineas(lineas) }
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
