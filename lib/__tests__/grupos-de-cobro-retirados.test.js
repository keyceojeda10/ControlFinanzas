// lib/__tests__/grupos-de-cobro-retirados.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Los grupos de cobro se retiraron. No por opinión: medido contra la base de
// producción, en solo lectura.
//
//   · 8 grupos creados en toda la historia
//   · 4 negocios de 439
//   · 18 clientes con grupo asignado
//   · el último, el 15 de junio
//
// Y cómo se llaman los ocho: Lunes, Martes, Miércoles, Jueves, Viernes,
// Morales, Viernes y BREINER AMAYA. Cinco son los días de la semana y uno es
// el nombre de una persona: se estaban usando como una ruta pobre y como una
// frecuencia de cobro, dos cosas que la app ya hace bien.
//
// ⚠ Y no murieron por estar escondidos: el botón no desapareció hasta el 30 de
// julio, mes y medio DESPUÉS del último grupo creado.
//
// Esta prueba existe porque una función retirada a medias es peor que una
// función viva: deja endpoints sin puerta, `select` de Prisma que nadie lee y
// estado que nadie cambia. Ya pasó al revés —el modal entero sin botón— y no
// lo vio ninguna prueba.

import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const raiz = process.cwd()

function fuentes(dir, salida = []) {
  if (!existsSync(dir)) return salida
  for (const e of readdirSync(dir)) {
    if (['node_modules', '.next', '.git', '__tests__'].includes(e)) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) fuentes(p, salida)
    else if (/\.(jsx?|mjs)$/.test(p)) salida.push(p)
  }
  return salida
}

describe('los grupos de cobro no vuelven por la puerta de atrás', () => {
  it('⚠ ni una sola mención en el código que corre', () => {
    const sucios = []
    for (const f of ['app', 'components', 'lib'].flatMap((d) => fuentes(resolve(raiz, d)))) {
      const src = readFileSync(f, 'utf8')
      if (/grupoCobro|GrupoCobro|gruposCobro/.test(src)) {
        sucios.push(f.slice(raiz.length + 1).replace(/\\/g, '/'))
      }
    }
    expect(sucios, 'quedaron restos de los grupos de cobro').toEqual([])
  })

  it('los endpoints ya no existen', () => {
    // Dos de ellos —`api/rutas/[id]/grupos`— no los llamaba NADIE ya antes.
    for (const d of ['app/api/grupos', 'app/api/rutas/[id]/grupos']) {
      expect(existsSync(resolve(raiz, d)), `sigue ahí: ${d}`).toBe(false)
    }
  })
})
