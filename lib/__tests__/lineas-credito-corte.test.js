import { describe, it, expect } from 'vitest'
import { calcularProximoCorte, textoProximoCorte } from '@/lib/lineas-credito'

// Medianoche de Bogotá expresada en UTC — el convenio del sistema.
const bogota = (iso) => new Date(`${iso}T05:00:00.000Z`)
const dia = (d) => d.toISOString().slice(0, 10)

describe('próximo corte de una línea', () => {
  it('si aún no llegó, es este mes', () => {
    const { fecha, dias } = calcularProximoCorte(30, bogota('2026-07-28'))
    expect(dia(fecha)).toBe('2026-07-30')
    expect(dias).toBe(2)
  })

  it('si ya pasó, salta al mes siguiente', () => {
    const { fecha, dias } = calcularProximoCorte(5, bogota('2026-07-28'))
    expect(dia(fecha)).toBe('2026-08-05')
    expect(dias).toBe(8)
  })

  it('el día del corte cuenta como HOY, no como el mes que viene', () => {
    // El día del corte el interés todavía no está liquidado. Decirle al
    // prestamista «faltan 31 días» la mañana en que le toca sería lo contrario
    // de lo que necesita.
    const { fecha, dias } = calcularProximoCorte(30, bogota('2026-07-30'))
    expect(dia(fecha)).toBe('2026-07-30')
    expect(dias).toBe(0)
    expect(textoProximoCorte(dias)).toBe('hoy')
  })

  it('EL MES CORTO: un corte a 30 en febrero se topa al 28', () => {
    // `new Date(2026, 1, 30)` no falla: se desborda al 2 de marzo en silencio,
    // y el corte se le correría dos días al cliente sin que nadie vea un error.
    // Y `diaCorte` vale 30 POR DEFECTO, así que esto pasa una vez al año.
    const { fecha } = calcularProximoCorte(30, bogota('2026-02-10'))
    expect(dia(fecha)).toBe('2026-02-28')
  })

  it('el 31 en un mes de 30 se topa al 30', () => {
    expect(dia(calcularProximoCorte(31, bogota('2026-04-10')).fecha)).toBe('2026-04-30')
  })

  it('en año bisiesto febrero llega al 29', () => {
    expect(dia(calcularProximoCorte(31, bogota('2024-02-05')).fecha)).toBe('2024-02-29')
  })

  it('de diciembre salta a enero del año siguiente', () => {
    const { fecha } = calcularProximoCorte(5, bogota('2026-12-20'))
    expect(dia(fecha)).toBe('2027-01-05')
  })

  it('no devuelve fechas pasadas nunca', () => {
    for (let d = 1; d <= 31; d++) {
      for (const hoy of ['2026-01-15', '2026-02-27', '2026-02-28', '2026-04-30', '2026-12-31']) {
        const { fecha, dias } = calcularProximoCorte(d, bogota(hoy))
        expect(dias, `día ${d} desde ${hoy}`).toBeGreaterThanOrEqual(0)
        expect(fecha.getTime()).toBeGreaterThanOrEqual(bogota(hoy).getTime())
      }
    }
  })

  it('aguanta un diaCorte inválido sin reventar la pantalla', () => {
    // La columna es un Int sin tope en la base: nada impide un 0 o un 99.
    for (const malo of [0, -3, 99, null, undefined, NaN, '15']) {
      const { fecha, dias } = calcularProximoCorte(malo, bogota('2026-07-10'))
      expect(fecha instanceof Date && !isNaN(fecha), `con ${malo}`).toBe(true)
      expect(dias).toBeGreaterThanOrEqual(0)
    }
  })

  it('el mismo día da el mismo resultado en UTC que en Bogotá', () => {
    // Producción corre en UTC y el portátil en Bogotá: los fallos de huso son
    // invisibles en local. A las 23:00 de Bogotá ya es el día siguiente en UTC;
    // si el cálculo no normaliza, el corte salta un día al caer la noche.
    const nocheBogota = new Date('2026-07-29T04:30:00.000Z') // 23:30 del 28 en Bogotá
    const { fecha, dias } = calcularProximoCorte(30, nocheBogota)
    expect(dia(fecha)).toBe('2026-07-30')
    expect(dias).toBe(2)
  })

  it('respeta el huso de otros países', () => {
    // México es -6: a las 05:30Z todavía es el día anterior allí.
    const madrugada = new Date('2026-07-29T05:30:00.000Z')
    expect(calcularProximoCorte(30, madrugada, -6).dias).toBe(2)  // aún es 28 en MX
    expect(calcularProximoCorte(30, madrugada, -5).dias).toBe(1)  // ya es 29 en CO
  })
})

describe('cómo se lee', () => {
  it('traduce los días a lo que diría una persona', () => {
    expect(textoProximoCorte(0)).toBe('hoy')
    expect(textoProximoCorte(1)).toBe('mañana')
    expect(textoProximoCorte(5)).toBe('en 5 días')
  })
})
