// «¿Cuántas puertas me faltan?» (13 sep 2026).
//
// El número lo calcula `loDeHoy` —probado al peso en `ruta-cotejo.test.js`—, pero
// el fallo que costó caro no estaba en el cálculo: estaba en que CADA PANTALLA
// hacía su propia cuenta y las dos decían cosas distintas. Aquí se ancla el
// cableado: que el dato salga de un solo sitio y llegue a las dos bandas.
import { readFileSync } from 'fs'
import path from 'path'

const leer = (f) => readFileSync(path.join(process.cwd(), f), 'utf8')
// Este repo cita a los clientes en los comentarios: una prueba que busque en
// prosa pasa aunque el código no cumpla nada.
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const PAGINA = sinComentarios(leer('app/(dashboard)/rutas/[id]/page.jsx'))
const DETALLE = sinComentarios(leer('components/pantallas/DetalleRuta.jsx'))
const MODO = sinComentarios(leer('components/pantallas/ModoRuta.jsx'))

describe('el contador sale de un solo sitio', () => {
  it('los visitados se restan de lo que falta, que es lo que enseña el botón', () => {
    // Si se contara aparte —los que pagaron, por ejemplo— la banda diría «6 de
    // 19» y el botón «Empezar recorrido · 12» al mismo tiempo.
    expect(PAGINA).toMatch(
      /const visitadasHoy = Math\.max\(0, \(ruta\?\.clientesConCobroHoy \?\? 0\) - paradasPorHacer\)/,
    )
  })

  it('las dos llamadas a loDeHoy lo reciben', () => {
    const llamadas = [...PAGINA.matchAll(/loDeHoy\(\{[\s\S]*?\}, \(n\) => formatMoney\(n\)\)/g)]
    expect(llamadas).toHaveLength(2)
    for (const [l] of llamadas) expect(l).toMatch(/clientesVisitadosHoy: visitadasHoy/)
  })

  it('el carril de escritorio dice lo mismo, y con su nombre', () => {
    expect(PAGINA).toMatch(/conteoCobros=\{`\$\{visitadasHoy\} de \$\{ruta\.clientesConCobroHoy \?\? 0\} visitados`\}/)
    expect(PAGINA).not.toMatch(/conteoCobros=\{`\$\{ruta\.clientesPagaronHoy/)
  })
})

describe('la visita cerrada deja de ser una puerta por tocar', () => {
  it('el recorrido la da por hecha', () => {
    expect(PAGINA).toMatch(/cobradoHoy: !c\.cobroPendienteHoy \|\| Boolean\(c\.visitaCerradaHoy\)/)
  })

  it('y le pasa el motivo, que es lo que se enseña en vez de «cobrado»', () => {
    expect(PAGINA).toMatch(/visitaCerrada: Boolean\(c\.visitaCerradaHoy\)/)
    expect(PAGINA).toMatch(/motivoCierre: c\.motivoCierre \?\? null/)
  })
})

describe('las dos bandas pintan el mismo componente', () => {
  it('el contador vive en un solo sitio y se exporta', () => {
    expect(DETALLE).toMatch(/export function ContadorVisitas\(/)
    expect(MODO).toMatch(/import \{[^}]*ContadorVisitas[^}]*\} from '\.\/DetalleRuta'/)
  })

  it('la banda de la ruta lo pinta', () => {
    expect(DETALLE).toMatch(/\{visita && <ContadorVisitas \{\.\.\.visita\} \/>\}/)
    expect(DETALLE).toMatch(/export function LoDeHoy\(\{[\s\S]*?\bvisita\b[\s\S]*?\}\)/)
  })

  it('la del recorrido también: caminando es la cuenta que más se mira', () => {
    expect(MODO).toMatch(/\{visita && <ContadorVisitas \{\.\.\.visita\} \/>\}/)
    expect(MODO).toMatch(/function BandaDelDia\(\{[\s\S]*?\bvisita\b[\s\S]*?\}\)/)
  })

  it('el completo se pinta en verde, no en dorado', () => {
    // El dorado está reservado; el verde es el de «al día» en toda la app.
    expect(DETALLE).toMatch(/completo \? 'var\(--cf-green-dark\)'/)
  })
})
