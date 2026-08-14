// lib/__tests__/salir-no-deja-datos-del-anterior.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Dos personas comparten teléfono más de lo que uno cree: el cobrador entrega el
// turno y el dueño entra en el mismo aparato.
//
// La barra VIEJA limpiaba al salir. La NUEVA —la que está en producción— solo
// llamaba a `signOut()`: las respuestas guardadas del anterior se quedaban, y si
// al siguiente le falla la red un momento, la app se las sirve. Es el patrón de
// siempre en este proyecto: el rediseño se dejó una función por el camino.
//
// ⚠ PERO NO SE COPIA ENTERO. La vieja además llamaba a `limpiarDatosOffline()`,
// que hace `indexedDB.deleteDatabase(...)` y se lleva la base local COMPLETA,
// incluidos `pagos_pendientes` y `mutaciones_pendientes`. O sea: un cobrador con
// cobros sin subir que cierre sesión los pierde. Cerrar sesión no puede tragarse
// plata cobrada, así que aquí solo se tira lo que se puede volver a pedir.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/* Sin comentarios. Es la TERCERA vez hoy que una prueba de este tipo se
   tropieza con la nota que explica el arreglo: aquí el comentario nombra
   `limpiarDatosOffline()` justo para decir que NO se llama, y la prueba lo leía
   como si se llamara. Una prueba que lee texto tiene que leer código. */
const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
const armazon = leer('components/armazon/Armazon.jsx')
const salida = armazon.match(/onCerrarSesion=\{[\s\S]*?\n {8}\}\}/)?.[0] ?? ''

describe('al cerrar sesión en la barra nueva', () => {
  it('se encontró el manejador', () => {
    expect(salida, 'cambió la forma de onCerrarSesion: revisar').toBeTruthy()
  })

  it('borra las respuestas guardadas del anterior', () => {
    expect(salida).toMatch(/CLEAR_API_CACHE/)
    expect(salida).toMatch(/olvidarCompartido\(\)/)
  })

  it('⚠ NO borra la base local: ahí viven los pagos sin subir', () => {
    /* `limpiarDatosOffline()` hace `deleteDatabase` y se lleva
       `pagos_pendientes` con todo lo demás. */
    expect(salida, 'cerrar sesión se llevaría los cobros sin sincronizar')
      .not.toMatch(/limpiarDatosOffline/)
  })

  it('y cierra la sesión, que era lo único que hacía antes', () => {
    expect(salida).toMatch(/signOut\(\{ callbackUrl: '\/login' \}\)/)
  })
})
