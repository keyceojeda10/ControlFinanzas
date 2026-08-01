// lib/__tests__/display-en-linea.test.js — el `display` no puede estar en dos
// sitios a la vez.
//
// POR QUÉ EXISTE. Lo hice TRES VECES en la misma tanda, y las tres tardé en
// verlo porque no da error:
//
//   <div className="lg:grid" style={{ display: 'flex' }}>      → nunca es grid
//   <span className="lg:hidden" style={{ display: 'block' }}>  → nunca se oculta
//
// Un estilo en línea tiene más peso que cualquier clase, así que la utilidad
// responsive no llega a aplicarse. La pantalla se pinta —sin aviso, sin error y
// con las pruebas en verde— pero con la disposición del móvil a 1440: cuatro
// columnas apelotonadas a la izquierda, o cinco celdas en una rejilla de cuatro.
//
// La regla: si una clase decide el `display`, el `display` NO va en el `style`.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const RAIZ = path.resolve(__dirname, '../..')

function archivos(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) archivos(p, out)
    else if (/\.jsx$/.test(e.name)) out.push(p)
  }
  return out
}

// Las utilidades de Tailwind que cambian el `display` con un punto de ruptura.
// OJO CON EL LÍMITE: un `\b` después de `flex` casa también dentro de
// `lg:flex-col`, que cambia la DIRECCIÓN y no el `display` — y ahí un
// `display:'flex'` en línea es correcto. La clase tiene que terminar ahí.
const CLASE_DISPLAY = /(?:^|[\s"'`])(?:sm|md|lg|xl|2xl):(?:hidden|block|flex|grid|inline|inline-flex|inline-block|contents|table)(?![\w-])/

describe('el display responsive no se pisa con un estilo en línea', () => {
  it('ninguna etiqueta declara `display` en style y a la vez lo cambia por clase', () => {
    const malos = []
    for (const f of [...archivos(path.join(RAIZ, 'app')), ...archivos(path.join(RAIZ, 'components'))]) {
      const src = fs.readFileSync(f, 'utf8')
      // Cada etiqueta de apertura, desde `<` hasta el `>` que la cierra. Basta
      // con mirar dentro de la etiqueta: className y style son hermanos.
      for (const m of src.matchAll(/<[A-Za-z][^>]*?>/gs)) {
        const etiqueta = m[0]
        if (!CLASE_DISPLAY.test(etiqueta)) continue
        // `display:` dentro de un `style={{ … }}`, no en una cadena cualquiera.
        const style = etiqueta.match(/style=\{\{([\s\S]*?)\}\}/)
        if (!style) continue
        if (/\bdisplay\s*:/.test(style[1])) {
          const linea = src.slice(0, m.index).split('\n').length
          malos.push(`${path.relative(RAIZ, f)}:${linea}`)
        }
      }
    }
    expect(malos).toEqual([])
  })
})
