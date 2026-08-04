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

/* ── EL ICONO DE CADA MODO ──────────────────────────────────────────────────
 *
 * El dueño: «el modo de interés también con su ícono, que se pueda diferenciar
 * fácilmente». En la línea de metadatos «Diario 22% Clásico» el modo va en medio
 * de otras cuatro cosas separadas por puntos, y para distinguirlo hay que leerlo.
 * Un icono se reconoce sin leer, que es lo que hace falta cuando se recorre una
 * lista de 1.074 préstamos.
 *
 * Van los TRAZOS, no el componente: este archivo lo importan sitios que no
 * pintan nada (el API, los adaptadores) y meterle JSX lo convertiría en un
 * módulo de UI. Quien pinta hace el `<svg>` con `viewBox="0 0 24 24"`.
 *
 * El dibujo dice la FORMA DE LA DEUDA, que es lo que distingue a los modos:
 *   fijo/proporcional → escalera pareja: la misma cuota hasta el final
 *   unico            → una sola barra: se paga de una vez, al final
 *   solo_interes     → línea plana y un salto: el globo del capital
 *   saldo            → escalera que baja: la cuota se come el saldo
 *   lineal/dinamico  → rampa descendente: cada cuota es menor
 *   manual           → mano alzada: lo tecleó una persona
 */
export const ICONO_MODO = {
  fijo:            'M4 18h3v-6H4zM10.5 18h3V9h-3zM17 18h3v-9h-3z',
  proporcional:    'M4 18h3v-6H4zM10.5 18h3V9h-3zM17 18h3v-9h-3z',
  unico:           'M6 18V7a2 2 0 012-2h8a2 2 0 012 2v11M6 18h12M9.5 11h5',
  solo_interes:    'M4 15h9M4 15v3M13 15V7h7v11M13 18h7',
  saldo:           'M4 7h4v11H4zM10 11h4v7h-4zM16 15h4v3h-4z',
  lineal:          'M4 6l16 12M4 18h16',
  lineal_dinamico: 'M4 6l16 12M4 18h16M8 9.5l2 1.5M14 13.5l2 1.5',
  manual:          'M5 18c2-6 5-9 7-9s2 3 0 5 1 2 3 0 3-3 4-2',
}

/** El trazo del icono de este modo, para pintarlo en un `<svg viewBox="0 0 24 24">`. */
export function iconoModo(modo) {
  return ICONO_MODO[modo] || ICONO_MODO.fijo
}

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

  // Modo CON tabla que NO la trae cargada. Aquí la diferencia no es cosmética:
  // devolver `true` subiría la deuda de un cliente por un olvido de
  // programación, así que no se adivina.
  //
  // ⚠ PERO HAY QUE SEPARAR DOS COSAS QUE PARECEN LA MISMA:
  //
  //   · `undefined` — nadie pidió las filas: es un `include` de Prisma que
  //     falta. Un error del programador, y se REVIENTA: seguir en silencio
  //     elegiría solo entre dos comportamientos que mueven plata distinta y el
  //     fallo se vería semanas después en la cartera.
  //   · `[]` — se pidieron y NO HAY NINGUNA. El préstamo se creó sin tabla y
  //     así está en la base. No es un error de código: es un dato incompleto.
  //
  // Los dos casos se trataban igual, y el segundo dejaba al prestamista con la
  // pantalla de error y sin poder cobrarle a su cliente. Medido el 4 ago: 12
  // préstamos activos en modo «saldo» sin una sola fila, todos de junio y
  // julio, repartidos en 8 negocios. La vía de creación ya está arreglada —53
  // préstamos «saldo» desde el 18 jul, todos con tabla— así que esto es lastre
  // histórico, no una fuga abierta.
  //
  // Con `[]` se responde `false`: sin tabla que consultar, la respuesta segura
  // es la que NO sube la deuda. Equivocarse hacia arriba le cobra de más a un
  // cliente; hacia abajo, solo deja de alargar el préstamo.
  if (prestamo?.cuotasAmortizacion === undefined || prestamo?.cuotasAmortizacion === null) {
    throw new Error(
      `El préstamo ${prestamo?.id ?? '(sin id)'} es de modo "${modo}" (con tabla) pero llegó sin ` +
      '`cuotasAmortizacion`. Falta el `include` de Prisma: sin las filas no se puede saber si el ' +
      'pago de interés sube la deuda o no.',
    )
  }
  return false
}
