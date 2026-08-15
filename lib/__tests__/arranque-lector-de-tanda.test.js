// lib/__tests__/arranque-lector-de-tanda.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Hay DOS lectores de fotos y hacen cosas distintas:
//
//     leer-cartulina        UN cliente, hasta 5 fotos que se FUSIONAN
//     leer-cartulinas-lote  30 fotos, hasta 30 clientes
//
// La tarjeta del arranque promete «si tienes 40 préstamos en una libreta, unos
// 20 minutos» y colgaba del PRIMERO, que no puede devolver más de uno.
//
// Medido en producción el 15 ago 2026:
//
//     conversión según clientes cargados   0 → 0,6% · 1-5 → 1% · 6-20 → 20,9%
//                                          21-50 → 46,4% · 51+ → 84,4%
//     quien carga rápido (5+ en 10 min)    paga el 51%
//     llegan a /migrador                   104 de 483
//     de esos, LOGRAN cargar               29 (28%)
//
// El muro está en pasar de cinco clientes, y la vía que lo pasa vivía fuera
// del arranque. Eso explica además por qué el 97% carga de a poco: la ráfaga
// nunca estuvo donde se decide.
//
// ⚠ Estas pruebas NO piden que la foto vaya primera. De los 104 que abren el
//   migrador solo 29 consiguen cargar; poner ese paso de primeras mudaría el
//   muro. Fijan que quien ELIGE la foto reciba el lector que cumple lo
//   prometido, y que el paso siga midiéndose.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')

describe('⚠ el arranque usa el lector que cumple lo que promete', () => {
  const wizard = leer('components/onboarding/OnboardingWizard.jsx')

  it('el paso de la foto monta el lector de TANDA', () => {
    expect(wizard).toMatch(/metodo === 'foto' &&[\s\S]{0,80}<LoteFotos/)
  })

  it('no vuelve al lector de a uno, que fusiona todo en un cliente', () => {
    expect(wizard).not.toMatch(/<WizardCartulina/)
  })

  it('⚠ el lector de a uno del asistente no quedó como código muerto', () => {
    /* Un archivo huérfano de 339 líneas que una prueba seguía leyendo era un
       verde falso: afirmaba cosas del arranque sobre código que nadie corre. */
    expect(existsSync(resolve(process.cwd(), 'components/onboarding/wizard/WizardCartulina.jsx'))).toBe(false)
  })

  it('⚠ conserva la salida al Excel que traía el lector viejo', () => {
    /* `WizardCartulina` remataba con «Tengo un Excel o CSV» y «quiero
       registrar manualmente». El de tanda solo trae el segundo. Sin reponer el
       primero, quien entra por la foto y recuerda que tiene el Excel se queda
       sin puerta — así es como un rediseño pierde funciones en silencio. */
    expect(wizard).toMatch(/Tengo un Excel o CSV/)
  })

  it('no avanza si quedaron filas sin guardar', () => {
    // Avanzar con fallos pendientes borra las filas y su motivo: habría que
    // volver a fotografiarlas.
    expect(wizard).toMatch(/if \(quedanFilas\) return/)
  })
})

describe('⚠ el paso sigue midiéndose después de cambiar de lector', () => {
  const lote = leer('app/api/herramientas/leer-cartulinas-lote/route.js')
  const una  = leer('app/api/herramientas/leer-cartulina/route.js')

  it('el lector de tanda apunta sus tres salidas', () => {
    const marcas = lote.match(/evento: 'cartulina_leida'/g) ?? []
    expect(marcas.length, 'alguna salida del lector de tanda no deja rastro').toBe(3)
  })

  it('mide cuánto tarda', () => {
    expect(lote).toMatch(/const arranque = Date\.now\(\)/)
    expect(lote).toMatch(/ms: Date\.now\(\) - arranque/)
  })

  it('⚠ los dos lectores se distinguen en el mismo evento', () => {
    /* Sin `via` los dos caen en el mismo montón y no se puede saber si el
       cambio de cableado sirvió, que es justo la pregunta. */
    expect(lote.match(/via: 'lote'/g) ?? []).toHaveLength(3)
    expect(una.match(/via: 'una'/g) ?? []).toHaveLength(3)
  })

  it('⚠ el de tanda cuenta CUÁNTOS clientes sacó, no solo si leyó', () => {
    /* La promesa es «40 préstamos en 20 minutos». Un lector que devuelve un
       cliente por foto no la cumple aunque no falle ni una vez. */
    expect(lote).toMatch(/clientes: clientes\.length/)
  })
})
