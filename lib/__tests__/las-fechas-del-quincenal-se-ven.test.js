/* La pantalla de crear enseña EN QUÉ FECHAS va a cobrar.
 *
 * ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
 *
 *   «Escogía el día, el primer día, escogía el segundo día y me mandaba para
 *    otro mes. No sé si para ser más rápido o para que sea más específico,
 *    escoger día y mes.»
 *
 * Pidió poder poner el MES a mano. Lo que necesitaba era VER las fechas: había
 * dos casillas de número peladas —«Primer cobro», «Segundo cobro»— y la
 * pantalla no nombraba ni una fecha, así que escribir «16» no decía si caía
 * este mes o el siguiente. Y de eso depende si el préstamo nace en mora.
 *
 * Poner el mes a mano habría sido una TERCERA fuente de verdad para el
 * calendario, que es justo el fallo que esto acompaña —ver
 * `el-quincenal-no-se-salta-el-primer-cobro`—. Se enseña la cuenta, no se abre
 * otra forma de contradecirla. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fechaDePeriodo } from '@/lib/dinero/calendario'

const src = readFileSync('app/(dashboard)/prestamos/nuevo/page.jsx', 'utf8')

describe('las fechas del quincenal se ven antes de crear', () => {
  it('el renglón está en el JSX, no solo en un comentario', () => {
    // Anclado en la expresión que se PINTA. `src.includes('Le cobras el')` a
    // secas también acierta dentro del comentario de arriba.
    expect(src).toMatch(/Le cobras el \{dosPrimerosCobros\[0\]\}/)
  })

  it('⚠ las fechas salen de `fechaDePeriodo`, no de una cuenta propia', () => {
    /* Es la razón de ser de todo esto. Si alguien sustituye la llamada por
       aritmética a mano, vuelven a existir dos calendarios y la pantalla dirá
       una fecha y el préstamo otra. */
    expect(src).toContain("import { fechaDePeriodo } from '@/lib/dinero/calendario'")
    expect(src).toMatch(/fechaDePeriodo\(1, args\)/)
    expect(src).toMatch(/fechaDePeriodo\(2, args\)/)
    // Ni un solo salto de quincena escrito a mano en el fichero.
    expect(src).not.toMatch(/15\s*\*\s*(24|86400000|864e5)/)
  })

  it('las fechas se leen en UTC, o un cobro del día 1 se lee día 31', () => {
    const bloque = src.slice(src.indexOf('const dosPrimerosCobros'), src.indexOf('// Cálculo en tiempo real'))
    expect(bloque).toContain("timeZone: 'UTC'")
  })

  it('el caso del prestamista: 16 y 31 desde el 10 de agosto', () => {
    const args = { fechaInicio: new Date('2026-08-10T05:00:00.000Z'),
      freq: 'quincenal', diasPeriodo: 15, diaCobroMes: 16, diaCobroMes2: 31 }
    const d = (n) => fechaDePeriodo(n, args).toISOString().slice(0, 10)
    // Es lo que la pantalla le va a escribir, y lo que el sistema va a cobrar.
    expect([d(1), d(2)]).toEqual(['2026-08-16', '2026-08-31'])
  })

  it('con un solo día puesto también contesta', () => {
    // `diaCobroMes2` es opcional: el segundo campo puede quedar vacío.
    const args = { fechaInicio: new Date('2026-08-27T05:00:00.000Z'),
      freq: 'quincenal', diasPeriodo: 15, diaCobroMes: 31 }
    const d = (n) => fechaDePeriodo(n, args).toISOString().slice(0, 10)
    // Septiembre no tiene 31: se cobra el último.
    expect([d(1), d(2)]).toEqual(['2026-08-31', '2026-09-30'])
  })
})
