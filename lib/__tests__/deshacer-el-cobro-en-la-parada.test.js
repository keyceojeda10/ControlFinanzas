// lib/__tests__/deshacer-el-cobro-en-la-parada.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Desde el administrador fui a eliminar un abono, pero no me da la opción. La
//  vez pasada, ahí donde se coloca el abono, ahí aparecía un potecito, uno le
//  daba ahí y el abono lo eliminaba el administrador.» — PRESTA MIL, 20 ago.
//
// ⚠ NO ERA UN PERMISO PERDIDO, Y ESO ES LO QUE ESTA PRUEBA FIJA.
//
// El botón de la ficha del préstamo existe y le funciona: su propio registro de
// actividad tiene 15 pagos anulados por él, el último a las 15:22 del mismo día
// que escribió. Lo que él recordaba es OTRO control: el aviso flotante de
// «Deshacer» que sale al cobrar, y que vive `setTimeout(…, 10000)`. A los diez
// segundos —o al cambiar de pantalla— se va.
//
// Así que el hueco real es de sitio, no de permiso: quien mete mal una cifra se
// da cuenta al rato, no en diez segundos, y para entonces la única salida es
// abrir la ficha del préstamo del cliente.
//
// El arreglo pone el botón EN LA PARADA YA COBRADA, en el renglón que suelta
// «Cobrar», y por eso vale para las dos pantallas a la vez: `/cobros-hoy` y
// `/rutas/[id]` comparten `ParadaDeCobro` desde ago 2026.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')

describe('el pago que se puede deshacer viaja desde el API', () => {
  it('⚠ los DOS APIs de cobro devuelven el último pago del día', () => {
    // Uno solo no basta: son dos pantallas y la tarjeta es la misma.
    for (const ruta of ['app/api/cobros-hoy/route.js', 'app/api/rutas/[id]/route.js']) {
      expect(leer(ruta), `${ruta} no devuelve pagoHoyId`).toMatch(/pagoHoyId:/)
    }
  })

  it('es el ÚLTIMO, no el primero ni todos', () => {
    /* Con varios abonos en el día, «deshacer» solo es predecible si borra lo
       último que se metió. En rutas los pagos vienen `orderBy: desc`. */
    const rutas = leer('app/api/rutas/[id]/route.js')
    expect(rutas).toMatch(/const ultimoPagoHoyId = cobrosReales\[0\]\?\.id \?\? null/)
    expect(rutas).toMatch(/orderBy: \{ fechaPago: 'desc' \}/)
  })

  it('un recargo o un descuento no son un cobro que deshacer', () => {
    // `cobrosReales` ya los excluye; si alguien lo cambia, esto lo caza.
    expect(leer('app/api/rutas/[id]/route.js'))
      .toMatch(/const cobrosReales = pagosHoy\.filter\(pg => !\['recargo', 'descuento'\]\.includes\(pg\.tipo\)\)/)
  })

  it('el adaptador lo pasa a la fila', () => {
    expect(leer('lib/adaptadores/cobros.js')).toMatch(/pagoHoyId: c\.pagoHoyId \?\? null/)
    expect(leer('lib/adaptadores/ruta.js')).toMatch(/pagoHoyId: c\.pagoHoyId \?\? null/)
  })
})

