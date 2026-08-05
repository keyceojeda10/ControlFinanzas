import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { esId, sonIds } from '@/lib/ids'

// ── UN ID QUE NO SEA TEXTO CASA CON TODA LA TABLA ───────────────────────────
//
// Comprobado contra la base (varchar(191), MariaDB 10.11):
//
//     SELECT id, nombre FROM Cliente WHERE id = 0 LIMIT 5
//     -> María González, Ana Martínez, Luis Rodríguez, Carmen Flores, …
//
// MariaDB convierte cada texto a número para comparar, y un cuid empieza por
// letra, así que todos valen 0. `where: { id: 0 }` no falla ni devuelve vacío:
// devuelve una fila cualquiera.
//
// Así se quitó de la ruta a quien no era: la pantalla de ordenar mandaba el
// ÍNDICE de la parada (le faltaba el id), y el de la primera es 0. La primera
// parada desenrutaba a otro cliente EN SILENCIO; el resto daban 404 con el
// aviso rojo. El aviso era el caso bueno.

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('esId', () => {
  it('acepta un cuid', () => {
    expect(esId('cmm79te91000d58f7722v2bxy')).toBe(true)
  })

  it('rechaza el CERO, que es el que hizo el daño', () => {
    expect(esId(0)).toBe(false)
  })

  it('rechaza cualquier otro número, en blanco, nulo y listas', () => {
    for (const malo of [1, 42, -1, '', '   ', null, undefined, [], {}, true]) {
      expect(esId(malo), `dejó pasar ${JSON.stringify(malo)}`).toBe(false)
    }
  })
})

describe('sonIds', () => {
  it('acepta una lista de cuid', () => {
    expect(sonIds(['cmm79te91000d58f7722v2bxy', 'cmm79te93000f58f7otc0h74q'])).toBe(true)
  })

  it('rechaza la lista de índices, que es lo que mandaba la pantalla', () => {
    expect(sonIds([0, 1, 2])).toBe(false)
  })

  it('rechaza si UNO solo es número', () => {
    // El `in:` con un número casa de más, y reordenar ACTUALIZA lo que casa.
    expect(sonIds(['cmm79te91000d58f7722v2bxy', 3])).toBe(false)
  })

  it('rechaza la lista vacía', () => {
    expect(sonIds([])).toBe(false)
  })
})

describe('los endpoints que reciben ids por el cuerpo lo comprueban', () => {
  // ⚠ NO vale `if (!id)`: el 0 sí lo caza, pero '0', [0] y 1, 2, 3… pasan.
  const casos = [
    ['app/api/rutas/[id]/clientes/route.js', 'quitar y asignar clientes de la ruta'],
    ['app/api/rutas/[id]/reordenar/route.js', 'reordenar clientes'],
    ['app/api/cobradores/reordenar/route.js', 'reordenar cobradores'],
    ['app/api/caja/reabrir/aprobar/route.js', 'aprobar reapertura de caja'],
    ['app/api/caja/reabrir/rechazar/route.js', 'rechazar reapertura de caja'],
    ['app/api/rutas/route.js', 'crear ruta'],
    ['app/api/rutas/[id]/route.js', 'editar ruta'],
    ['app/api/carga-masiva/importar/route.js', 'carga masiva'],
  ]

  for (const [ruta, que] of casos) {
    it(`${que}`, () => {
      const src = leer(ruta)
      expect(src, `${ruta} volvió a aceptar ids que no son texto`)
        .toMatch(/esId\(|sonIds\(|typeof \w+ !== 'string'|\.every\(\(c\) => typeof c === 'string'/)
    })
  }
})
