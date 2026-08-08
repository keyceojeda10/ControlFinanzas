// scripts/generar-avatares.mjs — genera los avatares del perfil.
//
// ── POR QUÉ ESTE GUION EXISTE ──────────────────────────────────────────────
//
// Los avatares los dibujaba yo a mano dentro de `lib/avatars.js`. El dueño lo
// zanjó: «quedaron mucho peor… ¿será que no podemos descargar avatars en imagen
// desde algún sitio?». Tenía razón: esto lo hace mejor gente que dibuja para
// vivir.
//
// ⚠ Las DOCE secciones las eligió él, mirando muestras de 21 librerías y
// mandándome capturas de las que le servían. No las elegí yo: mis dos intentos
// de escoger por él fallaron los dos.
//
// ── ⚠ NADA SE PIDE POR INTERNET EN CALIENTE ───────────────────────────────
//
// Todo se genera AQUÍ y queda como archivo en `public/avatars/`. La app se usa
// sin señal: llamar a un servidor ajeno para pintar la cabecera sería un punto
// de fallo nuevo.
//
// ── LICENCIAS ──────────────────────────────────────────────────────────────
//
// Ocho secciones no piden nada (CC0, MIT, Apache 2.0, «libre para uso
// comercial»).
//
// ⚠ CUATRO SON CC BY 4.0 y OBLIGAN a poner los créditos donde se vean:
// adventurerNeutral (Lisa Wischofsky), bigSmile (Ashley Seo), croodles (vijay
// verma) y micah (Micah Lanier). Esa línea vive al pie del selector, en
// `app/(dashboard)/configuracion/page.jsx`, y hay una prueba que falla si
// desaparece. Si algún día estorba, se quita la SECCIÓN, no la línea.
//
// ⚠ Y NO HAY PERSONAJES CON DUEÑO. Se pidieron Goku, Superman, Batman,
// Spider-Man e Iron Man con el argumento de que «aún no somos tan grandes». Son
// de Toei, DC, Marvel y Disney; las reclamaciones no miran el tamaño, y aquí
// hay 429 negocios pagando encima de esta marca.
//
// ── PARA CORRERLO ──────────────────────────────────────────────────────────
//
//   npm install --no-save @dicebear/core@9 @dicebear/collection@9 @iconify/json
//   node scripts/generar-avatares.mjs
//
// Escribe `public/avatars/` y `lib/avatars-lista.js`.

import { createAvatar } from '@dicebear/core'
import * as dicebear from '@dicebear/collection'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const req = createRequire(import.meta.url)
const DESTINO = 'public/avatars'
const POR_SECCION = 12

/* Fondos saturados: la figura tiene que recortar encima. Doce, uno por puesto,
   para que dentro de una sección no se repita ninguno. */
const FONDOS = ['3D4EAD', '2B6CB0', '20808D', '2F855A', 'B7791F', 'C05621',
  'A33B3B', '8B3A5A', '6B46C1', '4A5568', '5A7D2A', '7B3F8C']

/* Nombres de por aquí, no números: DiceBear reparte los rasgos por el hash del
   texto, así sale un conjunto variado sin elegir peinado por peinado. */
const SEMILLAS = ['Carlos', 'Marta', 'Jhoan', 'Ana', 'Diego', 'Lucia',
  'Andres', 'Paula', 'Steven', 'Rosa', 'Julian', 'Camila']

/* ⚠ LOS GESTOS NO SE DEJAN AL AZAR donde el estilo lo permite. El catálogo de
   DiceBear incluye `vomit`, `screamOpen`, `cry`, `xDizzy`: en una tanda anterior
   salieron caras llorando y con los ojos en equis. El avatar acompaña al
   usuario todo el día en la cabecera de una app de trabajo. Lo que sí sigue
   variando libre es lo que distingue a una persona de otra. */
