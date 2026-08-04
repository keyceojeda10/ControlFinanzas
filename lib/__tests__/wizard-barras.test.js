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

  it('crear cliente usa el token de hoja', () => {
    // `--cf-sh-sheet` existe justo para esto: una hoja anclada abajo.
    // ⚠ SOLO crear cliente. En crear préstamo la franja lleva la cuota dentro
    // y va SIN sombra a propósito: se apoya sobre el borde, no flota. Eso lo
    // vigila `wizards-rediseno.test.js`.
    const barra = cliente.match(/className="fixed left-0 right-0[^"]*bottom-0[^"]*"[\s\S]{0,320}/)[0]
    expect(barra).toContain('var(--cf-sh-sheet)')
  })

  it('el token de hoja existe de verdad', () => {
    // Un token inventado no falla: el `var()` cae al respaldo y la sombra
    // desaparece sin que nada avise.
    expect(leer('app', 'tokens-2026.css')).toMatch(/--cf-sh-sheet:\s*[^;]+;/)
  })
})

/* ── AQUÍ VIVÍAN TRES PRUEBAS DE LA TIRA FLOTANTE ──
   Vigilaban que la tira de la cuota se apoyara sobre la barra de botones sin
   solaparse: dos alturas distintas, una por tamaño de pantalla, y el `bottom`
   por clase y no en línea.
   Ya no aplican: la tira DEJÓ DE EXISTIR como pieza aparte. El rediseño de
   T01-06 mete la cuota dentro de la propia franja de acción, así que no hay
   dos cajas que alinear —que era justo de donde salían los dos fallos que
   costó encajarlas: primero se solapaban, luego se separaban demasiado—.
   Lo que queda por vigilar de esa franja está en `wizards-rediseno.test.js`.
   Se borran en vez de dejarlas apuntando a algo que ya no está: una prueba que
   mide una pieza inexistente pasa o falla por motivos que no son. */
