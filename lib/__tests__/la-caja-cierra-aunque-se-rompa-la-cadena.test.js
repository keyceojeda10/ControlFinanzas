// lib/__tests__/la-caja-cierra-aunque-se-rompa-la-cadena.test.js
//
// ══ TRES CIFRAS DISTINTAS EN LA MISMA TARJETA ══════════════════════════════
//
// 27 de agosto de 2026, 9:45. Un prestamista abre su caja y lee:
//
//     Con lo que amaneciste   $2.538.000
//     Correcciones            − $1.019.000
//     ⚠ Hoy la cuenta no cierra: las líneas suman $1.519.000
//        y el saldo dice $2.538.000.
//     SALDO EN CAJA           $500.000
//
// Tres números para una sola pregunta. Sus palabras: «hermano ya me da hasta
// pena con ustedes, se me descuadra mucho la caja; cuando quiero retirar un
// dinero se me descuadra enseguida todo. Esto antes no me pasaba».
//
// Su mañana, en el registro de actividad:
//
//     09:01  retiro salida $1.019.000      2.538.000 → 1.519.000
//     09:04  DESHACE ese retiro            1.519.000 → 2.538.000
//     09:12  ajuste salida $1.019.000 «Libre»
//     09:43  ELIMINA el retiro
//     09:43  ELIMINA el ajuste «Libre»
//     09:44  ajuste salida $2.038.000      2.538.000 → 500.000
//
// El asiento del «deshecho» hereda la fecha del original —a propósito, para no
// dejar descuadrado el día viejo, ver `app/api/caja/ajustes/route.js`—. Al
// borrar el original, ese reverso quedó ordenado DETRÁS del ajuste de las
// 09:44, y la cadena de fotos se partió: un asiento acaba en $500.000 y el
// siguiente arranca en $1.519.000.
//
// ⚠ CADA ASIENTO SABE LO QUE MOVIÓ ÉL; LA CADENA ENTERA PUEDE MENTIR. Las dos
// fotos de una fila son fiables por separado —su resta es su efecto— pero que
// la última de una enganche con la primera de la siguiente NO está garantizado.
// Por eso la apertura se DERIVA del saldo de verdad menos lo que se movió, en
// vez de leerse de la primera foto.

import { describe, it, expect } from 'vitest'
import { resumirLibro, lineasDeLaBanda, loQueSeMovio } from '@/lib/dinero/conciliacion'

/* Sus dos asientos, tal cual están en producción. */
const SU_DIA = [
  { id: 'a', tipo: 'ajuste', monto: 2_038_000, descripcion: null, referenciaTipo: null,
    saldoAnterior: 2_538_000, saldoNuevo: 500_000, createdAt: '2026-08-27T14:44:00Z' },
  { id: 'b', tipo: 'ajuste', monto: 1_019_000, descripcion: 'Deshecho: Retiro manual desde caja',
    referenciaTipo: 'caja_ajuste_reverso', saldoAnterior: 1_519_000, saldoNuevo: 2_538_000,
    createdAt: '2026-08-27T17:00:00Z' },
]
const SU_CAPITAL = 500_000       // `Capital.saldo`, la cifra grande de su pantalla

describe('la caja de un día con la cadena partida', () => {
  it('leyendo las fotos —lo que él vio— no cierra', () => {
    const libro = resumirLibro(SU_DIA, null)
    const b = lineasDeLaBanda({ libro, saldo: libro.cierre })
    expect(libro.apertura).toBe(2_538_000)     // la primera foto
    expect(b.suma).toBe(1_519_000)
    expect(b.saldo).toBe(2_538_000)            // la última foto
    expect(b.cuadra).toBe(false)
    // Y ninguna de las tres es el saldo de verdad.
    expect(b.saldo).not.toBe(SU_CAPITAL)
  })

  it('derivando del saldo de verdad, cierra', () => {
    const libro = resumirLibro(SU_DIA, null, SU_CAPITAL)
    const b = lineasDeLaBanda({ libro, saldo: libro.cierre })
    expect(b.cuadra).toBe(true)
    expect(b.saldo).toBe(SU_CAPITAL)
  })

  it('y la apertura derivada es el cierre real de ayer', () => {
    /* Comprobación independiente: su último asiento del 26 de agosto dejó el
       saldo en $1.519.000. La derivación tiene que dar eso mismo sin haberlo
       mirado. */
    const libro = resumirLibro(SU_DIA, null, SU_CAPITAL)
    expect(libro.apertura).toBe(1_519_000)
    expect(libro.deltaTotal).toBe(-1_019_000)
    expect(SU_CAPITAL - libro.deltaTotal).toBe(libro.apertura)
  })

  it('las líneas siguen contando lo mismo: nada se esconde', () => {
    const libro = resumirLibro(SU_DIA, null, SU_CAPITAL)
    // El neto de sus dos ajustes: sacó 2.038.000 y le devolvieron 1.019.000.
    expect(libro.ajustes).toBe(-1_019_000)
    expect(libro.recaudo).toBe(0)
    expect(libro.desembolsos).toBe(0)
    expect(libro.gastos).toBe(0)
  })
})

