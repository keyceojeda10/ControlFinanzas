// «LO QUE TOCA COBRAR HOY» DECÍA TRES COSAS EN TRES PANTALLAS (19 sep 2026).
//
//   Inicio           «de $613.167 que toca cobrar»  y, en la MISMA página,
//                    «Por ruta hoy … de $1.063.167»
//   Rutas            «te faltan $834.767» (o sea, de $1.063.167)
//   Cobros de hoy    «de $3.442.901»
//
// Dos fallos distintos:
//
//  1. Inicio y Rutas usan la misma función (`tienePeriodoEsperadoHoy`), pero
//     cada API con su `select`, y a cada una le faltaban los campos que pedía la
//     otra. Al inicio, los del DÍA DE COBRO: un semanal que cobra los sábados
//     pero empezó un martes no contaba. Desglosado en un negocio real del
//     espejo: $2.195.000 de semanales anclados a hoy que se ignoraban menos
//     $360.000 anclados al lunes que se contaban de más = $1.835.000, la
//     diferencia exacta entre las dos cifras. Medido en doce negocios: en cuatro
//     Rutas decía MÁS que el inicio —imposible, el inicio incluye a quien no
//     tiene ruta—; después del arreglo, en ninguno.
//  2. Cobros de hoy sumaba la cuota de TODOS los préstamos activos, antes del
//     filtro que decide quién entra en la lista.
//
// Un `select` que no pide un campo no da error: decide mal en silencio. Esta
// prueba fija que las tres APIs piden TODO lo que la función lee.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const leer = (f) => readFileSync(path.join(process.cwd(), f), 'utf8')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// Lo que `tienePeriodoEsperadoHoy` y `calcularProximoCobro` leen del préstamo.
const CAMPOS = ['cuotaDiaria', 'frecuencia', 'fechaInicio', 'diaCobroSemana', 'diaCobroMes', 'diaCobroMes2', 'primerCobro', 'proximoCobroManual', 'diasSinCobro', 'modoInteres']

describe('las tres pantallas deciden «hoy toca» con la misma información', () => {
  // «Mi resumen» del cobrador era la CUARTA cifra: «Meta $815.067» (la cuota de
  // todos los clientes de la ruta) donde su inicio decía «de $520.000».
  for (const f of ['app/api/dashboard/resumen/route.js', 'app/api/rutas/route.js', 'app/api/cobros-hoy/route.js', 'app/api/mis-estadisticas/route.js']) {
    it(`${f} pide todos los campos del día de cobro`, () => {
      const src = sinComentarios(leer(f))
      for (const c of CAMPOS) {
        expect(new RegExp(`\\b${c}:\\s*true`).test(src), `${f} no pide «${c}»`).toBe(true)
      }
      expect(src).toMatch(/tienePeriodoEsperadoHoy\(/)
    })
  }

  it('⚠ Cobros de hoy mide el día contra lo que TOCA, no contra todas las cuotas', () => {
    const src = sinComentarios(leer('app/api/cobros-hoy/route.js'))
    expect(src).not.toMatch(/esperadoHoyTotal \+= cuotaReal/)
    expect(src).toMatch(/if \(tienePeriodoEsperadoHoy\(p, _diasSinCobroDelPrestamo, diasExcluidosPrestamo, festivos\)\) \{\s*esperadoHoyTotal \+= p\.cuotaDiaria \?\? 0/)
  })

  it('los días sin cobro del PRÉSTAMO mandan en las tres', () => {
    expect(sinComentarios(leer('app/api/dashboard/resumen/route.js'))).toMatch(/obtenerDiasSinCobro\(p\.cliente, p\.cliente\?\.ruta, org, p\)/)
    expect(sinComentarios(leer('app/api/rutas/route.js'))).toMatch(/obtenerDiasSinCobro\(cliente, r, org, prestamo\)/)
  })

  it('y la cabecera lo llama igual que el inicio', () => {
    expect(leer('components/pantallas/CobrarHoy.jsx')).toMatch(/de \$\{meta\} que toca cobrar · /)
  })

  it('⚠ «Mi resumen» cuenta también a los clientes en mora', () => {
    /* Filtraba `estado: 'activo'` y un cliente atrasado tiene `estado: 'mora'`:
       los que estaban en mora no entraban en SU lista de mora (la ruta tenía
       cuatro; la pantalla, uno) ni en lo que toca cobrar hoy. */
    const src = sinComentarios(leer('app/api/mis-estadisticas/route.js'))
    expect(src).not.toMatch(/ruta: \{ cobradorId: userId \},\s*estado: 'activo'/)
    expect(src).toMatch(/ruta: \{ cobradorId: userId \},[\s\S]{0,80}estado: \{ notIn: \['eliminado', 'inactivo'\] \}/)
    // Y la mora se mide con los días sin cobro de verdad, no con `[]`.
    expect(src).not.toMatch(/calcularDiasMora\(p, \[\], festivos\)/)
  })
})
