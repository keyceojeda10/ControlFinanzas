import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { porQueNegativa, esAlarma } from '@/lib/dinero/ruta-negativa'

// Las tres rutas reales que se midieron en producción el 4 ago 2026.
const RUTA_1  = { saldoCapital: -220906600, arranqueAbsorbido: 235898100, inyectado: 0 }
const MAICOL  = { saldoCapital: -87940295,  arranqueAbsorbido: 0,         inyectado: 0 }
const BOSA    = { saldoCapital: -88062800,  arranqueAbsorbido: 16780000,  inyectado: 160000000 }
const SANA    = { saldoCapital: 5043723,    arranqueAbsorbido: 0,         inyectado: 5000000 }

describe('por qué una ruta sale en negativo', () => {
  it('una ruta en positivo no tiene nada que explicar', () => {
    expect(porQueNegativa(SANA)).toBeNull()
    expect(esAlarma(SANA)).toBe(false)
  })

  it('reconoce el ajuste de arranque', () => {
    // «Ruta 1»: −$220,9M de saldo con −$235,9M de arranque. Sin él estaría en
    // +$14,9M. Su capital está bien; lo que resta es la absorción de los
    // préstamos que ya estaban en la calle al activar el capital por ruta.
    const p = porQueNegativa(RUTA_1)
    expect(p.causa).toBe('arranque')
    expect(p.sinEso).toBe(14991500)
  })

  it('reconoce la ruta a la que nunca se le asignó capital', () => {
    // «Maicol»: prestó $98,2M con $0 asignados, así que cada préstamo la hunde.
    // Falta un dato, no plata.
    expect(porQueNegativa(MAICOL).causa).toBe('sin_capital')
  })

  it('reconoce el sobregiro de verdad', () => {
    // «BOSA»: $160M asignados y $375,8M prestados. Es lo ÚNICO que el dueño
    // puede querer mirar: la ruta gasta capital de otra parte del negocio.
    expect(porQueNegativa(BOSA).causa).toBe('sobregiro')
  })

  it('SOLO el sobregiro es alarma', () => {
    // El rojo es para lo que va mal. Medido: de las 28 rutas en negativo, 14
    // son arranque, 12 sin capital y solo 3 sobregiro. Pintar las 28 igual es
    // lo que hace que el dueño no distinga las 3 que sí importan.
    expect(esAlarma(BOSA)).toBe(true)
    expect(esAlarma(RUTA_1)).toBe(false)
    expect(esAlarma(MAICOL)).toBe(false)
  })

  it('el arranque manda sobre «sin capital»', () => {
    // «Ruta 1» tampoco tiene capital inyectado, pero su negativo lo explica el
    // arranque. Si el orden fuera al revés se le diría que registre capital
    // cuando lo que tiene es una absorción — un consejo equivocado.
    expect(porQueNegativa(RUTA_1).causa).toBe('arranque')
    expect(RUTA_1.inyectado).toBe(0)
  })

  it('un arranque que NO alcanza a explicar el negativo no se usa como excusa', () => {
    // Con arranque pequeño y un agujero grande, la causa sigue siendo otra: si
    // se dijera «es el arranque» se estaría tapando un sobregiro real.
    const p = porQueNegativa({ saldoCapital: -50000000, arranqueAbsorbido: 1000000, inyectado: 9000000 })
    expect(p.causa).toBe('sobregiro')
  })

  it('aguanta datos que no llegan sin inventarse una causa', () => {
    // Si el endpoint no manda `arranqueAbsorbido`, la ruta cae en «sin capital»
    // o «sobregiro» según lo inyectado — nunca en un `undefined` pintado.
    for (const r of [{ saldoCapital: -100 }, { saldoCapital: -100, inyectado: null }, {}]) {
      const p = porQueNegativa(r)
      if (p) {
        expect(['arranque', 'sin_capital', 'sobregiro']).toContain(p.causa)
        expect(p.titulo).toBeTruthy()
      }
    }
    expect(porQueNegativa(null)).toBeNull()
  })
})

describe('la pantalla lo dice', () => {
  const tab = readFileSync(join(process.cwd(), 'components', 'capital', 'CapitalTab.jsx'), 'utf8')

  it('el rojo se reserva para la alarma', () => {
    expect(tab).toContain('esAlarma(r)')
    expect(tab).toMatch(/esAlarma\(r\) \? 'var\(--cf-red-dark\)'/)
  })

  it('pinta la causa, no solo la cifra', () => {
    // Sin la causa el dueño no puede hacer nada con el número: lee que le falta
    // plata y no falta.
    expect(tab).toContain('porQueNegativa(r)')
    expect(tab).toMatch(/porQue\.titulo/)
    expect(tab).toMatch(/porQue\.detalle/)
  })

  it('enseña cuánto tendría sin el arranque', () => {
    // Es la cifra que convierte «−$220 millones» en «+$14,9M»: sin ella el
    // texto explica pero no tranquiliza.
    expect(tab).toMatch(/porQue\.sinEso != null/)
  })
})

describe('no se aplica donde el dato no llega', () => {
  it('la caja del cobrador NO usa esta clasificación', () => {
    // Su endpoint no manda `arranqueAbsorbido` ni `inyectado`, así que TODAS
    // las rutas caerían en «sin capital»: una explicación falsa es peor que la
    // cifra en rojo. Esa pantalla ya tiene su propio aviso en ámbar.
    const caja = readFileSync(join(process.cwd(), 'components', 'caja', 'CajaCobradorDetalle.jsx'), 'utf8')
    expect(caja).not.toContain('porQueNegativa')
    // Y lo que ya dice, se queda: no es rojo y explica.
    expect(caja).toMatch(/le falta registrar su capital/)
  })

  it('el endpoint de capital SÍ manda los dos campos', () => {
    const cap = readFileSync(join(process.cwd(), 'lib', 'capital.js'), 'utf8')
    expect(cap).toMatch(/arranqueAbsorbido/)
    expect(cap).toMatch(/inyectado/)
  })
})
