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
import { criterioDelEndpoint } from './_criterio-ventana'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const API = leer('app/api/prestamos/route.js')
const PANTALLA = leer('app/(dashboard)/prestamos/page.jsx')

describe('⚠ el servidor entiende «por vencer»', () => {
  it('no acepta cualquier número', () => {
    /* Sin tope, `?porVencer=99999` traería la cartera entera bajo un nombre que
       dice otra cosa.

       ⚠ Antes esto exigía la lista literal `[5, 10].includes(...)`, y se puso
       roja el día que se abrieron las ventanas a seis (hoy, mañana, 5, 10, 15,
       30). Era un contrato de FORMA: lo que hay que cuidar es que haya tope, no
       cuáles son los números. */
    expect(API).toMatch(/n >= 0 && n <= 90/)
    /* ⚠ Y NO SOLO EL TOPE: sin parámetro no puede haber filtro. `Number(null)`
       es 0, y ese cero fantasma dejó la pantalla de Préstamos en «0 activos»
       para todo el mundo. Se mira la cadena antes de convertirla. Lo prueba a
       fondo `prestamos-sin-filtro-no-filtra.test.js`, ejecutándola de verdad. */
    expect(API).toMatch(/crudo == null \|\| crudo\.trim\(\) === ''/)
  })

  /* ⚠ DE AQUÍ EN ADELANTE SE EJECUTA EL CRITERIO DE VERDAD, sacado del propio
     endpoint. Antes esto eran expresiones regulares sobre el código, y cada vez
     que el filtro se reescribía se ponían rojas sin que nada estuviera mal —
     cuatro veces en una semana. Lo que hay que fijar es lo que HACE. */
  const HOY = new Date('2026-08-22T05:00:00.000Z')   // arranque del día en Bogotá
  const cae = (p, desde, hasta) =>
    criterioDelEndpoint({ inicioHoy: HOY, desde, hasta })(p)
  const dia = (n, hora = 5) =>
    new Date(Date.parse('2026-08-22T00:00:00Z') + n * 86400000 + hora * 3600000).toISOString()

  it('⚠ deja fuera a los que ya están en mora', () => {
    /* Vencido no es «por vencer», y «En mora» es el chip de al lado: si los dos
       traen lo mismo, uno sobra. */
    expect(cae({ estado: 'activo', diasMora: 0, proximoCobro: dia(3) }, 0, 5)).toBe(true)
    expect(cae({ estado: 'activo', diasMora: 4, proximoCobro: dia(3) }, 0, 5)).toBe(false)
  })

  it('y deja fuera lo que ya no está vivo', () => {
    expect(cae({ estado: 'pagado', diasMora: 0, proximoCobro: dia(3) }, 0, 5)).toBe(false)
    expect(cae({ estado: 'activo', diasMora: 0, proximoCobro: null }, 0, 5)).toBe(false)
  })

  it('mide desde el arranque del día del país, no desde «ahora»', () => {
    /* Con `Date.now()`, un cobro de esta tarde saldría con cero días y mañana
       con menos uno: la misma fecha cambiaría de casilla según la hora. Un
       cobro de HOY a las 11 de la noche sigue siendo de hoy. */
    // El convenio de la casa: la fecha se guarda a las 05:00Z, que es el
    // arranque del día en Bogotá.
    expect(cae({ estado: 'activo', diasMora: 0, proximoCobro: dia(0, 5) }, 0, 0)).toBe(true)
    /* ⚠ Y LAS FILAS VIEJAS TAMBIÉN. Quedan 1.462 guardadas con el convenio
       anterior —medianoche UTC, que en Bogotá son las 7 de la tarde del día
       antes—. Tienen que seguir contando como «hoy»: si se cayeran, a ese
       cliente nadie iría a cobrarle y no habría ni un error en ningún sitio. */
    expect(cae({ estado: 'activo', diasMora: 0, proximoCobro: dia(0, 0) }, 0, 0)).toBe(true)
    expect(cae({ estado: 'activo', diasMora: 0, proximoCobro: dia(1, 5) }, 0, 0)).toBe(false)
  })

  it('⚠ «mañana» es el día 1 y SOLO el día 1', () => {
    // Con un solo número arrastraba también los de hoy.
    expect(cae({ estado: 'activo', diasMora: 0, proximoCobro: dia(0) }, 1, 1)).toBe(false)
    expect(cae({ estado: 'activo', diasMora: 0, proximoCobro: dia(1) }, 1, 1)).toBe(true)
    expect(cae({ estado: 'activo', diasMora: 0, proximoCobro: dia(2) }, 1, 1)).toBe(false)
  })

  it('⚠ y la ventana «hoy», que es de CERO a cero, filtra', () => {
    /* El cero fantasma ya dejó la pantalla en «0 activos» una vez. Aquí se
       comprueba lo contrario: que un cero de verdad SÍ recorta. */
    expect(cae({ estado: 'activo', diasMora: 0, proximoCobro: dia(0) }, 0, 0)).toBe(true)
    expect(cae({ estado: 'activo', diasMora: 0, proximoCobro: dia(1) }, 0, 0)).toBe(false)
  })

  it('⚠ los devuelve ordenados, del más cercano al más lejano', () => {
    /* Sin orden hay que leer veinte fechas para encontrar la de mañana, que es
       justo lo que él quería evitar.

       ⚠ Y la guarda del orden NO puede ser una comprobación de «verdadero»:
       la ventana «hoy» vale 0, y un `if (porVencer)` la daba por ausente. */
    const guarda = API.match(/if \(([^)]+)\) \{\s*\n\s*filtrados = \[\.\.\.filtrados\]\.sort/)
    expect(guarda, 'desapareció el orden por cercanía').toBeTruthy()
    expect(guarda[1].trim(), 'el orden se guarda con un falsy y la ventana «hoy» vale 0')
      .not.toMatch(/^porVencer$/)
  })
})

