// lib/__tests__/ningun-where-lleva-select.test.js
//
// ══ DOS PANTALLAS LLEVABAN OCHO DÍAS DEVOLVIENDO 500 Y NADIE LO SABÍA ══════
//
// El 19 de agosto de 2026, arreglando que un préstamo abierto saliera «al día»
// en todas las pantallas menos en su ficha, se metió esto **dentro del `where`**
// en vez del `select`:
//
//     devengos: { select: { periodo: true, interes: true } },
//
// Prisma no lo ignora: contesta `Unknown argument 'select'` y revienta la
// consulta entera. El informe «Cómo rindió el negocio» (el PDF de analíticas)
// devolvía 500 crudo y la pantalla de repartir utilidades a socios devolvía
// «Error interno del servidor».
//
// ⚠ NADIE LO VIO PORQUE NADIE HABÍA ABIERTO ESAS DOS PANTALLAS. En los registros
// de PM2 del 31 de julio al 27 de agosto no hay ni un acierto ni un error suyo.
// Habrían reventado en la primera visita, a los 574 negocios el PDF y a los 6
// con socios el reparto.
//
// Esta prueba mira lo que ninguna otra miraba: que ningún `where` de un `findMany`
// lleve dentro un `select`, que es la forma que tiene este error de esconderse.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

/* Todos los ficheros de ruta bajo app/api. */
function rutas(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) rutas(p, acc)
    else if (e === 'route.js') acc.push(p)
  }
  return acc
}

/* El texto entre `where: {` y su llave de cierre, contando llaves. */
function bloquesWhere(src) {
  const fuera = []
  let i = 0
  while ((i = src.indexOf('where: {', i)) !== -1) {
    let n = 0, j = src.indexOf('{', i)
    const inicio = j
    do {
      if (src[j] === '{') n++
      else if (src[j] === '}') n--
      j++
    } while (n > 0 && j < src.length)
    fuera.push({ pos: inicio, texto: src.slice(inicio, j) })
    i = j
  }
  return fuera
}

describe('ningún `where` lleva un `select` dentro', () => {
  const FICHEROS = rutas('app/api')

  it('hay rutas que revisar', () => {
    expect(FICHEROS.length).toBeGreaterThan(50)
  })

  it('⚠ ni uno solo, en toda la API', () => {
    const malos = []
    for (const f of FICHEROS) {
      const src = readFileSync(f, 'utf8')
      for (const b of bloquesWhere(src)) {
        /* Un `select:` dentro de un `where` es siempre el mismo error: se quiso
           pedir una relación y se puso donde se filtra. Prisma revienta con
           `Unknown argument 'select'` y la pantalla entera devuelve 500. */
        if (/\bselect:\s*\{/.test(b.texto)) {
          const linea = src.slice(0, b.pos).split('\n').length
          malos.push(`${f}:${linea}`)
        }
      }
    }
    expect(malos, 'un `select` dentro de un `where` revienta la consulta entera').toEqual([])
  })
})
