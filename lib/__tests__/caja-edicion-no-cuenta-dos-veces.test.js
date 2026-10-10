/* La caja del cobrador toma «Prestó» con el monto VIGENTE de cada préstamo, así
 * que la pareja de una edición no puede volver a sumarse como corrección.
 *
 * PRESTA MIL, RUTA #6, 9 oct 2026: prestó $100.000, lo bajó a $50.000 y la caja
 * pedía $415.000 donde eran $315.000. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  corregidosDeOtroDia, esReversoDeEdicion, esDesembolsoActualizado, desembolsosOriginalesDelDia, reversosYaEnLoPrestado,
} from '@/lib/dinero/conciliacion'

const API = readFileSync('app/api/caja/cobrador/[id]/route.js', 'utf8')

const mov = (tipo, descripcion, referenciaId, monto) => ({ tipo, descripcion, referenciaId, monto })

describe('la pareja de edición en la caja del cobrador', () => {
  it('reconoce los dos asientos de la pareja', () => {
    expect(esReversoDeEdicion({ descripcion: 'Reverso desembolso - edición préstamo (anterior $100.000)' })).toBe(true)
    expect(esReversoDeEdicion({ descripcion: 'Reverso desembolso - préstamo eliminado (X)' })).toBe(false)
    expect(esDesembolsoActualizado({ descripcion: 'Desembolso actualizado - edición préstamo ($50.000)' })).toBe(true)
    expect(esDesembolsoActualizado({ descripcion: 'Desembolso préstamo a ROSALVA' })).toBe(false)
  })

  it('el préstamo que salió hoy y se corrigió hoy NO es «de otro día»', () => {
    const movs = [
      mov('desembolso', 'Desembolso préstamo a ROSALVA', 'p1', 100_000),
      mov('ajuste', 'Reverso desembolso - edición préstamo (anterior $100.000)', 'p1', 100_000),
      mov('desembolso', 'Desembolso actualizado - edición préstamo ($50.000)', 'p1', 50_000),
    ]
    expect(corregidosDeOtroDia(movs).size).toBe(0)
    expect(desembolsosOriginalesDelDia(movs).has('p1')).toBe(true)
  })

  it('el préstamo de otro día que hoy solo se corrigió, sí', () => {
    const movs = [
      mov('ajuste', 'Reverso desembolso - edición préstamo (anterior $1.000.000.000)', 'viejo', 1_000_000_000),
      mov('desembolso', 'Desembolso actualizado - edición préstamo ($1.000.000)', 'viejo', 1_000_000),
      mov('desembolso', 'Desembolso préstamo a OTRA', 'nuevo', 200_000),
    ]
    expect([...corregidosDeOtroDia(movs)]).toEqual(['viejo'])
  })

  it('una renovación o una carga de hoy editada no cuenta como «de otro día»', () => {
    for (const original of ['Desembolso por renovación - KARIME', 'Desembolso (carga masiva) - KARIME']) {
      const movs = [
        mov('desembolso', original, 'r', 80_000),
        mov('desembolso', 'Desembolso actualizado - edición préstamo ($90.000)', 'r', 90_000),
      ]
      expect(corregidosDeOtroDia(movs).size, original).toBe(0)
    }
  })

  it('sin `tipo` (el select de «Prestó» no lo pide) sigue funcionando', () => {
    const movs = [{ descripcion: 'Desembolso actualizado - edición préstamo ($1)', referenciaId: 'v' }]
    expect([...corregidosDeOtroDia(movs)]).toEqual(['v'])
  })

  it('la cuenta del 9 de octubre da lo que dice el capital de la ruta', () => {
    /* Lo que hace el API, con los números de la RUTA #6: «Prestó» es el monto
       vigente (150 + 50) y el reverso del préstamo de hoy ya no suma. */
    const movs = [
      { id: 'a', ...mov('desembolso', 'Desembolso préstamo a ROSALVA', 'p1', 100_000) },
      { id: 'b', ...mov('ajuste', 'Reverso desembolso - edición préstamo (anterior $100.000)', 'p1', 100_000) },
      { id: 'c', ...mov('desembolso', 'Desembolso actualizado - edición préstamo ($50.000)', 'p1', 50_000) },
    ]
    const originales = desembolsosOriginalesDelDia(movs)
    const yaEnPresto = reversosYaEnLoPrestado(movs, originales)
    expect([...yaEnPresto]).toEqual(['b'])
    const correcciones = movs
      .filter((m) => m.tipo === 'ajuste' && !yaEnPresto.has(m.id))
      .reduce((t, m) => t + m.monto, 0)
    expect(304_000 + 235_000 + correcciones - (150_000 + 50_000) - 24_000).toBe(315_000)
  })

  it('⚠ la renovación editada no casa al peso y se queda como estaba', () => {
    // Salieron $54.000; el reverso habla del capital anterior ($150.000).
    const movs = [
      { id: 'a', ...mov('desembolso', 'Desembolso por renovación - ROBINSON', 'r', 54_000) },
      { id: 'b', ...mov('ajuste', 'Reverso desembolso - edición préstamo (anterior $150.000)', 'r', 150_000) },
      { id: 'c', ...mov('desembolso', 'Desembolso actualizado - edición préstamo ($200.000)', 'r', 200_000) },
    ]
    expect(reversosYaEnLoPrestado(movs, desembolsosOriginalesDelDia(movs)).size).toBe(0)
  })

  it('dos ediciones el mismo día: los dos reversos ya están en «Prestó»', () => {
    // 100 → 50 → 80. «Prestó» dice 80; el libro, −100 +100 −50 +50 −80 = −80.
    const movs = [
      { id: 'a', ...mov('desembolso', 'Desembolso préstamo a X', 'p', 100_000) },
      { id: 'b', ...mov('ajuste', 'Reverso desembolso - edición préstamo (anterior $100.000)', 'p', 100_000) },
      { id: 'c', ...mov('desembolso', 'Desembolso actualizado - edición préstamo ($50.000)', 'p', 50_000) },
      { id: 'd', ...mov('ajuste', 'Reverso desembolso - edición préstamo (anterior $50.000)', 'p', 50_000) },
      { id: 'e', ...mov('desembolso', 'Desembolso actualizado - edición préstamo ($80.000)', 'p', 80_000) },
    ]
    expect([...reversosYaEnLoPrestado(movs, desembolsosOriginalesDelDia(movs))].sort()).toEqual(['b', 'd'])
  })

  it('el préstamo de otro día no entra: su reverso es plata de la bolsa', () => {
    const movs = [
      { id: 'b', ...mov('ajuste', 'Reverso desembolso - edición préstamo (anterior $100.000)', 'v', 100_000) },
      { id: 'c', ...mov('desembolso', 'Desembolso actualizado - edición préstamo ($100.000)', 'v', 100_000) },
    ]
    expect(reversosYaEnLoPrestado(movs, desembolsosOriginalesDelDia(movs)).size).toBe(0)
  })

  it('el API usa las dos reglas (anclado en el código)', () => {
    expect(API).toMatch(/for \(const id of reversosYaEnLoPrestado\(primerMovPorRuta, originalesDeHoy\)\) reversosYaDescontados\.add\(id\)/)
    expect(API).toMatch(/for \(const p of prestamosExtra\) if \(!soloCorregidos\.has\(p\.id\)\) agregar\(p\)/)
    expect(API).toMatch(/for \(const m of actualizadosDeOtroDia\) ajustesDia -= m\.monto/)
    // Sin `descripcion` en el select, `corregidosDeOtroDia` no ve nada y calla.
    expect(API).toMatch(/metodoPagoId: true, descripcion: true \}/)
  })
})
