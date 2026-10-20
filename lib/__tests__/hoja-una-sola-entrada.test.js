/* Las «pantallas fantasma» del botón Volver (2 sep 2026). Cada hoja metía su
   entrada de historia y no la retiraba; peor, el efecto dependía de `onCerrar`
   —una flecha nueva en cada render— así que cada re-render del padre con la
   hoja abierta metía OTRA. El «Volver» de la cabecera hace `router.back()` y
   consumía una entrada muerta por toque. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('components/cf/HojaInferior.jsx', 'utf8')

describe('una sola entrada de historia para todas las hojas', () => {
  it('las hojas se registran en una pila compartida', () => {
    expect(SRC).toMatch(/export function registrarHoja\(hoja\)/)
    expect(SRC).toMatch(/return registrarHoja\(\{ cerrar: \(\) => refCerrar\.current\?\.\(\) \}\)/)
  })

  it('el efecto de historia depende SOLO de `abierta`', () => {
    const i = SRC.indexOf('return registrarHoja(')
    expect(i).toBeGreaterThan(0)
    expect(SRC.slice(i, i + 160), 'volvió `onCerrar` a las deps: una entrada por tecla').toMatch(/\}, \[abierta\]\)/)
  })

  it('la entrada se retira diferida, y solo si la de arriba es nuestra', () => {
    expect(SRC).toMatch(/retiradaPendiente = setTimeout\(/)
    expect(SRC).toMatch(/if \(window\.history\.state\?\.cfHoja\) window\.history\.back\(\)/)
  })

  it('si al cerrar una queda otra abierta, se vuelve a meter la entrada', () => {
    const i = SRC.indexOf('function alPopstate()')
    expect(SRC.slice(i, i + 400)).toMatch(/if \(pila\.length > 1\) meterEntrada\(\)/)
  })
})

/* Carlos, 19 oct 2026, en la ayuda de una ruta con 10 videos: «el último sale
   medio cortado, no da scroll… y cuando le pincho al video no me abre nada,
   solamente se sale del modal». Dos fallos, los dos de la hoja. */
describe('una hoja que abre otra en el mismo toque, y una lista larga dentro', () => {
  const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('el cuerpo de la hoja lleva la clase que impide encogerse a sus hijos', () => {
    expect(SRC).toMatch(/<div className="cf-hoja-cuerpo" style=\{\{\s*flex: 1, minHeight: 0, overflowY: 'auto',/)
    const css = readFileSync('app/globals.css', 'utf8')
    // Sin capa: en `@layer base` el minificador de Next la quitaba del CSS servido.
    expect(css).toMatch(/^\.cf-hoja-cuerpo > \* \{ flex-shrink: 0; \}$/m)
  })

  it('el reproductor del profe registra su hoja en el MISMO render en que se abre', () => {
    // Si esperaba un render (`montado`), el `back()` diferido de la ayuda que se
    // cerraba le llegaba a él y lo cerraba.
    const src = sinComentarios(readFileSync('components/tutoriales/ReproductorProfe.jsx', 'utf8'))
    expect(src).not.toMatch(/if \(!montado\)/)
    expect(src).not.toMatch(/\bmontado &&/)
    expect(src).toMatch(/<HojaInferior/)
  })
})
