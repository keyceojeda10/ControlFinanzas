// lib/__tests__/la-correccion-sale-en-la-banda.test.js
//
// ══ «HERMANO PORQUE SE ME DESCUADRA TANTO LA CAJA» ═════════════════════════
//
// 26 de agosto de 2026, 19:23. Un prestamista abre su caja de un día SIN UN
// SOLO COBRO y lee:
//
//     Con lo que amaneciste   $1.449.000
//     Lo que entró            + $0
//     Lo que prestaste        − $0
//     Gastos                  − $0
//     ⚠ Hoy la cuenta no cierra: las líneas suman $1.449.000
//        y el saldo dice $1.519.000.
//     SALDO EN CAJA           $1.519.000
//
// Los $70.000 eran la corrección de capital que se le aplicó esa tarde: se le
// devolvió una plata que el libro le había restado mal al perdonar una deuda.
// La corrección movió `Capital.saldo` — y estaba escrita a propósito para que
// `afectaCaja` la dejara fuera, porque perdonar deuda no saca un billete de
// ningún sitio.
//
// El resultado: una cifra que cambia el total sin aparecer en la lista. Que es
// literalmente lo que CLAUDE.md prohíbe: «es de donde salen las preguntas:
// enseñarla con su nombre y su signo».
//
// Medido en el espejo: 15 de los 16 negocios corregidos tenían el aviso, por
// $36.316.548, y en cada uno el hueco era el importe de su corrección al peso.
// El mayor iba a ver $14.946.077.

import { describe, it, expect } from 'vitest'
import { resumirLibro, lineasDeLaBanda } from '@/lib/dinero/conciliacion'

/* Su día, tal cual está en la base: un solo asiento. */
const LA_CORRECCION = {
  id: 'm1', tipo: 'ajuste', monto: 70_000,
  descripcion: 'Reverso descuento - corrección: perdonar deuda no saca plata de la caja',
  referenciaTipo: 'correccion',
  saldoAnterior: 1_449_000, saldoNuevo: 1_519_000,
  createdAt: '2026-08-26T21:07:00.000Z',
}
const banda = (movs, saldo, previo = null) =>
  lineasDeLaBanda({ libro: resumirLibro(movs, previo), saldo })

describe('la corrección aparece en la banda con su nombre y su signo', () => {
  it('el día del reporte cuadra, y por la cifra exacta', () => {
    const b = banda([LA_CORRECCION], 1_519_000)
    expect(b.suma).toBe(1_519_000)
    expect(b.saldo).toBe(1_519_000)
    expect(b.cuadra).toBe(true)
  })

  it('y se lee el renglón, no un hueco', () => {
    const l = banda([LA_CORRECCION], 1_519_000).lineas.find((x) => x.id === 'correcciones')
    expect(l).toBeTruthy()
    expect(l.rotulo).toBe('Corrección de capital')
    expect(l.monto).toBe(70_000)
    expect(l.signo).toBe(1)
  })

  it('sin el renglón, la cuenta no cerraba — que es lo que él vio', () => {
    // Las cuatro líneas de siempre suman la apertura pelada.
    const b = banda([LA_CORRECCION], 1_519_000)
    const sinCorreccion = b.lineas.filter((x) => x.id !== 'correcciones')
    const suma = Math.round(sinCorreccion.reduce((a, x) => a + x.signo * x.monto, 1_449_000))
    expect(suma).toBe(1_449_000)
    expect(1_519_000 - suma).toBe(70_000)
  })
})