describe('lo que NO puede cambiar', () => {
  it('sin saldo de verdad se comporta como siempre', () => {
    /* Es el caso de la caja de un COBRADOR: sus asientos vienen filtrados por
       sus rutas y `Capital.saldo` es el de todo el negocio, así que derivar le
       achacaría lo que movieron las demás. */
    const libro = resumirLibro(SU_DIA, null)
    expect(libro.apertura).toBe(2_538_000)
    expect(libro.cierre).toBe(2_538_000)
  })

  it('con la cadena sana, derivar da exactamente lo mismo que leer la foto', () => {
    const sano = [
      { id: 'a', tipo: 'recaudo', monto: 50_000, saldoAnterior: 1_000_000, saldoNuevo: 1_050_000,
        metodoPago: 'efectivo', createdAt: '2026-08-27T14:00:00Z' },
      { id: 'b', tipo: 'gasto', monto: 20_000, saldoAnterior: 1_050_000, saldoNuevo: 1_030_000,
        createdAt: '2026-08-27T15:00:00Z' },
    ]
    const porFoto = resumirLibro(sano, null)
    const derivado = resumirLibro(sano, null, 1_030_000)
    expect(derivado.apertura).toBe(porFoto.apertura)
    expect(derivado.cierre).toBe(porFoto.cierre)
    expect(lineasDeLaBanda({ libro: derivado, saldo: derivado.cierre }).cuadra).toBe(true)
  })

  it('⚠ y un asiento cuyo importe NO es lo que movió sigue encendiendo la alarma', () => {
    /* La alarma de verdad: la suma de los `monto` contra la suma de los deltas.
       Derivar la apertura no la apaga — si lo hiciera, este arreglo taparía los
       descuadres en vez de arreglarlos. */
    const mentiroso = [
      { id: 'a', tipo: 'gasto', monto: 20_000, saldoAnterior: 1_000_000, saldoNuevo: 900_000,
        createdAt: '2026-08-27T14:00:00Z' },   // dice 20.000 y movió 100.000
    ]
    const libro = resumirLibro(mentiroso, null, 900_000)
    const b = lineasDeLaBanda({ libro, saldo: libro.cierre })
    expect(b.cuadra).toBe(false)
    // Y `sinExplicar` lo caza: neto −20.000 contra un salto de −100.000.
    expect(libro.saltoAsientos).toBe(-100_000)
    expect(libro.gastos).toBe(20_000)
  })

  it('el día sin movimiento cierra donde abre', () => {
    // «El cero es un dato»: es el día con el que abre cada mañana.
    const libro = resumirLibro([], 1_030_000, 1_030_000)
    expect(libro.apertura).toBe(1_030_000)
    expect(libro.cierre).toBe(1_030_000)
    expect(lineasDeLaBanda({ libro, saldo: libro.cierre }).cuadra).toBe(true)
  })
})

describe('una sola forma de sumar lo que se movió', () => {
  it('la usan el libro y el API de la caja, no dos copias', () => {
    /* Redondear cada delta no da lo mismo que redondear la suma, y en la base
       hay asientos con fracciones de céntimo: dos implementaciones acaban en
       dos cifras distintas en la misma pantalla. */
    expect(loQueSeMovio(SU_DIA)).toBe(-1_019_000)
    expect(loQueSeMovio([])).toBe(0)
    const conFraccion = [
      { saldoAnterior: 0, saldoNuevo: 8_333.4 }, { saldoAnterior: 8_333.4, saldoNuevo: 16_666.8 },
    ]
    // Cada delta se redondea por separado, como hace el libro.
    expect(loQueSeMovio(conFraccion)).toBe(8_333 + 8_333)
  })

  it('el API de la caja la importa en vez de rehacerla', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync('app/api/caja/route.js', 'utf8')
    expect(src).toContain('loQueSeMovio')
    expect(src).toContain('saldoCapitalActual - loQueSeMovio(delDia)')
    // Y no vuelve a leer la primera foto del día.
    expect(src).not.toContain('primerMov ? Number(primerMov.saldoAnterior || 0)')
  })

  it('y solo se deriva en la vista del negocio, no en la de un cobrador', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync('app/api/caja/route.js', 'utf8')
    expect(src).toContain('cobradorId ? null : saldoCapitalActual')
  })
})
