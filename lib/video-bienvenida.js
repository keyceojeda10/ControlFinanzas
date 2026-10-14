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
  /* ⚠ EL SEGUNDO DONDE EMPIEZA LA LECCIÓN DEL CAPITAL. Lo usan los dos avisos
     de caja en negativo («Ver cómo se arregla»). Si se reedita el video, se
     cambia AQUÍ y solo aquí. */
  segundoCapital: 24,
}

/** Lo que se apunta en `Evento` (vía `/api/analytics/track`). Se cruza después
 *  con quién registra capital y quién cobra. */
export const EVENTOS_VIDEO = {
  abierto: 'video_bienvenida_abierto',
  sonido: 'video_bienvenida_sonido',
  cerrado: 'video_bienvenida_cerrado',
  hito: (pct) => `video_bienvenida_${pct}`,
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
