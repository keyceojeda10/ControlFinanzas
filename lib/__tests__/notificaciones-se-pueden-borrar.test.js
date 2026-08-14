// lib/__tests__/notificaciones-se-pueden-borrar.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Las notificaciones están excelentes, pero hay un botón como de darles a
// leído y ya. Yo le di leídas, pero me van a salir todas ahí, así como tenues,
// pero no se me van a quitar.» — el dueño, 14 ago 2026.
//
// Marcar leída y borrar son dos cosas distintas: leída es «ya lo vi», borrada es
// «fuera». Con solo lo primero la lista crece para siempre y deja de servir.
//
// Y los textos, que también señaló: «ese título de cosas por resolver y lo que
// pasó, la verdad, no me cuenta nada» / «el texto de abajo no se entiende
// absolutamente nada».

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const api = leer('app/api/notificaciones/route.js')
const hoja = leer('components/armazon/CosasPorResolver.jsx')
const pila = leer('components/armazon/PilaAvisos.jsx')

describe('el API sabe borrar', () => {
  it('tiene DELETE', () => {
    expect(api).toMatch(/export async function DELETE/)
  })

  it('⚠ borra SOLO lo del dueño de la notificación', () => {
    /* Misma guarda que el PATCH: sin el `userId` en el WHERE, cualquiera podría
       borrar la notificación de otro mandando su id. */
    const del = api.match(/export async function DELETE[\s\S]*$/)?.[0] ?? ''
    const borrados = del.match(/deleteMany\(\{[\s\S]*?\}\)/g) ?? []
    expect(borrados.length, 'no se encontró ningún deleteMany').toBeGreaterThan(0)
    for (const b of borrados) {
      expect(b, `un deleteMany sin userId: ${b}`).toMatch(/userId: session\.user\.id/)
    }
  })

  it('borra una, o todas las leídas', () => {
    expect(api).toMatch(/body\.borrarLeidas/)
    expect(api).toMatch(/body\.id/)
  })
})

describe('la pantalla deja borrar', () => {
  it('cada aviso trae su botón', () => {
    expect(hoja).toMatch(/aria-label=\{`Borrar aviso/)
    expect(hoja).toMatch(/onBorrar\?\.\(n\.id\)/)
  })

  it('⚠ la fila ya no es un botón dentro de otro', () => {
    /* Era un <button> envolviendo todo, y por eso no había dónde poner el de
       borrar: un botón dentro de otro no es HTML válido. */
    const fila = hoja.match(/function Guardado[\s\S]*?\n\}/)?.[0] ?? ''
    expect(fila).toBeTruthy()
    expect((fila.match(/<button/g) ?? []).length, 'la fila debe tener DOS botones hermanos').toBe(2)
  })

  it('y hay una limpieza grande, solo de las leídas', () => {
    expect(hoja).toMatch(/Borrar leídas/)
    expect(pila).toMatch(/borrarLeidas: true/)
    expect(pila, 'no debe existir un botón que borre lo no leído')
      .not.toMatch(/borrarTodas: true/)
  })

  it('el borrado se ve al instante, sin esperar al servidor', () => {
    expect(pila).toMatch(/setGuardados\(\(prev\) => prev\.filter\(\(n\) => n\.id !== id\)\)/)
  })
})

describe('los textos que no contaban nada', () => {
  it('la hoja se llama Notificaciones', () => {
    expect(hoja).toMatch(/titulo="Notificaciones"/)
    expect(hoja, 'volvió «Cosas por resolver»').not.toMatch(/titulo="Cosas por resolver"/)
  })

  it('fuera el «LO QUE PASÓ»', () => {
    expect(hoja, 'volvió el rótulo en versalitas').not.toMatch(/Lo que pasó/)
  })

  it('fuera el pie sobre la cartera', () => {
    expect(hoja, 'volvió el pie que el dueño no entendía')
      .not.toMatch(/Tu cartera completa/)
  })
})
