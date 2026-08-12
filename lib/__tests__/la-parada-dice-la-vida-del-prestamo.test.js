// lib/__tests__/la-parada-dice-la-vida-del-prestamo.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El cliente que camina la ruta —el que más la usa— pidió tres cosas sobre la
// tarjeta de la parada, y las tres con su motivo:
//
//   «tiene que poderse ver fácilmente la fecha de inicio del préstamo y la
//    fecha de finalización, para no tener que entrar y salir de la ficha»
//   «hay veces que el cobrador llega y el usuario le pregunta que cuánto ya ha
//    pagado; ese dato debe estar claro allí»
//   «es un dato redundante tener la ubicación escrita y la ubicación»
//
// Y el dueño puso la condición que manda sobre las tres: «que la tarjeta quede
// hermosa y que se siga entendiendo de maravilla».

import { describe, it, expect } from 'vitest'
import { filaDeCobro, fechaCortaDe } from '../adaptadores/cobros.js'

const BASE = {
  id: 'c1', nombre: 'CARLOS MENDOZA', direccion: 'AV. 9 # 19 39',
  diasMora: 3, saldoTotal: 92000,
  prestamosActivos: [{
    id: 'p1', totalAPagar: 120000, totalPagado: 28000, saldoPendiente: 92000,
    fechaInicio: '2026-06-11T05:00:00.000Z', fechaFin: '2026-09-23T05:00:00.000Z',
  }],
}
const fila = (extra = {}) => filaDeCobro({ ...BASE, ...extra }, { pais: 'co' })

describe('cuánto lleva pagado', () => {
  it('sale en PESOS, no solo el porcentaje', () => {
    /* La barra del pie ya dibujaba esto —su comentario dice «dice CUÁNTO LLEVA
       PAGADO»— pero va `aria-hidden` y sin un número: el dato estaba dibujado y
       no estaba dicho. */
    expect(fila().vida.pagado).toBe('$28.000')
    expect(fila().vida.total).toBe('$120.000')
  })

  it('sin préstamo no inventa una cifra', () => {
    expect(fila({ prestamosActivos: [] }).vida).toBeNull()
  })

  it('un préstamo sin total no da «pagado $0 de $0»', () => {
    expect(fila({ prestamosActivos: [{ id: 'p', totalAPagar: 0, totalPagado: 0 }] }).vida).toBeNull()
  })
})

describe('el tramo de fechas', () => {
  it('«11 jun → 23 sept»', () => {
    /* ⚠ «sept», con T. Yo escribí «sep» de memoria y la prueba me corrigió:
       es el único mes que el ICU de es-CO abrevia con cuatro letras
       (ene feb mar abr may jun jul ago **sept** oct nov dic). Justo la lección
       que dejó el «de»: comprobar la salida REAL, no la que uno recuerda. */
    expect(fila().vida.tramo).toBe('11 jun → 23 sept')
  })

  it('⚠ NUNCA dice «termina el»', () => {
    /* `fechaFin` es el plazo PACTADO, no el final de verdad: el préstamo se
       cobra hasta saldar y un recargo sube la deuda sin mover esa fecha.
       Prometer un final en la puerta es prometer lo que el sistema no cumple. */
    expect(fila().vida.tramo).not.toMatch(/termina|finaliza|hasta el/i)
  })

  it('sin fecha de fin da media verdad entera, no una fecha inventada', () => {
    const sinFin = fila({ prestamosActivos: [{ ...BASE.prestamosActivos[0], fechaFin: null }] })
    expect(sinFin.vida.tramo).toBe('desde 11 jun')
  })
})

