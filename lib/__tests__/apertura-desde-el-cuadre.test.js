import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── «CON LO QUE SALIÓ»: LA HISTORIA COMPLETA, PORQUE ME EQUIVOQUÉ EN MEDIO ──
//
// 6 AGO — reportado con vídeo: «cuadré todos los saldos con la base con la que
// deben salir los muchachos en la mañana… hice un retiro en la ruta 6 y se me
// cambiaron TODAS las bases». Solo la ruta 1 quedó bien.
//
// El retiro no fue la causa. Medí que las 9 cifras de sus capturas coincidían
// AL PESO con `CierreCaja.efectivoRecibido` de la noche anterior, así que puse
// ese campo como «con lo que salió».
//
// 7 AGO — reportado: «me presenta problemas la lista 3 y la lista 4; el saldo
// correcto de la lista 4 serían 68 y en caja aparecen otros números».
//
//     RUTA #3   capital 1.305.000   la pantalla decía    74.000
//     RUTA #4   capital    68.000   la pantalla decía 1.068.000
//
// ⚠ COINCIDÍAN POR CASUALIDAD. Midiendo las DIEZ rutas se ve qué es de verdad
// `efectivoRecibido`: en OCHO vale exactamente lo mismo que `recaudadoSistema`,
// porque el dueño usa el botón de «confirmar los que entregaron lo mismo que
// dice el sistema», y ese botón graba la cifra del sistema tal cual.
//
//     ruta   capital   contó6ago   recaudSist   difRecibido
//     #3    1.305.000     74.000    1.652.000    −1.578.000   ← faltante real
//     #4       68.000  1.068.000    1.068.000             0
//     #5       83.000     83.000       83.000             0   ← coincide
//     #8      122.000    122.000      122.000             0   ← coincide
//     #9       74.000     74.000       74.000             0   ← coincide
//
// O SEA QUE ESE CAMPO NO ES UNA BASE: es LO QUE SE RECAUDÓ AYER. Ponerlo como
// «con lo que salió» le enseñaba al cobrador el recaudo del día anterior como
// si fuera la plata con la que arranca. Coincide cuando la ruta cierra el día
// con lo mismo que cobró, y se separa cuando no.
//
// Y no eran «solo dos rutas rotas», que fue lo que el dueño preguntó: SIETE de
// las diez estaban mal. Cinco por diez o treinta mil pesos, que no se notan.
//
// DECISIÓN (7 ago, del dueño): la base sale del LIBRO. Es reproducible —sale de
// sumar los movimientos— y no la puede torcer un número mal tecleado de noche.

const api = readFileSync(
  resolve(process.cwd(), 'app/api/caja/cobrador/[id]/route.js'), 'utf8')
const cuadre = readFileSync(
  resolve(process.cwd(), 'components/caja/CuadreDia.jsx'), 'utf8')

describe('la base del día sale del libro', () => {
  it('NO del efectivo contado en el cuadre', () => {
    expect(api).toMatch(/const saldoAperturaTotal = saldoAperturaDerivado/)
    expect(api, 'volvió al campo del cuadre; ver la nota de arriba')
      .not.toMatch(/saldoAperturaTotal = cuadreAnterior\?\.efectivoRecibido/)
  })

  it('es el saldoCapital menos lo que se movió hoy', () => {
    /* Comprobado contra producción el 7 ago: recalculado sumando las 1.646 y
       1.475 filas del libro de las rutas 3 y 4, da 1.305.000 y 68.000 exactos
       — las dos cifras que el dueño dice que son las buenas. */
    expect(api).toMatch(/const saldoAperturaDerivado = rutas\.reduce/)
    expect(api).toMatch(/\(r\.saldoCapital \|\| 0\) - delta/)
  })
})

