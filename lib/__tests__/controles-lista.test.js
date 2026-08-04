import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// El dueño, con la maqueta al lado y una captura de lo nuestro: «los botones de
// las vistas y el filtro son de color y forma diferente, no combinan. Donde se
// cambian las vistas es más grande que el buscador. Y el filtro ni se diga, es
// redondo».
//
// La causa medida: el buscador va a 46px y radio 14 (`--cf-r-control`), pero el
// conmutador y el filtro usaban `--cf-h-field` (54px), y el filtro además
// `borderRadius: 999`. Tres formas en una misma fila.
const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const hoja = leer('components/pantallas/HojaFiltros.jsx')

describe('los controles de la fila del buscador', () => {
  it('el conmutador mide lo mismo que el buscador', () => {
    // 46 es la altura de `BuscadorLista`. Con `--cf-h-field` sobresalía.
    const bloque = /export function ConmutadorVista[\s\S]*?borderRadius: 14,/.exec(hoja)
    expect(bloque, 'no se encontró el conmutador').toBeTruthy()
    expect(bloque[0]).toMatch(/height: 46/)
    expect(bloque[0], 'seguiría más alto que el buscador').not.toMatch(/height: 'var\(--cf-h-field\)'/)
  })

  it('el filtro deja de ser redondo y toma la forma del buscador', () => {
    // Sin los comentarios: el porqué del cambio MENCIONA el `borderRadius: 999`
    // viejo, y buscarlo en el bloque entero se caza a sí mismo. Es el tipo de
    // prueba que da un rojo falso y bloquea un despliegue por nada.
    const sinComentarios = hoja.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const bloque = /export function BotonFiltros[\s\S]*?^}/m.exec(sinComentarios)
    expect(bloque, 'no se encontró el botón de filtros').toBeTruthy()
    expect(bloque[0]).toMatch(/height: 46/)
    expect(bloque[0]).toMatch(/borderRadius: 'var\(--cf-r-control\)'/)
    expect(bloque[0], 'el redondo es lo que el dueño señaló').not.toMatch(/borderRadius: 999/)
  })
})

describe('dónde vive cada control', () => {
  for (const p of ['app/(dashboard)/clientes/page.jsx', 'app/(dashboard)/prestamos/page.jsx']) {
    const src = leer(p)
    const nombre = p.includes('clientes') ? 'clientes' : 'préstamos'

    it(`${nombre}: el filtro está en la tira de estados`, () => {
      // `BarraFiltros` YA tenía el chip del final (`onMasFiltros`) —es lo que
      // dibuja la maqueta— pero estas dos pantallas nunca se lo pasaban.
      expect(src).toMatch(/onMasFiltros=\{\(\) => setHojaFiltros\(true\)\}/)
      expect(src).toMatch(/hayMasFiltros=\{nFiltros > 0\}/)
    })

    it(`${nombre}: ya no hay un botón de filtros suelto arriba`, () => {
      expect(src).not.toMatch(/<BotonFiltros/)
    })

    it(`${nombre}: el conmutador de vista SIGUE arriba, no en la tira`, () => {
      // No puede bajar: `BarraFiltros` se desplaza en horizontal y una pieza
      // que hay que poder pulsar siempre no puede irse fuera de la pantalla.
      // El dueño lo pidió explícito: «las vistas no se pueden rodar».
      const iCon = src.indexOf('<ConmutadorVista')
      const iBarra = src.indexOf('<BarraFiltros')
      expect(iCon, 'falta el conmutador').toBeGreaterThan(0)
      expect(iCon, 'el conmutador se movió dentro de la tira que se desplaza').toBeLessThan(iBarra)
    })
  }
})

describe('la tira que se desplaza', () => {
  const barra = leer('components/pantallas/ListaClientes.jsx')

  it('sigue saliéndose de su caja a propósito, y el filtro va DENTRO', () => {
    // El margen negativo de 20px por lado es para que las pastillas lleguen al
    // borde. Cualquier hermano suyo se le monta encima —ya pasó con el
    // conmutador—, así que el filtro tiene que ser un chip más de la tira, no
    // una pieza al lado.
    expect(barra).toMatch(/margin: '0 calc\(-1 \* var\(--cf-pad-screen\)\)'/)
    expect(barra).toMatch(/\{onMasFiltros && \(/)
  })
})
