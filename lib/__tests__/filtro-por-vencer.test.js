// lib/__tests__/filtro-por-vencer.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Los filtros de los préstamos: los que más se usan son los de próximos a
//  vencer, bien sea en 5 días o 10 días. Esta aplicación no tiene ese filtro,
//  tiene otros pero no son los adecuados. O que automáticamente los primeros
//  préstamos en la lista sean los más cercanos a vencer.»
//   — Miguel Ángel (Préstamos Rincón), por el banner, 15 ago 2026.
//
// Tenía razón: los chips eran Todos · Pendientes · Activos · En mora · Renovar ·
// Perdidos · De hoy · Completados · Cancelados. Ninguno contesta «¿a quién
// tengo que llamar esta semana?».
//
// Lo que estas pruebas cuidan:
//
//   1. Que el filtro traiga también los que YA están en mora. Vencido no es
//      «por vencer», y «En mora» es el chip de al lado: si los dos traen lo
//      mismo, uno sobra.
//   2. Que se pierda el orden. Sin él hay que leer veinte fechas para encontrar
//      la de mañana, que es justo lo que él quería evitar.
//   3. Que el chip quede sin cablear. Ya pasó en esta pantalla —«los enlaces
//      existían y no filtraban nada»— y es el fallo que no se ve: la lista
//      responde, solo que trae otra cosa.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const API = leer('app/api/prestamos/route.js')
const PANTALLA = leer('app/(dashboard)/prestamos/page.jsx')

describe('⚠ el servidor entiende «por vencer»', () => {
  it('acepta solo las dos ventanas que se ofrecen', () => {
    /* Sin la lista blanca, `?porVencer=999` traería la cartera entera bajo un
       nombre que dice otra cosa. */
    expect(API).toMatch(/\[5, 10\]\.includes\(Number\(searchParams\.get\('porVencer'\)\)\)/)
  })

  it('⚠ deja fuera a los que ya están en mora', () => {
    const criterio = API.slice(API.indexOf(': porVencer ? ((p) =>'), API.indexOf(': null\n\n  if (criterio)'))
    expect(criterio).toMatch(/p\.diasMora > 0/)
    expect(criterio).toMatch(/p\.estado !== 'activo'/)
  })

  it('mide desde el arranque del día del país, no desde «ahora»', () => {
    /* Con `Date.now()`, un cobro de esta tarde saldría con cero días y mañana
       con menos uno: la misma fecha cambiaría de casilla según la hora. */
    expect(API).toMatch(/const inicioHoy = inicioDelDiaLocal\(session\.user\.country/)
    expect(API).toMatch(/new Date\(p\.proximoCobro\) - inicioHoy/)
  })

  it('⚠ los devuelve ordenados, del más cercano al más lejano', () => {
    expect(API).toMatch(/if \(porVencer\) \{[\s\S]{0,200}sort\(\(a, b\) => new Date\(a\.proximoCobro\) - new Date\(b\.proximoCobro\)\)/)
  })
})

describe('⚠ y también sin conexión, que es donde ya estaban rotos', () => {
  const OFF = leer('lib/adaptadores/filtro-prestamos.js')

  it('los cinco chips derivados los resuelve una sola función', () => {
    /* Escrito a mano en la pantalla —y DOS veces, una por cada respaldo—,
       «renovar», «clavo» y «de hoy» comparaban el estado del préstamo con la
       palabra del chip: la lista salía vacía sin avisar. */
    for (const chip of ['mora', 'renovar', 'clavo', 'nuevos', 'vence5', 'vence10']) {
      expect(OFF, `falta ${chip}`).toMatch(new RegExp(`'${chip}'`))
    }
  })

  it('la pantalla la usa en sus DOS respaldos, no en uno', () => {
    const usos = PANTALLA.match(/filtrarPrestamosGuardados\(allPrestamos/g) ?? []
    expect(usos).toHaveLength(2)
  })

  it('y sin conexión también los ordena por cercanía', () => {
    expect(OFF).toMatch(/sort\(\(a, b\) => new Date\(a\.proximoCobro\) - new Date\(b\.proximoCobro\)\)/)
  })
})

describe('⚠ el chip está cableado de verdad', () => {
  it('los dos chips existen en la fila, no dentro de la hoja', () => {
    const chips = PANTALLA.slice(PANTALLA.indexOf('const ESTADOS = ['), PANTALLA.indexOf('const FRECUENCIAS'))
    expect(chips).toMatch(/value: 'vence5'/)
    expect(chips).toMatch(/value: 'vence10'/)
  })

  it('y cada uno manda su ventana al servidor', () => {
    expect(PANTALLA).toMatch(/est === 'vence5'\) params\.set\('porVencer', '5'\)/)
    expect(PANTALLA).toMatch(/est === 'vence10'\) params\.set\('porVencer', '10'\)/)
  })

  it('⚠ cuentan como filtro derivado, o pedirían un estado que no existe', () => {
    /* «vence5» no es un estado en la base. Sin esto se mandaría
       `?estado=vence5` y el servidor devolvería la lista vacía sin quejarse.

       ⚠ El recorte va por LONGITUD y no hasta `const apiEstado`: esa cadena
       aparece TRES veces en el archivo y la primera está antes, así que el
       recorte salía vacío y la prueba pasaba sin mirar nada. */
    const i = PANTALLA.indexOf('const derivado =')
    expect(i).toBeGreaterThan(0)
    const linea = PANTALLA.slice(i, i + 220)
    expect(linea).toMatch(/est === 'vence5'/)
    expect(linea).toMatch(/est === 'vence10'/)
  })
})