describe('lo que NO puede cambiar', () => {
  it('el día en blanco cierra y no gana ni un renglón', () => {
    // «El cero es un dato»: es el día con el que el cliente abre cada mañana.
    const b = banda([], 1_519_000, 1_519_000)
    expect(b.cuadra).toBe(true)
    expect(b.lineas.map((l) => l.id)).toEqual(['apertura', 'recaudo', 'desembolsos', 'gastos'])
  })

  it('un asiento que no movió el saldo sigue invisible', () => {
    /* El descuento nuevo (`noMueveCapital`) y la reserva de ruta se apuntan con
       las dos fotos iguales. No mueven nada, así que no tienen renglón. */
    const quieto = { ...LA_CORRECCION, id: 'm2', referenciaTipo: 'prestamo',
      descripcion: 'Descuento aplicado - préstamo', saldoAnterior: 1_449_000, saldoNuevo: 1_449_000 }
    const b = banda([quieto], 1_449_000, 1_449_000)
    expect(b.cuadra).toBe(true)
    expect(b.lineas.some((l) => ['perdonado', 'perdonDeshecho', 'correcciones'].includes(l.id))).toBe(false)
  })

  it('el perdón viejo, que SÍ bajaba el saldo, sale con su nombre y en negativo', () => {
    const perdon = { id: 'm3', tipo: 'ajuste', monto: 306_973,
      descripcion: 'Interés perdonado por pago anticipado', referenciaTipo: 'pago',
      saldoAnterior: 4_670_300, saldoNuevo: 4_363_327, createdAt: '2026-08-26T17:11:00.000Z' }
    const b = banda([perdon], 4_363_327)
    const l = b.lineas.find((x) => x.id === 'perdonado')
    expect(l.rotulo).toBe('Deuda que le perdonaste')
    expect(l.monto).toBe(306_973)
    expect(l.signo).toBe(-1)
    expect(b.cuadra).toBe(true)
  })

  it('⚠ un «descuento» que SUBE el saldo no recibe rótulo, y la banda sigue roja', () => {
    /* Es el invariante que impide que este arreglo esconda un aviso legítimo.
       Un descuento que sube el capital no es un perdón: es capital inventado
       por un recálculo, y de eso hay que enterarse. Lo exigió la revisión
       adversarial del 27 ago, y sin él el arreglo tapaba justo el fallo que
       más importa. */
    const alReves = { id: 'm4', tipo: 'ajuste', monto: 40_000,
      descripcion: 'Descuento aplicado - préstamo', referenciaTipo: 'pago',
      saldoAnterior: 1_000_000, saldoNuevo: 1_040_000, createdAt: '2026-08-26T18:00:00.000Z' }
    const b = banda([alReves], 1_040_000)
    expect(b.lineas.some((l) => ['perdonado', 'perdonDeshecho', 'correcciones'].includes(l.id))).toBe(false)
    expect(b.cuadra).toBe(false)          // sigue gritando, que es lo que toca
  })

  it('el reverso de un perdón sale como lo que es', () => {
    const reverso = { id: 'm5', tipo: 'ajuste', monto: 306_973,
      descripcion: 'Reverso interés perdonado - pago anulado', referenciaTipo: 'pago',
      saldoAnterior: 4_363_327, saldoNuevo: 4_670_300, createdAt: '2026-08-26T18:00:00.000Z' }
    const l = banda([reverso], 4_670_300).lineas.find((x) => x.id === 'perdonDeshecho')
    expect(l.rotulo).toBe('Perdón que se deshizo')
    expect(l.signo).toBe(1)
  })

  it('el perdón y su corrección, el mismo día, se nombran los dos', () => {
    /* El caso de Crediya: su banda cuadraba porque los dos se anulaban en la
       sombra. Cuadrar por casualidad no es cuadrar. */
    const perdon = { id: 'p', tipo: 'ajuste', monto: 306_973, referenciaTipo: 'pago',
      descripcion: 'Interés perdonado por pago anticipado',
      saldoAnterior: 4_670_300, saldoNuevo: 4_363_327, createdAt: '2026-08-26T17:11:00.000Z' }
    const corr = { id: 'c', tipo: 'ajuste', monto: 306_973, referenciaTipo: 'correccion',
      descripcion: 'Reverso interés perdonado - corrección',
      saldoAnterior: 4_363_327, saldoNuevo: 4_670_300, createdAt: '2026-08-26T21:07:00.000Z' }
    const b = banda([perdon, corr], 4_670_300)
    expect(b.cuadra).toBe(true)
    expect(b.lineas.find((l) => l.id === 'perdonado').monto).toBe(306_973)
    expect(b.lineas.find((l) => l.id === 'correcciones').monto).toBe(306_973)
  })
})
