// lib/__tests__/ruta-quien-no-se-visita-pesa-menos.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Lo pidió el cliente más grande, y la razón es de la calle: «en ruta los
// cobradores se enredan mucho», porque el que ya terminó de pagar salía del
// mismo tamaño que el que debe.
//
// Medido en producción antes de tocar nada: 198 de 2.756 clientes de ruta no
// tienen préstamo activo (7%), pero está concentrado — la RUTA #4 tiene 45 de
// 140 (32%) y la #1, 56 de 206. Son decenas de tarjetas de media pantalla de
// gente a la que hoy no hay que tocarle la puerta.
//
// La diferencia NO se hace con un color más: el filete lateral ya se quitó en
// E10 por ser el cuarto sitio diciendo lo mismo. Se hace con PESO.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { contextoZona } from '../adaptadores/ruta.js'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const tarjeta = leer('components/cf/ParadaDeCobro.jsx')

describe('la tarjeta de quien no se visita pesa menos', () => {
  it('las dos zonas sin cobro usan la variante compacta', () => {
    // `sindeuda` es el que pagó y se le puede volver a prestar; `inactivo`, el
    // que lleva más de tres meses sin nada.
    expect(tarjeta).toMatch(/const compacta = contexto\?\.zona === 'sindeuda' \|\| contexto\?\.zona === 'inactivo'/)
  })

  it('⚠ y quien SÍ hay que cobrar conserva su tarjeta entera', () => {
    // El riesgo de esto era llevarse por delante la de cobro. La compacta es
    // una rama aparte con `return` propio: la de siempre no se toca.
    expect(tarjeta).toMatch(/if \(compacta\) \{/)
  })

  it('no pierde lo que identifica: el nombre va entero', () => {
    /* Con 143 clientes en una ruta, un apellido cortado es tocar la puerta
       equivocada. Vale igual en la compacta. */
    const bloque = tarjeta.slice(tarjeta.indexOf('if (compacta)'), tarjeta.indexOf('if (compacta)') + 3000)
    expect(bloque).not.toMatch(/textOverflow|ellipsis|nowrap/)
  })

  it('⚠ el botón no compite con «Cobrar»', () => {
    /* Mi primera versión lo puso en dorado macizo. En la captura el ojo iba a
       los dos «Prestarle» antes que al «Cobrar», y eso invierte la prioridad de
       quien va en ruta: el trabajo del día es cobrar. */
    const bloque = tarjeta.slice(tarjeta.indexOf('if (compacta)'), tarjeta.indexOf('if (compacta)') + 3500)
    expect(bloque).not.toMatch(/background: esListo \? 'var\(--cf-gold\)'/)
  })
})

describe('lo que dice la tarjeta del que ya pagó', () => {
  const base = { prestamosActivos: [], prestamosCompletados: 2, terminoDePagar: new Date().toISOString() }

  it('ofrece prestarle, que es lo que el dueño quiere ver', () => {
    const c = contextoZona({ ...base, puedePrestarHasta: 300000 }, 'sindeuda')
    expect(c.accion.texto).toBe('Prestarle')
    expect(c.cifras.some((x) => /Le prestas hasta/.test(x.etiqueta))).toBe(true)
  })

  it('⚠ no dice «le prestas hasta $1»', () => {
    /* Salió literal en la RUTA #2 del espejo. Una cifra así no informa:
       informa de un dato roto. */
    const c = contextoZona({ ...base, puedePrestarHasta: 1 }, 'sindeuda')
    expect(c.cifras.some((x) => /Le prestas hasta/.test(x.etiqueta))).toBe(false)
  })

  it('y tampoco cuando no se sabe', () => {
    const c = contextoZona({ ...base, puedePrestarHasta: 0 }, 'sindeuda')
    expect(c.cifras.some((x) => /Le prestas hasta/.test(x.etiqueta))).toBe(false)
  })
})
