/* LOS PAGOS QUE LEEN LAS FUNCIONES DE CÁLCULO, EN UN SOLO SITIO.
 *
 * Cinco pantallas (Inicio, Capital, Analíticas, su PDF y Socios) pedían los
 * pagos de cada préstamo así:
 *
 *     pagos: { where: { tipo: 'capital' }, … }
 *
 * «Solo los abonos a capital, que son un puñado.» Era verdad cuando se escribió.
 * Después `repartirPagado` y `calcularCapitalRestante` aprendieron a respetar el
 * pago declarado SOLO INTERÉS, y la mora del préstamo abierto aprendió a leer
 * los pagos «intereses» y «completo» contra lo devengado. Ninguno de los cinco
 * `select` se enteró: un tipo que no se pide no da error, llega como lista vacía
 * y la función decide mal EN SILENCIO.
 *
 * Medido en el espejo el 20 sep 2026, desglosando casos al peso:
 *
 *   · CAPITAL EN LA CALLE. 39 préstamos vivos en 17 negocios, $1.426.770 de
 *     capital que estas pantallas daban por devuelto. Uno: prestó $500.000 y lo
 *     único que le han pagado son $200.000 declarados interés. La ficha dice
 *     que siguen $500.000 en la calle; el Inicio decía $388.889.
 *   · MORA DEL ABIERTO. 7 de 74 abiertos, en 4 negocios, salían en mora en el
 *     Inicio estando al día. Uno: 7 meses devengados por $2.800.000, pagados
 *     los $2.800.000 —el Inicio lo tenía con 210 días de mora—. Es el fallo
 *     opuesto al que avisa el comentario de `devengos` en esos mismos `select`.
 *
 * Lo que se pide:
 *   · 'capital' e 'intereses' — de TODOS: son los dos tipos DECLARADOS, los que
 *     no entran al reparto. Pocos por préstamo.
 *   · 'completo' — SOLO de los abiertos: ahí el pago corriente cubre primero el
 *     interés devengado. En los demás no se lee uno a uno (manda `totalPagado`)
 *     y son el grueso de la tabla: traerlos costaría caro para nada.
 *
 * ⚠ NO es para `lib/dinero/devengar.js`: esa consulta decide sobre cuánto se
 * devenga el período siguiente y ahí sí manda solo el abono a capital. */
export const PAGOS_DEL_CALCULO = {
  where: {
    OR: [
      { tipo: { in: ['capital', 'intereses'] } },
      { tipo: 'completo', prestamo: { sinPlazo: true } },
    ],
  },
  select: { tipo: true, montoPagado: true },
}

/** La misma regla, para filtrar en memoria una lista que ya se trajo entera. */
export function loLeeElCalculo(pago, prestamo) {
  if (pago?.tipo === 'capital' || pago?.tipo === 'intereses') return true
  return pago?.tipo === 'completo' && !!prestamo?.sinPlazo
}
