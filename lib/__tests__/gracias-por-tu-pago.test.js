/* «Gracias por tu pago» solo con un pago de verdad (5 sep 2026). Un prestamista
   mandó «Tu pago de $150.000 fue registrado correctamente» desde un préstamo sin
   pagos: la plantilla le puso la CUOTA. El pago nunca existió. */
import { describe, it, expect } from 'vitest'
import { PLANTILLAS, pagoParaAgradecer } from '@/lib/whatsapp-plantillas'

const T = PLANTILLAS.find((p) => p.id === 'gracias_corto')
const cliente = { nombre: 'Luis Miguel' }
const hoyISO = new Date().toISOString()
const hace3dias = new Date(Date.now() - 3 * 86400e3).toISOString()

describe('«Gracias por tu pago»', () => {
  it('NO aplica a un préstamo activo sin pagos (el caso del 4 sep)', () => {
    const prestamo = { estado: 'activo', cuotaDiaria: 150000, pagos: [] }
    expect(T.aplica({ cliente, prestamo, pago: null })).toBe(false)
  })
  it('NO aplica si el último pago no es de hoy', () => {
    const prestamo = { estado: 'activo', cuotaDiaria: 150000, pagos: [{ montoPagado: 150000, tipo: 'completo', fechaPago: hace3dias }] }
    expect(T.aplica({ cliente, prestamo, pago: null })).toBe(false)
  })
  it('aplica con un pago de hoy, y el monto es el del pago, no la cuota', () => {
    const prestamo = { estado: 'activo', cuotaDiaria: 150000, pagos: [{ montoPagado: 60000, tipo: 'parcial', fechaPago: hoyISO }] }
    expect(T.aplica({ cliente, prestamo, pago: null })).toBe(true)
    const txt = T.generar({ cliente, prestamo, pago: null, orgNombre: 'Prestamos juan' })
    expect(txt).toMatch(/\$60\.000/)
    expect(txt).not.toMatch(/150\.000/)
    expect(txt).toMatch(/de hoy fue registrado/)
  })
  it('aplica con el pago que se acaba de registrar, aunque venga sin señal', () => {
    const pago = { montoPagado: 150000, tipo: 'completo', fechaPago: hoyISO, offline: true }
    expect(T.aplica({ cliente, prestamo: { estado: 'activo', pagos: [] }, pago })).toBe(true)
  })
  it('un recargo no es un pago que agradecer', () => {
    const prestamo = { estado: 'activo', pagos: [{ montoPagado: 20000, tipo: 'recargo', fechaPago: hoyISO }] }
    expect(pagoParaAgradecer({ prestamo })).toBeNull()
  })
})
