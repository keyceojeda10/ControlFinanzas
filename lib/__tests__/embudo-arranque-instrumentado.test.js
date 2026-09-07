// lib/__tests__/embudo-arranque-instrumentado.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// De los 29 negocios que se registraron con la campaña nueva (12-15 ago 2026):
// 26 entraron, 16 crearon un cliente —ONCE de ellos exactamente uno, y se
// fueron en menos de quince minutos— y **uno solo** terminó el arranque.
// 17 no pasaron de «traer tu cartera»: nueve se quedaron ahí y ocho la
// saltaron.
//
// Eso lo dice `Organization.onboardingStep`. Lo que NO decía es qué pasa DENTRO
// del paso 2, que son tres pantallas con el mismo número —planes, elegir método,
// y la foto o el Excel—. Sin separarlas no se sabe si se van ante el precio,
// ante las tres opciones, o intentando la foto, y son tres arreglos distintos.
//
// ⚠ Estas pruebas NO fijan un diseño: fijan que la MEDICIÓN siga en pie. Se
//   escribieron antes de tocar el paso 2 a propósito — rediseñarlo sin saber
//   dónde se cae la gente sería adivinar.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')

describe('⚠ el asistente apunta las bifurcaciones que el número no distingue', () => {
  const src = leer('components/onboarding/OnboardingWizard.jsx')

  it('manda los eventos por el endpoint que ya existe', () => {
    // Sin inventar un canal nuevo: es el mismo que usa `page_view`.
    expect(src).toMatch(/\/api\/analytics\/track/)
  })

  for (const [evento, donde] of [
    ['onb_plan_visto',     'VEN la pantalla de planes (6 sep: sin esto no se distinguía irse ahí de no llegar)'],
    ['onb_plan_seguir',    'siguen desde la pantalla de planes'],
    ['onb_cartera_vista',  'VEN «traer tu cartera»'],
    ['onb_plan_pagar',     'se van a pagar desde el asistente'],
    ['onb_metodo',         'qué método de carga eligen'],
    ['onb_cartera_saltada','saltan traer la cartera'],
  ]) {
    it(`apunta cuando ${donde}`, () => {
      expect(src, `falta el evento ${evento}`).toMatch(new RegExp(`marcar\\('${evento}'`))
    })
  }

  it('⚠ el método queda en la metadata, no solo el clic', () => {
    // Sin el `metodo` los tres botones son el mismo evento y no se puede saber
    // cuántos eligen la foto, que es la pregunta.
    expect(src).toMatch(/metodo: 'foto'/)
    expect(src).toMatch(/metodo: 'excel'/)
    expect(src).toMatch(/metodo: 'cero'/)
  })
})

describe('⚠ el lector de fotos deja rastro de su resultado', () => {
  const src = leer('app/api/herramientas/leer-cartulina/route.js')

  it('apunta cada salida del endpoint', () => {
    /* ⚠ SE COMPRUEBA POR MOTIVO, NO POR NÚMERO.
       Estaba clavado en 3 y se cayó al añadir la salida «esta foto es una
       lista, ve al otro lector», que SÍ deja su rastro. Un número a mano obliga
       a tocar la prueba cada vez que el endpoint gana un final, y entonces la
       tentación es subir el número sin comprobar que el rastro está.

       Tampoco vale contar los `return`: hay cuatro validaciones tempranas —sin
       sesión, sin imagen, formato inválido, demasiadas fotos— que ni llegan a
       leer y no tienen nada que apuntar.

       Lo que se fija es que cada final DEL LECTOR tenga el suyo, por su nombre. */
    const marcas = src.match(/evento: 'cartulina_leida'/g) ?? []
    for (const motivo of ["motivo: 'limite'", "motivo: 'ilegible'", "motivo: 'es_lista'"]) {
      expect(src, `la salida ${motivo} se quedó sin rastro`).toContain(motivo)
    }
    expect(src, 'la lectura buena tampoco puede quedarse muda').toMatch(/ok: true, via: 'una'/)
    expect(marcas.length, 'hay finales del lector sin apuntar').toBe(4)
  })

  it('mide cuánto tarda', () => {
    // Un lector que funciona pero tarda medio minuto también pierde gente.
    expect(src).toMatch(/const arranque = Date\.now\(\)/)
    expect(src).toMatch(/ms: Date\.now\(\) - arranque/)
  })

  it('⚠ distingue «leyó» de «leyó bien»', () => {
    /* Si saca el nombre pero no el monto, el usuario tiene que escribirlo igual
       y la promesa de «con una foto» no se cumple. Contarlo como éxito
       escondería justo el fallo que importa. */
    expect(src).toMatch(/conNombre:/)
    expect(src).toMatch(/conMonto:/)
  })

  it('separa el motivo cuando falla', () => {
    expect(src).toMatch(/motivo: 'limite'/)
    expect(src).toMatch(/motivo: 'ilegible'/)
  })
})
