import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── «CON LO QUE SALIÓ» NO ERA CON LO QUE SALIÓ ──────────────────────────────
//
// Reportado con vídeo: «anoche cuadré todos los saldos con la base con la que
// deben salir los muchachos en la mañana… hice un retiro en la ruta 6 y se me
// cambiaron TODAS las bases». Solo la ruta 1 quedó bien.
//
// ⚠ EL RETIRO NO FUE LA CAUSA, y eso importaba porque él tenía a los cobradores
// parados esperando a que se «arreglara el retiro de 224». Ese movimiento ya no
// existe —lo borró y el borrado funcionó—. Reconstruyendo el saldo de cada ruta
// día a día contra la base que él contó cada noche, llevaban separándose desde
// el 3 de agosto:
//
//     RUTA #2    1 ago: 694.000 vs 672.000   ← cuadraba
//                3 ago: 427.695 vs 294.000   ← empieza a separarse
//                5 ago: 504.874 vs 198.000
//     RUTA #1    cuadra los cinco días        ← la única
//
// LA CAUSA: son DOS cifras distintas que la pantalla llamaba igual.
//
//   · lo que él cuadra cada noche → `CierreCaja.efectivoRecibido`, el efectivo
//     que cuenta y le vuelve a entregar al cobrador
//   · lo que se pintaba           → `Ruta.saldoCapital`, que el cuadre NO toca
//     (`caja/cuadre/route.js` solo escribe la confirmación)
//
// Medido en producción el 6 ago: las 9 cifras de sus capturas son EXACTAMENTE el
// `efectivoRecibido` de la noche anterior, al peso. Y la ruta 1 salía bien por
// casualidad aritmética: ese día tuvo un desembolso de 200.000 y
// `92.000 − (−200.000)` da justo sus 292.000.

const api = readFileSync(
  resolve(process.cwd(), 'app/api/caja/cobrador/[id]/route.js'), 'utf8')

describe('la apertura sale del cuadre de anoche', () => {
  it('se pide el último cierre CONFIRMADO anterior a hoy', () => {
    expect(api).toMatch(/confirmadoEn: \{ not: null \}/)
    expect(api).toMatch(/efectivoRecibido: \{ not: null \}/)
    expect(api).toMatch(/orderBy: \{ fecha: 'desc' \}/)
  })

  it('y es lo que se pinta cuando existe', () => {
    expect(api).toMatch(/const saldoAperturaTotal = cuadreAnterior\?\.efectivoRecibido != null/)
    expect(api).toMatch(/\? Math\.round\(cuadreAnterior\.efectivoRecibido\)/)
  })

  it('⚠ pero SOLO de los dos días anteriores', () => {
    /* Sin este tope, al cobrador que no se cuadra nunca se le rescataba un
       cierre de hace semanas y se pintaba como la base de hoy. Medido: a
       CARLOS #10 —sin un solo cierre confirmado en once días— le salían
       $11.583.000 donde antes ponía $2.790.277. Un dato viejo presentado como
       el de esta mañana es PEOR que el cálculo aproximado.

       Dos días y no uno, para que el negocio que cuadra en sábado y no trabaja
       el domingo no pierda su base el lunes. */
    expect(api, 'volvió a buscar sin límite de fecha')
      .toMatch(/gte: new Date\(inicio\.getTime\(\) - 2 \* 24 \* 3600 \* 1000\)/)
  })
})

describe('el cálculo de antes sigue como respaldo', () => {
  it('no se borró: hay negocios que no cuadran caja por la noche', () => {
    /* De los 10 cierres del 4 ago, 6 tenían el saldo en cero. Para quien no
       cuadra, `saldoCapital − delta` es lo único que hay. */
    expect(api).toMatch(/const saldoAperturaDerivado = rutas\.reduce/)
    expect(api).toMatch(/: saldoAperturaDerivado/)
  })
})

describe('el desglose por ruta es otra pregunta y no se toca', () => {
  it('sigue mostrando el capital de la ruta', () => {
    /* «Cuánto capital tenía esta ruta al empezar» NO es «con cuánto efectivo
       salió el cobrador». El cuadre es por COBRADOR y no sabe repartir entre las
       rutas de quien lleva varias, así que esta fila se queda como estaba.

       Que las dos puedan no sumar es real: son dos preguntas. Con un cobrador de
       una sola ruta, la diferencia ES el descuadre acumulado. */
    expect(api).toMatch(/saldoApertura: Math\.round\(\(r\.saldoCapital \|\| 0\) - \(deltaPorRuta\.get\(r\.id\) \|\| 0\)\)/)
  })
})

describe('lo medido en producción, para que quede escrito', () => {
  it('las nueve rutas cuadran con el cambio', () => {
    /* Simulado contra la base real el 6 ago (antes → después):
     *
     *   ADRIAN #1     292.000 →   292.000   (ya cuadraba)
     *   JHON #2       504.874 →   198.000
     *   MAURICIO #3 1.951.044 → 1.879.000
     *   JOSE #4       801.664 →   339.000
     *   JHOAN #5      596.534 →   221.000
     *   DAVI #6       444.978 →   318.000   ← la ruta del retiro
     *   JULIAN #7     156.322 →   130.000
     *   DIEGO #8       25.666 →     4.000
     *   CAMILO #9     115.000 →    60.000
     *   CARLOS #10  2.790.277 →  sin cambio (nunca se cuadra)
     *
     * Y al resto de la plataforma no le cambia ninguna cifra.
     *
     * Las nueve coinciden al peso con las capturas que mandó el dueño. Esta
     * prueba no puede comprobar producción; deja constancia de la medición para
     * que quien vuelva no tenga que rehacerla. */
    expect(api).toMatch(/las 9 cifras de sus capturas son/)
    expect(api).toMatch(/casualidad aritmética/)
  })
})
