import { describe, it, expect } from 'vitest'
import { calcularProximoCobro, tieneCobroPendienteHoy } from '@/lib/calculos'

// La tarjeta del cliente y el agrupador de la ruta tienen que responder lo mismo.
//
// Caso reportado: un prestamista reagendo 4 visitas para hoy. La tarjeta decia
// "Cobra hoy" (sale de calcularProximoCobro, que si respeta proximoCobroManual)
// pero el cliente caia en "Proximos y al dia" (sale de tieneCobroPendienteHoy,
// que lo ignoraba). Su mes arrancaba el 1 y aun no se cumplia, asi que por
// calendario "no le tocaba" — aunque el hubiera dicho que si.

const diaBog = (offsetDias) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDias)
  return new Date(`${d.toISOString().slice(0, 10)}T05:00:00.000Z`)
}
const enBogota = (d) => d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })

// Mensual arrancado hace 26 dias: por calendario todavia NO le toca.
const base = {
  estado: 'activo',
  frecuencia: 'mensual',
  fechaInicio: diaBog(-26),
  cuotaDiaria: 1690100,
  totalAPagar: 1690100,
  diasPlazo: 30,
  totalPagado: 0,
}

describe('visita reagendada a mano', () => {
  it('sin reagendar: por calendario aun no le toca', () => {
    expect(tieneCobroPendienteHoy(base, [], [])).toBe(false)
  })

  it('reagendada para HOY: la tarjeta y el grupo coinciden', () => {
    const p = { ...base, proximoCobroManual: diaBog(0) }
    // la tarjeta dice "Cobra hoy"
    expect(enBogota(calcularProximoCobro(p, [], []))).toBe(enBogota(diaBog(0)))
    // y el agrupador ahora tambien lo pone en "Por cobrar hoy"
    expect(tieneCobroPendienteHoy(p, [], [])).toBe(true)
  })

  it('reagendada para AYER: sigue pendiente hoy', () => {
    expect(tieneCobroPendienteHoy({ ...base, proximoCobroManual: diaBog(-1) }, [], [])).toBe(true)
  })

  it('reagendada al FUTURO: hoy no hay que cobrarle', () => {
    // es justo para lo que sirve reagendar: "pasame el viernes"
    expect(tieneCobroPendienteHoy({ ...base, proximoCobroManual: diaBog(3) }, [], [])).toBe(false)
  })

  it('reagendar al futuro tambien saca de pendiente a uno atrasado', () => {
    const atrasado = { ...base, fechaInicio: diaBog(-90), diasPlazo: 180, totalAPagar: 5000000, cuotaDiaria: 1000000 }
    expect(tieneCobroPendienteHoy(atrasado, [], [])).toBe(true)
    expect(tieneCobroPendienteHoy({ ...atrasado, proximoCobroManual: diaBog(2) }, [], [])).toBe(false)
  })

  it('un prestamo saldado no aparece aunque este reagendado para hoy', () => {
    const saldado = { ...base, totalPagado: base.totalAPagar, proximoCobroManual: diaBog(0) }
    expect(tieneCobroPendienteHoy(saldado, [], [])).toBe(false)
  })
})
