import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── EL MONTO SE SALÍA DE LA TARJETA ─────────────────────────────────────────
//
// Reportado con captura, y con el detalle que lo explica todo: **solo pasaba en
// la fila que lleva la pastilla «SIGUIENTE»**. Las demás filas iban bien.
//
// Medido a 393px — quedan 317 útiles dentro de la tarjeta:
//
//     «Mes 1 · 5 de septiembre»   157   ← ni siquiera se recortaba
//     SIGUIENTE                    69
//     $105.000                     68
//     dos huecos de 10             20
//                                 ───
//                                 314   ← cabía por 3px con fuente de sistema
//
// Con Space Grotesk, que es más ancha, se pasa. La lámina lo dibuja en un solo
// renglón, pero con un caso que sí cabe («Mes 1 · 21 de agosto» y $366.667): 3px
// de margen no es un diseño que funcione, es uno que aguanta por casualidad.
//
// ⚠ El primer arreglo —solo `wrap`— no servía: con `flex: 1` la fecha cedía
// antes de que la fila llegara a partirse, y salía «Quincena 12 · 30 de …».
// Eso se ve en la captura, no en las medidas: `seSale` daba `false` en los tres
// casos y el problema seguía ahí. El día es EL dato (es cuándo hay que cobrar).

const src = readFileSync(resolve(process.cwd(), 'components/pantallas/TablaAmortizacion.jsx'), 'utf8')
// ⚠ El cierre se busca DESDE el ancla: hay tres `<Barra …>` en el fichero y el
// primero está antes, así que un `indexOf` suelto daba un corte vacío.
const desde = src.indexOf('LOS TRES NO SIEMPRE CABEN')
const fila = src.slice(desde, src.indexOf('<Barra capital=', desde))

describe('la fila de la cuota no se sale de su tarjeta', () => {
  it('la fila puede partirse', () => {
    expect(fila).toMatch(/flexWrap: 'wrap'/)
  })

  it('y la fecha NO se encoge: perder el mes es peor que usar dos renglones', () => {
    expect(fila, 'volvió el `flex: 1`: la fecha cede y sale «30 de …»')
      .not.toMatch(/flex: 1, minWidth: 0, fontSize: 14/)
    expect(fila).toMatch(/flex: 'none', minWidth: 0, fontSize: 14/)
  })
})

describe('cuando cabe, se ve igual que la lámina', () => {
  it('el monto sigue a la derecha del todo', () => {
    /* En el DOM va antes que la pastilla para que al partirse baje él —queda
       solo y alineado, mejor que una pastilla huérfana—, y `order` + el margen
       automático lo devuelven a su sitio visual cuando sí cabe. El monto es lo
       último de la fila en todas las demás pantallas y tiene que seguir
       siéndolo. */
    expect(fila).toMatch(/order: 2, marginLeft: 'auto'/)
    expect(fila).toMatch(/flex: 'none', order: 1,\s*\}\}>SIGUIENTE/)
  })

  it('la pastilla mantiene el dorado de la lámina, no el tono del sistema', () => {
    // `#3A2900` sobre el oro: es el único dorado de la pantalla y lo que
    // encuentra la cuota que viene entre treinta filas iguales.
    expect(fila).toMatch(/background: ORO, color: '#3A2900'/)
    expect(fila).toMatch(/height: 20, padding: '0 8px'/)
    expect(fila).toMatch(/borderRadius: 11/)
  })
})
