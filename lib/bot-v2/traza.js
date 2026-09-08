// lib/bot-v2/traza.js — La traza por mensaje (BOT v3 · sprint 1 · 8 sep 2026).
// Módulo PURO (sin prisma ni red) para poder probarlo.
//
// Hasta hoy solo se guardaba el mensaje final. Las tres auditorías externas
// pidieron lo mismo: sin la etapa, el prompt y la respuesta cruda no se puede
// saber si falló el código que decide o el modelo que redacta. Cada
// `responder()` y cada `generarSeguimiento()` devuelven `traza` con las
// columnas exactas de `BotConversacion`, y quien crea el mensaje la esparce.

import { createHash } from 'node:crypto'

/* La etapa más un hash del prompt SIN su parte variable: el historial, el
   nombre del lead y el mensaje entrante cambian en cada turno; lo que queda es
   la plantilla, y su hash solo cambia cuando alguien la edita. Así, meses
   después, se sabe con qué versión del prompt salió cada mensaje. */
export function promptIdDe(nombre, prompt, ...variables) {
  let base = String(prompt || '')
  for (const v of variables) if (v) base = base.split(String(v)).join('')
  return `${nombre}@${createHash('sha1').update(base).digest('hex').slice(0, 8)}`
}

/** La traza de una respuesta que no pasó por el modelo. */
export const FIJO = (clasificacion, extra = {}) => ({
  etapa: null, clasificacion, proveedor: 'fijo', promptId: null, ...extra,
})