const GESTOS = {
  lorelei: { mouth: ['happy01', 'happy02', 'happy03', 'happy04', 'happy05', 'happy06', 'happy07', 'happy08', 'happy09', 'happy10', 'happy11', 'happy12'] },
  loreleiNeutral: { mouth: ['happy01', 'happy02', 'happy03', 'happy04', 'happy05', 'happy06', 'happy07', 'happy08', 'happy09', 'happy10', 'happy11', 'happy12'] },
}

/* Los iconos se eligen a mano: Bootstrap trae 146 y la mayoría son flechas y
   carpetas; los emoji de Google, miles. Estos son los que dicen algo. */
const TEMAS = {
  geek: ['controller', 'dice5', 'bug', 'keyboard', 'mouse2', 'puzzle',
    'trophy', 'magic', 'lightningCharge', 'disc', 'moonStars', 'display'],
  dinero: ['money-bag', 'dollar-banknote', 'coin', 'credit-card', 'money-with-wings',
    'chart-increasing', 'bank', 'receipt', 'purse', 'gem-stone', 'abacus', 'handshake'],
  premios: ['trophy', 'crown', 'sports-medal', 'rocket', 'joystick', 'video-game',
    'party-popper', 'sparkles', 'direct-hit', 'fire', 'game-die', 'ribbon'],
}

const SECCIONES = [
  // ── Las ocho sin condiciones ──
  { id: 'caras', nombre: 'Caras', fuente: 'dicebear', estilo: 'lorelei' },
  { id: 'rostro', nombre: 'Solo cara', fuente: 'dicebear', estilo: 'loreleiNeutral' },
  { id: 'trazo', nombre: 'Trazo', fuente: 'dicebear', estilo: 'notionists' },
  { id: 'caritas', nombre: 'Caritas', fuente: 'dicebear', estilo: 'thumbs' },
  { id: 'robots', nombre: 'Robots', fuente: 'dicebear', estilo: 'bottts' },
  { id: 'geek', nombre: 'Geek', fuente: 'dicebear', estilo: 'icons', tema: 'geek' },
  { id: 'dinero', nombre: 'Dinero', fuente: 'iconify', pref: 'noto', tema: 'dinero' },
  { id: 'premios', nombre: 'Premios', fuente: 'iconify', pref: 'noto-v1', tema: 'premios' },
  // ── Las cuatro que piden créditos ──
  { id: 'gestos', nombre: 'Gestos', fuente: 'dicebear', estilo: 'adventurerNeutral' },
  { id: 'sonrisas', nombre: 'Sonrisas', fuente: 'dicebear', estilo: 'bigSmile' },
  { id: 'garabatos', nombre: 'Garabatos', fuente: 'dicebear', estilo: 'croodles' },
  { id: 'retratos', nombre: 'Retratos', fuente: 'dicebear', estilo: 'micah' },
]

/* ⚠ El bloque `<metadata>` con el RDF pesa ~1 KB POR ARCHIVO y no lo lee ningún
   navegador. La atribución vive donde un humano la encuentra: en el selector y
   en `public/avatars/LICENCIAS.txt`. */
const limpiar = (svg) => svg
  .replace(/<metadata[\s\S]*?<\/metadata>/g, '')
  .replace(/\s{2,}/g, ' ').replace(/>\s+</g, '><').trim()

/* Iconify entrega el dibujo suelto y su lienzo; aquí se compone el avatar:
   círculo de color y el icono centrado al 60 %.

   ⚠ Los ids se prefijan aunque cada SVG acabe en su propio archivo: si mañana
   alguien los vuelve a incrustar en una página, `url(#…)` resolvería al primero
   del documento y los demás se borrarían. Ya pasó con DiceBear. */
