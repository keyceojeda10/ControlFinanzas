import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Inducción del 18 nov 2026, error 7: en Renovar el «Total del nuevo préstamo»
// salía diminuto y sin puntos («2000000»). La regla del móvil de globals.css
// pone TODO campo a 16 px con `!important` (para que el iPhone no haga zoom), y
// solo se salva el que lleva `cf-campo-grande`. Había 23 campos diseñados a
// 17–40 px —el capital del asistente, la caja, la gestión, Renovar— encogidos.

function jsx(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) { if (n !== 'node_modules' && !n.startsWith('.')) jsx(p, out) }
    else if (p.endsWith('.jsx')) out.push(p)
  }
  return out
}

describe('los campos grandes no se encogen en el móvil', () => {
  it('la regla de 16 px sigue con su salida', () => {
    const css = readFileSync('app/globals.css', 'utf8')
    expect(css).toMatch(/input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="range"\]\):not\(\.cf-campo-grande\)/)
  })

  it('todo campo de más de 16 px lleva cf-campo-grande', () => {
    const malos = []
    for (const f of [...jsx('app'), ...jsx('components')]) {
      const s = readFileSync(f, 'utf8')
      for (const m of s.matchAll(/<(input|textarea)\b/g)) {
        // Un `<input>` citado en un comentario no es un campo.
        const renglon = s.slice(s.lastIndexOf('\n', m.index) + 1, m.index)
        if (/^\s*(\/\/|\*|\/\*)/.test(renglon) || renglon.includes('`')) continue
        const cierre = s.indexOf('/>', m.index)
        const tag = s.slice(m.index, cierre > 0 ? cierre : m.index + 1500)
        const tam = [...tag.matchAll(/\bfontSize:\s*(\d+)/g)].map((x) => Number(x[1]))
        if (tam.length && Math.max(...tam) > 16 && !tag.includes('cf-campo-grande')) {
          malos.push(`${f}:${s.slice(0, m.index).split('\n').length}`)
        }
      }
    }
    expect(malos).toEqual([])
  })

  it('el total de Renovar se ve con sus puntos', () => {
    const r = readFileSync('components/pantallas/Renovar.jsx', 'utf8')
    expect(r).toMatch(/value=\{conPuntos\(total\)\}/)
  })
})
