import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { INFORMES } from '@/lib/reportes/catalogo'

/* ══ UNA SOLA FORMA DE BAJAR CADA COSA ════════════════════════════════════
 *
 * «Hay reportes por todos lados. Hay reportes en caja, hay reportes en
 *  reportes, hay reportes en cómo va el negocio. Unos están abajo, otros
 *  arriba en cabecera, otros al lado de los títulos. Si la gente va a buscar
 *  un reporte específico, de pronto ni siquiera está en el apartado de
 *  reportes.»
 *
 * Caja bajaba su propio CSV y Analíticas su propio PDF, en paralelo a los
 * informes que hacen lo mismo. Dos formas de bajar lo mismo son, tarde o
 * temprano, dos cifras distintas — que es el defecto que esta app ya tiene
 * documentado en tres funciones de fecha y en dos de ganancia.
 *
 * Los botones NO se quitan: la gente ya los busca ahí. Llevan al informe. */

const leer = (r) => readFileSync(join(process.cwd(), r), 'utf8')

describe('los atajos llevan al informe, no a una descarga propia', () => {
  const CAJA = leer('app/(dashboard)/caja/page.jsx')
  const ANALITICAS = leer('app/(dashboard)/dashboard/analiticas/page.jsx')

  it('caja abre «El día» con ESE día puesto', () => {
    expect(CAJA).toMatch(/\/reportes\/dia\?/)
    expect(CAJA, 'volvió la descarga propia de caja').not.toMatch(/api\/pagos\/export\?\$\{qs/)
    // El día que se está mirando, no «hoy» a secas: la caja se abre en otra fecha.
    expect(CAJA).toMatch(/fecha: fechaSeleccionada/)
  })

  it('analíticas abre «Cómo rindió el negocio»', () => {
    expect(ANALITICAS).toMatch(/\/reportes\/rendimiento/)
    expect(ANALITICAS, 'volvió la descarga propia de analíticas')
      .not.toMatch(/a\.download = `rendimiento-/)
  })

  it('⚠ y el botón sigue estando: no se quitó, se recableó', () => {
    expect(CAJA).toMatch(/verInformeDelDia/)
    expect(ANALITICAS).toMatch(/verInformeDeRendimiento/)
  })
})

describe('la pantalla del informe entiende con qué la llaman', () => {
  const PANTALLA = leer('app/(dashboard)/reportes/[informe]/page.jsx')

  it('lee el período de la URL', () => {
    expect(PANTALLA).toMatch(/useSearchParams/)
    expect(PANTALLA).toMatch(/periodoPedido/)
  })

  it('⚠ pero solo uno que ESE informe ofrezca', () => {
    /* Con un período cualquiera la pastilla se quedaba sin marcar y la pantalla
       pedía al servidor un tramo que nadie podía ver escrito. */
    expect(PANTALLA).toMatch(/informe\?\.periodos \?\? \[\]\)\.includes\(periodoPedido\)/)
  })

  it('y las fechas sueltas se validan antes de usarse', () => {
    // `new Date('cualquier cosa')` da `Invalid Date` y no revienta: lista vacía
    // sin un solo error. Mismo cuidado que en el filtro de préstamos.
    const trozos = PANTALLA.match(/\\d\{4\}-\\d\{2\}-\\d\{2\}/g) ?? []
    expect(trozos.length).toBeGreaterThanOrEqual(2)
  })
})

describe('los atajos que declara el catálogo existen de verdad', () => {
  it('cada `atajoDesde` apunta a una pantalla que enlaza su informe', () => {
    /* El catálogo declaraba `atajoDesde` desde el 16 de agosto y el cable no
       estaba puesto: un dato que dice algo que no es cierto. */
    const PANTALLAS = {
      '/caja': 'app/(dashboard)/caja/page.jsx',
      '/dashboard/analiticas': 'app/(dashboard)/dashboard/analiticas/page.jsx',
    }
    for (const inf of INFORMES) {
      const fichero = PANTALLAS[inf.atajoDesde]
      if (!fichero) continue          // /reportes es el índice: se enlaza solo
      expect(leer(fichero), `${inf.atajoDesde} no enlaza el informe «${inf.id}»`)
        .toMatch(new RegExp(`/reportes/${inf.id}`))
    }
  })
})
