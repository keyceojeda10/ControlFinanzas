// lib/avatars.js — Los avatares del perfil.
//
// ══ DE DÓNDE SALEN AHORA ═══════════════════════════════════════════════════
//
// De **DiceBear**, generados en local por `scripts/generar-avatares.mjs`.
// Antes los dibujaba yo a mano aquí dentro, y el dueño lo zanjó: «quedaron
// mucho peor… ¿será que no podemos descargar avatars en imagen desde algún
// sitio?». Tenía razón: esto lo hace mejor gente que dibuja para vivir.
//
// Ocho estilos, doce cada uno, todos con licencia libre — CC0 o libre para uso
// comercial. Ver `public/avatars/LICENCIAS.txt`. Los CC BY 4.0 quedaron fuera a
// propósito: obligan a poner la atribución visible, y ese es un compromiso que
// se olvida en tres meses.
//
// ⚠ NO SE PIDE NADA POR INTERNET EN CALIENTE. La app se usa sin señal; llamar a
// un servidor ajeno para pintar la cabecera sería un punto de fallo nuevo. Los
// SVG viven en `public/avatars/` y se sirven desde el mismo dominio.
//
// ⚠ Y NO SE INCRUSTAN EN EL JS. Los 96 pesan 550 KB. Metidos aquí, se los
// descarga entero cada usuario en cada visita, tenga avatar o no, con la señal
// que tenga. Como archivos, el navegador se baja SOLO el que necesita: uno en
// la cabecera, y los 96 nada más cuando alguien abre el selector.
//
// Este archivo es la capa fina: la lista generada, el mapa de ids viejos y la
// función que resuelve uno. Los dibujos no están aquí.

import { AVATARS as LISTA, AVATAR_CATEGORIES as CATS } from './avatars-lista'

export const AVATAR_CATEGORIES = CATS
export const AVATARS = LISTA.map((a) => ({ ...a, src: `/avatars/${a.id}.svg` }))

/* ══ ⚠ NADIE PIERDE EL AVATAR QUE YA ELIGIÓ ═══════════════════════════════
 *
 * Medido en producción: 27 usuarios tienen avatar elegido y **23 ya lo tenían
 * roto** antes de que yo tocara nada — sus ids (`lightning`, `crown`, `bars`,
 * `eagle`, `gem`, `bull`…) son de un juego de hace dos cambios. `getAvatarById`
 * devolvía null y les salían las iniciales, sin avisar a nadie.
 *
 * Esta tabla traduce **los tres juegos anteriores**. No se borra cuando parezca
 * que ya no hace falta: mientras alguien tenga uno guardado en la base, hace
 * falta. Antes de volver a cambiar el juego, mirar qué hay en `User.avatarId`.
 */
