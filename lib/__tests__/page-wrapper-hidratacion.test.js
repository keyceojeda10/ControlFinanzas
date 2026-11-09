/**
 * EL <div> DE CADA PANTALLA NO PUEDE TENER `children` DIRECTO.
 *
 * Medido el 8 nov 2026 en el espejo, con clics y archivos en caché: el error
 * #418 de React tiraba el armazón entero en 4 de 111 cargas, siempre en
 * `div.page-transition`. Leyendo los punteros de React en el instante del fallo:
 * ya había reclamado ese <div> y lo intentaba reclamar otra vez, porque se había
 * suspendido en él esperando `children`, que aún no había terminado de bajar.
 *
 * Esta prueba solo vigila que el arreglo siga puesto. Lo que demuestra que
 * funciona es `.auditoria/_react418m.mjs`, porque el fallo depende de los tiempos
 * del navegador y aquí no se puede reproducir.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const src = readFileSync(resolve(process.cwd(), 'components/layout/PageWrapper.jsx'), 'utf8')

describe('PageWrapper', () => {
  it('pone un componente entre el <div> y el contenido de la pantalla', () => {
    expect(src).toMatch(/<div className="page-transition h-full">\s*<Contenido>\{children\}<\/Contenido>\s*<\/div>/)
  })

  it('y ese componente no pinta nada propio: no agrega ningún elemento a la pantalla', () => {
    expect(src).toMatch(/function Contenido\(\{ children \}\) \{\s*return children\s*\}/)
  })
})
