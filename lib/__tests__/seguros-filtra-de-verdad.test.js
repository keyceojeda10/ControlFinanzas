// lib/__tests__/seguros-filtra-de-verdad.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Dice hoy cobrado en seguros $10.000 y no fue así: esa práctica de poner
//  seguro la hice UNA sola vez, y no fue hoy, fue hace mucho tiempo.»
//                                                    — el dueño, 18 ago 2026
//
// Comprobado contra su cuenta: su único préstamo con seguro es del **28 de
// junio**, y el informe con el filtro en «Hoy» lo contaba como cobrado hoy.
//
// La causa era una palabra. La función esperaba `dia` y la pantalla manda `hoy`
// —así se llama en `PERIODOS` del catálogo y así dice el chip—. Ninguna
// condición casaba, se caía al `return null` del final… y **null significa SIN
// FILTRO**: «Hoy» enseñaba TODO.
//
// ⚠ El fallo no estaba en lo que filtra, sino en LO QUE HACE CUANDO NO
//   ENTIENDE: caer en «todo» convierte cualquier error de nombre en una cifra
//   inventada. Ahora lo desconocido cae en «mes».

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { INFORMES } from '@/lib/reportes/catalogo'

const api = readFileSync(resolve(process.cwd(), 'app/api/reportes/seguros/route.js'), 'utf8')
const seguros = INFORMES.find((i) => i.id === 'seguros')

describe('⚠ el informe entiende los períodos que la pantalla le manda', () => {
  it('⚠ cada período del catálogo lo reconoce el API', () => {
    /* Es la comprobación que faltaba: los dos lados se nombran solos y nadie
       los cotejaba. Basta que alguien renombre un chip para que el informe
       vuelva a mentir. */
    const rango = api.slice(api.indexOf('function rangoFecha'), api.indexOf('export async function GET'))
    for (const p of seguros.periodos) {
      if (p === 'mes') continue   // es el defecto, no lleva comparación
      expect(rango, `el API no entiende «${p}»`).toContain(`'${p}'`)
    }
  })

  it('lo que no entiende NO cae en «todo»', () => {
    /* «todo» es la respuesta más grande posible: un error de nombre se
       convierte en una cifra inventada, que es exactamente lo que pasó. */
    const rango = api.slice(api.indexOf('function rangoFecha'), api.indexOf('export async function GET'))
    const ultima = rango.trim().split('\n').filter((l) => l.includes('return')).pop()
    expect(ultima, 'el caso por defecto volvió a ser «sin filtro»').not.toMatch(/return null/)
    expect(ultima).toMatch(/atras\(30\)/)
  })

  it('«todo» sigue siendo sin filtro, que es lo que significa', () => {
    const rango = api.slice(api.indexOf('function rangoFecha'), api.indexOf('export async function GET'))
    expect(rango).toMatch(/periodo === 'todo'\) return null/)
  })
})

describe('⚠ y acepta el tramo escrito a mano', () => {
  it('el catálogo lo declara', () => {
    expect(seguros.params).toContain('desde')
    expect(seguros.params).toContain('hasta')
  })

  it('y manda sobre la pastilla', () => {
    /* Si alguien escribió dos fechas, es que quiere ESAS. */
    expect(api).toMatch(/const aMano = rangoManual\(searchParams\)/)
    expect(api).toMatch(/aMano \?/)
  })
})
