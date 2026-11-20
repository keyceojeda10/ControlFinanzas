/* El atraso de semanal, quincenal y mensual va en DÍAS DE CALENDARIO (19 nov 2026).
 * Con días de cobro, un cliente que paga solo los sábados salía «5d» con un mes sin
 * pagar. El diario sigue contando días de cobro: el domingo no se debe. */
import { describe, it, expect } from 'vitest'
import { calcularDiasMora, fechaInicioMora, calcularInteresMoratorio } from '@/lib/calculos'

const dia = (s) => new Date(`${s}T05:00:00.000Z`)
const hora = (s) => new Date(`${s}T23:00:00.000Z`) // 18:00 en Bogotá
const SOLO_SABADO = [0, 1, 2, 3, 4, 5]

// Semanal que empezó un viernes: cuotas los viernes 30 oct, 6, 13, 20… nov. Pagó dos.
const semanal = {
  estado: 'activo', modoInteres: 'fijo', frecuencia: 'semanal',
  montoPrestado: 1000000, totalAPagar: 1200000, cuotaDiaria: 200000, diasPlazo: 42,
  fechaInicio: dia('2026-10-23'),
  pagos: [
    { tipo: 'completo', montoPagado: 200000, fechaPago: dia('2026-10-31') },
    { tipo: 'completo', montoPagado: 200000, fechaPago: dia('2026-11-07') },
  ],
}

describe('atraso en días de calendario para los no diarios', () => {
  it('debe desde el viernes 13: el domingo 15 son 2 días, no 0', () => {
    expect(fechaInicioMora(semanal, [], [], hora('2026-11-15')).toISOString()).toBe('2026-11-13T05:00:00.000Z')
    expect(calcularDiasMora(semanal, [], [], hora('2026-11-15'))).toBe(2)
  })

  it('⚠ si la fecha cae en un día sin cobro, cuenta desde el primero que SÍ se cobra (antes salía «al día» debiendo)', () => {
    // Solo paga sábados: debió pagar el sábado 14.
    expect(calcularDiasMora(semanal, SOLO_SABADO, [], hora('2026-11-14'))).toBe(0)
    expect(calcularDiasMora(semanal, SOLO_SABADO, [], hora('2026-11-15'))).toBe(1)
  })

  it('un mes sin pagar con un solo día de cobro son ~un mes, no cinco sábados', () => {
    const d = calcularDiasMora(semanal, SOLO_SABADO, [], hora('2026-12-14'))
    expect(d).toBe(30) // del sábado 14 nov al lunes 14 dic
  })

  it('un festivo en la fecha de cobro corre el inicio al día siguiente', () => {
    const fest = [{ fecha: dia('2026-11-13') }]
    expect(calcularDiasMora(semanal, [], fest, hora('2026-11-15'))).toBe(1)
  })

  it('el diario sigue en días de cobro: el domingo no suma', () => {
    const diario = {
      estado: 'activo', modoInteres: 'fijo', frecuencia: 'diario',
      montoPrestado: 100000, totalAPagar: 120000, cuotaDiaria: 5000, diasPlazo: 24,
      fechaInicio: dia('2026-11-02'), pagos: [],
    }
    const sinDomingo = calcularDiasMora(diario, [0], [], hora('2026-11-16'))
    const todos = calcularDiasMora(diario, [], [], hora('2026-11-16'))
    expect(todos - sinDomingo).toBe(2) // los domingos 8 y 15
  })

  it('el moratorio usa el mismo atraso', () => {
    const m = calcularInteresMoratorio({ ...semanal }, SOLO_SABADO, [], 30, 5)
    // Sin reloj fijo: solo comprobar que no se calcula con otra cuenta de días.
    const d = calcularDiasMora(semanal, SOLO_SABADO, [])
    expect(m.diasMoraEfectivos).toBe(Math.max(0, d - 5))
  })
})