const HEREDADOS = {
  // ── Juego 1: símbolos ──
  lightning: 'geek-9', bars: 'geek-12', chart: 'geek-12', crown: 'geek-7',
  coin: 'geek-10', diamond: 'geek-6', gem: 'geek-6', pyramid: 'geek-11',
  star: 'geek-11', eagle: 'robots-8', eye: 'geek-12', bull: 'robots-1',

  // ── Juego 2: personajes con dueño y caritas ──
  ironman: 'robots-1', capitan: 'robots-2', spiderman: 'robots-3', wolverine: 'robots-4',
  pantera: 'robots-5', thor: 'robots-6', hulk: 'robots-7', deadpool: 'robots-8',
  thanos: 'robots-9', venom: 'robots-10', mike: 'robots-11', stitch: 'robots-12',
  osito: 'robots-1', grogu: 'sonrisas-1', baymax: 'robots-2', olaf: 'robots-2',
  jack: 'robots-3', elsa: 'caras-1',
  feliz: 'caras-1', cool: 'retratos-1', amor: 'caras-2', risa: 'caras-3',
  guino: 'caras-4', dormido: 'geek-11',
  paleta: 'robots-4', hotdog: 'robots-5', helado: 'robots-6', galleta: 'robots-7',
  pizza: 'retratos-6', palomitas: 'robots-8', dona: 'robots-9', hamburguesa: 'robots-10',
  taco: 'robots-11', sushi: 'robots-12',
  gato: 'robots-1', panda: 'robots-2', zorro: 'robots-3', leon: 'robots-4',
  conejo: 'robots-5', koala: 'robots-6', pinguino: 'robots-7', dinosaurio: 'robots-9',
  sol: 'geek-11', hongo: 'sonrisas-2', flor: 'sonrisas-3', nube: 'geek-11',
  cactus: 'sonrisas-4', aguacate: 'sonrisas-5',
  unicornio: 'sonrisas-6', mono: 'robots-10', alien: 'robots-11', ninja: 'retratos-1',
  astronauta: 'robots-12', pirata: 'sonrisas-7', fantasma: 'geek-3', estrella: 'geek-11',

  // ── Juego 3: los que dibujé yo, vivos unas horas ──
  'p-corto-negro': 'caras-1', 'p-largo-castano': 'caras-2', 'p-rizado': 'caras-3',
  'p-mono': 'caras-4', 'p-trenzas': 'caras-5', 'p-gafas': 'retratos-1',
  'p-barba': 'caras-6', 'p-canas': 'caras-7', 'p-panuelo': 'caras-8',
  'p-gorra': 'caras-9', 'p-sombrero': 'caras-10', 'p-rubio': 'caras-11',
  'p-rojizo': 'caras-12', 'p-calvo': 'retratos-2',
  'o-cobrador': 'retratos-3', 'o-tendero': 'retratos-4', 'o-campo': 'retratos-5',
  'o-taller': 'retratos-6', 'o-costura': 'retratos-7', 'o-obra': 'retratos-8',
  'o-barberia': 'retratos-9', 'o-panaderia': 'retratos-10',
  'a-gato': 'robots-1', 'a-perro': 'robots-2', 'a-oso': 'robots-3', 'a-zorro': 'robots-4',
  'a-conejo': 'robots-5', 'a-panda': 'robots-6', 'a-leon': 'robots-7', 'a-buho': 'robots-8',
  'a-pinguino': 'robots-9', 'a-rana': 'robots-10',
  'd-billete': 'geek-12', 'd-moneda': 'geek-10', 'd-alcancia': 'geek-6',
  'd-caja': 'geek-4', 'd-grafica': 'geek-12', 'd-maletin': 'geek-5',
  'd-recibo': 'geek-4', 'd-cuaderno': 'geek-4',
  'n-sol': 'geek-11', 'n-luna': 'geek-11', 'n-arbol': 'sonrisas-8',
  'n-montana': 'sonrisas-9', 'n-flor': 'sonrisas-3', 'n-cactus': 'sonrisas-4',
  'c-cafe': 'robots-1', 'c-pan': 'robots-2', 'c-fruta': 'robots-3',
  'c-helado': 'robots-6', 'c-arepa': 'robots-7', 'c-pizza': 'retratos-6',
  'f-anillos': 'geek-10', 'f-diagonal': 'geek-6', 'f-cuartos': 'geek-6',
  'f-ondas': 'geek-10', 'f-rombo': 'geek-6', 'f-rayas': 'geek-9',
  'f-sol-abstracto': 'geek-9', 'f-cuadros': 'geek-6',

  // ── Las tres secciones que el dueño quitó («me sobran») ──
  //    Se van del selector, pero quien las tuviera elegidas no se queda sin nada.
  'caritas-1': 'caras-1',
  'caritas-2': 'caras-2',
  'caritas-3': 'caras-3',
  'caritas-4': 'caras-4',
  'caritas-5': 'caras-5',
  'caritas-6': 'caras-6',
  'caritas-7': 'caras-7',
  'caritas-8': 'caras-8',
  'caritas-9': 'caras-9',
  'caritas-10': 'caras-10',
  'caritas-11': 'caras-11',
  'caritas-12': 'caras-12',
  'geek-1': 'geek-1',
  'geek-2': 'geek-2',
  'geek-3': 'geek-3',
  'geek-4': 'geek-4',
  'geek-5': 'geek-5',
  'geek-6': 'geek-6',
  'geek-7': 'geek-7',
  'geek-8': 'geek-8',
  'geek-9': 'geek-9',
  'geek-10': 'geek-10',
  'geek-11': 'geek-11',
  'geek-12': 'geek-12',
  'premios-1': 'robots-1',
  'premios-2': 'robots-2',
  'premios-3': 'robots-3',
  'premios-4': 'robots-4',
  'premios-5': 'robots-5',
  'premios-6': 'robots-6',
  'premios-7': 'robots-7',
  'premios-8': 'robots-8',
  'premios-9': 'robots-9',
  'premios-10': 'robots-10',
  'premios-11': 'robots-11',
  'premios-12': 'robots-12',

  /* Las secciones de las tandas anteriores. Se fueron del selector; quien
     tuviera una elegida no se queda con las iniciales. */
  'avataaars-1': 'caras-1',
  'avataaars-10': 'caras-10',
  'avataaars-11': 'caras-11',
  'avataaars-12': 'caras-12',
  'avataaars-2': 'caras-2',
  'avataaars-3': 'caras-3',
  'avataaars-4': 'caras-4',
  'avataaars-5': 'caras-5',
  'avataaars-6': 'caras-6',
  'avataaars-7': 'caras-7',
  'avataaars-8': 'caras-8',
  'avataaars-9': 'caras-9',
  'aventura-1': 'sonrisas-1',
  'aventura-10': 'sonrisas-10',
  'aventura-11': 'sonrisas-11',
  'aventura-12': 'sonrisas-12',
  'aventura-2': 'sonrisas-2',
  'aventura-3': 'sonrisas-3',
  'aventura-4': 'sonrisas-4',
  'aventura-5': 'sonrisas-5',
  'aventura-6': 'sonrisas-6',
  'aventura-7': 'sonrisas-7',
  'aventura-8': 'sonrisas-8',
  'aventura-9': 'sonrisas-9',
  'bottts-1': 'robots-1',
  'bottts-10': 'robots-10',
  'bottts-11': 'robots-11',
  'bottts-12': 'robots-12',
  'bottts-2': 'robots-2',
  'bottts-3': 'robots-3',
  'bottts-4': 'robots-4',
  'bottts-5': 'robots-5',
  'bottts-6': 'robots-6',
  'bottts-7': 'robots-7',
  'bottts-8': 'robots-8',
  'bottts-9': 'robots-9',
  'frikis-1': 'retratos-1',
  'frikis-10': 'retratos-10',
  'frikis-11': 'retratos-11',
  'frikis-12': 'retratos-12',
  'frikis-2': 'retratos-2',
  'frikis-3': 'retratos-3',
  'frikis-4': 'retratos-4',
  'frikis-5': 'retratos-5',
  'frikis-6': 'retratos-6',
  'frikis-7': 'retratos-7',
  'frikis-8': 'retratos-8',
  'frikis-9': 'retratos-9',
  'glass-1': 'premios-1',
  'glass-10': 'premios-10',
  'glass-11': 'premios-11',
  'glass-12': 'premios-12',
  'glass-2': 'premios-2',
  'glass-3': 'premios-3',
  'glass-4': 'premios-4',
  'glass-5': 'premios-5',
  'glass-6': 'premios-6',
  'glass-7': 'premios-7',
  'glass-8': 'premios-8',
  'glass-9': 'premios-9',
  'lorelei-1': 'caras-1',
  'lorelei-10': 'caras-10',
  'lorelei-11': 'caras-11',
  'lorelei-12': 'caras-12',
  'lorelei-2': 'caras-2',
  'lorelei-3': 'caras-3',
  'lorelei-4': 'caras-4',
  'lorelei-5': 'caras-5',
  'lorelei-6': 'caras-6',
  'lorelei-7': 'caras-7',
  'lorelei-8': 'caras-8',
  'lorelei-9': 'caras-9',
  'notion-1': 'trazo-1',
  'notion-10': 'trazo-10',
  'notion-11': 'trazo-11',
  'notion-12': 'trazo-12',
  'notion-2': 'trazo-2',
  'notion-3': 'trazo-3',
  'notion-4': 'trazo-4',
  'notion-5': 'trazo-5',
  'notion-6': 'trazo-6',
  'notion-7': 'trazo-7',
  'notion-8': 'trazo-8',
  'notion-9': 'trazo-9',
  'peeps-1': 'retratos-1',
  'peeps-10': 'retratos-10',
  'peeps-11': 'retratos-11',
  'peeps-12': 'retratos-12',
  'peeps-2': 'retratos-2',
  'peeps-3': 'retratos-3',
  'peeps-4': 'retratos-4',
  'peeps-5': 'retratos-5',
  'peeps-6': 'retratos-6',
  'peeps-7': 'retratos-7',
  'peeps-8': 'retratos-8',
  'peeps-9': 'retratos-9',
  'pixel-1': 'robots-1',
  'pixel-10': 'robots-10',
  'pixel-11': 'robots-11',
  'pixel-12': 'robots-12',
  'pixel-2': 'robots-2',
  'pixel-3': 'robots-3',
  'pixel-4': 'robots-4',
  'pixel-5': 'robots-5',
  'pixel-6': 'robots-6',
  'pixel-7': 'robots-7',
  'pixel-8': 'robots-8',
  'pixel-9': 'robots-9',
  'shapes-1': 'geek-1',
  'shapes-10': 'geek-10',
  'shapes-11': 'geek-11',
  'shapes-12': 'geek-12',
  'shapes-2': 'geek-2',
  'shapes-3': 'geek-3',
  'shapes-4': 'geek-4',
  'shapes-5': 'geek-5',
  'shapes-6': 'geek-6',
  'shapes-7': 'geek-7',
  'shapes-8': 'geek-8',
  'shapes-9': 'geek-9',
  'thumbs-1': 'caritas-1',
  'thumbs-10': 'caritas-10',
  'thumbs-11': 'caritas-11',
  'thumbs-12': 'caritas-12',
  'thumbs-2': 'caritas-2',
  'thumbs-3': 'caritas-3',
  'thumbs-4': 'caritas-4',
  'thumbs-5': 'caritas-5',
  'thumbs-6': 'caritas-6',
  'thumbs-7': 'caritas-7',
  'thumbs-8': 'caritas-8',
  'thumbs-9': 'caritas-9',
}

export function getAvatarById(id) {
  if (!id) return null
  const directo = AVATARS.find((a) => a.id === id)
  if (directo) return directo
  const heredado = HEREDADOS[id]
  return heredado ? AVATARS.find((a) => a.id === heredado) ?? null : null
}

/** Los ids que ya no existen pero se siguen resolviendo. Lo usa la prueba. */
export const IDS_HEREDADOS = HEREDADOS
