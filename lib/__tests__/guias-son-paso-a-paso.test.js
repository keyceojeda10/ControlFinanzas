// lib/__tests__/guias-son-paso-a-paso.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El dueño, con el modal de la guía abierto:
//
//   «esa que te mandé, y la mayoría están así, solamente tienen una imagen,
//    cuando se supone que es un paso a paso, son varias imágenes y tienen que
//    ir subrayadas y señaladas todos los clics en las opciones que tiene que ir
//    presionando el usuario.»
//
// Medido antes de tocar nada: **28 de las 34 guías tenían UNA sola imagen**, y
// casi ninguna llevaba señalamiento. Una foto de la pantalla enseña dónde
// acabas, no por dónde pasas.
//
// Lo que se fija aquí es la REGLA, no las fotos: una guía es una secuencia, y
// cada paso dice qué tocar y lo señala.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PASOS } from '../../scripts/pasos-tutoriales.mjs'
import { PASOS_GUIA } from '../tutoriales/pasos'
import { TUTORIALES } from '../tutorialesData'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('una guía es una secuencia, no una foto', () => {
  it('⚠ ninguna guía se queda en un solo paso', () => {
    /* Es la queja, literal. Con un paso no hay recorrido que enseñar: o falta
       la mitad de la explicación, o esa guía no necesitaba imagen. */
    const cojas = PASOS.filter((g) => g.pasos.length < 2).map((g) => g.id)
    expect(cojas, 'estas guías vuelven a tener una sola imagen').toEqual([])
  })

  it('cada paso dice qué hacer, con sus palabras', () => {
    const mudos = []
    for (const g of PASOS) {
      for (const [i, p] of g.pasos.entries()) {
        if (!p.pie || p.pie.trim().length < 12) mudos.push(`${g.id}-${i + 1}`)
      }
    }
    expect(mudos, 'estos pasos no explican nada').toEqual([])
  })

  it('⚠ cada guía señala al menos un clic', () => {
    /* «Tienen que ir subrayadas y señaladas todos los clics.» No todos los
       pasos pueden señalar algo —hay pasos que son MIRAR una pantalla— pero una
       guía entera sin un solo aro es otra vez una foto suelta. */
    const sinSenal = PASOS.filter((g) => !g.pasos.some((p) => p.senal)).map((g) => g.id)
    expect(sinSenal, 'estas guías no señalan ningún clic').toEqual([])
  })
})

describe('las capturas y lo que la guía promete no se separan', () => {
  it('las 34 guías tienen sus pasos generados', () => {
    const sinPasos = TUTORIALES.filter((t) => !(PASOS_GUIA[t.id]?.length > 0)).map((t) => t.id)
    expect(sinPasos, 'estas guías se quedaron sin capturas').toEqual([])
  })

  it('⚠ ninguna guía pide una imagen que no existe en el disco', () => {
    /* Next no deja un hueco: da «imagen inválida». Y el guion puede fallar un
       paso —un botón que se movió— sin que nadie mire el registro. */
    const perdidas = []
    for (const [id, pasos] of Object.entries(PASOS_GUIA)) {
      for (const p of pasos) {
        if (!existsSync(resolve(process.cwd(), 'public' + p.src))) perdidas.push(`${id}: ${p.src}`)
      }
    }
    expect(perdidas, 'faltan estos archivos').toEqual([])
  })

  it('⚠ la lista de imágenes NO se escribe a mano', () => {
    /* Mantenerla aparte de las capturas es garantizar que un día se separen:
       el guion falla un paso, la guía sigue prometiendo la foto y revienta. */
    const datos = leer('lib/tutorialesData.js')
    expect(datos).toMatch(/import \{ PASOS_GUIA \}/)
    expect(datos, 'volvió una lista de imágenes escrita a mano')
      .not.toMatch(/images: \[\s*\{\s*src:/)
  })
})

describe('el texto no manda a botones que ya no existen', () => {
  /* Es como envejecen estas guías: la pantalla cambia y la frase se queda.
     `.auditoria/_rotulos-que-no-existen.mjs` los saca contra la app de verdad;
     aquí se clavan los que ya se corrigieron para que no vuelvan. */
  const MUERTOS = [
    'Regístrate gratis',      // ahora «Crear cuenta gratis»
    '¿Olvidaste tu contraseña?', // ahora «La olvidé»
    'Renovar mi plan',        // ahora «Cambiar de plan»
    'Solicitar que me contacten', // ahora «Nuevo ticket»
    'Cartera activa',         // no existe desde el rediseño de julio
  ]

  for (const m of MUERTOS) {
    it(`«${m}» ya no se nombra`, () => {
      const datos = leer('lib/tutorialesData.js')
      expect(datos).not.toContain(`*"${m}"*`)
    })
  }

  it('«Ingresar» dejó paso a «Entrar», que es lo que dice el botón', () => {
    const datos = leer('lib/tutorialesData.js')
    expect(datos).not.toContain('Toca *"Ingresar"*')
  })
})

describe('el modal enseña los pasos como pasos', () => {
  it('⚠ en vertical y numerados, no en una tira de miniaturas', () => {
    /* A 150px el aro rojo y su etiqueta no se leen: había que ampliar cada
       captura para enterarse de dónde tocar, o sea leer la guía dos veces. */
    const modal = leer('components/tutoriales/ModalGuia.jsx')
    expect(modal, 'volvió la tira horizontal').not.toMatch(/w-\[150px\]/)
    expect(modal).toMatch(/<ol/)
    expect(modal, 'los pasos perdieron su número').toMatch(/\{i \+ 1\}/)
  })
})
