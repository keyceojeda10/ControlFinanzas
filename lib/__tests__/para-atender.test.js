import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { nivelDe, momentoDe, mensajePara, ordenarParaAtender, PROBABILIDAD, pendientes } from '@/lib/seguimiento/serios'
import { firmar, valido, destinatarios, enlace, diaBogota } from '@/lib/seguimiento/enlace-atender'

describe('quién es serio: las reglas medidas el 2 nov 2026', () => {
  it('caliente: cobró en 3 días, o 10 préstamos y entró 3 días, o 5 préstamos y cobró en 2', () => {
    expect(nivelDe({ diasCobro: 3 }).nivel).toBe('caliente')
    expect(nivelDe({ prestamos: 10, diasEntra: 3 }).nivel).toBe('caliente')
    expect(nivelDe({ prestamos: 5, diasCobro: 2 }).nivel).toBe('caliente')
    expect(nivelDe({ prestamos: 9, diasEntra: 3 }).nivel).toBe('tibio') // entró 3 días
  })
  it('tibio: entró 3 días o cargó 5 clientes', () => {
    expect(nivelDe({ diasEntra: 3 }).nivel).toBe('tibio')
    expect(nivelDe({ clientes: 5 }).nivel).toBe('tibio')
  })
  it('el resto no sale: un cliente y un día no son un negocio serio', () => {
    expect(nivelDe({ clientes: 1, prestamos: 1, diasCobro: 1, diasEntra: 2 }).nivel).toBe(null)
    expect(nivelDe({}).nivel).toBe(null)
  })
  it('la razón dice los números, no un adjetivo', () => {
    expect(nivelDe({ prestamos: 23, diasEntra: 4 }).razon).toBe('23 préstamos y entró 4 días')
  })
  it('el «de cada 10» es el medido', () => {
    expect(PROBABILIDAD).toEqual({ caliente: 6, tibio: 4 })
  })
})

describe('el momento y el mensaje', () => {
  it('decidir gana: la prueba vence en 2 días o menos, o venció hace poco', () => {
    expect(momentoDe({ diasParaVencer: 2, diasSinEntrar: 5, diasCobro: 3 })).toBe('decidir')
    expect(momentoDe({ diasParaVencer: -2 })).toBe('decidir')
    expect(momentoDe({ diasParaVencer: -5, diasSinEntrar: 3 })).toBe('enfrio')
  })
  it('se enfrió a los 2 días sin entrar; cobrando si ya cobra; si no, arrancó', () => {
    expect(momentoDe({ diasParaVencer: 9, diasSinEntrar: 2 })).toBe('enfrio')
    expect(momentoDe({ diasParaVencer: 9, diasCobro: 1 })).toBe('cobrando')
    expect(momentoDe({ diasParaVencer: 9 })).toBe('arranco')
  })
  it('el mensaje lleva el nombre, lo que hizo y quién lo firma', () => {
    const m = mensajePara({ momento: 'cobrando', nombre: 'maría pérez', diasCobro: 3, quien: 'Carlos' })
    expect(m).toMatch(/^Hola María, soy Carlos de Control Finanzas\./)
    expect(m).toMatch(/3 días cobrando/)
    expect(mensajePara({ momento: 'arranco', nombre: 'Tienda 360', prestamos: 12 })).toMatch(/^Hola, soy Carlos/)
  })
  it('primero los que deciden, luego los calientes, y nunca los que no son serios', () => {
    const l = ordenarParaAtender([
      { nivel: 'tibio', momento: 'arranco', prestamos: 1 },
      { nivel: null, momento: 'decidir', prestamos: 0 },
      { nivel: 'caliente', momento: 'arranco', prestamos: 5 },
      { nivel: 'tibio', momento: 'decidir', prestamos: 2 },
    ])
    expect(l.map((f) => `${f.nivel}/${f.momento}`)).toEqual(['tibio/decidir', 'caliente/arranco', 'tibio/arranco'])
  })
  it('las cuentas de cortesía o demo (más de 30 días de prueba por delante) no salen', () => {
    expect(ordenarParaAtender([{ nivel: 'caliente', momento: 'arranco', prestamos: 24, diasParaVencer: 350 }])).toEqual([])
  })
})

describe('el enlace del día', () => {
  beforeAll(() => { process.env.ATENDER_SECRETO = 'secreto-de-prueba' })
  const lista = destinatarios('Carlos:573008875156, Ana:3001112233 ,malo')

  it('lee quién recibe el aviso del .env', () => {
    expect(lista).toEqual([{ quien: 'Carlos', numero: '573008875156' }, { quien: 'Ana', numero: '3001112233' }])
  })
  it('vale hoy y mañana, para esa persona; no después ni para otro', () => {
    const hoy = new Date('2026-11-03T14:00:00Z')
    const d = diaBogota(hoy)
    const k = firmar('Carlos', d)
    expect(valido({ q: 'Carlos', d, k }, hoy, lista)).toBe(true)
    expect(valido({ q: 'Carlos', d, k }, new Date('2026-11-04T14:00:00Z'), lista)).toBe(true)
    expect(valido({ q: 'Carlos', d, k }, new Date('2026-11-05T14:00:00Z'), lista)).toBe(false)
    expect(valido({ q: 'Ana', d, k }, hoy, lista)).toBe(false)
    expect(valido({ q: 'Pedro', d, k: firmar('Pedro', d) }, hoy, lista)).toBe(false)
    expect(enlace('https://x', 'Carlos', hoy)).toBe(`https://x/atender?q=Carlos&d=${d}&k=${k}`)
  })
})

describe('pendientes', () => {
  const ahora = new Date('2026-11-03T14:00:00Z')
  const hace = (dias) => new Date(ahora.getTime() - dias * 86400000).toISOString()
  it('sale si nadie lo atendió, o si se le habló hace más de 2 días; «Pagó» y «No le interesa» cierran', () => {
    const l = pendientes([
      { id: 1, atencion: null },
      { id: 2, atencion: { resultado: 'hable', cuando: hace(1) } },
      { id: 3, atencion: { resultado: 'no_contesto', cuando: hace(3) } },
      { id: 4, atencion: { resultado: 'pago', cuando: hace(9) } },
      { id: 5, atencion: { resultado: 'no_interesa', cuando: hace(9) } },
    ], ahora)
    expect(l.map((f) => f.id)).toEqual([1, 3])
  })
  it('la página usa la misma regla', () => {
    const src = readFileSync('app/atender/page.jsx', 'utf8')
    expect(src).toMatch(/a\.resultado === 'pago' \|\| a\.resultado === 'no_interesa'/)
    expect(src).toMatch(/> 2 \* 86400000/)
  })
})
