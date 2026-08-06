import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { cifrasCliente } from '@/lib/adaptadores/clientes'

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

describe('el rótulo cabe en su cuarto de tarjeta', () => {
  it('el adaptador lo llama «Cobra el»', () => {
    expect(adaptador).toMatch(/etiqueta: 'Cobra el'/)
  })

  it('y la ficha del cliente dice lo mismo: una sola palabra para una sola cosa', () => {
    const hero = readFileSync(resolve(process.cwd(), 'components/clientes/ClienteHeroCard.jsx'), 'utf8')
    expect(hero).toMatch(/rotulo: 'Cobra el'/)
  })
})

describe('la tabla de escritorio sigue encontrando la cifra', () => {
  it('busca por la MISMA clave que pone el adaptador', () => {
    /* ⚠ Aquí está el peligro real de este cambio: la tabla no recibe la cifra,
       la BUSCA por su etiqueta (`dameCifra(a, …)`). Cambiar el rótulo en el
       adaptador y no aquí deja la columna vacía **sin ningún error** — nadie se
       entera hasta que un cliente lo reporta.

       Es el mismo fallo de «arreglé el recibo de WhatsApp y dejé la imagen». */
    expect(lista).toMatch(/dameCifra\(a, 'Cobra el'\)/)
    expect(lista, 'quedó una búsqueda por el rótulo viejo')
      .not.toMatch(/dameCifra\(a, 'Próx\. cobro'\)/)
  })

  it('todas las claves que busca la tabla las produce el adaptador', () => {
    // Barrido, no lista a mano: si mañana alguien añade una quinta columna y se
    // equivoca de nombre, esto lo caza.
    const claves = [...lista.matchAll(/dameCifra\(a, '([^']+)'\)/g)].map((m) => m[1])
    expect(claves.length).toBeGreaterThanOrEqual(4)
    for (const k of claves) {
      expect(adaptador, `la tabla busca «${k}» y el adaptador no la produce`)
        .toMatch(new RegExp(`etiqueta: '${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`))
    }
  })

  it('y la cabecera de la columna dice lo mismo que la fila', () => {
    expect(lista).toMatch(/'Pagado', 'Cobra el'\]/)
  })
})

describe('la cifra sigue saliendo, y con su tono', () => {
  const base = { id: 'c1', nombre: 'X', proximoCobro: null }

  it('vencido va en rojo', () => {
    const cifras = cifrasCliente({ ...base, proximoCobro: '2020-01-01T05:00:00.000Z' }, 'co')
    const cif = cifras?.find((c) => c.etiqueta === 'Cobra el')
    expect(cif?.valor).toBe('vencido')
    expect(cif?.tono).toBe('contra')
  })

  it('sin fecha no se inventa una fila', () => {
    const cifras = cifrasCliente({ ...base }, 'co')
    expect(cifras?.find((c) => c.etiqueta === 'Cobra el')).toBeUndefined()
  })
})