describe('⚠ el botón está en la parada cobrada', () => {
  const src = leer('components/cf/ParadaDeCobro.jsx')

  it('la tarjeta lo recibe por props', () => {
    expect(src).toMatch(/^\s*onDeshacerCobro,\s*$/m)
  })

  it('sale con solo tener un pago de hoy que deshacer', () => {
    /* Anclado en el JSX, no en la prosa: `indexOf('Deshacer')` a secas cae en
       MIS PROPIOS COMENTARIOS, que citan la frase del cliente. Ya me pasó
       cuatro veces en este repo y la prueba pasa mirando comentarios. */
    const i = src.indexOf('{onDeshacerCobro && (')
    expect(i, 'no encuentro la condición en el JSX').toBeGreaterThan(0)
    const bloque = src.slice(i, i + 1400)
    expect(bloque).toMatch(/onClick=\{onDeshacerCobro\}/)
    expect(bloque, 'perdió el rótulo').toMatch(/Deshacer el cobro/)
  })

  it('⚠ NO se condiciona a `cobrada` — el error más común deja la parada abierta', () => {
    /* Lo cazó el espejo, no el código: registré $1.000 sobre una cuota de
       $220.000 y la parada se quedó PENDIENTE, con su abono dentro, así que el
       botón no salía. Y poner de menos es justo el error más frecuente. */
    expect(src, 'volvió a esconderse en la parada que sigue pendiente')
      .not.toMatch(/\{cobrada && onDeshacerCobro/)
  })

  it('⚠ una parada sin más acciones tampoco se queda sin él', () => {
    /* El bloque entero está detrás de «¿hay alguna acción?». Si no se suma a
       esa condición, el botón desaparece justo en la tarjeta más pelada. */
    expect(src).toMatch(/onLlamar \|\| onWhatsApp \|\| onMapa \|\| onMas \|\| onDeshacerCobro/)
  })

  it('el icono es SVG en línea, no un emoji', () => {
    const i = src.indexOf('{onDeshacerCobro && (')
    expect(src.slice(i, i + 1400)).toMatch(/<svg /)
  })
})

describe('⚠ solo se le ofrece a quien el API deja', () => {
  it('el API deja al owner siempre y al cobrador solo su pago reciente', () => {
    const api = leer('app/api/pagos/[id]/route.js')
    expect(api).toMatch(/if \(rol !== 'owner'\)/)
    expect(api).toMatch(/minutos > 10/)
  })

  it('las dos pantallas lo condicionan a `esOwner`', () => {
    /* Enseñárselo al cobrador sería ofrecerle un 403 la mayoría de las veces:
       su ventana son 10 minutos y la pantalla no sabe cuándo se registró. */
    expect(leer('app/(dashboard)/cobros-hoy/page.jsx'))
      .toMatch(/onDeshacerCobro=\{esOwner/)
    expect(leer('app/(dashboard)/rutas/[id]/page.jsx'))
      .toMatch(/onDeshacerCobro=\{esOwner && fila\.pagoHoyId/)
  })

  it('⚠ borrar plata pide confirmación en las dos', () => {
    for (const p of ['app/(dashboard)/cobros-hoy/page.jsx', 'app/(dashboard)/rutas/[id]/page.jsx']) {
      const src = leer(p)
      expect(src, `${p} borra sin preguntar`).toMatch(/setConfirmDeshacer\(/)
      expect(src).toMatch(/open=\{!!confirmDeshacer\}/)
    }
  })

  it('un DELETE que falla se dice, no se traga', () => {
    /* El `catch {}` mudo del toast viejo era aceptable a 10 segundos; aquí no:
       si el API responde 403 y la pantalla calla, el cobro sigue ahí y el
       dueño cree que lo borró. */
    for (const p of ['app/(dashboard)/cobros-hoy/page.jsx', 'app/(dashboard)/rutas/[id]/page.jsx']) {
      expect(leer(p), `${p} no mira el status`).toMatch(/No se pudo deshacer el cobro/)
    }
  })
})

describe('⚠ la barra de «Empezar ruta» tapaba el último control', () => {
  it('la lista reserva su hueco cuando la barra existe', () => {
    /* Medido en el espejo a 412×900 con el desplazamiento al tope: la barra
       arrancaba en y=820 y el último botón de la lista en y=821, así que
       `elementFromPoint` devolvía la barra. No es un fallo del botón nuevo:
       tapaba igual el «Cobrar» de la última parada.
       Va condicionado, o la ruta terminada gana 76px de blanco de vuelta. */
    const src = leer('components/pantallas/CobrarHoy.jsx')
    expect(src).toMatch(/paddingBottom: pendientes > 0 \? 76 : undefined/)
  })
})
