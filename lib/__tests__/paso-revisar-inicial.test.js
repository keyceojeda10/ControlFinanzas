// lib/__tests__/paso-revisar-inicial.test.js
//
// I7. Volver desde «Importar» (paso 4) a «Revisar» (paso 3) remonta
// `PasoRevisar`: sus `useState` vuelven a arrancar desde sus valores por
// defecto. La casilla de domingos volvía a marcarse y la ruta volvía a ser la
// de la planilla, deshaciendo en silencio una elección explícita del dueño
// (una cuenta entera, no solo esta importación). El arreglo: pasarle las
// elecciones previas (`datosImportar`) como `inicial`, y que sus
// inicializadores las lean cuando existan.
//
// Anclado en el CÓDIGO (JSX / expresiones), no en comentarios: este repo cita
// literalmente a los clientes en sus comentarios y un `indexOf` de prosa cae
// en el comentario en vez de en el JSX.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

describe('I7: la pantalla le pasa sus elecciones previas a PasoRevisar', () => {
  const page = src('app/(dashboard)/carga-masiva/page.jsx')

  it('PasoRevisar se renderiza con inicial={datosImportar}', () => {
    expect(page).toMatch(/<PasoRevisar[\s\S]{0,700}inicial=\{datosImportar\}/)
  })

  it('datosImportar se limpia al reiniciar y al validar datos nuevos (mapeo o planilla)', () => {
    // handleReiniciar
    const reiniciar = page.slice(page.indexOf('const handleReiniciar'), page.indexOf('const handleReiniciar') + 400)
    expect(reiniciar).toMatch(/setDatosImportar\(null\)/)

    // handleMapeoConfirmado: una fila nueva no puede heredar la ruta/domingos de la anterior
    const mapeo = page.slice(page.indexOf('const handleMapeoConfirmado'), page.indexOf('const handleCorregir'))
    expect(mapeo).toMatch(/setDatosImportar\(null\)/)

    // handlePlanilla: lo mismo para el PDF de Crossbox
    const planilla = page.slice(page.indexOf('const handlePlanilla'), page.indexOf('const handleMapeoConfirmado'))
    expect(planilla).toMatch(/setDatosImportar\(null\)/)
  })
})

describe('I7: PasoRevisar restaura sus elecciones desde `inicial`', () => {
  const comp = src('components/carga-masiva/PasoRevisar.jsx')

  it('acepta `inicial` en su firma', () => {
    expect(comp).toMatch(/export default function PasoRevisar\([^)]*\binicial\s*=\s*null\b/)
  })

  it('rutaId sale de inicial.rutaId cuando hay inicial', () => {
    expect(comp).toMatch(/inicial\s*\?\s*\(inicial\.rutaId/)
  })

  it('crearNueva sale de !!inicial.crearRuta', () => {
    expect(comp).toMatch(/!!inicial\.crearRuta/)
  })

  it('nuevaRuta sale de inicial.crearRuta ?? \'\'', () => {
    expect(comp).toMatch(/inicial\.crearRuta \?\? ''/)
  })

  it('noCobrarDomingos sale de inicial.noCobrarDomingos', () => {
    expect(comp).toMatch(/inicial\s*\?\s*!!inicial\.noCobrarDomingos/)
  })
})