describe('⚠ con varios préstamos NO se resume', () => {
  /* «Del 11 jun al 23 sep» sería la fecha de cuál, y el total pagado mezclaría
     dos calendarios. Ahí manda el plegable, que los separa uno por uno. */
  const dos = fila({
    prestamosActivos: [
      BASE.prestamosActivos[0],
      { id: 'p2', totalAPagar: 500000, totalPagado: 100000, saldoPendiente: 400000,
        fechaInicio: '2026-07-01T05:00:00.000Z', fechaFin: '2026-12-01T05:00:00.000Z' },
    ],
  })

  it('la línea de abajo se calla', () => {
    expect(dos.vida).toBeNull()
  })

  it('pero cada préstamo del plegable trae LO SUYO', () => {
    expect(dos.prestamos).toHaveLength(2)
    expect(dos.prestamos[0].pagado).toBe('$28.000')
    expect(dos.prestamos[0].tramo).toBe('11 jun → 23 sept')
    expect(dos.prestamos[1].pagado).toBe('$100.000')
    expect(dos.prestamos[1].tramo).toBe('1 jul → 1 dic')
  })

  it('un clavo no cuenta como préstamo vivo para la línea', () => {
    const conClavo = fila({
      prestamosActivos: [BASE.prestamosActivos[0], { id: 'x', esClavo: true, totalAPagar: 9, totalPagado: 0 }],
    })
    expect(conClavo.vida).not.toBeNull()
    expect(conClavo.vida.pagado).toBe('$28.000')
  })
})

describe('la dirección escrita, solo cuando no hay punto en el mapa', () => {
  it('con el punto fijado, la dirección se calla', () => {
    expect(fila({ latitud: 10.4, longitud: -75.5 }).donde).toBeNull()
  })

  it('⚠ SIN punto, la dirección se queda: es lo único que lleva a la puerta', () => {
    expect(fila().donde).toBe('AV. 9 # 19 39')
    expect(fila({ latitud: 10.4, longitud: null }).donde).toBe('AV. 9 # 19 39')
    expect(fila({ latitud: null, longitud: -75.5 }).donde).toBe('AV. 9 # 19 39')
  })

  it('`referencia` cuenta igual que `direccion`', () => {
    const soloRef = fila({ direccion: null, referencia: 'Frente a la panadería' })
    expect(soloRef.donde).toBe('Frente a la panadería')
    expect(fila({ direccion: null, referencia: 'Frente a la panadería', latitud: 1, longitud: 2 }).donde).toBeNull()
  })
})

describe('⚠ el «de» que mete el ICU nuevo', () => {
  /* `month: 'short'` pasó a devolver «24 de jul» en vez de «24 jul»: son ~12px
     de más en una tira de cuatro columnas de 74px. Se corrigió en
     `adaptadores/prestamos.js` y en `adaptadores/clientes.js`; ESTA era la
     tercera copia y se había quedado — se veía en la captura de la pantalla,
     «ÚLT. PAGO 24 de jul». */
  it('la fecha corta no lleva «de»', () => {
    expect(fechaCortaDe('2026-07-24T05:00:00.000Z')).toBe('24 jul')
  })

  it('ni el tramo, que son DOS fechas juntas', () => {
    expect(fila().vida.tramo).not.toMatch(/ de /)
  })

  it('ni la tira de cifras', () => {
    const f = fila({ ultimoPagoAt: '2026-07-24T05:00:00.000Z' })
    const ult = f.cifras.find((c) => /Últ/i.test(c.etiqueta))
    expect(ult.valor).toBe('24 jul')
  })
})

describe('⚠ el dato tiene que LLEGAR, no solo existir en la base', () => {
  /* Aquí falló de verdad, y solo se vio en el espejo: puse `fechaFin: true` en
     el `select` de Prisma y en pantalla salía «desde 23 jul», sin el tramo.
     La causa es que los dos endpoints REARMAN cada préstamo campo por campo en
     un objeto literal, y ahí `fechaFin` no estaba. Traerlo de la base no basta:
     hay que reenviarlo. Es «el API y el componente sin hilo» una vez más. */
  const { readFileSync } = require('node:fs')
  const { join } = require('node:path')
  const leer = (r) => readFileSync(join(process.cwd(), r), 'utf8')

  it.each([
    ['app/api/cobros-hoy/route.js'],
    ['app/api/rutas/[id]/route.js'],
  ])('%s lo pide a Prisma Y lo reenvía', (ruta) => {
    const src = leer(ruta)
    expect(src, 'falta en el select de Prisma').toMatch(/fechaFin:\s*true/)
    expect(src, 'se pide pero no se reenvía').toMatch(/fechaFin:\s*p\.fechaFin/)
  })

  it('la ruta lo reenvía en SUS DOS armados (el normal y el del clavo)', () => {
    const src = leer('app/api/rutas/[id]/route.js')
    expect((src.match(/fechaFin:\s*p\.fechaFin/g) || [])).toHaveLength(2)
  })
})
