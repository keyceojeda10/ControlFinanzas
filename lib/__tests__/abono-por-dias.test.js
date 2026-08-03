import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// «Abonar por días» era la ÚLTIMA pantalla con el estilo viejo: el enlace abría
// el formulario completo de antes porque el deslizador solo vivía allí. Dos
// usuarios lo reportaron como fallo.
const src = readFileSync(resolve(process.cwd(), 'components/prestamos/RegistrarPago.jsx'), 'utf8')
const hoja = readFileSync(resolve(process.cwd(), 'components/pantallas/AbonoPorDias.jsx'), 'utf8')

describe('abonar por días', () => {
  it('el enlace abre la hoja nueva, NO el formulario viejo', () => {
    expect(src).toContain('onLoRaro={() => setVerAbonoDias(true)}')
    expect(src).not.toContain('onLoRaro={() => setVerFormularioCompleto(true)}')
  })

  it('ya NADIE manda al formulario viejo', () => {
    // `verFormularioCompleto` solo se calcula desde `tabInicial`. Si vuelve a
    // aparecer un `setVerFormularioCompleto(true)` suelto, alguien reabrió la
    // puerta al modal de antes del rediseño.
    const llamadas = src.match(/setVerFormularioCompleto\(true\)/g) ?? []
    expect(llamadas.length, 'alguien vuelve a abrir el formulario viejo').toBe(0)
  })

  it('el modal viejo queda inalcanzable: todos los tipos tienen hoja', () => {
    const linea = /setVerFormularioCompleto\(!\[([^\]]+)\]/.exec(src)
    expect(linea, 'cambió cómo se decide el formulario viejo').toBeTruthy()
    const conHoja = linea[1].match(/'([a-z]+)'/g).map((s) => s.replace(/'/g, ''))
    // El valor por defecto de `tabInicial` tiene que estar cubierto, o la hoja
    // por defecto sería la vieja.
    expect(conHoja).toContain('pago')
    for (const t of ['recargo', 'descuento', 'capital', 'intereses']) {
      expect(conHoja, `«${t}» volvería al formulario viejo`).toContain(t)
    }
  })

  it('la hoja no perdió nada del modal viejo', () => {
    // Lo que hacía el modal y no puede desaparecer: el deslizador 1..30, sus
    // tres marcas, los atajos de mora/al día y las cuotas pendientes.
    expect(hoja).toContain('type="range"')
    expect(hoja).toMatch(/min=\{1\}/)
    expect(hoja).toMatch(/max=\{30\}/)
    for (const d of [7, 15, 30]) {
      expect(hoja, `falta la marca de ${d} días`).toMatch(new RegExp(`dias: ${d}`))
    }
    expect(hoja).toContain('Próximas cuotas pendientes')
    expect(src, 'se perdieron los atajos de mora / ponerse al día').toContain('atajosDeDias')
  })

  it('el monto de los días nunca pasa del saldo', () => {
    // `cuota × 30` con 12 días de saldo propondría cobrar de más.
    expect(src).toMatch(/const montoDeLosDias = Math\.min\(cuotaDia \* diasParaHoja, techo\)/)
  })

  it('no usa emojis: los iconos van en SVG', () => {
    expect(hoja).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
  })
})
