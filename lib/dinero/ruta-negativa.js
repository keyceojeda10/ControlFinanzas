/**
 * Por qué el capital de una ruta sale en negativo.
 *
 * ══ NO ES UN DESCUADRE ═══════════════════════════════════════════════════════
 *
 * La pantalla enseñaba «−$220.906.600» en rojo y nada más. El dueño lee eso
 * como que le falta plata, y no falta: el libro cuadra. Medido contra
 * producción el 4 ago sobre las 28 rutas en negativo, son TRES causas y
 * ninguna es un error de cálculo:
 *
 *   · 14 rutas — EL AJUSTE DE ARRANQUE. Al activar el capital por ruta, el
 *     sistema descuenta los préstamos que ya estaban en la calle. «Ruta 1»
 *     tiene −$220,9M de saldo y −$235,9M de ajuste de arranque: sin él estaría
 *     en +$14,9M. Su capital está bien; lo que resta es la absorción.
 *   · 12 rutas — NUNCA SE LES ASIGNÓ CAPITAL. «Maicol» prestó $98,2M con $0
 *     asignados, así que cada préstamo la hunde más. Falta un dato, no plata.
 *   ·  2 rutas — PRESTARON MÁS DE LO QUE SE LES PUSO. «BOSA» tiene $160M
 *     asignados y $375,8M prestados. Es real y es lo único que puede querer
 *     mirar de verdad: la ruta gasta capital de otra parte del negocio.
 *
 * Sin decir cuál de las tres es, el prestamista no puede hacer nada con la
 * cifra. Con la causa, dos de los tres casos se arreglan registrando un dato.
 */

/** Qué le pasa a esta ruta. Devuelve `null` si su saldo no es negativo. */
export function porQueNegativa(ruta) {
  const saldo = Math.round(Number(ruta?.saldoCapital ?? 0))
  if (saldo >= 0) return null

  // `arranqueAbsorbido` viene de `getSaldosPorRuta` y ya llega a la pantalla.
  // Es lo que se descontó al activar el capital de esta ruta.
  const arranque = Math.round(Number(ruta?.arranqueAbsorbido ?? 0))
  const inyectado = Math.round(Number(ruta?.inyectado ?? 0))

  // ¿El negativo lo explica el ajuste de arranque? Se compara contra el saldo
  // SIN ese ajuste: si sin él la ruta estaría en positivo, esa es la causa.
  //
  // ⚠ `arranqueAbsorbido` suma los montos EN CRUDO, sin signo: son desembolsos,
  // así que restan. Por eso se suma aquí para deshacerlos, no se resta.
  if (arranque > 0 && saldo + arranque >= 0) {
    return {
      causa: 'arranque',
      titulo: 'Es el arranque, no un faltante',
      detalle: 'Al activar el capital de esta ruta se descontaron los préstamos que ya estaban en la calle.',
      sinEso: saldo + arranque,
      accion: null,
    }
  }

  if (inyectado === 0) {
    return {
      causa: 'sin_capital',
      titulo: 'A esta ruta nunca le asignaste capital',
      detalle: 'Presta con plata del negocio, así que cada préstamo la deja más abajo. Asígnale capital y la cifra queda al día.',
      sinEso: null,
      accion: 'asignar',
    }
  }

  return {
    causa: 'sobregiro',
    titulo: 'Prestó más de lo que le asignaste',
    detalle: 'Está usando capital de otra parte del negocio. Si es a propósito, asígnale más para que la cifra lo refleje.',
    sinEso: null,
    accion: 'asignar',
  }
}

/**
 * ¿Hay que pintarla en rojo?
 *
 * El rojo es para lo que va mal. Un negativo que solo es el arranque —o una
 * ruta a la que aún no se le ha asignado capital— no va mal: le falta un dato.
 * Pintar los tres casos igual es lo que hace que el dueño no distinga el único
 * que sí merece su atención, que es el sobregiro.
 */
export function esAlarma(ruta) {
  const p = porQueNegativa(ruta)
  return p?.causa === 'sobregiro'
}
