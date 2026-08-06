import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { resolve, join } from 'path'

// ── EL DINERO VOLVÍA A LA CAJA PERO NO A SU RUTA ────────────────────────────
//
// LA CAUSA de fondo del descuadre de PRESTA MIL, encontrada midiendo día a día:
//
//     RUTA #6    28 jul: capital 0        base 358.000
//                29 jul: capital 174.000  base 174.000   ← cuadra
//                30 jul: capital  53.000  base  53.000   ← cuadra
//                 1 ago: capital 633.000  base 633.000   ← cuadra
//                 3 ago: capital 223.807  base 194.000   ← SE ROMPE
//                 5 ago: capital 444.978  base 318.000
//
// El sistema FUNCIONABA: hasta el 1 de agosto el capital de casi todas las rutas
// cuadraba al peso con la base que el dueño contaba cada noche. Se rompió el 3
// de agosto y no volvió a cuadrar ni un día.
//
// Qué pasó el 3: empiezan a aparecer ajustes por cancelar y eliminar préstamos,
// y esos se asentaban SIN `rutaId`. El dinero volvía a la caja global pero no
// bajaba a la sub-bolsa de la ruta, así que el capital de esa ruta quedaba
// desviado para siempre. Una sola cancelación de $4.000.000 entró así el 6 ago.
//
// ⚠ ERA UN OLVIDO, NO UN CRITERIO: en el mismo fichero, las llamadas de
// `prestamos/[id]/route.js:176`, `:197`, `:900` y `:911` SÍ pasaban la ruta, y
// las de cancelar y eliminar no. En `aprobar/route.js` son dos llamadas
// SEGUIDAS: el desembolso la pasa y el abono previo no.
//
// Medido en producción: 3.247 movimientos por $609.511.731 quedaron fuera de la
// sub-bolsa de su ruta, repartidos en decenas de negocios.

const RAIZ = process.cwd()

function jsDe(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) jsDe(p, acc)
    else if (e.endsWith('.js')) acc.push(p)
  }
  return acc
}

/** Los bloques `registrarMovimientoCapital(tx, { … })` con llaves equilibradas. */
function llamadas() {
  const out = []
  for (const p of jsDe(resolve(RAIZ, 'app'))) {
    const src = readFileSync(p, 'utf8')
    for (const m of src.matchAll(/registrarMovimientoCapital\(\s*tx\s*,\s*\{/g)) {
      let i = src.indexOf('{', m.index), prof = 0, j = i
      while (j < src.length) {
        if (src[j] === '{') prof++
        else if (src[j] === '}' && --prof === 0) break
        j++
      }
      out.push({
        fichero: p.slice(RAIZ.length + 1).replace(/\\/g, '/'),
        linea: src.slice(0, m.index).split('\n').length,
        bloque: src.slice(i, j + 1),
      })
    }
  }
  return out
}

describe('todo movimiento de una ruta lleva su ruta', () => {
  it('solo los aportes de socio pueden ir sin ella', () => {
    /* Un aporte o retiro de socio no pertenece a ninguna ruta: es plata que
       entra o sale del negocio entero. Ésos son los ÚNICOS dos que pueden ir
       sin `rutaId`; cualquier otro que aparezca aquí hay que mirarlo. */
    // Solo el fichero: la línea se mueve en cuanto alguien edita el de arriba,
    // y entonces la prueba fallaría por un motivo que no es el suyo.
    const sinRuta = llamadas()
      .filter((x) => !/rutaId/.test(x.bloque))
      .map((x) => x.fichero)

    expect(sinRuta, `movimientos que no bajan a su sub-bolsa:\n  ${sinRuta.join('\n  ')}`)
      .toEqual([
        'app/api/socios/[id]/aportes/route.js',
        'app/api/socios/[id]/aportes/route.js',
      ])
  })
})

describe('los seis que estaban rotos', () => {
  /* ⚠ Se busca EN EL BLOQUE de la llamada, no en una ventana de N caracteres:
     los comentarios que explican el arreglo empujan el `rutaId` fuera de
     cualquier ventana fija, y la prueba fallaba con el código correcto delante.
     Es el mismo tropiezo que ya tuvo `registrar-pago-wa` con el SVG. */
  const conDescripcion = (frag) => llamadas().filter((x) => x.bloque.includes(frag))

  const exigeRuta = (frag, patron) => {
    const hits = conDescripcion(frag)
    expect(hits.length, `no encontré la llamada de «${frag}»`).toBeGreaterThan(0)
    for (const h of hits) {
      expect(h.bloque, `${h.fichero}:${h.linea} volvió a salir sin ruta`).toMatch(patron)
    }
    return hits.length
  }

  it('cancelar un préstamo devuelve el dinero A SU RUTA', () => {
    exigeRuta('Cancelación préstamo - devuelve', /rutaId: p\.cliente\?\.rutaId \|\| null/)
  })

  it('eliminarlo también, en sus tres reversos', () => {
    // Desembolso, recaudo y descuento: los tres salían sin ruta.
    const prestamo = readFileSync(resolve(RAIZ, 'app/api/prestamos/[id]/route.js'), 'utf8')
    expect(prestamo).toMatch(/const rutaDelCliente = p\.cliente\?\.rutaId \|\| null/)
    exigeRuta('Reverso desembolso - préstamo eliminado', /rutaId: rutaDelCliente/)
    exigeRuta('Reverso recaudo - préstamo eliminado', /rutaId: rutaDelCliente/)
    exigeRuta('Reverso descuento - préstamo eliminado', /rutaId: rutaDelCliente/)
  })

  it('el abono previo, al crear y al aprobar', () => {
    // En `aprobar` son dos llamadas SEGUIDAS: el desembolso la pasaba y el
    // abono no. En `prestamos/route.js` es el mismo caso al crear.
    const n = exigeRuta('Abono previo préstamo en curso',
      /rutaId: (rutaIdCapital|cliente\?\.rutaId \|\| null)/)
    expect(n, 'esperaba las dos: crear y aprobar').toBe(2)
  })

  it('y la carga masiva, que importaba a una ruta sin descontarle nada', () => {
    const n = exigeRuta('(carga masiva) - ${grupo.cliente.nombre}', /rutaId: rutaFinal \|\| null/)
    expect(n, 'esperaba el desembolso y el abono previo').toBe(2)
  })
})
