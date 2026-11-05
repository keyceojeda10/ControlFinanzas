import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { interesQueAhorraUnAbono } from '@/lib/dinero/abono-capital'
import { efectoDelPago } from '@/lib/dinero/saldo-tras-cada-pago'
import { compararPagos, pagosEnOrden } from '@/lib/dinero/orden-de-pagos'

const leer = (f) => readFileSync(f, 'utf8')

// Inversiones Jk, 5 nov 2026: Yaneris Díaz, abierto de $1.500.000 al 12 %.
// Anuló y volvió a meter el abono a capital del 2 oct, y quedó debiendo $30.000
// de menos. HCANO: dos abiertos con un abono a mitad de mes, −$21.333 y −$1.667.

describe('un abono a capital en un abierto no «ahorra» interés', () => {
  const base = { monto: 160000, tasaInteres: 20, diasPlazo: 30, fechaInicio: '2026-10-07T05:00:00Z', ahora: '2026-10-17T18:00:00Z' }
  it('en un abierto da 0: el abono ya baja el interés del mes siguiente', () => {
    expect(interesQueAhorraUnAbono({ ...base, abierto: true })).toBe(0)
  })
  it('en los demás modos sigue igual', () => {
    expect(interesQueAhorraUnAbono(base)).toBe(21333)
  })
  it('la vista sin señal tampoco lo resta', () => {
    const p = { modoInteres: 'solo_interes', sinPlazo: true, totalAPagar: 660000, totalPagado: 110000, tasaInteres: 20, diasPlazo: 30, fechaInicio: base.fechaInicio }
    expect(efectoDelPago(p, { tipo: 'capital', monto: 160000, ahora: base.ahora }).totalAPagar).toBe(660000)
  })
  it('las seis vías pasan `abierto`', () => {
    expect(leer('app/api/prestamos/[id]/pagos/route.js')).toMatch(/abierto: esAbiertoConDevengo\(prestamo\),\n\s*\}\)/)
    expect(leer('app/api/pagos/[id]/route.js')).toMatch(/abierto: esAbiertoConDevengo\(prestamo\),\n\s*\}\)/)
    expect(leer('lib/dinero/saldo-tras-cada-pago.js').match(/abierto: esAbiertoConDevengo\(prestamo/g)).toHaveLength(3)
  })
})

describe('⚠ anular un pago no pisa el ajuste del interés con un total viejo', () => {
  const src = leer('app/api/pagos/[id]/route.js')
  const borrar = src.slice(src.indexOf('export async function DELETE'))
  it('el reajuste va antes y los demás cambios del total son `increment`/`decrement`', () => {
    expect(borrar.indexOf('await reajustarDevengosTrasCambio(tx')).toBeGreaterThan(-1)
    expect(borrar).toMatch(/data: \{ totalAPagar: \{ increment: ahorroInteres \} \}/)
    expect(borrar).toMatch(/data: \{ totalAPagar: \{ decrement: pago\.montoPagado \} \}/)
    expect(borrar).toMatch(/data: \{ totalAPagar: \{ increment: pago\.montoPagado \} \}/)
    expect(borrar).not.toMatch(/totalAPagar: prestamo\.totalAPagar [+-]/)
  })
})

describe('el mismo día, primero el interés y luego el capital', () => {
  // Lo de Yaneris: los dos del 3 sep quedaron a las 12:00; el del 2 oct, el
  // capital a las 12:00 (fecha cambiada a mano) y el interés a las 12:45.
  const pagos = [
    { id: 'c1', tipo: 'capital', fechaPago: '2026-09-03T17:00:00Z' },
    { id: 'i1', tipo: 'intereses', fechaPago: '2026-09-03T17:00:00Z' },
    { id: 'c2', tipo: 'capital', fechaPago: '2026-10-02T17:00:00Z' },
    { id: 'i2', tipo: 'intereses', fechaPago: '2026-10-02T17:45:58Z' },
  ]
  it('el historial: del más viejo al más nuevo, interés antes que capital', () => {
    expect(pagosEnOrden(pagos).map((p) => p.id)).toEqual(['i1', 'c1', 'i2', 'c2'])
  })
  it('la ficha: el día más nuevo arriba, y dentro del día igual', () => {
    expect(pagosEnOrden(pagos, { reciente: true }).map((p) => p.id)).toEqual(['i2', 'c2', 'i1', 'c1'])
  })
  it('el día es el de Colombia: las 11 p. m. del 2 oct no son el 3', () => {
    expect(compararPagos({ tipo: 'capital', fechaPago: '2026-10-03T04:00:00Z' }, { tipo: 'intereses', fechaPago: '2026-10-03T06:00:00Z' })).toBeLessThan(0)
  })
  it('también la ficha del cliente, su historial (con y sin señal), el portal y la ficha sin señal', () => {
    expect(leer('app/api/clientes/[id]/route.js')).toMatch(/for \(const p of cliente\.prestamos\) p\.pagos = pagosEnOrden\(p\.pagos, \{ reciente: true \}\)/)
    expect(leer('app/api/clientes/[id]/historial/route.js')).toMatch(/historial\.sort\(\(a, b\) => compararPagos\(a, b, \{ reciente: true \}\)\)/)
    expect(leer('app/(dashboard)/clientes/[id]/historial/page.jsx')).toMatch(/allPagos\.sort\(\(a, b\) => compararPagos\(a, b, \{ reciente: true \}\)\)/)
    expect(leer('app/api/portal/prestamos/[id]/route.js')).toMatch(/pagos: pagosEnOrden\(prestamo\.pagos, \{ reciente: true \}\)/)
    expect(leer('app/(dashboard)/prestamos/[id]/page.jsx')).toMatch(/const pagos = pagosEnOrden\(pagosCrudos, \{ reciente: true \}\)/)
  })
  it('un pago a interés se llama «Interés» en los listados, no «Parcial»', () => {
    expect(leer('components/pagos/ListadoPagos.jsx')).toMatch(/intereses: \{ label: 'Interés'/)
  })
  it('la ficha, el WhatsApp y el historial impreso usan la misma regla', () => {
    expect(leer('app/api/prestamos/[id]/route.js')).toMatch(/p\.pagos = pagosEnOrden\(p\.pagos, \{ reciente: true/)
    expect(leer('lib/whatsapp-plantillas.js')).toMatch(/const pagosOrdenados = pagosEnOrden\(prestamo\?\.pagos\)/)
    expect(leer('components/ui/BotonImprimirRecibo.jsx')).toMatch(/const pagos = pagosEnOrden\(/)
  })
})