describe('⚠ y también sin conexión, que es donde ya estaban rotos', () => {
  const OFF = leer('lib/adaptadores/filtro-prestamos.js')

  it('los cinco chips derivados los resuelve una sola función', () => {
    /* Escrito a mano en la pantalla —y DOS veces, una por cada respaldo—,
       «renovar», «clavo» y «de hoy» comparaban el estado del préstamo con la
       palabra del chip: la lista salía vacía sin avisar. */
    for (const chip of ['mora', 'renovar', 'clavo', 'nuevos',
      'venceHoy', 'venceManana', 'vence5', 'vence10', 'vence15', 'vence30']) {
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
  it('las seis ventanas existen en la fila, no dentro de la hoja', () => {
    const chips = PANTALLA.slice(PANTALLA.indexOf('const ESTADOS = ['), PANTALLA.indexOf('const FRECUENCIAS'))
    for (const v of ['venceHoy', 'venceManana', 'vence5', 'vence10', 'vence15', 'vence30']) {
      expect(chips, `falta la ventana ${v}`).toMatch(new RegExp(`value: '${v}'`))
    }
  })

  it('y cada una manda SU ventana al servidor', () => {
    /* Antes cada chip escribía su `params.set` a mano. Ahora hay una tabla, que
       es lo que evita que «mañana» y «hoy» acaben pidiendo lo mismo. */
    expect(PANTALLA).toMatch(/porVencerDesde/)
    expect(PANTALLA).toMatch(/venceManana:\s*\[1,\s*1\]/)
    expect(PANTALLA).toMatch(/vence30:\s*\[0,\s*30\]/)
  })

  it('⚠ cuentan como filtro derivado, o pedirían un estado que no existe', () => {
    /* «vence5» no es un estado en la base. Sin esto se mandaría
       `?estado=vence5` y el servidor devolvería la lista vacía sin quejarse.

       ⚠ El recorte va por LONGITUD y no hasta `const apiEstado`: esa cadena
       aparece TRES veces en el archivo y la primera está antes, así que el
       recorte salía vacío y la prueba pasaba sin mirar nada. */
    const i = PANTALLA.indexOf('const derivado =')
    expect(i).toBeGreaterThan(0)
    /* ⚠ Se comprueba que las ventanas ENTRAN por ahí, no que estén escritas una
       a una: con seis, listarlas a mano era otro contrato de forma. Ahora la
       pantalla usa `est.startsWith('vence')`, que las cubre todas y también las
       que se añadan mañana. */
    const linea = PANTALLA.slice(i, i + 220)
    expect(linea).toMatch(/est\.startsWith\('vence'\)/)
  })
})
