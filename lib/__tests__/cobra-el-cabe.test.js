import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { cifrasCliente, cifraProximoCobro } from '@/lib/adaptadores/clientes'

// ── «PRÓX. COB…» ────────────────────────────────────────────────────────────
//
// Con cuatro cifras en la tira, un cuarto de 393px da 69px de rótulo y
// «PRÓX. COBRO» pide 73. Medido en el navegador, no en el código: ahí se veía
// bien. En la captura salía «PRÓX. COB…» en las fichas con cuatro columnas y
// entero en las de tres — por eso pasaba desapercibido.
//
// La app YA había tropezado con esto y ya lo había resuelto:
// `ClienteHeroCard.jsx:470` dice literal «‹PRÓXIMO COBRO› NO CABE EN UNA CUARTA
// PARTE DE 393px», y lo llamó «Cobra el». Se dice igual en los dos sitios.

const adaptador = readFileSync(resolve(process.cwd(), 'lib/adaptadores/clientes.js'), 'utf8')
const lista = readFileSync(resolve(process.cwd(), 'app/(dashboard)/clientes/page.jsx'), 'utf8')

describe('⚠ EL RÓTULO CAMBIA CON LA SITUACIÓN', () => {
  /* El dueño lo reportó con la captura:

       COBRA EL          COBRA EL
       hoy      ← mal    vencido    ← mal

     El rótulo y el valor se leen JUNTOS, uno encima del otro. «Cobra el hoy» no
     se dice, y «cobra el vencido» además NO INFORMA: esconde el único dato que
     sirve, que es qué día venció. Un cobrador que lee «vencido» no sabe si fue
     ayer o hace tres semanas. */

  const el = (dias) => cifraProximoCobro({
    proximoCobro: new Date(Date.now() + dias * 86400000).toISOString(),
  })

  it('vencido dice QUÉ DÍA venció, no la palabra «vencido»', () => {
    const c = el(-9)
    expect(c.etiqueta).toBe('Venció el')
    expect(c.valor).toMatch(/^\d{1,2} \w{3}$/)   // «14 jul»
    expect(c.tono).toBe('contra')
  })

  it('hoy se lee «COBRA / hoy», no «COBRA EL / hoy»', () => {
    const c = el(0)
    expect(c.etiqueta).toBe('Cobra')
    expect(c.valor).toBe('hoy')
    expect(c.tono).toBe('oro')
  })

  it('mañana también tiene su palabra', () => {
    const c = el(1)
    expect(c.etiqueta).toBe('Cobra')
    expect(c.valor).toBe('mañana')
  })

  it('y una fecha lejana sigue siendo «COBRA EL / 19 ago»', () => {
    const c = el(12)
    expect(c.etiqueta).toBe('Cobra el')
    /* ⚠ `\w{3}` NO VALE: «sept» tiene cuatro letras. De los doce meses cortos en
       español —ene feb mar abr may jun jul ago sept oct nov dic— ese es el único.
       La prueba se ponía roja sola los doce días del año en los que hoy + 12
       cae en septiembre, sin que nadie tocara nada. Misma familia que el «de»
       que el ICU nuevo mete en `month: 'short'`. */
    expect(c.valor).toMatch(/^\d{1,2} \w{3,4}$/)
  })

  it('sin fecha no se inventa nada', () => {
    expect(cifraProximoCobro({ proximoCobro: null })).toBeNull()
    expect(cifraProximoCobro({})).toBeNull()
  })

  it('la regla vive en UN solo sitio: cuatro pantallas la pintan', () => {
    /* La lista de clientes, la de préstamos, la tabla de escritorio y la ficha
       del cliente. Con la regla repetida cuatro veces, la quinta pantalla la
       escribe distinta. */
    const hero = readFileSync(resolve(process.cwd(), 'components/clientes/ClienteHeroCard.jsx'), 'utf8')
    const prestamos = readFileSync(resolve(process.cwd(), 'lib/adaptadores/prestamos.js'), 'utf8')
    expect(adaptador).toMatch(/export function cifraProximoCobro/)
    expect(hero).toMatch(/cifraProximoCobro/)
    expect(prestamos).toMatch(/cifraProximoCobro/)
    expect(hero, 'volvió el rótulo fijo en la ficha').not.toMatch(/rotulo: 'Cobra el',/)
  })

  it('el rótulo más largo sigue cabiendo en un cuarto de 393px', () => {
    /* «PRÓXIMO COBRO» no cabía y salía «PRÓXIMO CO…». El nuevo más largo es
       «VENCIÓ EL» (9), uno más que «COBRA EL» (8): entra igual. Si alguien mete
       uno más largo, esto lo caza antes que la pantalla. */
    for (const dias of [-9, 0, 1, 12]) {
      const c = cifraProximoCobro({ proximoCobro: new Date(Date.now() + dias * 86400000).toISOString() })
      expect(c.etiqueta.length, `«${c.etiqueta}» es muy largo para la columna`).toBeLessThanOrEqual(10)
    }
  })
})

describe('la tabla de escritorio sigue encontrando la cifra', () => {
  it('⚠ la busca por CLAVE, no por rótulo', () => {
    /* Aquí está el peligro real de este cambio: la tabla no recibe la cifra, la
       BUSCA. Con el rótulo ahora variable, buscarla por «Cobra el» la habría
       dejado vacía en TODAS las filas vencidas — sin ningún error, solo en
       blanco. Nadie se entera hasta que un cliente lo reporta.

       Es el mismo fallo de «arreglé el recibo de WhatsApp y dejé la imagen». */
    expect(lista).toMatch(/dameCifra\(a, 'Cobra el', 'cobro'\)/)
    expect(lista).toMatch(/\(clave && x\.clave === clave\) \|\| x\.etiqueta === etiqueta/)
    expect(adaptador).toMatch(/clave: 'cobro'/)
  })

  it('todas las que busca por rótulo las produce el adaptador', () => {
    // Barrido, no lista a mano: si mañana alguien añade una quinta columna y se
    // equivoca de nombre, esto lo caza.
    const claves = [...lista.matchAll(/dameCifra\(a, '([^']+)'\)/g)].map((m) => m[1])
    for (const k of claves) {
      expect(adaptador, `la tabla busca «${k}» y el adaptador no la produce`)
        .toMatch(new RegExp(`etiqueta: '${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`))
    }
  })

  it('y la cabecera de la columna se queda fija, que para eso es cabecera', () => {
    // En una tabla el rótulo es de la COLUMNA, no de la fila: no puede cambiar
    // por cliente. La fila dice la fecha y el rojo dice que ya pasó.
    expect(lista).toMatch(/'Pagado', 'Cobra el'\]/)
  })
})

describe('la cifra sigue saliendo con su tono', () => {
  const base = { id: 'c1', nombre: 'X', proximoCobro: null }

  it('vencido va en rojo, y con la fecha', () => {
    const cifras = cifrasCliente({ ...base, proximoCobro: '2020-01-01T05:00:00.000Z' }, 'co')
    const cif = cifras?.find((c) => c.clave === 'cobro')
    expect(cif?.etiqueta).toBe('Venció el')
    expect(cif?.valor).toBe('1 ene')
    expect(cif?.tono).toBe('contra')
  })

  it('sin fecha no se inventa una fila', () => {
    const cifras = cifrasCliente({ ...base }, 'co')
    expect(cifras?.find((c) => c.clave === 'cobro')).toBeUndefined()
  })
})
