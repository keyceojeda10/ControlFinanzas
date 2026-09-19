// El service worker no vuelve a bajar lo que ya tiene (19 sep 2026).
//
// «se queda pegado, se sale uno para un lado para volver a ingresar y queda en
//  blanco y se queda cargando» — la cartera más grande.
//
// `sincronizarTodo` corre cada 90 s y manda al SW la ficha de cada cliente y
// cada préstamo; el SW las bajaba TODAS cada vez. Medido: el 97% del tráfico
// del servidor eran tres teléfonos bajando su cartera entera en bucle —618,
// 392 y 240 fichas distintas en 95 s— contra 7 peticiones de una persona
// navegando.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const SW = readFileSync(path.join(process.cwd(), 'public/sw.js'), 'utf8')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const CODIGO = sinComentarios(SW)

describe('CACHE_PAGES salta las fichas que ya están', () => {
  it('pregunta a la caché ANTES de pedir a la red', () => {
    const i = CODIGO.indexOf("e.data?.type === 'CACHE_PAGES'")
    expect(i).toBeGreaterThan(-1)
    const bloque = CODIGO.slice(i, i + 1500)
    const salto = bloque.indexOf('if (await cache.match(url)) continue')
    const pedido = bloque.indexOf("await fetch(url, { credentials: 'same-origin' })")
    expect(salto, 'volvió a bajar la cartera entera cada 90 s').toBeGreaterThan(-1)
    // El orden importa: comprobar después de pedir no ahorra nada.
    expect(salto).toBeLessThan(pedido)
  })

  it('y los chunks ya lo hacían: las dos mitades con la misma regla', () => {
    expect(CODIGO).toMatch(/const existing = await cache\.match\(chunk\)/)
  })
})

describe('⚠ activate no borra la caché de fichas si el nombre no cambia', () => {
  it('solo borra las cachés con OTRO nombre', () => {
    /* Es lo que permite que el arreglo actúe en el acto: el SW nuevo hereda la
       caché llena. Si esto cambiara a «borrar todo», cada release volvería a
       disparar la avalancha. */
    expect(CODIGO).toMatch(/\.filter\(\(k\) => k !== CACHE_NAME && k !== API_CACHE/)
  })
})
