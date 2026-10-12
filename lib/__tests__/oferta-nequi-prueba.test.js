// Opción A del dueño (12 oct 2026): el 35 % a los de prueba que usan el sistema,
// solo al final de la prueba. Y la oferta cae sobre el plan que se COBRA.
import { describe, it, expect } from 'vitest'
import { tocaOfertaDePrueba, CLIENTES_OFERTA_PRUEBA, DIAS_OFERTA_PRUEBA } from '@/lib/seguimiento/reglas'
import { planDelCobro } from '@/lib/plan-del-cobro'

const DIA = 86400000
const ahora = new Date('2026-10-12T15:00:00Z')
const fin = (dias) => new Date(ahora.getTime() + dias * DIA)

describe('tocaOfertaDePrueba (opción A)', () => {
  it('6 clientes y faltan 2 días: sí', () => expect(tocaOfertaDePrueba({ finPrueba: fin(2), ahora, clientes: 6 })).toBe(true))
  it('faltan 5 días: todavía no', () => expect(tocaOfertaDePrueba({ finPrueba: fin(5), ahora, clientes: 40 })).toBe(false))
  it('ya terminó: no (ya no tiene acceso)', () => expect(tocaOfertaDePrueba({ finPrueba: fin(-1), ahora, clientes: 40 })).toBe(false))
  it('5 clientes: no', () => expect(tocaOfertaDePrueba({ finPrueba: fin(2), ahora, clientes: 5 })).toBe(false))
  it('ya pagó, ya se le ofreció o ya tiene cobro automático: no', () => {
    expect(tocaOfertaDePrueba({ finPrueba: fin(2), ahora, clientes: 10, pagoReal: true })).toBe(false)
    expect(tocaOfertaDePrueba({ finPrueba: fin(2), ahora, clientes: 10, ofertaNequi: 'aplicada' })).toBe(false)
    expect(tocaOfertaDePrueba({ finPrueba: fin(2), ahora, clientes: 10, cobroAutomatico: true })).toBe(false)
  })
  it('los números del dueño', () => { expect(CLIENTES_OFERTA_PRUEBA).toBe(6); expect(DIAS_OFERTA_PRUEBA).toBe(3) })
})

describe('planDelCobro: el mismo para el cobro y para la oferta', () => {
  it('el elegido en la hoja manda', () => expect(planDelCobro({ org: { plan: 'starter' }, planElegido: 'basic' })).toBe('basic'))
  it('si no, el último pagado', () => expect(planDelCobro({ org: { plan: 'starter' }, pagada: { plan: 'basic' } })).toBe('basic'))
  it('en prueba, el original (no el de la demo)', () => expect(planDelCobro({ org: { plan: 'professional', planOriginal: 'starter' } })).toBe('starter'))
})
