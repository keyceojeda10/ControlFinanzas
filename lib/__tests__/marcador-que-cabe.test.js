// 21 nov 2026: «la mayoría de los buscadores sale con el texto de adentro cortado».
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import { tamanoQueCabe, esCampoConMarcador } from '@/lib/marcador-que-cabe'

// Un texto que mide 10 px por punto de letra (a 16 → 160).
const medir = (px) => px * 10

describe('el marcador baja de letra hasta caber', () => {
  it('si cabe a su tamaño no se toca', () => {
    expect(tamanoQueCabe({ base: 16, hay: 160, medir })).toBeNull()
  })
  it('baja al primer tamaño de la escala que entra', () => {
    expect(tamanoQueCabe({ base: 16, hay: 155, medir })).toBe(15)
    expect(tamanoQueCabe({ base: 16, hay: 141, medir })).toBe(14)
    expect(tamanoQueCabe({ base: 16, hay: 130, medir })).toBe(13)
  })
  it('si ni a 13 cabe, se queda en 13 (nunca más chico)', () => {
    expect(tamanoQueCabe({ base: 16, hay: 50, medir })).toBe(13)
  })
  it('un campo escondido (ancho 0) no se mide', () => {
    expect(tamanoQueCabe({ base: 16, hay: 0, medir })).toBeNull()
  })
  it('un campo de 14 solo puede bajar a 13', () => {
    expect(tamanoQueCabe({ base: 14, hay: 135, medir })).toBe(13)
  })
  it('solo campos de texto con marcador', () => {
    const campo = (type, placeholder = 'x') => ({ tagName: 'INPUT', placeholder, getAttribute: () => type })
    expect(esCampoConMarcador(campo('search'))).toBe(true)
    expect(esCampoConMarcador(campo(null))).toBe(true)
    expect(esCampoConMarcador(campo('checkbox'))).toBe(false)
    expect(esCampoConMarcador(campo('text', ''))).toBe(false)
  })
})

describe('montado en toda la app, y solo el marcador', () => {
  const layout = fs.readFileSync('app/layout.js', 'utf8')
  const css = fs.readFileSync('app/globals.css', 'utf8')
  it('las dos ramas del layout raíz lo montan', () => {
    expect(layout.match(/<MarcadoresQueCaben \/>/g)?.length).toBe(2)
  })
  it('el CSS cambia el ::placeholder, no el campo', () => {
    for (const t of [15, 14, 13]) expect(css).toContain(`input[data-marcador="${t}"]::placeholder { font-size: ${t}px; }`)
  })
})

describe('lo que le faltaba a lo muy angosto', () => {
  const lista = fs.readFileSync('components/pantallas/ListaClientes.jsx', 'utf8')
  const css = fs.readFileSync('app/globals.css', 'utf8')
  const ruta = fs.readFileSync('app/(dashboard)/rutas/[id]/page.jsx', 'utf8')
  it('con micrófono, la lupa del campo se va por debajo de 360', () => {
    expect(lista).toMatch(/className=\{voz \? 'cf-lupa-prescindible' : undefined\}/)
    expect(css).toMatch(/@media \(max-width: 359px\) \{ \.cf-lupa-prescindible \{ display: none; \} \}/)
  })
  it('el buscador de la ruta dice lo mismo que el de Préstamos', () => {
    expect(ruta).toMatch(/placeholder="Nombre o cédula"\n/)
    expect(ruta).not.toMatch(/placeholder="Buscar cliente por nombre o cédula"/)
  })
})
