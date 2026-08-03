// `formatMoney` — la función que pinta TODAS las cifras de plata de la app.
//
// ── EL MENOS VA ANTES DEL SÍMBOLO ──────────────────────────────────────────
//
// Salía «$-380.000»: el peso separado de su cifra por un guion. La causa era
// pegar el símbolo a un número que YA traía el signo, y en el código no se nota
// —la concatenación parece correcta—; lo vi en una captura del capital negativo.
//
// Importa más de lo que parece: el capital en negativo es justo la pantalla que
// alguien mira cuando cree que le falta plata, y una cifra mal formateada ahí
// hace dudar de todo el número.

import { describe, it, expect } from 'vitest'
import { formatMoney } from '../i18n'

describe('el signo de las cifras negativas', () => {
  it('el menos va ANTES del símbolo, no entre el símbolo y el número', () => {
    expect(formatMoney(-380000)).toBe('−$380.000')
    expect(formatMoney(-380000)).not.toContain('$-')
  })

  it('usa el menos tipográfico, no el guion del teclado', () => {
    // U+2212. Mismo ancho que el «+», así que las columnas de cifras no bailan.
    expect(formatMoney(-1000).startsWith('−')).toBe(true)
    expect(formatMoney(-1000).startsWith('-')).toBe(false)
  })

  it('los positivos no llevan signo', () => {
    expect(formatMoney(380000)).toBe('$380.000')
  })

  it('el cero no es negativo', () => {
    expect(formatMoney(0)).toBe('$0')
    expect(formatMoney(-0)).toBe('$0')
  })

  it('lo que no es número sigue dando $0, no «NaN»', () => {
    expect(formatMoney(null)).toBe('$0')
    expect(formatMoney(undefined)).toBe('$0')
    expect(formatMoney('hola')).toBe('$0')
  })

  it('redondea al peso, sin decimales sueltos', () => {
    expect(formatMoney(1000.4)).toBe('$1.000')
    expect(formatMoney(-1000.6)).toBe('−$1.001')
  })

  it('el valor absoluto es el mismo con o sin signo', () => {
    // La cifra no cambia por ser negativa: solo se le antepone el menos.
    expect(formatMoney(-1250000)).toBe('−' + formatMoney(1250000))
  })
})
