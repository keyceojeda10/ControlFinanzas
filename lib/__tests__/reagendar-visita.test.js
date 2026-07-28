import { describe, it, expect } from 'vitest'
import { calcularProximoCobro, tieneCobroPendienteHoy } from '@/lib/calculos'

// La tarjeta del cliente y el agrupador de la ruta tienen que responder lo mismo.
//
// Caso reportado: un prestamista reagendo 4 visitas para hoy. La tarjeta decia
// "Cobra hoy" (sale de calcularProximoCobro, que si respeta proximoCobroManual)
// pero el cliente caia en "Proximos y al dia" (sale de tieneCobroPendienteHoy,
// que lo ignoraba). Su mes arrancaba el 1 y aun no se cumplia, asi que por
// calendario "no le tocaba" — aunque el hubiera dicho que si.

// "Hoy" en BOGOTA, no en UTC. Con toISOString() el test se rompia despues de las
// 7pm de Colombia (ahi ya es el dia siguiente en UTC) y pasaba el resto del dia:
// un test que solo funciona a ciertas horas es peor que no tenerlo.
const diaEnBogota = (offsetDias = 0) => {
  const b = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  b.setDate(b.getDate() + offsetDias)
  const y = b.getFullYear()
  const m = String(b.getMonth() + 1).padStart(2, '0')
  const d = String(b.getDate()).padStart(2, '0')
  return new Date(`${y}-${m}-${d}T05:00:00.000Z`)
}
const enBogota = (d) => d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })

// Mensual arrancado hace 26 dias: por calendario todavia NO le toca.
const base = {
  estado: 'activo',
  frecuencia: 'mensual',
  fechaInicio: diaEnBogota(-26),
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
    const p = { ...base, proximoCobroManual: diaEnBogota(0) }
    // la tarjeta dice "Cobra hoy"
    expect(enBogota(calcularProximoCobro(p, [], []))).toBe(enBogota(diaEnBogota(0)))
    // y el agrupador ahora tambien lo pone en "Por cobrar hoy"
    expect(tieneCobroPendienteHoy(p, [], [])).toBe(true)
  })

  it('reagendada para AYER: sigue pendiente hoy', () => {
    expect(tieneCobroPendienteHoy({ ...base, proximoCobroManual: diaEnBogota(-1) }, [], [])).toBe(true)
  })

  it('reagendada al FUTURO: hoy no hay que cobrarle', () => {
    // es justo para lo que sirve reagendar: "pasame el viernes"
    expect(tieneCobroPendienteHoy({ ...base, proximoCobroManual: diaEnBogota(3) }, [], [])).toBe(false)
  })

  it('reagendar al futuro tambien saca de pendiente a uno atrasado', () => {
    const atrasado = { ...base, fechaInicio: diaEnBogota(-90), diasPlazo: 180, totalAPagar: 5000000, cuotaDiaria: 1000000 }
    expect(tieneCobroPendienteHoy(atrasado, [], [])).toBe(true)
    expect(tieneCobroPendienteHoy({ ...atrasado, proximoCobroManual: diaEnBogota(2) }, [], [])).toBe(false)
  })

  it('un prestamo saldado no aparece aunque este reagendado para hoy', () => {
    const saldado = { ...base, totalPagado: base.totalAPagar, proximoCobroManual: diaEnBogota(0) }
    expect(tieneCobroPendienteHoy(saldado, [], [])).toBe(false)
  })
})
