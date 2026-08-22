import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/* ══ SIN PARÁMETRO NO HAY FILTRO ═══════════════════════════════════════════
 *
 * El 22 ago 2026 la pantalla de Préstamos amaneció en «0 activos · EN LA CALLE
 * $0» para todo el mundo. Reportado por el dueño con captura.
 *
 * La causa, en una línea: `Number(null)` es 0.
 *
 *     const n = Number(searchParams.get('porVencer'))   // sin parámetro → 0
 *     Number.isInteger(0)                               // → true
 *
 * La guarda daba por bueno un `porVencer = 0` que nadie había pedido, y con la
 * ventana 0 a 0 el listado se recortaba a «los que vencen hoy y no deben nada».
 *
 * La versión vieja no tenía el fallo POR CASUALIDAD: `[5, 10].includes(0)` es
 * falso. Al abrir el rango a cualquier número, el cero dejó de ser inofensivo —
 * y ninguna prueba lo cazó porque todas le pasaban un valor.
 *
 * Esta prueba corre la lectura de verdad, con y sin parámetro. */

const src = readFileSync(join(process.cwd(), 'app', 'api', 'prestamos', 'route.js'), 'utf8')

/** La misma función que usa el endpoint, sacada del propio archivo. */
const leerDiaDelEndpoint = () => {
  const i = src.indexOf('const leerDia = (nombre) => {')
  if (i === -1) throw new Error('desapareció `leerDia` del endpoint')
  const cuerpo = src.slice(i, src.indexOf('\n  }', i) + 4)
  // eslint-disable-next-line no-new-func
  return new Function('searchParams', `${cuerpo}\n    return leerDia`)
}

describe('el filtro de «¿cuándo le cobras?» solo filtra si se lo piden', () => {
  const conUrl = (qs) => leerDiaDelEndpoint()(new URL(`http://x/?${qs}`).searchParams)

  it('⚠ sin el parámetro NO hay filtro, aunque `Number(null)` sea 0', () => {
    expect(conUrl('')('porVencer'), 'volvió el cero fantasma').toBeNull()
  })

  it('vacío tampoco filtra', () => {
    expect(conUrl('porVencer=')('porVencer')).toBeNull()
    expect(conUrl('porVencer=%20')('porVencer')).toBeNull()
  })

  it('pero el CERO pedido a mano sí vale: es «hoy»', () => {
    expect(conUrl('porVencer=0')('porVencer')).toBe(0)
  })

  it('y lo que no es un día se ignora', () => {
    for (const q of ['porVencer=abc', 'porVencer=-3', 'porVencer=999', 'porVencer=2.5']) {
      expect(conUrl(q)('porVencer'), `${q} debería ignorarse`).toBeNull()
    }
  })

  it('los días buenos pasan', () => {
    expect(conUrl('porVencer=15')('porVencer')).toBe(15)
    expect(conUrl('porVencerDesde=1')('porVencerDesde')).toBe(1)
  })
})
