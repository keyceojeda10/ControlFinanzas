// lib/__tests__/interes-compra-tiempo.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Yo tengo un préstamo de 500 mil y son cuatro cuotas de 175. Pero tengo
//  clientes que en la quincena no me pueden dar la cuota, pero me dan el
//  interés: por ese interés les cobro 50 mil. No he encontrado el sistema que
//  me dé la opción de solamente recibir ese interés y que se aplace la próxima
//  cuota para dentro de 15 días. Muchos sistemas me reciben el interés pero me
//  lo DESCUENTAN de la cuota, y me dicen que la próxima vez ya solo tiene que
//  dar 125. Eso es lo que yo no busco.»
//   — un prestamista que llevaba años en Excel, 16 ago 2026.
//
// La primera mitad ya funcionaba y se comprobó contra el espejo con sus cifras:
// la cuota siguió en $175.000 y el saldo en $700.000. Lo que faltaba era poder
// aplazar en el mismo gesto, sin irse a otra pantalla.
//
// Lo que estas pruebas cuidan:
//
//   1. Que el salto de periodo vuelva a ser «+30 días» en mensual. Es la quinta
//      función de la app que calcula una fecha de cobro; la última vez que
//      alguien sumó días a mano, un préstamo del día 1 acabó cobrándose el 27
//      de febrero.
//   2. Que el aplazo se ofrezca donde el interés COMPRA TIEMPO y en ningún otro
//      sitio. Con tabla de amortización el interés ya estaba pactado.
//   3. Que las dos cosas viajen en la MISMA petición. En dos, la segunda podía
//      fallar y dejar el interés cobrado sin el aplazo.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { siguientePeriodo } from '@/lib/dinero/calendario'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const d = (s) => new Date(`${s}T05:00:00.000Z`)
const d10 = (x) => x.toISOString().slice(0, 10)

describe('el salto de un periodo', () => {
  it('quincenal son 15 días', () => {
    expect(d10(siguientePeriodo(d('2026-08-15'), 'quincenal'))).toBe('2026-08-30')
  })

  it('semanal son 7 y diario es 1', () => {
    expect(d10(siguientePeriodo(d('2026-08-15'), 'semanal'))).toBe('2026-08-22')
    expect(d10(siguientePeriodo(d('2026-08-15'), 'diario'))).toBe('2026-08-16')
  })

  it('⚠ mensual es el mismo día del mes, no +30 días', () => {
    expect(d10(siguientePeriodo(d('2026-08-01'), 'mensual'))).toBe('2026-09-01')
    expect(d10(siguientePeriodo(d('2026-01-15'), 'mensual'))).toBe('2026-02-15')
  })

  it('⚠ el 31 se recorta al último día del mes corto', () => {
    expect(d10(siguientePeriodo(d('2027-01-31'), 'mensual'))).toBe('2027-02-28')
  })

  it('respeta el día de corte cuando el préstamo tiene uno', () => {
    expect(d10(siguientePeriodo(d('2026-08-05'), 'mensual', 5))).toBe('2026-09-05')
  })

  it('una fecha que no se entiende devuelve null, no una fecha inventada', () => {
    expect(siguientePeriodo('no soy una fecha', 'mensual')).toBeNull()
  })
})

describe('⚠ el aplazo viaja con el pago, no aparte', () => {
  const api = leer('app/api/prestamos/[id]/pagos/route.js')

  it('el endpoint del pago acepta la opción', () => {
    expect(api).toMatch(/aplazarUnPeriodo/)
  })

  it('solo aplaza donde el interés compra tiempo', () => {
    const bloque = api.slice(api.indexOf('if (aplazarUnPeriodo'))
    expect(bloque).toMatch(/tipo === 'intereses'/)
    expect(bloque, 'aplazaría también con tabla de amortización')
      .toMatch(/elInteresSubeLaDeuda\(prestamoFinal\)/)
  })

  it('usa el calendario compartido y no suma días a mano', () => {
    const bloque = api.slice(api.indexOf('if (aplazarUnPeriodo'), api.indexOf('const tipoLabel'))
    expect(bloque).toMatch(/siguientePeriodo\(/)
    expect(bloque, 'volvió a calcular la fecha por su cuenta').not.toMatch(/setUTCDate|86400000/)
  })

  it('la respuesta devuelve la fecha ya aplazada', () => {
    expect(api).toMatch(/proximoCobro:\s*proximoCobroFinal/)
  })
})

describe('la pantalla lo ofrece donde toca', () => {
  const ui = leer('components/prestamos/RegistrarPago.jsx')

  it('solo con interés que sube la deuda', () => {
    expect(ui).toMatch(/const puedeAplazar = tipo === 'intereses' && subeLaDeuda/)
  })

  it('lo manda en el mismo cuerpo del pago', () => {
    expect(ui).toMatch(/puedeAplazar && aplazar \? \{ aplazarUnPeriodo: true \}/)
  })

  it('⚠ enseña la fecha concreta, no «se aplaza»', () => {
    /* Un interruptor que no dice a qué día mueve el cobro obliga a guardar para
       enterarse, que es justo lo que este cambio viene a quitar. */
    expect(ui).toMatch(/fechaAplazada/)
    expect(ui).toMatch(/formatFechaCobroRelativa\(fechaAplazada\)/)
  })

  it('⚠ al pasar a «Interés» el monto NO hereda la cuota', () => {
    /* La hoja llega con la cuota puesta ($175.000). Heredada en «Solo interés»,
       el bloque decía «Tu ganancia sube $175.000» y un toque de más subía la
       deuda esa cantidad — y ahora además aplazaría el cobro. Lo vi en la
       captura, no leyendo el código.
 
       ⚠ 17 ago: esto era UNA línea —`if (… && subeLaDeuda) setMonto('')`— y esta
       prueba la fijaba tal cual. Ahora son dos caminos, porque en los modos CON
       tabla dejar la casilla quieta era igual de malo: se quedaba la cuota
       ($266.667) y el servidor solo aceptaba el interés ($100.000). Se prueba la
       intención —que la cuota no se hereda— y no el renglón. */
    const bloque = ui.slice(ui.indexOf('onAplicacion={'), ui.indexOf('onAplicacion={') + 2600)
    expect(bloque).toMatch(/a\.id === 'intereses'/)
    // Sin tabla: se vacía, porque el monto lo pacta el prestamista.
    expect(bloque).toMatch(/if \(subeLaDeuda\) fijarMonto\(''\)/)
    // Con tabla: se propone lo cobrable, que ahí sí lo dicen las filas.
    expect(bloque).toMatch(/else fijarMonto\(String\(Math\.round\(interesCobrableAhora/)
  })

  it('y dice que la cuota NO cambia de monto', () => {
    // Es la objeción exacta del prestamista: «me dicen que ya solo tiene que dar 125».
    expect(ui).toMatch(/No cambia de monto/)
  })
})
