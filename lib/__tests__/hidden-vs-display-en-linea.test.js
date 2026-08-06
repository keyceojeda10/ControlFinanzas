import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { resolve, join } from 'path'

// ── `hidden sm:grid` NO OCULTA NADA SI EL `display` VA EN LÍNEA ─────────────
//
// La cabecera de «qué rinde cada ruta» llevaba `className="hidden sm:grid"` y
// aun así se pintaba en el móvil, saliéndose 26px de la pantalla («Rinde», de
// x=301 a 419 en un viewport de 393). La causa: el objeto de estilos compartido
// traía `display: 'grid'`, y el estilo en línea le gana SIEMPRE a la clase. El
// `hidden` no hacía absolutamente nada.
//
// ⚠ En el JSX se ve correcto —la clase está ahí— y ninguna prueba de texto lo
// ve. Solo aparece midiendo el `display` computado en el navegador. Mi primera
// lectura fue que el falso positivo era del medidor; no lo era.
//
// Las filas de esa misma tabla ya lo hacían bien: se caen a dos columnas y usan
// `sm:!grid-cols-[…]` con `!` para recuperar las cinco en escritorio.

function jsxDe(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) jsxDe(p, acc)
    else if (e.endsWith('.jsx')) acc.push(p)
  }
  return acc
}

const RAIZ = process.cwd()

describe('la cabecera de rutas ya no se pinta en móvil', () => {
  const src = readFileSync(resolve(RAIZ, 'app/(dashboard)/dashboard/analiticas/page.jsx'), 'utf8')

  it('el objeto compartido no impone `display`', () => {
    const base = src.slice(src.indexOf('const base = {'), src.indexOf('if (cabecera)'))
    expect(base, 'volvió el display en línea: `hidden` deja de funcionar')
      .not.toMatch(/display: '/)
  })

  it('y cada uso declara el suyo por clase, que sí respeta el breakpoint', () => {
    expect(src).toMatch(/className="hidden sm:grid"/)
    expect(src).toMatch(/className="grid sm:!grid-cols-/)
  })
})

describe('nadie más pisa un `hidden` con estilo en línea', () => {
  it('barrido de app/ y components/', () => {
    /* Se mira el elemento entero, del `<` a su `>`: si en el mismo tiene una
       clase que lo oculta por breakpoint Y un `display` en línea, la clase no
       manda y el elemento se ve donde no debería. */
    const malos = []
    for (const p of [...jsxDe(resolve(RAIZ, 'app')), ...jsxDe(resolve(RAIZ, 'components'))]) {
      const src = readFileSync(p, 'utf8')
      for (const m of src.matchAll(/<[a-zA-Z][^>]{0,900}?>/gs)) {
        const el = m[0]
        if (!/className="[^"]*\bhidden\b/.test(el)) continue
        if (!/display: ['"]/.test(el)) continue
        const linea = src.slice(0, m.index).split('\n').length
        malos.push(`${p.slice(RAIZ.length + 1)}:${linea}`)
      }
    }
    expect(malos, `«hidden» pisado por un display en línea:\n  ${malos.join('\n  ')}`)
      .toEqual([])
  })
})