describe('lo contado anoche no se pierde', () => {
  it('viaja aparte, y con lo que se movió después', () => {
    /* Son dos preguntas distintas y el error fue llamarlas igual.

       ⚠ Y LA CIFRA SE LLAMA POR LO QUE ES: `movidoDespuesDelCuadre`, no «la
       diferencia». Lo que pasó en las dos rutas que el dueño reportó no fue un
       descuadre: fue plata moviéndose después de la foto —a la #3 le repusieron
       la base (+1.231.000 a las 02:45) y a la #4 le hicieron un retiro
       (−1.000.000 a las 03:46)—. Llamarlo «diferencia» le habría hecho buscar
       un faltante que no existe; yo mismo se lo dije así una vez. */
    expect(api).toMatch(/efectivoContadoAnoche/)
    expect(api).toMatch(/movidoDespuesDelCuadre/)
    expect(api).toMatch(/saldoAperturaTotal - efectivoContadoAnoche/)
  })

  it('y la pantalla lo explica en una línea', () => {
    // «Anoche contó $74.000 · después entraron $1.231.000». Sin esto, las dos
    // cifras vuelven a parecer un descuadre y hay que venir a preguntar.
    const ui = readFileSync(
      resolve(process.cwd(), 'components/caja/CajaCobradorDetalle.jsx'), 'utf8')
    expect(ui).toMatch(/function notaDeLaApertura/)
    expect(ui).toMatch(/Anoche contó/)
    expect(ui).toMatch(/'entraron' : 'salieron'/)
    expect(ui).toMatch(/detalle=\{notaDeLaApertura\(cr\)\}/)
  })

  it('la explicación del «?» dice de dónde sale, y de dónde no', () => {
    // Entre el 6 y el 7 de agosto la pantalla contradecia a su propia
    // explicacion: el texto decia «sale del libro» y el codigo leia el cuadre.
    const defs = readFileSync(resolve(process.cwd(), 'lib/dinero/definiciones.js'), 'utf8')
    expect(defs).toMatch(/NO es lo que se contó al cuadrar anoche/)
  })

  it('⚠ y SOLO de los dos días anteriores', () => {
    /* Sin este tope se rescataba el cierre de hace semanas del cobrador que no
       se cuadra nunca. Medido: a CARLOS #10 —sin un cierre confirmado en once
       días— le salían $11.583.000. Un dato viejo presentado como el de esta
       mañana es peor que no tenerlo. Dos días y no uno, para que quien cuadra
       el sábado y descansa el domingo no pierda la referencia el lunes.

       Sigue importando aunque ya no sea la base: enseñar «anoche contó X» con
       una X de hace tres semanas es la misma mentira. */
    expect(api, 'volvió a buscar sin límite de fecha')
      .toMatch(/gte: new Date\(inicio\.getTime\(\) - 2 \* 24 \* 3600 \* 1000\)/)
    expect(api).toMatch(/confirmadoEn: \{ not: null \}/)
  })
})

describe('por qué ese campo no servía de base', () => {
  it('el confirmado en lote graba la cifra DEL SISTEMA', () => {
    /* Esta es la prueba de que `efectivoRecibido` es el recaudo del día y no
       una base: el propio componente lo hace y su comentario lo dice —«por
       construccion todos»—. Es lo que explica que en 8 de 10 rutas valga
       exactamente `recaudadoSistema`. */
    expect(cuadre).toMatch(/efectivoRecibido: f\.recaudadoSistema/)
  })
})

describe('el desglose por ruta es otra pregunta y no se toca', () => {
  it('sigue mostrando el capital de la ruta', () => {
    /* El cuadre es por COBRADOR y no sabe repartir entre las rutas de quien
       lleva varias, así que esta fila se queda como estaba. Ahora además
       coincide con la base, que es lo que el dueño esperaba desde el principio. */
    expect(api).toMatch(/saldoApertura: Math\.round\(\(r\.saldoCapital \|\| 0\) - \(deltaPorRuta\.get\(r\.id\) \|\| 0\)\)/)
  })
})
