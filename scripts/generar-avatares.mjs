// scripts/generar-avatares.mjs — genera los avatares del perfil.
//
// ── POR QUÉ ESTE GUION EXISTE ──────────────────────────────────────────────
//
// Los avatares los dibujaba yo a mano dentro de `lib/avatars.js`. El dueño lo
// zanjó: «quedaron mucho peor… ¿será que no podemos descargar avatars en imagen
// desde algún sitio?». Tenía razón: esto lo hace mejor gente que dibuja para
// vivir.
//
// Vienen de **DiceBear** y se generan AQUÍ, en local. No se pide nada por
// internet en caliente: la app se usa sin señal, y una petición a un servidor
// ajeno para pintar la cabecera sería un punto de fallo nuevo.
//
// ── LICENCIAS (por eso están estos ocho estilos y no otros) ────────────────
//
//   notionists  CC0 1.0   Zoish            lorelei    CC0 1.0   Lisa Wischofsky
//   openPeeps   CC0 1.0   Pablo Stanley    thumbs     CC0 1.0   DiceBear
//   shapes      CC0 1.0   DiceBear         glass      CC0 1.0   DiceBear
//   avataaars   libre para uso comercial   Pablo Stanley
//   bottts      libre para uso comercial   Pablo Stanley
//
// Quedan fuera los CC BY 4.0 (adventurer, micah, personas, bigSmile…): son
// buenos, pero obligan a poner la atribución visible y eso es un compromiso que
// no se puede olvidar en tres meses. Los de aquí no piden nada.
//
// ⚠ Y quedan fuera POR LA MISMA RAZÓN por la que se fueron Iron Man y Elsa: lo
// que se publica en un producto que cobra tiene que tener el permiso claro.
//
// ── ⚠ POR QUÉ ARCHIVOS SUELTOS Y NO SVG DENTRO DEL JS ─────────────────────
//
// Medido: 96 avatares son **519 KB** de SVG. Metidos en `lib/avatars.js` los
// descarga entero cada usuario en cada visita, tenga o no avatar, y esta app la
// abre gente con mala señal. Como archivos en `public/avatars/`, el navegador
// se baja SOLO el que necesita —uno en la cabecera— y los 96 nada más cuando
// alguien abre el selector.
//
// De paso resuelve algo que no se ve venir: DiceBear emite `id="viewboxMask"`,
// **el mismo en todos**. Inertados varios en la misma página, cada
// `mask="url(#viewboxMask)"` resuelve al PRIMERO del documento y los demás se
// borran. Me pasó al hacer la muestra: cinco estilos salieron en blanco. En un
// `<img>` cada SVG es su propio documento y el choque desaparece.
//
//   node scripts/generar-avatares.mjs
//
// Escribe en `public/avatars/` y reescribe la lista de `lib/avatars-lista.js`.

import { createAvatar } from '@dicebear/core'
import * as estilos from '@dicebear/collection'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DESTINO = 'public/avatars'
const POR_ESTILO = 12

/* Los fondos salen de la misma paleta que usaba el juego anterior: saturados y
   oscuros, para que la figura recorte encima. DiceBear los pinta él mismo, así
   que no hay que componer nada — solo pasarle la lista. */
const FONDOS = ['3D4EAD', '2B6CB0', '20808D', '2F855A', 'B7791F', 'C05621',
  'A33B3B', '8B3A5A', '6B46C1', '4A5568', '5A7D2A', '7B3F8C']

/* Las semillas deciden qué cara sale. Son nombres a propósito y no números:
   DiceBear reparte rasgos por el hash, y con nombres de por aquí sale un
   conjunto variado sin tener que elegir a mano peinado por peinado. */
const SEMILLAS = ['Carlos', 'Marta', 'Jhoan', 'Ana', 'Diego', 'Lucia',
  'Andres', 'Paula', 'Steven', 'Rosa', 'Julian', 'Camila']

