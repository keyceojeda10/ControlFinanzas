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
