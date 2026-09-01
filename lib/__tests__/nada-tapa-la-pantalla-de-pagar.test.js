// lib/__tests__/nada-tapa-la-pantalla-de-pagar.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El dueño estuvo un día entero sin poder guardar su medio de pago: «no hay una
// opción como tal, un botón o algo que se haga». El botón estaba —lo había
// medido yo mismo con `elementFromPoint` y salía tocable— pero lo había medido
// con una cuenta que SÍ tenía teléfono.
//
// Con la suya, el modal «Agrega tu número de celular» (`fixed inset-0 z-[100]`)
// caía justo encima y se comía los clics. Comprobado con Playwright contra el
// espejo: el div interceptaba el clic del botón «Suscribirme».
//
// Le pasaba a **70 de los 587 dueños** — los que no tienen teléfono guardado,
// que es justo a quien más falta le hace poder pagar.
//
// ⚠ La lección no es «arreglé este modal»: es que la pantalla por donde entra
// el dinero no puede tener NADA a pantalla completa encima.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join, sep } from 'path'

const raiz = resolve(__dirname, '../..')
const modal = readFileSync(resolve(raiz, 'components/layout/CompletarTelefonoModal.jsx'), 'utf8')

describe('⚠ nada se pone encima de la pantalla de pagar', () => {
  it('el modal del teléfono no se abre en «Mi plan»', () => {
    expect(modal).toMatch(/RUTAS_SIN_MODAL/)
    expect(modal).toMatch(/'\/configuracion\/plan'/)
    expect(modal).toMatch(/RUTAS_SIN_MODAL\.some\(/)
  })

  it('y sigue pidiéndose en el resto de pantallas', () => {
    /* El teléfono hace falta: es por donde se le avisa de que su plan vence.
       Lo que se quita es que aparezca encima de quien está pagando. */
    expect(modal).toMatch(/setOpen\(true\)/)
    expect(modal).not.toMatch(/return null\s*\/\/\s*desactivado/i)
  })

  it('⚠ y ningún otro que se abra SOLO puede taparla', () => {
    /* La regla no es «este modal»: es que nada que aparezca sin que el usuario
       lo pida puede ponerse encima de la pantalla por donde entra el dinero.
       Se buscan los que ocupan toda la pantalla, con z-index alto, y que se
       abren desde un `useEffect` — o sea, solos. Los que abre el usuario al
       pulsar (el menú «Más», por ejemplo) no cuentan. */
    const dir = resolve(raiz, 'components/layout')
    const sospechosos = []
    for (const f of readdirSync(dir)) {
      const ruta = join(dir, f)
      if (!statSync(ruta).isFile() || !/\.jsx?$/.test(f)) continue
      const src = readFileSync(ruta, 'utf8')
      const ocupaTodo = /fixed inset-0/.test(src) && /z-\[(?:5\d|[6-9]\d|\d{3,})\]/.test(src)
      if (!ocupaTodo) continue
      /* ¿se abre solo? un useEffect que pone a true el estado de apertura */
      const seAbreSolo = /useEffect\([\s\S]{0,900}?set(?:Open|Abierto|Mostrar|Visible)\(true\)/.test(src)
      if (seAbreSolo && !/RUTAS_SIN_MODAL/.test(src)) sospechosos.push(f)
    }
    expect(sospechosos,
      `se abren solos y taparían la pantalla de pagar:\n${sospechosos.join('\n')}`
    ).toEqual([])
  })
})
