// lib/__tests__/el-gasto-borrado-devuelve-la-plata.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Oswaldo Castilla (Inversiones L&D), 16 ago 2026, 9:08 de la mañana:
//
//   «Hermano, buenos días. Es que se me olvidó cerrar anoche que me ocupé»
//   + captura de su caja: «Hoy la cuenta no cierra: $282.000 de gastos que no
//     cuadran.»
//
// Su mañana entera, sacada del registro de actividad:
//
//   09:05  registra gasto $282.000 «Cicla de mi mamá»
//   09:07  ajuste manual de entrada  +$282.000   ← intenta cuadrar
//   09:13  BORRA el gasto
//   09:14  ajuste manual de salida   −$282.000   ← deshace lo suyo
//   11:40  lo registra otra vez, como «Gasolina»
//   11:48  cierra la caja
//   11:51  otro ajuste de entrada    +$282.000
//
// Seis intentos contra un descuadre que no era suyo. Dos fallos nuestros:
//
// ── 1. EL REVERSO DEPENDÍA DE UN ESTADO, NO DEL LIBRO ──────────────────────
//
// Borrar o rechazar un gasto devolvía la plata solo `if (gasto.estado ===
// 'aprobado')`. Si el estado y el libro se separaban por cualquier vía, el
// egreso se quedaba dentro para siempre: la caja de ese día decía que salió una
// plata sin ningún gasto detrás, y no había forma de arreglarlo desde la app.
//
// Medido en producción: 3 casos en 3 negocios, $2.020.000 — el mayor de
// $1.688.000, de julio. ⚠ Mi primera medición dijo 15 y $3.018.016: contaba
// como roto todo movimiento sin su gasto SIN mirar si ya tenía reverso. Doce lo
// tenían. La cifra que se le da al dueño para decidir hay que medirla bien.
//
// ── 2. EL MOVIMIENTO NACÍA CON LA FECHA DE HOY ─────────────────────────────
//
// El gasto guarda la fecha que elige el usuario; su movimiento de capital nacía
// con la de hoy. Registrar el gasto de ayer dejaba el gasto en el día 15 y el
// movimiento en el 16, y la conciliación compara día contra día: los DOS días
// descuadrados a la vez. Medido: 20 gastos así en 6 negocios, $956.000.
//
// El estado es una opinión. El libro es el hecho.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { gastoAsentadoSinRevertir } from '@/lib/capital'

/** Un `tx` de mentira que solo sabe devolver los movimientos que se le pongan. */
const txCon = (movs) => ({
  movimientoCapital: { findMany: async () => movs },
})

describe('⚠ cuánto debe devolver el libro por un gasto', () => {
  it('un gasto asentado y sin tocar se devuelve entero', async () => {
    const tx = txCon([{ tipo: 'gasto', monto: 282000, descripcion: 'Gasto: Cicla de mi mamá' }])
    expect(await gastoAsentadoSinRevertir(tx, 'org', 'g1')).toBe(282000)
  })

  it('⚠ uno que YA se devolvió no se devuelve dos veces', async () => {
    /* Sin esto, borrar un gasto ya rechazado metería la plata otra vez y el
       negocio acabaría con capital de más — el fallo contrario, y peor. */
    const tx = txCon([
      { tipo: 'gasto', monto: 282000, descripcion: 'Gasto: Cicla' },
      { tipo: 'ajuste', monto: 282000, descripcion: 'Reverso gasto rechazado: Cicla' },
    ])
    expect(await gastoAsentadoSinRevertir(tx, 'org', 'g1')).toBe(0)
  })

  it('un gasto que nunca se asentó no devuelve nada', async () => {
    expect(await gastoAsentadoSinRevertir(txCon([]), 'org', 'g1')).toBe(0)
  })

  it('⚠ los ajustes que NO son reversos no cuentan como devolución', async () => {
    /* Oswaldo metió ajustes manuales de caja intentando cuadrar. Si contaran
       como reverso, borrar el gasto ya no devolvería nada y su plata quedaría
       descontada dos veces. */
    const tx = txCon([
      { tipo: 'gasto', monto: 282000, descripcion: 'Gasto: Cicla' },
      { tipo: 'ajuste', monto: 282000, descripcion: 'Ajuste de caja manual (entrada)' },
    ])
    expect(await gastoAsentadoSinRevertir(tx, 'org', 'g1')).toBe(282000)
  })

  it('nunca devuelve negativo', async () => {
    const tx = txCon([
      { tipo: 'gasto', monto: 50000, descripcion: 'Gasto: X' },
      { tipo: 'ajuste', monto: 90000, descripcion: 'Reverso gasto eliminado: X' },
    ])
    expect(await gastoAsentadoSinRevertir(tx, 'org', 'g1')).toBe(0)
  })
})

describe('⚠ los dos caminos preguntan al libro, no al estado', () => {
  const RUTA = readFileSync(resolve(process.cwd(), 'app/api/gastos/[id]/route.js'), 'utf8')

  it('al BORRAR se reversa lo que el libro tenga asentado', () => {
    expect(RUTA).toMatch(/const debeDevolver = await gastoAsentadoSinRevertir\(tx, session\.user\.organizationId, id\)/)
    expect(RUTA).toMatch(/if \(debeDevolver > 0\)/)
  })

  it('al RECHAZAR también', () => {
    expect(RUTA).toMatch(/debeDevolverAlRechazar = estado === 'rechazado'/)
  })

  it('⚠ y NINGUNA reversión se decide ya por el estado del gasto', () => {
    /* Contar las apariciones de `estado === 'aprobado'` fue mi primer intento y
       era una mala prueba: quedan tres y las tres son legítimas —la guardia de
       doble aprobación y la que asienta al aprobar—. Lo que hay que exigir es
       que las dos DEVOLUCIONES no cuelguen del estado, que es lo que dejaba el
       egreso dentro para siempre. Se mira el código sin comentarios, o el propio
       texto que explica el fallo haría pasar la prueba. */
    const codigo = RUTA.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(codigo).not.toMatch(/if \(gasto\.estado === 'aprobado'\)/)
    expect(codigo).not.toMatch(/estado === 'rechazado' && gastoExistente\.estado === 'aprobado'/)
    // La que SÍ se queda: no asentar dos veces el mismo gasto.
    expect(codigo).toMatch(/if \(estado === 'aprobado' && gastoExistente\.estado === 'aprobado'\)/)
  })
})

describe('⚠ el movimiento lleva la fecha del gasto, no la de hoy', () => {
  it('al aprobar se le pasa la fecha del gasto', () => {
    const RUTA = readFileSync(resolve(process.cwd(), 'app/api/gastos/[id]/route.js'), 'utf8')
    expect(RUTA).toMatch(/fecha: gastoExistente\.fecha/)
  })

  it('y el registrador la sabe poner', () => {
    const CAPITAL = readFileSync(resolve(process.cwd(), 'lib/capital.js'), 'utf8')
    expect(CAPITAL).toMatch(/\.\.\.\(fecha \? \{ createdAt: fecha \} : \{\}\)/)
  })

  it('⚠ sin fecha se comporta como siempre', () => {
    /* El resto de movimientos —recaudos, desembolsos— no la pasan y tienen que
       seguir naciendo con la hora de la base. */
    const CAPITAL = readFileSync(resolve(process.cwd(), 'lib/capital.js'), 'utf8')
    expect(CAPITAL).toMatch(/fecha = null,/)
  })
})
