// lib/__tests__/hoja-pago-necesita-cuotas.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Visto en los registros de producción el 17 ago 2026, y llevaba dos semanas
// (aparece también el 4 y el 10):
//
//   Error: El préstamo cmsxnmbyu022w61l0whq053x9 es de modo "saldo" (con tabla)
//   pero llegó sin `cuotasAmortizacion`. Falta el `include` de Prisma.
//
// El préstamo tenía sus 8 filas en la base y se había creado ese mismo día: no
// era un dato incompleto, era el `select` de la respuesta. Los dos APIs pedían
// las filas a Prisma para sus propias cuentas y NO las devolvían, así que el
// cobro rápido —desde la lista de préstamos y desde la ficha del cliente— se
// abría en una pantalla de error y **el prestamista no podía cobrarle a su
// cliente**.
//
// `elInteresSubeLaDeuda` revienta a propósito con `undefined` en vez de
// adivinar: la respuesta segura no existe, porque una decide subir la deuda de
// un cliente real y la otra no.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')

/* Cada pareja: el API que alimenta la hoja, y la pantalla que la pinta con lo
   que ese API devuelve. Si mañana aparece una tercera vía, se añade aquí. */
const VIAS = [
  ['la lista de préstamos', 'app/api/prestamos/route.js', 'app/(dashboard)/prestamos/page.jsx'],
  ['la ficha del cliente', 'app/api/clientes/route.js', 'app/(dashboard)/clientes/page.jsx'],
]

describe('⚠ la hoja de pago recibe las cuotas', () => {
  for (const [quien, api, pantalla] of VIAS) {
    it(`${quien}: el API las PIDE a Prisma`, () => {
      expect(leer(api)).toMatch(/cuotasAmortizacion: \{/)
    })

    it(`${quien}: y además las DEVUELVE`, () => {
      /* Pedirlas y no devolverlas es justo el fallo: el servidor calcula bien y
         el navegador se queda sin el dato. */
      expect(leer(api), `${api} las pide pero no las manda`)
        .toMatch(/cuotasAmortizacion: p\.cuotasAmortizacion/)
    })

    it(`${quien}: la pantalla abre la hoja con ese préstamo`, () => {
      expect(leer(pantalla)).toMatch(/<RegistrarPago/)
    })
  }
})

describe('⚠ la guardia sigue siendo estricta', () => {
  const modos = leer('lib/dinero/modos.js')

  it('con `undefined` revienta, que es lo correcto', () => {
    /* Adivinar aquí no es una opción: una respuesta sube la deuda de un cliente
       real y la otra no. Mejor una pantalla de error que un cobro inventado. */
    expect(modos).toMatch(/cuotasAmortizacion === undefined/)
    expect(modos).toMatch(/throw new Error\(/)
  })

  it('pero con `[]` responde que NO sube la deuda', () => {
    /* Ese es el caso de dato incompleto —préstamos viejos sin tabla— y ahí sí
       hay una respuesta segura: equivocarse hacia arriba le cobra de más a un
       cliente; hacia abajo, solo deja de alargar el préstamo. */
    const trozo = modos.slice(modos.indexOf('cuotasAmortizacion === undefined'))
    expect(trozo).toMatch(/return false/)
  })
})
