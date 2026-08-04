import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p) => readFileSync(join(process.cwd(), ...p), 'utf8')
const sinComentarios = (s) => s
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')

const prestamo = sinComentarios(leer('app', '(dashboard)', 'prestamos', 'nuevo', 'page.jsx'))
const cliente  = sinComentarios(leer('components', 'clientes', 'ClienteForm.jsx'))

describe('las sombras de los wizards salen del canon', () => {
  it('ninguna barra lleva una sombra de negro puro', () => {
    // `rgba(0,0,0,.25)` es la sombra dura del estilo anterior: se ve como un
    // borde sucio contra el fondo claro. El canon usa el tinte del sistema
    // (20,20,28) y radios mucho más difusos.
    for (const [nombre, src] of [['préstamo', prestamo], ['cliente', cliente]]) {
      const duras = src.match(/boxShadow:\s*'0 -\d+px \d+px rgba\(0,\s*0,\s*0[^']*'/g) || []
      expect(duras, `${nombre}: ${duras.join(' · ')}`).toHaveLength(0)
    }
  })

  it('la barra de acciones usa el token de hoja', () => {
    // `--cf-sh-sheet` existe justo para esto: una hoja anclada abajo.
    for (const src of [prestamo, cliente]) {
      const barra = src.match(/className="fixed left-0 right-0[^"]*bottom-0[^"]*"[\s\S]{0,320}/)[0]
      expect(barra).toContain('var(--cf-sh-sheet)')
    }
  })

  it('el token de hoja existe de verdad', () => {
    // Un token inventado no falla: el `var()` cae al respaldo y la sombra
    // desaparece sin que nada avise.
    expect(leer('app', 'tokens-2026.css')).toMatch(/--cf-sh-sheet:\s*[^;]+;/)
  })
})

describe('la tira de la cuota se apoya sobre los botones, no encima', () => {
  it('tiene una altura distinta en escritorio', () => {
    // La barra de botones mide 68px en el teléfono —`pt-3`(12)+botón(44)+
    // `pb-3`(12)— pero 80 en escritorio, donde el relleno de abajo es
    // `lg:pb-6`(24). Con un solo valor, la tira se metía 12px por debajo y las
    // cifras quedaban pegadas a los botones. Reportado en la captura.
    const tira = prestamo.match(/className="fixed left-0 right-0 lg:left-\[var\(--cf-w-sidebar\)\] z-\[44\][^"]*"/)
    expect(tira, 'no encuentro la tira de la cuota').toBeTruthy()
    expect(tira[0]).toMatch(/\bbottom-\[calc\(\d+px\+env\(safe-area-inset-bottom\)\)\]/)
    expect(tira[0]).toMatch(/\blg:bottom-\[calc\(\d+px\+env\(safe-area-inset-bottom\)\)\]/)
  })

  it('en escritorio se separa MÁS que en el teléfono', () => {
    const tira = prestamo.match(/className="fixed left-0 right-0 lg:left-\[var\(--cf-w-sidebar\)\] z-\[44\][^"]*"/)[0]
    const movil = Number(tira.match(/(?<!lg:)bottom-\[calc\((\d+)px/)[1])
    const pc    = Number(tira.match(/lg:bottom-\[calc\((\d+)px/)[1])
    expect(pc).toBeGreaterThan(movil)
    // Y las dos por encima del alto real de su barra, o se solapan otra vez.
    expect(movil).toBeGreaterThanOrEqual(68)
    expect(pc).toBeGreaterThanOrEqual(80)
  })

  it('el bottom NO va en un style en línea', () => {
    // Un `bottom` inline no puede cambiar en `lg:`, que es justo lo que hacía
    // falta. Con el valor en línea el fallo vuelve tal cual.
    const bloque = prestamo.match(/z-\[44\][\s\S]{0,240}?>/)[0]
    expect(bloque).not.toMatch(/style=\{\{[^}]*\bbottom:/)
  })
})
