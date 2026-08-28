// lib/muelle.js — MOVIMIENTO QUE SE PUEDE AGARRAR A MEDIO CAMINO.
//
// ══ POR QUÉ UN MUELLE Y NO UNA TRANSICIÓN ══════════════════════════════════
//
// Una transición CSS tiene una duración fija decidida de antemano: no sabe a
// qué velocidad venía tu dedo ni puede cambiar de destino a mitad de camino. Si
// agarras una hoja que se está cerrando, la transición termina de cerrarla y
// luego la reabre — un salto. El muelle no tiene duración: tiene un destino, y
// cambiar el destino no interrumpe nada porque arranca de donde está AHORA y
// con la velocidad que lleva.
//
// ══ LOS DOS NÚMEROS ════════════════════════════════════════════════════════
//
// No son masa/rigidez/amortiguación, que no se piensan bien. Son los dos de
// Apple:
//
//   · `amortiguacion` — cuánto rebota. 1 = llega y se queda, sin rebote.
//     Por debajo de 1 se pasa y vuelve. Más bajo, más rebote.
//   · `respuesta` — en segundos, lo rápido que llega. No es «duración»: el
//     muelle no tiene duración, el tiempo de asiento sale de los parámetros.
//
// Y la regla de cuándo poner rebote: SOLO si el gesto traía impulso. Un rebote
// en un menú que apareció solo se siente mal; en una tarjeta que lanzaste con
// el dedo, se siente bien.
//
// Los valores que usa Apple, y que usamos aquí:
//
//     mover algo de sitio ... amortiguación 1,0 · respuesta 0,4
//     hoja inferior ........ amortiguación 0,8 · respuesta 0,3

/**
 * Convierte los dos números de diseño en los de la física.
 * @param {number} amortiguacion  1 = sin rebote
 * @param {number} respuesta      segundos hasta llegar
 */
export function constantes(amortiguacion = 1, respuesta = 0.4) {
  const w = (2 * Math.PI) / respuesta
  return { rigidez: w * w, freno: 2 * amortiguacion * w }
}

/**
 * Un paso del muelle. Euler semi-implícito: la velocidad se actualiza ANTES que
 * la posición, que es lo que lo hace estable con pasos grandes —y los pasos
 * grandes existen, porque el navegador salta cuadros cuando el teléfono va
 * cargado—.
 *
 * @param {{valor:number, velocidad:number}} estado
 * @param {number} destino
 * @param {number} dt   segundos desde el paso anterior
 */
export function paso(estado, destino, dt, { amortiguacion = 1, respuesta = 0.4 } = {}) {
  const { rigidez, freno } = constantes(amortiguacion, respuesta)
  /* ⚠ EL PASO SE ACOTA. Al volver de otra pestaña el navegador entrega un `dt`
     de varios segundos de golpe, y el muelle sale disparado hasta el infinito:
     la hoja desaparecía de la pantalla. Medio cuadro a 30fps es el techo. */
  const h = Math.min(dt, 1 / 30)
  const fuerza = -rigidez * (estado.valor - destino) - freno * estado.velocidad
  const velocidad = estado.velocidad + fuerza * h
  return { valor: estado.valor + velocidad * h, velocidad }
}

/** Ya llegó: ni se mueve ni le queda distancia. Sin esto el bucle no para. */
export function asentado(estado, destino, epsilon = 0.4) {
  return Math.abs(estado.valor - destino) < epsilon && Math.abs(estado.velocidad) < epsilon * 10
}

/**
 * DÓNDE VA A PARAR ALGO QUE ACABAS DE LANZAR.
 *
 * Al soltar no se mira dónde está el dedo, se mira hacia dónde iba. Es lo que
 * hace que un empujón corto y rápido cierre la hoja aunque la hayas movido dos
 * dedos: «una entrada pequeña, una salida grande».
 *
 * ⚠ NO ES LA FÓRMULA DEL LIBRO DE FÍSICA (v²/2a). Es la caída exponencial que
 * usan de verdad los sistemas operativos, y da un resultado bastante distinto.
 *
 * @param {number} velocidad  px por segundo
 * @param {number} freno      0,998 desliza como el scroll; 0,99 es más seco
 */
export function proyectar(velocidad, freno = 0.998) {
  return ((velocidad / 1000) * freno) / (1 - freno)
}

/**
 * RESISTENCIA EN EL BORDE, EN VEZ DE UN TOPE SECO.
 *
 * Cuanto más tiras pasado el límite, menos te sigue. Un tope duro se lee como
 * «se congeló»; la resistencia se lee como «sigue vivo, pero aquí no hay más».
 *
 * @param {number} exceso     cuánto te has pasado, en px
 * @param {number} dimension  el tamaño del elemento
 */
export function resistencia(exceso, dimension, constante = 0.55) {
  if (!dimension) return 0
  return (exceso * dimension * constante) / (dimension + constante * Math.abs(exceso))
}

/**
 * LA VELOCIDAD CON LA QUE SE SOLTÓ, Y SOLO SI ES RECIENTE.
 *
 * ⚠ SIN LA CADUCIDAD LA HOJA SE CIERRA SOLA. El caso real: bajas la hoja a
 * medio camino, te lo piensas un segundo con el dedo quieto y sueltas. Mientras
 * estás parado no llega ningún evento, así que la historia sigue guardando el
 * tirón de antes y se suelta con una velocidad que ya no existe.
 *
 * Quieto = 0 = decide la posición, que es lo que la persona está viendo.
 *
 * Y sale del recorrido reciente, no del último par de puntos: dos puntos
 * seguidos dan saltos enormes en cuanto el dedo duda un instante.
 *
 * @param {Array<[number, number]>} historia  pares [milisegundos, posición]
 * @param {number} ahora     el reloj, en milisegundos
 * @param {number} ventana   cuánto pasado cuenta, en milisegundos
 * @returns {number} píxeles por segundo
 */
export function velocidadDe(historia, ahora, ventana = 120) {
  if (!Array.isArray(historia)) return 0
  const recientes = historia.filter(([t]) => ahora - t <= ventana)
  if (recientes.length < 2) return 0
  const [t0, p0] = recientes[0]
  const [t1, p1] = recientes[recientes.length - 1]
  return ((p1 - p0) / Math.max(1, t1 - t0)) * 1000
}
