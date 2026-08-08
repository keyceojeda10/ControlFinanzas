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
  lightning: 'shapes-3', bars: 'shapes-7', chart: 'shapes-7', crown: 'glass-5',
  coin: 'glass-5', diamond: 'shapes-11', gem: 'shapes-11', pyramid: 'shapes-1',
  star: 'shapes-3', eagle: 'bottts-8', eye: 'glass-2', bull: 'bottts-1',

  // ── Juego 2: personajes con dueño y caritas ──
  ironman: 'bottts-1', capitan: 'bottts-2', spiderman: 'bottts-3', wolverine: 'bottts-4',
  pantera: 'bottts-5', thor: 'bottts-6', hulk: 'bottts-7', deadpool: 'bottts-8',
  thanos: 'bottts-9', venom: 'bottts-10', mike: 'bottts-11', stitch: 'bottts-12',
  osito: 'thumbs-1', grogu: 'thumbs-2', baymax: 'thumbs-3', olaf: 'thumbs-4',
  jack: 'thumbs-5', elsa: 'lorelei-1',
  feliz: 'thumbs-6', cool: 'thumbs-7', amor: 'thumbs-8', risa: 'thumbs-9',
  guino: 'thumbs-10', dormido: 'thumbs-11',
  paleta: 'glass-1', hotdog: 'glass-2', helado: 'glass-3', galleta: 'glass-4',
  pizza: 'glass-6', palomitas: 'glass-7', dona: 'glass-8', hamburguesa: 'glass-9',
  taco: 'glass-10', sushi: 'glass-11',
  gato: 'bottts-1', panda: 'bottts-2', zorro: 'bottts-3', leon: 'bottts-4',
  conejo: 'bottts-5', koala: 'bottts-6', pinguino: 'bottts-7', dinosaurio: 'bottts-9',
  sol: 'shapes-1', hongo: 'shapes-2', flor: 'shapes-4', nube: 'shapes-5',
  cactus: 'shapes-6', aguacate: 'shapes-8',
  unicornio: 'shapes-9', mono: 'bottts-10', alien: 'bottts-11', ninja: 'peeps-1',
  astronauta: 'bottts-12', pirata: 'peeps-2', fantasma: 'thumbs-12', estrella: 'shapes-10',

  // ── Juego 3: los que dibujé yo, vivos unas horas ──
  'p-corto-negro': 'avataaars-1', 'p-largo-castano': 'avataaars-2', 'p-rizado': 'avataaars-3',
  'p-mono': 'avataaars-4', 'p-trenzas': 'avataaars-5', 'p-gafas': 'avataaars-6',
  'p-barba': 'avataaars-7', 'p-canas': 'avataaars-8', 'p-panuelo': 'avataaars-9',
  'p-gorra': 'avataaars-10', 'p-sombrero': 'avataaars-11', 'p-rubio': 'avataaars-12',
  'p-rojizo': 'peeps-1', 'p-calvo': 'peeps-2',
  'o-cobrador': 'peeps-3', 'o-tendero': 'peeps-4', 'o-campo': 'peeps-5',
  'o-taller': 'peeps-6', 'o-costura': 'peeps-7', 'o-obra': 'peeps-8',
  'o-barberia': 'peeps-9', 'o-panaderia': 'peeps-10',
  'a-gato': 'bottts-1', 'a-perro': 'bottts-2', 'a-oso': 'bottts-3', 'a-zorro': 'bottts-4',
  'a-conejo': 'bottts-5', 'a-panda': 'bottts-6', 'a-leon': 'bottts-7', 'a-buho': 'bottts-8',
  'a-pinguino': 'bottts-9', 'a-rana': 'bottts-10',
  'd-billete': 'shapes-1', 'd-moneda': 'glass-5', 'd-alcancia': 'shapes-2',
  'd-caja': 'shapes-3', 'd-grafica': 'shapes-4', 'd-maletin': 'shapes-5',
  'd-recibo': 'shapes-6', 'd-cuaderno': 'shapes-7',
  'n-sol': 'shapes-8', 'n-luna': 'glass-1', 'n-arbol': 'shapes-9',
  'n-montana': 'shapes-10', 'n-flor': 'shapes-11', 'n-cactus': 'shapes-12',
  'c-cafe': 'glass-2', 'c-pan': 'glass-3', 'c-fruta': 'glass-4',
  'c-helado': 'glass-6', 'c-arepa': 'glass-7', 'c-pizza': 'glass-8',
  'f-anillos': 'glass-9', 'f-diagonal': 'shapes-1', 'f-cuartos': 'shapes-2',
  'f-ondas': 'glass-10', 'f-rombo': 'shapes-11', 'f-rayas': 'shapes-3',
  'f-sol-abstracto': 'glass-11', 'f-cuadros': 'shapes-4',
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
