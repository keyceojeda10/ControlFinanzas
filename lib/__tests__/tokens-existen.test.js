// lib/__tests__/tokens-existen.test.js — ningún `var(--cf-…)` inventado.
//
// POR QUÉ EXISTE. Escribí `background: 'var(--cf-bg)'` en dos capas a pantalla
// completa de la ruta. Ese token NO EXISTE —el bueno es `--cf-surface`— y CSS
// no se queja: una variable indefinida sin valor de reserva se resuelve a nada.
// Las dos capas se pintaron TRANSPARENTES, con la lista de clientes viéndose
// por detrás del recibo y del modo recorrido.
//
// No lo caza nada más: compila, las pruebas pasan, y en una captura parece un
// fallo de pintado. Solo se ve midiendo el `backgroundColor` calculado.
//
// La regla: todo `--cf-*` que se use tiene que estar declarado en
// `app/tokens-2026.css`. Si hace falta uno nuevo, se declara ahí primero.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const RAIZ = path.resolve(__dirname, '../..')

const DECLARADOS = new Set(
  [...fs.readFileSync(path.join(RAIZ, 'app/tokens-2026.css'), 'utf8')
    .matchAll(/(--cf-[a-z0-9-]+)\s*:/gi)].map((m) => m[1]),
)

function archivos(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) archivos(p, out)
    else if (/\.(jsx?|css)$/.test(e.name)) out.push(p)
  }
  return out
}

describe('los tokens --cf-* que se usan existen', () => {
  it('declara al menos los tokens de base', () => {
    expect(DECLARADOS.has('--cf-surface')).toBe(true)
    expect(DECLARADOS.size).toBeGreaterThan(40)
  })

  it('ningún archivo usa un --cf-* sin declarar', () => {
    const huerfanos = []
    for (const f of [...archivos(path.join(RAIZ, 'app')), ...archivos(path.join(RAIZ, 'components'))]) {
      const src = fs.readFileSync(f, 'utf8')
      for (const m of src.matchAll(/var\(\s*(--cf-[a-z0-9-]+)\s*([,)])/gi)) {
        // Con valor de reserva —`var(--x, #fff)`— el fallo no es silencioso:
        // hay un color detrás. Solo se persiguen los que se quedan en nada.
        if (m[2] === ',') continue
        if (!DECLARADOS.has(m[1])) {
          huerfanos.push(`${path.relative(RAIZ, f)} → ${m[1]}`)
        }
      }
    }
    expect([...new Set(huerfanos)]).toEqual([])
  })
})