function desdeIconify(pref, nombre, fondo, i) {
  const datos = req(`@iconify/json/json/${pref}.json`)
  const ic = datos.icons[nombre]
  if (!ic) throw new Error(`${pref}: no existe el icono «${nombre}»`)
  const w = ic.width ?? datos.width ?? 24
  const h = ic.height ?? datos.height ?? 24
  const esc = 72 / Math.max(w, h)
  const cuerpo = ic.body
    .replace(/id="([^"]+)"/g, (_, x) => `id="${pref}${i}-${x}"`)
    .replace(/url\(#([^)]+)\)/g, (_, x) => `url(#${pref}${i}-${x})`)
    .replace(/(xlink:href|href)="#([^"]+)"/g, (_, a, x) => `${a}="#${pref}${i}-${x}"`)
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#${fondo}"/><g transform="translate(${(120 - w * esc) / 2},${(120 - h * esc) / 2}) scale(${esc})">${cuerpo}</g></svg>`
}

if (existsSync(DESTINO)) rmSync(DESTINO, { recursive: true })
mkdirSync(DESTINO, { recursive: true })

const lista = []
let bytes = 0

for (const s of SECCIONES) {
  const tema = s.tema ? TEMAS[s.tema] : null
  for (let i = 0; i < POR_SECCION; i++) {
    const fondo = FONDOS[i % FONDOS.length]
    let svg
    if (s.fuente === 'iconify') {
      svg = limpiar(desdeIconify(s.pref, tema[i], fondo, i))
    } else {
      svg = limpiar(createAvatar(dicebear[s.estilo], {
        seed: tema ? tema[i] : SEMILLAS[i % SEMILLAS.length],
        backgroundColor: [fondo], radius: 50,
        ...(tema ? { icon: [tema[i]], scale: 60 } : {}),
        ...(GESTOS[s.estilo] ?? {}),
      }).toString())
    }
    const id = `${s.id}-${i + 1}`
    writeFileSync(join(DESTINO, `${id}.svg`), svg)
    bytes += svg.length
    lista.push({ id, categoria: s.id, nombre: `${s.nombre} ${i + 1}` })
  }
}

writeFileSync(join(DESTINO, 'LICENCIAS.txt'), `Avatares del perfil de Control Finanzas.
Generados en local con: node scripts/generar-avatares.mjs

-- SIN CONDICIONES ------------------------------------------------
lorelei / loreleiNeutral   CC0 1.0          Lisa Wischofsky  (DiceBear)
notionists                 CC0 1.0          Zoish            (DiceBear)
thumbs                     CC0 1.0          DiceBear
bottts                     Libre comercial  Pablo Stanley    (DiceBear)
icons                      MIT              The Bootstrap Authors
Noto Emoji / Noto v1       Apache 2.0       Google

-- PIDEN ATRIBUCION VISIBLE (CC BY 4.0) ---------------------------
adventurerNeutral          CC BY 4.0        Lisa Wischofsky
bigSmile                   CC BY 4.0        Ashley Seo
croodles                   CC BY 4.0        vijay verma
micah                      CC BY 4.0        Micah Lanier

Los creditos salen al pie del selector de avatar
(app/(dashboard)/configuracion/page.jsx). Si se quitan de ahi, hay que quitar
tambien esas cuatro secciones: no es opcional.
`)

const cats = SECCIONES.map((s) => `  { id: '${s.id}', nombre: '${s.nombre}' },`).join('\n')
const avs = lista.map((a) => `  { id: '${a.id}', nombre: '${a.nombre}', categoria: '${a.categoria}' },`).join('\n')

writeFileSync('lib/avatars-lista.js', `// lib/avatars-lista.js — GENERADO. No editar a mano.
//
// Lo escribe \`scripts/generar-avatares.mjs\`. Aquí solo va la LISTA; los dibujos
// son archivos en \`public/avatars/\` y se piden por \`<img src>\`, porque los
// ${lista.length} juntos pesan ${(bytes / 1024).toFixed(0)} KB y nadie tiene que descargarlos para ver la cabecera.

export const AVATAR_CATEGORIES = [
${cats}
]

export const AVATARS = [
${avs}
]
`)

console.log(`${lista.length} avatares · ${SECCIONES.length} secciones · ${(bytes / 1024).toFixed(0)} KB · ${(bytes / lista.length / 1024).toFixed(1)} KB cada uno`)
