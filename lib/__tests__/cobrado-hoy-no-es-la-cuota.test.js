// lib/__tests__/cobrado-hoy-no-es-la-cuota.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Dice pago diario registrado de 40 mil cuando realmente se hizo un pago para
//  colocarse al día. Los 40 mil son la cuota diaria correcta, pero él estaba
//  atrasado y pagó todo su atraso para quedar al día. Entonces está dando un
//  dato errado.»                                       — el dueño, 18 ago 2026
//
// La ficha pintaba `cuotaDiaria` bajo el rótulo «Pago diario registrado». El
// cliente entregó $240.000 y la pantalla decía $40.000 — y es la pantalla que
// uno abre JUSTO DESPUÉS DE COBRAR, para comprobar que quedó bien registrado.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { cobradoHoy, pagoHoy } from '@/lib/calculos'

const hoy = new Date()
const ayer = new Date(Date.now() - 86400000)

describe('⚠ lo cobrado hoy es lo que entregó, no la cuota', () => {
  it('suma TODOS los pagos del día', () => {
    /* El caso del dueño: seis cuotas juntas para ponerse al día. */
    const p = { pagos: [
      { montoPagado: 200000, tipo: 'completo', fechaPago: hoy },
      { montoPagado: 40000, tipo: 'completo', fechaPago: hoy },
    ] }
    expect(cobradoHoy(p)).toBe(240000)
  })

  it('no cuenta los de otros días', () => {
    const p = { pagos: [
      { montoPagado: 240000, tipo: 'completo', fechaPago: hoy },
      { montoPagado: 999999, tipo: 'completo', fechaPago: ayer },
    ] }
    expect(cobradoHoy(p)).toBe(240000)
  })

  it('⚠ ni el recargo ni el descuento, que no son plata que entró', () => {
    /* Por lo mismo que en `pagoHoy`: son ajustes de la deuda. Contándolos, la
       pastilla diría que entró un dinero que nadie entregó. */
    const p = { pagos: [
      { montoPagado: 40000, tipo: 'completo', fechaPago: hoy },
      { montoPagado: 15000, tipo: 'recargo', fechaPago: hoy },
      { montoPagado: 5000, tipo: 'descuento', fechaPago: hoy },
    ] }
    expect(cobradoHoy(p)).toBe(40000)
  })

  it('sin pagos hoy da cero, y entonces la pastilla ni sale', () => {
    expect(cobradoHoy({ pagos: [{ montoPagado: 40000, tipo: 'completo', fechaPago: ayer }] })).toBe(0)
  })

  it('⚠ contesta sobre los mismos pagos que `pagoHoy`', () => {
    /* Si discreparan, la pantalla diría «pagó hoy» sobre un pago que no está
       sumando —o al revés—, que es peor que cualquiera de los dos solo. */
    const soloAjuste = { pagos: [{ montoPagado: 15000, tipo: 'recargo', fechaPago: hoy }] }
    expect(pagoHoy(soloAjuste)).toBe(false)
    expect(cobradoHoy(soloAjuste)).toBe(0)
  })
})

describe('⚠ y la pantalla lo usa', () => {
  const ficha = readFileSync(resolve(process.cwd(), 'app/(dashboard)/prestamos/[id]/page.jsx'), 'utf8')

  it('la pastilla ya no pinta la cuota', () => {
    /* La ventana llega a 1.100 porque entre el rótulo y la cifra va el
       comentario que explica el porqué. Con 500 fallaba con el código bien. */
    const bloque = ficha.slice(ficha.indexOf('Cobrado hoy{'), ficha.indexOf('Cobrado hoy{') + 1100)
    expect(bloque, 'volvió a pintar la cuota').not.toMatch(/formatMoney\(cuotaDiaria\)/)
    expect(bloque).toMatch(/formatMoney\(cobradoHoyPrestamo\)/)
  })

  it('y el rótulo tampoco afirma que sea «el pago diario»', () => {
    /* Con seis cuotas juntas, el rótulo mentía igual que la cifra. */
    expect(ficha).not.toMatch(/Pago \{frecuenciaLabel\} registrado/)
  })

  it('si fueron varios, lo dice', () => {
    /* «$240.000» a secas parece un solo cobro enorme. */
    expect(ficha).toMatch(/pagosDeHoy > 1 \? ` · \$\{pagosDeHoy\} pagos`/)
  })
})
