// lib/__tests__/las-dos-cajas-dicen-lo-mismo.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Mire la caja del administrador, la lista 9 […] la caja del cobrador sí está
//  sumando bien, pero la caja del administrador, mire, aparecen unos números
//  ahí que no tienen lógica.» — PRESTA MIL, 20 ago 2026.
//
// Y el dueño lo remató con la regla que ordena todo esto:
//
//   «La caja del cobrador SÍ está sumando y restando correctamente. La que
//    tiene los números malos es la caja del administrador, así que puedes hacer
//    una referencia buena a la caja del cobrador. Si haces un ajuste que dañe
//    también la caja del cobrador, ahí se jodió todo porque ningún número va a
//    corresponder. Ambas deben reportar lo mismo.»
//
// ⚠ LA CAJA DEL COBRADOR ES LA REFERENCIA. El administrador puede enseñar más
//   detalle —le importan otras cosas— pero las cifras comunes van al peso.
//
// ── EL DÍA DE SU CAPTURA, RUTA #9 ────────────────────────────────────────────
//
//     08:03  OLGA LUCIA           $5.000   transferencia
//     08:12  DANIEL BOTIAS       $34.000   transferencia
//     09:14  (un pago de      $3.393.000   registrado POR ERROR)
//     09:28  CINDY FERNANDA      $40.000   EFECTIVO
//     10:05  OSCAR RAMIRES       $40.000   transferencia
//     10:22  Carlos ANULA el pago de $3.393.000
//     10:23  descuentos de $1.800 y $16.200
//
// Cobró $119.000, en billetes $40.000, y arrancó con $26.000.
//
// La caja del administrador decía «Le queda en la ruta −$3.266.000» en un día
// de $119.000 cobrados y CERO prestados. La cuenta de ese disparate:
//
//     26.000 + 40.000 + 79.000 − 3.393.000 − 1.800 − 16.200 = −3.266.000
//
// Los $3.393.000 son el pago que nunca existió, RESTADO DOS VECES: al anularlo
// desaparece de «lo cobrado» —que sale de `Pago`— y su asiento de reverso lo
// vuelve a restar desde el libro. Los descuentos sí bajan el capital y se
// quedan.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { cobrosRevertidosElMismoDia } from '@/lib/dinero/conciliacion'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')

/* Los asientos de ese día, tal como están en su base. */
const PRESTAMO = 'cmql0xz61000lod7z2q6uv2d8'
const ASIENTOS_RUTA9 = [
  { id: 'a1', descripcion: 'Pago recibido - préstamo',              referenciaId: PRESTAMO, monto: 3_393_000 },
  { id: 'a2', descripcion: 'Reverso pago anulado - préstamo',       referenciaId: PRESTAMO, monto: 3_393_000 },
  { id: 'a3', descripcion: 'Descuento aplicado - préstamo (Descuento)', referenciaId: PRESTAMO, monto: 1_800 },
  { id: 'a4', descripcion: 'Descuento aplicado - préstamo (Descuento)', referenciaId: PRESTAMO, monto: 16_200 },
]

describe('⚠ el pago anulado el mismo día no se resta dos veces', () => {
  it('se reconoce el reverso cuyo cobro entró hoy', () => {
    const ids = cobrosRevertidosElMismoDia(ASIENTOS_RUTA9)
    expect([...ids]).toEqual(['a2'])
  })

  it('⚠ los DESCUENTOS no se tocan: ésos sí bajan el capital', () => {
    /* Comparten `referenciaId` con el pago, así que filtrar por referencia se
       los habría llevado por delante. Se distingue por el texto. */
    const ids = cobrosRevertidosElMismoDia(ASIENTOS_RUTA9)
    expect(ids.has('a3')).toBe(false)
    expect(ids.has('a4')).toBe(false)
  })

  it('un pago anulado de OTRO día sí resta: aquella plata entró de verdad', () => {
    // Hoy solo está el reverso; su recaudo fue hace días y no está en la lista.
    const ids = cobrosRevertidosElMismoDia([ASIENTOS_RUTA9[1]])
    expect(ids.size).toBe(0)
  })

  it('la cuenta de la RUTA #9, al peso', () => {
    const ids = cobrosRevertidosElMismoDia(ASIENTOS_RUTA9)
    const ajustes = ASIENTOS_RUTA9
      .filter((m) => /^(Reverso|Descuento)/.test(m.descripcion))
      .filter((m) => !ids.has(m.id))
      .reduce((t, m) => t - m.monto, 0)
    expect(ajustes, 'volvió el doble conteo').toBe(-18_000)
    // apertura + efectivo + digital + ajustes
    expect(26_000 + 40_000 + 79_000 + ajustes).toBe(127_000)
    // y NO el disparate que él vio
    expect(26_000 + 40_000 + 79_000 + ajustes).not.toBe(-3_266_000)
  })
})

describe('⚠ LA CAJA DEL COBRADOR ES LA REFERENCIA', () => {
  const cobrador = leer('app/(dashboard)/caja/page.jsx')
  const admin    = leer('components/caja/CajaCobradorDetalle.jsx')
  const api      = leer('app/api/caja/cobrador/[id]/route.js')

  it('lo cobrado sale del mismo sitio en las dos', () => {
    /* El administrador lo parte en efectivo y transferencia porque a él le
       importa por dónde entró; el cobrador lo enseña entero. Pero la SUMA es
       la misma cifra, y por eso el administrador la cierra con su total. */
    expect(admin).toMatch(/Cobró en total/)
    expect(admin).toMatch(/\(cr\.cobradoEfectivo \?\? 0\) \+ \(cr\.cobradoDigital \?\? 0\)/)
    expect(cobrador).toMatch(/label: 'Lo que cobraste', valor: cobradoHoy/)
  })

  it('el fajo se calcula con el mismo criterio en las dos', () => {
    // `entraAlFajo` es la única función que decide. Ver `lib/dinero/cuentas.js`.
    expect(leer('app/api/caja/route.js')).toMatch(/from '@\/lib\/dinero\/cuentas'/)
    expect(api).toMatch(/from '@\/lib\/dinero\/cuentas'/)
  })

  it('⚠ un cobro anulado hoy se descuenta UNA vez en la caja del administrador', () => {
    expect(api).toMatch(/const reversosYaDescontados = cobrosRevertidosElMismoDia\(primerMovPorRuta\)/)
    expect(api).toMatch(/if \(!yaDescontado\) ajustesDia \+= d/)
  })

  it('tampoco se le nombra en «Salió del capital de la ruta»', () => {
    /* Si no, la cifra sale de la resta pero sigue confesándose debajo, que es
       la misma pregunta con otra cara. */
    expect(api).toMatch(/!reversosYaDescontados\.has\(m\.id\) && !afectaElFajo/)
  })
})
