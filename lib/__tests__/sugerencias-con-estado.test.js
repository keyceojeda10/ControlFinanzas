// lib/__tests__/sugerencias-con-estado.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El banner trajo 7 sugerencias de 4 negocios en tres días y `Sugerencia` no
// tenía ni estado ni respuesta: la pantalla las listaba y nada más. Saber
// cuáles quedaban por atender era releerlas todas y acordarse, y por eso la
// primera tanda se pasó tres días sin que nadie contestara.
//
// Lo que se cuida aquí es que la libreta siga siendo una libreta:
//
//   1. Que los colores de los cuatro estados EXISTAN. Un tono inventado no
//      revienta: sale gris, y entonces «Hecha» y «Sin mirar» se ven igual. Ya
//      pasó en este proyecto con las pastillas.
//   2. Que el API no acepte un estado que la pantalla no sabe pintar.
//   3. Que los botones estén enganchados. Un componente puesto y sin alimentar
//      se ve perfecto en la captura: así se coló el selector de cuenta al
//      renovar.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const PANTALLA = 'app/admin/sugerencias/page.jsx'
const API = 'app/api/admin/sugerencias/route.js'

/* Los estados salen del código de la pantalla, no de una lista escrita aquí:
   si mañana se añade uno, esta prueba lo recoge sola. */
const estadosDeLaPantalla = () => {
  const src = leer(PANTALLA)
  const bloque = src.slice(src.indexOf('const ESTADOS = ['), src.indexOf('const deEstado'))
  return [...bloque.matchAll(/id: '(\w+)'[^}]*tono: '(\w+)'/g)].map((m) => ({ id: m[1], tono: m[2] }))
}

describe('⚠ los cuatro estados se distinguen a la vista', () => {
  it('hay cuatro y ninguno se repite', () => {
    const e = estadosDeLaPantalla()
    expect(e).toHaveLength(4)
    expect(new Set(e.map((x) => x.id)).size).toBe(4)
  })

  it('sus colores existen de verdad en Badge', () => {
    /* `variants[variant] ?? variants.blue`: un tono que no existe NO da error,
       se pinta del color por defecto. Así, cuatro estados distintos acabarían
       viéndose iguales y la libreta dejaría de servir sin avisar. */
    const badge = leer('components/ui/Badge.jsx')
    const declarados = badge.slice(badge.indexOf('const variants = {'), badge.indexOf('export function Badge'))
    for (const { id, tono } of estadosDeLaPantalla()) {
      expect(declarados, `el estado «${id}» usa el tono «${tono}», que no existe`)
        .toMatch(new RegExp(`^\\s*${tono}:`, 'm'))
    }
  })
})

describe('⚠ el API guarda lo que la pantalla sabe pintar', () => {
  const api = leer(API)

  it('conoce exactamente los mismos estados', () => {
    const enApi = [...api.slice(api.indexOf('const ESTADOS = ['), api.indexOf('export async function PATCH'))
      .matchAll(/'(\w+)'/g)].map((m) => m[1])
    expect(enApi.sort()).toEqual(estadosDeLaPantalla().map((e) => e.id).sort())
  })

  it('rechaza uno que no existe en vez de guardarlo', () => {
    expect(api).toMatch(/!ESTADOS\.includes\(estado\)/)
    expect(api).toMatch(/status: 400/)
  })

  it('solo lo abre el superadmin, igual que la lectura', () => {
    /* Son sugerencias de negocios ajenos con su nombre encima. */
    const patch = api.slice(api.indexOf('export async function PATCH'))
    expect(patch).toMatch(/rol !== 'superadmin'/)
    expect(patch).toMatch(/status: 403/)
  })

  it('la fecha la pone la respuesta, no el cambio de estado', () => {
    /* Marcar «Hecha» no es haberle contestado. Si la fecha se pusiera al
       cambiar de estado, la pantalla diría «contestada el 17 de ago» de algo
       que nadie dijo. */
    const patch = api.slice(api.indexOf('export async function PATCH'))
    const fecha = patch.slice(patch.indexOf('respondidaEn'))
    expect(fecha.slice(0, 80)).toMatch(/respuesta \? new Date\(\) : null/)
  })
})

describe('⚠ los botones están enganchados', () => {
  const src = leer(PANTALLA)

  it('cada estado llama a guardar', () => {
    expect(src).toMatch(/onClick=\{\(\) => anotar\(s\.id, \{ estado: e\.id \}\)\}/)
  })

  it('la respuesta también', () => {
    expect(src).toMatch(/anotar\(s\.id, \{ respuesta:/)
  })

  it('y `anotar` llega al API por PATCH', () => {
    const fn = src.slice(src.indexOf('const anotar ='), src.indexOf('const lista ='))
    expect(fn).toContain("'/api/admin/sugerencias'")
    expect(fn).toMatch(/method: 'PATCH'/)
  })

  it('la ficha se mueve al pulsar, sin recargar', () => {
    /* Si hubiera que refrescar para ver el cambio, la siguiente tanda se
       volvería a atender a ciegas: es justo lo que se está arreglando. */
    const fn = src.slice(src.indexOf('const anotar ='), src.indexOf('const lista ='))
    expect(fn).toMatch(/setDatos\(/)
  })
})

describe('⚠ la tabla guarda las tres cosas', () => {
  it('estado, respuesta y cuándo se contestó', () => {
    const schema = leer('prisma/schema.prisma')
    const modelo = schema.slice(schema.indexOf('model Sugerencia {'))
    const cuerpo = modelo.slice(0, modelo.indexOf('\n}'))
    expect(cuerpo).toMatch(/estado\s+String\s+@default\("nueva"\)/)
    expect(cuerpo).toMatch(/respuesta\s+String\?/)
    expect(cuerpo).toMatch(/respondidaEn\s+DateTime\?/)
  })

  it('el estado va como texto, no como enum', () => {
    /* Un enum de Prisma obliga a migrar la base para añadir un estado, y esto
       lo lee una persona, no una regla de negocio. */
    const schema = leer('prisma/schema.prisma')
    expect(schema).not.toMatch(/enum EstadoSugerencia/)
  })
})