const GRUPOS = [
  { id: 'avataaars', estilo: 'avataaars', nombre: 'Caras' },
  { id: 'peeps', estilo: 'openPeeps', nombre: 'Retratos' },
  { id: 'notion', estilo: 'notionists', nombre: 'Trazo' },
  { id: 'lorelei', estilo: 'lorelei', nombre: 'Ilustradas' },
  { id: 'bottts', estilo: 'bottts', nombre: 'Robots' },
  { id: 'thumbs', estilo: 'thumbs', nombre: 'Caritas' },
  { id: 'shapes', estilo: 'shapes', nombre: 'Formas' },
  { id: 'glass', estilo: 'glass', nombre: 'Degradados' },
]

/* ⚠ El bloque `<metadata>` con el RDF de la licencia pesa ~1 KB POR ARCHIVO y
   no lo lee ningún navegador. Se quita del SVG y la atribución se guarda en
   `public/avatars/LICENCIAS.txt`, que es donde un humano la puede encontrar.
   Con CC0 no hace falta ni eso; se deja por decencia. */
const limpiar = (svg) => svg
  .replace(/<metadata[\s\S]*?<\/metadata>/g, '')
  .replace(/\s{2,}/g, ' ')
  .replace(/>\s+</g, '><')
  .trim()

if (existsSync(DESTINO)) rmSync(DESTINO, { recursive: true })
mkdirSync(DESTINO, { recursive: true })

const lista = []
let bytes = 0

for (const g of GRUPOS) {
  for (let i = 0; i < POR_ESTILO; i++) {
    const svg = limpiar(createAvatar(estilos[g.estilo], {
      seed: SEMILLAS[i % SEMILLAS.length],
      backgroundColor: [FONDOS[i % FONDOS.length]],
      radius: 50,
    }).toString())
    const archivo = `${g.id}-${i + 1}.svg`
    writeFileSync(join(DESTINO, archivo), svg)
    bytes += svg.length
    lista.push({ id: `${g.id}-${i + 1}`, categoria: g.id, nombre: `${g.nombre} ${i + 1}` })
  }
}

writeFileSync(join(DESTINO, 'LICENCIAS.txt'), `Avatares generados con DiceBear (https://dicebear.com) — MIT.

notionists  CC0 1.0                            Zoish
lorelei     CC0 1.0                            Lisa Wischofsky
openPeeps   CC0 1.0                            Pablo Stanley
thumbs      CC0 1.0                            DiceBear
shapes      CC0 1.0                            DiceBear
glass       CC0 1.0                            DiceBear
avataaars   Libre para uso personal y comercial  Pablo Stanley
bottts      Libre para uso personal y comercial  Pablo Stanley

Se regeneran con: node scripts/generar-avatares.mjs
`)

const cats = GRUPOS.map((g) => `  { id: '${g.id}', nombre: '${g.nombre}' },`).join('\n')
const avs = lista.map((a) => `  { id: '${a.id}', nombre: '${a.nombre}', categoria: '${a.categoria}' },`).join('\n')

writeFileSync('lib/avatars-lista.js', `// lib/avatars-lista.js — GENERADO. No editar a mano.
//
// Lo escribe \`scripts/generar-avatares.mjs\`. Aquí solo va la LISTA; los dibujos
// son archivos en \`public/avatars/\` y se piden por \`<img src>\`, porque los 96
// juntos pesan ${(bytes / 1024).toFixed(0)} KB y nadie tiene que descargarlos para ver la cabecera.

export const AVATAR_CATEGORIES = [
${cats}
]

export const AVATARS = [
${avs}
]
`)

console.log(`${lista.length} avatares · ${(bytes / 1024).toFixed(0)} KB en total · ${(bytes / lista.length / 1024).toFixed(1)} KB cada uno`)
console.log(`→ ${DESTINO}/ y lib/avatars-lista.js`)
