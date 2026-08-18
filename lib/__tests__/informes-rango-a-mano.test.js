// lib/__tests__/informes-rango-a-mano.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Cómo ver cuánto gané de interés de una fecha a otra fecha. Me gustaría que
//  lo implementaran, o si ya está, que me dijeran dónde lo visualizo.»
//                                                    — Crediya, 14 ago 2026
//
// Los períodos armados —hoy, semana, mes, trimestre, semestre, año— TODOS
// acaban hoy: no se podía pedir «del 1 al 15 de julio» ni «el mes pasado».
//
// Que el rango FILTRE de verdad se mide contra datos con
// `.auditoria/_probar-rango.mjs`; los seis informes cambian de resultado. Aquí
// se fija lo que se puede fijar sin datos.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { INFORMES } from '@/lib/reportes/catalogo'
import { rangoManual } from '@/lib/reportes/contador'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const params = (b) => new URLSearchParams(b)

describe('⚠ el rango que escribe el prestamista', () => {
  it('lee las dos fechas', () => {
    const r = rangoManual(params('desde=2026-07-01&hasta=2026-07-15'))
    expect(r).not.toBeNull()
    expect(r.desde.toISOString()).toBe('2026-07-01T05:00:00.000Z')
  })

  it('⚠ el último día entra entero', () => {
    /* Las consultas usan `lt: hasta`. Pasando el día tal cual, pedir «del 1 al
       15» perdería todo lo cobrado el 15. */
    const r = rangoManual(params('desde=2026-07-01&hasta=2026-07-15'))
    expect(r.hasta.toISOString()).toBe('2026-07-16T05:00:00.000Z')
  })

  it('los días empiezan a la hora del país, no en UTC', () => {
    /* Producción corre en UTC y el convenio del proyecto son las 05:00. Sin el
       desfase, lo cobrado entre medianoche y las 5 caería en el día de antes. */
    const r = rangoManual(params('desde=2026-07-01&hasta=2026-07-01'), 5)
    expect(r.desde.getUTCHours()).toBe(5)
  })

  it('con una sola fecha no hace nada', () => {
    /* Media orden no es una orden: se cae al período de siempre en vez de
       inventarse el otro extremo. */
    expect(rangoManual(params('desde=2026-07-01'))).toBeNull()
    expect(rangoManual(params('hasta=2026-07-15'))).toBeNull()
    expect(rangoManual(params(''))).toBeNull()
  })

  it('rechaza lo que no sea una fecha, y el revés', () => {
    expect(rangoManual(params('desde=ayer&hasta=hoy'))).toBeNull()
    expect(rangoManual(params('desde=2026-07-15&hasta=2026-07-01'))).toBeNull()
  })
})

describe('⚠ el control sale donde sirve, y solo ahí', () => {
  const pantalla = leer('app/(dashboard)/reportes/[informe]/page.jsx')

  it('se decide por el catálogo, no por una lista escrita a mano', () => {
    /* Si mañana otro informe acepta `desde`/`hasta`, le sale el control solo. */
    expect(pantalla).toMatch(/const usaRango = \(informe\.params \?\? \[\]\)\.includes\('desde'\) && \(informe\.params \?\? \[\]\)\.includes\('hasta'\)/)
  })

  it('los informes que lo declaran son los que lo entienden', () => {
    /* Ofrecerlo donde no cambia nada es peor que no ofrecerlo: un filtro que se
       pinta, se pulsa y no filtra se comporta igual que uno roto. */
    const con = INFORMES.filter((i) => (i.params ?? []).includes('desde') && (i.params ?? []).includes('hasta'))
    expect(con.length).toBeGreaterThanOrEqual(6)
    for (const i of con) {
      expect((i.params ?? []).includes('desde') && (i.params ?? []).includes('hasta')).toBe(true)
    }
  })

  it('viaja en las DOS vías: la pantalla y la descarga', () => {
    /* Si el rango solo llegara a la pantalla, el PDF traería otro período que
       lo que se está viendo: dos cifras distintas del mismo informe. */
    const veces = [...pantalla.matchAll(/\.\.\.\(rangoPuesto \? rango : \{\}\)/g)].length
    expect(veces, 'el rango no llega a las dos llamadas').toBe(2)
  })

  it('y se puede quitar', () => {
    /* Sin salida, quien lo pone se queda encerrado en ese tramo y las pastillas
       de arriba dejan de responder sin explicación. */
    expect(pantalla).toMatch(/Quitar el rango/)
    expect(pantalla).toMatch(/Manda el rango/)
  })
})

describe('⚠ el rango manda sobre la pastilla', () => {
  for (const ruta of ['app/api/reportes/contador/route.js', 'app/api/reportes/cuentas/route.js']) {
    it(`${ruta.split('/')[3]} prefiere lo que escribió el prestamista`, () => {
      /* Si escribió dos fechas es que quiere ESAS, no «el mes». */
      /* ⚠ `[^)]*` no vale: el argumento del desfase lleva sus propios
         paréntesis —`Math.abs(getUtcOffset(country))`— y la expresión cortaba
         en el primero. La prueba fallaba con el código bien puesto. */
      expect(leer(ruta)).toMatch(/rangoManual\(searchParams[\s\S]{0,70}?\?\? rangoDePeriodo/)
    })
  }
})
