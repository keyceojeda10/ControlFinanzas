// lib/video-bienvenida.js — La clase de 2 minutos (Fino, el profe).
//
// Carlos la aprobó el 14 oct 2026 y la pidió NATIVA, sin YouTube: el video
// vive en `public/videos/` y se sirve desde nuestro dominio.
//
// Por qué existe: la gente entra perdida, se salta el capital, presta, ve «En
// caja» en negativo y se frustra. La activación (cobrar 5 días o más) es el
// cuello de botella del negocio, y el video enseña justo ese tramo.
//
// Lo de aquí es puro (sin React) porque vitest no transforma JSX.

export const VIDEO_BIENVENIDA = {
  src: '/videos/bienvenida-720.mp4',
  poster: '/videos/bienvenida-portada.jpg',
}

/* LAS CINCO LECCIONES, una por pantalla del asistente (14 oct 2026). Carlos:
 * «video completo al iniciar, y en cada paso el pedazo que corresponde, bien
 * cortado: no a la mitad ni cuando esté hablando».
 *
 * Son archivos aparte, no un rango del video completo: parar con `timeupdate`
 * cae hasta un cuarto de segundo tarde y se oye la primera sílaba de la lección
 * siguiente. Se cortan en los silencios con `scripts/video/cortar-lecciones.sh`,
 * que dice dónde y por qué; si se reedita el video, se corre otra vez y se
 * copian aquí las duraciones que imprime. */
export const LECCIONES = [
  { n: 1, titulo: '¿Quién cobra?', segundos: 13 },
  { n: 2, titulo: 'Tu capital', segundos: 26 },
  { n: 3, titulo: 'El plan: $0', segundos: 23 },
  { n: 4, titulo: 'Trae tu cartera', segundos: 29 },
  { n: 5, titulo: 'Cobra todos los días', segundos: 14 },
].map((l) => ({ ...l, src: `/videos/leccion-${l.n}.mp4`, poster: `/videos/leccion-${l.n}.jpg` }))

export const leccion = (n) => LECCIONES.find((l) => l.n === n) ?? null

/** La lección de la pantalla del asistente en que está la persona. El paso 2
 *  son dos pantallas: primero el plan y, ya visto, cómo traer la cartera. */
export function leccionDelPaso({ step, vioPlan }) {
  if (step === 0) return leccion(1)
  if (step === 1) return leccion(2)
  if (step === 2) return leccion(vioPlan ? 4 : 3)
  if (step === 3) return leccion(5)
  return null
}

/** Lo que se apunta en `Evento` (vía `/api/analytics/track`). Se cruza después
 *  con quién registra capital y quién cobra. */
export const EVENTOS_VIDEO = {
  abierto: 'video_bienvenida_abierto',
  sonido: 'video_bienvenida_sonido',
  cerrado: 'video_bienvenida_cerrado',
  hito: (pct) => `video_bienvenida_${pct}`,
}

/** Las lecciones se miden aparte: si contaran como la clase, abrir la lección 2
 *  marcaría «ya vio la clase» y los hitos de 13 s se mezclarían con los de 2 min. */
export const EVENTOS_LECCION = {
  abierto: 'video_leccion_abierto',
  sonido: 'video_leccion_sonido',
  cerrado: 'video_leccion_cerrado',
  hito: (pct) => `video_leccion_${pct}`,
}

export const HITOS = [25, 50, 75, 100]

/** Los hitos que se cruzan por primera vez en este instante. `vistos` es un Set
 *  de los ya apuntados; no se tocan aquí. Al 100 se llega con «ended», porque
 *  `timeupdate` rara vez cae justo en el último segundo. */
export function hitosNuevos(segundo, duracion, vistos, { termino = false } = {}) {
  if (!(duracion > 0)) return []
  const pct = termino ? 100 : (segundo / duracion) * 100
  return HITOS.filter((h) => !vistos.has(h) && pct >= h && (h < 100 || termino))
}

/** ¿Se abre sola? Solo al dueño, solo en el primer paso del asistente y solo si
 *  esa persona nunca la abrió (en ningún teléfono: lo dice el servidor). */
export function debeAbrirseSola({ rol, paso, visto }) {
  return rol === 'owner' && paso === 0 && visto === false
}
