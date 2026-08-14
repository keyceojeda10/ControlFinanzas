// lib/sugerencias.js — La campaña para preguntarle a la gente qué le falta.
//
// ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
//
// Preguntar funciona: la noche del 13 de agosto se arreglaron siete cosas porque
// el dueño le preguntó a un cliente y el cliente contestó con un video, capturas
// y una explicación. Eso salió de UNA conversación. Hay 465 negocios.
//
// ── LO QUE YA SE INTENTÓ, Y CÓMO FUE ────────────────────────────────────────
//
// ⚠ Esto no es el primer intento y conviene saberlo antes de repetir el error:
//
//   · La campaña de fotos de cuadernos (7–11 ago) tuvo banner en el panel,
//     montado y visible, cuatro días, 465 negocios: **cero fotos**.
//   · `TicketSoporte` tiene un tipo `solicitud` —que es exactamente «pide una
//     mejora»— desde que existe el producto: **un ticket**.
//
// Y sin embargo la gente sí habla: manda notas de voz y capturas por WhatsApp
// todo el día. La conclusión no es «no tienen nada que decir», es que hay que
// ponérselo donde ya están y pedirles poco.
//
// Por eso aquí se puede contestar de las tres formas en que la gente contesta de
// verdad —escribiendo, con una foto o hablando— y la nota de voz llega ya
// TRANSCRITA. Trescientos audios que hay que oír de uno en uno no son un sondeo;
// trescientos textos sí.
//
// ── LO QUE SE APRENDIÓ DE LA CAMPAÑA ANTERIOR ───────────────────────────────
//
//   · Va para TODOS, no solo dueños. Aquella era `esOwner &&` y los cobradores
//     —que caminan la ruta con la app en la mano— no la vieron nunca.
//   · Cuatro días es poco. Un dueño puede pasar una semana sin abrir el panel.
//   · Los archivos NO van a `public/`. Lo de ahí se sirve sin sesión, y una
//     captura de la cartera lleva nombres, cédulas y deudas de terceros.

/** Hasta el jueves 28 de agosto por la noche.
 *
 *  ⚠ EN UTC Y CON EL CONVENIO DE LA CASA: el día colombiano va de 05:00Z a
 *  05:00Z, así que «el 28 por la noche» es el 29 a las 04:59Z. Escrito como
 *  `2026-08-28T23:59` se cerraría el 28 a las 6 de la tarde hora de Colombia,
 *  que es justo cuando el cobrador cuadra y abre la app.
 *  Ver [[fechas_un_solo_calendario]].
 *
 *  Son 14 días y no los 2 o 3 que se plantearon al principio: la campaña
 *  anterior tuvo 4 y no llegó ni una respuesta. Un dueño no abre el panel todos
 *  los días. Cambiar la duración es cambiar esta línea. */
export const CIERRA_EN = new Date('2026-08-29T04:59:59.000Z')

/** ¿Sigue abierta? */
export function campanaViva(ahora = new Date()) {
  return ahora < CIERRA_EN
}

/** Cuántos días le quedan, para poder decirlo en el banner. */
export function diasQueQuedan(ahora = new Date()) {
  return Math.max(0, Math.ceil((CIERRA_EN - ahora) / 86400000))
}

export const MAX_IMAGENES = 4
export const MAX_BYTES_IMAGEN = 8 * 1024 * 1024
export const MAX_BYTES_AUDIO = 15 * 1024 * 1024
export const MAX_CARACTERES = 4000

export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
export const TIPOS_AUDIO = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']

/** Subcarpeta dentro del almacén. Fuera de `public/`, como las fotos donadas. */
export const CARPETA = 'sugerencias'

/* Las tres preguntas del banner. No son un formulario: son ejemplos para que
   quien no sabe por dónde empezar tenga por dónde. Se responde a una, a las
   tres o a ninguna — el campo es libre. */
export const PREGUNTAS = [
  '¿Qué te gustaría que hiciera y todavía no hace?',
  '¿Qué te cuesta trabajo o te molesta?',
  '¿Qué es lo que más usas?',
]

/**
 * ¿Vale la pena mandar esto? Se exige algo que leer: un envío vacío no dice
 * nada y ensucia el sondeo.
 */
export function tieneContenido({ texto = '', imagenes = 0, audio = false } = {}) {
  return texto.trim().length > 0 || imagenes > 0 || audio
}
