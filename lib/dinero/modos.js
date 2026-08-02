// lib/dinero/modos.js — cómo se llama cada modo de interés, en un solo sitio.
//
// ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
// El mismo modo tenía SEIS nombres distintos repartidos por la app, escritos a
// mano uno por uno. `solo_interes` era «Globo» en la lista de préstamos, «Solo
// interés» en la tabla de amortización y «Solo interés (globo)» en el resumen
// del cálculo. `fijo` era «Clásico» al crearlo y «Cuota fija» al leerlo.
//
// Eso no es un detalle de redacción: el prestamista crea un préstamo eligiendo
// «Clásico» y después no lo encuentra en ninguna pantalla, porque en todas se
// llama de otra forma. Un nombre que cambia según dónde mires es un nombre que
// no sirve para hablar por teléfono con soporte.
//
// ── QUÉ NOMBRE MANDA ───────────────────────────────────────────────────────
// El del SELECTOR con el que se crea el préstamo
// (`prestamos/nuevo/page.jsx:1564`). No es una preferencia estética: es el
// único que el dueño eligió a conciencia y el único que puede recordar.
//
// ⚠ ESTO ES SOLO LA MITAD DE G5. Falta la matriz de capacidades
// (`tieneTabla`, `permiteAbonoCapital`, `permiteAbonoInteres`…), el `enum` en
// `schema.prisma` y la prueba de guardia que rompe si aparece una lista de
// modos escrita a mano fuera de este archivo. Se separó a propósito: las
// etiquetas hacían falta HOY para poder decir en la tarjeta en qué modo está
// creado el préstamo, y meter la matriz entera de paso habría convertido un
// arreglo de un renglón en una migración de once sitios.

/** El nombre que el dueño eligió en el selector, por modo. */
export const ETIQUETA_MODO = {
  fijo: 'Clásico',
  unico: 'De una vez',
  solo_interes: 'Globo',
  saldo: 'Sobre saldo',
  manual: 'Manual',
  lineal: 'Decreciente',
  lineal_dinamico: 'Decr. dinámico',
  // Inalcanzable desde hace tiempo —`calculos.js` exige un `redondeo` que nadie
  // pasa— pero hay préstamos viejos guardados así y tienen que poder leerse.
  proporcional: 'Proporcional',
}

/**
 * Cómo se llama este modo, para enseñárselo a una persona.
 *
 * Cae a «Clásico» porque es el valor por defecto real de la base: una fila sin
 * `modoInteres` se calcula como `fijo`, así que decir «Clásico» es cierto, y es
 * mejor que un hueco o que el identificador crudo con guión bajo.
 */
export function etiquetaModo(modo) {
  return ETIQUETA_MODO[modo] || ETIQUETA_MODO.fijo
}

/* ── LA MATRIZ DE CAPACIDADES — la otra mitad de G5 ─────────────────────────
 *
 * Qué SABE HACER cada modo, en un solo sitio. Hasta ahora esto vivía en listas
 * de modos escritas a mano, y ya se contradecían entre ellas:
 *
 *   `RegistrarPago.jsx:741`  → lineal · lineal_dinamico · solo_interes · saldo
 *   `pagos/route.js:152`     → lineal · lineal_dinamico · solo_interes
 *   `RegistrarPago.jsx:1233` → lineal · lineal_dinamico · solo_interes
 *   `prestamos/[id]/page.jsx:1848` → lineal · lineal_dinamico · solo_interes
 *
 * O sea: un préstamo en `saldo` ENSEÑABA el botón de «Interés» y el servidor lo
 * rechazaba con un 400. Son 79 préstamos vivos en el espejo. Nadie lo reportó
 * porque el que lo intenta ve un error y prueba otra cosa.
 *
 * La regla: cuando haya que preguntar «¿este modo puede X?», se pregunta AQUÍ.
 * Una lista de modos escrita a mano en cualquier otro archivo es el fallo.
 */

/** ¿Este modo guarda filas en `CuotaAmortizacion`? */
export const MODOS_CON_TABLA = ['lineal', 'lineal_dinamico', 'solo_interes', 'saldo']

/**
 * ¿Se le puede registrar un pago de SOLO INTERÉS?
 *
 * Todos. Pero por dos caminos distintos, y confundirlos descuadra la plata:
 *
 *  · CON tabla   → el interés vencido existe fila por fila. El monto tiene tope
 *                  (`calcularInteresesPendientes`) y se anota en `interesPagado`.
 *                  La deuda NO sube: ese interés ya estaba pactado.
 *
 *  · SIN tabla   → en clásico el interés viene DENTRO de `totalAPagar` desde el
 *                  primer día; no hay un saldo de interés aparte que cobrar. Un
 *                  pago de solo interés es interés NUEVO: sube `totalAPagar` y
 *                  el capital no se mueve. Decidido con el dueño el 2 ago 2026.
 */
export function permiteAbonoInteres() {
  return true
}

/**
 * ¿El pago de interés SUBE la deuda en este modo?
 *
 * Sólo sin tabla. Es la diferencia entre «pago el interés que ya te debía» y
 * «te compro un mes más», y es la pregunta que decide si el préstamo se alarga.
 *
 * ⚠ Se pregunta por el PRÉSTAMO, no por el modo a secas: `tieneTablaAmortizacion`
 * exige que las filas estén CARGADAS (el `include` de Prisma). Un préstamo con
 * tabla al que se le olvidó el include respondería que sí y subiría una deuda
 * que no debía subir. Por eso esta función recibe el préstamo entero.
 */
export function elInteresSubeLaDeuda(prestamo) {
  const modo = prestamo?.modoInteres || 'fijo'
  if (!MODOS_CON_TABLA.includes(modo)) return true

  // Modo CON tabla que NO la trae cargada: es un `include` que falta, no un
  // préstamo sin tabla. Y aquí la diferencia no es cosmética — devolver `true`
  // subiría la deuda de un cliente por un olvido de programación.
  //
  // Se REVIENTA en vez de adivinar. Es la única salida honesta: seguir en
  // silencio elige por su cuenta entre dos comportamientos que mueven plata
  // distinta, y el fallo sólo se vería semanas después en la cartera.
  if (!Array.isArray(prestamo?.cuotasAmortizacion) || prestamo.cuotasAmortizacion.length === 0) {
    throw new Error(
      `El préstamo ${prestamo?.id ?? '(sin id)'} es de modo "${modo}" (con tabla) pero llegó sin ` +
      '`cuotasAmortizacion`. Falta el `include` de Prisma: sin las filas no se puede saber si el ' +
      'pago de interés sube la deuda o no.',
    )
  }
  return false
}
