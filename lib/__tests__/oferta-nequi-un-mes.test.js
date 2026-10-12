// El 35 % por Nequi guardado es UN SOLO MES (decisión del dueño, 12 oct 2026).
// Se guarda como preferencial «1 cobro» (lib/seguimiento/oferta-nequi.js): aquí
// se comprueba con el MISMO cálculo que usa el cobro (`precioMensual`).
import { describe, it, expect } from 'vitest'
import { leerPreferencial, precioMensual } from '@/lib/precio-plan'
import { precioConDescuento } from '@/lib/seguimiento/reglas'
import { getPrecioPlan } from '@/lib/planes'

const DIA = 86400000
const lista = getPrecioPlan('starter', 'co')

function orgConOferta(inicio) {
  const leido = leerPreferencial({ plan: 'starter', precio: precioConDescuento(lista), cobros: 1 }, { inicio, country: 'co' })
  expect(leido.error).toBeUndefined()
  return { country: 'co', ...leido.data }
}

describe('el 35 % por Nequi dura un cobro', () => {
  it('el próximo cobro sale con el 35 % menos', () => {
    const inicio = new Date('2026-10-14T17:00:00Z')
    const org = orgConOferta(inicio)
    expect(precioMensual(org, 'starter', inicio).monto).toBe(precioConDescuento(lista))
    expect(precioConDescuento(39000)).toBe(25400) // Inicial: $39.000 → $25.400 ese mes
  })
  it('el siguiente, a precio de lista', () => {
    const inicio = new Date('2026-10-14T17:00:00Z')
    const org = orgConOferta(inicio)
    expect(precioMensual(org, 'starter', new Date(inicio.getTime() + 30 * DIA)).monto).toBe(lista)
  })
  it('si lo guarda con el plan ya vencido, el cobro de ese momento lleva el descuento, y el siguiente no', () => {
    const ahora = new Date('2026-10-20T15:00:00Z')
    const org = orgConOferta(ahora)
    expect(precioMensual(org, 'starter', ahora).monto).toBe(precioConDescuento(lista))
    expect(precioMensual(org, 'starter', new Date(ahora.getTime() + 30 * DIA)).monto).toBe(lista)
  })
})
