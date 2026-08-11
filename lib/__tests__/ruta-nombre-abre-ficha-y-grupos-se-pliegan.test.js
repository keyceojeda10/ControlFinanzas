// lib/__tests__/ruta-nombre-abre-ficha-y-grupos-se-pliegan.test.js
//
// ══ DOS COSAS QUE EL DUEÑO PIDIÓ MIRANDO UNA RUTA ══════════════════════════
//
// 1. «si hay un usuario que está en modo que hay que prestarle, esa tarjeta
//     queda totalmente muerta. Solamente sirve el botón de prestarle, pero si
//     yo quiero ver la información detallada de ese cliente, no le puedo dar al
//     nombre e ir a ver a ese cliente detalladamente. […] No lo quisiera como
//     en toda la tarjeta o agregar un botón adicional, sino si le pico al
//     nombre o al perfil.»
//
//    Y «muerta» es literal, no una impresión: `onClick` va a `abrirPagoRapido`,
//    que empieza por `if (activos.length === 0) return`. La tarjeta compacta es
//    exactamente la de quien NO tiene préstamo vivo.
//
// 2. «cuando uno está en la vista de agrupar, las secciones no se pueden
//     expandir o colapsar. Si yo tengo 100 clientes por cobrar hoy y quiero ver
//     a los que están para prestarle de nuevo, tengo que desplazarme hacia
//     abajo todos esos 100 clientes.»
//
//    Agrupar separaba pero no acercaba: la sección más larga es siempre la
//    primera, así que las de abajo quedaban a cien tarjetas de distancia.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const tarjeta   = leer('components/cf/ParadaDeCobro.jsx')
const rutaPag   = leer('app/(dashboard)/rutas/[id]/page.jsx')
const cobrarHoy = leer('components/pantallas/CobrarHoy.jsx')
const cobrosPag = leer('app/(dashboard)/cobros-hoy/page.jsx')

