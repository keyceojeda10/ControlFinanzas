// lib/__tests__/rango-de-clientes-en-cristiano.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El dueño cambió el formulario de Meta Ads (v17 → v18) y preguntó si había que
// ajustar algo de nuestro lado. El informe que traía revisó los NOMBRES de los
// campos —y ahí acertó, los tres mapean— pero no los VALORES.
//
// Los valores del v18 son `menos_de_20`, `20_50`, `50_100`, `mas_de_100`. Y el
// rango entra en el prompt del bot, o sea que se lo lee el cliente. Salía por
//
//     (lead.cantClientes || '').replace(/_/g, ' ')
//
// que convierte `20_50` en **«20 50»**.
//
// ⚠ NO LO ROMPIÓ EL FORMULARIO NUEVO: ya estaba roto. Contados en producción,
// **610 de 1.220 leads con dato** (los `20_50` y `50_100`, que ya llegaban de
// versiones anteriores) recibieron el rango mal escrito. Lo que hace el v18 es
// volverlo universal: de ahora en adelante TODOS los de 20 a 100 caen ahí.
//
// Y por eso no se arregla con un mapa: Meta ha mandado **16 formas distintas**
// de decir cuatro rangos. Se leen los números y las palabras «menos»/«más»,
// que es lo único que no cambia entre versiones.

import { describe, it, expect } from 'vitest'
import { textoCantClientes, prettyCantClientes, prettyMetodoActual } from '../fb-leads.js'

describe('el formulario vivo (v18)', () => {
  // Traídos de la definición real: graph.facebook.com/v21.0/1304563842742818
  it.each([
    ['menos_de_20', 'menos de 20'],
    ['20_50', '20 a 50'],
    ['50_100', '50 a 100'],
    ['mas_de_100', 'más de 100'],
  ])('%s → %s', (code, esperado) => {
    expect(textoCantClientes(code)).toBe(esperado)
  })

  it('⚠ los dos que rompían: nunca más «20 50» ni «50 100»', () => {
    expect(textoCantClientes('20_50')).not.toMatch(/^\d+ \d+$/)
    expect(textoCantClientes('50_100')).not.toMatch(/^\d+ \d+$/)
  })
})

describe('las 16 formas que Meta ha mandado de verdad', () => {
  /* Sacadas de `SELECT cantClientes, COUNT(*) FROM Lead GROUP BY 1`. Cada una
     con su número de leads, para que se vea que ninguna es hipotética. */
  it.each([
    ['20_a_50', '20 a 50'],          // 365 leads
    ['menos_de_20', 'menos de 20'],  // 351
    ['más_de_100', 'más de 100'],    // 277 — con tilde
    ['50_a_100', '50 a 100'],        // 193
    ['20_50', '20 a 50'],            // 82
    ['50_100', '50 a 100'],          // 61
    ['20_–_50', '20 a 50'],          // 32 — guion largo
    ['50_–_100', '50 a 100'],        // 30
    ['menos_20', 'menos de 20'],     // 6
    ['mas_100', 'más de 100'],       // 5
    ['r_1_20', '1 a 20'],            // 5 — prefijo de otra versión
    ['r_51_150', '51 a 150'],        // 2
    ['menos de 20', 'menos de 20'],  // 2 — ya con espacios
    ['50 – 100', '50 a 100'],        // 2
    ['más de 100', 'más de 100'],    // 2
  ])('%s → %s', (code, esperado) => {
    expect(textoCantClientes(code)).toBe(esperado)
  })

  it('vacío es vacío, no «undefined» ni «0»', () => {
    expect(textoCantClientes('')).toBe('')
    expect(textoCantClientes(null)).toBe('')
    expect(textoCantClientes(undefined)).toBe('')
  })

  it('lo que no reconoce lo devuelve legible, no lo pierde', () => {
    expect(textoCantClientes('no_sabe')).toBe('no sabe')
  })
})

describe('la alerta de Telegram dice lo mismo que el bot', () => {
  /* Si el aviso al admin y el mensaje al lead escribieran el rango de dos
     formas distintas, el día que una se rompa la otra lo tapa. */
  it.each(['menos_de_20', '20_50', '50_100', 'mas_de_100'])('%s', (code) => {
    expect(prettyCantClientes(code)).toBe(textoCantClientes(code))
  })
})

describe('el método actual: los que de verdad llegan', () => {
  /* El mapa tenía `libreta`, `excel`, `memoria`… que suman CINCO registros en
     toda la historia. Los cuatro vivos —1.027 leads— no estaban, así que la
     alerta enseñaba el código crudo. */
  it.each([
    ['cuaderno_papel', /Cuaderno o papel/],   // 617 leads
    ['excel_sheets', /Excel o Google Sheets/], // 170
    ['app_basica', /app básica/],              // 159
    ['no_llevo_control', /No lleva control/],  // 81
  ])('%s se traduce', (code, esperado) => {
    expect(prettyMetodoActual(code)).toMatch(esperado)
  })

  it('los de la versión vieja siguen funcionando', () => {
    expect(prettyMetodoActual('libreta')).toMatch(/Libreta/)
    expect(prettyMetodoActual('excel')).toMatch(/Excel/)
  })
})

describe('el bot no vuelve a escribir el rango a mano', () => {
  /* La razón por la que este archivo existe: tres sitios de `agente.js` hacían
     su propio `.replace(/_/g, ' ')`, y ese texto va al prompt. */
  it('agente.js no tiene ningún replace de guiones bajos sobre cantClientes', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(process.cwd(), 'lib/bot-v2/agente.js'), 'utf8')
    const sinNotas = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(sinNotas).not.toMatch(/cantClientes[^)]*replace\(\/_\/g/)
    expect(sinNotas).toMatch(/textoCantClientes\(lead\.cantClientes\)/)
  })
})
