// lib/__tests__/navegacion-cumple-lo-que-promete.test.js
//
// Dos cosas que el dueño reportó el 14 ago con capturas, y que tienen en común
// que la pantalla decía una cosa y hacía otra.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('«Prestarle a alguien nuevo» empieza por el cliente', () => {
  /* «Este botón no manda a crear un cliente, sino manda a crear un préstamo y se
     salta lo de crear el cliente [...] luego te toca volver o buscar dónde se
     crea el cliente.» Y el asistente de préstamo solo ofrece crear uno cuando no
     hay NINGUNO: con cartera cargada no había salida. */
  const src = leer('components/layout/GlobalSearch.jsx')
  const bloque = src.match(/texto: 'Prestarle a alguien nuevo'[\s\S]*?\}\}/)?.[0] ?? ''

  it('lleva a crear el cliente, no directo al préstamo', () => {
    expect(bloque, 'no se encontró el acceso directo').toBeTruthy()
    expect(bloque).toMatch(/ir\('\/clientes\/nuevo'\)/)
    expect(bloque, 'volvió a saltarse el cliente').not.toMatch(/ir\('\/prestamos\/nuevo'\)/)
  })

  it('y lo que promete el texto es lo que hace', () => {
    expect(bloque).toMatch(/primero el cliente/)
  })

  it('buscar un cliente que no está deja crearlo ahí mismo', () => {
    /* La otra punta de la misma queja: si el cliente es nuevo, el asistente
       decía «Sin resultados» y no ofrecía nada. */
    const wizard = leer('app/(dashboard)/prestamos/nuevo/page.jsx')
    const vacio = wizard.match(/clientesFiltrados\.length === 0 \?[\s\S]{0,700}/)?.[0] ?? ''
    expect(vacio).toMatch(/\/clientes\/nuevo/)
    expect(vacio, 'volvió el callejón sin salida').not.toMatch(/Sin resultados\. Prueba con otro nombre/)
  })
})

describe('⚠ la flecha de volver TERMINA saliendo', () => {
  /* «Si uno spamea esa flecha, lo lógico es que regresara, regresara, y el punto
     final fuera el inicio. Pero queda en un loop que no lo saca de ahí.»

     Causa: dentro de una sección la flecha volvía al índice con `push`, o sea
     AÑADIENDO historial; luego el índice hacía `back()` y caía otra vez dentro
     de la sección. Reproducido en el espejo: seis toques, seis veces clavado. */
  const src = leer('app/(dashboard)/configuracion/page.jsx')
  const manejador = src.match(/onVolver: seccionParam[\s\S]*?: undefined,/)?.[0] ?? ''

  it('salir de una sección RETROCEDE, no apila', () => {
    expect(manejador, 'no se encontró el onVolver de configuración').toBeTruthy()
    expect(manejador).toMatch(/if \(puedeRetroceder\(\)\) router\.back\(\)/)
    expect(manejador, 'volvió el `push` que creaba el ping-pong')
      .not.toMatch(/router\.push\('\/configuracion'\)/)
  })

  it('y sin historial detrás reemplaza en vez de apilar', () => {
    /* Se puede entrar por enlace directo a `?s=seguridad`: ahí no hay nada que
       retroceder y apilar otra entrada reabriría el bucle. */
    expect(manejador).toMatch(/router\.replace\('\/configuracion'\)/)
  })
})
