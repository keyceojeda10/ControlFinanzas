import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/* «Que le pueda elegir si quiere meter todos esos clientes nuevos arriba de la
 *  ruta o debajo de los clientes que ya están en la ruta. Eso es importante que
 *  se pueda elegir.» — PRESTA MIL, por el dueño, 3 oct 2026.
 *
 * El motor de la unión se prueba con su doble en unir-rutas.test.js; aquí, que
 * la elección viaje de la pantalla al servidor por las dos vías. */
const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('al unir rutas', () => {
  it('la hoja ofrece arriba y debajo, y manda la elección', () => {
    const hoja = leer('components/pantallas/Gestion.jsx')
    expect(hoja).toMatch(/<Rotulo>¿Dónde van sus clientes\?<\/Rotulo>/)
    expect(hoja).toMatch(/onClick=\{\(\) => onPosicion\?\.\('final'\)\}/)
    expect(hoja).toMatch(/onClick=\{\(\) => onPosicion\?\.\('inicio'\)\}/)
    expect(leer('components/rutas/UnirRutas.jsx')).toMatch(/body: JSON\.stringify\(\{ destinoId, cobradorId, posicion \}\)/)
  })
  it('el API se la pasa al motor; sin decir nada, debajo', () => {
    expect(leer('app/api/rutas/[id]/unir/route.js')).toMatch(/posicion: body\?\.posicion \?\? 'final',/)
  })
})

describe('al agregar clientes', () => {
  it('el modal ofrece arriba y debajo, y manda la elección', () => {
    const pagina = leer('app/(dashboard)/rutas/[id]/page.jsx')
    expect(pagina).toMatch(/\[\['final', 'Debajo de los que ya están'\], \['inicio', 'Arriba de todos'\]\]/)
    expect(pagina).toMatch(/descontarCapitalRuta, posicion: posicionAgregar \}\)/)
  })
  it('el API valida la posición y, arriba, corre a los que ya estaban en una sola sentencia', () => {
    const api = leer('app/api/rutas/[id]/clientes/route.js')
    expect(api).toMatch(/if \(posicion !== 'final' && posicion !== 'inicio'\) \{\s*return Response\.json\(\{ error: 'Posición no válida' \}, \{ status: 400 \}\)/)
    // Corre a TODOS los que ya estaban —también los sin puesto— y no a los que entran.
    expect(api).toMatch(/ORDER BY \(ordenRuta IS NOT NULL\), ordenRuta, nombre, id\) AS rn\s*FROM Cliente WHERE organizationId = \? AND rutaId = \? AND id NOT IN/)
    expect(api).toMatch(/nextOrden = 0\s*\} else \{/)
  })
})
