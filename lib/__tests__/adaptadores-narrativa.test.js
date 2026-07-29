import { describe, it, expect } from 'vitest'
import { generarNarrativa, UMBRAL_RITMO } from '@/lib/adaptadores/narrativa'

// Esta función vivía dentro de un archivo de 2.000 líneas y sin pruebas, con un
// arreglo caro escondido dentro: compara contra AYER A ESTA MISMA HORA. Estas
// pruebas existen sobre todo para que ese arreglo no se pierda en la próxima
// migración.

const fmt = (n) => `$${n.toLocaleString('es-CO')}`

describe('la comparación es contra ayer A ESTA HORA', () => {
  it('a media mañana NO se compara contra el día completo de ayer', () => {
    // Ayer cerró con 1.000.000; a esta hora llevaba 200.000. Hoy va por 260.000:
    // contra el día entero sería «74% menos» —la alarma que sonaba a diario—,
    // contra la misma hora es un 30% MÁS.
    const f = generarNarrativa({
      recaudadoHoy: 260_000, recaudadoAyer: 1_000_000, recaudadoAyerAEstaHora: 200_000,
    })
    expect(f).toBe('Vas a buen ritmo: 30% más que ayer a esta hora')
    expect(f).not.toMatch(/menos/)
  })

  it('cuando de verdad va peor, lo dice', () => {
    expect(generarNarrativa({ recaudadoHoy: 100_000, recaudadoAyerAEstaHora: 200_000 }))
      .toBe('50% menos que ayer a esta hora')
  })

  it('una diferencia pequeña es ruido, no una señal', () => {
    // +10%: por debajo del umbral, así que no se dice nada de ayer.
    expect(generarNarrativa({ recaudadoHoy: 110_000, recaudadoAyerAEstaHora: 100_000 })).toBeNull()
    expect(UMBRAL_RITMO).toBe(15)
  })
})

describe('contra la meta del día', () => {
  it('cumplida no se adorna', () => {
    expect(generarNarrativa({ recaudadoHoy: 150_000, recaudadoAyer: 1, esperadoHoy: 100_000 }))
      .toBe('Meta del día cumplida')
  })

  it('cerca dice cuánto falta, en plata', () => {
    expect(generarNarrativa({ recaudadoHoy: 80_000, recaudadoAyer: 1, esperadoHoy: 100_000, formatear: fmt }))
      .toBe('Falta poco: $20.000 para tu meta')
  })

  it('a media tabla dice el porcentaje', () => {
    expect(generarNarrativa({ recaudadoHoy: 50_000, recaudadoAyer: 1, esperadoHoy: 100_000 }))
      .toBe('Vas en 50% de tu meta del día')
  })
})

describe('cuándo NO dice nada', () => {
  it('sin nada hoy ni ayer no hay nada que interpretar', () => {
    expect(generarNarrativa({})).toBeNull()
    expect(generarNarrativa({ recaudadoHoy: 0, recaudadoAyer: 0 })).toBeNull()
  })

  it('una frase de relleno todos los días enseña a saltársela', () => {
    // Va por el 20% de la meta: ni buen ritmo, ni cerca, ni mejor día.
    expect(generarNarrativa({ recaudadoHoy: 20_000, recaudadoAyer: 1, esperadoHoy: 100_000 })).toBeNull()
  })
})

describe('el mejor día de la semana', () => {
  it('solo si HOY es el máximo de los siete', () => {
    expect(generarNarrativa({ recaudadoHoy: 9, recaudadoAyer: 1, sparkline7d: [1, 2, 3, 4, 5, 6, 9] }))
      .toBe('Tu mejor día de la semana')
    expect(generarNarrativa({ recaudadoHoy: 5, recaudadoAyer: 1, sparkline7d: [1, 2, 3, 4, 5, 9, 5] }))
      .toBeNull()
  })

  it('con la semana en ceros no felicita', () => {
    expect(generarNarrativa({ recaudadoHoy: 1, recaudadoAyer: 1, sparkline7d: [0, 0, 0, 0, 0, 0, 0] }))
      .toBeNull()
  })
})
