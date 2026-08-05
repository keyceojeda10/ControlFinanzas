import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { direccionIncompleta } from '@/lib/direcciones'

// ── E04 · «Cómo ubicarlo» ───────────────────────────────────────────────────
//
// De la lámina: «El problema no era el aspecto: era que ningún dato hacía nada.
// Un cobrador que abre esta tarjeta quiere llamar o llegar, y hoy tiene que
// copiar el número a mano y leer la dirección para escribirla en su mapa».

const src = readFileSync(resolve(process.cwd(), 'components/clientes/ClienteHeroCard.jsx'), 'utf8')

describe('la dirección incompleta', () => {
  it('avisa cuando falta el número de casa', () => {
    // El caso de la lámina: «Calle 9» no lleva a ningún sitio.
    expect(direccionIncompleta('Calle 9')).toBe(true)
    expect(direccionIncompleta('Cra 5')).toBe(true)
    expect(direccionIncompleta('La esquina')).toBe(true)
  })

  it('calla cuando la dirección sirve', () => {
    // Con separador de número o con dos grupos de dígitos ya se puede llegar.
    expect(direccionIncompleta('Calle 9 #12-30')).toBe(false)
    expect(direccionIncompleta('Cra 5 No 12-30')).toBe(false)
    expect(direccionIncompleta('Calle 9 12 30')).toBe(false)
    expect(direccionIncompleta('Diagonal 45 Sur #3-12 apto 201')).toBe(false)
  })

  it('sin dirección no hay nada que avisar', () => {
    // El aviso es para quien SÍ escribió algo incompleto. A quien no puso nada
    // ya le avisa el hueco.
    expect(direccionIncompleta('')).toBe(false)
    expect(direccionIncompleta(null)).toBe(false)
    expect(direccionIncompleta(undefined)).toBe(false)
  })

  it('lo muy corto también avisa', () => {
    expect(direccionIncompleta('C9')).toBe(true)
    expect(direccionIncompleta('  x ')).toBe(true)
  })
})

describe('los datos hacen algo', () => {
  it('el teléfono llama y escribe', () => {
    expect(src, 'el teléfono no llama').toMatch(/window\.location\.href = `tel:\$\{tel\}`/)
    expect(src, 'falta el botón de WhatsApp').toContain('etiqueta="Escribir por WhatsApp"')
  })

  it('la dirección abre el mapa', () => {
    expect(src).toContain('const irAlMapa = ')
    expect(src, 'no abre el mapa').toMatch(/google\.com\/maps\/dir\/\?api=1&destination=/)
  })

  it('el mapa usa las coordenadas si las hay, y si no la dirección escrita', () => {
    // Es lo que ya hacen la ruta y cobrar hoy: el punto exacto manda, pero sin
    // coordenadas el mapa puede buscar el texto.
    const i = src.indexOf('const irAlMapa = ')
    const bloque = src.slice(i, i + 600)
    expect(bloque).toMatch(/cliente\?\.latitud != null && cliente\?\.longitud != null/)
    expect(bloque, 'sin coordenadas no manda la dirección').toContain('encodeURIComponent(')
  })
})

describe('lo que se quitó', () => {
  it('el teléfono ya no va en verde', () => {
    // En este sistema el verde es «al día». Ahí se leía como si el teléfono
    // estuviera bien y los otros dos mal.
    const i = src.indexOf('export function InfoContactoCard')
    const bloque = src.slice(i, src.indexOf('// Acciones rapidas en grid', i))
    expect(bloque, 'volvió el verde de fondo al teléfono')
      .not.toMatch(/color: 'var\(--cf-green-dark\)'/)
  })

  it('«Referencia» ya no es una fila propia', () => {
    // No es un dato aparte: es parte de la dirección.
    const i = src.indexOf('export function InfoContactoCard')
    const bloque = src.slice(i, src.indexOf('// Acciones rapidas en grid', i))
    expect(bloque, '«Referencia» volvió a ser su propia fila')
      .not.toMatch(/label: 'Referencia'/)
    expect(bloque, 'la referencia no se dice en la segunda línea de la dirección')
      .toContain('al lado de ${ref.toLowerCase()}')
  })

  it('las etiquetas en mayúsculas se fueron', () => {
    const i = src.indexOf('export function InfoContactoCard')
    const bloque = src.slice(i, src.indexOf('// Acciones rapidas en grid', i))
    expect(bloque).not.toMatch(/label: 'Teléfono'/)
    expect(bloque).not.toMatch(/label: 'Dirección'/)
  })

  it('el teléfono se formatea', () => {
    // «300 887 5156», no «3008875156».
    expect(src).toContain('formatearTelefonoIntl(tel)')
    expect(src, 'no importa el formateador').toMatch(/import \{ formatMoney, formatearTelefonoIntl \}/)
  })
})

describe('la página le pasa lo que necesita', () => {
  const pagina = readFileSync(resolve(process.cwd(), 'app/(dashboard)/clientes/[id]/page.jsx'), 'utf8')

  it('la ruta y el editar', () => {
    expect(pagina).toMatch(/rutaNombre=\{cliente\?\.ruta\?\.nombre \|\| null\}/)
    expect(pagina, 'no lleva a editar').toMatch(/onEditar=\{puedeEditarClientes/)
  })

  it('«Editar» solo a quien puede', () => {
    // Sin permiso el botón no sale, en vez de salir y fallar al pulsarlo.
    const i = pagina.indexOf('<InfoContactoCard')
    const bloque = pagina.slice(i, i + 400)
    expect(bloque).toContain('puedeEditarClientes ?')
  })
})