describe('el nombre y la foto llevan a la ficha del cliente', () => {
  it('el destino existe y no se traga el toque de la tarjeta', () => {
    /* `stopPropagation` no es cosmético: la tarjeta entera ya es un botón que
       abre el cobro. Sin él, tocar el nombre haría las dos cosas — abriría el
       cobro Y cambiaría de pantalla. */
    expect(tarjeta).toMatch(/onAbrirCliente/)
    const i = tarjeta.indexOf('const irAFicha')
    expect(i, 'se fue el manejador de abrir la ficha').toBeGreaterThan(0)
    expect(tarjeta.slice(i, i + 260)).toMatch(/stopPropagation/)
  })

  it('lo llevan el nombre y la foto, no un botón nuevo', () => {
    /* El nombre y el avatar, y no otro sitio: un botón más en una tarjeta que
       ya tiene cinco controles es lo que se pidió NO hacer. */
    expect(tarjeta, 'el nombre dejó de abrir la ficha').toMatch(/\{\.\.\.identidad\}/)
    expect(tarjeta, 'la foto dejó de abrir la ficha').toMatch(/\{\.\.\.identidadMuda\}/)
  })

  it('⚠ la foto no añade una segunda parada del tabulador', () => {
    /* Los dos toques llevan al mismo sitio; declararlo dos veces pone DOS
       paradas por cliente, y la ruta medida tiene 203. El nombre, que sí dice a
       quién se va, es el que se queda con el papel. */
    const i = tarjeta.indexOf('const identidadMuda')
    expect(i).toBeGreaterThan(0)
    const bloque = tarjeta.slice(i, i + 120)
    expect(bloque).not.toMatch(/tabIndex/)
    expect(bloque).not.toMatch(/role:/)
  })

  it('⚠ la tarjeta compacta deja de estar muerta', () => {
    /* La excepción, y con motivo: ahí no hay cobro que abrir —por definición no
       tiene préstamo vivo— así que el toque se cae por el `return` de
       `abrirPagoRapido` y no pasa nada en toda la superficie. Una tarjeta muda
       de lado a lado es peor que una con un solo destino. */
    const i = tarjeta.indexOf('if (compacta)')
    expect(i).toBeGreaterThan(0)
    expect(tarjeta.slice(i, i + 1400)).toMatch(/onClick=\{irAFicha \?\? onClick\}/)
  })

  it('se ve que ese nombre lleva a algún sitio', () => {
    /* Sin marca el destino existe pero nadie lo prueba: la tarjeta ya se puede
       tocar entera, así que nada distinguía el nombre del resto. */
    expect(tarjeta).toMatch(/function FlechaFicha/)
    expect([...tarjeta.matchAll(/<FlechaFicha/g)].length,
      'la flecha solo está en una de las dos tarjetas').toBeGreaterThanOrEqual(2)
  })

  it('⚠ está en las DOS pantallas que usan esta tarjeta', () => {
    /* Es LA MISMA tarjeta en `/rutas/[id]` y en `/cobros-hoy`. Cablearla en una
       y no en la otra es exactamente cómo se llegó al comprobante arreglado por
       un camino y roto por el otro, reportado dos días seguidos. */
    expect(rutaPag, 'la ruta no pasa el destino').toMatch(/onAbrirCliente=\{/)
    expect(cobrarHoy, 'la pantalla de cobros de hoy no lo reenvía').toMatch(/onAbrirCliente=\{/)
    expect(cobrosPag, 'nadie le dice a dónde ir en cobros de hoy').toMatch(/onAbrirCliente=\{/)
    // Y a la FICHA del cliente, no al cobro: `onMas` y `onClick` ya van al cobro
    // por dos caminos distintos; lo que faltaba era ver a la persona.
    expect(rutaPag).toMatch(/onAbrirCliente=\{\(\) => router\.push\(`\/clientes\/\$\{fila\.id\}`\)\}/)
  })
})

describe('las secciones de la vista agrupada se pliegan', () => {
  it('el rótulo es el plegador', () => {
    /* Y no un botón al lado: el rótulo es la única pieza fija de la sección, la
       que se sigue viendo con cien tarjetas debajo. */
    const i = rutaPag.indexOf('const Rotulo =')
    expect(i).toBeGreaterThan(0)
    const bloque = rutaPag.slice(i, i + 1600)
    expect(bloque, 'el rótulo volvió a ser un <div> sin acción').toMatch(/<button/)
    expect(bloque).toMatch(/onClick=\{\(\) => plegarGrupo\(clave\)\}/)
    expect(bloque, 'sin aria-expanded no se sabe si está abierta').toMatch(/aria-expanded/)
    // La cuenta se queda puesta con la sección cerrada: plegada es lo único que
    // dice cuánto hay dentro.
    expect(bloque).toMatch(/\{cuantos\}/)
  })

  it('cerrada NO se pinta', () => {
    /* Esconderla con CSS cuesta el mismo trabajo de pintado que tenerla a la
       vista, y el teléfono en el que se cobra es el que lo paga: la ruta más
       grande medida tiene 206 clientes. */
    const i = rutaPag.indexOf('gruposDeRuta(filas).map')
    expect(i).toBeGreaterThan(0)
    const bloque = rutaPag.slice(i, i + 1200)
    expect(bloque).toMatch(/const cerrado = gruposCerrados\.has\(g\.clave\)/)
    expect(bloque, 'las tarjetas se pintan aunque la sección esté cerrada').toMatch(/\{!cerrado && \(/)
  })

  it('⚠ se recuerda QUÉ ESTÁ CERRADO, no qué está abierto', () => {
    /* Guardar los abiertos haría que un grupo nuevo —o uno que hoy está vacío y
       mañana no— saliera plegado sin que nadie lo plegara. Por la mañana la
       ruta se abre entera, que es lo que el cobrador espera. */
    const i = rutaPag.indexOf('const [gruposCerrados')
    expect(i).toBeGreaterThan(0)
    const bloque = rutaPag.slice(i, i + 700)
    expect(bloque).toMatch(/localStorage\.getItem\('cf-ruta-grupos-cerrados'\)/)
    expect(bloque, 'sin valor guardado tiene que arrancar sin nada cerrado').toMatch(/\?\? '\[\]'/)
    expect(bloque).toMatch(/localStorage\.setItem\('cf-ruta-grupos-cerrados'/)
  })
})
