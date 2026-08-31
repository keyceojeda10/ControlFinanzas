// lib/__tests__/lo-nuevo-se-encuentra.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Esas nuevas funciones se deben agregar también en el buscador de las
//  secciones, para que el cliente pueda encontrarlas. Por ejemplo, si busca
//  "cambiar de modo de interés", le pueda salir.»   — el dueño, 31 ago 2026
//
// Una función que existe y no se encuentra es una función que no existe. Y el
// riesgo es silencioso: las acciones se DERIVAN del menú de gestión, así que
// una fila nueva sale en el buscador sola… pero con cero sinónimos. Se puede
// buscar solo quien ya sabe cómo se llama, que es justo quien no necesita
// buscador.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { SINONIMOS_GESTION, EXTRAS_PRESTAMO } from '@/lib/acciones/prestamo'
import { buscarAcciones } from '@/lib/acciones/registro'

const raiz = resolve(__dirname, '../..')
const pagina = readFileSync(resolve(raiz, 'app/(dashboard)/prestamos/[id]/page.jsx'), 'utf8')

/** Las acciones tal y como las ve el buscador, con sus sinónimos. */
const comoElBuscador = () => [
  ...Object.entries(SINONIMOS_GESTION).map(([id, sinonimos]) => ({
    id, label: id, pista: 'En este préstamo', sinonimos,
  })),
  ...EXTRAS_PRESTAMO.map((e) => ({ ...e, pista: 'En este préstamo' })),
]

describe('⚠ ninguna fila del menú se queda sin sinónimos', () => {
  it('todas las filas de «Gestión» están en la tabla', () => {
    /* Ésta es la prueba que vale: el día que se añada una fila nueva al menú y
       se olviden los sinónimos, aquí salta. Es exactamente lo que pasó con
       «Cambiar el modo de cobro», que nació buscable solo por su nombre. */
    const filas = [...pagina.matchAll(/id: '([a-z0-9-]+)', nombre: '([^']+)'/g)]
      .map((m) => ({ id: m[1], nombre: m[2] }))
    expect(filas.length).toBeGreaterThan(10)

    const sin = filas.filter((f) => !(SINONIMOS_GESTION[f.id]?.length > 0))
    expect(sin.map((f) => `${f.nombre} (${f.id})`),
      'estas filas del menú no se pueden buscar por sinónimo').toEqual([])
  })
})

describe('⚠ cambiar el modo de cobro se encuentra como lo pide la gente', () => {
  /* Las frases NO son las del menú: son las del prestamista que pidió la
     función, tal cual las escribió por WhatsApp. Si solo funcionaran las
     palabras del menú, el buscador no haría falta. */
  const FRASES = [
    'modo banco',
    'interes sobre saldos',
    'ya no quiere globo',
    'que pague cuotas',
    'cambiar el modo',
    'solo interes',
  ]
  for (const frase of FRASES) {
    it(`«${frase}»`, () => {
      const hallado = buscarAcciones(comoElBuscador(), frase, 5).map((a) => a.id)
      expect(hallado, `no encuentra «Cambiar el modo de cobro»`).toContain('cambiar-modo')
    })
  }
})

describe('⚠ compartir el recibo se encuentra, aunque no tenga fila propia', () => {
  /* Vive DENTRO de la tarjeta de cada pago, así que no aparece en ningún menú.
     Sin estas palabras no se encuentra por ningún lado — y es lo que se acaba
     de arreglar para que compartir comparta de verdad. */
  for (const frase of ['compartir el recibo', 'mandar el recibo', 'enviar comprobante',
    'quitar un pago mal hecho', 'recibo en imagen']) {
    it(`«${frase}»`, () => {
      const hallado = buscarAcciones(comoElBuscador(), frase, 5).map((a) => a.id)
      expect(hallado, 'no lleva a «Ver y gestionar los pagos»').toContain('historial')
    })
  }
})

describe('⚠ los sinónimos no se pisan entre sí', () => {
  it('cada frase lleva a UNA acción, no a la equivocada', () => {
    /* Un sinónimo demasiado goloso es peor que ninguno: «cambiar el interes»
       podría robarle la búsqueda a «Editar el préstamo», que es donde de verdad
       se cambia la tasa. Se comprueba que cada una gane la suya. */
    const casos = [
      ['renovar', 'renovar'],
      ['prestarle mas', 'renovar'],
      ['modo banco', 'cambiar-modo'],
      ['cambiar el monto', 'editar'],
      ['multa', 'recargo'],
      ['pagar todo', 'anticipado'],
      ['no me va a pagar', 'perdidos'],
    ]
    const fallos = []
    for (const [frase, esperado] of casos) {
      const primero = buscarAcciones(comoElBuscador(), frase, 1)[0]?.id
      if (primero !== esperado) fallos.push(`«${frase}» → ${primero ?? 'nada'} (se esperaba ${esperado})`)
    }
    expect(fallos, 'estas frases llevan a la acción equivocada').toEqual([])
  })
})
