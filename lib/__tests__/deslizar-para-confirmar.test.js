// Deslizar para confirmar el cobro (13 sep 2026).
//
// Vitest corre en `node`, sin DOM: el gesto se prueba de verdad con playwright en
// el espejo. Aquí se anclan en CÓDIGO las reglas que, rotas, guardarían un pago
// sin querer o dejarían a alguien sin forma de cobrar.
import { readFileSync } from 'fs'
import path from 'path'

const leer = (f) => readFileSync(path.join(process.cwd(), f), 'utf8')
// Sin comentarios: aquí se citan las propias reglas y una prueba que las busque
// en prosa pasaría aunque el código no las cumpla.
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const DESLIZAR = sinComentarios(leer('components/cf/DeslizarParaConfirmar.jsx'))
const PIE = sinComentarios(leer('components/pantallas/RegistrarCobro.jsx'))
const PAGO = sinComentarios(leer('components/prestamos/RegistrarPago.jsx'))

describe('el gesto', () => {
  it('confirma solo al pasar el umbral del recorrido', () => {
    expect(DESLIZAR).toMatch(/const UMBRAL = 0\.88/)
    expect(DESLIZAR).toMatch(/if \(g\.max > 0 && g\.x >= g\.max \* UMBRAL\) return confirmar\(\)/)
  })

  it('un toque sin arrastre enseña, no confirma', () => {
    expect(DESLIZAR).toMatch(/if \(g\.x < 6\) return ensenar\(\)/)
    expect(DESLIZAR).toMatch(/>\s*\{pista \? 'Desliza la flecha hasta el final' : texto\}/)
  })

  it('el clic del asa solo confirma desde el teclado', () => {
    // Soltar el dedo sobre el asa dispara un clic con detail 1: si confirmara,
    // tocar el asa guardaría el pago sin deslizar.
    expect(DESLIZAR).toMatch(/onClick=\{\(e\) => \{ if \(e\.detail === 0\) confirmar\(\) \}\}/)
  })

  it('tocar la pista no confirma', () => {
    const clicPista = DESLIZAR.match(/ref=\{refPista\}\s*onClick=\{([^\n]+)\}/)
    expect(clicPista).not.toBeNull()
    expect(clicPista[1]).toMatch(/ensenar\(\)/)
    expect(clicPista[1]).not.toMatch(/confirmar\(/)
  })

  it('muerto no confirma ni arrastra', () => {
    expect(DESLIZAR).toMatch(/const confirmar = \(\) => \{\s*if \(muerto\) return/)
    expect(DESLIZAR).toMatch(/const alAgarrar = \(e\) => \{\s*if \(muerto \|\| e\.button > 0\) return/)
  })

  it('si no llegó a guardar, el asa vuelve al principio', () => {
    expect(DESLIZAR).toMatch(/setTimeout\(\(\) => \{ if \(!refConfirmando\.current\) pintar\(0, true\) \}, 350\)/)
    expect(DESLIZAR).toMatch(/pintar\(confirmando \? recorrido\(\) : 0, true\)/)
  })
})

describe('dónde sale', () => {
  it('el pie usa el deslizador solo con `deslizar` y pantalla táctil', () => {
    expect(PIE).toMatch(/const CONSULTA_TACTIL = '\(pointer: coarse\)'/)
    expect(PIE).toMatch(/\{deslizar && tactil \? \(\s*<DeslizarParaConfirmar/)
    // Sin eso, el botón de siempre.
    expect(PIE).toMatch(/<button type="button" onClick=\{onConfirmar\} disabled=\{muerto\}/)
  })

  it('la hoja de cobro lo pide; «Abonar por días» no', () => {
    const pies = [...PAGO.matchAll(/<PieRegistrarCobro[\s\S]*?\/>/g)].map((m) => m[0])
    const cobro = pies.filter((p) => p.includes('onConfirmar={handleSubmit}'))
    expect(cobro).toHaveLength(1)
    expect(cobro[0]).toMatch(/\n\s*deslizar\n/)
    // Los demás pies no guardan nada: «Poner $X» solo rellena el monto.
    for (const p of pies.filter((x) => x !== cobro[0])) expect(p).not.toMatch(/\bdeslizar\b/)
  })
})
