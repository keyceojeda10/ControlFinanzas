import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { esDelDiaAbierto } from '@/lib/dinero/reverso-del-dia'

// Crediya, 18 nov 2026: renovó entregando $200.000 y con esa plata liquidó otro
// préstamo del mismo cliente. Al deshacerlo días después, anular la renovación
// no devolvía los $200.000 (otro día) pero anular la liquidación sí los quitaba
// HOY: la caja quedaba $200.000 por debajo. La regla de `reverso-del-dia.js` vale
// para las tres vías: borrar préstamo, anularlo y anular un pago suelto.
//
// Sobre el CÓDIGO, sin comentarios: el comentario del arreglo cita lo que se
// quitó y la prueba se cazaría a sí misma.
const fuente = readFileSync(resolve(process.cwd(), 'app/api/pagos/[id]/route.js'), 'utf8')
const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const borrar = codigo.slice(codigo.indexOf('export async function DELETE'))

describe('anular un pago respeta el día en que entró', () => {
  it('mira si el cobro es del día abierto', () => {
    expect(borrar).toMatch(/const entroHoy = esDelDiaAbierto\(pago\.createdAt \?\? pago\.fechaPago, pais\)/)
  })

  it('solo quita del capital el cobro que entró hoy', () => {
    const i = borrar.indexOf('if (quitaDelCapital && entroHoy) {')
    expect(i, 'el reverso del cobro ya no mira el día').toBeGreaterThan(0)
    const bloque = borrar.slice(i, i + 400)
    expect(bloque).toMatch(/registrarMovimientoCapital\(tx, \{/)
    expect(bloque).toMatch(/descripcion: `Reverso pago anulado - préstamo`/)
    // Y no queda otra rama que lo quite sin mirar el día.
    expect(borrar).not.toMatch(/if \(!\['recargo', 'descuento'\]\.includes\(pago\.tipo\)\) \{\s*await registrarMovimientoCapital/)
  })

  it('dice cuánto NO se quitó, como el borrado de préstamos', () => {
    expect(borrar).toMatch(/capitalNoQuitado: capitalNoQuitado \|\| null/)
  })

  it('el criterio: hoy sí, hace seis días no', () => {
    const ahora = Date.parse('2026-11-18T15:00:00Z')
    expect(esDelDiaAbierto(new Date('2026-11-18T14:00:00Z'), 'co', ahora)).toBe(true)
    expect(esDelDiaAbierto(new Date('2026-11-12T23:30:47Z'), 'co', ahora)).toBe(false)
  })
})
